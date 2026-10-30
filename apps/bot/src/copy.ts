import {
  NETWORK_LABEL_MAINNET,
  PRACTICE_LABEL,
  shortenMint,
} from "@degenlab/shared-types";
import { formatPercent, formatPrice, formatQty, formatUsd } from "@degenlab/pnl";

export const START = `<b>DEGENLAB</b>  ·  TRADE. LEARN. IMPROVE.

This is a <b>market-practice</b> bot. You inspect real Solana Mainnet tokens, then open and close positions with <b>virtual credits</b>.

${PRACTICE_LABEL}
${NETWORK_LABEL_MAINNET}

No deposits. No withdrawals. No wallet connect. No live swaps.

Your practice account starts with virtual USD credits. Paste a token mint (CA) to begin.`;

export const HELP = `<b>Commands</b>
/start — main menu
/lookup — paste a Mainnet mint
/portfolio — virtual cash and equity
/positions — open and closed practice positions
/cards — verified PnL cards
/leaderboard — opt-in practice rankings
/settings — privacy and reset
/help — this screen

<b>Practice mode</b>
Orders are database ledger entries. They are labeled ${PRACTICE_LABEL}. They do not move tokens on Mainnet.

<b>Networks</b>
Mainnet mint lookup + practice ledger is the live mode. Devnet is a separate future lab. The two clusters do not mix.

<b>Cards</b>
Every card from a real practice position is verified, including profit-adjusted cards. Rankings always use the ledger.`;

export function tokenReport(input: {
  name: string;
  ticker: string;
  mint: string;
  price: string | null;
  liquidity: string | null;
  volume24h: string | null;
  provider: string;
  timestamp: string;
  status: string;
  confidence: string;
  mintAccount?: "found" | "missing" | "unverified";
  tradable?: boolean;
}): string {
  const liq = input.liquidity ? formatUsd(input.liquidity) : "unavailable";
  const vol = input.volume24h ? formatUsd(input.volume24h) : "unavailable";
  const priceLine = input.price
    ? `Price  <b>${esc(formatPrice(input.price))}</b> USD`
    : "Price  unavailable";
  const mintAccount =
    input.mintAccount === "found"
      ? "Mainnet mint account  found"
      : input.mintAccount === "missing"
        ? "Mainnet mint account  not found"
        : input.mintAccount === "unverified"
          ? "Mainnet mint account  unverified (RPC timeout)"
          : null;
  const buyLine =
    input.tradable === false
      ? "\nNo USD quote was invented. Practice buy stays off until DexScreener or Jupiter lists this mint."
      : "";
  return `<b>${esc(input.name)}</b>  ·  ${esc(input.ticker)}
<code>${esc(input.mint)}</code>

${priceLine}
Liquidity  ${esc(liq)}
24h volume  ${esc(vol)}
${mintAccount ? `\n${mintAccount}` : ""}
Network  ${NETWORK_LABEL_MAINNET}
Source  ${esc(input.provider)}  ·  ${esc(input.timestamp)}
Quote  ${esc(input.status)}  ·  confidence ${esc(input.confidence)}

Unknown / new / unverified is a data fact. It is not a malware verdict.${buyLine}

${PRACTICE_LABEL}`;
}

export function portfolioText(input: {
  cash: string;
  positionValue: string;
  equity: string;
  realized: string;
  unrealized: string;
  openCount: number;
  stale: boolean;
}): string {
  return `<b>Practice portfolio</b>
${PRACTICE_LABEL}
${NETWORK_LABEL_MAINNET}

Virtual cash  <b>${esc(formatUsd(input.cash))}</b>
Open position value  ${esc(formatUsd(input.positionValue))}
Practice equity  <b>${esc(formatUsd(input.equity))}</b>

Realized PnL  ${esc(formatUsd(input.realized))}
Unrealized PnL  ${esc(formatUsd(input.unrealized))}
Open positions  ${input.openCount}
${input.stale ? "\nMark prices include at least one stale quote. Fresh PnL is paused until a live quote returns." : ""}`;
}

export function positionText(input: {
  name: string;
  ticker: string;
  mint: string;
  status: string;
  qty: string;
  avg: string;
  mark: string;
  realized: string;
  unrealized: string;
  fees: string;
  provider: string;
  timestamp: string;
  quoteStatus: string;
}): string {
  return `<b>${esc(input.name)}</b>  ·  ${esc(input.ticker)}  ·  ${esc(input.status)}
<code>${esc(shortenMint(input.mint, 6))}</code>

Qty  ${esc(formatQty(input.qty))}
Avg entry  ${esc(formatPrice(input.avg))}
Mark  ${esc(formatPrice(input.mark))}
Realized  ${esc(formatUsd(input.realized))}
Unrealized  ${esc(formatUsd(input.unrealized))}
Modeled fees (last event)  ${esc(formatUsd(input.fees))}

Source  ${esc(input.provider)}  ·  ${esc(input.timestamp)}  ·  ${esc(input.quoteStatus)}
${PRACTICE_LABEL}`;
}

export function receipt(input: {
  side: "BUY" | "SELL";
  ticker: string;
  qty: string;
  price: string;
  value: string;
  fees: string;
  pnl?: string;
  provider: string;
  timestamp: string;
}): string {
  const pnlLine =
    input.pnl !== undefined ? `\nRealized PnL  ${esc(formatUsd(input.pnl))}` : "";
  return `<b>PRACTICE ${input.side} receipt</b>
${PRACTICE_LABEL}

${esc(input.ticker)}
Qty  ${esc(formatQty(input.qty))}
Execution  ${esc(formatPrice(input.price))}
Value  ${esc(formatUsd(input.value))}
Modeled fees  ${esc(formatUsd(input.fees))}${pnlLine}

Source  ${esc(input.provider)}  ·  ${esc(input.timestamp)}

This did not settle on Mainnet. Virtual credits only.`;
}

export function cardEditorText(input: {
  ticker: string;
  verified: boolean;
  customized: boolean;
  pnlPct: string;
  pnlAmt: string;
  theme: string;
  layout: string;
}): string {
  return `<b>Verified PnL card</b>  ·  ${esc(input.ticker)}
Status  ${input.verified ? "VERIFIED" : "PENDING"}  ·  ${PRACTICE_LABEL}
Display  ${input.customized ? "profit adjusted (still verified)" : "ledger snapshot"}

PnL  ${esc(formatPercent(input.pnlPct))}   ${esc(formatUsd(input.pnlAmt))}
Theme  ${esc(input.theme)}
Layout  ${esc(input.layout)}

Set headline profit. Dependent price and 7D stats recalculate on the server. Rankings still use the practice ledger.`;
}

export function esc(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
