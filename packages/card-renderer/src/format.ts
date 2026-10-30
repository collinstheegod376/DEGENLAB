import { d, formatPercent, formatPrice, formatQty, formatUsd } from "@degenlab/pnl";

export function signedUsd(value: string): string {
  const n = d(value);
  if (n.gt(0)) return `+${formatUsd(n)}`;
  return formatUsd(n);
}

export function signedPct(value: string): string {
  return formatPercent(value);
}

export function holdingLabel(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d_ = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d_ > 0) return `${d_}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${s}s`;
}

export { formatPrice, formatQty, formatUsd };
