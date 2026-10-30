import { describe, expect, it } from "vitest";
import { CompositeMarketDataProvider } from "./composite.js";
import { MarketDataError, type JsonClient } from "./provider.js";

const MINT = "45EkcVHmEZ71WbNV2TWhCmTAhm2B3phMY8rycYBTpump";
const SOL = "So11111111111111111111111111111111111111112";

function mockHttp(routes: Record<string, unknown | Error>): JsonClient {
  return async (url) => {
    const hit = Object.entries(routes).find(([key]) => url.includes(key));
    if (!hit) throw new MarketDataError(`unexpected url ${url}`, "network");
    const value = hit[1];
    if (value instanceof Error) throw value;
    return value as never;
  };
}

describe("composite market data", () => {
  it("returns unknown metadata and throws a clear quote error when every vendor is empty", async () => {
    const market = new CompositeMarketDataProvider(
      30,
      mockHttp({
        "dexscreener.com/latest/dex/tokens/": { schemaVersion: "1.0.0", pairs: null },
        "lite-api.jup.ag/price/v2": new MarketDataError("Provider HTTP 404", "not_found"),
        "lite-api.jup.ag/price/v3": {},
        "lite-api.jup.ag/tokens/v2/search": [],
      }),
    );

    const meta = await market.getTokenMetadata(MINT, "mainnet");
    expect(meta.name).toBe("Unknown token");
    expect(meta.status).toBe("missing");

    await expect(market.getQuote(MINT, "USD", "mainnet")).rejects.toMatchObject({
      code: "not_found",
      message: "No USD quote from DexScreener or Jupiter.",
    });
  });

  it("uses Jupiter when DexScreener has no pair", async () => {
    const market = new CompositeMarketDataProvider(
      30,
      mockHttp({
        "dexscreener.com/latest/dex/tokens/": { schemaVersion: "1.0.0", pairs: null },
        "lite-api.jup.ag/price/v2": new MarketDataError("Provider HTTP 404", "not_found"),
        "lite-api.jup.ag/price/v3": { [SOL]: { usdPrice: 148.2 } },
        "lite-api.jup.ag/tokens/v2/search": [
          { id: SOL, name: "Wrapped SOL", symbol: "SOL", decimals: 9 },
        ],
      }),
    );

    const meta = await market.getTokenMetadata(SOL, "mainnet");
    expect(meta.ticker).toBe("SOL");
    const quote = await market.getQuote(SOL, "USD", "mainnet");
    expect(quote.provider).toBe("jup.ag");
    expect(quote.price).toBe("148.2");
  });
});
