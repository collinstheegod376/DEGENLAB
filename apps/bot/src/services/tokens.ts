import { and, eq } from "drizzle-orm";
import { priceSnapshots, watchedTokens, type Database } from "@degenlab/database";
import type { MarketQuote, TokenMetadata } from "@degenlab/shared-types";

export async function upsertWatchedToken(
  db: Database,
  meta: TokenMetadata,
  decimals: number,
) {
  const [existing] = await db
    .select()
    .from(watchedTokens)
    .where(
      and(
        eq(watchedTokens.cluster, meta.cluster),
        eq(watchedTokens.mintAddress, meta.mint),
      ),
    )
    .limit(1);
  if (existing) {
    const [updated] = await db
      .update(watchedTokens)
      .set({
        tokenName: meta.name,
        ticker: meta.ticker,
        decimals: decimals || existing.decimals,
        metadataJson: { imageUrl: meta.imageUrl, provider: meta.provider },
        lastVerifiedAt: new Date(),
      })
      .where(eq(watchedTokens.id, existing.id))
      .returning();
    return updated!;
  }
  const [created] = await db
    .insert(watchedTokens)
    .values({
      cluster: meta.cluster,
      mintAddress: meta.mint,
      tokenName: meta.name,
      ticker: meta.ticker,
      decimals,
      metadataJson: { imageUrl: meta.imageUrl, provider: meta.provider },
      lastVerifiedAt: new Date(),
    })
    .returning();
  return created!;
}

export async function persistQuote(db: Database, quote: MarketQuote) {
  const [row] = await db
    .insert(priceSnapshots)
    .values({
      cluster: quote.cluster,
      mintAddress: quote.mint,
      price: quote.price,
      quoteCurrency: quote.quoteCurrency,
      provider: quote.provider,
      sourceTimestamp: new Date(quote.sourceTimestamp),
      fetchedAt: new Date(quote.fetchedAt),
      liquidity: quote.liquidity,
      metadataJson: {
        volume24h: quote.volume24h,
        confidence: quote.confidence,
        status: quote.status,
      },
    })
    .returning();
  return row!;
}

export async function getWatched(
  db: Database,
  mint: string,
  cluster: string,
) {
  const [row] = await db
    .select()
    .from(watchedTokens)
    .where(
      and(eq(watchedTokens.mintAddress, mint), eq(watchedTokens.cluster, cluster)),
    )
    .limit(1);
  return row ?? null;
}
