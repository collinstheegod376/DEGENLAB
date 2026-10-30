import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
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
    { t: 2, p: "800" },
    { t: 3, p: "2854.13" },
  ],
};

const png = await renderPnlCard({
  metrics,
  theme: defaultTheme("DEGEN"),
  verifyUrl: "https://degenlab.example/c/demo",
  displayName: "DEGEN",
});

const out = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../assets/preview-card.png");
await writeFile(out, png);
console.log("wrote", out, png.length);
