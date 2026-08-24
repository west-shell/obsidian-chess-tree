// ========== Library Re-exports ==========
export { Chessground } from "chessground";
export type { Api } from "chessground/api";
export type { Config } from "chessground/config";
export type { DrawShape } from "chessground/draw";
export type * as cg from "chessground/types";
export {
  Chess,
  validateFen,
  type Piece,
  type Color,
  type Move,
  type PieceSymbol,
  type Square,
} from "chess.js";

import type { Move, Piece, Square } from "chess.js";

// ========== Constants ==========
export const DEFAULT_FEN =
  "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
export const EMPTY_FEN = "4k3/8/8/8/8/8/8/4K3 w - - 0 1";
export const LAYOUT_CLASS = "chess-layout";
export const LAYOUT_CLASS_GENFEN = "chess-layout--genfen";
export const WRAP_CLASS = "cg-wrap";
export const BOARD_ELEMENT = "cg-board";
export const LAYOUT_CHANGE_EVENT = "chess-layout-change";
export const ZOOM_CHANGE_EVENT = "chess-zoom-changed";
export const RESIZE_EVENT = "chessground.resize";
export const DEFAULT_TREE_BLOCK_NAMES = ["chess", "tree"];
export const DEFAULT_FEN_BLOCK_NAMES = ["fen"];
export const RIBBON_ICON = "chess-knight";
export const DEFAULT_FILENAME = "Untitled";
export const GRID_SVG: string | null = null;
export const TREE_LAYOUT_SPACING = 0.3;
export const TREE_SPACING_X = 18;
export const NODE_CHAR_DY = 3.5;
export const DEFAULT_LANG = "en";

// ========== Flags ==========
export const HAS_PROMOTION = true;
export const PRIMARY_PLAYER_KEY = "White";

// ========== Move Functions ==========
export function getMoveNotation(move: Move): string {
  return move.san;
}

export function getSaveNotation(move: Move): string {
  return move.san;
}

export function isMoveCheckmate(move: Move): boolean {
  return move.san?.endsWith("#") ?? false;
}

export function isMoveCheck(move: Move): boolean {
  return /\+|#/.test(move.san ?? "");
}

export function getMoveDest(move: Move): Square | undefined {
  if (move.san?.startsWith("O-O")) {
    return move.color === "w"
      ? move.san.startsWith("O-O-O")
        ? "c1"
        : "g1"
      : move.san.startsWith("O-O-O")
        ? "c8"
        : "g8";
  }
  return move.to;
}

export function matchMove(existing: Move, incoming: Move): boolean {
  return (
    existing.from === incoming.from &&
    existing.to === incoming.to &&
    existing.promotion === incoming.promotion
  );
}

export function isPromotionRank(to: string, color: "w" | "b"): boolean {
  return (color === "w" && to[1] === "8") || (color === "b" && to[1] === "1");
}

export const PROMOTION_PIECES:
  | {
      type: "q" | "r" | "b" | "n";
      icon: string;
    }[]
  | null = [
  { type: "q", icon: "chess_queen" },
  { type: "r", icon: "chess_rook" },
  { type: "b", icon: "chess_bishop" },
  { type: "n", icon: "chess_knight" },
];

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

export function getNodeLabel(move: Move | null, mode: number): string {
  if (!move) return "= Start =";
  if (mode === 1) return move.san;
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
): number {
  if (mode === 0) return 13;
  const notation = move ? move.san : "= Start =";
  if (measureFn) {
    return Math.max(13, Math.ceil(measureFn(notation, "6px")) + 4);
  }
  return Math.max(13, notation.length * 5.5);
}

export function getNodeFill(side: string | null): string {
  if (side === "white") return "#fff";
  if (side === "black") return "#333";
  return "green";
}

export function getNodeTextColor(side: string | null): string {
  return side === "white" ? "#333" : "#fff";
}

export function getMoveListSideClass(side: string | null): string {
  if (side === "white" || side === "red") return "white";
  return "black";
}

export function getStartLabel(): string {
  return "= Start =";
}

// ========== FEN Build Functions ==========
export function buildDefaultEditFen(boardPart: string): string {
  return `${boardPart} w KQkq - 0 1`;
}

// ========== Token/Parser Functions ==========
export const MOVE_REGEX =
  /^(O-O(?:-O)?[+#]?|[KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](?:=[QRBN])?[+#]?)\b/;

export const FEN_REGEX =
  /^[rnbqkpRNBQKP1-8]+(\/[rnbqkpRNBQKP1-8]+){7}(\s+[wb]\s+(?:K?Q?k?q?|-)\s+(?:-|[a-h][3-6])\s+\d+\s+\d+)?/;

export type MoveTokenType = "san-move";

export function getMoveTokenType(_value: string): MoveTokenType {
  return "san-move";
}

export const PRIMARY_MOVE_TOKEN_TYPES: ReadonlyArray<MoveTokenType> = [
  "san-move",
];

import type { Chess as ChessClass } from "chess.js";

export function parseMoveInGame(
  chess: InstanceType<typeof ChessClass>,
  token: string,
  _tokenType: MoveTokenType,
): Move | null {
  return chess.move(token) ?? null;
}

export const SHAPE_SQUARE_REGEX = /[a-h][1-8]/;
export const SHAPE_PART_REGEX = /^([a-h][1-8])([a-h][1-8])?:([gryb])$/;
export const EVAL_REGEX =
  /^%e:([^,}]+)(?:,([a-h][1-8][a-h][1-8][qrbn]?))?(?:,([a-h][1-8][a-h][1-8][qrbn]?))?(?:,(!\?|\?!|\?\?|[?!]|!!))?$/;

export function getTurnFromFen(fen: string): "white" | "black" {
  return fen.split(" ")[1] === "b" ? "black" : "white";
}

// ========== Theme CSS Vars ==========
export interface ThemeData {
  bg: string;
  white: string;
  black: string;
  texture?: string;
  grid?: "dark" | "light" | "none";
}

export function applyThemeCSSVars(
  settings: {
    zoom: number;
    fontSize: number;
    boardMarginTop: number;
    boardMarginBottom: number;
    showCoordinateLabels: boolean;
  },
  themeData: ThemeData,
): void {
  const boardScale = (settings.zoom / 100) * 0.75 + 0.25;
  const body = activeDocument.body.style;
  body.setProperty("--chess-board-scale", `${boardScale}`);
  body.setProperty("--chess-font-size", `${settings.fontSize}px`);
  body.setProperty("--chess-board-bg", themeData.bg);
  body.setProperty("--chess-piece-white", themeData.white);
  body.setProperty("--chess-piece-black", themeData.black);
  body.setProperty("--chess-board-margin-top", `${settings.boardMarginTop}px`);
  body.setProperty(
    "--chess-board-margin-bottom",
    `${settings.boardMarginBottom}px`,
  );
  body.setProperty(
    "--chess-coords-display",
    settings.showCoordinateLabels ? "flex" : "none",
  );
  if (themeData.texture) {
    body.setProperty("--chess-board-texture", themeData.texture);
  }
  if (themeData.grid) {
    body.setProperty(
      "--chess-grid-color",
      themeData.grid === "dark"
        ? "#555"
        : themeData.grid === "light"
          ? "#ccc"
          : "transparent",
    );
  }
}

// ========== Other ==========
export function parseExternalUrl(_source: string): string | null {
  return null;
}

export function createPieceFromChar(_char: string): Piece | null {
  return null;
}

export function registerCustomIcon(_app: unknown): void {}
