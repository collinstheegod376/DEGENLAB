import type {
  Candle,
  Cluster,
  MarketQuote,
  TokenMetadata,
} from "@degenlab/shared-types";
import { DexScreenerProvider } from "./dexscreener.js";
import { classifyFreshness } from "./freshness.js";
import {
  fetchJson,
  isoNow,
  MarketDataError,
  type JsonClient,
  type MarketDataProvider,
} from "./provider.js";

type JupiterPriceV2 = {
  data?: Record<string, { price?: number | string } | undefined>;
};

type JupiterPriceV3 = Record<
  string,
  { usdPrice?: number | string; price?: number | string } | undefined
>;

type JupiterTokenHit = {
  id?: string;
  name?: string;
  symbol?: string;
  icon?: string;
  decimals?: number;
};

function assertMainnet(cluster: Cluster): void {
  if (cluster !== "mainnet") {
    throw new MarketDataError(
      "This lookup is Mainnet-only. Devnet addresses belong in the Devnet wallet lab.",
      "unsupported_cluster",
    );
  }
}

function unknownMetadata(mint: string, cluster: Cluster): TokenMetadata {
  const fetchedAt = isoNow();
  return {
    mint,
    cluster,
    name: "Unknown token",
    ticker: "UNKNOWN",
    decimals: 0,
    imageUrl: null,
    provider: "none",
    sourceTimestamp: fetchedAt,
    fetchedAt,
    status: "missing",
  };
}

export class JupiterPriceFallback {
  readonly name = "jup.ag";

  constructor(private readonly http: JsonClient = fetchJson) {}

  async getPrice(mint: string): Promise<{ price: string; fetchedAt: string }> {
    try {
      const payload = await this.http<JupiterPriceV2>(
        `https://lite-api.jup.ag/price/v2?ids=${encodeURIComponent(mint)}`,
      );
      const price = payload.data?.[mint]?.price;
      if (price !== undefined && price !== null && price !== "") {
        return { price: String(price), fetchedAt: isoNow() };
      }
    } catch (error) {
      if (!(error instanceof MarketDataError)) throw error;
    }

    const v3 = await this.http<JupiterPriceV3>(
      `https://lite-api.jup.ag/price/v3?ids=${encodeURIComponent(mint)}`,
    );
    const row = v3[mint];
    const price = row?.usdPrice ?? row?.price;
    if (price === undefined || price === null || price === "") {
      throw new MarketDataError("Jupiter had no price for that mint.", "not_found");
    }
    return { price: String(price), fetchedAt: isoNow() };
  }

  async getMetadata(mint: string, cluster: Cluster): Promise<TokenMetadata> {
    const fetchedAt = isoNow();
    const hits = await this.http<JupiterTokenHit[]>(
      `https://lite-api.jup.ag/tokens/v2/search?query=${encodeURIComponent(mint)}`,
    );
    const row = (Array.isArray(hits) ? hits : []).find(
      (item) => item.id?.toLowerCase() === mint.toLowerCase(),
    );
    if (!row?.id) {
      throw new MarketDataError("Jupiter had no token metadata for that mint.", "not_found");
    }
    return {
      mint,
      cluster,
      name: row.name || "Unknown token",
      ticker: row.symbol || "UNKNOWN",
      decimals: typeof row.decimals === "number" ? row.decimals : 0,
      imageUrl: row.icon ?? null,
      provider: this.name,
      sourceTimestamp: fetchedAt,
      fetchedAt,
      status: row.symbol ? "fresh" : "partial",
    };
  }
}

export class CompositeMarketDataProvider implements MarketDataProvider {
  readonly name = "dexscreener+jup";
  private readonly primary: DexScreenerProvider;
  private readonly jupiter: JupiterPriceFallback;
  private readonly maxAgeSeconds: number;

  constructor(maxAgeSeconds = 30, http: JsonClient = fetchJson) {
    this.maxAgeSeconds = maxAgeSeconds;
    this.primary = new DexScreenerProvider(http);
    this.jupiter = new JupiterPriceFallback(http);
  }

  async getTokenMetadata(mint: string, cluster: Cluster): Promise<TokenMetadata> {
    assertMainnet(cluster);
    const [dex, jup] = await Promise.allSettled([
      this.primary.getTokenMetadata(mint, cluster),
      this.jupiter.getMetadata(mint, cluster),
    ]);
    if (dex.status === "fulfilled") return dex.value;
    if (jup.status === "fulfilled") return jup.value;
    return unknownMetadata(mint, cluster);
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
    const [dex, jup] = await Promise.allSettled([
      this.primary.getQuote(mint, quoteCurrency, cluster),
      this.jupiter.getPrice(mint),
    ]);
    if (dex.status === "fulfilled") {
      return {
        ...dex.value,
        status: classifyFreshness(dex.value, this.maxAgeSeconds),
      };
    }
    if (jup.status === "fulfilled") {
      const fetchedAt = jup.value.fetchedAt;
      const quote: MarketQuote = {
        mint,
        cluster,
        price: jup.value.price,
        quoteCurrency,
        provider: this.jupiter.name,
        sourceTimestamp: fetchedAt,
        fetchedAt,
        status: "fresh",
        liquidity: null,
        volume24h: null,
        confidence: "medium",
      };
      quote.status = classifyFreshness(quote, this.maxAgeSeconds);
      return quote;
    }
    throw new MarketDataError(
      "No USD quote from DexScreener or Jupiter.",
      "not_found",
    );
  }

  getCandles(
    mint: string,
    interval: string,
    range: string,
    cluster: Cluster,
  ): Promise<Candle[]> {
    return this.primary.getCandles(mint, interval, range, cluster);
  }

  getLiquiditySnapshot(mint: string, cluster: Cluster) {
    return this.primary.getLiquiditySnapshot(mint, cluster);
  }
}
