// ============================================================================
// Board highlight colors (selected square / last move / legal-move hints).
// Two built-in sets — one for light boards, one for dark boards; a theme
// picks a set by name ("light" | "dark") or defines custom colors inline.
// Resolved colors are written to <body> by each variant's themes.ts as hex
// CSS variables (--ct-selected-color / --ct-lastmove-color /
// --ct-nextmove-color) consumed by the variant stylesheets.
// ============================================================================

export interface HighlightColors {
  selected: string;
  lastMove: string;
  nextMove: string;
}

/** Theme declaration: a built-in set name or explicit custom colors. */
export type HighlightSet = "light" | "dark" | HighlightColors;

/** Built-in sets: dark marks for light boards, light marks for dark boards. */
export const HIGHLIGHT_SETS: Record<"light" | "dark", HighlightColors> = {
  light: { selected: "#14551e", lastMove: "#0d47a1", nextMove: "#14551e" },
  dark: { selected: "#66bb6a", lastMove: "#7986cb", nextMove: "#66bb6a" },
};

export function resolveHighlightColors(set: HighlightSet): HighlightColors {
  return typeof set === "string" ? HIGHLIGHT_SETS[set] : set;
}
