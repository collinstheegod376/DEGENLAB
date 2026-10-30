import { eq } from "drizzle-orm";
import { auditLogs, users } from "@degenlab/database";
import { leaderboardRows, resetPracticeAccount } from "@degenlab/ledger";
import { formatUsd } from "@degenlab/pnl";
import { HELP, START } from "../copy.js";
import { mainMenu, resetConfirm, settingsKb } from "../keyboards/index.js";
import type { AppContext } from "../context.js";

export async function showStart(ctx: AppContext) {
  await ctx.reply(START, { parse_mode: "HTML", reply_markup: mainMenu() });
}

export async function showHelp(ctx: AppContext) {
  await ctx.reply(HELP, { parse_mode: "HTML", reply_markup: mainMenu() });
}

export async function showSettings(ctx: AppContext) {
  await ctx.reply(
    `<b>Settings</b>\nPractice mode is always on for this bot.\nLeaderboard opt-in is currently <b>${ctx.viewer.leaderboardOptIn ? "ON" : "OFF"}</b>.\nRankings use the practice ledger only.`,
    { parse_mode: "HTML", reply_markup: settingsKb(ctx.viewer.leaderboardOptIn) },
  );
}

export async function setLeaderboard(ctx: AppContext, on: boolean) {
  await ctx.db
    .update(users)
    .set({ leaderboardOptIn: on, updatedAt: new Date() })
    .where(eq(users.id, ctx.viewer.userId));
  ctx.viewer.leaderboardOptIn = on;
  await ctx.reply(`Leaderboard opt-in is now ${on ? "ON" : "OFF"}.`, {
    reply_markup: settingsKb(on),
  });
}

export async function showLeaderboard(ctx: AppContext) {
  const rows = await leaderboardRows(ctx.db, 10);
  if (rows.length === 0) {
    await ctx.reply("No opted-in practice traders yet.", { reply_markup: mainMenu() });
    return;
  }
  const lines = rows.map((row, i) => {
    const name = row.displayName || row.telegramUsername || "trader";
    return `${i + 1}. ${name}  ·  ${formatUsd(String(row.realized))}`;
  });
  await ctx.reply(
    `<b>Practice leaderboard</b>\nRealized PnL from the ledger. Card display overrides are ignored.\n\n${lines.join("\n")}`,
    { parse_mode: "HTML", reply_markup: mainMenu() },
  );
}

export async function askReset(ctx: AppContext) {
  await ctx.reply(
    "Reset wipes open practice positions and restores starting virtual cash. Trade history stays in the ledger as closed. Continue?",
    { reply_markup: resetConfirm() },
  );
}

export async function doReset(ctx: AppContext) {
  await resetPracticeAccount(
    ctx.db,
    ctx.viewer.userId,
    ctx.cfg.PRACTICE_STARTING_BALANCE,
  );
  await ctx.db.insert(auditLogs).values({
    userId: ctx.viewer.userId,
    action: "practice_reset",
    payloadJson: { starting: ctx.cfg.PRACTICE_STARTING_BALANCE },
  });
  await ctx.reply(
    `Practice account reset. Virtual cash is ${ctx.cfg.PRACTICE_STARTING_BALANCE} USD.`,
    { reply_markup: mainMenu() },
  );
}
