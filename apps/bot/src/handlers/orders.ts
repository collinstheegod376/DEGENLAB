import { randomUUID } from "node:crypto";
import { WORKFLOW } from "@degenlab/shared-types";
import { assertFreshQuote } from "@degenlab/market-data";
import {
  executeBuy,
  executeSell,
  getPositionByShortId,
  LedgerError,
} from "@degenlab/ledger";
import { d, formatUsd, toNumericString } from "@degenlab/pnl";
import { persistQuote } from "../services/tokens.js";
import { receipt } from "../copy.js";
import { confirmOrder, mainMenu, sellPercent } from "../keyboards/index.js";
import type { AppContext } from "../context.js";
import { logger } from "../logger.js";

function assumptions(ctx: AppContext) {
  return {
    feeBps: ctx.cfg.PRACTICE_FEE_BPS,
    slippageBps: ctx.cfg.PRACTICE_SLIPPAGE_BPS,
  };
}

export async function startBuyPercent(ctx: AppContext, pct: string) {
  if (pct === "custom") {
    ctx.session.awaiting = "buy_amount";
    ctx.session.workflow = WORKFLOW.PRACTICE_ORDER;
    await ctx.reply("Send a virtual USD amount to spend. Example: <code>250</code>", {
      parse_mode: "HTML",
    });
    return;
  }
  const amount = d(ctx.viewer.cash).mul(d(pct)).div(100);
  await previewBuy(ctx, toNumericString(amount));
}

export async function previewBuy(ctx: AppContext, amountRaw: string) {
  const mint = ctx.session.mint;
  if (!mint) {
    await ctx.reply("Lookup a token first.");
    return;
  }
  let amount: ReturnType<typeof d>;
  try {
    amount = d(amountRaw);
  } catch {
    await ctx.reply("Enter a positive number.");
    return;
  }
  if (amount.lte(0)) {
    await ctx.reply("Amount must be positive.");
    return;
  }
  if (amount.gt(d(ctx.viewer.cash))) {
    await ctx.reply("That exceeds your virtual cash.");
    return;
  }
  try {
    const quote = await ctx.market.getQuote(mint, "USD", "mainnet");
    assertFreshQuote(quote, ctx.cfg.QUOTE_MAX_AGE_SECONDS);
    await persistQuote(ctx.db, quote);
    ctx.session.pendingOrderId = randomUUID();
    ctx.session.pendingSide = "BUY";
    ctx.session.pendingAmount = toNumericString(amount);
    ctx.session.awaiting = undefined;
    await ctx.reply(
      `<b>Confirm PRACTICE buy</b>\nSpend  ${formatUsd(amount)}\nMark  ${quote.price} USD\nSource  ${quote.provider} · ${quote.sourceTimestamp}\nModeled fee  ${ctx.cfg.PRACTICE_FEE_BPS} bps · slippage ${ctx.cfg.PRACTICE_SLIPPAGE_BPS} bps\n\nPRACTICE / SIMULATED`,
      { parse_mode: "HTML", reply_markup: confirmOrder("buy", "x") },
    );
  } catch (error) {
    logger.warn({ err: error }, "buy preview failed");
    await ctx.reply(
      error instanceof Error
        ? error.message
        : "Could not fetch a fresh quote. Order cancelled.",
    );
  }
}

export async function confirmBuy(ctx: AppContext) {
  const mint = ctx.session.mint;
  const amount = ctx.session.pendingAmount;
  const key = ctx.session.pendingOrderId;
  if (!mint || !amount || !key) {
    await ctx.reply("Nothing to confirm.");
    return;
  }
  try {
    const quote = await ctx.market.getQuote(mint, "USD", "mainnet");
    assertFreshQuote(quote, ctx.cfg.QUOTE_MAX_AGE_SECONDS);
    const result = await executeBuy(ctx.db, {
      userId: ctx.viewer.userId,
      mint,
      cluster: "mainnet",
      quoteAmount: amount,
      quote,
      assumptions: assumptions(ctx),
      idempotencyKey: `buy:${key}`,
    });
    ctx.session.pendingOrderId = undefined;
    ctx.session.pendingAmount = undefined;
    await ctx.reply(
      receipt({
        side: "BUY",
        ticker: mint.slice(0, 6),
        qty: String(result.event?.quantity ?? ""),
        price: String(result.event?.executionPrice ?? quote.price),
        value: amount,
        fees: String(result.event?.fees ?? "0"),
        provider: quote.provider,
        timestamp: quote.sourceTimestamp,
      }),
      { parse_mode: "HTML", reply_markup: mainMenu() },
    );
  } catch (error) {
    if (error instanceof LedgerError) {
      await ctx.reply(error.message);
      return;
    }
    logger.error({ err: error }, "buy failed");
    await ctx.reply("Practice buy failed. No duplicate fill was applied.");
  }
}

export async function startSell(ctx: AppContext, posShort: string) {
  const position = await getPositionByShortId(ctx.db, ctx.viewer.userId, posShort);
  if (!position || position.status !== "OPEN") {
    await ctx.reply("No open position.");
    return;
  }
  ctx.session.positionShortId = posShort;
  ctx.session.mint = position.mintAddress;
  ctx.session.pendingSide = "SELL";
  ctx.session.workflow = WORKFLOW.PRACTICE_ORDER;
  await ctx.reply("Close what percent of this practice position?", {
    reply_markup: sellPercent(posShort),
  });
}

export async function previewSell(ctx: AppContext, posShort: string, pct: string) {
  const position = await getPositionByShortId(ctx.db, ctx.viewer.userId, posShort);
  if (!position) {
    await ctx.reply("Position not found.");
    return;
  }
  try {
    const quote = await ctx.market.getQuote(position.mintAddress, "USD", "mainnet");
    assertFreshQuote(quote, ctx.cfg.QUOTE_MAX_AGE_SECONDS);
    await persistQuote(ctx.db, quote);
    ctx.session.pendingOrderId = randomUUID();
    ctx.session.pendingPercent = pct;
    ctx.session.positionShortId = posShort;
    await ctx.reply(
      `<b>Confirm PRACTICE sell</b>\nClose  ${pct}%\nMark  ${quote.price} USD\nSource  ${quote.provider} · ${quote.sourceTimestamp}\n\nPRACTICE / SIMULATED`,
      { parse_mode: "HTML", reply_markup: confirmOrder("sell", posShort) },
    );
  } catch (error) {
    await ctx.reply(
      error instanceof Error ? error.message : "Fresh quote unavailable. Sell cancelled.",
    );
  }
}

export async function confirmSell(ctx: AppContext, posShort: string) {
  const key = ctx.session.pendingOrderId;
  const pct = ctx.session.pendingPercent;
  if (!key || !pct) {
    await ctx.reply("Nothing to confirm.");
    return;
  }
  const position = await getPositionByShortId(ctx.db, ctx.viewer.userId, posShort);
  if (!position) {
    await ctx.reply("Position not found.");
    return;
  }
  try {
    const quote = await ctx.market.getQuote(position.mintAddress, "USD", "mainnet");
    assertFreshQuote(quote, ctx.cfg.QUOTE_MAX_AGE_SECONDS);
    const result = await executeSell(ctx.db, {
      userId: ctx.viewer.userId,
      positionId: position.id,
      percent: pct,
      quote,
      assumptions: assumptions(ctx),
      idempotencyKey: `sell:${key}`,
    });
    ctx.session.pendingOrderId = undefined;
    ctx.session.pendingPercent = undefined;
    await ctx.reply(
      receipt({
        side: "SELL",
        ticker: position.mintAddress.slice(0, 6),
        qty: String(result.event?.quantity ?? ""),
        price: String(result.event?.executionPrice ?? quote.price),
        value: String(result.event?.grossValue ?? ""),
        fees: String(result.event?.fees ?? "0"),
        pnl: result.model ? result.model.realizedPnl.toString() : undefined,
        provider: quote.provider,
        timestamp: quote.sourceTimestamp,
      }),
      { parse_mode: "HTML", reply_markup: mainMenu() },
    );
  } catch (error) {
    if (error instanceof LedgerError) {
      await ctx.reply(error.message);
      return;
    }
    logger.error({ err: error }, "sell failed");
    await ctx.reply("Practice sell failed. No duplicate fill was applied.");
  }
}
