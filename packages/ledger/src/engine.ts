import { and, desc, eq, sql } from "drizzle-orm";
import {
  practiceAccounts,
  positions,
  priceSnapshots,
  tradeEvents,
  users,
  type Database,
  type Tx,
} from "@degenlab/database";
import {
  d,
  modeledBuy,
  modeledSell,
  pnlPercent,
  toNumericString,
  unrealizedPnl,
  weightedAverageEntry,
  type ExecutionAssumptions,
} from "@degenlab/pnl";
import type { Cluster, MarketQuote } from "@degenlab/shared-types";
import { shortId } from "./ids.js";

export class LedgerError extends Error {
  constructor(
    message: string,
    readonly code:
      | "insufficient_balance"
      | "no_position"
      | "duplicate"
      | "invalid_qty"
      | "not_found",
  ) {
    super(message);
    this.name = "LedgerError";
  }
}

export type BuyInput = {
  userId: string;
  mint: string;
  cluster: Cluster;
  quoteAmount: string;
  quote: MarketQuote;
  assumptions: ExecutionAssumptions;
  idempotencyKey: string;
};

export type SellInput = {
  userId: string;
  positionId: string;
  percent: string;
  quote: MarketQuote;
  assumptions: ExecutionAssumptions;
  idempotencyKey: string;
};

async function loadAccountForUpdate(tx: Tx, userId: string) {
  const [account] = await tx
    .select()
    .from(practiceAccounts)
    .where(eq(practiceAccounts.userId, userId))
    .for("update")
    .limit(1);
  if (!account) throw new LedgerError("Practice account missing.", "not_found");
  return account;
}

async function insertSnapshot(tx: Tx, quote: MarketQuote): Promise<string> {
  const [row] = await tx
    .insert(priceSnapshots)
    .values({
      cluster: quote.cluster,
      mintAddress: quote.mint,
      price: quote.price,
      quoteCurrency: quote.quoteCurrency,
      provider: quote.provider,
      sourceTimestamp: new Date(quote.sourceTimestamp),
      fetchedAt: new Date(quote.fetchedAt),
      liquidity: quote.liquidity,
      metadataJson: {
        volume24h: quote.volume24h,
        confidence: quote.confidence,
        status: quote.status,
      },
    })
    .returning({ id: priceSnapshots.id });
  if (!row) throw new LedgerError("Failed to store quote snapshot.", "not_found");
  return row.id;
}

async function existingByKey(tx: Tx, idempotencyKey: string) {
  const [event] = await tx
    .select()
    .from(tradeEvents)
    .where(eq(tradeEvents.idempotencyKey, idempotencyKey))
    .limit(1);
  return event ?? null;
}

export async function executeBuy(db: Database, input: BuyInput) {
  return db.transaction(async (tx) => {
    const duplicate = await existingByKey(tx, input.idempotencyKey);
    if (duplicate) {
      const [position] = await tx
        .select()
        .from(positions)
        .where(eq(positions.id, duplicate.positionId))
        .limit(1);
      return { event: duplicate, position, duplicate: true as const, model: undefined };
    }

    const account = await loadAccountForUpdate(tx, input.userId);
    const available = d(account.availableVirtualBalance);
    const amount = d(input.quoteAmount);
    if (amount.gt(available)) {
      throw new LedgerError(
        "Not enough practice credits for that size.",
        "insufficient_balance",
      );
    }

    const model = modeledBuy({
      quoteAmount: amount,
      quotePrice: input.quote.price,
      assumptions: input.assumptions,
    });
    const snapshotId = await insertSnapshot(tx, input.quote);

    const [open] = await tx
      .select()
      .from(positions)
      .where(
        and(
          eq(positions.userId, input.userId),
          eq(positions.mintAddress, input.mint),
          eq(positions.cluster, input.cluster),
          eq(positions.status, "OPEN"),
        ),
      )
      .for("update")
      .limit(1);

    let positionId: string;
    let position;

    if (open) {
      const newQty = d(open.quantity).plus(model.quantity);
      const newCost = d(open.remainingCostBasis).plus(model.costBasis);
      const avg = weightedAverageEntry(newCost, newQty);
      const [updated] = await tx
        .update(positions)
        .set({
          quantity: toNumericString(newQty),
          remainingCostBasis: toNumericString(newCost),
          averageEntry: toNumericString(avg),
        })
        .where(eq(positions.id, open.id))
        .returning();
      positionId = open.id;
      position = updated;
    } else {
      const [created] = await tx
        .insert(positions)
        .values({
          shortId: shortId(),
          userId: input.userId,
          mintAddress: input.mint,
          cluster: input.cluster,
          status: "OPEN",
          quantity: toNumericString(model.quantity),
          remainingCostBasis: toNumericString(model.costBasis),
          averageEntry: toNumericString(model.executionPrice.eq(0) ? 0 : weightedAverageEntry(model.costBasis, model.quantity)),
          realizedPnl: "0",
        })
        .returning();
      if (!created) throw new LedgerError("Failed to open position.", "not_found");
      positionId = created.id;
      position = created;
    }

    const [event] = await tx
      .insert(tradeEvents)
      .values({
        userId: input.userId,
        positionId,
        eventType: "BUY",
        idempotencyKey: input.idempotencyKey,
        mintAddress: input.mint,
        cluster: input.cluster,
        quantity: toNumericString(model.quantity),
        executionPrice: toNumericString(model.executionPrice),
        grossValue: toNumericString(model.quoteAmount),
        fees: toNumericString(model.fees),
        slippageAssumption: toNumericString(d(input.assumptions.slippageBps).div(10_000)),
        quoteSnapshotId: snapshotId,
      })
      .returning();

    await tx
      .update(practiceAccounts)
      .set({
        availableVirtualBalance: toNumericString(available.minus(amount)),
        updatedAt: new Date(),
      })
      .where(eq(practiceAccounts.id, account.id));

    return { event, position, duplicate: false as const, model };
  });
}

export async function executeSell(db: Database, input: SellInput) {
  return db.transaction(async (tx) => {
    const duplicate = await existingByKey(tx, input.idempotencyKey);
    if (duplicate) {
      const [position] = await tx
        .select()
        .from(positions)
        .where(eq(positions.id, duplicate.positionId))
        .limit(1);
      return { event: duplicate, position, duplicate: true as const, model: undefined };
    }

    const account = await loadAccountForUpdate(tx, input.userId);
    const [open] = await tx
      .select()
      .from(positions)
      .where(
        and(eq(positions.id, input.positionId), eq(positions.userId, input.userId)),
      )
      .for("update")
      .limit(1);
    if (!open || open.status !== "OPEN") {
      throw new LedgerError("No open position to close.", "no_position");
    }

    const percent = d(input.percent);
    if (percent.lte(0) || percent.gt(100)) {
      throw new LedgerError("Close percent must be between 0 and 100.", "invalid_qty");
    }
    const remainingQty = d(open.quantity);
    const sellQty = remainingQty.mul(percent).div(100);
    const model = modeledSell({
      quantity: sellQty,
      quotePrice: input.quote.price,
      remainingQuantity: remainingQty,
      remainingCostBasis: open.remainingCostBasis,
      assumptions: input.assumptions,
    });
    const snapshotId = await insertSnapshot(tx, input.quote);

    const leftoverQty = remainingQty.minus(sellQty);
    const leftoverCost = d(open.remainingCostBasis).minus(model.allocatedCostBasis);
    const newRealized = d(open.realizedPnl).plus(model.realizedPnl);
    const closed = leftoverQty.lte("0.0000000001");

    const [updated] = await tx
      .update(positions)
      .set({
        quantity: toNumericString(closed ? d(0) : leftoverQty),
        remainingCostBasis: toNumericString(closed ? d(0) : leftoverCost),
        averageEntry: toNumericString(
          closed ? d(open.averageEntry) : weightedAverageEntry(leftoverCost, leftoverQty),
        ),
        realizedPnl: toNumericString(newRealized),
        status: closed ? "CLOSED" : "OPEN",
        closedAt: closed ? new Date() : open.closedAt,
      })
      .where(eq(positions.id, open.id))
      .returning();

    const [event] = await tx
      .insert(tradeEvents)
      .values({
        userId: input.userId,
        positionId: open.id,
        eventType: "SELL",
        idempotencyKey: input.idempotencyKey,
        mintAddress: open.mintAddress,
        cluster: open.cluster,
        quantity: toNumericString(model.quantity),
        executionPrice: toNumericString(model.executionPrice),
        grossValue: toNumericString(model.grossValue),
        fees: toNumericString(model.sellFees),
        slippageAssumption: toNumericString(d(input.assumptions.slippageBps).div(10_000)),
        quoteSnapshotId: snapshotId,
      })
      .returning();

    await tx
      .update(practiceAccounts)
      .set({
        availableVirtualBalance: toNumericString(
          d(account.availableVirtualBalance).plus(model.proceeds),
        ),
        updatedAt: new Date(),
      })
      .where(eq(practiceAccounts.id, account.id));

    return { event, position: updated, duplicate: false as const, model };
  });
}

export async function resetPracticeAccount(
  db: Database,
  userId: string,
  startingBalance: string,
) {
  return db.transaction(async (tx) => {
    await tx
      .update(positions)
      .set({
        status: "CLOSED",
        quantity: "0",
        remainingCostBasis: "0",
        closedAt: new Date(),
      })
      .where(and(eq(positions.userId, userId), eq(positions.status, "OPEN")));

    await tx
      .update(practiceAccounts)
      .set({
        startingVirtualBalance: startingBalance,
        availableVirtualBalance: startingBalance,
        updatedAt: new Date(),
      })
      .where(eq(practiceAccounts.userId, userId));
  });
}

export async function getOpenPositionForMint(
  db: Database,
  userId: string,
  mint: string,
  cluster: Cluster,
) {
  const [row] = await db
    .select()
    .from(positions)
    .where(
      and(
        eq(positions.userId, userId),
        eq(positions.mintAddress, mint),
        eq(positions.cluster, cluster),
        eq(positions.status, "OPEN"),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function getPositionByShortId(
  db: Database,
  userId: string,
  short: string,
) {
  const [row] = await db
    .select()
    .from(positions)
    .where(and(eq(positions.shortId, short), eq(positions.userId, userId)))
    .limit(1);
  return row ?? null;
}

export async function listPositions(db: Database, userId: string, status?: "OPEN" | "CLOSED") {
  const where = status
    ? and(eq(positions.userId, userId), eq(positions.status, status))
    : eq(positions.userId, userId);
  return db.select().from(positions).where(where).orderBy(desc(positions.openedAt)).limit(20);
}

export function markFromQuote(
  quantity: string,
  remainingCostBasis: string,
  quotePrice: string,
  assumptions: ExecutionAssumptions,
) {
  const u = unrealizedPnl({
    quantity,
    remainingCostBasis,
    markPrice: quotePrice,
    assumptions,
  });
  const markValue = d(quantity).mul(d(quotePrice));
  const total = d(0).plus(u);
  return {
    markPrice: quotePrice,
    markValue: toNumericString(markValue),
    unrealized: toNumericString(u),
    totalPnl: toNumericString(total),
    pnlPercent: toNumericString(pnlPercent(total, remainingCostBasis)),
  };
}

export async function leaderboardRows(db: Database, limit = 10) {
  const rows = await db
    .select({
      displayName: users.displayName,
      telegramUsername: users.telegramUsername,
      realized: sql<string>`coalesce(sum(${positions.realizedPnl}), 0)`,
    })
    .from(users)
    .leftJoin(positions, eq(positions.userId, users.id))
    .where(eq(users.leaderboardOptIn, true))
    .groupBy(users.id, users.displayName, users.telegramUsername)
    .orderBy(sql`coalesce(sum(${positions.realizedPnl}), 0) desc`)
    .limit(limit);
  return rows;
}
