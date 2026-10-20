import { describe, expect, test, vi } from "vitest";

import { Chess } from "@weshell/chess.js";
import {
  Chess as OpsChess,
  fen as opsFen,
  san as opsSan,
  type Position,
} from "chessops";

import {
  chess960FenByNumber,
  chess960SpnFromFen,
  getPgnVariantTag,
  moveToUci,
  randomChess960Fen,
} from "../src/chess";

const DEFAULT_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

/**
 * All 960 starting-rank arrangements in official SPN (Scharnagl starting
 * position number) order:
 *   N = lightBishop + 4*darkBishop + 16*queenIndex + 96*knightPattern
 * where the bishop indices run over [b,d,f,h] / [a,c,e,g], the queen
 * index over the 6 squares remaining after the bishops (left to right),
 * and the knight pattern over the lexicographic combinations of 2 out of
 * the 5 squares remaining after the queen. The last three squares get
 * R, K, R in that order.
 */
function chess960Arrangements(): string[] {
  const darkFiles = [0, 2, 4, 6];
  const lightFiles = [1, 3, 5, 7];
  const knightPatterns: [number, number][] = [
    [0, 1],
    [0, 2],
    [0, 3],
    [0, 4],
    [1, 2],
    [1, 3],
    [1, 4],
    [2, 3],
    [2, 4],
    [3, 4],
  ];

  const result: string[] = [];
  for (let spn = 0; spn < 960; spn++) {
    const knightIndex = Math.floor(spn / 96);
    let rest = spn % 96;
    const queenIndex = Math.floor(rest / 16);
    rest %= 16;
    const darkIndex = Math.floor(rest / 4);
    const lightIndex = rest % 4;

    const board: string[] = ["", "", "", "", "", "", "", ""];
    board[darkFiles[darkIndex]] = "B";
    board[lightFiles[lightIndex]] = "B";

    let remaining: number[] = [];
    for (let f = 0; f < 8; f++) {
      if (!board[f]) remaining.push(f);
    }
    board[remaining[queenIndex]] = "Q";

    remaining = [];
    for (let f = 0; f < 8; f++) {
      if (!board[f]) remaining.push(f);
    }
    const [knightA, knightB] = knightPatterns[knightIndex];
    board[remaining[knightA]] = "N";
    board[remaining[knightB]] = "N";

    remaining = [];
    for (let f = 0; f < 8; f++) {
      if (!board[f]) remaining.push(f);
    }
    board[remaining[0]] = "R";
    board[remaining[1]] = "K";
    board[remaining[2]] = "R";

    result.push(board.join(""));
  }
  return result;
}

/** Starting FEN for a 960 arrangement, in X-FEN ('KQkq') or Shredder form. */
function arrangementToFen(
  arrangement: string,
  format: "xfen" | "shredder",
): string {
  const files = "abcdefgh";
  const rookA = files[arrangement.indexOf("R")];
  const rookH = files[arrangement.lastIndexOf("R")];
  const castling =
    format === "xfen"
      ? "KQkq"
      : `${rookH.toUpperCase()}${rookA.toUpperCase()}${rookH.toLowerCase()}${rookA.toLowerCase()}`;
  const blackRank = arrangement.toLowerCase();
  return `${blackRank}/pppppppp/8/8/8/8/PPPPPPPP/${arrangement} w ${castling} - 0 1`;
}

function opsPosition(fen: string): Position {
  const setup = opsFen.parseFen(fen).unwrap();
  return OpsChess.fromSetup(setup).unwrap();
}

/**
 * Legal SAN set according to chessops. Promotion destinations are
 * expanded into all four promotions so the set is comparable with
 * chess.js `moves()`.
 */
function opsLegalSans(pos: Position): Set<string> {
  const sans = new Set<string>();
  for (const [from, dests] of pos.allDests()) {
    for (const to of dests) {
      if (pos.board.pawn.has(from) && (to < 8 || to >= 56)) {
        for (const promotion of [
          "queen",
          "rook",
          "bishop",
          "knight",
        ] as const) {
          sans.add(opsSan.makeSan(pos, { from, to, promotion }));
        }
      } else {
        sans.add(opsSan.makeSan(pos, { from, to }));
      }
    }
  }
  return sans;
}

function perftVendored(fen: string, depth: number): number {
  const chess = new Chess(fen);
  const recurse = (remaining: number): number => {
    if (remaining === 0) return 1;
    const moves = chess.moves({ verbose: true });
    if (remaining === 1) return moves.length;
    let nodes = 0;
    for (const move of moves) {
      // castling is played in the unambiguous "king takes rook" form so
      // it can never collide with a normal king move to the same square
      chess.move({
        from: move.from,
        to: move.rookFrom ?? move.to,
        promotion: move.promotion,
      });
      nodes += recurse(remaining - 1);
      chess.undo();
    }
    return nodes;
  };
  return recurse(depth);
}

function perftOps(pos: Position, depth: number): number {
  if (depth === 0) return 1;
  let nodes = 0;
  for (const [from, dests] of pos.allDests()) {
    for (const to of dests) {
      const promotions =
        pos.board.pawn.has(from) && (to < 8 || to >= 56)
          ? (["queen", "rook", "bishop", "knight"] as const)
          : [undefined];
      for (const promotion of promotions) {
        if (depth === 1) {
          nodes += 1;
          continue;
        }
        const child = pos.clone();
        child.play(promotion ? { from, to, promotion } : { from, to });
        nodes += perftOps(child, depth - 1);
      }
    }
  }
  return nodes;
}

/** deterministic PRNG */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d_2b_79_f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

describe("Chess960 vendored chess.js", () => {
  test("960 arrangement generator: count and SPN anchors", () => {
    const arrangements = chess960Arrangements();
    expect(arrangements).toHaveLength(960);
    expect(new Set(arrangements).size).toBe(960);
    expect(arrangements[0]).toBe("BBQNNRKR");
    expect(arrangements[518]).toBe("RNBQKBNR");
    expect(arrangements[959]).toBe("RKRNNQBB");
  });

  test("all 960 starts: X-FEN and Shredder load to the same position, round-trip, agree with chessops", () => {
    const arrangements = chess960Arrangements();
    for (const arrangement of arrangements) {
      const xfen = arrangementToFen(arrangement, "xfen");
      const shredder = arrangementToFen(arrangement, "shredder");

      const fromXfen = new Chess(xfen);
      const fromShredder = new Chess(shredder);

      // X-FEN round-trips byte-identically (both rooks outermost => KQkq)
      expect(fromXfen.fen(), `X-FEN round-trip failed: ${xfen}`).toBe(xfen);
      // Shredder form loads to the same position and normalizes to X-FEN
      expect(fromShredder.fen(), `Shredder load differs: ${shredder}`).toBe(
        xfen,
      );
      // chessops agrees byte-for-byte
      const pos = opsPosition(xfen);
      expect(opsFen.makeFen(pos.toSetup())).toBe(xfen);
    }
  }, 60_000);

  test("all 960 starts: legal move SAN sets match chessops", () => {
    const arrangements = chess960Arrangements();
    for (const arrangement of arrangements) {
      const fen = arrangementToFen(arrangement, "xfen");
      const ours = new Set(new Chess(fen).moves());
      const theirs = opsLegalSans(opsPosition(fen));
      expect([...ours].sort(), `SAN set differs for ${fen}`).toEqual(
        [...theirs].sort(),
      );
    }
  }, 60_000);

  test("castling scenario: adjacent rook, king 'captures' its own rook (kingTo === rookFrom)", () => {
    // white king f1, rook g1, castling right on g1; normalizes to 'K'
    const fen = "4k3/8/8/8/8/8/8/5KR1 w G - 0 1";
    const normalized = "4k3/8/8/8/8/8/8/5KR1 w K - 0 1";
    const chess = new Chess(fen);
    expect(chess.fen()).toBe(normalized);
    expect(chess.moves()).toContain("O-O");

    // object form: king dropped onto its own rook
    const move = chess.move({ from: "f1", to: "g1" });
    expect(move.flags).toContain("k");
    expect(move.rookFrom).toBe("g1");
    expect(chess.fen()).toBe("4k3/8/8/8/8/8/8/5RK1 b - - 1 1");

    // undo restores everything
    chess.undo();
    expect(chess.fen()).toBe(normalized);

    // SAN form as well
    chess.move("O-O");
    expect(chess.fen()).toBe("4k3/8/8/8/8/8/8/5RK1 b - - 1 1");
  });

  test("castling scenario: queenside with full overlap (rookTo === kingFrom, kingTo === rookFrom)", () => {
    // white king d1, rook c1, castling right on c1; normalizes to 'Q'
    const fen = "4k3/8/8/8/8/8/8/2RK4 w C - 0 1";
    const normalized = "4k3/8/8/8/8/8/8/2RK4 w Q - 0 1";
    const chess = new Chess(fen);
    expect(chess.fen()).toBe(normalized);
    const move = chess.move("O-O-O");
    expect(move.flags).toContain("q");
    expect(move.rookFrom).toBe("c1");
    // king lands on c1, rook lands on d1
    expect(chess.fen()).toBe("4k3/8/8/8/8/8/8/2KR4 b - - 1 1");

    chess.undo();
    expect(chess.fen()).toBe(normalized);
  });

  test("castling scenario: king starts between the two castling destination squares", () => {
    // white king d1, rook h1: O-O crosses e1/f1/g1; rook h1->f1 passes g1
    const fen = "4k3/8/8/8/8/8/8/3K3R w H - 0 1";
    const normalized = "4k3/8/8/8/8/8/8/3K3R w K - 0 1";
    const chess = new Chess(fen);
    expect(chess.fen()).toBe(normalized);
    expect(chess.moves()).toContain("O-O");
    chess.move("O-O");
    expect(chess.fen()).toBe("4k3/8/8/8/8/8/8/5RK1 b - - 1 1");
    chess.undo();
    expect(chess.fen()).toBe(normalized);
  });

  test("castling scenario: king passes over its own rook", () => {
    // white king c1, rook d1 (kingside right): O-O -> Kg1, Rf1, king crosses d1
    const fen = "4k3/8/8/8/8/8/8/2KR4 w D - 0 1";
    const normalized = "4k3/8/8/8/8/8/8/2KR4 w K - 0 1";
    const chess = new Chess(fen);
    expect(chess.fen()).toBe(normalized);
    expect(chess.moves()).toContain("O-O");
    chess.move("O-O");
    expect(chess.fen()).toBe("4k3/8/8/8/8/8/8/5RK1 b - - 1 1");
    chess.undo();
    expect(chess.fen()).toBe(normalized);
  });

  test("castling scenario: destination attacked only after the rook relocates", () => {
    // white king f1, rook b1 (queenside right), black rook a1:
    // O-O-O would put the king on c1, which black's a1 rook attacks
    // once the b1 rook has vacated the ray. Must be illegal.
    const fen = "7k/8/8/8/8/8/8/rR4K1 w B - 0 1";
    const chess = new Chess(fen);
    expect(chess.moves()).not.toContain("O-O-O");
    // chessops agrees on the full SAN set
    expect(opsLegalSans(opsPosition(fen))).toEqual(new Set(chess.moves()));

    // without the black rook it is legal
    const legal = "7k/8/8/8/8/8/8/1R4K1 w B - 0 1";
    expect(new Chess(legal).moves()).toContain("O-O-O");
  });

  test("castling scenario: X-FEN K/Q map to outermost rooks, not edge files", () => {
    // white king d1, rooks b1 and g1: 'K' -> g1, 'Q' -> b1
    const fen = "4k3/8/8/8/8/8/8/1R1K1R2 w KQ - 0 1";
    const chess = new Chess(fen);
    expect(chess.moves()).toContain("O-O");
    expect(chess.moves()).toContain("O-O-O");

    const short = chess.move("O-O");
    expect(short.rookFrom).toBe("f1");
    // the king moved, so all white rights are gone
    expect(chess.fen()).toBe("4k3/8/8/8/8/8/8/1R3RK1 b - - 1 1");
    chess.undo();

    const long = chess.move("O-O-O");
    expect(long.rookFrom).toBe("b1");
    expect(chess.fen()).toBe("4k3/8/8/8/8/8/8/2KR1R2 b - - 1 1");
  });

  test("castling rights maintenance: rook moves, rook is captured, king moves", () => {
    // moving the a1 rook drops only the queenside right
    let fen = "4k3/8/8/8/8/8/8/R3K2R w KQ - 0 1";
    let chess = new Chess(fen);
    expect(chess.fen()).toBe(fen);
    chess.move("Ra2");
    expect(chess.fen()).toBe("4k3/8/8/8/8/8/R7/4K2R b K - 1 1");
    chess.undo();
    expect(chess.fen()).toBe(fen);

    // capturing the rights rook drops the right
    fen = "4k3/7r/8/8/8/8/8/R3K2R b K - 0 1";
    chess = new Chess(fen);
    chess.move("Rxh1");
    expect(chess.fen()).toBe("4k3/8/8/8/8/8/8/R3K2r w - - 0 2");

    // king move drops all rights
    fen = "4k3/8/8/8/8/8/8/R3K2R w KQ - 0 1";
    chess = new Chess(fen);
    chess.move("Kd2");
    expect(chess.fen()).toBe("4k3/8/8/8/8/8/3K4/R6R b - - 1 1");
  });

  test("inner rook right is emitted as a Shredder file letter", () => {
    // white rooks g1 and h1, right only on g1: g1 is not the outermost
    // rook, so fen() must keep the Shredder letter 'G'
    const fen = "4k3/8/8/8/8/8/8/R3K1RR w G - 0 1";
    const chess = new Chess(fen);
    expect(chess.fen()).toBe(fen);
    // chessops agrees
    const pos = opsPosition(fen);
    expect(opsFen.makeFen(pos.toSetup())).toBe(fen);

    // outermost rook right is normalized to X-FEN
    const fenH = "4k3/8/8/8/8/8/8/R3K1RR w H - 0 1";
    expect(new Chess(fenH).fen()).toBe("4k3/8/8/8/8/8/8/R3K1RR w K - 0 1");
  });

  test("mid-game castling: Shredder and X-FEN forms are equivalent", () => {
    const shredder = "r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w Hh - 0 1";
    const xfen = "r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w Kk - 0 1";
    expect(new Chess(shredder).fen()).toBe(xfen);
    expect(new Chess(xfen).fen()).toBe(xfen);
  });

  test("standard chess regression: initial position, castling, perft", () => {
    const chess = new Chess();
    expect(chess.fen()).toBe(DEFAULT_FEN);
    expect(chess.moves().length).toBe(20);

    // a standard game containing both O-O and O-O-O
    const game = "e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 d6 c3 O-O";
    for (const san of game.split(" ")) chess.move(san);
    expect(chess.fen()).toBe(
      "r1bq1rk1/2p1bppp/p1np1n2/1p2p3/4P3/1BP2N2/PP1P1PPP/RNBQR1K1 w - - 1 9",
    );

    // standard perft(3)
    expect(perftVendored(DEFAULT_FEN, 3)).toBe(8902);
  });

  test("all 960 starts: perft(2) matches chessops", () => {
    const arrangements = chess960Arrangements();
    for (const arrangement of arrangements) {
      const fen = arrangementToFen(arrangement, "xfen");
      const pos = opsPosition(fen);
      expect(perftVendored(fen, 2), `perft(2) differs for ${fen}`).toBe(
        perftOps(pos, 2),
      );
    }
  }, 180_000);

  test("random playouts agree with chessops (SAN sets, FEN, undo)", () => {
    const rng = mulberry32(0xc0_ff_ee);
    const arrangements = chess960Arrangements();
    const starts = [DEFAULT_FEN];
    for (let i = 0; i < 25; i++) {
      starts.push(
        arrangementToFen(arrangements[Math.floor(rng() * 960)], "xfen"),
      );
    }

    for (const start of starts) {
      const chess = new Chess(start);
      const pos = opsPosition(start);
      const history: string[] = [];

      for (let ply = 0; ply < 80; ply++) {
        const ours = [...new Set(chess.moves())].sort();
        const theirs = [...opsLegalSans(pos)].sort();
        expect(ours, `SAN sets differ at ${chess.fen()}`).toEqual(theirs);

        if (ours.length === 0) break;

        const san = ours[Math.floor(rng() * ours.length)];
        chess.move(san);
        history.push(san);

        const parsed = opsSan.parseSan(pos, san);
        if (!parsed) {
          throw new Error(
            `chessops could not parse ${san} at ${opsFen.makeFen(pos.toSetup())}`,
          );
        }
        pos.play(parsed);

        expect(
          chess.fen(),
          `FEN mismatch after ${history.length} plies (${history.join(" ")})`,
        ).toBe(opsFen.makeFen(pos.toSetup()));
      }

      // undo the whole game and land back on the start position
      while (chess.undo()) {
        /* drained */
      }
      expect(chess.fen()).toBe(start);
    }
  }, 120_000);

  test("validateFen rejects invalid castling fields", () => {
    expect(() => new Chess("4k3/8/8/8/8/8/8/4K3 w I - 0 1")).toThrow();
    expect(() => new Chess("4k3/8/8/8/8/8/8/4K3 w X9 - 0 1")).toThrow();
    // Shredder letters are accepted
    expect(() => new Chess("4k3/8/8/8/8/8/8/4K3 w Hh - 0 1")).not.toThrow();
  });

  test("history and PGN output include castling moves", () => {
    const fen = "4k3/8/8/8/8/8/8/2RK4 w C - 0 1";
    const chess = new Chess(fen);
    chess.move("O-O-O");
    expect(chess.history()).toEqual(["O-O-O"]);
    expect(chess.history({ verbose: true })[0].rookFrom).toBe("c1");
    expect(chess.pgn()).toContain("1. O-O-O");
  });

  test("castling via object form: king-takes-rook drop works in every drag scenario", () => {
    // Standard-style drag: king lands on its castling destination.
    let chess = new Chess("4k3/8/8/8/8/8/8/4K2R w K - 0 1");
    let move = chess.move({ from: "e1", to: "g1" });
    expect(move.san).toBe("O-O");
    expect(move.rookFrom).toBe("h1");

    // King-takes-rook drop: king e1 onto its own rook h1.
    chess = new Chess("4k3/8/8/8/8/8/8/4K2R w K - 0 1");
    move = chess.move({ from: "e1", to: "h1" });
    expect(move.san).toBe("O-O");

    // King already on g1 (stationary castling): the only operable drop is
    // king-takes-rook — dragging to g1 (move.to) would be a no-op in the UI.
    chess = new Chess("4k3/8/8/8/8/8/8/6KR w K - 0 1");
    move = chess.move({ from: "g1", to: "h1" });
    expect(move.san).toBe("O-O");
    expect(move.from).toBe("g1");
    expect(move.to).toBe("g1");
    expect(move.rookFrom).toBe("h1");
    expect(chess.fen()).toBe("4k3/8/8/8/8/8/8/5RK1 b - - 1 1");

    // Queen-side stationary variant: king c1, rook a1.
    chess = new Chess("4k3/8/8/8/8/8/8/R1K5 w Q - 0 1");
    move = chess.move({ from: "c1", to: "a1" });
    expect(move.san).toBe("O-O-O");
    expect(move.to).toBe("c1");
    expect(move.rookFrom).toBe("a1");
  });
});

describe("Chess960 plugin adapter", () => {
  test("moveToUci encodes castling king-takes-rook, promotions suffixed", () => {
    const chess = new Chess("4k3/8/8/8/8/8/8/5KR1 w K - 0 1");
    const castle = chess.move("O-O");
    expect(moveToUci(castle)).toBe("f1g1");

    const promo = new Chess("k7/4P3/8/8/8/8/8/4K3 w - - 0 1").move("e8=Q");
    expect(moveToUci(promo)).toBe("e7e8q");

    const quiet = new Chess().move("e4");
    expect(moveToUci(quiet)).toBe("e2e4");
  });

  test("getPgnVariantTag detects 960 starts and rejects others", () => {
    expect(getPgnVariantTag(arrangementToFen("BBQNNRKR", "xfen"))).toBe(
      "Chess960",
    );
    expect(getPgnVariantTag(arrangementToFen("RKRNNQBB", "shredder"))).toBe(
      "Chess960",
    );
    // standard start is never tagged
    expect(getPgnVariantTag(DEFAULT_FEN)).toBeNull();
    // 960 position after 1. e4: no longer a start shape
    expect(
      getPgnVariantTag(
        "bbqnnrkr/pppppppp/8/8/4P3/8/PPPP1PPP/BBQNNRKR b KQkq - 0 1",
      ),
    ).toBeNull();
    // bishops on the same color (b1/d1)
    expect(getPgnVariantTag(arrangementToFen("RBQBNRKN", "xfen"))).toBeNull();
    // king outside the rooks
    expect(getPgnVariantTag(arrangementToFen("KRNNQBBR", "xfen"))).toBeNull();
    // empty board
    expect(getPgnVariantTag("4k3/8/8/8/8/8/8/4K3 w - - 0 1")).toBeNull();
  });

  test("randomChess960Fen produces valid, tagged 960 starts", () => {
    const spy = vi.spyOn(Math, "random").mockImplementation(mulberry32(0x9_60));
    try {
      const seen = new Set<string>();
      for (let i = 0; i < 200; i++) {
        const fen = randomChess960Fen();
        seen.add(fen);
        // chessops agrees byte-for-byte with the generated FEN
        const pos = opsPosition(fen);
        expect(opsFen.makeFen(pos.toSetup()), `chessops differs: ${fen}`).toBe(
          fen,
        );
        // the adapter recognizes its own output; the standard position
        // (SPN 518) is part of the 960 pool and correctly stays untagged
        if (fen === DEFAULT_FEN) {
          expect(getPgnVariantTag(fen)).toBeNull();
        } else {
          expect(getPgnVariantTag(fen)).toBe("Chess960");
        }
        // legal move sets agree with chessops (start-position move
        // counts vary in 960, so compare the actual SAN sets)
        const chess = new Chess(fen);
        expect([...new Set(chess.moves())].sort()).toEqual(
          [...opsLegalSans(opsPosition(fen))].sort(),
        );
      }
      // 200 draws from 960 positions should yield ~180 distinct FENs
      expect(seen.size).toBeGreaterThan(150);
    } finally {
      spy.mockRestore();
    }
  });

  test("chess960FenByNumber decodes the SPN anchors and rejects bad input", () => {
    expect(chess960FenByNumber(0)).toBe(
      "bbqnnrkr/pppppppp/8/8/8/8/PPPPPPPP/BBQNNRKR w KQkq - 0 1",
    );
    expect(chess960FenByNumber(518)).toBe(DEFAULT_FEN);
    expect(chess960FenByNumber(959)).toBe(
      "rkrnnqbb/pppppppp/8/8/8/8/PPPPPPPP/RKRNNQBB w KQkq - 0 1",
    );
    expect(chess960FenByNumber(-1)).toBeNull();
    expect(chess960FenByNumber(960)).toBeNull();
    expect(chess960FenByNumber(518.5)).toBeNull();
    expect(chess960FenByNumber(Number.NaN)).toBeNull();
  });

  test("all 960 numbers: decode matches the enumeration, chessops agrees, encode inverts", () => {
    const arrangements = chess960Arrangements();
    const seen = new Set<string>();
    for (let spn = 0; spn < 960; spn++) {
      const fen = chess960FenByNumber(spn);
      expect(fen, `no FEN for SPN ${spn}`).not.toBeNull();
      const f = fen as string;
      // the board matches this file's independent enumeration
      expect(f.split(" ")[0], `board differs for SPN ${spn}`).toBe(
        `${arrangements[spn].toLowerCase()}/pppppppp/8/8/8/8/PPPPPPPP/${arrangements[spn]}`,
      );
      // chessops agrees byte-for-byte
      const pos = opsPosition(f);
      expect(opsFen.makeFen(pos.toSetup()), `chessops differs: ${f}`).toBe(f);
      // encoding inverts decoding
      expect(chess960SpnFromFen(f), `SPN round-trip failed: ${f}`).toBe(spn);
      seen.add(f);
      // variant tagging: the standard position (SPN 518) stays untagged
      expect(getPgnVariantTag(f)).toBe(spn === 518 ? null : "Chess960");
    }
    expect(seen.size).toBe(960);
  }, 120_000);

  test("chess960SpnFromFen resolves starts and rejects others", () => {
    expect(chess960SpnFromFen(DEFAULT_FEN)).toBe(518);
    expect(chess960SpnFromFen(arrangementToFen("BBQNNRKR", "xfen"))).toBe(0);
    expect(chess960SpnFromFen(arrangementToFen("RKRNNQBB", "shredder"))).toBe(
      959,
    );
    // mid-game (after 1. e4) is no longer a start shape
    expect(
      chess960SpnFromFen(
        "bbqnnrkr/pppppppp/8/8/4P3/8/PPPP1PPP/BBQNNRKR b KQkq - 0 1",
      ),
    ).toBeNull();
    // non-mirrored backranks
    expect(
      chess960SpnFromFen(
        "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/BBQNNRKR w KQkq - 0 1",
      ),
    ).toBeNull();
    // empty board
    expect(chess960SpnFromFen("4k3/8/8/8/8/8/8/4K3 w - - 0 1")).toBeNull();
  });
});
