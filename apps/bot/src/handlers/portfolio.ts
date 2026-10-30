import { d } from "@degenlab/pnl";
import { listPositions } from "@degenlab/ledger";
import { getWatched } from "../services/tokens.js";
import { portfolioText, positionText } from "../copy.js";
import {
  backHome,
  mainMenu,
  positionActions,
  positionsList,
} from "../keyboards/index.js";
import type { AppContext } from "../context.js";
import { getPositionByShortId } from "@degenlab/ledger";

export async function showPortfolio(ctx: AppContext) {
  const open = await listPositions(ctx.db, ctx.viewer.userId, "OPEN");
  const closed = await listPositions(ctx.db, ctx.viewer.userId, "CLOSED");
  let positionValue = d(0);
  let unrealized = d(0);
  let realized = d(0);
  let stale = false;
  for (const pos of open) {
    try {
      const quote = await ctx.market.getQuote(pos.mintAddress, "USD", "mainnet");
      if (quote.status !== "fresh") stale = true;
      const value = d(pos.quantity).mul(d(quote.price));
      positionValue = positionValue.plus(value);
      unrealized = unrealized.plus(value.minus(d(pos.remainingCostBasis)));
    } catch {
      stale = true;
    }
  }
  for (const pos of [...open, ...closed]) {
    realized = realized.plus(d(pos.realizedPnl));
  }
  const cash = d(ctx.viewer.cash);
  const equity = cash.plus(positionValue);
  await ctx.reply(
    portfolioText({
      cash: cash.toString(),
      positionValue: positionValue.toString(),
      equity: equity.toString(),
      realized: realized.toString(),
      unrealized: unrealized.toString(),
      openCount: open.length,
      stale,
    }),
    { parse_mode: "HTML", reply_markup: mainMenu() },
  );
}

export async function showPositions(ctx: AppContext) {
  const open = await listPositions(ctx.db, ctx.viewer.userId, "OPEN");
  const closed = await listPositions(ctx.db, ctx.viewer.userId, "CLOSED");
  const rows = [];
  for (const pos of [...open, ...closed]) {
    const token = await getWatched(ctx.db, pos.mintAddress, pos.cluster);
    rows.push({
      shortId: pos.shortId,
      ticker: token?.ticker ?? pos.mintAddress.slice(0, 4),
      status: pos.status,
    });
  }
  if (rows.length === 0) {
    await ctx.reply("No practice positions yet. Paste a mint to start.", {
      reply_markup: mainMenu(),
    });
    return;
  }
  await ctx.reply("Practice positions — tap one for detail.", {
    reply_markup: positionsList(rows),
  });
}

export async function showPosition(ctx: AppContext, shortId: string) {
  const pos = await getPositionByShortId(ctx.db, ctx.viewer.userId, shortId);
  if (!pos) {
    await ctx.reply("That position is not yours or does not exist.");
    return;
  }
  const token = await getWatched(ctx.db, pos.mintAddress, pos.cluster);
  let mark = String(pos.averageEntry);
  let quoteStatus = "missing";
  let provider = "none";
  let timestamp = pos.openedAt.toISOString();
  try {
    const quote = await ctx.market.getQuote(pos.mintAddress, "USD", "mainnet");
    mark = quote.price;
    quoteStatus = quote.status;
    provider = quote.provider;
    timestamp = quote.sourceTimestamp;
  } catch {
    quoteStatus = "missing";
  }
  const markValue = d(pos.quantity).mul(d(mark));
  const unrealized =
    pos.status === "OPEN" ? markValue.minus(d(pos.remainingCostBasis)) : d(0);
  await ctx.reply(
    positionText({
      name: token?.tokenName ?? "Unknown token",
      ticker: token?.ticker ?? "UNKNOWN",
      mint: pos.mintAddress,
      status: pos.status,
      qty: String(pos.quantity),
      avg: String(pos.averageEntry),
      mark,
      realized: String(pos.realizedPnl),
      unrealized: unrealized.toString(),
      fees: "0",
      provider,
      timestamp,
      quoteStatus,
    }),
    { parse_mode: "HTML", reply_markup: positionActions(pos.shortId, pos.status) },
  );
}

export { backHome };
