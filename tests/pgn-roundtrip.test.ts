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

    expect(collectMainline(reParser.getRoot())).toEqual([
      "e4",
      "e5",
      "Nf3",
      "Nc6",
    ]);
    expect(countNodes(reParser.getRoot())).toBe(4);
  });

  test("mainline with result round-trips", () => {
    const original = "1. e4 e5 2. Nf3 Nc6 1-0";
    const exported = parseAndStringify(original);
    const reParser = new PGNParser(exported);

    expect(collectMainline(reParser.getRoot())).toEqual([
      "e4",
      "e5",
      "Nf3",
      "Nc6",
    ]);
  });

  test("single variation round-trips", () => {
    const original = "1. e4 e5 2. Nf3 (2. Bc4 Bc5) Nc6";
    const exported = parseAndStringify(original);
    const reParser = new PGNParser(exported);

    expect(collectMainline(reParser.getRoot())).toEqual([
      "e4",
      "e5",
      "Nf3",
      "Nc6",
    ]);
    const e5 = reParser.getRoot().children[0].children[0];
    expect(e5.children).toHaveLength(2);
    expect(e5.children[0].move?.san).toBe("Nf3");
    expect(e5.children[1].move?.san).toBe("Bc4");
  });

  test("multiple variations round-trip", () => {
    const original = "1. e4 e5 2. Nf3 (2. Bc4 Bc5) (2. d4 exd4) Nc6";
    const exported = parseAndStringify(original);
    const reParser = new PGNParser(exported);

    expect(collectMainline(reParser.getRoot())).toEqual([
      "e4",
      "e5",
      "Nf3",
      "Nc6",
    ]);
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

    expect(collectMainline(reParser.getRoot())).toEqual([
      "e4",
      "e5",
      "Nf3",
      "Nc6",
      "Bb5",
    ]);
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
      "e4",
      "e5",
      "Nf3",
      "Nc6",
      "Bc4",
      "Nf6",
      "O-O",
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
    const original =
      "1. e4 {best by test} e5 2. Nf3 (2. Bc4 {Italian} Bc5) Nc6";
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
    expect(exported).toContain("e4 $16");
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
    expect(exported).toContain("[%cal Ge2e4]");
    const reParser = new PGNParser(exported);

    const reE4 = reParser.getRoot().children[0];
    expect(reE4.shapes).toEqual([{ orig: "e2", dest: "e4", brush: "g" }]);
  });

  test("square highlights round-trip as [%csl]", () => {
    const original = "1. e4 e5";
    const parser = new PGNParser(original);
    const root = parser.getRoot();

    root.children[0].shapes = [
      { orig: "b4", brush: "g" },
      { orig: "d5", brush: "y" },
    ];

    const exported = stringifyPGN(root, true);
    expect(exported).toContain("[%csl Gb4,Yd5]");
    const reParser = new PGNParser(exported);

    const reE4 = reParser.getRoot().children[0];
    expect(reE4.shapes).toEqual([
      { orig: "b4", brush: "g" },
      { orig: "d5", brush: "y" },
    ]);
  });

  test("eval round-trips as [%eval] with %e: for bestmove/ponder", () => {
    const original = "1. e4 e5";
    const parser = new PGNParser(original);
    const root = parser.getRoot();

    const e4Node = root.children[0];
    e4Node.eval = {
      score: 25,
      scoreType: "cp",
      depth: 20,
      bestmove: "e2e4",
      ponder: "e7e5",
    };

    const exported = stringifyPGN(root, true);
    expect(exported).toContain("[%eval +0.25]");
    expect(exported).toContain("%e:+0.25,e2e4,e7e5");
    const reParser = new PGNParser(exported);

    const reE4 = reParser.getRoot().children[0];
    expect(reE4.eval).toBeDefined();
    expect(reE4.eval!.score).toBe(25);
    expect(reE4.eval!.scoreType).toBe("cp");
    expect(reE4.eval!.bestmove).toBe("e2e4");
    expect(reE4.eval!.ponder).toBe("e7e5");
  });

  test("mate eval round-trips as [%eval #n]", () => {
    const original = "1. e4 e5";
    const parser = new PGNParser(original);
    const root = parser.getRoot();

    const e4Node = root.children[0];
    e4Node.eval = { score: 3, scoreType: "mate", depth: 15 };

    const exported = stringifyPGN(root, true);
    expect(exported).toContain("[%eval #3]");
    const reParser = new PGNParser(exported);

    const reE4 = reParser.getRoot().children[0];
    expect(reE4.eval).toBeDefined();
    expect(reE4.eval!.score).toBe(3);
    expect(reE4.eval!.scoreType).toBe("mate");
  });

  test("negative mate eval round-trips", () => {
    const original = "1. e4 e5";
    const parser = new PGNParser(original);
    const root = parser.getRoot();

    root.children[0].eval = { score: -4, scoreType: "mate", depth: 15 };

    const exported = stringifyPGN(root, true);
    expect(exported).toContain("[%eval #-4]");
    const reParser = new PGNParser(exported);
    expect(reParser.getRoot().children[0].eval!.score).toBe(-4);
  });

  test("plain eval without bestmove exports no %e: block", () => {
    const original = "1. e4 e5";
    const parser = new PGNParser(original);
    const root = parser.getRoot();

    root.children[0].eval = { score: 50, scoreType: "cp", depth: 20 };

    const exported = stringifyPGN(root, true);
    expect(exported).toContain("[%eval +0.50]");
    expect(exported).not.toContain("%e:");
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
    expect(exported).toContain("e4!");
    const reParser = new PGNParser(exported);

    const reE4 = reParser.getRoot().children[0];
    expect(reE4.glyph).toBeDefined();
    expect(reE4.glyph!.symbol).toBe("!");
  });

  test("NAG glyph round-trips as suffix symbol", () => {
    const original = "1. e4 $1 e5 $6";
    const exported = parseAndStringify(original);
    expect(exported).toContain("e4!");
    expect(exported).toContain("e5?!");

    const reParser = new PGNParser(exported);
    const [e4, e5] = reParser.getMainLine();
    expect(e4.glyph?.symbol).toBe("!");
    expect(e5.glyph?.symbol).toBe("?!");
  });

  test("NAG glyph round-trips inside variations", () => {
    const original = "1. e4 (1. d4 $3 d5) e5";
    const exported = parseAndStringify(original);
    const reParser = new PGNParser(exported);

    const d4 = reParser.getRoot().children[1];
    expect(d4.glyph?.symbol).toBe("!!");
  });

  test("double round-trip with NAGs is stable", () => {
    const original = "1. e4 $1 e5 $6 2. Nf3 (2. Bc4 $5) Nc6";
    const firstExport = parseAndStringify(original);
    const secondExport = parseAndStringify(firstExport);

    expect(firstExport).toBe(secondExport);
  });

  test("suffix symbol glyphs round-trip as suffixes", () => {
    const original = "1. e4! e5?! 2. Nf3 (2. Bc4!? Bc5)";
    const exported = parseAndStringify(original);
    expect(exported).toContain("e4!");
    expect(exported).toContain("e5?!");
    expect(exported).toContain("Bc4!?");

    const reParser = new PGNParser(exported);
    const [e4, e5] = reParser.getMainLine();
    expect(e4.glyph?.symbol).toBe("!");
    expect(e5.glyph?.symbol).toBe("?!");
  });

  test("lichess shapes round-trip in [%csl]/[%cal] format", () => {
    const original = "1. e4 { [%csl Gb4][%cal Ge2e4] } e5";
    const exported = parseAndStringify(original);
    expect(exported).toContain("[%csl Gb4]");
    expect(exported).toContain("[%cal Ge2e4]");

    const reParser = new PGNParser(exported);
    const e4 = reParser.getMainLine()[0];
    expect(e4.shapes).toEqual([
      { orig: "b4", brush: "g" },
      { orig: "e2", dest: "e4", brush: "g" },
    ]);
  });

  test("comments are exported verbatim", () => {
    const original = "1. e4 e5";
    const parser = new PGNParser(original);
    parser.getRoot().children[0].comments = ["hello world"];

    const exported = stringifyPGN(parser.getRoot(), true);
    expect(exported).toContain("{hello world}");
  });

  test("unmappable bm annotation keeps private #a: form", () => {
    const original = "1. e4 e5";
    const parser = new PGNParser(original);
    parser.getRoot().children[0].annotation = "bm";

    const exported = stringifyPGN(parser.getRoot(), true);
    expect(exported).toContain("{#a:bm}");
    const reParser = new PGNParser(exported);
    expect(reParser.getRoot().children[0].annotation).toBe("bm");
  });

  test("legacy &s: shapes re-export as [%csl]/[%cal]", () => {
    const original = "1. e4 {&s:e2e4:g,b4:y} e5";
    const exported = parseAndStringify(original);
    expect(exported).toContain("[%csl Yb4]");
    expect(exported).toContain("[%cal Ge2e4]");

    const reParser = new PGNParser(exported);
    const e4 = reParser.getMainLine()[0];
    expect(e4.shapes).toEqual([
      { orig: "b4", brush: "y" },
      { orig: "e2", dest: "e4", brush: "g" },
    ]);
  });

  test("complex PGN with multiple features round-trips stably", () => {
    const original =
      "1. e4 {best by test} e5 2. Nf3 (2. Bc4 {Italian Game} Bc5 3. c3) (2. d4 exd4) Nc6 3. Bb5 a6";
    const firstExport = parseAndStringify(original);
    const secondExport = parseAndStringify(firstExport);

    expect(firstExport).toBe(secondExport);

    const reParser = new PGNParser(firstExport);
    expect(collectMainline(reParser.getRoot())).toEqual([
      "e4",
      "e5",
      "Nf3",
      "Nc6",
      "Bb5",
      "a6",
    ]);
    const e5 = reParser.getRoot().children[0].children[0];
    expect(e5.children).toHaveLength(3);
  });

  test("black-first game numbers the opening move as N...", () => {
    const fen = "4k3/p1p5/8/8/8/8/8/4K3 b - - 0 1";
    const original = `[FEN "${fen}"]\n1... a5 2. Kd2`;
    const exported = parseAndStringify(original);

    expect(exported).toContain("1... a5");
    expect(exported).toContain("2. Kd2");
    expect(exported).not.toMatch(/^a5/);
    expect(exported).not.toMatch(/\b0\./);

    const reParser = new PGNParser(`[FEN "${fen}"]\n${exported}`);
    expect(collectMainline(reParser.getRoot())).toEqual(["a5", "Kd2"]);
  });

  test("black-first root variation exports (N... move), not (0. ... move)", () => {
    const fen = "4k3/p1p5/8/8/8/8/8/4K3 b - - 0 1";
    const original = `[FEN "${fen}"]\n1... a5 (1... c5 2. Kd2) 2. Kd2`;
    const exported = parseAndStringify(original);

    expect(exported).toContain("(1... c5 2. Kd2)");
    expect(exported).not.toContain("0.");
    expect(exported).not.toContain("1. ...");

    const reParser = new PGNParser(`[FEN "${fen}"]\n${exported}`);
    expect(reParser.getRoot().children).toHaveLength(2);
    expect(reParser.getRoot().children[1].move?.san).toBe("c5");
  });

  test("move numbering follows the FEN fullmove number", () => {
    const fen = "4k3/p1p5/8/8/8/8/8/4K3 b - - 0 14";
    const original = `[FEN "${fen}"]\n14... a5 (14... c5) 15. Kd2`;
    const exported = parseAndStringify(original);

    expect(exported).toContain("14... a5");
    expect(exported).toContain("(14... c5)");
    expect(exported).toContain("15. Kd2");
  });

  test("white-to-move FEN game resumes at the FEN fullmove", () => {
    const fen = "4k3/p7/8/8/8/8/4P3/4K3 w - - 0 14";
    const original = `[FEN "${fen}"]\n14. e4 Kd7`;
    const exported = parseAndStringify(original);

    expect(exported).toContain("14. e4");
    expect(exported).toContain("Kd7");
  });

  test("mid-game black variation uses N... without extra space", () => {
    const original = "1. e4 e5 (1... c5 2. Nf3) 2. Nf3";
    const exported = parseAndStringify(original);

    expect(exported).toContain("(1... c5 2. Nf3)");
    expect(exported).not.toContain("1. ...");
  });

  test("illegal move inside a variation aborts without corrupting the tree", () => {
    // `(1... c5)` right after a white move is non-standard: the variation
    // would have to start with a white move from the start position, so c5
    // is illegal there. Parsing must stop cleanly and keep the mainline.
    const original = "1. e4 (1... c5 2. Nf3) e5";
    const exported = parseAndStringify(original);

    const reParser = new PGNParser(exported);
    expect(collectMainline(reParser.getRoot())).toEqual(["e4"]);
    expect(countNodes(reParser.getRoot())).toBe(1);
  });

  test("[%clk] round-trips as a clock block, stripped from comments", () => {
    const original =
      "1. e4 {best by test} {[%clk 0:05:00]} e5 {[%clk 0:04:55]} 2. Nf3";
    const parser = new PGNParser(original);

    const e4 = parser.getRoot().children[0];
    expect(e4.clock).toBe("0:05:00");
    expect(e4.comments).toEqual(["best by test"]);
    const e5 = e4.children[0];
    expect(e5.clock).toBe("0:04:55");
    expect(e5.comments).toEqual([]);

    const exported = stringifyPGN(parser.getRoot());
    expect(exported).toContain("{best by test} {[%clk 0:05:00]}");
    expect(exported).toContain("e5 {[%clk 0:04:55]}");
  });

  test("[%clk] embedded inside a text comment is extracted", () => {
    const original = "1. e4 {nice move [%clk 0:03:00]} e5";
    const parser = new PGNParser(original);

    const e4 = parser.getRoot().children[0];
    expect(e4.clock).toBe("0:03:00");
    expect(e4.comments).toEqual(["nice move"]);
  });

  test("invalid [%clk] value stays verbatim in the comment", () => {
    const original = "1. e4 {[%clk half an hour]} e5";
    const parser = new PGNParser(original);

    const e4 = parser.getRoot().children[0];
    expect(e4.clock).toBeUndefined();
    expect(e4.comments).toEqual(["[%clk half an hour]"]);
  });

  test("double round-trip with [%clk] is stable", () => {
    const original =
      "1. e4 {best by test} {[%clk 0:05:00]} e5 {[%clk 0:04:55]}";
    const firstExport = parseAndStringify(original);
    const secondExport = parseAndStringify(firstExport);

    expect(firstExport).toBe(secondExport);
  });

  test("[%anno] author is stripped from comments and round-trips inline", () => {
    const original =
      '1. e4 {[%anno "AArmstark", aaarmstark] Chess on the board!} e5';
    const parser = new PGNParser(original);

    const e4 = parser.getRoot().children[0];
    expect(e4.comments).toEqual(["Chess on the board!"]);
    expect(e4.commentAuthors?.[0]).toEqual({
      name: "AArmstark",
      user: "aaarmstark",
    });

    const exported = stringifyPGN(parser.getRoot());
    expect(exported).toContain(
      '{[%anno "AArmstark", aaarmstark] Chess on the board!}',
    );
  });

  test("multiple comments by different authors keep their own [%anno]", () => {
    const original =
      '1. e4 {[%anno "AArmstark", aaarmstark] Chaos!} {[%anno "FM NaSil", nasil] Calm down.} e5 {plain comment}';
    const parser = new PGNParser(original);

    const e4 = parser.getRoot().children[0];
    expect(e4.comments).toEqual(["Chaos!", "Calm down."]);
    expect(e4.commentAuthors?.[0]).toEqual({
      name: "AArmstark",
      user: "aaarmstark",
    });
    expect(e4.commentAuthors?.[1]).toEqual({
      name: "FM NaSil",
      user: "nasil",
    });

    const exported = stringifyPGN(parser.getRoot());
    expect(exported).toContain('{[%anno "AArmstark", aaarmstark] Chaos!}');
    expect(exported).toContain('{[%anno "FM NaSil", nasil] Calm down.}');
    expect(exported).toContain("e5 {plain comment}");

    // Reparsing the export restores the exact per-comment pairing.
    const reParser = new PGNParser(exported);
    const e4again = reParser.getRoot().children[0];
    expect(e4again.commentAuthors?.[0]?.user).toBe("aaarmstark");
    expect(e4again.commentAuthors?.[1]?.user).toBe("nasil");
    const e5again = e4again.children[0];
    expect(e5again.commentAuthors).toBeUndefined();
  });

  test("[%anno] without user id round-trips (external author)", () => {
    const original = '1. e4 {[%anno "Some External"] nice} e5';
    const parser = new PGNParser(original);

    const e4 = parser.getRoot().children[0];
    expect(e4.commentAuthors?.[0]).toEqual({
      name: "Some External",
      user: "",
    });

    const exported = stringifyPGN(parser.getRoot());
    expect(exported).toContain('{[%anno "Some External"] nice}');
  });

  test("malformed [%anno] stays verbatim in the comment", () => {
    const original = "1. e4 {[%anno ] text} e5";
    const parser = new PGNParser(original);

    const e4 = parser.getRoot().children[0];
    expect(e4.commentAuthors).toBeUndefined();
    expect(e4.comments).toEqual(["[%anno ] text"]);
  });

  test("double round-trip with [%anno] and [%clk] is stable", () => {
    const original =
      '1. e4 {[%anno "AA", aa] Chaos!} {[%clk 0:05:00]} e5 {[%clk 0:04:55]}';
    const firstExport = parseAndStringify(original);
    const secondExport = parseAndStringify(firstExport);

    expect(firstExport).toBe(secondExport);
  });
});
