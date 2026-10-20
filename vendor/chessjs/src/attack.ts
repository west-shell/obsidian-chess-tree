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

import type { Color, Piece, Square } from './types'
import { ATTACKS, Ox88, PAWN, PIECE_MASKS, RAYS } from './types'
import { algebraic, swapColor } from './board'

export function attacked(
  board: Piece[],
  color: Color,
  square: number,
): boolean
export function attacked(
  board: Piece[],
  color: Color,
  square: number,
  verbose: false,
): boolean
export function attacked(
  board: Piece[],
  color: Color,
  square: number,
  verbose: true,
): Square[]
export function attacked(
  board: Piece[],
  color: Color,
  square: number,
  verbose?: boolean,
) {
  const attackers: Square[] = []
  for (let i = Ox88.a8; i <= Ox88.h1; i++) {
    // did we run off the end of the board
    if (i & 0x88) {
      i += 7
      continue
    }

    // if empty square or wrong color
    if (board[i] === undefined || board[i].color !== color) {
      continue
    }

    const piece = board[i]
    const difference = i - square

    // skip - to/from square are the same
    if (difference === 0) {
      continue
    }

    const index = difference + 119

    if (ATTACKS[index] & PIECE_MASKS[piece.type]) {
      if (piece.type === PAWN) {
        if (
          (difference > 0 && piece.color === 'w') ||
          (difference <= 0 && piece.color === 'b')
        ) {
          if (!verbose) {
            return true
          } else {
            attackers.push(algebraic(i))
          }
        }
        continue
      }

      // if the piece is a knight or a king
      if (piece.type === 'n' || piece.type === 'k') {
        if (!verbose) {
          return true
        } else {
          attackers.push(algebraic(i))
          continue
        }
      }

      const offset = RAYS[index]
      let j = i + offset

      let blocked = false
      while (j !== square) {
        if (board[j] != null) {
          blocked = true
          break
        }
        j += offset
      }

      if (!blocked) {
        if (!verbose) {
          return true
        } else {
          attackers.push(algebraic(i))
          continue
        }
      }
    }
  }

  if (verbose) {
    return attackers
  } else {
    return false
  }
}

export function isKingAttacked(
  board: Piece[],
  kings: Record<Color, number>,
  color: Color,
): boolean {
  const square = kings[color]
  return square === -1 ? false : attacked(board, swapColor(color), square)
}
