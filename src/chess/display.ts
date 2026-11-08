import type { Move } from "@weshell/chess.js";
import { CLS_PREFIX } from "./constants";
import { getMoveNotation } from "./notation";

// ========== Node Display Functions ==========
export type NodeDisplay =
  { type: "icon"; value: string } | { type: "char"; value: string } | null;

const PIECE_ICONS: Record<string, string> = {
  k: "chess_king",
  q: "chess_queen",
  r: "chess_rook",
  b: "chess_bishop",
  n: "chess_knight",
  p: "chess_pawn",
};

export function getNodeLabel(
  move: Move | null,
  mode: number,
  notationType?: string,
): string {
  if (!move) return "start";
  if (mode === 1) return getMoveNotation(move, notationType);
  return "";
}

export function getNodeDisplay(move: Move): NodeDisplay {
  if (
    (
      move as unknown as { isKingsideCastle?: () => boolean }
    ).isKingsideCastle?.() ||
    (
      move as unknown as { isQueensideCastle?: () => boolean }
    ).isQueensideCastle?.()
  ) {
    return { type: "icon", value: "castle" };
  }
  if (move.promotion) return { type: "icon", value: "chevrons_up" };
  const icon = PIECE_ICONS[move.piece];
  return icon ? { type: "icon", value: icon } : null;
}

export function getNodeWidth(
  move: Move | null,
  mode: number,
  measureFn?: (text: string, fontSize: string) => number,
  notationType?: string,
): number {
  if (mode === 0) return 13;
  const notation = move ? getMoveNotation(move, notationType) : "start";
  if (measureFn) {
    return Math.max(13, Math.ceil(measureFn(notation, "6px")) + 4);
  }
  return Math.max(13, notation.length * 5.5);
}

export function getNodeFill(color: string | null): string {
  // Use the theme's piece colors (same as the FEN-edit palette buttons):
  // white side -> --{prefix}-piece-white, black side -> --{prefix}-piece-black.
  if (color === "white") return `var(--${CLS_PREFIX}-piece-white)`;
  if (color === "black") return `var(--${CLS_PREFIX}-piece-black)`;
  return "green";
}

export function getNodeTextColor(color: string | null): string {
  return color === "white" ? "#333" : "#fff";
}

export function getMoveListSideClass(color: string | null): string {
  if (color === "white" || color === "red") {
    return `${CLS_PREFIX}-moves__move--white`;
  }
  return `${CLS_PREFIX}-moves__move--black`;
}

export function getStartLabel(): string {
  return "=start=";
}
