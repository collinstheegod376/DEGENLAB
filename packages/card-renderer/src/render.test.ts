import { describe, expect, it } from "vitest";
import type { DisplayMetrics } from "@degenlab/shared-types";
import { defaultTheme } from "./defaults.js";
import { renderPnlCard } from "./render.js";

const metrics: DisplayMetrics = {
  tokenName: "Wrapped SOL",
  ticker: "SOL",
  mint: "So11111111111111111111111111111111111111112",
  cluster: "mainnet",
  averageEntry: "100",
  quantity: "10",
  costBasis: "1000",
  displayPnlAmount: "27541.30",
  displayPnlPercent: "2754.13",
  displayExitOrMarkPrice: "2854.13",
  displayPositionValue: "28541.30",
  last7dPnlAmount: "27541.30",
  last7dPnlPercent: "2754.13",
  totalPnl: "27541.30",
  unrealizedProfits: "0",
  sevenDayTotalCost: "1000",
  sevenDayTokenAvgCost: "100",
  sevenDayTokenAvgRealizedProfits: "27541.30",
  sevenDayTxWins: 1,
  sevenDayTxTotal: 1,
  winRatePercent: "100",
  solBalance: "9800",
  solBalanceUsd: "9800",
  holdingMs: 86_400_000,
  openedAt: "2026-01-01T00:00:00.000Z",
  closedAt: "2026-01-02T00:00:00.000Z",
  quoteProvider: "dexscreener",
  quoteTimestamp: "2026-01-02T00:00:00.000Z",
  quoteStatus: "fresh",
  positionStatus: "CLOSED",
  chart: [
    { t: 1, p: "100" },
    { t: 2, p: "400" },
    { t: 3, p: "2854.13" },
  ],
};

describe("PnL card renderer", () => {
  it("renders a verified portrait PNG", async () => {
    const png = await renderPnlCard({
      metrics,
      theme: defaultTheme("DEGEN"),
      verifyUrl: "https://example.com/c/test",
      displayName: "DEGEN",
    });
    expect(png.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
    expect(png.length).toBeGreaterThan(20_000);
  });
});
