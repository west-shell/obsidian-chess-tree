import type { ISettings } from "./types";
import { applyThemeCSSVars, type ThemeData } from "./chess";

const themes: Record<string, ThemeData> = {
  wood: { bg: "#f0d9b5", white: "#fff", black: "#b58863" },
  green: { bg: "#769656", white: "#eee", black: "#425232" },
  blue: { bg: "#6a9fb5", white: "#f5f5f5", black: "#3a6b8c" },
  grey: { bg: "#a0a0a0", white: "#e0e0e0", black: "#505050" },
  dark: { bg: "#2d2d2d", white: "#c8c8c8", black: "#3a3a3a" },
  light: { bg: "#e0d8cf", white: "#fafafa", black: "#8b7355" },
};

export type ThemeName = keyof typeof themes;
export const THEME_KEYS = Object.keys(themes);

export function applyThemes(settings: ISettings) {
  const t = themes[settings.theme] ?? themes.wood;
  applyThemeCSSVars(settings, t);
}
