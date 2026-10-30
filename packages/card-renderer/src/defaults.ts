import type { CardThemeJson } from "@degenlab/shared-types";

export function defaultTheme(displayName: string): CardThemeJson {
  return {
    theme: "obsidian-green",
    layout: "portrait",
    chartStyle: "area",
    accentColor: null,
    background: "plain",
    displayName,
    caption: "",
    showQuantity: true,
    showHoldingTime: true,
    showMint: true,
    avatarDataUri: null,
  };
}
