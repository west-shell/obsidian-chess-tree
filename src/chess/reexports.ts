// Library re-exports: every consumer imports these through the
// "../chess" barrel so the variant adapter stays swappable.
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
