import type { MarketQuote, QuoteStatus } from "@degenlab/shared-types";

export function quoteAgeSeconds(quote: Pick<MarketQuote, "sourceTimestamp" | "fetchedAt">): number {
  const source = Date.parse(quote.sourceTimestamp);
  const fetched = Date.parse(quote.fetchedAt);
  const stamp = Number.isFinite(source) ? source : fetched;
  if (!Number.isFinite(stamp)) return Number.POSITIVE_INFINITY;
  return Math.max(0, (Date.now() - stamp) / 1000);
}

export function classifyFreshness(
  quote: Pick<MarketQuote, "sourceTimestamp" | "fetchedAt" | "price">,
  maxAgeSeconds: number,
): QuoteStatus {
  if (!quote.price || quote.price === "0") return "missing";
  return quoteAgeSeconds(quote) <= maxAgeSeconds ? "fresh" : "stale";
}

export function assertFreshQuote(
  quote: MarketQuote,
  maxAgeSeconds: number,
): void {
  const status = classifyFreshness(quote, maxAgeSeconds);
  if (status !== "fresh") {
    throw Object.assign(
      new Error(
        `Quote from ${quote.provider} is ${status}. A practice order needs a quote younger than ${maxAgeSeconds}s.`,
      ),
      { code: "stale_quote" as const },
    );
  }
}
