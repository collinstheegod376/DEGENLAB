import { InputFile } from "grammy";
import { buildLedgerSnapshot } from "@degenlab/ledger";
import { getPositionByShortId } from "@degenlab/ledger";
import type { CardThemeJson, DisplayMetrics } from "@degenlab/shared-types";
import { cardEditorText } from "../copy.js";
import {
  cardEditor,
  cardsList,
  chartPicker,
  layoutPicker,
  mainMenu,
  themePicker,
} from "../keyboards/index.js";
import {
  applyCardProfit,
  asChart,
  asLayout,
  createCard,
  getCardByShort,
  listCards,
  moderateCaption,
  patchCardTheme,
  renderCardPng,
  resolveTheme,
  revokeCard,
  shareCard,
} from "../services/cards.js";
import { getWatched } from "../services/tokens.js";
import type { AppContext } from "../context.js";
import { logger } from "../logger.js";

function assumptions(ctx: AppContext) {
  return { feeBps: ctx.cfg.PRACTICE_FEE_BPS, slippageBps: ctx.cfg.PRACTICE_SLIPPAGE_BPS };
}

function verifyBase(ctx: AppContext) {
  return ctx.cfg.PUBLIC_BASE_URL || "https://degenlab.local";
}

async function editorMessage(ctx: AppContext, shortId: string) {
  const card = await getCardByShort(ctx.db, ctx.viewer.userId, shortId);
  if (!card) {
    await ctx.reply("Card not found.");
    return;
  }
  const metrics = card.displayMetricsJson as unknown as DisplayMetrics;
  const theme = card.themeJson as CardThemeJson;
  await ctx.reply(
    cardEditorText({
      ticker: metrics.ticker,
      verified: card.isVerified,
      customized: card.displayCustomized,
      pnlPct: metrics.displayPnlPercent,
      pnlAmt: metrics.displayPnlAmount,
      theme: theme.theme,
      layout: theme.layout,
    }),
    { parse_mode: "HTML", reply_markup: cardEditor(card.shortId) },
  );
}

export async function showCards(ctx: AppContext) {
  const cards = await listCards(ctx.db, ctx.viewer.userId);
  if (cards.length === 0) {
    await ctx.reply("No cards yet. Open a position and tap PnL card.", {
      reply_markup: mainMenu(),
    });
    return;
  }
  const rows = [];
  for (const card of cards) {
    const metrics = card.displayMetricsJson as unknown as DisplayMetrics;
    rows.push({ shortId: card.shortId, ticker: metrics.ticker || "CARD" });
  }
  await ctx.reply("Verified practice cards.", { reply_markup: cardsList(rows) });
}

export async function newCardFromPosition(ctx: AppContext, posShort: string) {
  const pos = await getPositionByShortId(ctx.db, ctx.viewer.userId, posShort);
  if (!pos) {
    await ctx.reply("Position not found.");
    return;
  }
  let quote = null;
  try {
    quote = await ctx.market.getQuote(pos.mintAddress, "USD", "mainnet");
  } catch {
    quote = null;
  }
  const snapshot = await buildLedgerSnapshot(ctx.db, pos.id, quote, assumptions(ctx));
  const token = await getWatched(ctx.db, pos.mintAddress, pos.cluster);
  if (token) {
    snapshot.tokenName = token.tokenName;
    snapshot.ticker = token.ticker;
  }
  const card = await createCard(ctx.db, {
    userId: ctx.viewer.userId,
    positionId: pos.id,
    snapshot,
    displayName: ctx.viewer.displayName,
  });
  ctx.session.cardShortId = card.shortId;
  await editorMessage(ctx, card.shortId);
}

export async function editCard(ctx: AppContext, shortId: string) {
  ctx.session.cardShortId = shortId;
  await editorMessage(ctx, shortId);
}

export async function previewCard(ctx: AppContext, shortId: string) {
  const card = await getCardByShort(ctx.db, ctx.viewer.userId, shortId);
  if (!card) {
    await ctx.reply("Card not found.");
    return;
  }
  try {
    const { png } = await renderCardPng(ctx.db, card.id, verifyBase(ctx));
    const sent = await ctx.replyWithPhoto(new InputFile(png, `degenlab-${card.shortId}.png`), {
      caption: "VERIFIED  ·  PRACTICE / SIMULATED  ·  DegenLab",
      reply_markup: cardEditor(card.shortId),
    });
    const fileId = sent.photo?.at(-1)?.file_id;
    if (fileId) {
      const { pnlCards } = await import("@degenlab/database");
      const { eq } = await import("drizzle-orm");
      await ctx.db
        .update(pnlCards)
        .set({ telegramFileId: fileId, updatedAt: new Date() })
        .where(eq(pnlCards.id, card.id));
    }
  } catch (error) {
    logger.error({ err: error }, "card render failed");
    await ctx.reply("Could not render the card. Try again.");
  }
}

export async function setTheme(ctx: AppContext, shortId: string, alias: string) {
  const card = await getCardByShort(ctx.db, ctx.viewer.userId, shortId);
  const theme = resolveTheme(alias);
  if (!card || !theme) return;
  await patchCardTheme(ctx.db, card.id, { theme });
  await previewCard(ctx, shortId);
}

export async function setLayout(ctx: AppContext, shortId: string, layoutRaw: string) {
  const card = await getCardByShort(ctx.db, ctx.viewer.userId, shortId);
  const layout = asLayout(layoutRaw);
  if (!card || !layout) return;
  await patchCardTheme(ctx.db, card.id, { layout });
  await previewCard(ctx, shortId);
}

export async function setChart(ctx: AppContext, shortId: string, styleRaw: string) {
  const card = await getCardByShort(ctx.db, ctx.viewer.userId, shortId);
  const chartStyle = asChart(styleRaw);
  if (!card || !chartStyle) return;
  await patchCardTheme(ctx.db, card.id, { chartStyle });
  await previewCard(ctx, shortId);
}

export async function promptProfit(ctx: AppContext, shortId: string, mode: "percent" | "amount") {
  ctx.session.cardShortId = shortId;
  ctx.session.awaiting = mode === "percent" ? "pnl_percent" : "pnl_amount";
  await ctx.reply(
    mode === "percent"
      ? "Send a headline PnL percent. Example: <code>2754.13</code> or <code>-12.5</code>"
      : "Send a headline PnL amount in virtual USD. Example: <code>130900</code>",
    { parse_mode: "HTML" },
  );
}

export async function applyProfitText(ctx: AppContext, text: string) {
  const shortId = ctx.session.cardShortId;
  if (!shortId) {
    await ctx.reply("Open a card editor first.");
    return;
  }
  const card = await getCardByShort(ctx.db, ctx.viewer.userId, shortId);
  if (!card) return;
  const mode = ctx.session.awaiting === "pnl_percent" ? "percent" : "amount";
  ctx.session.awaiting = undefined;
  const updated = await applyCardProfit(ctx.db, card.id, mode, text.trim());
  if (!updated?.isVerified) {
    await ctx.reply("Card must stay verified. Adjustment was rejected.");
    return;
  }
  await previewCard(ctx, shortId);
}

export async function clearProfit(ctx: AppContext, shortId: string) {
  const card = await getCardByShort(ctx.db, ctx.viewer.userId, shortId);
  if (!card) return;
  await applyCardProfit(ctx.db, card.id, null, null);
  await previewCard(ctx, shortId);
}

export async function promptCaption(ctx: AppContext, shortId: string) {
  ctx.session.cardShortId = shortId;
  ctx.session.awaiting = "caption";
  await ctx.reply("Send a caption (max 180 characters).");
}

export async function promptName(ctx: AppContext, shortId: string) {
  ctx.session.cardShortId = shortId;
  ctx.session.awaiting = "display_name";
  await ctx.reply("Send a display name (max 32 characters).");
}

export async function applyCaption(ctx: AppContext, text: string) {
  const shortId = ctx.session.cardShortId;
  if (!shortId) return;
  const card = await getCardByShort(ctx.db, ctx.viewer.userId, shortId);
  if (!card) return;
  ctx.session.awaiting = undefined;
  await patchCardTheme(ctx.db, card.id, { caption: moderateCaption(text) });
  await previewCard(ctx, shortId);
}

export async function applyName(ctx: AppContext, text: string) {
  const shortId = ctx.session.cardShortId;
  if (!shortId) return;
  const card = await getCardByShort(ctx.db, ctx.viewer.userId, shortId);
  if (!card) return;
  ctx.session.awaiting = undefined;
  await patchCardTheme(ctx.db, card.id, { displayName: text.trim().slice(0, 32) });
  await previewCard(ctx, shortId);
}

export async function share(ctx: AppContext, shortId: string) {
  const card = await getCardByShort(ctx.db, ctx.viewer.userId, shortId);
  if (!card) return;
  const updated = await shareCard(ctx.db, card.id);
  if (!updated?.publicShareId) return;
  const url = `${verifyBase(ctx).replace(/\/$/, "")}/c/${updated.publicShareId}`;
  await previewCard(ctx, shortId);
  await ctx.reply(
    `Card is public and verified.\n${url}\n\nAnyone with the link can confirm DegenLab issued it. Rankings still use the ledger.`,
    { reply_markup: cardEditor(shortId) },
  );
}

export async function revoke(ctx: AppContext, shortId: string) {
  const card = await getCardByShort(ctx.db, ctx.viewer.userId, shortId);
  if (!card) return;
  await revokeCard(ctx.db, card.id);
  await ctx.reply("Public link revoked. The card stays in your history.", {
    reply_markup: cardEditor(shortId),
  });
}

export async function showThemePicker(ctx: AppContext, shortId: string) {
  await ctx.reply("Pick a theme.", { reply_markup: themePicker(shortId) });
}
export async function showLayoutPicker(ctx: AppContext, shortId: string) {
  await ctx.reply("Pick a layout.", { reply_markup: layoutPicker(shortId) });
}
export async function showChartPicker(ctx: AppContext, shortId: string) {
  await ctx.reply("Pick a chart style.", { reply_markup: chartPicker(shortId) });
}
