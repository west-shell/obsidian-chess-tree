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

import type { CastlingRookSquares, Color, Piece } from './types'
import {
  BITS,
  BLACK,
  EMPTY,
  KING,
  Ox88,
  RANK_1,
  RANK_8,
  ROOK,
  WHITE,
} from './types'
import { file, isDigit, rank } from './board'

export function validateFen(fen: string): { ok: boolean; error?: string } {
  // 1st criterion: 6 space-seperated fields?
  const tokens = fen.split(/\s+/)
  if (tokens.length !== 6) {
    return {
      ok: false,
      error: 'Invalid FEN: must contain six space-delimited fields',
    }
  }

  // 2nd criterion: move number field is a integer value > 0?
  const moveNumber = parseInt(tokens[5], 10)
  if (isNaN(moveNumber) || moveNumber <= 0) {
    return {
      ok: false,
      error: 'Invalid FEN: move number must be a positive integer',
    }
  }

  // 3rd criterion: half move counter is an integer >= 0?
  const halfMoves = parseInt(tokens[4], 10)
  if (isNaN(halfMoves) || halfMoves < 0) {
    return {
      ok: false,
      error:
        'Invalid FEN: half move counter number must be a non-negative integer',
    }
  }

  // 4th criterion: 4th field is a valid e.p.-string?
  if (!/^(-|[abcdefgh][36])$/.test(tokens[3])) {
    return { ok: false, error: 'Invalid FEN: en-passant square is invalid' }
  }

  // 5th criterion: 3th field is a valid castle-string?
  // CHESS960: allow X-FEN (KQkq) and Shredder-FEN (HAha) file letters.
  if (/[^KQkqA-Ha-h-]/.test(tokens[2])) {
    return { ok: false, error: 'Invalid FEN: castling availability is invalid' }
  }

  // 6th criterion: 2nd field is "w" (white) or "b" (black)?
  if (!/^(w|b)$/.test(tokens[1])) {
    return { ok: false, error: 'Invalid FEN: side-to-move is invalid' }
  }

  // 7th criterion: 1st field contains 8 rows?
  const rows = tokens[0].split('/')
  if (rows.length !== 8) {
    return {
      ok: false,
      error: "Invalid FEN: piece data does not contain 8 '/'-delimited rows",
    }
  }

  // 8th criterion: every row is valid?
  for (let i = 0; i < rows.length; i++) {
    // check for right sum of fields AND not two numbers in succession
    let sumFields = 0
    let previousWasNumber = false

    for (let k = 0; k < rows[i].length; k++) {
      if (isDigit(rows[i][k])) {
        if (previousWasNumber) {
          return {
            ok: false,
            error: 'Invalid FEN: piece data is invalid (consecutive number)',
          }
        }
        sumFields += parseInt(rows[i][k], 10)
        previousWasNumber = true
      } else {
        if (!/^[prnbqkPRNBQK]$/.test(rows[i][k])) {
          return {
            ok: false,
            error: 'Invalid FEN: piece data is invalid (invalid piece)',
          }
        }
        sumFields += 1
        previousWasNumber = false
      }
    }
    if (sumFields !== 8) {
      return {
        ok: false,
        error: 'Invalid FEN: piece data is invalid (too many squares in rank)',
      }
    }
  }

  // 9th criterion: is en-passant square legal?
  if (
    (tokens[3][1] == '3' && tokens[1] == 'w') ||
    (tokens[3][1] == '6' && tokens[1] == 'b')
  ) {
    return { ok: false, error: 'Invalid FEN: illegal en-passant square' }
  }

  // 10th criterion: does chess position contain exact two kings?
  const kings = [
    { color: 'white', regex: /K/g },
    { color: 'black', regex: /k/g },
  ]

  for (const { color, regex } of kings) {
    if (!regex.test(tokens[0])) {
      return { ok: false, error: `Invalid FEN: missing ${color} king` }
    }

    if ((tokens[0].match(regex) || []).length > 1) {
      return { ok: false, error: `Invalid FEN: too many ${color} kings` }
    }
  }

  // 11th criterion: are any pawns on the first or eighth rows?
  if (
    Array.from(rows[0] + rows[7]).some((char) => char.toUpperCase() === 'P')
  ) {
    return {
      ok: false,
      error: 'Invalid FEN: some pawns are on the edge rows',
    }
  }

  return { ok: true }
}

// Serializes the piece placement field (first field) of a FEN string.
export function serializeBoard(board: Piece[]): string {
  let empty = 0
  let fen = ''

  for (let i = Ox88.a8; i <= Ox88.h1; i++) {
    if (board[i]) {
      if (empty > 0) {
        fen += empty
        empty = 0
      }
      const { color, type: piece } = board[i]

      fen += color === WHITE ? piece.toUpperCase() : piece.toLowerCase()
    } else {
      empty++
    }

    if ((i + 1) & 0x88) {
      if (empty > 0) {
        fen += empty
      }

      if (i !== Ox88.h1) {
        fen += '/'
      }

      empty = 0
      i += 8
    }
  }

  return fen
}

/*
 * CHESS960: parse the castling field of a FEN string. Accepts X-FEN
 * (KQkq), Shredder-FEN file letters (HAha), and mixed forms, mirroring
 * chessops parseCastlingFen + Castles.fromSetup:
 *
 * - A file letter marks the rook square directly.
 * - 'K'/'Q' mark the outermost rook-or-king on the backrank (falling back
 *   to the h/a file square when that is not a rook).
 * - A right survives only if the king is on the backrank and the marked
 *   square holds a rook of the moving color, positioned on the correct
 *   side of the king; otherwise it is silently dropped.
 */
export function parseCastlingFen(
  castling: string,
  board: Piece[],
  kings: Record<Color, number>,
): {
  castling: Record<Color, number>
  castlingRooks: Record<Color, CastlingRookSquares>
} {
  const rights: Record<Color, number> = { w: 0, b: 0 }
  const rooks: Record<Color, CastlingRookSquares> = {
    w: { kside: EMPTY, qside: EMPTY },
    b: { kside: EMPTY, qside: EMPTY },
  }

  const rightsSquares: Record<Color, number[]> = { w: [], b: [] }

  for (const c of castling) {
    const lower = c.toLowerCase()
    const color: Color = c === lower ? BLACK : WHITE
    const backrank = color === WHITE ? RANK_1 : RANK_8
    let square = EMPTY

    if (lower >= 'a' && lower <= 'h') {
      // Shredder-FEN file letter
      square = (backrank << 4) | (lower.charCodeAt(0) - 'a'.charCodeAt(0))
    } else if (lower === 'k' || lower === 'q') {
      // X-FEN: outermost rook-or-king on the backrank
      if (lower === 'k') {
        for (let f = 7; f >= 0; f--) {
          const sq = (backrank << 4) | f
          const piece = board[sq]
          if (
            piece &&
            piece.color === color &&
            (piece.type === ROOK || piece.type === KING)
          ) {
            square = sq
            break
          }
        }
      } else {
        for (let f = 0; f <= 7; f++) {
          const sq = (backrank << 4) | f
          const piece = board[sq]
          if (
            piece &&
            piece.color === color &&
            (piece.type === ROOK || piece.type === KING)
          ) {
            square = sq
            break
          }
        }
      }
      // the candidate must be a rook, otherwise fall back to the edge file
      if (square === EMPTY || board[square]?.type !== ROOK) {
        square = (backrank << 4) | (lower === 'k' ? 7 : 0)
      }
    } else {
      // skip separators like '-' (validateFen gates the charset)
      continue
    }

    rightsSquares[color].push(square)
  }

  // chessops Castles.fromSetup equivalent
  for (const color of [WHITE, BLACK] as Color[]) {
    const backrank = color === WHITE ? RANK_1 : RANK_8
    const kingSquare = kings[color]
    if (kingSquare === EMPTY || rank(kingSquare) !== backrank) {
      continue
    }

    const rookSquares = rightsSquares[color].filter((sq) => {
      const piece = board[sq]
      return piece?.type === ROOK && piece.color === color
    })
    if (rookSquares.length === 0) {
      continue
    }

    const aSide = Math.min(...rookSquares)
    const hSide = Math.max(...rookSquares)

    if (aSide < kingSquare) {
      rights[color] |= BITS.QSIDE_CASTLE
      rooks[color].qside = aSide
    }
    if (kingSquare < hSide) {
      rights[color] |= BITS.KSIDE_CASTLE
      rooks[color].kside = hSide
    }
  }

  return { castling: rights, castlingRooks: rooks }
}

/*
 * CHESS960: mirror chessops makeCastlingFen — emit X-FEN letters (K/Q)
 * when the rook is the outermost rook on its side of the king, and
 * Shredder-FEN file letters otherwise. Output order is h-file to a-file,
 * kingside before queenside, which matches standard 'KQkq' byte-for-byte.
 */
export function makeCastlingFen(
  board: Piece[],
  kings: Record<Color, number>,
  castling: Record<Color, number>,
  castlingRooks: Record<Color, CastlingRookSquares>,
): string {
  let castlingStr = ''
  for (const color of [WHITE, BLACK] as Color[]) {
    const backrank = color === WHITE ? RANK_1 : RANK_8
    const kingSquare = kings[color]
    const kingOnBackrank =
      kingSquare !== EMPTY && rank(kingSquare) === backrank

    // all rooks of this color on the backrank, ordered a-file to h-file
    const rookSquares: number[] = []
    for (let f = 0; f <= 7; f++) {
      const sq = (backrank << 4) | f
      const piece = board[sq]
      if (piece && piece.type === ROOK && piece.color === color) {
        rookSquares.push(sq)
      }
    }

    // rooks holding the rights, ordered h-file to a-file
    const rightsRooks: number[] = []
    if (castling[color] & BITS.KSIDE_CASTLE) {
      rightsRooks.push(castlingRooks[color].kside)
    }
    if (castling[color] & BITS.QSIDE_CASTLE) {
      rightsRooks.push(castlingRooks[color].qside)
    }
    rightsRooks.sort((a, b) => b - a)

    for (const rook of rightsRooks) {
      if (
        kingOnBackrank &&
        rookSquares.length > 0 &&
        rook === rookSquares[0] &&
        rook < kingSquare
      ) {
        castlingStr += color === WHITE ? 'Q' : 'q'
      } else if (
        kingOnBackrank &&
        rookSquares.length > 0 &&
        rook === rookSquares[rookSquares.length - 1] &&
        kingSquare < rook
      ) {
        castlingStr += color === WHITE ? 'K' : 'k'
      } else {
        const f = file(rook)
        castlingStr += color === WHITE ? 'ABCDEFGH'[f] : 'abcdefgh'[f]
      }
    }
  }

  return castlingStr
}
