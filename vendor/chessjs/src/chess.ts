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

import { parse } from '../pgn'

import type {
  CastlingRookSquares,
  Color,
  History,
  InternalMove,
  Piece,
  PieceSymbol,
  Square,
} from './types'
import {
  BISHOP,
  BITS,
  BLACK,
  DEFAULT_POSITION,
  EMPTY,
  HEADER_TEMPLATE,
  KING,
  KNIGHT,
  Ox88,
  PAWN,
  QUEEN,
  RANK_1,
  RANK_8,
  ROOK,
  SEVEN_TAG_ROSTER,
  SIDES,
  SAN_NULLMOVE,
  SYMBOLS,
  WHITE,
} from './types'

import { algebraic, file, isDigit, rank, swapColor } from './board'
import {
  castlingKey,
  computeHash,
  epKey,
  pieceKey,
  SIDE_KEY,
} from './hash'
import { validateFen, makeCastlingFen, parseCastlingFen, serializeBoard } from './fen'
import { attacked, isKingAttacked } from './attack'
import { generatePseudoMoves } from './movegen'
import { moveFromSan, moveToSan } from './notation'
import { Move } from './move'

// === Re-exports for backward compatibility ===

export {
  WHITE,
  BLACK,
  PAWN,
  KNIGHT,
  BISHOP,
  ROOK,
  QUEEN,
  KING,
  DEFAULT_POSITION,
  SQUARES,
  SEVEN_TAG_ROSTER,
} from './types'

export type { Color, PieceSymbol, Square, Piece } from './types'

export { xoroshiro128 } from './hash'
export { validateFen } from './fen'
export { Move } from './move'

/* === Chess class === */

export class Chess {
  private _board = new Array<Piece>(128)
  private _turn: Color = WHITE
  private _header: Record<string, string | null> = {}
  private _kings: Record<Color, number> = { w: EMPTY, b: EMPTY }
  private _epSquare = -1
  private _halfMoves = 0
  private _moveNumber = 0
  private _history: History[] = []
  private _comments: Record<string, string> = {}
  private _castling: Record<Color, number> = { w: 0, b: 0 }
  // CHESS960: origin squares of the rooks holding the castling rights
  private _castlingRooks: Record<Color, CastlingRookSquares> = {
    w: { kside: EMPTY, qside: EMPTY },
    b: { kside: EMPTY, qside: EMPTY },
  }

  private _hash = 0n

  // tracks number of times a position has been seen for repetition checking
  private _positionCount = new Map<bigint, number>()

  constructor(fen = DEFAULT_POSITION, { skipValidation = false } = {}) {
    this.load(fen, { skipValidation })
  }

  clear({ preserveHeaders = false } = {}) {
    this._board = new Array<Piece>(128)
    this._kings = { w: EMPTY, b: EMPTY }
    this._turn = WHITE
    this._castling = { w: 0, b: 0 }
    this._castlingRooks = {
      w: { kside: EMPTY, qside: EMPTY },
      b: { kside: EMPTY, qside: EMPTY },
    }
    this._epSquare = EMPTY
    this._halfMoves = 0
    this._moveNumber = 1
    this._history = []
    this._comments = {}
    this._header = preserveHeaders ? this._header : { ...HEADER_TEMPLATE }
    this._hash = this._computeHash()
    this._positionCount = new Map<bigint, number>()

    /*
     * Delete the SetUp and FEN headers (if preserved), the board is empty and
     * these headers don't make sense in this state. They'll get added later
     * via .load() or .put()
     */
    this._header['SetUp'] = null
    this._header['FEN'] = null
  }

  load(fen: string, { skipValidation = false, preserveHeaders = false } = {}) {
    let tokens = fen.split(/\s+/)

    // append commonly omitted fen tokens
    if (tokens.length >= 2 && tokens.length < 6) {
      const adjustments = ['-', '-', '0', '1']
      fen = tokens.concat(adjustments.slice(-(6 - tokens.length))).join(' ')
    }

    tokens = fen.split(/\s+/)

    if (!skipValidation) {
      const { ok, error } = validateFen(fen)
      if (!ok) {
        throw new Error(error)
      }
    }

    const position = tokens[0]
    let square = 0

    this.clear({ preserveHeaders })

    for (let i = 0; i < position.length; i++) {
      const piece = position.charAt(i)

      if (piece === '/') {
        square += 8
      } else if (isDigit(piece)) {
        square += parseInt(piece, 10)
      } else {
        const color = piece < 'a' ? WHITE : BLACK
        this._put(
          { type: piece.toLowerCase() as PieceSymbol, color },
          algebraic(square),
        )
        square++
      }
    }

    this._turn = tokens[1] as Color

    /*
     * CHESS960: parse the castling field. Accepts X-FEN (KQkq), Shredder-FEN
     * file letters (HAha), and mixed forms. Rights that cannot be mapped to
     * a rook on the backrank are silently dropped (chessops-style).
     */
    this._loadCastling(tokens[2])

    this._epSquare = tokens[3] === '-' ? EMPTY : Ox88[tokens[3] as Square]
    this._halfMoves = parseInt(tokens[4], 10)
    this._moveNumber = parseInt(tokens[5], 10)

    this._hash = this._computeHash()
    this._updateSetup(fen)
    this._incPositionCount()
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
  private _loadCastling(castling: string) {
    const parsed = parseCastlingFen(castling, this._board, this._kings)
    this._castling = parsed.castling
    this._castlingRooks = parsed.castlingRooks
  }

  fen({
    forceEnpassantSquare = false,
  }: { forceEnpassantSquare?: boolean } = {}) {
    const fen = serializeBoard(this._board)

    /*
     * CHESS960: mirror chessops makeCastlingFen — emit X-FEN letters (K/Q)
     * when the rook is the outermost rook on its side of the king, and
     * Shredder-FEN file letters otherwise. Output order is h-file to a-file,
     * kingside before queenside, which matches standard 'KQkq' byte-for-byte.
     */
    const castling = makeCastlingFen(
      this._board,
      this._kings,
      this._castling,
      this._castlingRooks,
    ) || '-'

    let epSquare = '-'
    /*
     * only print the ep square if en passant is a valid move (pawn is present
     * and ep capture is not pinned)
     */
    if (this._epSquare !== EMPTY) {
      if (forceEnpassantSquare) {
        epSquare = algebraic(this._epSquare)
      } else {
        const bigPawnSquare = this._epSquare + (this._turn === WHITE ? 16 : -16)
        const squares = [bigPawnSquare + 1, bigPawnSquare - 1]

        for (const square of squares) {
          // is the square off the board?
          if (square & 0x88) {
            continue
          }

          const color = this._turn

          // is there a pawn that can capture the epSquare?
          if (
            this._board[square]?.color === color &&
            this._board[square]?.type === PAWN
          ) {
            // if the pawn makes an ep capture, does it leave its king in check?
            this._makeMove({
              color,
              from: square,
              to: this._epSquare,
              piece: PAWN,
              captured: PAWN,
              flags: BITS.EP_CAPTURE,
            })
            const isLegal = !this._isKingAttacked(color)
            this._undoMove()

            // if ep is legal, break and set the ep square in the FEN output
            if (isLegal) {
              epSquare = algebraic(this._epSquare)
              break
            }
          }
        }
      }
    }

    return [
      fen,
      this._turn,
      castling,
      epSquare,
      this._halfMoves,
      this._moveNumber,
    ].join(' ')
  }

  private _pieceKey(i: number) {
    return pieceKey(this._board, i)
  }

  private _epKey() {
    return epKey(this._epSquare)
  }

  private _castlingKey() {
    return castlingKey(this._castling)
  }

  private _computeHash() {
    return computeHash(this._board, this._epSquare, this._castling, this._turn)
  }

  /*
   * Called when the initial board setup is changed with put() or remove().
   * modifies the SetUp and FEN properties of the header object. If the FEN
   * is equal to the default position, the SetUp and FEN are deleted the setup
   * is only updated if history.length is zero, ie moves haven't been made.
   */
  private _updateSetup(fen: string) {
    if (this._history.length > 0) return

    if (fen !== DEFAULT_POSITION) {
      this._header['SetUp'] = '1'
      this._header['FEN'] = fen
    } else {
      this._header['SetUp'] = null
      this._header['FEN'] = null
    }
  }

  reset() {
    this.load(DEFAULT_POSITION)
  }

  get(square: Square): Piece | undefined {
    return this._board[Ox88[square]]
  }

  findPiece(piece: Piece): Square[] {
    const squares: Square[] = []
    for (let i = Ox88.a8; i <= Ox88.h1; i++) {
      // did we run off the end of the board
      if (i & 0x88) {
        i += 7
        continue
      }

      // if empty square or wrong color
      if (!this._board[i] || this._board[i]?.color !== piece.color) {
        continue
      }

      // check if square contains the requested piece
      if (
        this._board[i].color === piece.color &&
        this._board[i].type === piece.type
      ) {
        squares.push(algebraic(i))
      }
    }

    return squares
  }

  put(
    { type, color }: { type: PieceSymbol; color: Color },
    square: Square,
  ): boolean {
    if (this._put({ type, color }, square)) {
      this._updateCastlingRights()
      this._updateEnPassantSquare()
      this._updateSetup(this.fen())
      return true
    }
    return false
  }

  private _set(sq: number, piece: Piece) {
    this._hash ^= this._pieceKey(sq)
    this._board[sq] = piece
    this._hash ^= this._pieceKey(sq)
  }

  private _put(
    { type, color }: { type: PieceSymbol; color: Color },
    square: Square,
  ): boolean {
    // check for piece
    if (SYMBOLS.indexOf(type.toLowerCase()) === -1) {
      return false
    }

    // check for valid square
    if (!(square in Ox88)) {
      return false
    }

    const sq = Ox88[square]

    // don't let the user place more than one king
    if (
      type == KING &&
      !(this._kings[color] == EMPTY || this._kings[color] == sq)
    ) {
      return false
    }

    const currentPieceOnSquare = this._board[sq]

    // if one of the kings will be replaced by the piece from args, set the `_kings` respective entry to `EMPTY`
    if (currentPieceOnSquare && currentPieceOnSquare.type === KING) {
      this._kings[currentPieceOnSquare.color] = EMPTY
    }

    this._set(sq, { type: type as PieceSymbol, color: color as Color })

    if (type === KING) {
      this._kings[color] = sq
    }

    return true
  }

  private _clear(sq: number) {
    this._hash ^= this._pieceKey(sq)
    delete this._board[sq]
  }

  remove(square: Square): Piece | undefined {
    const piece = this.get(square)
    this._clear(Ox88[square])
    if (piece && piece.type === KING) {
      this._kings[piece.color] = EMPTY
    }

    this._updateCastlingRights()
    this._updateEnPassantSquare()
    this._updateSetup(this.fen())

    return piece
  }

  private _updateCastlingRights() {
    this._hash ^= this._castlingKey()

    /*
     * CHESS960: a castling right survives only while the king remains on
     * its backrank and the rights rook remains a rook of the same color on
     * its original square.
     */
    for (const color of [WHITE, BLACK] as Color[]) {
      const backrank = color === WHITE ? RANK_1 : RANK_8
      const kingSquare = this._kings[color]
      const kingOk =
        kingSquare !== EMPTY && rank(kingSquare) === backrank

      for (const side of [BITS.KSIDE_CASTLE, BITS.QSIDE_CASTLE]) {
        if (!(this._castling[color] & side)) {
          continue
        }

        const rookSquare =
          side === BITS.KSIDE_CASTLE
            ? this._castlingRooks[color].kside
            : this._castlingRooks[color].qside
        const rookPiece =
          rookSquare === EMPTY ? undefined : this._board[rookSquare]

        if (
          !kingOk ||
          rookPiece?.type !== ROOK ||
          rookPiece.color !== color
        ) {
          this._castling[color] ^= side
          if (side === BITS.KSIDE_CASTLE) {
            this._castlingRooks[color].kside = EMPTY
          } else {
            this._castlingRooks[color].qside = EMPTY
          }
        }
      }
    }

    this._hash ^= this._castlingKey()
  }

  private _updateEnPassantSquare() {
    if (this._epSquare === EMPTY) {
      return
    }

    const startSquare = this._epSquare + (this._turn === WHITE ? -16 : 16)
    const currentSquare = this._epSquare + (this._turn === WHITE ? 16 : -16)
    const attackers = [currentSquare + 1, currentSquare - 1]

    if (
      this._board[startSquare] !== null ||
      this._board[this._epSquare] !== null ||
      this._board[currentSquare]?.color !== swapColor(this._turn) ||
      this._board[currentSquare]?.type !== PAWN
    ) {
      this._hash ^= this._epKey()
      this._epSquare = EMPTY
      return
    }

    const canCapture = (square: number) =>
      !(square & 0x88) &&
      this._board[square]?.color === this._turn &&
      this._board[square]?.type === PAWN

    if (!attackers.some(canCapture)) {
      this._hash ^= this._epKey()
      this._epSquare = EMPTY
    }
  }

  attackers(square: Square, attackedBy?: Color): Square[] {
    if (!attackedBy) {
      return attacked(this._board, this._turn, Ox88[square], true)
    } else {
      return attacked(this._board, attackedBy, Ox88[square], true)
    }
  }

  private _isKingAttacked(color: Color): boolean {
    return isKingAttacked(this._board, this._kings, color)
  }

  hash(): string {
    return this._hash.toString(16)
  }

  isAttacked(square: Square, attackedBy: Color): boolean {
    return attacked(this._board, attackedBy, Ox88[square])
  }

  isCheck(): boolean {
    return this._isKingAttacked(this._turn)
  }

  inCheck(): boolean {
    return this.isCheck()
  }

  isCheckmate(): boolean {
    return this.isCheck() && this._moves().length === 0
  }

  isStalemate(): boolean {
    return !this.isCheck() && this._moves().length === 0
  }

  isInsufficientMaterial(): boolean {
    /*
     * k.b. vs k.b. (of opposite colors) with mate in 1:
     * 8/8/8/8/1b6/8/B1k5/K7 b - - 0 1
     *
     * k.b. vs k.n. with mate in 1:
     * 8/8/8/8/1n6/8/B7/K1k5 b - - 2 1
     */
    const pieces: Record<PieceSymbol, number> = {
      b: 0,
      n: 0,
      r: 0,
      q: 0,
      k: 0,
      p: 0,
    }
    const bishops = []
    let numPieces = 0
    let squareColor = 0

    for (let i = Ox88.a8; i <= Ox88.h1; i++) {
      squareColor = (squareColor + 1) % 2
      if (i & 0x88) {
        i += 7
        continue
      }

      const piece = this._board[i]
      if (piece) {
        pieces[piece.type] = piece.type in pieces ? pieces[piece.type] + 1 : 1
        if (piece.type === BISHOP) {
          bishops.push(squareColor)
        }
        numPieces++
      }
    }

    // k vs. k
    if (numPieces === 2) {
      return true
    } else if (
      // k vs. kn .... or .... k vs. kb
      numPieces === 3 &&
      (pieces[BISHOP] === 1 || pieces[KNIGHT] === 1)
    ) {
      return true
    } else if (numPieces === pieces[BISHOP] + 2) {
      // kb vs. kb where any number of bishops are all on the same color
      let sum = 0
      const len = bishops.length
      for (let i = 0; i < len; i++) {
        sum += bishops[i]
      }
      if (sum === 0 || sum === len) {
        return true
      }
    }

    return false
  }

  isThreefoldRepetition(): boolean {
    return this._getPositionCount(this._hash) >= 3
  }

  isDrawByFiftyMoves(): boolean {
    return this._halfMoves >= 100 // 50 moves per side = 100 half moves
  }

  isDraw(): boolean {
    return (
      this.isDrawByFiftyMoves() ||
      this.isStalemate() ||
      this.isInsufficientMaterial() ||
      this.isThreefoldRepetition()
    )
  }

  isGameOver(): boolean {
    return this.isCheckmate() || this.isDraw()
  }

  moves(): string[]
  moves({ square }: { square: Square }): string[]
  moves({ piece }: { piece: PieceSymbol }): string[]

  moves({ square, piece }: { square: Square; piece: PieceSymbol }): string[]

  moves({ verbose, square }: { verbose: true; square?: Square }): Move[]
  moves({ verbose, square }: { verbose: false; square?: Square }): string[]
  moves({
    verbose,
    square,
  }: {
    verbose?: boolean
    square?: Square
  }): string[] | Move[]

  moves({ verbose, piece }: { verbose: true; piece?: PieceSymbol }): Move[]
  moves({ verbose, piece }: { verbose: false; piece?: PieceSymbol }): string[]
  moves({
    verbose,
    piece,
  }: {
    verbose?: boolean
    piece?: PieceSymbol
  }): string[] | Move[]

  moves({
    verbose,
    square,
    piece,
  }: {
    verbose: true
    square?: Square
    piece?: PieceSymbol
  }): Move[]
  moves({
    verbose,
    square,
    piece,
  }: {
    verbose: false
    square?: Square
    piece?: PieceSymbol
  }): string[]
  moves({
    verbose,
    square,
    piece,
  }: {
    verbose?: boolean
    square?: Square
    piece?: PieceSymbol
  }): string[] | Move[]

  moves({ square, piece }: { square?: Square; piece?: PieceSymbol }): Move[]

  moves({
    verbose = false,
    square = undefined,
    piece = undefined,
  }: { verbose?: boolean; square?: Square; piece?: PieceSymbol } = {}) {
    const moves = this._moves({ square, piece })

    if (verbose) {
      return moves.map((move) => this._createMove(move))
    } else {
      return moves.map((move) => this._moveToSan(move, moves))
    }
  }

  private _moves({
    legal = true,
    piece = undefined,
    square = undefined,
  }: {
    legal?: boolean
    piece?: PieceSymbol
    square?: Square
  } = {}): InternalMove[] {
    const moves = generatePseudoMoves(
      this._board,
      this._turn,
      this._epSquare,
      this._kings,
      this._castling,
      this._castlingRooks,
      { piece, square },
    )

    /*
     * return all pseudo-legal moves (this includes moves that allow the king
     * to be captured)
     */
    if (!legal || this._kings[this._turn] === -1) {
      return moves
    }

    const us = this._turn

    // filter out illegal moves
    const legalMoves = []

    for (let i = 0, len = moves.length; i < len; i++) {
      this._makeMove(moves[i])
      if (!this._isKingAttacked(us)) {
        legalMoves.push(moves[i])
      }
      this._undoMove()
    }

    return legalMoves
  }

  move(
    move: string | { from: string; to: string; promotion?: string } | null,
    { strict = false }: { strict?: boolean } = {},
  ): Move {
    /*
     * The move function can be called with in the following parameters:
     *
     * .move('Nxb7')       <- argument is a case-sensitive SAN string
     *
     * .move({ from: 'h7', <- argument is a move object
     *         to :'h8',
     *         promotion: 'q' })
     *
     *
     * An optional strict argument may be supplied to tell chess.js to
     * strictly follow the SAN specification.
     */

    let moveObj = null

    if (typeof move === 'string') {
      moveObj = this._moveFromSan(move, strict)
    } else if (move === null) {
      moveObj = this._moveFromSan(SAN_NULLMOVE, strict)
    } else if (typeof move === 'object') {
      const moves = this._moves()

      // convert the pretty move object to an ugly move object
      for (let i = 0, len = moves.length; i < len; i++) {
        if (
          move.from === algebraic(moves[i].from) &&
          move.to === algebraic(moves[i].to) &&
          (!('promotion' in moves[i]) || move.promotion === moves[i].promotion)
        ) {
          moveObj = moves[i]
          break
        }
      }

      /*
       * CHESS960: the king may have been dropped onto the castling rook
       * ("king takes rook" castling notation). Match it against the
       * generated castling moves.
       */
      if (!moveObj) {
        const kingSquare = this._kings[this._turn]
        const toSquare = Ox88[move.to as Square]
        if (
          kingSquare !== EMPTY &&
          move.from === algebraic(kingSquare) &&
          toSquare !== undefined &&
          this._board[toSquare]?.type === ROOK &&
          this._board[toSquare]?.color === this._turn
        ) {
          for (let i = 0, len = moves.length; i < len; i++) {
            if (
              moves[i].flags & (BITS.KSIDE_CASTLE | BITS.QSIDE_CASTLE) &&
              moves[i].rookFrom === toSquare
            ) {
              moveObj = moves[i]
              break
            }
          }
        }
      }
    }

    // failed to find move
    if (!moveObj) {
      if (typeof move === 'string') {
        throw new Error(`Invalid move: ${move}`)
      } else {
        throw new Error(`Invalid move: ${JSON.stringify(move)}`)
      }
    }

    //disallow null moves when in check
    if (this.isCheck() && moveObj.flags & BITS.NULL_MOVE) {
      throw new Error('Null move not allowed when in check')
    }

    /*
     * need to make a copy of move because we can't generate SAN after the move
     * is made
     */
    const prettyMove = this._createMove(moveObj)

    this._makeMove(moveObj)
    this._incPositionCount()
    return prettyMove
  }

  private _createMove(internal: InternalMove): Move {
    const san = this._moveToSan(internal, this._moves({ legal: true }))
    const before = this.fen()

    // Generate the FEN for the 'after' key
    this._makeMove(internal)
    const after = this.fen()
    this._undoMove()

    return new Move(internal, san, before, after)
  }

  private _push(move: InternalMove) {
    this._history.push({
      move,
      kings: { b: this._kings.b, w: this._kings.w },
      turn: this._turn,
      castling: { b: this._castling.b, w: this._castling.w },
      castlingRooks: {
        w: {
          kside: this._castlingRooks.w.kside,
          qside: this._castlingRooks.w.qside,
        },
        b: {
          kside: this._castlingRooks.b.kside,
          qside: this._castlingRooks.b.qside,
        },
      },
      epSquare: this._epSquare,
      halfMoves: this._halfMoves,
      moveNumber: this._moveNumber,
    })
  }

  private _movePiece(from: number, to: number) {
    this._hash ^= this._pieceKey(from)

    this._board[to] = this._board[from]
    delete this._board[from]

    this._hash ^= this._pieceKey(to)
  }

  private _makeMove(move: InternalMove) {
    const us = this._turn
    const them = swapColor(us)
    this._push(move)

    if (move.flags & BITS.NULL_MOVE) {
      if (us === BLACK) {
        this._moveNumber++
      }
      this._halfMoves++
      this._turn = them

      this._epSquare = EMPTY

      return
    }

    this._hash ^= this._epKey()
    this._hash ^= this._castlingKey()

    if (move.captured) {
      this._hash ^= this._pieceKey(move.to)
    }

    if (move.flags & (BITS.KSIDE_CASTLE | BITS.QSIDE_CASTLE)) {
      // CHESS960: relocate king and rook explicitly, which also handles the
      // overlap cases (king passing over or landing on the rook's square)
      const side =
        move.flags & BITS.KSIDE_CASTLE
          ? BITS.KSIDE_CASTLE
          : BITS.QSIDE_CASTLE
      const rookFrom =
        move.rookFrom !== undefined
          ? move.rookFrom
          : side === BITS.KSIDE_CASTLE
            ? this._castlingRooks[us].kside
            : this._castlingRooks[us].qside
      const rookTo =
        move.flags & BITS.KSIDE_CASTLE ? move.to - 1 : move.to + 1

      const kingPiece = this._board[move.from]
      const rookPiece = rookFrom !== EMPTY ? this._board[rookFrom] : undefined

      let hashOut = this._pieceKey(move.from)
      delete this._board[move.from]
      if (rookPiece) {
        hashOut ^= this._pieceKey(rookFrom)
        delete this._board[rookFrom]
      }

      this._board[move.to] = kingPiece
      this._hash ^= hashOut ^ this._pieceKey(move.to)

      if (rookPiece) {
        this._board[rookTo] = rookPiece
        this._hash ^= this._pieceKey(rookTo)
      }
    } else {
      this._movePiece(move.from, move.to)
    }

    // if ep capture, remove the captured pawn
    if (move.flags & BITS.EP_CAPTURE) {
      if (this._turn === BLACK) {
        this._clear(move.to - 16)
      } else {
        this._clear(move.to + 16)
      }
    }

    // if pawn promotion, replace with new piece
    if (move.promotion) {
      this._clear(move.to)
      this._set(move.to, { type: move.promotion, color: us })
    }

    // if we moved the king
    if (this._board[move.to].type === KING) {
      this._kings[us] = move.to

      // turn off castling
      this._castling[us] = 0
      this._castlingRooks[us] = { kside: EMPTY, qside: EMPTY }
    }

    // turn off castling if we move a rook
    if (this._castling[us]) {
      if (
        this._castlingRooks[us].kside !== EMPTY &&
        move.from === this._castlingRooks[us].kside
      ) {
        this._castling[us] ^= BITS.KSIDE_CASTLE
        this._castlingRooks[us].kside = EMPTY
      }
      if (
        this._castlingRooks[us].qside !== EMPTY &&
        move.from === this._castlingRooks[us].qside
      ) {
        this._castling[us] ^= BITS.QSIDE_CASTLE
        this._castlingRooks[us].qside = EMPTY
      }
    }

    // turn off castling if we capture a rook
    if (this._castling[them]) {
      if (
        this._castlingRooks[them].kside !== EMPTY &&
        move.to === this._castlingRooks[them].kside
      ) {
        this._castling[them] ^= BITS.KSIDE_CASTLE
        this._castlingRooks[them].kside = EMPTY
      }
      if (
        this._castlingRooks[them].qside !== EMPTY &&
        move.to === this._castlingRooks[them].qside
      ) {
        this._castling[them] ^= BITS.QSIDE_CASTLE
        this._castlingRooks[them].qside = EMPTY
      }
    }

    this._hash ^= this._castlingKey()

    // if big pawn move, update the en passant square
    if (move.flags & BITS.BIG_PAWN) {
      let epSquare

      if (us === BLACK) {
        epSquare = move.to - 16
      } else {
        epSquare = move.to + 16
      }

      if (
        (!((move.to - 1) & 0x88) &&
          this._board[move.to - 1]?.type === PAWN &&
          this._board[move.to - 1]?.color === them) ||
        (!((move.to + 1) & 0x88) &&
          this._board[move.to + 1]?.type === PAWN &&
          this._board[move.to + 1]?.color === them)
      ) {
        this._epSquare = epSquare
        this._hash ^= this._epKey()
      } else {
        this._epSquare = EMPTY
      }
    } else {
      this._epSquare = EMPTY
    }

    // reset the 50 move counter if a pawn is moved or a piece is captured
    if (move.piece === PAWN) {
      this._halfMoves = 0
    } else if (move.flags & (BITS.CAPTURE | BITS.EP_CAPTURE)) {
      this._halfMoves = 0
    } else {
      this._halfMoves++
    }

    if (us === BLACK) {
      this._moveNumber++
    }

    this._turn = them
    this._hash ^= SIDE_KEY
  }

  undo(): Move | null {
    const hash = this._hash
    const move = this._undoMove()
    if (move) {
      const prettyMove = this._createMove(move)
      this._decPositionCount(hash)
      return prettyMove
    }
    return null
  }

  private _undoMove(): InternalMove | null {
    const old = this._history.pop()
    if (old === undefined) {
      return null
    }

    this._hash ^= this._epKey()
    this._hash ^= this._castlingKey()

    const move = old.move

    this._kings = old.kings
    this._turn = old.turn
    this._castling = old.castling
    this._castlingRooks = {
      w: {
        kside: old.castlingRooks.w.kside,
        qside: old.castlingRooks.w.qside,
      },
      b: {
        kside: old.castlingRooks.b.kside,
        qside: old.castlingRooks.b.qside,
      },
    }
    this._epSquare = old.epSquare
    this._halfMoves = old.halfMoves
    this._moveNumber = old.moveNumber

    this._hash ^= this._epKey()
    this._hash ^= this._castlingKey()
    this._hash ^= SIDE_KEY

    const us = this._turn
    const them = swapColor(us)

    if (move.flags & BITS.NULL_MOVE) {
      return move
    }

    if (move.flags & (BITS.KSIDE_CASTLE | BITS.QSIDE_CASTLE)) {
      // CHESS960: reverse the explicit king/rook relocation, which also
      // handles the overlap cases (rook returning to the king's square)
      const side =
        move.flags & BITS.KSIDE_CASTLE
          ? BITS.KSIDE_CASTLE
          : BITS.QSIDE_CASTLE
      const rookFrom =
        move.rookFrom !== undefined
          ? move.rookFrom
          : side === BITS.KSIDE_CASTLE
            ? this._castlingRooks[us].kside
            : this._castlingRooks[us].qside
      const rookTo =
        move.flags & BITS.KSIDE_CASTLE ? move.to - 1 : move.to + 1

      const kingPiece = this._board[move.to]
      const rookPiece = rookFrom !== EMPTY ? this._board[rookTo] : undefined

      let hashOut = this._pieceKey(move.to)
      delete this._board[move.to]
      if (rookPiece) {
        hashOut ^= this._pieceKey(rookTo)
        delete this._board[rookTo]
      }

      this._board[move.from] = kingPiece
      this._hash ^= hashOut ^ this._pieceKey(move.from)

      if (rookPiece) {
        this._board[rookFrom] = rookPiece
        this._hash ^= this._pieceKey(rookFrom)
      }
    } else {
      this._movePiece(move.to, move.from)
    }

    // to undo any promotions
    if (move.piece) {
      this._clear(move.from)
      this._set(move.from, { type: move.piece, color: us })
    }

    if (move.captured) {
      if (move.flags & BITS.EP_CAPTURE) {
        // en passant capture
        let index: number
        if (us === BLACK) {
          index = move.to - 16
        } else {
          index = move.to + 16
        }
        this._set(index, { type: PAWN, color: them })
      } else {
        // regular capture
        this._set(move.to, { type: move.captured, color: them })
      }
    }

    return move
  }

  pgn({
    newline = '\n',
    maxWidth = 0,
  }: { newline?: string; maxWidth?: number } = {}): string {
    /*
     * using the specification from http://www.chessclub.com/help/PGN-spec
     * example for html usage: .pgn({ max_width: 72, newline_char: "<br />" })
     */

    const result: string[] = []
    let headerExists = false

    /* add the PGN header information */
    for (const i in this._header) {
      /*
       * TODO: order of enumerated properties in header object is not
       * guaranteed, see ECMA-262 spec (section 12.6.4)
       *
       * By using HEADER_TEMPLATE, the order of tags should be preserved; we
       * do have to check for null placeholders, though, and omit them
       */
      const headerTag = this._header[i]
      if (headerTag) result.push(`[${i} "${this._header[i]}"]` + newline)
      headerExists = true
    }

    if (headerExists && this._history.length) {
      result.push(newline)
    }

    const appendComment = (moveString: string) => {
      const comment = this._comments[this.fen()]
      if (typeof comment !== 'undefined') {
        const delimiter = moveString.length > 0 ? ' ' : ''
        moveString = `${moveString}${delimiter}{${comment}}`
      }
      return moveString
    }

    // pop all of history onto reversed_history
    const reversedHistory = []
    while (this._history.length > 0) {
      reversedHistory.push(this._undoMove())
    }

    const moves = []
    let moveString = ''

    // special case of a commented starting position with no moves
    if (reversedHistory.length === 0) {
      moves.push(appendComment(''))
    }

    // build the list of moves.  a move_string looks like: "3. e3 e6"
    while (reversedHistory.length > 0) {
      moveString = appendComment(moveString)
      const move = reversedHistory.pop()

      // make TypeScript stop complaining about move being undefined
      if (!move) {
        break
      }

      // if the position started with black to move, start PGN with #. ...
      if (!this._history.length && move.color === 'b') {
        const prefix = `${this._moveNumber}. ...`
        // is there a comment preceding the first move?
        moveString = moveString ? `${moveString} ${prefix}` : prefix
      } else if (move.color === 'w') {
        // store the previous generated move_string if we have one
        if (moveString.length) {
          moves.push(moveString)
        }
        moveString = this._moveNumber + '.'
      }

      moveString =
        moveString + ' ' + this._moveToSan(move, this._moves({ legal: true }))
      this._makeMove(move)
    }

    // are there any other leftover moves?
    if (moveString.length) {
      moves.push(appendComment(moveString))
    }

    // is there a result? (there ALWAYS has to be a result according to spec; see Seven Tag Roster)
    moves.push(this._header.Result || '*')

    /*
     * history should be back to what it was before we started generating PGN,
     * so join together moves
     */
    if (maxWidth === 0) {
      return result.join('') + moves.join(' ')
    }

    // TODO (jah): huh?
    const strip = function () {
      if (result.length > 0 && result[result.length - 1] === ' ') {
        result.pop()
        return true
      }
      return false
    }

    // NB: this does not preserve comment whitespace.
    const wrapComment = function (width: number, move: string) {
      for (const token of move.split(' ')) {
        if (!token) {
          continue
        }
        if (width + token.length > maxWidth) {
          while (strip()) {
            width--
          }
          result.push(newline)
          width = 0
        }
        result.push(token)
        width += token.length
        result.push(' ')
        width++
      }
      if (strip()) {
        width--
      }
      return width
    }

    // wrap the PGN output at max_width
    let currentWidth = 0
    for (let i = 0; i < moves.length; i++) {
      if (currentWidth + moves[i].length > maxWidth) {
        if (moves[i].includes('{')) {
          currentWidth = wrapComment(currentWidth, moves[i])
          continue
        }
      }
      // if the current move will push past max_width
      if (currentWidth + moves[i].length > maxWidth && i !== 0) {
        // don't end the line with whitespace
        if (result[result.length - 1] === ' ') {
          result.pop()
        }

        result.push(newline)
        currentWidth = 0
      } else if (i !== 0) {
        result.push(' ')
        currentWidth++
      }
      result.push(moves[i])
      currentWidth += moves[i].length
    }

    return result.join('')
  }

  /**
   * @deprecated Use `setHeader` and `getHeaders` instead. This method will return null header tags (which is not what you want)
   */
  header(...args: string[]): Record<string, string | null> {
    for (let i = 0; i < args.length; i += 2) {
      if (typeof args[i] === 'string' && typeof args[i + 1] === 'string') {
        this._header[args[i]] = args[i + 1]
      }
    }
    return this._header
  }

  // TODO: value validation per spec
  setHeader(key: string, value: string): Record<string, string> {
    this._header[key] = value ?? SEVEN_TAG_ROSTER[key] ?? null
    return this.getHeaders()
  }

  removeHeader(key: string): boolean {
    if (key in this._header) {
      this._header[key] = SEVEN_TAG_ROSTER[key] || null
      return true
    }
    return false
  }

  // return only non-null headers (omit placemarker nulls)
  getHeaders(): Record<string, string> {
    const nonNullHeaders: Record<string, string> = {}
    for (const [key, value] of Object.entries(this._header)) {
      if (value !== null) {
        nonNullHeaders[key] = value
      }
    }
    return nonNullHeaders
  }

  loadPgn(
    pgn: string,
    {
      strict = false,
      newlineChar = '\r?\n',
    }: { strict?: boolean; newlineChar?: string } = {},
  ) {
    // If newlineChar is not the default, replace all instances with \n
    if (newlineChar !== '\r?\n') {
      pgn = pgn.replace(new RegExp(newlineChar, 'g'), '\n')
    }

    const parsedPgn = parse(pgn)

    // Put the board in the starting position
    this.reset()

    // parse PGN header
    const headers = parsedPgn.headers
    let fen = ''

    for (const key in headers) {
      // check to see user is including fen (possibly with wrong tag case)
      if (key.toLowerCase() === 'fen') {
        fen = headers[key]
      }

      this.header(key, headers[key])
    }

    /*
     * the permissive parser should attempt to load a fen tag, even if it's the
     * wrong case and doesn't include a corresponding [SetUp "1"] tag
     */
    if (!strict) {
      if (fen) {
        this.load(fen, { preserveHeaders: true })
      }
    } else {
      /*
       * strict parser - load the starting position indicated by [Setup '1']
       * and [FEN position]
       */
      if (headers['SetUp'] === '1') {
        if (!('FEN' in headers)) {
          throw new Error(
            'Invalid PGN: FEN tag must be supplied with SetUp tag',
          )
        }
        // don't clear the headers when loading
        this.load(headers['FEN'], { preserveHeaders: true })
      }
    }

    let node = parsedPgn.root

    while (node) {
      if (node.move) {
        const move = this._moveFromSan(node.move, strict)

        if (move == null) {
          throw new Error(`Invalid move in PGN: ${node.move}`)
        } else {
          this._makeMove(move)
          this._incPositionCount()
        }
      }

      if (node.comment !== undefined) {
        this._comments[this.fen()] = node.comment
      }

      node = node.variations[0]
    }

    /*
     * Per section 8.2.6 of the PGN spec, the Result tag pair must match match
     * the termination marker. Only do this when headers are present, but the
     * result tag is missing
     */

    const result = parsedPgn.result
    if (
      result &&
      Object.keys(this._header).length &&
      this._header['Result'] !== result
    ) {
      this.setHeader('Result', result)
    }
  }

  /*
   * Convert a move from 0x88 coordinates to Standard Algebraic Notation
   * (SAN)
   *
   * @param {boolean} strict Use the strict SAN parser. It will throw errors
   * on overly disambiguated moves (see below):
   *
   * r1bqkbnr/ppp2ppp/2n5/1B1pP3/4P3/8/PPPP2PP/RNBQK1NR b KQkq - 2 4
   * 4. ... Nge7 is overly disambiguated because the knight on c6 is pinned
   * 4. ... Ne7 is technically the valid SAN
   */

  private _moveToSan(move: InternalMove, moves: InternalMove[]): string {
    if (move.flags & BITS.NULL_MOVE) {
      return SAN_NULLMOVE
    }

    let output = moveToSan(move, moves)

    this._makeMove(move)
    if (this.isCheck()) {
      if (this.isCheckmate()) {
        output += '#'
      } else {
        output += '+'
      }
    }
    this._undoMove()

    return output
  }

  // convert a move from Standard Algebraic Notation (SAN) to 0x88 coordinates
  private _moveFromSan(move: string, strict = false): InternalMove | null {
    return moveFromSan(move, this._turn, this._moves(), strict)
  }

  ascii(): string {
    let s = '   +------------------------+\n'
    for (let i = Ox88.a8; i <= Ox88.h1; i++) {
      // display the rank
      if (file(i) === 0) {
        s += ' ' + '87654321'[rank(i)] + ' |'
      }

      if (this._board[i]) {
        const piece = this._board[i].type
        const color = this._board[i].color
        const symbol =
          color === WHITE ? piece.toUpperCase() : piece.toLowerCase()
        s += ' ' + symbol + ' '
      } else {
        s += ' . '
      }

      if ((i + 1) & 0x88) {
        s += '|\n'
        i += 8
      }
    }
    s += '   +------------------------+\n'
    s += '     a  b  c  d  e  f  g  h'

    return s
  }

  perft(depth: number): number {
    const moves = this._moves({ legal: false })
    let nodes = 0
    const color = this._turn

    for (let i = 0, len = moves.length; i < len; i++) {
      this._makeMove(moves[i])
      if (!this._isKingAttacked(color)) {
        if (depth - 1 > 0) {
          nodes += this.perft(depth - 1)
        } else {
          nodes++
        }
      }
      this._undoMove()
    }

    return nodes
  }

  setTurn(color: Color): boolean {
    if (this._turn == color) {
      return false
    }

    this.move('--')
    return true
  }

  turn(): Color {
    return this._turn
  }

  board(): ({ square: Square; type: PieceSymbol; color: Color } | null)[][] {
    const output = []
    let row = []

    for (let i = Ox88.a8; i <= Ox88.h1; i++) {
      if (this._board[i] == null) {
        row.push(null)
      } else {
        row.push({
          square: algebraic(i),
          type: this._board[i].type,
          color: this._board[i].color,
        })
      }
      if ((i + 1) & 0x88) {
        output.push(row)
        row = []
        i += 8
      }
    }

    return output
  }

  squareColor(square: Square): 'light' | 'dark' | null {
    if (square in Ox88) {
      const sq = Ox88[square]
      return (rank(sq) + file(sq)) % 2 === 0 ? 'light' : 'dark'
    }

    return null
  }

  history(): string[]
  history({ verbose }: { verbose: true }): Move[]
  history({ verbose }: { verbose: false }): string[]
  history({ verbose }: { verbose: boolean }): string[] | Move[]
  history({ verbose = false }: { verbose?: boolean } = {}) {
    const reversedHistory = []
    const moveHistory = []

    while (this._history.length > 0) {
      reversedHistory.push(this._undoMove())
    }

    while (true) {
      const move = reversedHistory.pop()
      if (!move) {
        break
      }

      if (verbose) {
        moveHistory.push(this._createMove(move))
      } else {
        moveHistory.push(this._moveToSan(move, this._moves()))
      }
      this._makeMove(move)
    }

    return moveHistory
  }

  /*
   * Keeps track of position occurrence counts for the purpose of repetition
   * checking. Old positions are removed from the map if their counts are reduced to 0.
   */
  private _getPositionCount(hash: bigint): number {
    return this._positionCount.get(hash) ?? 0
  }

  private _incPositionCount() {
    this._positionCount.set(
      this._hash,
      (this._positionCount.get(this._hash) ?? 0) + 1,
    )
  }

  private _decPositionCount(hash: bigint) {
    const currentCount = this._positionCount.get(hash) ?? 0

    if (currentCount === 1) {
      this._positionCount.delete(hash)
    } else {
      this._positionCount.set(hash, currentCount - 1)
    }
  }

  private _pruneComments() {
    const reversedHistory = []
    const currentComments: Record<string, string> = {}

    const copyComment = (fen: string) => {
      if (fen in this._comments) {
        currentComments[fen] = this._comments[fen]
      }
    }

    while (this._history.length > 0) {
      reversedHistory.push(this._undoMove())
    }

    copyComment(this.fen())

    while (true) {
      const move = reversedHistory.pop()
      if (!move) {
        break
      }
      this._makeMove(move)
      copyComment(this.fen())
    }
    this._comments = currentComments
  }

  getComment(): string {
    return this._comments[this.fen()]
  }

  setComment(comment: string) {
    this._comments[this.fen()] = comment.replace('{', '[').replace('}', ']')
  }

  /**
   * @deprecated Renamed to `removeComment` for consistency
   */
  deleteComment(): string {
    return this.removeComment()
  }

  removeComment(): string {
    const comment = this._comments[this.fen()]
    delete this._comments[this.fen()]
    return comment
  }

  getComments(): { fen: string; comment: string }[] {
    this._pruneComments()
    return Object.keys(this._comments).map((fen: string) => {
      return { fen: fen, comment: this._comments[fen] }
    })
  }

  /**
   * @deprecated Renamed to `removeComments` for consistency
   */
  deleteComments(): { fen: string; comment: string }[] {
    return this.removeComments()
  }

  removeComments(): { fen: string; comment: string }[] {
    this._pruneComments()
    return Object.keys(this._comments).map((fen) => {
      const comment = this._comments[fen]
      delete this._comments[fen]
      return { fen: fen, comment: comment }
    })
  }

  setCastlingRights(
    color: Color,
    rights: Partial<Record<typeof KING | typeof QUEEN, boolean>>,
  ): boolean {
    for (const side of [KING, QUEEN] as const) {
      if (rights[side] !== undefined) {
        if (rights[side]) {
          this._castling[color] |= SIDES[side]
        } else {
          this._castling[color] &= ~SIDES[side]
        }
      }
    }

    this._updateCastlingRights()
    const result = this.getCastlingRights(color)

    return (
      (rights[KING] === undefined || rights[KING] === result[KING]) &&
      (rights[QUEEN] === undefined || rights[QUEEN] === result[QUEEN])
    )
  }

  getCastlingRights(color: Color): { [KING]: boolean; [QUEEN]: boolean } {
    return {
      [KING]: (this._castling[color] & SIDES[KING]) !== 0,
      [QUEEN]: (this._castling[color] & SIDES[QUEEN]) !== 0,
    }
  }

  moveNumber(): number {
    return this._moveNumber
  }
}
