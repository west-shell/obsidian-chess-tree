import { Chess } from "@weshell/chess.js";
import type { Move, Square } from "@weshell/chess.js";

// ========== Move Predicates & Helpers ==========
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

export function extraMoveDests(move: Move): Square[] {
  // Chess960 castling: the king may already stand on its castling
  // destination (g1/c1), making a drag to move.to a no-op. Also offer
  // the king-takes-rook drop (onto the castling rook) like lichess.
  return move.rookFrom && move.rookFrom !== move.to ? [move.rookFrom] : [];
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
