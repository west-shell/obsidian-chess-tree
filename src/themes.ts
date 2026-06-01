import type { ISettings } from "./types";

interface ThemeDef {
	name: string;
	bg: string;
	texture: string;
	grid: "dark" | "light";
	white: string;
	black: string;
}

const themes: Record<string, ThemeDef> = {
	wood: {
		name: "Wood",
		bg: "#CBA35C",
		texture: "repeating-linear-gradient(87deg, rgba(139,90,43,0.25) 0px, rgba(139,90,43,0.25) 2px, transparent 2px, transparent 6px)",
		grid: "dark",
		white: "#FFFFFF",
		black: "#000000",
	},
	parchment: {
		name: "Parchment",
		bg: "#d0b899b4",
		texture: "radial-gradient(ellipse at 40% 30%, rgba(180,170,150,0.3) 0%, transparent 70%)",
		grid: "dark",
		white: "#FFFFFF",
		black: "#000000",
	},
	green: {
		name: "Green",
		bg: "#2d5a27",
		texture: "repeating-linear-gradient(0deg, rgba(255,255,255,0.04) 0px, rgba(255,255,255,0.04) 1px, transparent 1px, transparent 3px)",
		grid: "light",
		white: "#FFFFFF",
		black: "#000000",
	},
	light: {
		name: "Light",
		bg: "#c8c0b8",
		texture: "none",
		grid: "dark",
		white: "#FFFFFF",
		black: "#000000",
	},
	dark: {
		name: "Dark",
		bg: "#2d2d2d",
		texture: "none",
		grid: "light",
		white: "#FFFFFF",
		black: "#000000",
	},
	auto: {
		name: "Auto",
		bg: "var(--background-primary-alt)",
		texture: "none",
		grid: "dark",
		white: "var(--chess-auto-white)",
		black: "var(--chess-auto-black)",
	},
};

export const THEME_OPTIONS = Object.fromEntries(
	Object.entries(themes).map(([k, v]) => [k, v.name]),
) as Record<string, string>;

export function applyThemes(settings: ISettings) {
	const { theme, boardMarginTop, boardMarginBottom, showCoordinateLabels } = settings;
	const t = themes[theme] ?? themes.light;

	document.body.style.setProperty("--xq-board-bg", t.bg);
	document.body.style.setProperty("--xq-board-texture", t.texture);
	document.body.style.setProperty(
		"--xq-grid",
		t.grid === "dark" ? "var(--xq-grid-dark)" : "var(--xq-grid-light)",
	);
	document.body.style.setProperty(
		"--xq-coords-display",
		showCoordinateLabels ? "flex" : "none",
	);
	document.body.style.setProperty("--xq-piece-red", t.white);
	document.body.style.setProperty("--xq-piece-black", t.black);
	document.body.style.setProperty("--board-margin-top", `${boardMarginTop}px`);
	document.body.style.setProperty("--board-margin-bottom", `${boardMarginBottom}px`);
}
