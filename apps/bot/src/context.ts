import type { Context } from "grammy";
import type { Database } from "@degenlab/database";
import type { CompositeMarketDataProvider } from "@degenlab/market-data";
import type { SessionState } from "@degenlab/shared-types";
import type { Config } from "./config.js";

export type Viewer = {
  userId: string;
  telegramUserId: bigint;
  displayName: string;
  username?: string | null;
  leaderboardOptIn: boolean;
  cash: string;
};

export type AppContext = Context & {
  db: Database;
  cfg: Config;
  market: CompositeMarketDataProvider;
  session: SessionState;
  viewer: Viewer;
};
