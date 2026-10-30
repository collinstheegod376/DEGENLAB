import type {
  DisplayMetrics,
  LedgerSnapshot,
  ProfitInputMode,
} from "@degenlab/shared-types";
import { d, Decimal, toNumericString, zero } from "./decimal.js";
import { pnlPercent } from "./calc.js";

export type ProfitAdjusterInput = {
  snapshot: LedgerSnapshot;
  mode: ProfitInputMode | null;
  value: Decimal.Value | null;
};

function holdingMs(snapshot: LedgerSnapshot, now = Date.now()): number {
  const opened = Date.parse(snapshot.openedAt);
  const end = snapshot.closedAt ? Date.parse(snapshot.closedAt) : now;
  if (!Number.isFinite(opened) || !Number.isFinite(end) || end < opened) {
    return 0;
  }
  return end - opened;
}

function scaleChart(
  chart: LedgerSnapshot["chart"],
  targetEndPrice: Decimal,
): LedgerSnapshot["chart"] {
  if (chart.length === 0) {
    return [{ t: Date.now(), p: toNumericString(targetEndPrice) }];
  }
  const last = chart[chart.length - 1];
  if (!last) {
    return [{ t: Date.now(), p: toNumericString(targetEndPrice) }];
  }
  const lastPrice = d(last.p);
  if (lastPrice.eq(0)) {
    return chart.map((point, i) =>
      i === chart.length - 1
        ? { ...point, p: toNumericString(targetEndPrice) }
        : point,
    );
  }
  const factor = targetEndPrice.div(lastPrice);
  return chart.map((point) => ({
    t: point.t,
    p: toNumericString(d(point.p).mul(factor)),
  }));
}

export function displayFromSnapshot(snapshot: LedgerSnapshot): DisplayMetrics {
  const costBasis = d(snapshot.remainingCostBasis);
  const quantity = d(snapshot.quantity);
  const totalPnl = d(snapshot.totalPnl);
  const percent = d(snapshot.pnlPercent);
  const mark = d(snapshot.markPrice);
  const wins = snapshot.sevenDayTxWins;
  const total = snapshot.sevenDayTxTotal;
  const winRate =
    total === 0 ? zero() : d(wins).div(total).mul(100);

  return {
    tokenName: snapshot.tokenName,
    ticker: snapshot.ticker,
    mint: snapshot.mint,
    cluster: snapshot.cluster,
    averageEntry: snapshot.averageEntry,
    quantity: snapshot.quantity,
    costBasis: snapshot.remainingCostBasis,
    displayPnlAmount: snapshot.totalPnl,
    displayPnlPercent: snapshot.pnlPercent,
    displayExitOrMarkPrice: snapshot.markPrice,
    displayPositionValue: snapshot.markValue,
    last7dPnlAmount: snapshot.totalPnl,
    last7dPnlPercent: snapshot.pnlPercent,
    totalPnl: snapshot.totalPnl,
    unrealizedProfits:
      snapshot.status === "OPEN" ? snapshot.unrealizedPnl : "0",
    sevenDayTotalCost: snapshot.remainingCostBasis,
    sevenDayTokenAvgCost: snapshot.averageEntry,
    sevenDayTokenAvgRealizedProfits: snapshot.realizedPnl,
    sevenDayTxWins: wins,
    sevenDayTxTotal: total,
    winRatePercent: toNumericString(winRate, 8),
    solBalance: snapshot.solBalance,
    solBalanceUsd: snapshot.solBalanceUsd,
    holdingMs: holdingMs(snapshot),
    openedAt: snapshot.openedAt,
    closedAt: snapshot.closedAt,
    quoteProvider: snapshot.quoteProvider,
    quoteTimestamp: snapshot.quoteTimestamp,
    quoteStatus: snapshot.quoteStatus,
    positionStatus: snapshot.status,
    chart: snapshot.chart,
  };
}

export function applyProfitAdjuster(
  input: ProfitAdjusterInput,
): DisplayMetrics {
  const base = displayFromSnapshot(input.snapshot);
  if (input.mode === null || input.value === null || input.value === "") {
    return base;
  }

  const costBasis = d(input.snapshot.remainingCostBasis);
  const quantity = d(input.snapshot.quantity);
  if (costBasis.lte(0) || quantity.lte(0)) {
    return base;
  }

  let pnlAmount: Decimal;
  let pnlPct: Decimal;
  if (input.mode === "percent") {
    pnlPct = d(input.value);
    pnlAmount = costBasis.mul(pnlPct).div(100);
  } else {
    pnlAmount = d(input.value);
    pnlPct = pnlPercent(pnlAmount, costBasis);
  }

  const exitPrice = costBasis.plus(pnlAmount).div(quantity);
  const positionValue = quantity.mul(exitPrice);
  const win = pnlAmount.gte(0);
  const txTotal = Math.max(1, input.snapshot.sevenDayTxTotal);
  const txWins = win ? txTotal : 0;
  const winRate = win ? d(100) : zero();
  const realized = input.snapshot.status === "CLOSED" ? pnlAmount : zero();
  const unrealized = input.snapshot.status === "OPEN" ? pnlAmount : zero();

  return {
    ...base,
    displayPnlAmount: toNumericString(pnlAmount),
    displayPnlPercent: toNumericString(pnlPct),
    displayExitOrMarkPrice: toNumericString(exitPrice),
    displayPositionValue: toNumericString(positionValue),
    last7dPnlAmount: toNumericString(pnlAmount),
    last7dPnlPercent: toNumericString(pnlPct),
    totalPnl: toNumericString(pnlAmount),
    unrealizedProfits: toNumericString(unrealized),
    sevenDayTotalCost: toNumericString(costBasis),
    sevenDayTokenAvgCost: input.snapshot.averageEntry,
    sevenDayTokenAvgRealizedProfits: toNumericString(realized),
    sevenDayTxWins: txWins,
    sevenDayTxTotal: txTotal,
    winRatePercent: toNumericString(winRate, 8),
    chart: scaleChart(input.snapshot.chart, exitPrice),
  };
}

export function assertDisplayConsistent(metrics: DisplayMetrics): void {
  const cost = d(metrics.costBasis);
  const qty = d(metrics.quantity);
  const amount = d(metrics.displayPnlAmount);
  const percent = d(metrics.displayPnlPercent);
  const exit = d(metrics.displayExitOrMarkPrice);
  const value = d(metrics.displayPositionValue);
  if (cost.lte(0) || qty.lte(0)) return;

  const expectedPercent = pnlPercent(amount, cost);
  const expectedExit = cost.plus(amount).div(qty);
  const expectedValue = qty.mul(exit);

  const pctDrift = expectedPercent.minus(percent).abs();
  const exitDrift = expectedExit.minus(exit).abs().div(expectedExit);
  const valueDrift = expectedValue.minus(value).abs().div(expectedValue);

  if (pctDrift.gt("0.0001")) {
    throw new Error("display PnL percent does not match amount");
  }
  if (exitDrift.gt("0.000001")) {
    throw new Error("display exit price does not match profit math");
  }
  if (valueDrift.gt("0.000001")) {
    throw new Error("display position value does not match profit math");
  }
}
