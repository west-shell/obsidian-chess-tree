// ========== Theme CSS Vars ==========
export interface ThemeData {
  name: string;
  nameZh: string;
  bg: string;
  texture?: string;
  grid?: "dark" | "light" | "none";
  bgImage?: { path: string; base64: string };
}

// Obsidian's FileSystemAdapter.getResourcePath() falls back to Date.now()
// when the file is absent from its index, so every call returns a DIFFERENT
// url. Rewriting --ct-board-bg-image with it on every saveSettings() makes
// the browser treat the board texture as a brand-new resource: the painted
// layer is dropped and re-fetched/re-decoded, flashing the dark fallback
// (#333) for a frame — the "board dims" glitch on image themes. Cache the
// first url per path; the app:// handler serves the current file regardless
// of the query suffix, so a cached url stays valid for the session.
const resourcePathCache = new Map<string, string>();

export function applyThemeCSSVars(
  settings: {
    zoom: number;
    fontSize: number;
    boardMarginTop: number;
    boardMarginBottom: number;
    showCoordinateLabels: boolean;
  },
  themeData: ThemeData,
  app?: {
    vault: {
      adapter: { getResourcePath: (p: string) => string };
      configDir: string;
    };
  },
): void {
  const boardScale = (settings.zoom / 100) * 0.75 + 0.25;
  const body = activeDocument.body.style;
  body.setProperty("--ct-board-scale", `${boardScale}`);
  body.setProperty("--ct-font-size", `${settings.fontSize}px`);

  let bg = themeData.bg;
  if (app && /\.(png|jpe?g|gif|webp|svg|bmp)$/i.test(bg)) {
    const resPath = app.vault.configDir + "/" + bg;
    let url = resourcePathCache.get(resPath);
    if (!url) {
      url = app.vault.adapter.getResourcePath(resPath);
      resourcePathCache.set(resPath, url);
    }
    body.setProperty("--ct-board-bg-image", `url('${url}')`);
    body.setProperty("--ct-board-bg", "#333");
  } else {
    body.setProperty("--ct-board-bg", bg);
    body.removeProperty("--ct-board-bg-image");
  }

  if (themeData.texture) {
    body.setProperty("--ct-board-texture", themeData.texture);
  } else {
    body.removeProperty("--ct-board-texture");
  }
  body.setProperty("--ct-board-margin-top", `${settings.boardMarginTop}px`);
  body.setProperty(
    "--ct-board-margin-bottom",
    `${settings.boardMarginBottom}px`,
  );
  body.setProperty(
    "--ct-coords-display",
    settings.showCoordinateLabels ? "flex" : "none",
  );
}
