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

import type { Color, Piece } from './types'
import { EMPTY, Ox88 } from './types'

const MASK64 = 0xffffffffffffffffn

function rotl(x: bigint, k: bigint): bigint {
  return ((x << k) | (x >> (64n - k))) & 0xffffffffffffffffn
}

function wrappingMul(x: bigint, y: bigint) {
  return (x * y) & MASK64
}

// xoroshiro128**
export function xoroshiro128(state: bigint) {
  return function () {
    let s0 = BigInt(state & MASK64)
    let s1 = BigInt((state >> 64n) & MASK64)

    const result = wrappingMul(rotl(wrappingMul(s0, 5n), 7n), 9n)

    s1 ^= s0
    s0 = (rotl(s0, 24n) ^ s1 ^ (s1 << 16n)) & MASK64
    s1 = rotl(s1, 37n)

    state = (s1 << 64n) | s0

    return result
  }
}

const rand = xoroshiro128(0xa187eb39cdcaed8f31c4b365b102e01en)

const PIECE_KEYS = Array.from({ length: 2 }, () =>
  Array.from({ length: 6 }, () => Array.from({ length: 128 }, () => rand())),
)

const EP_KEYS = Array.from({ length: 8 }, () => rand())

const CASTLING_KEYS = Array.from({ length: 16 }, () => rand())

export const SIDE_KEY = rand()

export function pieceKey(board: Piece[], i: number): bigint {
  if (!board[i]) {
    return 0n
  }

  const { color, type } = board[i]

  const colorIndex = {
    w: 0,
    b: 1,
  }[color]

  const typeIndex = {
    p: 0,
    n: 1,
    b: 2,
    r: 3,
    q: 4,
    k: 5,
  }[type]

  return PIECE_KEYS[colorIndex][typeIndex][i]
}

export function epKey(epSquare: number): bigint {
  return epSquare === EMPTY ? 0n : EP_KEYS[epSquare & 7]
}

export function castlingKey(castling: Record<Color, number>): bigint {
  const index = (castling.w >> 5) | (castling.b >> 3)
  return CASTLING_KEYS[index]
}

export function computeHash(
  board: Piece[],
  epSquare: number,
  castling: Record<Color, number>,
  turn: Color,
): bigint {
  let hash = 0n

  for (let i = Ox88.a8; i <= Ox88.h1; i++) {
    // did we run off the end of the board
    if (i & 0x88) {
      i += 7
      continue
    }

    if (board[i]) {
      hash ^= pieceKey(board, i)
    }
  }

  hash ^= epKey(epSquare)
  hash ^= castlingKey(castling)

  if (turn === 'b') {
    hash ^= SIDE_KEY
  }

  return hash
}
