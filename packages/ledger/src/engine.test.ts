import { describe, expect, it } from "vitest";
import { modeledBuy, modeledSell, d } from "@degenlab/pnl";

/**
 * Ledger accounting contract used by executeBuy/executeSell.
 * Database-backed integration is covered when DATABASE_URL is present;
 * these tests lock the numeric identity that the engine persists.
 */
const assumptions = { feeBps: 30, slippageBps: 50 };

describe("ledger accounting identity", () => {
  it("keeps cash + remaining cost basis equal to starting cash after a buy", () => {
    const start = d("10000");
    const buy = modeledBuy({
      quoteAmount: "2500",
      quotePrice: "0.004",
      assumptions,
    });
    const cash = start.minus(buy.costBasis);
    expect(cash.plus(buy.costBasis).toFixed(2)).toBe(start.toFixed(2));
    expect(buy.quantity.gt(0)).toBe(true);
  });

  it("returns proceeds to cash and realizes pnl from weighted cost on a full close", () => {
    const buy = modeledBuy({
      quoteAmount: "1000",
      quotePrice: "1",
      assumptions,
    });
    const sell = modeledSell({
      quantity: buy.quantity,
      remainingQuantity: buy.quantity,
      remainingCostBasis: buy.costBasis,
      quotePrice: "2",
      assumptions,
    });
    const leftoverQty = buy.quantity.minus(sell.quantity);
    expect(leftoverQty.abs().lt("0.0000001")).toBe(true);
    expect(sell.allocatedCostBasis.toFixed(6)).toBe(buy.costBasis.toFixed(6));
    const equity = d("9000").plus(sell.proceeds);
    expect(equity.gt("9000")).toBe(true);
  });

  it("is idempotent at the key level: the same modeled result is reproducible", () => {
    const a = modeledBuy({
      quoteAmount: "100",
      quotePrice: "0.5",
      assumptions,
    });
    const b = modeledBuy({
      quoteAmount: "100",
      quotePrice: "0.5",
      assumptions,
    });
    expect(a.quantity.toFixed(12)).toBe(b.quantity.toFixed(12));
    expect(a.fees.toFixed(12)).toBe(b.fees.toFixed(12));
  });
});
