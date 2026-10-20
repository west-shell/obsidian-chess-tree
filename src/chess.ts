// ========== Library Re-exports ==========
export { Chessground } from "@lichess-org/chessground";
export type { Api } from "@lichess-org/chessground/api";
export type { Config } from "@lichess-org/chessground/config";
export type { DrawShape } from "@lichess-org/chessground/draw";
export type * as cg from "@lichess-org/chessground/types";
export {
  Chess,
  validateFen,
  type Piece,
  type Color,
  type Move,
  type PieceSymbol,
  type Square,
} from "@weshell/chess.js";

import { Chess } from "@weshell/chess.js";
import type { Move, Piece, Square } from "@weshell/chess.js";
import type { ChessNode, IHost } from "./types";

// ========== Constants ==========
export const DEFAULT_FEN =
  "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
export const EMPTY_FEN = "4k3/8/8/8/8/8/8/4K3 w - - 0 1";

// ---- DOM class names (BEM) ----
// Class-name prefix (chess: "ct", xiangqi: "xq"). Every plugin class is
// `${CLS_PREFIX}-...` at the usage site; the matching scss prefix lives in
// style/layout/_variant.scss ($cls-prefix).
export const CLS_PREFIX = "ct";
// chessground's own class names — never rename, styled in style/layout/_board.scss
export const WRAP_CLASS = "cg-wrap";
export const BOARD_ELEMENT = "cg-board";

export const BOARD_ASPECT_RATIO = 1;
export const LAYOUT_CHANGE_EVENT = "chess-layout-change";
export const ZOOM_CHANGE_EVENT = "chess-zoom-changed";
export const RESIZE_EVENT = "chessground.resize";
export const DEFAULT_TREE_BLOCK_NAMES = ["chess", "tree"];
export const DEFAULT_FEN_BLOCK_NAMES = ["fen"];
export const RIBBON_ICON = "chess-knight";
export const DEFAULT_FILENAME = "Untitled";
export const PGN_PLACEHOLDER = "1. e4 e5 2. Nf3 Nc6 ...";
export const GRID_SVG: string | null = null;
export const TREE_LAYOUT_SPACING = 0.3;

/** Horizontal pixel spacing per layout x-unit, varies with node display mode. */
export function getTreeSpacingX(mode: number): number {
  return mode === 1 ? 18 : 18;
}
export const NODE_CHAR_DY = 3.5;
export const DEFAULT_LANG = "en";

// ========== Flags ==========
export const HAS_PROMOTION = true;
export const PRIMARY_PLAYER_KEY = "White";
/** Piece-color key of the first player, for player-bar side marks. */
export const FIRST_PLAYER_COLOR = "white";
/** Piece-color key of the second player, for player-bar side marks. */
export const SECOND_PLAYER_COLOR = "black";

// ========== Move Functions ==========

// Figurine notation: SAN piece letters -> figurine glyphs. Display-only
// (move list); saved PGN and speech always use plain SAN.
const FIGURINE_NOTATION: Record<string, string> = {
  K: "♔",
  Q: "♕",
  R: "♖",
  B: "♗",
  N: "♘",
};

// Notation modes offered in the move-list settings. The adapter owns this
// list so variants can define their own; each label key resolves to a
// dropdown label showing a notation example.
export interface NotationType {
  value: string;
  labelKey: string;
}

export const NOTATION_TYPES: readonly NotationType[] = [
  { value: "figurine", labelKey: "movelist.notation.figurine" },
  { value: "letter", labelKey: "movelist.notation.letter" },
];
export const DEFAULT_NOTATION_TYPE = "figurine";

export function getMoveNotation(move: Move, notationType?: string): string {
  if (notationType === "figurine") {
    return (move.san ?? "").replace(
      /[KQRBN]/g,
      (m) => FIGURINE_NOTATION[m] ?? m,
    );
  }
  return move.san;
}

export function getSaveNotation(move: Move): string {
  return move.san;
}

// Variant hook: substitutions applied to spoken notation so TTS picks the
// right reading (e.g. xiangqi's 卒→足). Chess SAN is read as-is.
export function applySpeechSubstitutions(text: string): string {
  return text;
}

export function isMoveCheckmate(move: Move): boolean {
  return move.san?.endsWith("#") ?? false;
}

export function isMoveCheck(move: Move): boolean {
  return /\+|#/.test(move.san ?? "");
}

// Result forced by the position itself — checkmate (mating side wins) or
// stalemate (draw) — or null while the game continues. The move handler
// stores it on a mating move's node and the result toolbar treats a
// non-null value as read-only.
export function getAutoResult(fen: string): string | null {
  try {
    const game = new Chess(fen);
    if (game.isCheckmate()) {
      return game.turn() === "w" ? "0-1" : "1-0";
    }
    if (game.isStalemate()) {
      return "1/2-1/2";
    }
    return null;
  } catch {
    return null;
  }
}

export function getMoveDest(move: Move): Square | undefined {
  // The patched chess.js always reports the king's destination square
  // (g1/c1) as move.to for castling, standard and Chess960 alike.
  return move.to;
}

export function matchMove(existing: Move, incoming: Move): boolean {
  return (
    existing.from === incoming.from &&
    existing.to === incoming.to &&
    existing.promotion === incoming.promotion
  );
}

export function moveToUci(move: Move): string {
  // Chess960 castling is encoded king-takes-rook (e.g. e1h1), matching
  // the UCI_Chess960 / lichess convention used by the engine protocol.
  if (move.rookFrom) {
    return move.from + move.rookFrom;
  }
  return move.from + move.to + (move.promotion ?? "");
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

// ========== FEN Build Functions ==========
export function buildDefaultEditFen(boardPart: string): string {
  return `${boardPart} w KQkq - 0 1`;
}

// ---- Chess960 (Fischer Random) ----
const CHESS960_DARK_FILES: readonly string[] = ["a", "c", "e", "g"];
const CHESS960_LIGHT_FILES: readonly string[] = ["b", "d", "f", "h"];
// Lexicographic index pairs for placing the two knights on the five
// squares left after the bishops and the queen (C(5,2) = 10 patterns).
const CHESS960_KNIGHT_PATTERNS: readonly (readonly [number, number])[] = [
  [0, 1],
  [0, 2],
  [0, 3],
  [0, 4],
  [1, 2],
  [1, 3],
  [1, 4],
  [2, 3],
  [2, 4],
  [3, 4],
];

// Shared tail of every 960 start generator: assemble the raw start FEN
// from a lowercase backrank arrangement (k/q/r/b/n, files a-h) with
// Shredder castling letters (king-side rook first; standard -> HAha),
// then re-emit through chess.js so the FEN is canonical (field order
// and castling normalization match what load/fen() produce everywhere).
function chess960StartFen(arrangement: string[]): string {
  const files = ["a", "b", "c", "d", "e", "f", "g", "h"];
  const kingIdx = arrangement.indexOf("k");
  let ksRook = -1;
  let qsRook = -1;
  for (let i = kingIdx + 1; i < 8 && ksRook === -1; i++) {
    if (arrangement[i] === "r") ksRook = i;
  }
  for (let i = kingIdx - 1; i >= 0 && qsRook === -1; i--) {
    if (arrangement[i] === "r") qsRook = i;
  }
  const backrank = arrangement.join("");
  const castling =
    files[ksRook].toUpperCase() +
    files[qsRook].toUpperCase() +
    files[ksRook] +
    files[qsRook];
  const raw = `${backrank}/pppppppp/8/8/8/8/PPPPPPPP/${backrank.toUpperCase()} w ${castling} - 0 1`;
  return new Chess(raw).fen();
}

// Generate a uniformly random Chess960 start position. Uniformity:
// dark-square bishop (4) x light-square bishop (4) x queen (6) x knight
// pair (C(5,2)=10) = 960 equally likely arrangements.
export function randomChess960Fen(): string {
  const files = ["a", "b", "c", "d", "e", "f", "g", "h"];
  const arrangement: string[] = ["", "", "", "", "", "", "", ""];
  const darkIdx = files.indexOf(
    CHESS960_DARK_FILES[Math.floor(Math.random() * 4)],
  );
  const lightIdx = files.indexOf(
    CHESS960_LIGHT_FILES[Math.floor(Math.random() * 4)],
  );
  arrangement[darkIdx] = "b";
  arrangement[lightIdx] = "b";
  const freeAfterBishops = arrangement
    .map((v, i) => (v === "" ? i : -1))
    .filter((i) => i >= 0);
  arrangement[freeAfterBishops[Math.floor(Math.random() * 6)]] = "q";
  const freeAfterQueen = arrangement
    .map((v, i) => (v === "" ? i : -1))
    .filter((i) => i >= 0);
  const n1 = Math.floor(Math.random() * 5);
  let n2 = Math.floor(Math.random() * 4);
  if (n2 >= n1) n2++;
  arrangement[freeAfterQueen[n1]] = "n";
  arrangement[freeAfterQueen[n2]] = "n";
  const rkr = arrangement
    .map((v, i) => (v === "" ? i : -1))
    .filter((i) => i >= 0);
  arrangement[rkr[0]] = "r";
  arrangement[rkr[1]] = "k";
  arrangement[rkr[2]] = "r";
  return chess960StartFen(arrangement);
}

// The Chess960 start position with the given official number
// (Scharnagl, 0-959; 518 is the standard position). Returns null for
// numbers outside the range.
export function chess960FenByNumber(spn: number): string | null {
  if (!Number.isInteger(spn) || spn < 0 || spn > 959) return null;
  const files = ["a", "b", "c", "d", "e", "f", "g", "h"];
  const arrangement: string[] = ["", "", "", "", "", "", "", ""];
  const lightIdx = files.indexOf(CHESS960_LIGHT_FILES[spn % 4]);
  const darkIdx = files.indexOf(CHESS960_DARK_FILES[Math.floor(spn / 4) % 4]);
  arrangement[darkIdx] = "b";
  arrangement[lightIdx] = "b";
  const freeAfterBishops = arrangement
    .map((v, i) => (v === "" ? i : -1))
    .filter((i) => i >= 0);
  arrangement[freeAfterBishops[Math.floor(spn / 16) % 6]] = "q";
  const freeAfterQueen = arrangement
    .map((v, i) => (v === "" ? i : -1))
    .filter((i) => i >= 0);
  const knights = CHESS960_KNIGHT_PATTERNS[Math.floor(spn / 96)];
  arrangement[freeAfterQueen[knights[0]]] = "n";
  arrangement[freeAfterQueen[knights[1]]] = "n";
  const rkr = arrangement
    .map((v, i) => (v === "" ? i : -1))
    .filter((i) => i >= 0);
  arrangement[rkr[0]] = "r";
  arrangement[rkr[1]] = "k";
  arrangement[rkr[2]] = "r";
  return chess960StartFen(arrangement);
}

function isChess960Backrank(rank: string): boolean {
  if (rank.length !== 8) return false;
  const counts: Record<string, number> = { k: 0, q: 0, r: 0, b: 0, n: 0 };
  for (const ch of rank) {
    if (counts[ch] === undefined) return false;
    counts[ch] += 1;
  }
  if (
    counts.k !== 1 ||
    counts.q !== 1 ||
    counts.r !== 2 ||
    counts.b !== 2 ||
    counts.n !== 2
  ) {
    return false;
  }
  // King strictly between the two rooks, bishops on opposite colors.
  const kingIdx = rank.indexOf("k");
  if (!(rank.indexOf("r") < kingIdx && kingIdx < rank.lastIndexOf("r"))) {
    return false;
  }
  return (rank.indexOf("b") + rank.lastIndexOf("b")) % 2 === 1;
}

// The lowercase backrank of `fen` if it shows a start shape: mirrored
// valid (standard or 960) backranks, full pawn rows, empty middle
// ranks. Null otherwise.
function chess960StartBoard(fen: string): string | null {
  try {
    const ranks = new Chess(fen).fen().split(" ")[0].split("/");
    if (ranks.length !== 8) return null;
    const white = ranks[7].toLowerCase();
    const black = ranks[0];
    if (!isChess960Backrank(white) || !isChess960Backrank(black)) {
      return null;
    }
    // Start positions are always mirrored.
    if (white !== black) return null;
    if (ranks[1] !== "pppppppp" || ranks[6] !== "PPPPPPPP") return null;
    for (let i = 2; i <= 5; i++) {
      if (ranks[i] !== "8") return null;
    }
    return white;
  } catch {
    return null;
  }
}

// Detect whether a FEN is a Chess960 start position; used to emit the
// [Variant "Chess960"] PGN header for games whose tags lack it.
export function getPgnVariantTag(fen: string): string | null {
  const backrank = chess960StartBoard(fen);
  // Standard start never needs a Variant tag.
  if (backrank === null || backrank === "rnbqkbnr") return null;
  return "Chess960";
}

// Inverse of chess960FenByNumber: the official number (0-959) of the
// Chess960 start position shown by a FEN, or null if the FEN is not a
// start position (the standard start resolves to 518).
export function chess960SpnFromFen(fen: string): number | null {
  const backrank = chess960StartBoard(fen);
  if (backrank === null) return null;
  let darkFile = -1;
  let lightFile = -1;
  const freeAfterBishops: number[] = [];
  for (let i = 0; i < 8; i++) {
    if (backrank[i] === "b") {
      if (i % 2 === 0) darkFile = i;
      else lightFile = i;
    } else {
      freeAfterBishops.push(i);
    }
  }
  const queenIdx = freeAfterBishops.findIndex((i) => backrank[i] === "q");
  if (queenIdx === -1) return null;
  const freeAfterQueen = freeAfterBishops.filter((i) => backrank[i] !== "q");
  const knightPos: number[] = [];
  for (let j = 0; j < freeAfterQueen.length; j++) {
    if (backrank[freeAfterQueen[j]] === "n") knightPos.push(j);
  }
  const knightIdx = CHESS960_KNIGHT_PATTERNS.findIndex(
    (p) => p[0] === knightPos[0] && p[1] === knightPos[1],
  );
  if (knightIdx === -1) return null;
  // N = light bishop + 4*dark bishop + 16*queen + 96*knight pattern
  const lightIdx = (lightFile - 1) / 2; // position within [b,d,f,h]
  const darkIdx = darkFile / 2; // position within [a,c,e,g]
  return lightIdx + 4 * darkIdx + 16 * queenIdx + 96 * knightIdx;
}

// ========== Token/Parser Functions ==========
export const MOVE_REGEX =
  /^(O-O(?:-O)?|[KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](?:=[QRBN])?)\b[+#]?/;

// Castling field: X-FEN (KQkq) or Shredder file letters (HAha), 1-8 chars.
export const FEN_REGEX =
  /^[rnbqkpRNBQKP1-8]+(\/[rnbqkpRNBQKP1-8]+){7}(\s+[wb]\s+(?:[A-Ha-hKQkq]{1,8}|-)\s+(?:-|[a-h][3-6])\s+\d+\s+\d+)?/;

export type MoveTokenType = "san-move";

export function getMoveTokenType(_value: string): MoveTokenType {
  return "san-move";
}

export const PRIMARY_MOVE_TOKEN_TYPES: ReadonlyArray<MoveTokenType> = [
  "san-move",
];

import type { Chess as ChessClass } from "@weshell/chess.js";

export function parseMoveInGame(
  chess: InstanceType<typeof ChessClass>,
  token: string,
  _tokenType: MoveTokenType,
): Move | null {
  return chess.move(token) ?? null;
}

export const SHAPE_SQUARE_REGEX = /[a-h][1-8]/;
/** Square coordinate pattern (variant adapter); embed into other regexes. */
export const SQUARE_PATTERN = "[a-h][1-8]";
export const SHAPE_PART_REGEX = /^([a-h][1-8])([a-h][1-8])?:([gryb])$/;
export const EVAL_REGEX =
  /^%e:([^,}]+)(?:,([a-h][1-8][a-h][1-8][qrbn]?))?(?:,([a-h][1-8][a-h][1-8][qrbn]?))?(?:,(!\?|\?!|\?\?|[?!]|!!))?$/;
/** Lichess study annotator profile URL prefix; null = no per-user pages. */
export const ANNOTATOR_URL_PREFIX: string | null = "https://lichess.org/@/";

export function getTurnFromFen(fen: string): "white" | "black" {
  return fen.split(" ")[1] === "b" ? "black" : "white";
}

// ========== Theme CSS Vars ==========
export interface ThemeData {
  name: string;
  nameZh: string;
  bg: string;
  texture?: string;
  grid?: "dark" | "light" | "none";
  bgImage?: { path: string; base64: string };
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
    const url = app.vault.adapter.getResourcePath(
      app.vault.configDir + "/" + bg,
    );
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

// ========== Online Analysis Sites ==========
export interface AnalysisSite {
  label: string;
  labelZh: string;
  icon: string;
  positionUrl: (host: IHost) => string;
  gameUrl: (host: IHost) => string;
}

function buildBranchPgn(host: IHost): string {
  const nodes: ChessNode[] = [];
  let node: ChessNode | null = host.currentNode;
  while (node) {
    nodes.push(node);
    node = node.parentID ? (host.nodeMap.get(node.parentID) ?? null) : null;
  }
  nodes.reverse();
  let pgn = "";
  let stepNum = 1;
  for (let i = 1; i < nodes.length; i++) {
    const n = nodes[i];
    if (!n.move) continue;
    const san = getSaveNotation(n.move);
    if (n.color === "white") {
      pgn += `${stepNum}. ${san} `;
    } else {
      pgn += i === 1 ? `${stepNum}... ${san} ` : `${san} `;
      stepNum++;
    }
  }
  if (host.root.fen !== DEFAULT_FEN) {
    pgn = `[SetUp "1"][FEN "${host.root.fen}"] ${pgn}`;
  }
  return pgn.trim();
}

function lichessPositionUrl(host: IHost): string {
  return `https://lichess.org/analysis/${host.fen.replaceAll(" ", "_")}`;
}

function chessComPositionUrl(host: IHost): string {
  return `https://www.chess.com/analysis?fen=${encodeURIComponent(host.fen)}`;
}

export const ANALYSIS_SITES: AnalysisSite[] = [
  {
    label: "Lichess",
    labelZh: "Lichess",
    icon: "external-link",
    positionUrl: lichessPositionUrl,
    gameUrl: (host) => {
      const pgn = buildBranchPgn(host);
      if (!pgn) return lichessPositionUrl(host);
      const color = getTurnFromFen(host.fen) === "black" ? "black" : "white";
      return `https://lichess.org/analysis/pgn/${encodeURIComponent(pgn)}?color=${color}`;
    },
  },
  {
    label: "Chess.com",
    labelZh: "Chess.com",
    icon: "external-link",
    positionUrl: chessComPositionUrl,
    gameUrl: (host) => {
      const pgn = buildBranchPgn(host);
      if (!pgn) return chessComPositionUrl(host);
      return `https://www.chess.com/analysis?pgn=${encodeURIComponent(pgn)}`;
    },
  },
];

// ========== Other ==========
export function parseExternalUrl(_source: string): string | null {
  return null;
}

export function createPieceFromChar(_char: string): Piece | null {
  return null;
}
