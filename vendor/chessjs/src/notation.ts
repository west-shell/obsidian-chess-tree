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

import type { Color, InternalMove, PieceSymbol, Square } from './types'
import { BITS, KING, Ox88, PAWN, SAN_NULLMOVE } from './types'
import { algebraic, file, rank } from './board'

// this function is used to uniquely identify ambiguous moves
export function getDisambiguator(
  move: InternalMove,
  moves: InternalMove[],
): string {
  const from = move.from
  const to = move.to
  const piece = move.piece

  let ambiguities = 0
  let sameRank = 0
  let sameFile = 0

  for (let i = 0, len = moves.length; i < len; i++) {
    const ambigFrom = moves[i].from
    const ambigTo = moves[i].to
    const ambigPiece = moves[i].piece

    /*
     * if a move of the same piece type ends on the same to square, we'll need
     * to add a disambiguator to the algebraic notation
     */
    if (piece === ambigPiece && from !== ambigFrom && to === ambigTo) {
      ambiguities++

      if (rank(from) === rank(ambigFrom)) {
        sameRank++
      }

      if (file(from) === file(ambigFrom)) {
        sameFile++
      }
    }
  }

  if (ambiguities > 0) {
    if (sameRank > 0 && sameFile > 0) {
      /*
       * if there exists a similar moving piece on the same rank and file as
       * the move in question, use the square as the disambiguator
       */
      return algebraic(from)
    } else if (sameFile > 0) {
      /*
       * if the moving piece rests on the same file, use the rank symbol as the
       * disambiguator
       */
      return algebraic(from).charAt(1)
    } else {
      // else use the file symbol
      return algebraic(from).charAt(0)
    }
  }

  return ''
}

export function inferPieceType(san: string): PieceSymbol | undefined {
  let pieceType = san.charAt(0)
  if (pieceType >= 'a' && pieceType <= 'h') {
    const matches = san.match(/[a-h]\d.*[a-h]\d/)
    if (matches) {
      return undefined
    }
    return PAWN
  }
  pieceType = pieceType.toLowerCase()
  if (pieceType === 'o') {
    return KING
  }
  return pieceType as PieceSymbol
}

// parses all of the decorators out of a SAN string
export function strippedSan(move: string): string {
  return move.replace(/=/, '').replace(/[+#]?[?!]*$/, '')
}

/*
 * Convert a move from 0x88 coordinates to Standard Algebraic Notation
 * (SAN), without the check/checkmate suffix. The caller is responsible
 * for appending '+'/'#' (which requires making the move).
 */
export function moveToSan(
  move: InternalMove,
  moves: InternalMove[],
): string {
  let output = ''

  if (move.flags & BITS.KSIDE_CASTLE) {
    output = 'O-O'
  } else if (move.flags & BITS.QSIDE_CASTLE) {
    output = 'O-O-O'
  } else if (move.flags & BITS.NULL_MOVE) {
    return SAN_NULLMOVE
  } else {
    if (move.piece !== PAWN) {
      const disambiguator = getDisambiguator(move, moves)
      output += move.piece.toUpperCase() + disambiguator
    }

    if (move.flags & (BITS.CAPTURE | BITS.EP_CAPTURE)) {
      if (move.piece === PAWN) {
        output += algebraic(move.from)[0]
      }
      output += 'x'
    }

    output += algebraic(move.to)

    if (move.promotion) {
      output += '=' + move.promotion.toUpperCase()
    }
  }

  return output
}

// convert a move from Standard Algebraic Notation (SAN) to 0x88 coordinates
export function moveFromSan(
  move: string,
  turn: Color,
  legalMoves: InternalMove[],
  strict = false,
): InternalMove | null {
  // strip off any move decorations: e.g Nf3+?! becomes Nf3
  let cleanMove = strippedSan(move)

  if (!strict) {
    if (cleanMove === '0-0') {
      cleanMove = 'O-O'
    } else if (cleanMove === '0-0-0') {
      cleanMove = 'O-O-O'
    }
  }

  //first implementation of null with a dummy move (black king moves from a8 to a8), maybe this can be implemented better
  if (cleanMove == SAN_NULLMOVE) {
    const res: InternalMove = {
      color: turn,
      from: 0,
      to: 0,
      piece: 'k',
      flags: BITS.NULL_MOVE,
    }
    return res
  }

  let pieceType = inferPieceType(cleanMove)
  let moves = pieceType
    ? legalMoves.filter((m) => m.piece === pieceType)
    : legalMoves

  // strict parser
  for (let i = 0, len = moves.length; i < len; i++) {
    if (cleanMove === strippedSan(moveToSan(moves[i], moves))) {
      return moves[i]
    }
  }

  // the strict parser failed
  if (strict) {
    return null
  }

  let piece = undefined
  let matches = undefined
  let from = undefined
  let to = undefined
  let promotion = undefined

  /*
   * The default permissive (non-strict) parser allows the user to parse
   * non-standard chess notations. This parser is only run after the strict
   * Standard Algebraic Notation (SAN) parser has failed.
   *
   * When running the permissive parser, we'll run a regex to grab the piece, the
   * to/from square, and an optional promotion piece. This regex will
   * parse common non-standard notation like: Pe2-e4, Rc1c4, Qf3xf7,
   * f7f8q, b1c3
   *
   * NOTE: Some positions and moves may be ambiguous when using the permissive
   * parser. For example, in this position: 6k1/8/8/A7/8/8/8/BN4K1 w - - 0 1,
   * the move b1c3 may be interpreted as Nc3 or B1c3 (a disambiguated bishop
   * move). In these cases, the permissive parser will default to the most
   * basic interpretation (which is b1c3 parsing to Nc3).
   */

  let overlyDisambiguated = false

  matches = cleanMove.match(
    /([pnbrqkPNBRQK])?([a-h][1-8])x?-?([a-h][1-8])([qrbnQRBN])?/,
    //     piece         from              to       promotion
  )

  if (matches) {
    piece = matches[1]
    from = matches[2] as Square
    to = matches[3] as Square
    promotion = matches[4]

    if (from.length == 1) {
      overlyDisambiguated = true
    }
  } else {
    /*
     * The [a-h]?[1-8]? portion of the regex below handles moves that may be
     * overly disambiguated (e.g. Nge7 is unnecessary and non-standard when
     * there is one legal knight move to e7). In this case, the value of
     * 'from' variable will be a rank or file, not a square.
     */

    matches = cleanMove.match(
      /([pnbrqkPNBRQK])?([a-h]?[1-8]?)x?-?([a-h][1-8])([qrbnQRBN])?/,
    )

    if (matches) {
      piece = matches[1]
      from = matches[2] as Square
      to = matches[3] as Square
      promotion = matches[4]

      if (from.length == 1) {
        overlyDisambiguated = true
      }
    }
  }

  pieceType = inferPieceType(cleanMove)
  moves = piece
    ? legalMoves.filter((m) => m.piece === (piece as PieceSymbol))
    : pieceType
      ? legalMoves.filter((m) => m.piece === pieceType)
      : legalMoves

  if (!to) {
    return null
  }

  for (let i = 0, len = moves.length; i < len; i++) {
    if (!from) {
      // if there is no from square, it could be just 'x' missing from a capture
      if (
        cleanMove ===
        strippedSan(moveToSan(moves[i], moves)).replace('x', '')
      ) {
        return moves[i]
      }
      // hand-compare move properties with the results from our permissive regex
    } else if (
      (!piece || piece.toLowerCase() == moves[i].piece) &&
      Ox88[from] == moves[i].from &&
      Ox88[to] == moves[i].to &&
      (!promotion || promotion.toLowerCase() == moves[i].promotion)
    ) {
      return moves[i]
    } else if (overlyDisambiguated) {
      /*
       * SPECIAL CASE: we parsed a move string that may have an unneeded
       * rank/file disambiguator (e.g. Nge7).  The 'from' variable will
       */

      const square = algebraic(moves[i].from)
      if (
        (!piece || piece.toLowerCase() == moves[i].piece) &&
        Ox88[to] == moves[i].to &&
        (from == square[0] || from == square[1]) &&
        (!promotion || promotion.toLowerCase() == moves[i].promotion)
      ) {
        return moves[i]
      }
    }
  }

  return null
}
