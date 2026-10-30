CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_user_id BIGINT NOT NULL UNIQUE,
  telegram_username TEXT,
  display_name TEXT NOT NULL DEFAULT '',
  practice_mode_enabled BOOLEAN NOT NULL DEFAULT true,
  leaderboard_opt_in BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS practice_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id),
  quote_currency TEXT NOT NULL DEFAULT 'USD',
  starting_virtual_balance NUMERIC(38, 18) NOT NULL,
  available_virtual_balance NUMERIC(38, 18) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS watched_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cluster TEXT NOT NULL,
  mint_address TEXT NOT NULL,
  token_name TEXT NOT NULL DEFAULT 'Unknown token',
  ticker TEXT NOT NULL DEFAULT 'UNKNOWN',
  decimals INTEGER NOT NULL DEFAULT 0,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_verified_at TIMESTAMPTZ,
  UNIQUE (cluster, mint_address)
);

CREATE TABLE IF NOT EXISTS price_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cluster TEXT NOT NULL,
  mint_address TEXT NOT NULL,
  price NUMERIC(38, 18) NOT NULL,
  quote_currency TEXT NOT NULL DEFAULT 'USD',
  provider TEXT NOT NULL,
  source_timestamp TIMESTAMPTZ NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL,
  liquidity NUMERIC(38, 18),
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS price_snapshots_mint_fetched_idx
  ON price_snapshots (cluster, mint_address, fetched_at DESC);

CREATE TABLE IF NOT EXISTS positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  short_id TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL REFERENCES users(id),
  mint_address TEXT NOT NULL,
  cluster TEXT NOT NULL,
  status TEXT NOT NULL,
  quantity NUMERIC(38, 18) NOT NULL,
  remaining_cost_basis NUMERIC(38, 18) NOT NULL,
  average_entry NUMERIC(38, 18) NOT NULL,
  realized_pnl NUMERIC(38, 18) NOT NULL DEFAULT 0,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS positions_user_status_idx
  ON positions (user_id, status);

CREATE TABLE IF NOT EXISTS trade_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  position_id UUID NOT NULL REFERENCES positions(id),
  event_type TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  mint_address TEXT NOT NULL,
  cluster TEXT NOT NULL,
  quantity NUMERIC(38, 18) NOT NULL,
  execution_price NUMERIC(38, 18) NOT NULL,
  gross_value NUMERIC(38, 18) NOT NULL,
  fees NUMERIC(38, 18) NOT NULL,
  slippage_assumption NUMERIC(38, 18) NOT NULL,
  quote_snapshot_id UUID REFERENCES price_snapshots(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS trade_events_position_idx
  ON trade_events (position_id, created_at);

CREATE TABLE IF NOT EXISTS card_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  theme_schema_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS pnl_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  short_id TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL REFERENCES users(id),
  position_id UUID NOT NULL REFERENCES positions(id),
  template_id UUID REFERENCES card_templates(id),
  theme_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  caption TEXT NOT NULL DEFAULT '',
  ledger_snapshot_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  display_metrics_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  profit_input_mode TEXT,
  profit_input_value NUMERIC(38, 18),
  is_verified BOOLEAN NOT NULL DEFAULT true,
  display_customized BOOLEAN NOT NULL DEFAULT false,
  version INTEGER NOT NULL DEFAULT 1,
  image_object_key TEXT,
  telegram_file_id TEXT,
  public_share_id TEXT UNIQUE,
  is_public BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pnl_cards_user_idx ON pnl_cards (user_id);

CREATE TABLE IF NOT EXISTS telegram_updates (
  update_id BIGINT PRIMARY KEY,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'received'
);

CREATE TABLE IF NOT EXISTS bot_sessions (
  telegram_user_id BIGINT PRIMARY KEY,
  state_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  action TEXT NOT NULL,
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO card_templates (name, theme_schema_json, is_active)
SELECT 'compact', '{"layout":"compact"}'::jsonb, true
WHERE NOT EXISTS (SELECT 1 FROM card_templates WHERE name = 'compact');

INSERT INTO card_templates (name, theme_schema_json, is_active)
SELECT 'wide', '{"layout":"wide"}'::jsonb, true
WHERE NOT EXISTS (SELECT 1 FROM card_templates WHERE name = 'wide');

INSERT INTO card_templates (name, theme_schema_json, is_active)
SELECT 'portrait', '{"layout":"portrait"}'::jsonb, true
WHERE NOT EXISTS (SELECT 1 FROM card_templates WHERE name = 'portrait');
