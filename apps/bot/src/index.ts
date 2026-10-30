import { serve } from "@hono/node-server";
import { openDatabase } from "@degenlab/database";
import { CompositeMarketDataProvider } from "@degenlab/market-data";
import { createBot } from "./bot.js";
import { loadConfig } from "./config.js";
import { loadEnvFile } from "./env.js";
import { logger } from "./logger.js";
import { createServer } from "./server.js";

async function main() {
  loadEnvFile();
  const cfg = loadConfig();
  logger.info({ workflow: "boot" }, "starting degenlab");
  const db = await openDatabase(cfg.DATABASE_URL);
  const market = new CompositeMarketDataProvider(cfg.QUOTE_MAX_AGE_SECONDS);
  const bot = createBot(cfg, db, market);
  const app = createServer(cfg, db, bot);

  serve({ fetch: app.fetch, port: cfg.PORT, hostname: "0.0.0.0" }, (info) => {
    logger.info({ port: info.port }, "http listening");
  });

  const base = cfg.PUBLIC_BASE_URL?.replace(/\/$/, "");
  if (base && cfg.TELEGRAM_WEBHOOK_SECRET) {
    const webhookUrl = `${base}/telegram/webhook`;
    await bot.api.setWebhook(webhookUrl, {
      secret_token: cfg.TELEGRAM_WEBHOOK_SECRET,
      drop_pending_updates: false,
    });
    logger.info({ webhookUrl }, "telegram webhook registered");
  } else {
    logger.info("starting long polling");
    await bot.api.deleteWebhook({ drop_pending_updates: false });
    const me = await bot.api.getMe();
    logger.info({ username: me.username, id: me.id }, "telegram identity");
    await bot.start({
      drop_pending_updates: false,
      onStart: (info) =>
        logger.info({ username: info.username }, "long polling started"),
    });
  }
}

main().catch((error) => {
  logger.error({ err: error }, "fatal");
  process.exit(1);
});
