// ========== FEN Helpers ==========

// Minimal edit-FEN shell for the FEN editor: standard chess needs the
// full PGN castling/en-passant/move-counter tail.
export function buildDefaultEditFen(boardPart: string): string {
  return `${boardPart} w KQkq - 0 1`;
}

export function getTurnFromFen(fen: string): "white" | "black" {
  return fen.split(" ")[1] === "b" ? "black" : "white";
}
