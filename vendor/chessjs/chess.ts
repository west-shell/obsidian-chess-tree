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

/*
 * Barrel entry for the vendored, Chess960-patched chess.js.
 *
 * The implementation lives in ./src/ as a set of modules (see README.md):
 *   types.ts     constants and type definitions (0x88 board, move flags)
 *   board.ts     0x88 square helpers (rank/file/algebraic/swapColor)
 *   hash.ts      zobrist hashing (xoroshiro128 key stream)
 *   attack.ts    attack detection (pure functions over the board)
 *   movegen.ts   pseudo-legal move generation incl. Chess960 castling
 *   fen.ts       FEN validation/serialization + castling field parse/emit
 *   notation.ts  SAN generation/parsing (pure helpers)
 *   move.ts      the public Move class
 *   chess.ts     the stateful Chess class (re-exports the public API)
 *
 * The 'chess.js' module id maps here via vite.config.ts (resolve.alias)
 * and tsconfig.json (compilerOptions.paths); the public API surface is
 * unchanged.
 */
export * from './src/chess'
