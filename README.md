# DEGENLAB

Telegram-native Solana **market-practice** bot.

**TRADE. LEARN. IMPROVE.**

Paste a Mainnet token mint, inspect public market data, open and close practice positions with virtual credits, then share a verified PnL card.

This is simulated. Positions, receipts, and cards are labeled **PRACTICE / SIMULATED**. There are no deposits, withdrawals, live swaps, or bot-held wallets.

## Product loop

`PASTE CA → INSPECT TOKEN → OPEN PRACTICE POSITION → TRACK → CLOSE → REVIEW PnL → CUSTOMIZE CARD → SHARE`

Edited cards stay **verified**. The profit adjuster recalculates dependent display fields. The practice ledger, balances, and leaderboard stay on real trade events.

## Stack

- TypeScript monorepo (pnpm)
- grammY Telegram bot + Hono webhook server
- PostgreSQL + Drizzle
- decimal.js practice ledger
- DexScreener + Jupiter market data
- Satori + resvg PnL cards

## Local run

```bash
pnpm install
docker compose up -d postgres
cp .env.example .env
# set BOT_TOKEN and DATABASE_URL
pnpm migrate
pnpm dev
```

Without `PUBLIC_BASE_URL` the bot uses long polling. With `PUBLIC_BASE_URL` and `TELEGRAM_WEBHOOK_SECRET` it registers a webhook at `/telegram/webhook`.

Health: `GET /healthz`  
Public card: `GET /c/:shareId`

## Tests

```bash
pnpm test
```

## Koyeb

Build from `infra/Dockerfile`. Bind `0.0.0.0:$PORT`. Point the health check at `/healthz`. Store secrets in Koyeb Secrets:

- `BOT_TOKEN`
- `TELEGRAM_WEBHOOK_SECRET`
- `DATABASE_URL`
- `PUBLIC_BASE_URL`
- `SOLANA_MAINNET_RPC_URL`

## Commands

`/start` `/help` `/lookup` `/portfolio` `/positions` `/cards` `/leaderboard` `/settings` `/reset`
