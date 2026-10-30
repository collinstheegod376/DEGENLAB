import { describe, expect, it } from "vitest";
import { classifyFreshness, quoteAgeSeconds } from "./freshness.js";

describe("quote freshness", () => {
  it("marks a just-fetched quote as fresh", () => {
    const now = new Date().toISOString();
    expect(
      classifyFreshness(
        { price: "1.23", sourceTimestamp: now, fetchedAt: now },
        30,
      ),
    ).toBe("fresh");
    expect(
      quoteAgeSeconds({ sourceTimestamp: now, fetchedAt: now }),
    ).toBeLessThan(2);
  });

  it("marks an old quote as stale and a zero price as missing", () => {
    const old = new Date(Date.now() - 120_000).toISOString();
    expect(
      classifyFreshness(
        { price: "1.23", sourceTimestamp: old, fetchedAt: old },
        30,
      ),
    ).toBe("stale");
    expect(
      classifyFreshness(
        { price: "0", sourceTimestamp: new Date().toISOString(), fetchedAt: new Date().toISOString() },
        30,
      ),
    ).toBe("missing");
  });
});
