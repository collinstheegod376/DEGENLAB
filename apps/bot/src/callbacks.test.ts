import { describe, expect, it } from "vitest";
import { pack, parseCallback } from "./callbacks.js";

describe("callback packing", () => {
  it("stays under 64 bytes and round-trips", () => {
    const data = pack("card", "edit", "abcdefghij");
    expect(data.length).toBeLessThanOrEqual(64);
    expect(parseCallback(data)).toEqual({
      kind: "card",
      action: "edit",
      id: "abcdefghij",
    });
  });

  it("parses menu, order, and position payloads", () => {
    expect(parseCallback(pack("menu", "portfolio"))).toEqual({
      kind: "menu",
      page: "portfolio",
    });
    expect(parseCallback(pack("order", "buy", "tok1"))).toEqual({
      kind: "order",
      side: "buy",
      id: "tok1",
    });
    expect(parseCallback(pack("pos", "abc123xyz0"))).toEqual({
      kind: "pos",
      id: "abc123xyz0",
    });
  });

  it("rejects unknown prefixes", () => {
    expect(parseCallback("junk")).toBeNull();
  });
});
