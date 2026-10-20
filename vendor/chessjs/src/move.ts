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
import { BITS, FLAGS } from './types'
import { algebraic } from './board'

export class Move {
  color: Color
  from: Square
  to: Square
  piece: PieceSymbol
  captured?: PieceSymbol
  promotion?: PieceSymbol

  /*
   * CHESS960: the origin square of the rook that participates in this
   * castling move. Undefined for non-castling moves.
   */
  rookFrom?: Square

  /**
   * @deprecated This field is deprecated and will be removed in version 2.0.0.
   * Please use move descriptor functions instead: `isCapture`, `isPromotion`,
   * `isEnPassant`, `isKingsideCastle`, `isQueensideCastle`, `isCastle`, and
   * `isBigPawn`
   */
  flags: string

  san: string
  lan: string
  before: string
  after: string

  constructor(
    internal: InternalMove,
    san: string,
    before: string,
    after: string,
  ) {
    const { color, piece, from, to, flags, captured, promotion } = internal

    const fromAlgebraic = algebraic(from)
    const toAlgebraic = algebraic(to)

    this.color = color
    this.piece = piece
    this.from = fromAlgebraic
    this.to = toAlgebraic

    this.san = san
    this.lan = fromAlgebraic + toAlgebraic
    this.before = before
    this.after = after

    // Build the text representation of the move flags
    this.flags = ''
    for (const flag in BITS) {
      if (BITS[flag] & flags) {
        this.flags += FLAGS[flag]
      }
    }

    if (captured) {
      this.captured = captured
    }

    if (internal.rookFrom !== undefined) {
      this.rookFrom = algebraic(internal.rookFrom)
    }

    if (promotion) {
      this.promotion = promotion
      this.lan += promotion
    }
  }

  isCapture() {
    return this.flags.indexOf(FLAGS['CAPTURE']) > -1
  }

  isPromotion() {
    return this.flags.indexOf(FLAGS['PROMOTION']) > -1
  }

  isEnPassant() {
    return this.flags.indexOf(FLAGS['EP_CAPTURE']) > -1
  }

  isKingsideCastle() {
    return this.flags.indexOf(FLAGS['KSIDE_CASTLE']) > -1
  }

  isQueensideCastle() {
    return this.flags.indexOf(FLAGS['QSIDE_CASTLE']) > -1
  }

  isBigPawn() {
    return this.flags.indexOf(FLAGS['BIG_PAWN']) > -1
  }
}
