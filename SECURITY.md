# Security

DegenLab is a market-practice application. It must never collect custody of user funds or keys.

## Hard rules

- No private keys, seed phrases, or wallet mnemonic prompts.
- No Mainnet swaps, transfers, deposits, withdrawals, or bot-controlled wallets.
- Practice balances are virtual credits in PostgreSQL. They have no cash-out path.
- Mainnet market lookup and the Devnet wallet lab stay on separate code paths.

## Webhook

- Telegram updates are accepted only with a matching `X-Telegram-Bot-Api-Secret-Token`.
- `update_id` is stored uniquely so duplicate deliveries cannot double-fill the ledger.
- Callback payloads are short opaque IDs. Token metadata, user IDs, and JSON never go in `callback_data`.
- Every mutating callback is authorized against the Telegram user who owns the row.

## Data

- Captions are length-capped and stripped of HTML before render and Telegram send.
- User-supplied URLs are not fetched. Market data comes from allowlisted providers.
- Logs redact bot tokens, database URLs, RPC URLs, and webhook secrets.
- Shared cards use opaque share IDs. Sequential database IDs are not exposed.
- Users can revoke a public card link and opt out of the leaderboard.

## Secrets

Keep `BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `DATABASE_URL`, and RPC URLs in Koyeb Secrets. Never commit `.env`.
