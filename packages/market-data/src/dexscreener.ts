import type {
  Candle,
  Cluster,
  MarketQuote,
  TokenMetadata,
} from "@degenlab/shared-types";
import {
  fetchJson,
  isoNow,
  MarketDataError,
  type JsonClient,
  type MarketDataProvider,
} from "./provider.js";

type DexPair = {
  chainId?: string;
  url?: string;
  pairAddress?: string;
  baseToken?: { address?: string; name?: string; symbol?: string };
  quoteToken?: { address?: string; name?: string; symbol?: string };
  priceUsd?: string;
  liquidity?: { usd?: number };
  volume?: { h24?: number };
  priceChange?: { h24?: number };
  pairCreatedAt?: number;
  info?: { imageUrl?: string };
};

type DexResponse = {
  schemaVersion?: string;
  pairs?: DexPair[] | null;
};

const DEXSCREENER_TOKEN = "https://api.dexscreener.com/latest/dex/tokens/";
const DEXSCREENER_BARS =
  "https://api.dexscreener.com/latest/dex/bars/solana/";

function assertMainnet(cluster: Cluster): void {
  if (cluster !== "mainnet") {
    throw new MarketDataError(
      "This lookup is Mainnet-only. Devnet addresses belong in the Devnet wallet lab.",
      "unsupported_cluster",
    );
  }
}

function pickSolanaPair(mint: string, pairs: DexPair[] | null | undefined): DexPair {
  const sol = (pairs ?? []).filter((pair) => pair.chainId === "solana");
  const matching = sol.filter((pair) => {
    const base = pair.baseToken?.address?.toLowerCase();
    const quote = pair.quoteToken?.address?.toLowerCase();
    const target = mint.toLowerCase();
    return base === target || quote === target;
  });
  const ranked = (matching.length > 0 ? matching : sol).slice().sort((a, b) => {
    return (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0);
  });
  const best = ranked[0];
  if (!best) {
    throw new MarketDataError(
      "No Solana market data for that mint.",
      "not_found",
    );
  }
  return best;
}

function tokenSide(mint: string, pair: DexPair): {
  name: string;
  ticker: string;
  imageUrl: string | null;
} {
  const target = mint.toLowerCase();
  const isQuote = pair.quoteToken?.address?.toLowerCase() === target;
  const token = isQuote ? pair.quoteToken : pair.baseToken;
  return {
    name: token?.name || "Unknown token",
    ticker: token?.symbol || "UNKNOWN",
    imageUrl: pair.info?.imageUrl ?? null,
  };
}

export class DexScreenerProvider implements MarketDataProvider {
  readonly name = "dexscreener";

  constructor(private readonly http: JsonClient = fetchJson) {}

  async getTokenMetadata(mint: string, cluster: Cluster): Promise<TokenMetadata> {
    assertMainnet(cluster);
    const fetchedAt = isoNow();
    const payload = await this.http<DexResponse>(`${DEXSCREENER_TOKEN}${mint}`);
    const pair = pickSolanaPair(mint, payload.pairs);
    const token = tokenSide(mint, pair);
    return {
      mint,
      cluster,
      name: token.name,
      ticker: token.ticker,
      decimals: 0,
      imageUrl: token.imageUrl,
      provider: this.name,
      sourceTimestamp: pair.pairCreatedAt
        ? new Date(pair.pairCreatedAt).toISOString()
        : fetchedAt,
      fetchedAt,
      status: token.ticker === "UNKNOWN" ? "partial" : "fresh",
    };
  }

  async getQuote(
    mint: string,
    quoteCurrency: string,
    cluster: Cluster,
  ): Promise<MarketQuote> {
    assertMainnet(cluster);
    if (quoteCurrency !== "USD") {
      throw new MarketDataError("Only USD quotes are supported.", "mismatch");
    }
    const fetchedAt = isoNow();
    const payload = await this.http<DexResponse>(`${DEXSCREENER_TOKEN}${mint}`);
    const pair = pickSolanaPair(mint, payload.pairs);
    const base = pair.baseToken?.address;
    const quote = pair.quoteToken?.address;
    if (
      base?.toLowerCase() !== mint.toLowerCase() &&
      quote?.toLowerCase() !== mint.toLowerCase()
    ) {
      throw new MarketDataError(
        "Provider returned a pair for a different mint.",
        "mismatch",
      );
    }
    const price = pair.priceUsd;
    if (!price) {
      throw new MarketDataError("Provider had no USD price.", "not_found");
    }
    return {
      mint,
      cluster,
      price,
      quoteCurrency: "USD",
      provider: this.name,
      sourceTimestamp: fetchedAt,
      fetchedAt,
      status: "fresh",
      liquidity: pair.liquidity?.usd != null ? String(pair.liquidity.usd) : null,
      volume24h: pair.volume?.h24 != null ? String(pair.volume.h24) : null,
      confidence: (pair.liquidity?.usd ?? 0) > 10_000 ? "high" : "medium",
    };
  }

  async getCandles(
    mint: string,
    interval: string,
    _range: string,
    cluster: Cluster,
  ): Promise<Candle[]> {
    assertMainnet(cluster);
    const payload = await this.http<DexResponse>(`${DEXSCREENER_TOKEN}${mint}`);
    const pair = pickSolanaPair(mint, payload.pairs);
    if (!pair.pairAddress) return [];
    const resolution = interval === "1h" ? "60" : interval === "1m" ? "1" : "15";
    try {
      const bars = await this.http<{
        candles?: {
          t?: number;
          o?: number;
          h?: number;
          l?: number;
          c?: number;
          v?: number;
        }[];
      }>(
        `${DEXSCREENER_BARS}${pair.pairAddress}?res=${resolution}&cb=${Date.now()}`,
      );
      return (bars.candles ?? []).map((c) => ({
        openTime: (c.t ?? 0) * 1000,
        open: String(c.o ?? 0),
        high: String(c.h ?? 0),
        low: String(c.l ?? 0),
        close: String(c.c ?? 0),
        volume: c.v != null ? String(c.v) : null,
      }));
    } catch {
      return [];
    }
  }

  async getLiquiditySnapshot(mint: string, cluster: Cluster) {
    const quote = await this.getQuote(mint, "USD", cluster);
    return {
      liquidity: quote.liquidity,
      volume24h: quote.volume24h,
      provider: this.name,
      sourceTimestamp: quote.sourceTimestamp,
      fetchedAt: quote.fetchedAt,
    };
  }
}
