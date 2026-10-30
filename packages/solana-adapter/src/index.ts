import http from "node:http";
import https from "node:https";
import { Connection, PublicKey } from "@solana/web3.js";
import type { Cluster } from "@degenlab/shared-types";

const BASE58_RE = /^[1-9A-HJ-NP-Za-km-z]+$/;
const BASE58_FIND_RE = /[1-9A-HJ-NP-Za-km-z]{32,48}/g;
const MAX_MINT_LENGTH = 48;
const TOKEN_METADATA_PROGRAM_ID = new PublicKey(
  "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s",
);
const httpsAgent = new https.Agent({ family: 4, keepAlive: true });
const httpAgent = new http.Agent({ family: 4, keepAlive: true });

export type MintValidation =
  | { ok: true; mint: string; publicKey: PublicKey }
  | { ok: false; error: string };

export function validateMintAddress(input: string): MintValidation {
  const mint = input.trim();
  if (!mint) return { ok: false, error: "Paste a Solana token mint address." };
  if (mint.length > MAX_MINT_LENGTH) {
    return { ok: false, error: "That address is too long to be a mint." };
  }
  if (!BASE58_RE.test(mint)) {
    return {
      ok: false,
      error: "Mint addresses are base58. Remove spaces or extra characters.",
    };
  }
  try {
    const publicKey = new PublicKey(mint);
    if (publicKey.toBase58() !== mint) {
      return { ok: false, error: "Mint address checksum did not match." };
    }
    return { ok: true, mint, publicKey };
  } catch {
    return { ok: false, error: "That is not a valid Solana public key." };
  }
}

export function looksLikeMint(input: string): boolean {
  return extractMintCandidate(input) !== null;
}

export function extractMintCandidate(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const direct = validateMintAddress(trimmed);
  if (direct.ok) return direct.mint;

  try {
    const url = new URL(trimmed);
    const parts = [...url.pathname.split("/"), ...url.searchParams.values()];
    for (const part of parts) {
      const parsed = validateMintAddress(part);
      if (parsed.ok) return parsed.mint;
    }
  } catch {
    // Not a URL. Fall through to scanning.
  }

  const matches = trimmed.match(BASE58_FIND_RE) ?? [];
  for (const candidate of matches) {
    const parsed = validateMintAddress(candidate);
    if (parsed.ok) return parsed.mint;
  }
  return null;
}

export type RpcEndpoints = {
  mainnet: string;
  devnet?: string;
};

export type OnchainTokenFacts = {
  exists: boolean;
  isMint: boolean;
  decimals: number;
  name: string | null;
  ticker: string | null;
};

export function decodeMetaplexNameSymbol(data: Buffer): {
  name: string;
  symbol: string;
  uri: string;
} {
  let offset = 1 + 32 + 32;
  const readString = () => {
    if (offset + 4 > data.length) return "";
    const len = data.readUInt32LE(offset);
    offset += 4;
    if (len < 0 || len > 1024 || offset + len > data.length) return "";
    const value = data
      .subarray(offset, offset + len)
      .toString("utf8")
      .replace(/\0/g, "")
      .trim();
    offset += len;
    return value;
  };
  return { name: readString(), symbol: readString(), uri: readString() };
}

export function connectionFor(
  cluster: Cluster,
  endpoints: RpcEndpoints,
): Connection {
  const url = cluster === "devnet" ? endpoints.devnet : endpoints.mainnet;
  if (!url) {
    throw new Error(`No RPC URL configured for ${cluster}`);
  }
  const agent = url.startsWith("http:") ? httpAgent : httpsAgent;
  return new Connection(url, { commitment: "confirmed", httpAgent: agent });
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error("rpc timeout")), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function readOnchainTokenFacts(
  mint: string,
  cluster: Cluster,
  endpoints: RpcEndpoints,
  timeoutMs = 5_000,
): Promise<OnchainTokenFacts> {
  const parsed = validateMintAddress(mint);
  if (!parsed.ok) {
    return { exists: false, isMint: false, decimals: 0, name: null, ticker: null };
  }
  const connection = connectionFor(cluster, endpoints);
  return withTimeout(
    (async () => {
      const info = await connection.getParsedAccountInfo(parsed.publicKey);
      if (!info.value) {
        return { exists: false, isMint: false, decimals: 0, name: null, ticker: null };
      }
      const data = info.value.data;
      let isMint = false;
      let decimals = 0;
      if (data && typeof data !== "string" && !Buffer.isBuffer(data)) {
        const parsedInfo = (
          data as {
            parsed?: { info?: { decimals?: number }; type?: string };
          }
        ).parsed;
        isMint = parsedInfo?.type === "mint";
        if (typeof parsedInfo?.info?.decimals === "number") {
          decimals = parsedInfo.info.decimals;
        }
      }
      let name: string | null = null;
      let ticker: string | null = null;
      try {
        const [pda] = PublicKey.findProgramAddressSync(
          [
            Buffer.from("metadata"),
            TOKEN_METADATA_PROGRAM_ID.toBuffer(),
            parsed.publicKey.toBuffer(),
          ],
          TOKEN_METADATA_PROGRAM_ID,
        );
        const meta = await connection.getAccountInfo(pda);
        if (meta?.data) {
          const decoded = decodeMetaplexNameSymbol(Buffer.from(meta.data));
          name = decoded.name || null;
          ticker = decoded.symbol || null;
        }
      } catch {
        // Metadata is optional.
      }
      return { exists: true, isMint, decimals, name, ticker };
    })(),
    timeoutMs,
  );
}

export async function readMintDecimals(
  mint: string,
  cluster: Cluster,
  endpoints: RpcEndpoints,
): Promise<{ decimals: number; exists: boolean }> {
  const facts = await readOnchainTokenFacts(mint, cluster, endpoints);
  return { decimals: facts.decimals, exists: facts.exists && facts.isMint };
}
