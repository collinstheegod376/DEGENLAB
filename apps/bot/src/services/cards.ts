import { and, desc, eq } from "drizzle-orm";
import { defaultTheme, renderPnlCard } from "@degenlab/card-renderer";
import { cardTemplates, pnlCards, type Database } from "@degenlab/database";
import { shareId, shortId } from "@degenlab/ledger";
import { applyProfitAdjuster } from "@degenlab/pnl";
import type {
  CardLayout,
  CardThemeId,
  CardThemeJson,
  ChartStyle,
  DisplayMetrics,
  LedgerSnapshot,
  ProfitInputMode,
} from "@degenlab/shared-types";

const THEME_ALIAS: Record<string, CardThemeId> = {
  og: "obsidian-green",
  vc: "violet-circuit",
  mo: "mono",
  sg: "solana-gradient",
  "obsidian-green": "obsidian-green",
  "violet-circuit": "violet-circuit",
  mono: "mono",
  "solana-gradient": "solana-gradient",
};

export function resolveTheme(alias: string): CardThemeId | null {
  return THEME_ALIAS[alias] ?? null;
}

export async function createCard(
  db: Database,
  input: {
    userId: string;
    positionId: string;
    snapshot: LedgerSnapshot;
    displayName: string;
  },
) {
  const theme = defaultTheme(input.displayName);
  const display = applyProfitAdjuster({
    snapshot: input.snapshot,
    mode: null,
    value: null,
  });
  const [template] = await db
    .select()
    .from(cardTemplates)
    .where(eq(cardTemplates.name, theme.layout))
    .limit(1);
  const [card] = await db
    .insert(pnlCards)
    .values({
      shortId: shortId(),
      userId: input.userId,
      positionId: input.positionId,
      templateId: template?.id ?? null,
      themeJson: theme,
      caption: "",
      ledgerSnapshotJson: input.snapshot as unknown as Record<string, unknown>,
      displayMetricsJson: display as unknown as Record<string, unknown>,
      profitInputMode: null,
      profitInputValue: null,
      isVerified: true,
      displayCustomized: false,
      version: 1,
    })
    .returning();
  return card!;
}

export async function getCardByShort(
  db: Database,
  userId: string,
  short: string,
) {
  const [row] = await db
    .select()
    .from(pnlCards)
    .where(and(eq(pnlCards.shortId, short), eq(pnlCards.userId, userId)))
    .limit(1);
  return row ?? null;
}

export async function getPublicCard(db: Database, publicShare: string) {
  const [row] = await db
    .select()
    .from(pnlCards)
    .where(and(eq(pnlCards.publicShareId, publicShare), eq(pnlCards.isPublic, true)))
    .limit(1);
  return row ?? null;
}

export async function listCards(db: Database, userId: string) {
  return db
    .select()
    .from(pnlCards)
    .where(eq(pnlCards.userId, userId))
    .orderBy(desc(pnlCards.updatedAt))
    .limit(20);
}

export async function patchCardTheme(
  db: Database,
  cardId: string,
  patch: Partial<CardThemeJson>,
) {
  const [current] = await db.select().from(pnlCards).where(eq(pnlCards.id, cardId)).limit(1);
  if (!current) return null;
  const theme = { ...(current.themeJson as CardThemeJson), ...patch };
  const [updated] = await db
    .update(pnlCards)
    .set({
      themeJson: theme,
      version: current.version + 1,
      telegramFileId: null,
      updatedAt: new Date(),
    })
    .where(eq(pnlCards.id, cardId))
    .returning();
  return updated;
}

export async function applyCardProfit(
  db: Database,
  cardId: string,
  mode: ProfitInputMode | null,
  value: string | null,
) {
  const [current] = await db.select().from(pnlCards).where(eq(pnlCards.id, cardId)).limit(1);
  if (!current) return null;
  const snapshot = current.ledgerSnapshotJson as unknown as LedgerSnapshot;
  const display = applyProfitAdjuster({
    snapshot,
    mode,
    value,
  });
  const [updated] = await db
    .update(pnlCards)
    .set({
      displayMetricsJson: display as unknown as Record<string, unknown>,
      profitInputMode: mode,
      profitInputValue: value,
      displayCustomized: mode !== null,
      isVerified: true,
      version: current.version + 1,
      telegramFileId: null,
      updatedAt: new Date(),
    })
    .where(eq(pnlCards.id, cardId))
    .returning();
  return updated;
}

export async function shareCard(db: Database, cardId: string) {
  const [current] = await db.select().from(pnlCards).where(eq(pnlCards.id, cardId)).limit(1);
  if (!current) return null;
  const id = current.publicShareId ?? shareId();
  const [updated] = await db
    .update(pnlCards)
    .set({
      publicShareId: id,
      isPublic: true,
      isVerified: true,
      updatedAt: new Date(),
    })
    .where(eq(pnlCards.id, cardId))
    .returning();
  return updated;
}

export async function revokeCard(db: Database, cardId: string) {
  const [updated] = await db
    .update(pnlCards)
    .set({
      isPublic: false,
      updatedAt: new Date(),
    })
    .where(eq(pnlCards.id, cardId))
    .returning();
  return updated;
}

export async function renderCardPng(
  db: Database,
  cardId: string,
  verifyBase: string,
): Promise<{ png: Buffer; card: NonNullable<Awaited<ReturnType<typeof getCardByShort>>> }> {
  const [card] = await db.select().from(pnlCards).where(eq(pnlCards.id, cardId)).limit(1);
  if (!card) throw new Error("card not found");
  const theme = card.themeJson as CardThemeJson;
  const metrics = card.displayMetricsJson as unknown as DisplayMetrics;
  const verifyUrl = card.publicShareId
    ? `${verifyBase.replace(/\/$/, "")}/c/${card.publicShareId}`
    : `${verifyBase.replace(/\/$/, "")}/c/preview-${card.shortId}`;
  const png = await renderPnlCard({
    metrics,
    theme,
    verifyUrl,
    displayName: theme.displayName,
  });
  return { png, card };
}

export function asLayout(value: string): CardLayout | null {
  if (value === "portrait" || value === "wide" || value === "compact") return value;
  return null;
}

export function asChart(value: string): ChartStyle | null {
  if (value === "line" || value === "area" || value === "candles") return value;
  return null;
}

export function moderateCaption(raw: string): string {
  return raw.replace(/<[^>]+>/g, "").trim().slice(0, 180);
}
