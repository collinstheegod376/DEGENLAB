import { describe, expect, it } from "vitest";
import {
  modeledBuy,
  modeledSell,
  pnlPercent,
  unrealizedPnl,
  weightedAverageEntry,
} from "./calc.js";
import { d } from "./decimal.js";

const assumptions = { feeBps: 30, slippageBps: 50 };

describe("modeledBuy", () => {
  it("applies fee and slippage then derives quantity from remaining spend", () => {
    const buy = modeledBuy({
      quoteAmount: "1000",
      quotePrice: "2",
      assumptions,
    });
    expect(buy.fees.toFixed(2)).toBe("3.00");
    expect(buy.executionPrice.toFixed(4)).toBe("2.0100");
    expect(buy.quantity.toFixed(8)).toBe("496.01990050");
    expect(buy.costBasis.toFixed(2)).toBe("1000.00");
  });

  it("rejects non-positive amounts", () => {
    expect(() =>
      modeledBuy({ quoteAmount: "0", quotePrice: "1", assumptions }),
    ).toThrow(/positive/);
  });
});

describe("modeledSell weighted-average cost", () => {
  it("allocates cost basis proportionally on a partial close", () => {
    const sell = modeledSell({
      quantity: "50",
      remainingQuantity: "100",
      remainingCostBasis: "1000",
      quotePrice: "3",
      assumptions,
    });
    expect(sell.allocatedCostBasis.toFixed(2)).toBe("500.00");
    expect(sell.executionPrice.toFixed(4)).toBe("2.9850");
    expect(sell.grossValue.toFixed(2)).toBe("149.25");
    expect(sell.sellFees.toFixed(4)).toBe("0.4478");
    expect(sell.proceeds.toFixed(4)).toBe("148.8023");
    expect(sell.realizedPnl.toFixed(4)).toBe("-351.1978");
  });

  it("rejects selling more than remaining quantity", () => {
    expect(() =>
      modeledSell({
        quantity: "2",
        remainingQuantity: "1",
        remainingCostBasis: "10",
        quotePrice: "1",
        assumptions,
      }),
    ).toThrow(/exceeds/);
  });
});

describe("mark and percent", () => {
  it("computes average entry from remaining cost basis", () => {
    expect(weightedAverageEntry("250", "100").toFixed(2)).toBe("2.50");
  });

  it("computes unrealized pnl net of modeled close fees", () => {
    const u = unrealizedPnl({
      quantity: "100",
      remainingCostBasis: "200",
      markPrice: "3",
      assumptions,
    });
    expect(u.gt(d("90"))).toBe(true);
    expect(u.lt(d("100"))).toBe(true);
  });

  it("returns zero percent when cost basis is zero", () => {
    expect(pnlPercent("10", "0").toFixed(2)).toBe("0.00");
  });
});
