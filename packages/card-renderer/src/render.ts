import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";
import QRCode from "qrcode";
import satori from "satori";
import sharp from "sharp";
import { d } from "@degenlab/pnl";
import type {
  CardLayout,
  CardThemeJson,
  DisplayMetrics,
} from "@degenlab/shared-types";
import { PRACTICE_LABEL, shortenMint } from "@degenlab/shared-types";
import { h } from "./el.js";
import { formatPrice, formatQty, holdingLabel, signedPct, signedUsd } from "./format.js";
import { sparkline } from "./spark.js";
import { layoutSize, THEME_TOKENS } from "./themes.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const assets = process.env.DEGENLAB_ASSETS_DIR
  ? path.resolve(process.env.DEGENLAB_ASSETS_DIR)
  : path.resolve(here, "../assets");

let fontCache: { data: ArrayBuffer; name: string; weight: 400 | 700 | 800 }[] | null = null;
let logoCache: string | null = null;

async function fonts() {
  if (fontCache) return fontCache;
  const load = async (file: string, weight: 400 | 700 | 800) => {
    const buf = await readFile(path.join(assets, "fonts", file));
    return {
      name: "Inter",
      data: buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
      weight,
    };
  };
  fontCache = [
    await load("inter-400.woff", 400),
    await load("inter-700.woff", 700),
    await load("inter-800.woff", 800),
  ];
  return fontCache;
}

async function logoDataUri(): Promise<string> {
  if (logoCache) return logoCache;
  const raw = await readFile(path.join(assets, "logo.png"));
  const small = await sharp(raw).resize(160, 160).png().toBuffer();
  logoCache = `data:image/png;base64,${small.toString("base64")}`;
  return logoCache;
}

function pnlColor(value: string, theme: (typeof THEME_TOKENS)[keyof typeof THEME_TOKENS]) {
  return d(value).gte(0) ? theme.accent : theme.negative;
}

function row(label: string, value: string, muted: string, text: string, valueColor?: string) {
  return h(
    "div",
    {
      style: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "6px 0",
      },
    },
    h("div", { style: { color: muted, fontSize: 22 } }, label),
    h(
      "div",
      { style: { color: valueColor ?? text, fontSize: 22, fontWeight: 700 } },
      value,
    ),
  );
}

export type RenderInput = {
  metrics: DisplayMetrics;
  theme: CardThemeJson;
  verifyUrl: string;
  displayName: string;
};

export async function renderPnlCard(input: RenderInput): Promise<Buffer> {
  const theme = THEME_TOKENS[input.theme.theme];
  const layout: CardLayout = input.theme.layout;
  const { width, height } = layoutSize(layout);
  const logo = await logoDataUri();
  const qr = await QRCode.toDataURL(input.verifyUrl, {
    margin: 1,
    width: 180,
    color: { dark: "#0b0d0b", light: "#f4fff0" },
  });
  const accent = input.theme.accentColor || theme.accent;
  const positive = pnlColor(input.metrics.displayPnlAmount, { ...theme, accent });
  const mint = shortenMint(input.metrics.mint);
  const winRate = `${d(input.metrics.winRatePercent).toFixed(0)}%`;
  const tx = `${input.metrics.sevenDayTxWins}/${input.metrics.sevenDayTxTotal}`;
  const name = input.displayName || input.theme.displayName || "DEGEN";
  const caption = input.theme.caption;
  const chart = sparkline(
    input.metrics.chart,
    layout === "wide" ? 420 : 900,
    layout === "portrait" ? 140 : layout === "wide" ? 160 : 180,
    positive,
    input.theme.chartStyle,
  );

  const badge = h(
    "div",
    {
      style: {
        display: "flex",
        background: "#12180c",
        color: accent,
        border: `1px solid ${accent}`,
        borderRadius: 8,
        padding: "6px 12px",
        fontSize: 18,
        fontWeight: 700,
        letterSpacing: 1.4,
      },
    },
    PRACTICE_LABEL,
  );

  const verified = h(
    "div",
    {
      style: {
        display: "flex",
        color: accent,
        fontSize: 18,
        fontWeight: 700,
        letterSpacing: 1.2,
      },
    },
    "VERIFIED",
  );

  const header = h(
    "div",
    {
      style: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        width: "100%",
      },
    },
    h(
      "div",
      { style: { display: "flex", alignItems: "center", gap: 16 } },
      h("img", { src: logo, width: 56, height: 56 }),
      h(
        "div",
        { style: { display: "flex", flexDirection: "column" } },
        h(
          "div",
          {
            style: {
              fontSize: 28,
              fontWeight: 800,
              color: theme.text,
              letterSpacing: 1,
            },
          },
          "DEGENLAB",
        ),
        h(
          "div",
          { style: { fontSize: 16, color: theme.muted, letterSpacing: 3 } },
          "TRADE  ·  LEARN  ·  IMPROVE",
        ),
      ),
    ),
    h(
      "div",
      { style: { display: "flex", gap: 12, alignItems: "center" } },
      badge,
      verified,
    ),
  );

  const identity = h(
    "div",
    {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 18,
        marginTop: 28,
      },
    },
    h(
      "div",
      {
        style: {
          width: 72,
          height: 72,
          borderRadius: 36,
          background: theme.panel2,
          border: `2px solid ${accent}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: accent,
          fontSize: 28,
          fontWeight: 800,
        },
      },
      (input.metrics.ticker || "?").slice(0, 3),
    ),
    h(
      "div",
      { style: { display: "flex", flexDirection: "column" } },
      h(
        "div",
        { style: { fontSize: 32, fontWeight: 800, color: theme.text } },
        name,
      ),
      h(
        "div",
        { style: { fontSize: 20, color: theme.muted } },
        `${input.metrics.tokenName}  ·  ${input.metrics.ticker}${input.theme.showMint ? `  ·  ${mint}` : ""}`,
      ),
      h(
        "div",
        { style: { fontSize: 18, color: theme.muted, marginTop: 4 } },
        `Solana Mainnet · ${input.metrics.quoteProvider} · ${new Date(input.metrics.quoteTimestamp).toISOString().replace("T", " ").slice(0, 16)} UTC`,
      ),
    ),
  );

  const hero = h(
    "div",
    {
      style: {
        display: "flex",
        gap: 24,
        marginTop: 28,
        width: "100%",
      },
    },
    h(
      "div",
      {
        style: {
          display: "flex",
          flexDirection: "column",
          flex: 1,
          background: theme.panel,
          borderRadius: 24,
          padding: 28,
          border: `1px solid ${theme.border}`,
        },
      },
      h("div", { style: { color: theme.muted, fontSize: 20 } }, "Last 7D PnL"),
      h(
        "div",
        { style: { color: positive, fontSize: 64, fontWeight: 800, marginTop: 8 } },
        signedPct(input.metrics.last7dPnlPercent),
      ),
      h(
        "div",
        { style: { color: positive, fontSize: 26, marginTop: 4 } },
        `${signedUsd(input.metrics.last7dPnlAmount)} USD`,
      ),
    ),
    h(
      "div",
      {
        style: {
          display: "flex",
          flexDirection: "column",
          width: layout === "wide" ? 280 : 320,
          background: theme.panel,
          borderRadius: 24,
          padding: 28,
          border: `1px solid ${theme.border}`,
        },
      },
      h("div", { style: { color: theme.muted, fontSize: 20 } }, "Win Rate"),
      h(
        "div",
        { style: { color: theme.text, fontSize: 56, fontWeight: 800, marginTop: 8 } },
        winRate,
      ),
      h("div", { style: { color: theme.muted, fontSize: 20, marginTop: 8 } }, `7D TXs  ${tx}`),
    ),
  );

  const stats = h(
    "div",
    {
      style: {
        display: "flex",
        flexDirection: "column",
        background: theme.panel,
        borderRadius: 24,
        padding: "12px 28px",
        marginTop: 24,
        border: `1px solid ${theme.border}`,
        width: "100%",
      },
    },
    row("Total PnL", signedUsd(input.metrics.totalPnl), theme.muted, theme.text, positive),
    row(
      "Unrealized Profits",
      signedUsd(input.metrics.unrealizedProfits),
      theme.muted,
      theme.text,
      pnlColor(input.metrics.unrealizedProfits, { ...theme, accent }),
    ),
    row("Entry", formatPrice(input.metrics.averageEntry), theme.muted, theme.text),
    row(
      input.metrics.positionStatus === "CLOSED" ? "Exit" : "Mark",
      formatPrice(input.metrics.displayExitOrMarkPrice),
      theme.muted,
      theme.text,
    ),
    input.theme.showQuantity
      ? row("Quantity", formatQty(input.metrics.quantity), theme.muted, theme.text)
      : null,
    row("7D Total Cost", signedUsd(input.metrics.sevenDayTotalCost).replace("+", ""), theme.muted, theme.text),
    row("7D Token Avg Cost", formatPrice(input.metrics.sevenDayTokenAvgCost), theme.muted, theme.text),
    row(
      "7D Token Avg Realized",
      signedUsd(input.metrics.sevenDayTokenAvgRealizedProfits),
      theme.muted,
      theme.text,
      pnlColor(input.metrics.sevenDayTokenAvgRealizedProfits, { ...theme, accent }),
    ),
    input.theme.showHoldingTime
      ? row("Holding time", holdingLabel(input.metrics.holdingMs), theme.muted, theme.text)
      : null,
    row(
      "Practice equity",
      signedUsd(input.metrics.solBalance).replace("+", ""),
      theme.muted,
      theme.text,
    ),
  );

  const footer = h(
    "div",
    {
      style: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-end",
        marginTop: 24,
        width: "100%",
      },
    },
    h(
      "div",
      { style: { display: "flex", flexDirection: "column", flex: 1, marginRight: 24 } },
      caption
        ? h("div", { style: { color: theme.text, fontSize: 24, fontWeight: 700 } }, caption)
        : null,
      h(
        "div",
        { style: { color: theme.muted, fontSize: 18, marginTop: 8 } },
        "Verified DegenLab practice card  ·  virtual credits  ·  no withdrawable balance",
      ),
      h(
        "div",
        { style: { color: theme.muted, fontSize: 16, marginTop: 6 } },
        input.verifyUrl,
      ),
    ),
    h("img", { src: qr, width: 140, height: 140 }),
  );

  const tree = h(
    "div",
    {
      style: {
        width,
        height,
        display: "flex",
        background: theme.bg,
        color: theme.text,
        fontFamily: "Inter",
        padding: 28,
      },
    },
    h(
      "div",
      {
        style: {
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          border: `3px solid ${accent}`,
          borderRadius: 36,
          padding: 28,
          background:
            input.theme.background === "grid"
              ? theme.bg
              : layout === "portrait"
                ? theme.bg
                : theme.bg,
        },
      },
      header,
      identity,
      hero,
      h(
        "div",
        {
          style: {
            display: "flex",
            marginTop: 20,
            width: "100%",
            background: theme.panel,
            borderRadius: 24,
            padding: 20,
            border: `1px solid ${theme.border}`,
          },
        },
        chart,
      ),
      stats,
      footer,
    ),
  );

  const svg = await satori(tree as unknown as Parameters<typeof satori>[0], {
    width,
    height,
    fonts: await fonts(),
  });
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: width },
    background: theme.bg,
  });
  return Buffer.from(resvg.render().asPng());
}
