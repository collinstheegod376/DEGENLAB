import { describe, expect, it } from "vitest";
import type { LedgerSnapshot } from "@degenlab/shared-types";
import {
  applyProfitAdjuster,
  assertDisplayConsistent,
  displayFromSnapshot,
} from "./adjuster.js";
import { d } from "./decimal.js";

const snapshot: LedgerSnapshot = {
  positionId: "pos-1",
  mint: "So11111111111111111111111111111111111111112",
  cluster: "mainnet",
  tokenName: "Wrapped SOL",
  ticker: "SOL",
  status: "CLOSED",
  quantity: "10",
  remainingCostBasis: "1000",
  averageEntry: "100",
  realizedPnl: "200",
  unrealizedPnl: "0",
  totalPnl: "200",
  pnlPercent: "20",
  markPrice: "120",
  markValue: "1200",
  modeledFees: "3",
  openedAt: "2026-01-01T00:00:00.000Z",
  closedAt: "2026-01-02T00:00:00.000Z",
  quoteProvider: "dexscreener",
  quoteTimestamp: "2026-01-02T00:00:00.000Z",
  quoteStatus: "fresh",
  solBalance: "0",
  solBalanceUsd: "0",
  sevenDayTxWins: 1,
  sevenDayTxTotal: 1,
  chart: [
    { t: 1, p: "100" },
    { t: 2, p: "120" },
  ],
};

describe("profit adjuster", () => {
  it("defaults display metrics to the ledger snapshot", () => {
    const display = displayFromSnapshot(snapshot);
    expect(display.displayPnlAmount).toBe("200");
    expect(display.displayPnlPercent).toBe("20");
  });

  it("recomputes amount, exit, and 7D stats from a target percent", () => {
    const display = applyProfitAdjuster({
      snapshot,
      mode: "percent",
      value: "2754.13",
    });
    assertDisplayConsistent(display);
    expect(d(display.displayPnlAmount).toFixed(2)).toBe("27541.30");
    expect(d(display.displayExitOrMarkPrice).toFixed(2)).toBe("2854.13");
    expect(display.last7dPnlPercent).toBe(display.displayPnlPercent);
    expect(d(display.sevenDayTotalCost).toFixed(2)).toBe("1000.00");
    expect(d(display.sevenDayTokenAvgCost).toFixed(2)).toBe("100.00");
    expect(display.sevenDayTxWins).toBe(1);
    expect(display.winRatePercent.startsWith("100")).toBe(true);
    expect(display.quoteProvider).toBe("dexscreener");
    expect(display.mint).toBe(snapshot.mint);
  });

  it("recomputes percent from a target amount and keeps amount/percent linked", () => {
    const display = applyProfitAdjuster({
      snapshot,
      mode: "amount",
      value: "500",
    });
    assertDisplayConsistent(display);
    expect(d(display.displayPnlPercent).toFixed(2)).toBe("50.00");
    expect(d(display.displayPnlAmount).toFixed(2)).toBe("500.00");
  });

  it("keeps a losing override internally consistent and verified", () => {
    const display = applyProfitAdjuster({
      snapshot,
      mode: "percent",
      value: "-40",
    });
    assertDisplayConsistent(display);
    expect(display.sevenDayTxWins).toBe(0);
    expect(d(display.displayExitOrMarkPrice).toFixed(2)).toBe("60.00");
  });

  it("restores snapshot values when the adjuster is cleared", () => {
    const display = applyProfitAdjuster({
      snapshot,
      mode: null,
      value: null,
    });
    expect(display.displayPnlAmount).toBe(snapshot.totalPnl);
  });
});
