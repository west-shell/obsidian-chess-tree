import { describe, expect, test } from "vitest";

import { Chess, type Move } from "../src/chess";
import type { ChessNode, NodeEval, PvLine } from "../src/types";
import {
  deriveChildEval,
  evalFromPvLine,
  fillChildrenFromEval,
  matchPvLine,
} from "../src/modules/Engine/pv-cache";

const pv = (score: number, moves: string[], scoreType = "cp"): PvLine => ({
  score,
  scoreType,
  moves,
});

const ev = (score: number, depth: number, pvs?: PvLine[]): NodeEval => ({
  score,
  scoreType: "cp",
  depth,
  pvs,
});

function play(san: string): Move {
  const chess = new Chess();
  const move = chess.move(san);
  if (!move) throw new Error(`bad san: ${san}`);
  return move;
}

function childNode(move: Move, eval_?: NodeEval): ChessNode {
  return {
    id: `node-${move.from}${move.to}`,
    fen: move.after,
    move,
    color: move.color === "w" ? "white" : "black",
    children: [],
    comments: [],
    eval: eval_,
  };
}

describe("evalFromPvLine", () => {
  test("shifts the line by one move", () => {
    const derived = evalFromPvLine(pv(35, ["e2e4", "e7e5", "g1f3"]), 18);
    expect(derived.score).toBe(35);
    expect(derived.scoreType).toBe("cp");
    expect(derived.depth).toBe(18);
    expect(derived.bestmove).toBe("e7e5");
    expect(derived.ponder).toBe("g1f3");
    expect(derived.pvs?.[0].moves).toEqual(["e7e5", "g1f3"]);
    expect(derived.pvs?.[0].score).toBe(35);
  });

  test("flags the eval as derived (not searched at this node)", () => {
    const derived = evalFromPvLine(pv(35, ["e2e4", "e7e5"]), 18);
    expect(derived.derived).toBe(true);
  });

  test("keeps mate scores unchanged in white view", () => {
    const derived = evalFromPvLine(pv(3, ["h2h4", "a7a6", "h4h5"], "mate"), 20);
    expect(derived.scoreType).toBe("mate");
    expect(derived.score).toBe(3);
    expect(derived.bestmove).toBe("a7a6");
  });

  test("single-move line yields eval without bestmove or pvs", () => {
    const derived = evalFromPvLine(pv(1, ["e7e8q"], "mate"), 15);
    expect(derived.bestmove).toBeUndefined();
    expect(derived.ponder).toBeUndefined();
    expect(derived.pvs).toBeUndefined();
    expect(derived.score).toBe(1);
    expect(derived.depth).toBe(15);
  });
});

describe("matchPvLine", () => {
  const parent = ev(35, 18, [
    pv(35, ["e2e4", "e7e5"]),
    pv(12, ["d2d4", "d7d5"]),
  ]);

  test("finds the line starting with the move", () => {
    expect(matchPvLine(parent, "d2d4")?.moves).toEqual(["d2d4", "d7d5"]);
  });

  test("returns undefined for uncovered move, missing pvs or empty uci", () => {
    expect(matchPvLine(parent, "c2c4")).toBeUndefined();
    expect(matchPvLine(ev(0, 18), "e2e4")).toBeUndefined();
    expect(matchPvLine(undefined, "e2e4")).toBeUndefined();
    expect(matchPvLine(parent, "")).toBeUndefined();
  });
});

describe("deriveChildEval", () => {
  test("derives with the parent search's depth", () => {
    const parent = ev(35, 18, [pv(35, ["e2e4", "e7e5", "g1f3"])]);
    const derived = deriveChildEval(parent, "e2e4");
    expect(derived?.depth).toBe(18);
    expect(derived?.bestmove).toBe("e7e5");
    expect(derived?.pvs?.[0].moves).toEqual(["e7e5", "g1f3"]);
  });

  test("returns undefined without a parent eval or a pv match", () => {
    expect(deriveChildEval(undefined, "e2e4")).toBeUndefined();
    expect(
      deriveChildEval(ev(35, 18, [pv(35, ["d2d4"])]), "e2e4"),
    ).toBeUndefined();
  });
});

describe("fillChildrenFromEval", () => {
  const e4 = play("e4");
  const d4 = play("d4");
  const c4 = play("c4");
  // MultiPV lines: e4 is best, d4 second; c4 not covered.
  const parentEval = ev(35, 18, [
    pv(35, ["e2e4", "e7e5", "g1f3"]),
    pv(12, ["d2d4", "d7d5", "c2c4"]),
  ]);

  function parentWith(children: ChessNode[]): ChessNode {
    return {
      id: "root",
      fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
      move: null,
      color: null,
      children,
      comments: [],
      eval: parentEval,
    };
  }

  test("fills evals for children covered by the pv lines", () => {
    const parent = parentWith([childNode(e4), childNode(d4), childNode(c4)]);
    expect(fillChildrenFromEval(parent)).toBe(true);
    expect(parent.children[0].eval?.score).toBe(35);
    expect(parent.children[0].eval?.depth).toBe(18);
    expect(parent.children[0].eval?.bestmove).toBe("e7e5");
    expect(parent.children[0].eval?.derived).toBe(true);
    expect(parent.children[1].eval?.score).toBe(12);
    expect(parent.children[1].eval?.bestmove).toBe("d7d5");
    expect(parent.children[2].eval).toBeUndefined();
  });

  test("never overwrites an eval that is at least as deep", () => {
    const deep = ev(-20, 22);
    const parent = parentWith([childNode(e4, deep)]);
    expect(fillChildrenFromEval(parent)).toBe(false);
    expect(parent.children[0].eval?.depth).toBe(22);
    expect(parent.children[0].eval?.score).toBe(-20);
  });

  test("overwrites shallower evals (e.g. parsed depth 0)", () => {
    const shallow = ev(0, 0);
    const parent = parentWith([childNode(e4, shallow)]);
    expect(fillChildrenFromEval(parent)).toBe(true);
    expect(parent.children[0].eval?.depth).toBe(18);
    expect(parent.children[0].eval?.score).toBe(35);
  });

  test("does nothing without pvs on the parent eval", () => {
    const parent = parentWith([childNode(e4)]);
    parent.eval = ev(35, 18);
    expect(fillChildrenFromEval(parent)).toBe(false);
    expect(parent.children[0].eval).toBeUndefined();
  });
});
