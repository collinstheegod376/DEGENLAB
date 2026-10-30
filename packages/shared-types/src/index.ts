export const CLUSTER = {
  MAINNET: "mainnet",
  DEVNET: "devnet",
} as const;

export type Cluster = (typeof CLUSTER)[keyof typeof CLUSTER];

export const POSITION_STATUS = {
  OPEN: "OPEN",
  CLOSED: "CLOSED",
} as const;

export type PositionStatus =
  (typeof POSITION_STATUS)[keyof typeof POSITION_STATUS];

export const TRADE_EVENT_TYPE = {
  BUY: "BUY",
  SELL: "SELL",
  REVERSAL: "REVERSAL",
} as const;

export type TradeEventType =
  (typeof TRADE_EVENT_TYPE)[keyof typeof TRADE_EVENT_TYPE];

export const WORKFLOW = {
  ONBOARDING: "onboarding.v1",
  TOKEN_LOOKUP: "token_lookup.v1",
  PRACTICE_ORDER: "practice_order.v1",
  POSITION_DETAIL: "position_detail.v1",
  PORTFOLIO: "portfolio.v1",
  CARD_BUILDER: "card_builder.v1",
  CARD_SHARE: "card_share.v1",
  LEADERBOARD: "leaderboard.v1",
  DEVNET_WALLET_VIEW: "devnet_wallet_view.v1",
} as const;

export type WorkflowId = (typeof WORKFLOW)[keyof typeof WORKFLOW];

export const THEMES = [
  "obsidian-green",
  "violet-circuit",
  "mono",
  "solana-gradient",
] as const;

export type CardThemeId = (typeof THEMES)[number];

export const CARD_LAYOUTS = ["compact", "wide", "portrait"] as const;
export type CardLayout = (typeof CARD_LAYOUTS)[number];

export const CHART_STYLES = ["line", "area", "candles"] as const;
export type ChartStyle = (typeof CHART_STYLES)[number];

export const PROFIT_INPUT_MODE = {
  PERCENT: "percent",
  AMOUNT: "amount",
} as const;

export type ProfitInputMode =
  (typeof PROFIT_INPUT_MODE)[keyof typeof PROFIT_INPUT_MODE];

export const PRACTICE_LABEL = "PRACTICE / SIMULATED";
export const NETWORK_LABEL_MAINNET = "Solana Mainnet · practice ledger";
export const CALLBACK_PREFIX = "dl:v1:";

export type QuoteStatus = "fresh" | "stale" | "missing" | "partial";

export type MarketQuote = {
  mint: string;
  cluster: Cluster;
  price: string;
  quoteCurrency: string;
  provider: string;
  sourceTimestamp: string;
  fetchedAt: string;
  status: QuoteStatus;
  liquidity: string | null;
  volume24h: string | null;
  confidence: "high" | "medium" | "low";
};

export type TokenMetadata = {
  mint: string;
  cluster: Cluster;
  name: string;
  ticker: string;
  decimals: number;
  imageUrl: string | null;
  provider: string;
  sourceTimestamp: string;
  fetchedAt: string;
  status: QuoteStatus;
};

export type Candle = {
  openTime: number;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string | null;
};

export type ChartPoint = {
  t: number;
  p: string;
};

export type LedgerSnapshot = {
  positionId: string;
  mint: string;
  cluster: Cluster;
  tokenName: string;
  ticker: string;
  status: PositionStatus;
  quantity: string;
  remainingCostBasis: string;
  averageEntry: string;
  realizedPnl: string;
  unrealizedPnl: string;
  totalPnl: string;
  pnlPercent: string;
  markPrice: string;
  markValue: string;
  modeledFees: string;
  openedAt: string;
  closedAt: string | null;
  quoteProvider: string;
  quoteTimestamp: string;
  quoteStatus: QuoteStatus;
  solBalance: string;
  solBalanceUsd: string | null;
  sevenDayTxWins: number;
  sevenDayTxTotal: number;
  chart: ChartPoint[];
};

export type DisplayMetrics = {
  tokenName: string;
  ticker: string;
  mint: string;
  cluster: Cluster;
  averageEntry: string;
  quantity: string;
  costBasis: string;
  displayPnlAmount: string;
  displayPnlPercent: string;
  displayExitOrMarkPrice: string;
  displayPositionValue: string;
  last7dPnlAmount: string;
  last7dPnlPercent: string;
  totalPnl: string;
  unrealizedProfits: string;
  sevenDayTotalCost: string;
  sevenDayTokenAvgCost: string;
  sevenDayTokenAvgRealizedProfits: string;
  sevenDayTxWins: number;
  sevenDayTxTotal: number;
  winRatePercent: string;
  solBalance: string;
  solBalanceUsd: string | null;
  holdingMs: number;
  openedAt: string;
  closedAt: string | null;
  quoteProvider: string;
  quoteTimestamp: string;
  quoteStatus: QuoteStatus;
  positionStatus: PositionStatus;
  chart: ChartPoint[];
};

export type CardThemeJson = {
  theme: CardThemeId;
  layout: CardLayout;
  chartStyle: ChartStyle;
  accentColor: string | null;
  background: "plain" | "grid" | "scanlines";
  displayName: string;
  caption: string;
  showQuantity: boolean;
  showHoldingTime: boolean;
  showMint: boolean;
  avatarDataUri: string | null;
};

export type SessionState = {
  workflow?: WorkflowId;
  awaiting?:
    | "mint"
    | "buy_amount"
    | "sell_percent"
    | "caption"
    | "display_name"
    | "pnl_percent"
    | "pnl_amount";
  mint?: string;
  positionShortId?: string;
  cardShortId?: string;
  pendingOrderId?: string;
  pendingSide?: "BUY" | "SELL";
  pendingAmount?: string;
  pendingPercent?: string;
};

export function shortenMint(mint: string, chars = 4): string {
  if (mint.length <= chars * 2 + 3) return mint;
  return `${mint.slice(0, chars)}…${mint.slice(-chars)}`;
}

export function isThemeId(value: string): value is CardThemeId {
  return (THEMES as readonly string[]).includes(value);
}
