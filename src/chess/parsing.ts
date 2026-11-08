import type { Chess as ChessClass, Move } from "@weshell/chess.js";

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
