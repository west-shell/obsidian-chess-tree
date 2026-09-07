import type { ISettings } from "./types";
import { applyThemeCSSVars, type ThemeData } from "./chess";
import type { App } from "obsidian";

// Highlight color presets — the suffix names the board it suits:
// *_light for light boards (dark marks), *_dark for dark boards (light marks).
const selected_light = "#14551e";
const selected_dark = "#66bb6a";
const lastMove_light = "#9bc700";
const lastMove_dark = "#7986cb";
const nextMove_light = "#14551e";
const nextMove_dark = "#66bb6a";

const themes: Record<
  string,
  ThemeData & {
    white: string;
    black: string;
    /** Highlight colors: a preset constant or a custom value. */
    selected: string;
    lastMove: string;
    nextMove: string;
  }
> = {
  wood: {
    name: "Wood",
    nameZh: "木色",
    bg: "#f0d9b5",
    grid: "none",
    white: "#fff",
    black: "#7e593a",
    selected: selected_light,
    lastMove: lastMove_light,
    nextMove: nextMove_light,
  },
  green: {
    name: "Green",
    nameZh: "绿色",
    bg: "#769656",
    grid: "none",
    white: "#eee",
    black: "#425232",
    selected: "#0d47a1",
    lastMove: lastMove_light,
    nextMove: "#0d47a1",
  },
  blue: {
    name: "Blue",
    nameZh: "蓝色",
    bg: "#6a9fb5",
    grid: "none",
    white: "#f5f5f5",
    black: "#3a6b8c",
    selected: selected_light,
    lastMove: lastMove_light,
    nextMove: nextMove_light,
  },
  grey: {
    name: "Grey",
    nameZh: "灰色",
    bg: "#a0a0a0",
    grid: "none",
    white: "#e0e0e0",
    black: "#505050",
    selected: selected_light,
    lastMove: lastMove_light,
    nextMove: nextMove_light,
  },
  dark: {
    name: "Dark",
    nameZh: "暗色",
    bg: "#2d2d2d",
    grid: "none",
    white: "#c8c8c8",
    black: "#3a3a3a",
    selected: selected_dark,
    lastMove: lastMove_dark,
    nextMove: nextMove_dark,
  },
  light: {
    name: "Light",
    nameZh: "亮色",
    bg: "#e0d8cf",
    grid: "none",
    white: "#fafafa",
    black: "#7e6545",
    selected: selected_light,
    lastMove: lastMove_light,
    nextMove: nextMove_light,
  },
};

export type ThemeName = keyof typeof themes;
export const THEME_KEYS = Object.keys(themes);

export function getThemeDisplayName(key: string, lang: string): string {
  const def = themes[key];
  if (!def) return key;
  return lang === "zh" ? def.nameZh : def.name;
}

export function applyThemes(settings: ISettings, _app?: App) {
  const t = themes[settings.theme] ?? themes.wood;
  applyThemeCSSVars(settings, t, _app);
  const body = activeDocument.body.style;
  body.setProperty("--ct-piece-primary", t.white);
  body.setProperty("--ct-piece-secondary", t.black);
  body.setProperty("--ct-selected-color", t.selected);
  body.setProperty("--ct-lastmove-color", t.lastMove);
  body.setProperty("--ct-nextmove-color", t.nextMove);
}
