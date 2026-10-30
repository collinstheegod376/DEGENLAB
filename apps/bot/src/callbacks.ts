import { CALLBACK_PREFIX } from "@degenlab/shared-types";

export type Callback =
  | { kind: "menu"; page: string }
  | { kind: "order"; side: "buy" | "sell"; id?: string }
  | { kind: "buyamt"; id: string; pct: string }
  | { kind: "sellpct"; id: string; pct: string }
  | { kind: "confirm"; action: string; id: string }
  | { kind: "pos"; id: string }
  | { kind: "card"; action: string; id: string }
  | { kind: "theme"; id: string; theme: string }
  | { kind: "layout"; id: string; layout: string }
  | { kind: "chart"; id: string; style: string }
  | { kind: "lb"; action: string }
  | { kind: "reset"; action: string }
  | { kind: "noop" };

export function pack(...parts: string[]): string {
  const data = `${CALLBACK_PREFIX}${parts.join(":")}`;
  if (data.length > 64) {
    throw new Error(`callback_data too long (${data.length}): ${data}`);
  }
  return data;
}

export function parseCallback(data: string): Callback | null {
  if (!data.startsWith(CALLBACK_PREFIX)) return null;
  const parts = data.slice(CALLBACK_PREFIX.length).split(":");
  const [a, b, c, d] = parts;
  if (!a) return null;
  if (a === "menu" && b) return { kind: "menu", page: b };
  if (a === "order" && (b === "buy" || b === "sell")) {
    return { kind: "order", side: b, id: c };
  }
  if (a === "buyamt" && b && c) return { kind: "buyamt", id: b, pct: c };
  if (a === "sellpct" && b && c) return { kind: "sellpct", id: b, pct: c };
  if (a === "confirm" && b && c) return { kind: "confirm", action: b, id: c };
  if (a === "pos" && b) return { kind: "pos", id: b };
  if (a === "card" && b && c) return { kind: "card", action: b, id: c };
  if (a === "theme" && b && c) return { kind: "theme", id: b, theme: c };
  if (a === "layout" && b && c) return { kind: "layout", id: b, layout: c };
  if (a === "chart" && b && c) return { kind: "chart", id: b, style: c };
  if (a === "lb" && b) return { kind: "lb", action: b };
  if (a === "reset" && b) return { kind: "reset", action: b };
  if (a === "noop") return { kind: "noop" };
  void d;
  return null;
}
