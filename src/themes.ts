import type { ISettings } from "./types";

const themes: Record<string, { name: string; bg: string; white: string; black: string }> = {
	wood:   { name: "Wood",   bg: "#f0d9b5", white: "#fff", black: "#b58863" },
	green:  { name: "Green",  bg: "#769656", white: "#eee", black: "#425232" },
	blue:   { name: "Blue",   bg: "#6a9fb5", white: "#f5f5f5", black: "#3a6b8c" },
	grey:   { name: "Grey",   bg: "#a0a0a0", white: "#e0e0e0", black: "#505050" },
	dark:   { name: "Dark",   bg: "#2d2d2d", white: "#c8c8c8", black: "#3a3a3a" },
	light:  { name: "Light",  bg: "#e0d8cf", white: "#fafafa", black: "#8b7355" },
};

export const THEME_OPTIONS = Object.fromEntries(
	Object.entries(themes).map(([k, v]) => [k, v.name]),
) as Record<string, string>;

export function applyThemes(settings: ISettings) {
	const { theme, boardMarginTop, boardMarginBottom, showCoordinateLabels } = settings;
	const t = themes[theme] ?? themes.wood;

	let styleEl = document.getElementById("chess-theme-style");
	if (!styleEl) {
		styleEl = document.createElement("style");
		styleEl.id = "chess-theme-style";
		document.head.appendChild(styleEl);
	}
	styleEl.textContent = `cg-board { background-color: ${t.bg}; }`;

	document.body.style.setProperty("--xq-piece-red", t.white);
	document.body.style.setProperty("--xq-piece-black", t.black);
	document.body.style.setProperty("--board-margin-top", `${boardMarginTop}px`);
	document.body.style.setProperty("--board-margin-bottom", `${boardMarginBottom}px`);
	document.body.style.setProperty(
		"--xq-coords-display",
		showCoordinateLabels ? "flex" : "none",
	);
}
