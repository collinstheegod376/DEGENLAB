import { InlineKeyboard } from "grammy";
import { WORKFLOW } from "@degenlab/shared-types";
import { assertFreshQuote, MarketDataError } from "@degenlab/market-data";
import {
  extractMintCandidate,
  looksLikeMint,
  readOnchainTokenFacts,
  validateMintAddress,
} from "@degenlab/solana-adapter";
import { getOpenPositionForMint } from "@degenlab/ledger";
import { persistQuote, upsertWatchedToken } from "../services/tokens.js";
import { tokenReport } from "../copy.js";
import { buyAmount, tokenActions } from "../keyboards/index.js";
import type { AppContext } from "../context.js";
import { logger } from "../logger.js";

const LOOKUP_WAIT = "Looking up that mint on Mainnet…";

export async function promptLookup(ctx: AppContext) {
  ctx.session.workflow = WORKFLOW.TOKEN_LOOKUP;
  ctx.session.awaiting = "mint";
  await ctx.reply(
    "Paste a <b>Solana Mainnet</b> token mint address (CA).\n\nPump.fun, DexScreener, and Solscan links work too. Practice orders use virtual credits. This lookup is read-only market data.",
    { parse_mode: "HTML" },
  );
}

export async function handleMintText(ctx: AppContext, text: string) {
  const mint = extractMintCandidate(text);
  if (!mint) {
    await ctx.reply(
      "Paste a Solana token mint address (CA). Pump.fun and DexScreener links work too.",
    );
    return;
  }
  await runLookup(ctx, mint);
}

export async function runLookup(ctx: AppContext, mint: string) {
  ctx.session.workflow = WORKFLOW.TOKEN_LOOKUP;
  ctx.session.mint = mint;
  ctx.session.awaiting = undefined;

  const notice = await ctx.reply(LOOKUP_WAIT);
  const deliver = async (text: string, replyMarkup: InlineKeyboard) => {
    try {
      if (ctx.chat) {
        await ctx.api.editMessageText(ctx.chat.id, notice.message_id, text, {
          parse_mode: "HTML",
          reply_markup: replyMarkup,
        });
        return;
      }
    } catch (error) {
      logger.warn({ err: error }, "lookup edit failed");
    }
    await ctx.reply(text, { parse_mode: "HTML", reply_markup: replyMarkup });
  };

  try {
    const [onchainResult, metaResult, quoteResult] = await Promise.allSettled([
      readOnchainTokenFacts(
        mint,
        "mainnet",
        {
          mainnet: ctx.cfg.SOLANA_MAINNET_RPC_URL,
          devnet: ctx.cfg.SOLANA_DEVNET_RPC_URL,
        },
        5_000,
      ),
      ctx.market.getTokenMetadata(mint, "mainnet"),
      ctx.market.getQuote(mint, "USD", "mainnet"),
    ]);

    const onchain = onchainResult.status === "fulfilled" ? onchainResult.value : null;
    const meta =
      metaResult.status === "fulfilled"
        ? metaResult.value
        : {
            mint,
            cluster: "mainnet" as const,
            name: "Unknown token",
            ticker: "UNKNOWN",
            decimals: 0,
            imageUrl: null,
            provider: "none",
            sourceTimestamp: new Date().toISOString(),
            fetchedAt: new Date().toISOString(),
            status: "missing" as const,
          };
    const quote = quoteResult.status === "fulfilled" ? quoteResult.value : null;
    if (quoteResult.status === "rejected") {
      logger.warn(
        { err: quoteResult.reason, mint },
        "token quote unavailable",
      );
    }

    const name =
      (meta.name !== "Unknown token" ? meta.name : null) ||
      onchain?.name ||
      "Unknown token";
    const ticker =
      (meta.ticker !== "UNKNOWN" ? meta.ticker : null) ||
      onchain?.ticker ||
      "UNKNOWN";
    const decimals = onchain?.decimals || meta.decimals;

    await upsertWatchedToken(
      ctx.db,
      { ...meta, name, ticker, decimals },
      decimals,
    );
    if (quote) await persistQuote(ctx.db, quote);

    const open = await getOpenPositionForMint(
      ctx.db,
      ctx.viewer.userId,
      mint,
      "mainnet",
    );
    const mintAccount = onchain
      ? onchain.exists
        ? "found"
        : "missing"
      : "unverified";
    const tradable = Boolean(quote);

    await deliver(
      tokenReport({
        name,
        ticker,
        mint,
        price: quote?.price ?? null,
        liquidity: quote?.liquidity ?? null,
        volume24h: quote?.volume24h ?? null,
        provider: quote?.provider ?? meta.provider,
        timestamp: quote?.sourceTimestamp ?? meta.sourceTimestamp,
        status: quote?.status ?? "missing",
        confidence: quote?.confidence ?? "low",
        mintAccount,
        tradable,
      }),
      tokenActions(open?.shortId ?? null, tradable),
    );
  } catch (error) {
    logger.warn({ err: error, mint }, "token lookup failed");
    const message =
      error instanceof MarketDataError || error instanceof Error
        ? error.message
        : "Market data is unavailable for that mint.";
    await deliver(
      `${message}\n\nNo quote was invented. Try another mint or wait for the provider to recover.`,
      tokenActions(null, false),
    );
  }
}

export async function promptBuy(ctx: AppContext) {
  if (!ctx.session.mint) {
    await promptLookup(ctx);
    return;
  }
  ctx.session.workflow = WORKFLOW.PRACTICE_ORDER;
  ctx.session.pendingSide = "BUY";
  await ctx.reply(
    `Practice buy with virtual USD.\nAvailable  <b>${ctx.viewer.cash}</b>\n\nChoose a percent of cash or enter a custom amount.`,
    { parse_mode: "HTML", reply_markup: buyAmount() },
  );
}

export { looksLikeMint, extractMintCandidate, validateMintAddress, assertFreshQuote };
