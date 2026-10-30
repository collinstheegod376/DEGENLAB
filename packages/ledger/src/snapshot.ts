import { and, desc, eq } from "drizzle-orm";
import {
  positions,
  practiceAccounts,
  priceSnapshots,
  tradeEvents,
  watchedTokens,
  type Database,
} from "@degenlab/database";
import { d, pnlPercent, toNumericString, unrealizedPnl } from "@degenlab/pnl";
import type {
  ChartPoint,
  LedgerSnapshot,
  MarketQuote,
  PositionStatus,
} from "@degenlab/shared-types";

export async function buildLedgerSnapshot(
  db: Database,
  positionId: string,
  quote: MarketQuote | null,
  assumptions: { feeBps: number; slippageBps: number },
): Promise<LedgerSnapshot> {
  const [position] = await db
    .select()
    .from(positions)
    .where(eq(positions.id, positionId))
    .limit(1);
  if (!position) throw new Error("position not found");

  const [token] = await db
    .select()
    .from(watchedTokens)
    .where(
      and(
        eq(watchedTokens.mintAddress, position.mintAddress),
        eq(watchedTokens.cluster, position.cluster),
      ),
    )
    .limit(1);

  const [account] = await db
    .select()
    .from(practiceAccounts)
    .where(eq(practiceAccounts.userId, position.userId))
    .limit(1);

  const events = await db
    .select()
    .from(tradeEvents)
    .where(eq(tradeEvents.positionId, position.id))
    .orderBy(tradeEvents.createdAt);

  const candles = await db
    .select()
    .from(priceSnapshots)
    .where(
      and(
        eq(priceSnapshots.mintAddress, position.mintAddress),
        eq(priceSnapshots.cluster, position.cluster),
      ),
    )
    .orderBy(desc(priceSnapshots.fetchedAt))
    .limit(24);

  const chart: ChartPoint[] = candles
    .slice()
    .reverse()
    .map((row) => ({
      t: row.fetchedAt.getTime(),
      p: String(row.price),
    }));

  const markPrice = quote?.price ?? (candles[0] ? String(candles[0].price) : position.averageEntry);
  const quoteStatus = quote?.status ?? (candles[0] ? "stale" : "missing");
  const markValue = d(position.quantity).mul(d(markPrice));
  const uPnL =
    position.status === "OPEN"
      ? unrealizedPnl({
          quantity: position.quantity,
          remainingCostBasis: position.remainingCostBasis,
          markPrice,
          assumptions,
        })
      : d(0);
  const realized = d(position.realizedPnl);
  const total = realized.plus(uPnL);
  const basis =
    position.status === "OPEN"
      ? d(position.remainingCostBasis)
      : events
          .filter((e) => e.eventType === "BUY")
          .reduce((acc, e) => acc.plus(d(e.grossValue)), d(0));
  const sells = events.filter((e) => e.eventType === "SELL");
  const wins = sells.filter((e) => {
    const allocated = d(position.averageEntry).mul(d(e.quantity));
    return d(e.grossValue).minus(d(e.fees)).minus(allocated).gte(0);
  }).length;

  return {
    positionId: position.id,
    mint: position.mintAddress,
    cluster: position.cluster as LedgerSnapshot["cluster"],
    tokenName: token?.tokenName ?? "Unknown token",
    ticker: token?.ticker ?? "UNKNOWN",
    status: position.status as PositionStatus,
    quantity: String(position.quantity),
    remainingCostBasis:
      position.status === "OPEN"
        ? String(position.remainingCostBasis)
        : toNumericString(basis.eq(0) ? d(position.remainingCostBasis) : basis),
    averageEntry: String(position.averageEntry),
    realizedPnl: toNumericString(realized),
    unrealizedPnl: toNumericString(uPnL),
    totalPnl: toNumericString(total),
    pnlPercent: toNumericString(pnlPercent(total, basis.eq(0) ? position.remainingCostBasis : basis)),
    markPrice,
    markValue: toNumericString(markValue),
    modeledFees: events[0] ? String(events[0].fees) : "0",
    openedAt: position.openedAt.toISOString(),
    closedAt: position.closedAt ? position.closedAt.toISOString() : null,
    quoteProvider: quote?.provider ?? candles[0]?.provider ?? "none",
    quoteTimestamp: (quote?.sourceTimestamp ??
      candles[0]?.sourceTimestamp.toISOString() ??
      position.openedAt.toISOString()),
    quoteStatus,
    solBalance: account ? String(account.availableVirtualBalance) : "0",
    solBalanceUsd: account ? String(account.availableVirtualBalance) : "0",
    sevenDayTxWins: wins,
    sevenDayTxTotal: Math.max(1, sells.length || events.filter((e) => e.eventType === "BUY").length),
    chart,
  };
}
