import Decimal from "decimal.js";

Decimal.set({
  precision: 40,
  rounding: Decimal.ROUND_HALF_UP,
  toExpNeg: -18,
  toExpPos: 40,
});

export { Decimal };

export function d(value: Decimal.Value): Decimal {
  if (value instanceof Decimal) return value;
  if (typeof value === "string" && value.trim() === "") {
    throw new Error("empty decimal");
  }
  return new Decimal(value);
}

export function zero(): Decimal {
  return new Decimal(0);
}

export function toNumericString(value: Decimal, maxDp = 18): string {
  if (!value.isFinite()) {
    throw new Error("non-finite decimal");
  }
  return value.toFixed(maxDp);
}

export function bpsToRate(bps: number): Decimal {
  return d(bps).div(10_000);
}
