import https from "node:https";
import { Bot } from "grammy";
import { eq } from "drizzle-orm";
import { telegramUpdates, type Database } from "@degenlab/database";
import { CompositeMarketDataProvider } from "@degenlab/market-data";
import type { SessionState } from "@degenlab/shared-types";
import { extractMintCandidate } from "@degenlab/solana-adapter";
import type { Config } from "./config.js";
import type { AppContext } from "./context.js";
import { parseCallback } from "./callbacks.js";
import { applyCaption, applyName, applyProfitText, clearProfit, editCard, newCardFromPosition, previewCard, promptCaption, promptName, promptProfit, revoke, setChart, setLayout, setTheme, share, showCards, showChartPicker, showLayoutPicker, showThemePicker } from "./handlers/cards.js";
import { handleMintText, promptBuy, promptLookup, runLookup } from "./handlers/lookup.js";
import { confirmBuy, confirmSell, previewBuy, previewSell, startBuyPercent, startSell } from "./handlers/orders.js";
import { showPortfolio, showPosition, showPositions } from "./handlers/portfolio.js";
import { askReset, doReset, setLeaderboard, showHelp, showLeaderboard, showSettings, showStart } from "./handlers/settings.js";
import { mainMenu } from "./keyboards/index.js";
import { logger } from "./logger.js";
import { allow } from "./middleware/rateLimit.js";
import { loadOrCreateUser } from "./services/users.js";
import { loadSession, saveSession } from "./services/sessions.js";

export function createBot(
  cfg: Config,
  db: Database,
  market: CompositeMarketDataProvider,
) {
  const agent = new https.Agent({ family: 4, keepAlive: true });
  const bot = new Bot<AppContext>(cfg.BOT_TOKEN, {
    client: {
      baseFetchConfig: { agent, compress: true },
    },
  });

  bot.use(async (ctx, next) => {
    ctx.db = db;
    ctx.cfg = cfg;
    ctx.market = market;
    const from = ctx.from;
    if (!from) return;
    if (!allow(`tg:${from.id}`)) {
      await ctx.reply("Slow down a bit. Practice mode still likes you.");
      return;
    }

    const updateId = BigInt(ctx.update.update_id);
    try {
      await db.insert(telegramUpdates).values({
        updateId,
        status: "received",
      });
    } catch {
      logger.info({ updateId: String(updateId) }, "duplicate telegram update skipped");
      return;
    }

    const loaded = await loadOrCreateUser(
      db,
      BigInt(from.id),
      from.username,
      [from.first_name, from.last_name].filter(Boolean).join(" ") || "degen",
      cfg.PRACTICE_STARTING_BALANCE,
    );
    ctx.viewer = {
      userId: loaded.user.id,
      telegramUserId: loaded.user.telegramUserId,
      displayName: loaded.user.displayName || from.first_name || "degen",
      username: loaded.user.telegramUsername,
      leaderboardOptIn: loaded.user.leaderboardOptIn,
      cash: String(loaded.account.availableVirtualBalance),
    };
    ctx.session = await loadSession(db, BigInt(from.id));
    try {
      await next();
      await db
        .update(telegramUpdates)
        .set({ processedAt: new Date(), status: "processed" })
        .where(eq(telegramUpdates.updateId, updateId));
    } catch (error) {
      await db
        .update(telegramUpdates)
        .set({ processedAt: new Date(), status: "error" })
        .where(eq(telegramUpdates.updateId, updateId));
      throw error;
    } finally {
      await saveSession(db, BigInt(from.id), ctx.session ?? {});
    }
  });

  bot.catch(async (err) => {
    logger.error({ err: err.error }, "bot error");
    try {
      await err.ctx.reply(
        "Something broke on that last action. Send /start again — practice mode is still on.",
      );
    } catch (replyError) {
      logger.error({ err: replyError }, "failed to send error reply");
    }
  });

  bot.command("start", showStart);
  bot.command("help", showHelp);
  bot.command("lookup", promptLookup);
  bot.command("portfolio", showPortfolio);
  bot.command("positions", showPositions);
  bot.command("cards", showCards);
  bot.command("leaderboard", showLeaderboard);
  bot.command("settings", showSettings);
  bot.command("reset", askReset);

  bot.on("callback_query:data", async (ctx) => {
    const parsed = parseCallback(ctx.callbackQuery.data);
    await ctx.answerCallbackQuery();
    if (!parsed) {
      await ctx.reply("Unknown action.");
      return;
    }
    switch (parsed.kind) {
      case "menu":
        if (parsed.page === "home") return showStart(ctx);
        if (parsed.page === "lookup") return promptLookup(ctx);
        if (parsed.page === "portfolio") return showPortfolio(ctx);
        if (parsed.page === "positions") return showPositions(ctx);
        if (parsed.page === "cards") return showCards(ctx);
        if (parsed.page === "leaderboard") return showLeaderboard(ctx);
        if (parsed.page === "settings") return showSettings(ctx);
        return;
      case "order":
        if (parsed.side === "buy") return promptBuy(ctx);
        if (parsed.side === "sell" && parsed.id) return startSell(ctx, parsed.id);
        return;
      case "buyamt":
        return startBuyPercent(ctx, parsed.pct);
      case "sellpct":
        return previewSell(ctx, parsed.id, parsed.pct);
      case "confirm":
        if (parsed.action === "buy") return confirmBuy(ctx);
        if (parsed.action === "sell") return confirmSell(ctx, parsed.id);
        return;
      case "pos":
        return showPosition(ctx, parsed.id);
      case "card":
        if (parsed.action === "new") return newCardFromPosition(ctx, parsed.id);
        if (parsed.action === "edit") return editCard(ctx, parsed.id);
        if (parsed.action === "prev") return previewCard(ctx, parsed.id);
        if (parsed.action === "pct") return promptProfit(ctx, parsed.id, "percent");
        if (parsed.action === "amt") return promptProfit(ctx, parsed.id, "amount");
        if (parsed.action === "clear") return clearProfit(ctx, parsed.id);
        if (parsed.action === "theme") return showThemePicker(ctx, parsed.id);
        if (parsed.action === "layout") return showLayoutPicker(ctx, parsed.id);
        if (parsed.action === "chart") return showChartPicker(ctx, parsed.id);
        if (parsed.action === "cap") return promptCaption(ctx, parsed.id);
        if (parsed.action === "name") return promptName(ctx, parsed.id);
        if (parsed.action === "share") return share(ctx, parsed.id);
        if (parsed.action === "revoke") return revoke(ctx, parsed.id);
        return;
      case "theme":
        return setTheme(ctx, parsed.id, parsed.theme);
      case "layout":
        return setLayout(ctx, parsed.id, parsed.layout);
      case "chart":
        return setChart(ctx, parsed.id, parsed.style);
      case "lb":
        return setLeaderboard(ctx, parsed.action === "on");
      case "reset":
        if (parsed.action === "ask") return askReset(ctx);
        if (parsed.action === "yes") return doReset(ctx);
        return;
      case "noop":
        return;
    }
  });

  bot.on("message:text", async (ctx) => {
    const text = ctx.message.text.trim();
    const awaiting = ctx.session.awaiting;
    if (awaiting === "mint") return handleMintText(ctx, text);
    if (awaiting === "buy_amount") return previewBuy(ctx, text);
    if (awaiting === "pnl_percent" || awaiting === "pnl_amount") {
      return applyProfitText(ctx, text);
    }
    if (awaiting === "caption") return applyCaption(ctx, text);
    if (awaiting === "display_name") return applyName(ctx, text);
    const mint = extractMintCandidate(text);
    if (mint) return runLookup(ctx, mint);
    await ctx.reply("Use the menu or paste a Solana mint address.", {
      reply_markup: mainMenu(),
    });
  });

  return bot;
}

export type { SessionState };
