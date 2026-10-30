import type { CardThemeId } from "@degenlab/shared-types";

export type ThemeTokens = {
  bg: string;
  panel: string;
  panel2: string;
  text: string;
  muted: string;
  accent: string;
  accentDim: string;
  negative: string;
  border: string;
  glow: string;
};

export const THEME_TOKENS: Record<CardThemeId, ThemeTokens> = {
  "obsidian-green": {
    bg: "#07080a",
    panel: "#101216",
    panel2: "#161a20",
    text: "#f4f7f4",
    muted: "#8b948b",
    accent: "#b8ff3d",
    accentDim: "#3d5c1a",
    negative: "#ff5c7a",
    border: "#1f2a14",
    glow: "#7cff3a",
  },
  "violet-circuit": {
    bg: "#0b0714",
    panel: "#140c22",
    panel2: "#1b1230",
    text: "#f4f0ff",
    muted: "#9b93b3",
    accent: "#c4b5fd",
    accentDim: "#4c1d95",
    negative: "#fb7185",
    border: "#2e1a4a",
    glow: "#a78bfa",
  },
  mono: {
    bg: "#0a0a0a",
    panel: "#141414",
    panel2: "#1c1c1c",
    text: "#f5f5f5",
    muted: "#a3a3a3",
    accent: "#e5e5e5",
    accentDim: "#404040",
    negative: "#f87171",
    border: "#262626",
    glow: "#d4d4d4",
  },
  "solana-gradient": {
    bg: "#0a0a12",
    panel: "#10101c",
    panel2: "#161628",
    text: "#f5fff9",
    muted: "#8f9aa8",
    accent: "#14f195",
    accentDim: "#9945ff",
    negative: "#ff6b8a",
    border: "#1c2438",
    glow: "#14f195",
  },
};

export function layoutSize(layout: "compact" | "wide" | "portrait"): {
  width: number;
  height: number;
} {
  if (layout === "portrait") return { width: 1080, height: 1350 };
  if (layout === "wide") return { width: 1200, height: 675 };
  return { width: 1080, height: 1080 };
}
