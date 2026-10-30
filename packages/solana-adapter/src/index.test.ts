import { describe, expect, it } from "vitest";
import {
  decodeMetaplexNameSymbol,
  extractMintCandidate,
  looksLikeMint,
  validateMintAddress,
} from "./index.js";

const WRAPPED_SOL = "So11111111111111111111111111111111111111112";
const PUMP = "45EkcVHmEZ71WbNV2TWhCmTAhm2B3phMY8rycYBTpump";

function borshString(value: string): Buffer {
  const body = Buffer.from(value);
  const len = Buffer.alloc(4);
  len.writeUInt32LE(body.length);
  return Buffer.concat([len, body]);
}

describe("validateMintAddress", () => {
  it("accepts a well-known Mainnet mint", () => {
    const result = validateMintAddress(WRAPPED_SOL);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.mint).toBe(WRAPPED_SOL);
  });

  it("accepts a pump.fun-style mint", () => {
    expect(validateMintAddress(PUMP).ok).toBe(true);
  });

  it("rejects empty, oversized, and non-base58 input", () => {
    expect(validateMintAddress("").ok).toBe(false);
    expect(validateMintAddress("not a mint").ok).toBe(false);
    expect(validateMintAddress("0".repeat(64)).ok).toBe(false);
  });

  it("looksLikeMint is true only for valid public keys", () => {
    expect(looksLikeMint(WRAPPED_SOL)).toBe(true);
    expect(looksLikeMint("hello")).toBe(false);
  });

  it("extracts a mint from pump.fun and DexScreener links", () => {
    expect(extractMintCandidate(`https://pump.fun/coin/${PUMP}`)).toBe(PUMP);
    expect(extractMintCandidate(`https://dexscreener.com/solana/${PUMP}`)).toBe(PUMP);
    expect(extractMintCandidate(`ca: ${PUMP}`)).toBe(PUMP);
  });

  it("decodes Metaplex name and symbol", () => {
    const data = Buffer.concat([
      Buffer.from([4]),
      Buffer.alloc(32),
      Buffer.alloc(32),
      borshString("Test Token"),
      borshString("TST"),
      borshString("https://example.com/meta.json"),
    ]);
    expect(decodeMetaplexNameSymbol(data)).toEqual({
      name: "Test Token",
      symbol: "TST",
      uri: "https://example.com/meta.json",
    });
  });
});

