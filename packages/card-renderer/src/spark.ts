import type { ChartPoint, ChartStyle } from "@degenlab/shared-types";
import { d } from "@degenlab/pnl";
import { h } from "./el.js";

export function sparkline(
  points: ChartPoint[],
  width: number,
  height: number,
  color: string,
  style: ChartStyle,
): ReturnType<typeof h> {
  const series = points.length > 1 ? points : [
    { t: 0, p: "0" },
    { t: 1, p: "0" },
  ];
  const values = series.map((p) => Number(d(p.p).toString()));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const coords = values.map((v, i) => {
    const x = (i / Math.max(1, values.length - 1)) * width;
    const y = height - ((v - min) / span) * height;
    return { x, y };
  });
  const path = coords
    .map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(1)} ${c.y.toFixed(1)}`)
    .join(" ");
  const area = `${path} L${width} ${height} L0 ${height} Z`;
  const last = coords[coords.length - 1];

  return h(
    "svg",
    { width, height, viewBox: `0 0 ${width} ${height}` },
    style === "area"
      ? h("path", { d: area, fill: color, fillOpacity: 0.18 })
      : null,
    h("path", {
      d: path,
      stroke: color,
      strokeWidth: 3,
      fill: "none",
    }),
    last
      ? h("circle", {
          cx: last.x,
          cy: last.y,
          r: 5,
          fill: color,
        })
      : null,
  );
}
