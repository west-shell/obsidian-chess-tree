import type { ISettings } from "./types";
import { applyThemeCSSVars, type ThemeData } from "./chess";
import { applyPieceSet } from "./pieceSets";
import { getLang, t } from "./i18n";
import { type App, Modal } from "obsidian";
import type ChessPlugin from "./main";

import woodB64 from "../assets/wood.jpg?base64";
import newspaperB64 from "../assets/newspaper.svg?base64";

// Piece-set switching is variant-specific (excluded from the xiangqi sync);
// re-exported here so shared UI (settings tab, toolbar) gets it from the
// variant's appearance module — NOT from ./chess, which must stay free of
// obsidian imports because the parser test chain runs through it.
export { PIECE_SETS, PIECE_SET_PICKER, resolvePieceSetKey } from "./pieceSets";
export type { PieceSetDef } from "./pieceSets";

// Highlight color presets (with alpha baked in) — the suffix names the board
// it suits: *_light for light boards (dark marks), *_dark for dark boards
// (light marks).
const selected_light = "rgba(20, 85, 30, 0.5)";
const selected_dark = "rgba(102, 187, 106, 0.5)";
const lastMove_light = "rgba(155, 199, 0, 0.41)";
const lastMove_dark = "rgba(121, 134, 203, 0.41)";
const nextMove_light = "rgba(20, 85, 30, 0.5)";
const nextMove_dark = "rgba(102, 187, 106, 0.5)";

const themes: Record<
  string,
  ThemeData & {
    white: string;
    black: string;
    /** Highlight colors: a preset constant or a custom value. */
    selected: string;
    lastMove: string;
    nextMove: string;
    /** false = seamless texture board, no checker overlay (e.g. bamboo). */
    checker?: boolean;
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
  woodgrain: {
    name: "Wood Grain",
    nameZh: "木纹",
    // Vault-relative image path (under .obsidian/) — deployBoardAssets()
    // materializes it from the bundled base64 on startup.
    bg: "plugins/chess-tree/assets/wood.jpg",
    bgImage: { path: "plugins/chess-tree/assets/wood.jpg", base64: woodB64 },
    grid: "none",
    white: "#fff",
    black: "#7e593a",
    selected: selected_dark,
    lastMove: lastMove_dark,
    nextMove: nextMove_dark,
  },
  newspaper: {
    name: "Newspaper",
    nameZh: "报纸",
    // Vault-relative image path (under .obsidian/) — ensureBoardAssets()
    // materializes it from the bundled base64 on startup.
    bg: "plugins/chess-tree/assets/newspaper.svg",
    bgImage: {
      path: "plugins/chess-tree/assets/newspaper.svg",
      base64: newspaperB64,
    },
    grid: "none",
    // lila's newspaper board: the 8x8 checker, square borders and the
    // corner doodle marks are all baked into the SVG itself, so the CSS
    // checker overlay is suppressed.
    checker: false,
    white: "#f5f5f5",
    black: "#3d3d3d",
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
    selected: "rgba(13, 71, 161, 0.5)",
    lastMove: lastMove_light,
    nextMove: "rgba(13, 71, 161, 0.5)",
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

function base64ToArrayBuffer(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

async function ensureDir(
  adapter: {
    exists(p: string): Promise<boolean>;
    mkdir(p: string): Promise<void>;
  },
  dir: string,
) {
  const parts = dir.split("/").filter(Boolean);
  let cur = "";
  for (const part of parts) {
    cur = cur ? `${cur}/${part}` : part;
    if (!(await adapter.exists(cur))) {
      await adapter.mkdir(cur);
    }
  }
}

/** Materialize bundled theme background images into the vault's config dir. */
export async function ensureBoardAssets(app: App): Promise<void> {
  const adapter = app.vault.adapter;
  const configDir = app.vault.configDir;
  for (const def of Object.values(themes)) {
    const img = def.bgImage;
    if (!img) continue;
    const fullPath = `${configDir}/${img.path}`;
    try {
      if (await adapter.exists(fullPath)) continue;
      const slash = img.path.lastIndexOf("/");
      if (slash > 0) {
        await ensureDir(adapter, `${configDir}/${img.path.slice(0, slash)}`);
      }
      await adapter.writeBinary(fullPath, base64ToArrayBuffer(img.base64));
    } catch (err) {
      console.error(
        `[chess-tree] failed to write board asset: ${img.path}`,
        err,
      );
    }
  }
}

export function applyThemes(settings: ISettings, _app?: App) {
  const t = themes[settings.theme] ?? themes.wood;
  applyThemeCSSVars(settings, t, _app);
  const body = activeDocument.body.style;
  body.setProperty("--ct-piece-white", t.white);
  body.setProperty("--ct-piece-black", t.black);
  // Highlight colors already carry alpha (see presets above) and are
  // consumed as-is by the SCSS — mobile WebViews don't support
  // relative-color syntax.
  body.setProperty("--ct-selected-color", t.selected);
  body.setProperty("--ct-lastmove-color", t.lastMove);
  body.setProperty("--ct-nextmove-color", t.nextMove);
  // Seamless-texture themes (checker === false) drop the board checker
  // overlay; every other theme removes the override and falls back to the
  // checker layer declared in scss/_variant.scss.
  if (t.checker === false) {
    body.setProperty("--ct-board-checker", "none");
  } else {
    body.removeProperty("--ct-board-checker");
  }
  applyPieceSet(settings);
}

/** Board-menu picker: a modal grid of board-style swatches. */
function openBoardThemePicker(plugin: ChessPlugin): void {
  const modal = new Modal(plugin.app);
  modal.onOpen = () => {
    const { contentEl } = modal;
    contentEl.addClass("ct-board-theme-picker");

    const title = contentEl.createDiv("ct-board-theme-picker__title");
    title.setText(t("boardMenu.boardTheme"));

    const grid = contentEl.createDiv("ct-board-theme-picker__grid");
    for (const key of THEME_KEYS) {
      const def = themes[key];
      if (!def) continue;
      const active = key === plugin.settings.theme;
      const tile = grid.createEl("button", {
        cls: `ct-board-theme-picker__tile${active ? " ct-board-theme-picker__tile--active" : ""}`,
      });
      const swatch = tile.createDiv("ct-board-theme-picker__swatch");
      if (/\.(png|jpe?g|gif|webp|svg|bmp)$/i.test(def.bg)) {
        const url = plugin.app.vault.adapter.getResourcePath(
          `${plugin.app.vault.configDir}/${def.bg}`,
        );
        swatch.style.backgroundImage = `url('${url}')`;
        // Boards with the checker baked into the image (checker === false,
        // e.g. newspaper) zoom to a centered 2x2-square crop, so the swatch
        // previews chunky squares like the plain-color themes instead of a
        // shrunken full board.
        if (def.checker === false) {
          swatch.addClass("ct-board-theme-picker__swatch--baked");
        }
      } else {
        swatch.style.backgroundColor = def.bg;
      }
      // Checkered boards preview the chessground dark-square overlay
      // (20% black over the background); seamless texture themes
      // (checker === false) show the image as-is.
      if (def.checker !== false) {
        swatch.createDiv("ct-board-theme-picker__dark");
        swatch.createDiv("ct-board-theme-picker__dark");
      }
      const label = tile.createDiv("ct-board-theme-picker__name");
      label.setText(getThemeDisplayName(key, getLang()));
      tile.addEventListener("click", () => {
        plugin.settings.theme = key;
        void plugin.saveSettings();
        plugin.refresh();
        modal.close();
      });
    }
  };
  modal.onClose = () => {
    (modal as { contentEl: HTMLElement }).contentEl.empty();
  };
  modal.open();
}

/** Adapter capability consumed by the shared toolbar. */
export const BOARD_THEME_PICKER = { open: openBoardThemePicker };
