import { InlineKeyboard } from "grammy";
import { pack } from "../callbacks.js";

export function mainMenu() {
  return new InlineKeyboard()
    .text("Paste Token CA", pack("menu", "lookup"))
    .text("Portfolio", pack("menu", "portfolio"))
    .row()
    .text("Open Positions", pack("menu", "positions"))
    .text("PnL Cards", pack("menu", "cards"))
    .row()
    .text("Leaderboard", pack("menu", "leaderboard"))
    .text("Settings", pack("menu", "settings"));
}

export function tokenActions(posShort: string | null, canBuy = true) {
  const kb = new InlineKeyboard();
  if (canBuy) kb.text("Buy (practice)", pack("order", "buy"));
  if (posShort) kb.text("Sell (practice)", pack("order", "sell", posShort));
  if (canBuy || posShort) kb.row();
  return kb.text("« Menu", pack("menu", "home"));
}

export function buyAmount() {
  return new InlineKeyboard()
    .text("10%", pack("buyamt", "x", "10"))
    .text("25%", pack("buyamt", "x", "25"))
    .text("50%", pack("buyamt", "x", "50"))
    .row()
    .text("100%", pack("buyamt", "x", "100"))
    .text("Custom USD", pack("buyamt", "x", "custom"))
    .row()
    .text("Cancel", pack("menu", "home"));
}

export function sellPercent(posShort: string) {
  return new InlineKeyboard()
    .text("25%", pack("sellpct", posShort, "25"))
    .text("50%", pack("sellpct", posShort, "50"))
    .text("75%", pack("sellpct", posShort, "75"))
    .row()
    .text("100%", pack("sellpct", posShort, "100"))
    .row()
    .text("Cancel", pack("menu", "home"));
}

export function confirmOrder(action: "buy" | "sell", id: string) {
  return new InlineKeyboard()
    .text("Confirm PRACTICE order", pack("confirm", action, id))
    .row()
    .text("Cancel", pack("menu", "home"));
}

export function positionActions(posShort: string, status: string) {
  const kb = new InlineKeyboard();
  if (status === "OPEN") kb.text("Close (practice)", pack("order", "sell", posShort));
  kb.text("PnL card", pack("card", "new", posShort))
    .row()
    .text("« Positions", pack("menu", "positions"))
    .text("Menu", pack("menu", "home"));
  return kb;
}

export function positionsList(
  rows: { shortId: string; ticker: string; status: string }[],
) {
  const kb = new InlineKeyboard();
  for (const row of rows.slice(0, 10)) {
    kb.text(
      `${row.status === "OPEN" ? "●" : "○"} ${row.ticker} · ${row.shortId}`,
      pack("pos", row.shortId),
    ).row();
  }
  kb.text("« Menu", pack("menu", "home"));
  return kb;
}

export function cardEditor(cardShort: string) {
  return new InlineKeyboard()
    .text("PnL %", pack("card", "pct", cardShort))
    .text("PnL $", pack("card", "amt", cardShort))
    .text("Clear PnL", pack("card", "clear", cardShort))
    .row()
    .text("Theme", pack("card", "theme", cardShort))
    .text("Layout", pack("card", "layout", cardShort))
    .text("Chart", pack("card", "chart", cardShort))
    .row()
    .text("Caption", pack("card", "cap", cardShort))
    .text("Name", pack("card", "name", cardShort))
    .row()
    .text("Preview", pack("card", "prev", cardShort))
    .text("Share", pack("card", "share", cardShort))
    .row()
    .text("Revoke link", pack("card", "revoke", cardShort))
    .text("« Cards", pack("menu", "cards"));
}

export function themePicker(cardShort: string) {
  return new InlineKeyboard()
    .text("Obsidian Green", pack("theme", cardShort, "og"))
    .row()
    .text("Violet Circuit", pack("theme", cardShort, "vc"))
    .row()
    .text("Mono", pack("theme", cardShort, "mo"))
    .row()
    .text("Solana Gradient", pack("theme", cardShort, "sg"))
    .row()
    .text("« Editor", pack("card", "edit", cardShort));
}

export function layoutPicker(cardShort: string) {
  return new InlineKeyboard()
    .text("Portrait", pack("layout", cardShort, "portrait"))
    .text("Wide", pack("layout", cardShort, "wide"))
    .text("Compact", pack("layout", cardShort, "compact"))
    .row()
    .text("« Editor", pack("card", "edit", cardShort));
}

export function chartPicker(cardShort: string) {
  return new InlineKeyboard()
    .text("Area", pack("chart", cardShort, "area"))
    .text("Line", pack("chart", cardShort, "line"))
    .text("Candles", pack("chart", cardShort, "candles"))
    .row()
    .text("« Editor", pack("card", "edit", cardShort));
}

export function cardsList(rows: { shortId: string; ticker: string }[]) {
  const kb = new InlineKeyboard();
  for (const row of rows.slice(0, 10)) {
    kb.text(`${row.ticker} · ${row.shortId}`, pack("card", "edit", row.shortId)).row();
  }
  kb.text("« Menu", pack("menu", "home"));
  return kb;
}

export function settingsKb(optIn: boolean) {
  return new InlineKeyboard()
    .text(
      optIn ? "Leaderboard: ON" : "Leaderboard: OFF",
      pack("lb", optIn ? "off" : "on"),
    )
    .row()
    .text("Reset practice account", pack("reset", "ask"))
    .row()
    .text("« Menu", pack("menu", "home"));
}

export function resetConfirm() {
  return new InlineKeyboard()
    .text("Yes, reset practice account", pack("reset", "yes"))
    .row()
    .text("Cancel", pack("menu", "settings"));
}

export function backHome() {
  return new InlineKeyboard().text("« Menu", pack("menu", "home"));
}
