import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const money = (name: string) => numeric(name, { precision: 38, scale: 18 });

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    telegramUserId: bigint("telegram_user_id", { mode: "bigint" }).notNull(),
    telegramUsername: text("telegram_username"),
    displayName: text("display_name").notNull().default(""),
    practiceModeEnabled: boolean("practice_mode_enabled").notNull().default(true),
    leaderboardOptIn: boolean("leaderboard_opt_in").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("users_telegram_user_id_idx").on(t.telegramUserId)],
);

export const practiceAccounts = pgTable(
  "practice_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    quoteCurrency: text("quote_currency").notNull().default("USD"),
    startingVirtualBalance: money("starting_virtual_balance").notNull(),
    availableVirtualBalance: money("available_virtual_balance").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("practice_accounts_user_id_idx").on(t.userId)],
);

export const watchedTokens = pgTable(
  "watched_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cluster: text("cluster").notNull(),
    mintAddress: text("mint_address").notNull(),
    tokenName: text("token_name").notNull().default("Unknown token"),
    ticker: text("ticker").notNull().default("UNKNOWN"),
    decimals: integer("decimals").notNull().default(0),
    metadataJson: jsonb("metadata_json").$type<Record<string, unknown>>().notNull().default({}),
    lastVerifiedAt: timestamp("last_verified_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("watched_tokens_cluster_mint_idx").on(t.cluster, t.mintAddress),
  ],
);

export const priceSnapshots = pgTable(
  "price_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cluster: text("cluster").notNull(),
    mintAddress: text("mint_address").notNull(),
    price: money("price").notNull(),
    quoteCurrency: text("quote_currency").notNull().default("USD"),
    provider: text("provider").notNull(),
    sourceTimestamp: timestamp("source_timestamp", { withTimezone: true }).notNull(),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull(),
    liquidity: money("liquidity"),
    metadataJson: jsonb("metadata_json").$type<Record<string, unknown>>().notNull().default({}),
  },
  (t) => [
    index("price_snapshots_mint_fetched_idx").on(
      t.cluster,
      t.mintAddress,
      t.fetchedAt,
    ),
  ],
);

export const positions = pgTable(
  "positions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    shortId: text("short_id").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    mintAddress: text("mint_address").notNull(),
    cluster: text("cluster").notNull(),
    status: text("status").notNull(),
    quantity: money("quantity").notNull(),
    remainingCostBasis: money("remaining_cost_basis").notNull(),
    averageEntry: money("average_entry").notNull(),
    realizedPnl: money("realized_pnl").notNull().default("0"),
    openedAt: timestamp("opened_at", { withTimezone: true }).notNull().defaultNow(),
    closedAt: timestamp("closed_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("positions_short_id_idx").on(t.shortId),
    index("positions_user_status_idx").on(t.userId, t.status),
  ],
);

export const tradeEvents = pgTable(
  "trade_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    positionId: uuid("position_id")
      .notNull()
      .references(() => positions.id),
    eventType: text("event_type").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    mintAddress: text("mint_address").notNull(),
    cluster: text("cluster").notNull(),
    quantity: money("quantity").notNull(),
    executionPrice: money("execution_price").notNull(),
    grossValue: money("gross_value").notNull(),
    fees: money("fees").notNull(),
    slippageAssumption: money("slippage_assumption").notNull(),
    quoteSnapshotId: uuid("quote_snapshot_id").references(() => priceSnapshots.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("trade_events_idempotency_idx").on(t.idempotencyKey),
    index("trade_events_position_idx").on(t.positionId, t.createdAt),
  ],
);

export const cardTemplates = pgTable("card_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  themeSchemaJson: jsonb("theme_schema_json")
    .$type<Record<string, unknown>>()
    .notNull()
    .default({}),
  isActive: boolean("is_active").notNull().default(true),
});

export const pnlCards = pgTable(
  "pnl_cards",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    shortId: text("short_id").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    positionId: uuid("position_id")
      .notNull()
      .references(() => positions.id),
    templateId: uuid("template_id").references(() => cardTemplates.id),
    themeJson: jsonb("theme_json").$type<Record<string, unknown>>().notNull().default({}),
    caption: text("caption").notNull().default(""),
    ledgerSnapshotJson: jsonb("ledger_snapshot_json")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    displayMetricsJson: jsonb("display_metrics_json")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    profitInputMode: text("profit_input_mode"),
    profitInputValue: money("profit_input_value"),
    isVerified: boolean("is_verified").notNull().default(true),
    displayCustomized: boolean("display_customized").notNull().default(false),
    version: integer("version").notNull().default(1),
    imageObjectKey: text("image_object_key"),
    telegramFileId: text("telegram_file_id"),
    publicShareId: text("public_share_id"),
    isPublic: boolean("is_public").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("pnl_cards_short_id_idx").on(t.shortId),
    uniqueIndex("pnl_cards_public_share_id_idx").on(t.publicShareId),
    index("pnl_cards_user_idx").on(t.userId),
  ],
);

export const telegramUpdates = pgTable("telegram_updates", {
  updateId: bigint("update_id", { mode: "bigint" }).primaryKey(),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
  processedAt: timestamp("processed_at", { withTimezone: true }),
  status: text("status").notNull().default("received"),
});

export const botSessions = pgTable("bot_sessions", {
  telegramUserId: bigint("telegram_user_id", { mode: "bigint" }).primaryKey(),
  stateJson: jsonb("state_json").$type<Record<string, unknown>>().notNull().default({}),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id),
  action: text("action").notNull(),
  payloadJson: jsonb("payload_json").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const schema = {
  users,
  practiceAccounts,
  watchedTokens,
  priceSnapshots,
  positions,
  tradeEvents,
  cardTemplates,
  pnlCards,
  telegramUpdates,
  botSessions,
  auditLogs,
};
