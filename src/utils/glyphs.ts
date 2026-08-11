import type { DrawShape } from "../chess";
import type { MoveGlyph } from "../utils/winningChances";

const GLYPH_COLORS: Record<string, { fill: string; symbol: string }> = {
  "?!": { fill: "#56b4e9", symbol: "?!" },
  "?": { fill: "#e69f00", symbol: "?" },
  "??": { fill: "#df5353", symbol: "??" },
  "!": { fill: "#22ac38", symbol: "!" },
  "!!": { fill: "#168226", symbol: "!!" },
  "!?": { fill: "#ea45d8", symbol: "!?" },
};

function cornerGlyphSvg(glyph: MoveGlyph): string {
  const def = GLYPH_COLORS[glyph.symbol];
  if (!def) return "";
  return `<g transform="translate(62,-2) scale(0.45)"><circle cx="50" cy="50" r="50" fill="${def.fill}"/><text x="50" y="56" text-anchor="middle" fill="#fff" font-size="60" font-weight="bold" font-family="sans-serif">${def.symbol.replace("??", "??").replace("?!", "?!")}</text></g>`;
}

export function annotationShapes(
  destSquare: string | undefined,
  glyph: MoveGlyph | null,
): DrawShape[] {
  if (!destSquare || !glyph) return [];
  const svg = cornerGlyphSvg(glyph);
  if (!svg) return [];
  return [
    {
      orig: destSquare as DrawShape["orig"],
      brush: "",
      customSvg: { html: svg },
    },
  ];
}
