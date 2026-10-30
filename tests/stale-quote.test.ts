import { describe, expect, it } from "vitest";
import { assertFreshQuote, classifyFreshness } from "@degenlab/market-data";
import type { MarketQuote } from "@degenlab/shared-types";

function quote(ageMs: number, price = "1.25"): MarketQuote {
  const ts = new Date(Date.now() - ageMs).toISOString();
  return {
    mint: "So11111111111111111111111111111111111111112",
    cluster: "mainnet",
    price,
    quoteCurrency: "USD",
    provider: "dexscreener",
    sourceTimestamp: ts,
    fetchedAt: ts,
    status: "fresh",
    liquidity: "10000",
    volume24h: "1000",
    confidence: "high",
  };
}

describe("stale quotes fail closed", () => {
  it("refuses a practice order when the quote is older than the window", () => {
    const q = quote(45_000);
    expect(classifyFreshness(q, 30)).toBe("stale");
    expect(() => assertFreshQuote(q, 30)).toThrow(/younger than 30s/);
  });

  it("allows a quote inside the freshness window", () => {
    const q = quote(5_000);
    expect(classifyFreshness(q, 30)).toBe("fresh");
    expect(() => assertFreshQuote(q, 30)).not.toThrow();
  });
});
