# chess.js (vendored, Chess960-patched fork)

Vendored copy of [chess.js](https://github.com/jhlywa/chess.js) **v1.4.0**
(BSD-2-Clause, see LICENSE), patched with Chess960 (Fischer Random) support
modeled on [chessops](https://github.com/niklasf/chessops).

Imported throughout the plugin via the module id `chess.js`, remapped here by
`vite.config.ts` (`resolve.alias`) and `tsconfig.json` (`compiler.paths`).

## Module layout

The implementation is split into focused modules under `src/` (same pattern
as the vendored xiangqi engine in the sibling obsidian-xiangqi repo); the root
`chess.ts` is a barrel that re-exports the full public API:

| File          | Contents                                                        |
| ------------- | --------------------------------------------------------------- |
| `src/types.ts`    | constants and type definitions (0x88 board, move flags, default FEN) |
| `src/board.ts`    | 0x88 square helpers: `rank`/`file`/`algebraic`/`swapColor`/`isDigit` |
| `src/hash.ts`     | zobrist hashing (xoroshiro128 key stream, pure key functions) |
| `src/attack.ts`   | attack detection: `attacked`, `isKingAttacked` (pure)          |
| `src/movegen.ts`  | pseudo-legal move generation incl. Chess960 castling (pure)    |
| `src/fen.ts`      | FEN validation/serialization, castling field parse/emit        |
| `src/notation.ts` | SAN generation/parsing helpers (pure)                          |
| `src/move.ts`     | the public `Move` class                                         |
| `src/chess.ts`    | the stateful `Chess` class + public API re-exports              |
| `pgn.js`/`pgn.d.ts` | PGN parser/serializer (vendored upstream module)             |

Pure functions take the relevant state (`board`, `kings`, `castling`,
`castlingRooks`, ...) explicitly; make/undo-dependent logic (legality
filtering, check/mate suffixes, en-passant FEN emission) stays in the
`Chess` class.

## Modifications vs upstream 1.4.0

- Castling rights are tracked per **rook square** instead of fixed K/Q bits.
- FEN castling field accepts X-FEN (`KQkq` = outermost rook of each side of
  the king) **and** Shredder file letters (`AHah` style). Impossible rights
  are dropped silently on load (chessops-style leniency) instead of throwing.
- Castling move generation/make/undo follow Chess960 rules: king always lands
  on the g/c file, rook on the f/d file; path emptiness and attack rules per
  chessops.
- `fen()` emits X-FEN (`K`/`Q` for outermost rooks, file letters otherwise),
  aligned with chessops `makeFen`; byte-identical to upstream for standard
  positions.
- `Move` exposes an optional `rookFrom` square on castling moves (king
  destination stays in `to`).
- `validateFen` accepts Shredder/X-FEN castling strings.
- `move({ from, to })` object form also accepts the "king takes rook" castling
  notation used by chessground in Chess960 mode (falls back to matching the
  generated castling move when no normal move matches).
- Internal move objects carry an optional `rookFrom` 0x88 square on castling
  moves; history snapshots additionally store the castling rook squares.

## Invariants kept

- Public API surface unchanged: `moves()`, `move()`, `fen()`, `load()`,
  `pgn()`, `loadPgn()`, `undo()`, `history()` behave as upstream for standard
  chess (FEN bytes identical, SAN identical).
- Castling SAN stays `O-O`/`O-O-O`; `Move.to` is always the king destination
  (g/c file), `Move.rookFrom` carries the rook origin.
