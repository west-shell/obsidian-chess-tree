import { describe, expect, test } from "vitest";

import { PGNParser } from "../src/modules/Source/parser";
import { stringifyPGN } from "../src/utils/stringify-pgn";

function parseAndStringify(pgn: string, includeEval = true): string {
  const parser = new PGNParser(pgn);
  return stringifyPGN(parser.getRoot(), includeEval);
}

function collectMainline(root: ReturnType<PGNParser["getRoot"]>): string[] {
  const sans: string[] = [];
  let node = root;
  while (node.children.length > 0) {
    if (node.children[0].move) {
      sans.push(node.children[0].move.san);
    }
    node = node.children[0];
  }
  return sans;
}

function collectComments(root: ReturnType<PGNParser["getRoot"]>): string[] {
  const comments: string[] = [];
  function dfs(node: typeof root) {
    if (node.comments?.length) {
      comments.push(...node.comments);
    }
    for (const child of node.children) dfs(child);
  }
  dfs(root);
  return comments;
}

function countNodes(root: ReturnType<PGNParser["getRoot"]>): number {
  let count = 0;
  function dfs(node: typeof root) {
    if (node.move) count++;
    for (const child of node.children) dfs(child);
  }
  dfs(root);
  return count;
}

describe("PGN round-trip consistency", () => {
  test("simple mainline round-trips", () => {
    const original = "1. e4 e5 2. Nf3 Nc6";
    const exported = parseAndStringify(original);
    const reParser = new PGNParser(exported);

    expect(collectMainline(reParser.getRoot())).toEqual(["e4", "e5", "Nf3", "Nc6"]);
    expect(countNodes(reParser.getRoot())).toBe(4);
  });

  test("mainline with result round-trips", () => {
    const original = "1. e4 e5 2. Nf3 Nc6 1-0";
    const exported = parseAndStringify(original);
    const reParser = new PGNParser(exported);

    expect(collectMainline(reParser.getRoot())).toEqual(["e4", "e5", "Nf3", "Nc6"]);
  });

  test("single variation round-trips", () => {
    const original = "1. e4 e5 2. Nf3 (2. Bc4 Bc5) Nc6";
    const exported = parseAndStringify(original);
    const reParser = new PGNParser(exported);

    expect(collectMainline(reParser.getRoot())).toEqual(["e4", "e5", "Nf3", "Nc6"]);
    const e5 = reParser.getRoot().children[0].children[0];
    expect(e5.children).toHaveLength(2);
    expect(e5.children[0].move?.san).toBe("Nf3");
    expect(e5.children[1].move?.san).toBe("Bc4");
  });

  test("multiple variations round-trip", () => {
    const original = "1. e4 e5 2. Nf3 (2. Bc4 Bc5) (2. d4 exd4) Nc6";
    const exported = parseAndStringify(original);
    const reParser = new PGNParser(exported);

    expect(collectMainline(reParser.getRoot())).toEqual(["e4", "e5", "Nf3", "Nc6"]);
    const e5 = reParser.getRoot().children[0].children[0];
    expect(e5.children).toHaveLength(3);
    expect(e5.children[0].move?.san).toBe("Nf3");
    expect(e5.children[1].move?.san).toBe("Bc4");
    expect(e5.children[2].move?.san).toBe("d4");
  });

  test("nested variation round-trips", () => {
    const original = "1. e4 e5 2. Nf3 Nc6 (2... d6 3. d4 (3. Bc4)) 3. Bb5";
    const exported = parseAndStringify(original);
    const reParser = new PGNParser(exported);

    expect(collectMainline(reParser.getRoot())).toEqual(["e4", "e5", "Nf3", "Nc6", "Bb5"]);
    const nf3 = reParser.getRoot().children[0].children[0].children[0];
    expect(nf3.children).toHaveLength(2);
    expect(nf3.children[0].move?.san).toBe("Nc6");
    expect(nf3.children[1].move?.san).toBe("d6");
  });

  test("variation at first move round-trips", () => {
    const original = "1. e4 (1. d4 d5) e5";
    const exported = parseAndStringify(original);
    const reParser = new PGNParser(exported);

    expect(collectMainline(reParser.getRoot())).toEqual(["e4", "e5"]);
    expect(reParser.getRoot().children).toHaveLength(2);
    expect(reParser.getRoot().children[1].move?.san).toBe("d4");
  });

  test("comments round-trip", () => {
    const original = "1. e4 {best by test} e5 {classical response}";
    const exported = parseAndStringify(original);
    const reParser = new PGNParser(exported);

    const comments = collectComments(reParser.getRoot());
    expect(comments).toContain("best by test");
    expect(comments).toContain("classical response");
  });

  test("castling round-trips", () => {
    const original = "1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6 4. O-O";
    const exported = parseAndStringify(original);
    const reParser = new PGNParser(exported);

    expect(collectMainline(reParser.getRoot())).toEqual([
      "e4", "e5", "Nf3", "Nc6", "Bc4", "Nf6", "O-O",
    ]);
  });

  test("promotion round-trips", () => {
    const fen = "8/P5k1/8/8/8/8/8/4K3 w - - 0 1";
    const original = `[FEN "${fen}"]\n1. a8=Q`;
    const parser1 = new PGNParser(original);
    expect(collectMainline(parser1.getRoot())).toEqual(["a8=Q"]);

    const exported = stringifyPGN(parser1.getRoot());
    const reParser = new PGNParser(`[FEN "${fen}"]\n${exported}`);
    expect(collectMainline(reParser.getRoot())).toEqual(["a8=Q"]);
  });

  test("FEN starting position preserves mainline", () => {
    const fen = "4k3/8/8/8/8/8/4P3/4K3 w - - 0 1";
    const original = `[FEN "${fen}"]\n1. e4 Kd7`;
    const parser1 = new PGNParser(original);
    expect(collectMainline(parser1.getRoot())).toEqual(["e4", "Kd7"]);

    const exported = stringifyPGN(parser1.getRoot());
    const reParser = new PGNParser(`[FEN "${fen}"]\n${exported}`);
    expect(collectMainline(reParser.getRoot())).toEqual(["e4", "Kd7"]);
  });

  test("double round-trip is stable", () => {
    const original = "1. e4 e5 2. Nf3 (2. Bc4 Bc5) Nc6 3. Bb5 a6";
    const firstExport = parseAndStringify(original);
    const secondExport = parseAndStringify(firstExport);

    expect(firstExport).toBe(secondExport);
  });

  test("double round-trip with variations is stable", () => {
    const original = "1. e4 (1. d4 d5) (1. c4 e5) e5 2. Nf3 Nc6";
    const firstExport = parseAndStringify(original);
    const secondExport = parseAndStringify(firstExport);

    expect(firstExport).toBe(secondExport);
  });

  test("double round-trip with comments and variations is stable", () => {
    const original = "1. e4 {best by test} e5 2. Nf3 (2. Bc4 {Italian} Bc5) Nc6";
    const firstExport = parseAndStringify(original);
    const secondExport = parseAndStringify(firstExport);

    expect(firstExport).toBe(secondExport);
  });

  test("empty game round-trips", () => {
    const original = "*";
    const exported = parseAndStringify(original);
    const reParser = new PGNParser(exported);

    expect(countNodes(reParser.getRoot())).toBe(0);
  });

  test("game with check and checkmate round-trips", () => {
    const original = "1. e4 e5 2. Bc4 Nc6 3. Qh5 Nf6 4. Qxf7#";
    const exported = parseAndStringify(original);
    const reParser = new PGNParser(exported);

    const mainline = collectMainline(reParser.getRoot());
    expect(mainline).toEqual(["e4", "e5", "Bc4", "Nc6", "Qh5", "Nf6", "Qxf7#"]);
  });

  test("annotation round-trips when includeEval is true", () => {
    const original = "1. e4 e5 2. Nf3 Nc6";
    const parser = new PGNParser(original);
    const root = parser.getRoot();

    const e4Node = root.children[0];
    e4Node.annotation = "+";

    const exported = stringifyPGN(root, true);
    const reParser = new PGNParser(exported);

    const reE4 = reParser.getRoot().children[0];
    expect(reE4.annotation).toBe("+");
  });

  test("shapes round-trip", () => {
    const original = "1. e4 e5";
    const parser = new PGNParser(original);
    const root = parser.getRoot();

    const e4Node = root.children[0];
    e4Node.shapes = [{ orig: "e2", dest: "e4", brush: "g" }];

    const exported = stringifyPGN(root, true);
    const reParser = new PGNParser(exported);

    const reE4 = reParser.getRoot().children[0];
    expect(reE4.shapes).toEqual([{ orig: "e2", dest: "e4", brush: "g" }]);
  });

  test("eval round-trips", () => {
    const original = "1. e4 e5";
    const parser = new PGNParser(original);
    const root = parser.getRoot();

    const e4Node = root.children[0];
    e4Node.eval = { score: 25, scoreType: "cp", depth: 20, bestmove: "e2e4", ponder: "e7e5" };

    const exported = stringifyPGN(root, true);
    const reParser = new PGNParser(exported);

    const reE4 = reParser.getRoot().children[0];
    expect(reE4.eval).toBeDefined();
    expect(reE4.eval!.score).toBe(25);
    expect(reE4.eval!.scoreType).toBe("cp");
    expect(reE4.eval!.bestmove).toBe("e2e4");
    expect(reE4.eval!.ponder).toBe("e7e5");
  });

  test("mate eval round-trips", () => {
    const original = "1. e4 e5";
    const parser = new PGNParser(original);
    const root = parser.getRoot();

    const e4Node = root.children[0];
    e4Node.eval = { score: 3, scoreType: "mate", depth: 15 };

    const exported = stringifyPGN(root, true);
    const reParser = new PGNParser(exported);

    const reE4 = reParser.getRoot().children[0];
    expect(reE4.eval).toBeDefined();
    expect(reE4.eval!.score).toBe(3);
    expect(reE4.eval!.scoreType).toBe("mate");
  });

  test("includeEval=false strips eval data", () => {
    const original = "1. e4 e5";
    const parser = new PGNParser(original);
    const root = parser.getRoot();

    const e4Node = root.children[0];
    e4Node.eval = { score: 25, scoreType: "cp", depth: 20, bestmove: "e2e4" };
    e4Node.annotation = "+";
    e4Node.shapes = [{ orig: "e2", dest: "e4", brush: "g" }];

    const exported = stringifyPGN(root, false);
    const reParser = new PGNParser(exported);

    const reE4 = reParser.getRoot().children[0];
    expect(reE4.eval).toBeUndefined();
    expect(reE4.annotation).toBe("+");
    expect(reE4.shapes).toEqual([{ orig: "e2", dest: "e4", brush: "g" }]);
  });

  test("glyph round-trips with eval", () => {
    const original = "1. e4 e5";
    const parser = new PGNParser(original);
    const root = parser.getRoot();

    const e4Node = root.children[0];
    e4Node.eval = { score: 50, scoreType: "cp", depth: 20 };
    e4Node.glyph = { symbol: "!", name: "Good move", color: "#22ac38" };

    const exported = stringifyPGN(root, true);
    const reParser = new PGNParser(exported);

    const reE4 = reParser.getRoot().children[0];
    expect(reE4.glyph).toBeDefined();
    expect(reE4.glyph!.symbol).toBe("!");
  });

  test("complex PGN with multiple features round-trips stably", () => {
    const original = "1. e4 {best by test} e5 2. Nf3 (2. Bc4 {Italian Game} Bc5 3. c3) (2. d4 exd4) Nc6 3. Bb5 a6";
    const firstExport = parseAndStringify(original);
    const secondExport = parseAndStringify(firstExport);

    expect(firstExport).toBe(secondExport);

    const reParser = new PGNParser(firstExport);
    expect(collectMainline(reParser.getRoot())).toEqual([
      "e4", "e5", "Nf3", "Nc6", "Bb5", "a6",
    ]);
    const e5 = reParser.getRoot().children[0].children[0];
    expect(e5.children).toHaveLength(3);
  });
});
