import { describe, expect, it } from "vitest";
import type { LedgerSnapshot } from "@degenlab/shared-types";
import { applyProfitAdjuster, assertDisplayConsistent } from "@degenlab/pnl";

const snapshot: LedgerSnapshot = {
  positionId: "p",
  mint: "So11111111111111111111111111111111111111112",
  cluster: "mainnet",
  tokenName: "Wrapped SOL",
  ticker: "SOL",
  status: "CLOSED",
  quantity: "2",
  remainingCostBasis: "200",
  averageEntry: "100",
  realizedPnl: "50",
  unrealizedPnl: "0",
  totalPnl: "50",
  pnlPercent: "25",
  markPrice: "125",
  markValue: "250",
  modeledFees: "1",
  openedAt: "2026-01-01T00:00:00.000Z",
  closedAt: "2026-01-01T06:00:00.000Z",
  quoteProvider: "dexscreener",
  quoteTimestamp: "2026-01-01T06:00:00.000Z",
  quoteStatus: "fresh",
  solBalance: "9800",
  solBalanceUsd: "9800",
  sevenDayTxWins: 1,
  sevenDayTxTotal: 1,
  chart: [
    { t: 1, p: "100" },
    { t: 2, p: "125" },
  ],
};

describe("verified edited cards", () => {
  it("keeps profit-adjusted cards internally consistent for rendering", () => {
    const metrics = applyProfitAdjuster({
      snapshot,
      mode: "percent",
      value: "2754.13",
    });
    assertDisplayConsistent(metrics);
    expect(metrics.tokenName).toBe("Wrapped SOL");
    expect(metrics.quoteProvider).toBe("dexscreener");
  });
});
