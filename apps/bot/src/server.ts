import { Hono } from "hono";
import { webhookCallback } from "grammy";
import type { Database } from "@degenlab/database";
import { getPublicCard, renderCardPng } from "./services/cards.js";
import type { Config } from "./config.js";
import type { createBot } from "./bot.js";
import { PRACTICE_LABEL } from "@degenlab/shared-types";
import type { DisplayMetrics } from "@degenlab/shared-types";

export function createServer(
  cfg: Config,
  db: Database,
  bot: ReturnType<typeof createBot>,
) {
  const app = new Hono();

  app.get("/healthz", (c) =>
    c.json({
      ok: true,
      service: "degenlab",
      mode: "practice",
    }),
  );

  app.post("/telegram/webhook", async (c) => {
    const secret = c.req.header("X-Telegram-Bot-Api-Secret-Token");
    if (cfg.TELEGRAM_WEBHOOK_SECRET && secret !== cfg.TELEGRAM_WEBHOOK_SECRET) {
      return c.text("unauthorized", 401);
    }
    const handler = webhookCallback(bot, "hono");
    return handler(c);
  });

  app.get("/c/:shareId", async (c) => {
    const card = await getPublicCard(db, c.req.param("shareId"));
    if (!card) return c.text("Card not found or revoked.", 404);
    const metrics = card.displayMetricsJson as unknown as DisplayMetrics;
    const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>DegenLab verified practice card</title>
  <style>
    :root { color-scheme: dark; }
    body { margin:0; font-family: Inter, ui-sans-serif, system-ui; background:#07080a; color:#f4f7f4; }
    main { max-width: 720px; margin: 0 auto; padding: 32px 20px 64px; }
    .badge { display:inline-block; border:1px solid #b8ff3d; color:#b8ff3d; padding:4px 10px; border-radius:8px; letter-spacing:1px; font-size:12px; }
    img.card { width:100%; border-radius:24px; border:2px solid #b8ff3d; margin:24px 0; }
    .muted { color:#8b948b; }
    a { color:#b8ff3d; }
  </style>
</head>
<body>
  <main>
    <p class="badge">VERIFIED · ${PRACTICE_LABEL}</p>
    <h1>DegenLab issued this card</h1>
    <p class="muted">${metrics.tokenName} · ${metrics.ticker} · Solana Mainnet practice ledger</p>
    <p>Published PnL ${metrics.displayPnlPercent}% · ${metrics.displayPnlAmount} USD</p>
    <p class="muted">Source ${metrics.quoteProvider} · ${metrics.quoteTimestamp}</p>
    <img class="card" src="/c/${card.publicShareId}.png" alt="DegenLab PnL card"/>
    <p class="muted">Virtual credits only. This card does not represent withdrawable funds or a Mainnet fill. Rankings use the practice ledger, not card display overrides.</p>
  </main>
</body>
</html>`;
    return c.html(html);
  });

  app.get("/c/:shareId.png", async (c) => {
    const card = await getPublicCard(db, c.req.param("shareId"));
    if (!card) return c.text("Card not found or revoked.", 404);
    const { png } = await renderCardPng(db, card.id, cfg.PUBLIC_BASE_URL || "http://localhost");
    return new Response(new Uint8Array(png), {
      headers: {
        "content-type": "image/png",
        "cache-control": "public, max-age=60",
      },
    });
  });

  return app;
}
