/**
 * @license
 * Copyright (c) 2025, Jeff Hlywa (jhlywa@gmail.com)
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 * 1. Redistributions of source code must retain the above copyright notice,
 *    this list of conditions and the following disclaimer.
 * 2. Redistributions in binary form must reproduce the above copyright notice,
 *    this list of conditions and the following disclaimer in the documentation
 *    and/or other materials provided with the distribution.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
 * AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
 * IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
 * ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE
 * LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
 * CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
 * SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
 * INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
 * CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
 * ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
 * POSSIBILITY OF SUCH DAMAGE.
 */

import type {
  CastlingRookSquares,
  Color,
  InternalMove,
  Piece,
  PieceSymbol,
  Square,
} from './types'
import {
  BITS,
  EMPTY,
  KING,
  KNIGHT,
  Ox88,
  PAWN,
  PAWN_OFFSETS,
  PIECE_OFFSETS,
  PROMOTIONS,
  RANK_1,
  RANK_8,
  SECOND_RANK,
} from './types'
import { rank, swapColor } from './board'
import { attacked } from './attack'

export function addMove(
  moves: InternalMove[],
  color: Color,
  from: number,
  to: number,
  piece: PieceSymbol,
  captured: PieceSymbol | undefined = undefined,
  flags: number = BITS.NORMAL,
  rookFrom: number | undefined = undefined,
) {
  const r = rank(to)

  if (piece === PAWN && (r === RANK_1 || r === RANK_8)) {
    for (let i = 0; i < PROMOTIONS.length; i++) {
      const promotion = PROMOTIONS[i]
      moves.push({
        color,
        from,
        to,
        piece,
        captured,
        promotion,
        flags: flags | BITS.PROMOTION,
      })
    }
  } else {
    moves.push({
      color,
      from,
      to,
      piece,
      captured,
      flags,
      rookFrom,
    })
  }
}

/*
 * CHESS960 castling generation, mirroring chessops castlingDest:
 *
 * - The king may not castle out of, through, or into check.
 * - All squares on the king's and rook's paths (excluding their origin
 *   squares) must be empty.
 * - The destination is checked with the king lifted off the board and the
 *   rook already relocated, which also covers the Chess960 corner cases
 *   where the king passes over or lands on the rook's origin square.
 */
export function addCastlingMove(
  moves: InternalMove[],
  us: Color,
  them: Color,
  side: number,
  board: Piece[],
  kings: Record<Color, number>,
  castling: Record<Color, number>,
  castlingRooks: Record<Color, CastlingRookSquares>,
) {
  if (!(castling[us] & side)) {
    return
  }

  const rookFrom =
    side === BITS.KSIDE_CASTLE
      ? castlingRooks[us].kside
      : castlingRooks[us].qside
  const kingFrom = kings[us]
  if (rookFrom === EMPTY || kingFrom === EMPTY) {
    return
  }

  // king and rook destinations are fixed: g/c and f/d files
  const kingTo =
    side === BITS.KSIDE_CASTLE
      ? us === 'w'
        ? Ox88.g1
        : Ox88.g8
      : us === 'w'
        ? Ox88.c1
        : Ox88.c8
  const rookTo = side === BITS.KSIDE_CASTLE ? kingTo - 1 : kingTo + 1

  // the king may not castle while in check
  if (attacked(board, them, kingFrom)) {
    return
  }

  // every square on the king's and rook's paths must be empty,
  // except the king's and rook's origin squares
  const path = new Set<number>()
  for (
    let sq = Math.min(rookFrom, rookTo);
    sq <= Math.max(rookFrom, rookTo);
    sq++
  ) {
    path.add(sq)
  }
  for (
    let sq = Math.min(kingFrom, kingTo);
    sq <= Math.max(kingFrom, kingTo);
    sq++
  ) {
    path.add(sq)
  }
  path.delete(kingFrom)
  path.delete(rookFrom)

  for (const sq of path) {
    if (board[sq]) {
      return
    }
  }

  // lift the king so sliders pass through its origin square
  const kingPiece = board[kingFrom]
  if (!kingPiece) {
    return
  }
  delete board[kingFrom]

  let ok = true

  // every square the king crosses must be safe
  for (
    let sq = Math.min(kingFrom, kingTo) + 1;
    sq < Math.max(kingFrom, kingTo);
    sq++
  ) {
    if (attacked(board, them, sq)) {
      ok = false
      break
    }
  }

  // the destination must be safe with the rook already relocated
  const rookPiece = board[rookFrom]
  if (ok && rookPiece) {
    delete board[rookFrom]
    board[rookTo] = rookPiece
    ok = !attacked(board, them, kingTo)
    board[rookFrom] = rookPiece
    if (rookTo !== rookFrom) {
      delete board[rookTo]
    }
  }

  // restore the king
  board[kingFrom] = kingPiece

  if (ok) {
    addMove(moves, us, kingFrom, kingTo, KING, undefined, side, rookFrom)
  }
}

export function generatePseudoMoves(
  board: Piece[],
  turn: Color,
  epSquare: number,
  kings: Record<Color, number>,
  castling: Record<Color, number>,
  castlingRooks: Record<Color, CastlingRookSquares>,
  {
    piece: forPiece,
    square,
  }: { piece?: PieceSymbol; square?: Square } = {},
): InternalMove[] {
  const forSquare = square ? (square.toLowerCase() as Square) : undefined

  const moves: InternalMove[] = []
  const us = turn
  const them = swapColor(us)

  let firstSquare = Ox88.a8
  let lastSquare = Ox88.h1
  let singleSquare = false

  // are we generating moves for a single square?
  if (forSquare) {
    // illegal square, return empty moves
    if (!(forSquare in Ox88)) {
      return []
    } else {
      firstSquare = lastSquare = Ox88[forSquare]
      singleSquare = true
    }
  }

  for (let from = firstSquare; from <= lastSquare; from++) {
    // did we run off the end of the board
    if (from & 0x88) {
      from += 7
      continue
    }

    // empty square or opponent, skip
    if (!board[from] || board[from].color === them) {
      continue
    }
    const { type } = board[from]

    let to: number
    if (type === PAWN) {
      if (forPiece && forPiece !== type) continue

      // single square, non-capturing
      to = from + PAWN_OFFSETS[us][0]
      if (!board[to]) {
        addMove(moves, us, from, to, PAWN)

        // double square
        to = from + PAWN_OFFSETS[us][1]
        if (SECOND_RANK[us] === rank(from) && !board[to]) {
          addMove(moves, us, from, to, PAWN, undefined, BITS.BIG_PAWN)
        }
      }

      // pawn captures
      for (let j = 2; j < 4; j++) {
        to = from + PAWN_OFFSETS[us][j]
        if (to & 0x88) continue

        if (board[to]?.color === them) {
          addMove(
            moves,
            us,
            from,
            to,
            PAWN,
            board[to].type,
            BITS.CAPTURE,
          )
        } else if (to === epSquare) {
          addMove(moves, us, from, to, PAWN, PAWN, BITS.EP_CAPTURE)
        }
      }
    } else {
      if (forPiece && forPiece !== type) continue

      for (let j = 0, len = PIECE_OFFSETS[type].length; j < len; j++) {
        const offset = PIECE_OFFSETS[type][j]
        to = from

        while (true) {
          to += offset
          if (to & 0x88) break

          if (!board[to]) {
            addMove(moves, us, from, to, type)
          } else {
            // own color, stop loop
            if (board[to].color === us) break

            addMove(
              moves,
              us,
              from,
              to,
              type,
              board[to].type,
              BITS.CAPTURE,
            )
            break
          }

          /* break, if knight or king */
          if (type === KNIGHT || type === KING) break
        }
      }
    }
  }

  /*
   * check for castling if we're:
   *   a) generating all moves, or
   *   b) doing single square move generation on the king's square
   */

  if (forPiece === undefined || forPiece === KING) {
    if (!singleSquare || lastSquare === kings[us]) {
      // king-side castling
      addCastlingMove(
        moves,
        us,
        them,
        BITS.KSIDE_CASTLE,
        board,
        kings,
        castling,
        castlingRooks,
      )

      // queen-side castling
      addCastlingMove(
        moves,
        us,
        them,
        BITS.QSIDE_CASTLE,
        board,
        kings,
        castling,
        castlingRooks,
      )
    }
  }

  /*
   * return all pseudo-legal moves (this includes moves that allow the king
   * to be captured)
   */
  return moves
}
