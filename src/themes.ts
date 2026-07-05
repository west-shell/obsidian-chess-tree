import type { ISettings } from "./types";

const themes: Record<string, { bg: string; white: string; black: string }> = {
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
  const {
    theme,
    cellSize,
    boardMarginTop,
    boardMarginBottom,
    showCoordinateLabels,
  } = settings;
  const t = themes[theme] ?? themes.wood;

  activeDocument.body.style.setProperty("--chess-cell-size", `${cellSize}px`);
  activeDocument.body.style.setProperty(
    "--chess-font-size",
    `${settings.fontSize}px`,
  );
  activeDocument.body.style.setProperty("--chess-board-bg", t.bg);
  activeDocument.body.style.setProperty("--chess-piece-white", t.white);
  activeDocument.body.style.setProperty("--chess-piece-black", t.black);
  activeDocument.body.style.setProperty(
    "--chess-board-margin-top",
    `${boardMarginTop}px`,
  );
  activeDocument.body.style.setProperty(
    "--chess-board-margin-bottom",
    `${boardMarginBottom}px`,
  );
  activeDocument.body.style.setProperty(
    "--chess-coords-display",
    showCoordinateLabels ? "flex" : "none",
  );
}
