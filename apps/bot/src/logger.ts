import pino from "pino";

export const logger = pino({
  level: process.env.NODE_ENV === "production" ? "info" : "debug",
  redact: {
    paths: [
      "BOT_TOKEN",
      "TELEGRAM_WEBHOOK_SECRET",
      "DATABASE_URL",
      "REDIS_URL",
      "SOLANA_MAINNET_RPC_URL",
      "MARKET_DATA_API_KEY",
      "req.headers.authorization",
      "req.headers[\"x-telegram-bot-api-secret-token\"]",
    ],
    censor: "[redacted]",
  },
});
