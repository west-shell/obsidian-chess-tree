// Re-export from chessground
export { Chessground } from 'chessground';
export type { Api } from 'chessground/api';
export type { Config } from 'chessground/config';
export type { DrawShape } from 'chessground/draw';
export type * as cg from 'chessground/types';

// Re-export from chess.js
export { Chess, validateFen, type Color, type Move, type PieceSymbol, type Square } from 'chess.js';
