import { describe, expect, test } from "vitest";

import { getAutoResult } from "../src/chess";
import { PGNParser } from "../src/modules/Source/parser";
import type { ChessNode } from "../src/types";
import {
  branchTip,
  migrateBranchResult,
} from "../src/modules/Tree/Actions/result";
import { stringifyPGN } from "../src/modules/Tree/Actions/stringify-pgn";

function makeNode(id: string, result?: string): ChessNode {
  return {
    id,
    fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    move: null,
    color: null,
    children: [],
    comments: [],
    result,
  };
}

describe("getAutoResult", () => {
  test("checkmate against black forces 1-0", () => {
    // Scholar's mate: Qxf7#, black to move.
    expect(
      getAutoResult(
        "r1bqkb1r/pppp1Qpp/2n2n2/4p3/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 0 4",
      ),
    ).toBe("1-0");
  });

  test("checkmate against white forces 0-1", () => {
    // Fool's mate: Qh4#, white to move.
    expect(
      getAutoResult(
        "rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3",
      ),
    ).toBe("0-1");
  });

  test("stalemate forces a draw", () => {
    // Black king a8: not in check, a7/b7/b8 all covered by the queen.
    expect(getAutoResult("k7/8/1Q6/8/8/8/8/K7 b - - 0 1")).toBe("1/2-1/2");
  });

  test("ongoing positions and invalid FENs return null", () => {
    expect(
      getAutoResult("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"),
    ).toBeNull();
    expect(getAutoResult("not a fen")).toBeNull();
  });
});

describe("branchTip", () => {
  test("follows the first-child chain to the line's last node", () => {
    const parser = new PGNParser("1. e4 e5 2. Nf3 (2. Bc4 Bc5) Nc6");
    const root = parser.getRoot();
    const e5 = root.children[0].children[0];
    // Mainline continues Nf3 → Nc6, not into the Bc4 variation.
    expect(branchTip(root).id).toBe(
      root.children[0].children[0].children[0].children[0].id,
    );
    expect(branchTip(e5).id).toBe(e5.children[0].children[0].id);
  });

  test("returns the node itself when the line has no moves past it", () => {
    const parser = new PGNParser("1. e4 e5 2. Nf3 Nc6");
    const root = parser.getRoot();
    const tip = branchTip(root);
    expect(tip.children).toHaveLength(0);
    expect(tip.id).toBe(
      root.children[0].children[0].children[0].children[0].id,
    );
  });
});

describe("migrateBranchResult", () => {
  test("extending the line (first child) carries the result to the new tip", () => {
    const parent = makeNode("p", "1-0");
    const child = makeNode("c");
    parent.children.push(child);
    migrateBranchResult(parent, child);
    expect(parent.result).toBeUndefined();
    expect(child.result).toBe("1-0");
  });

  test("a new variation (second child) never inherits the result", () => {
    // A parent that keeps its result while already having a line going
    // (mid-line result): opening a second variation must not carry the
    // result over — only the first-child extension does.
    const parent = makeNode("p", "1-0");
    const first = makeNode("c1");
    parent.children.push(first);
    const second = makeNode("c2");
    parent.children.push(second);
    migrateBranchResult(parent, second);
    expect(parent.result).toBe("1-0");
    expect(first.result).toBeUndefined();
    expect(second.result).toBeUndefined();
  });

  test("does nothing when the parent carries no result", () => {
    const parent = makeNode("p");
    const child = makeNode("c");
    parent.children.push(child);
    migrateBranchResult(parent, child);
    expect(parent.result).toBeUndefined();
    expect(child.result).toBeUndefined();
  });
});

describe("per-branch result serialization", () => {
  test("result on a branch tip round-trips through stringify/parse", () => {
    const parser = new PGNParser("1. e4 e5 2. Nf3 Nc6");
    const root = parser.getRoot();
    branchTip(root).result = "1/2-1/2";
    const out = stringifyPGN(root);
    expect(out).toContain("1/2-1/2");
    const reRoot = new PGNParser(out).getRoot();
    expect(branchTip(reRoot).result).toBe("1/2-1/2");
  });

  test("variation and mainline keep independent results", () => {
    const parser = new PGNParser("1. e4 e5 2. Nf3 (2. Bc4 Bc5) Nc6");
    const root = parser.getRoot();
    branchTip(root).result = "1-0";
    // Variation tip: e5's second child line Bc4 → Bc5.
    const bc4 = root.children[0].children[0].children[1];
    branchTip(bc4).result = "0-1";
    const out = stringifyPGN(root);
    const reRoot = new PGNParser(out).getRoot();
    expect(branchTip(reRoot).result).toBe("1-0");
    const reBc4 = reRoot.children[0].children[0].children[1];
    expect(branchTip(reBc4).result).toBe("0-1");
  });

  test("a result on a mid-line node is not serialized", () => {
    const parser = new PGNParser("1. e4 e5 2. Nf3 Nc6");
    const root = parser.getRoot();
    // Documented constraint: only leaf results serialize, which is why
    // set-result targets the branch tip.
    root.children[0].children[0].result = "1-0";
    const out = stringifyPGN(root);
    expect(out).not.toContain("1-0");
    expect(out.trimEnd().endsWith("*")).toBe(true);
  });
});
