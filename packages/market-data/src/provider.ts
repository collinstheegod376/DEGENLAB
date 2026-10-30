import https from "node:https";
import http from "node:http";
import { URL } from "node:url";
import type {
  Candle,
  Cluster,
  MarketQuote,
  TokenMetadata,
} from "@degenlab/shared-types";

export type MarketDataProvider = {
  readonly name: string;
  getTokenMetadata(mint: string, cluster: Cluster): Promise<TokenMetadata>;
  getQuote(
    mint: string,
    quoteCurrency: string,
    cluster: Cluster,
  ): Promise<MarketQuote>;
  getCandles(
    mint: string,
    interval: string,
    range: string,
    cluster: Cluster,
  ): Promise<Candle[]>;
  getLiquiditySnapshot(
    mint: string,
    cluster: Cluster,
  ): Promise<{
    liquidity: string | null;
    volume24h: string | null;
    provider: string;
    sourceTimestamp: string;
    fetchedAt: string;
  }>;
};

export class MarketDataError extends Error {
  constructor(
    message: string,
    readonly code:
      | "not_found"
      | "stale"
      | "network"
      | "mismatch"
      | "unsupported_cluster"
      | "timeout",
  ) {
    super(message);
    this.name = "MarketDataError";
  }
}

export function isoNow(): string {
  return new Date().toISOString();
}

export type JsonClient = <T>(
  url: string,
  init?: RequestInit & { timeoutMs?: number },
) => Promise<T>;

const httpsAgent = new https.Agent({ family: 4, keepAlive: true });
const httpAgent = new http.Agent({ family: 4, keepAlive: true });

export async function fetchJson<T>(
  url: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<T> {
  const timeoutMs = init.timeoutMs ?? 8_000;
  return requestJson<T>(url, timeoutMs, headerRecord(init.headers), 0);
}

function headerRecord(headers: HeadersInit | undefined): Record<string, string> {
  if (!headers) return {};
  if (headers instanceof Headers) return Object.fromEntries(headers.entries());
  if (Array.isArray(headers)) return Object.fromEntries(headers);
  return { ...headers };
}

function requestJson<T>(
  url: string,
  timeoutMs: number,
  headers: Record<string, string>,
  redirects: number,
): Promise<T> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (error: Error | null, value?: T) => {
      if (settled) return;
      settled = true;
      if (error) reject(error);
      else resolve(value as T);
    };

    const parsed = new URL(url);
    const lib = parsed.protocol === "http:" ? http : https;
    const agent = parsed.protocol === "http:" ? httpAgent : httpsAgent;
    const req = lib.request(
      {
        protocol: parsed.protocol,
        hostname: parsed.hostname,
        port: parsed.port || undefined,
        path: `${parsed.pathname}${parsed.search}`,
        method: "GET",
        family: 4,
        agent,
        headers: {
          accept: "application/json",
          "user-agent": "DegenLab/1.0",
          ...headers,
        },
      },
      (res) => {
        const location = res.headers.location;
        if (
          res.statusCode &&
          res.statusCode >= 300 &&
          res.statusCode < 400 &&
          location &&
          redirects < 3
        ) {
          res.resume();
          requestJson<T>(new URL(location, parsed).toString(), timeoutMs, headers, redirects + 1)
            .then((value) => finish(null, value))
            .catch((error) => finish(error instanceof Error ? error : new Error(String(error))));
          return;
        }

        const chunks: Buffer[] = [];
        res.on("data", (chunk) => chunks.push(chunk as Buffer));
        res.on("end", () => {
          const body = Buffer.concat(chunks).toString("utf8");
          if (!res.statusCode || res.statusCode >= 400) {
            finish(
              new MarketDataError(
                `Provider HTTP ${res.statusCode ?? 0}`,
                res.statusCode === 404 ? "not_found" : "network",
              ),
            );
            return;
          }
          try {
            finish(null, JSON.parse(body) as T);
          } catch {
            finish(new MarketDataError("Provider returned invalid JSON", "network"));
          }
        });
      },
    );

    req.setTimeout(timeoutMs, () => {
      req.destroy();
      finish(new MarketDataError("Provider timed out", "timeout"));
    });
    req.on("error", () => {
      finish(new MarketDataError("Provider request failed", "network"));
    });
    req.end();
  });
}
