import { describe, expect, test } from "vitest";

import { PGNParser } from "../src/modules/Source/parser";

describe("Chess PGN Parser", () => {
  test("parse simple move sequence", () => {
    const pgn = `
      [Event "Test Game"]
      1. e4 e5
      2. Nf3 Nc6
    `;

    const parser = new PGNParser(pgn);
    const gameTree = parser.getRoot();
    expect(gameTree.id).toBe("node-root");
    expect(gameTree.children).toHaveLength(1);

    const move1 = gameTree.children[0];
    expect(move1.move?.san).toBe("e4");
    expect(move1.color).toBe("white");
    expect(move1.step).toBe(1);
    expect(move1.children).toHaveLength(1);
    expect(move1.fen).toBeTruthy();

    const move2 = move1.children[0];
    expect(move2.move?.san).toBe("e5");
    expect(move2.color).toBe("black");
    expect(move2.step).toBe(2);
    expect(move2.fen).toBeTruthy();
  });

  test("parse moves with comments", () => {
    const pgn = `
      1. e4 {A key move} e5
      2. Nf3 Nc6
    `;
    const parser = new PGNParser(pgn);
    const gameTree = parser.getRoot();

    const whiteMove = gameTree.children[0];
    expect(whiteMove.comments).toEqual(["A key move"]);

    const blackMove = whiteMove.children[0];
    expect(blackMove.comments).toEqual([]);
  });

  test("parse variations", () => {
    const pgn = `
      1. e4 (1. d4 {Alternative} d5) e5
    `;
    const parser = new PGNParser(pgn);
    const gameTree = parser.getRoot();
    const mainLine = gameTree.children[0];

    expect(mainLine.move?.san).toBe("e4");
    expect(mainLine.children).toHaveLength(1);

    const variation = gameTree.children[1];
    expect(variation.children).toHaveLength(1);
    expect(variation.move?.san).toBe("d4");
    expect(variation.comments).toEqual(["Alternative"]);
  });

  // ============ FEN 解析测试 ============

  test("parse FEN tag and use it as root fen", () => {
    const pgn = `
      [FEN "4k3/8/8/8/8/8/8/4K3 w - - 0 1"]
      1. Ke2 Kd7
    `;

    const parser = new PGNParser(pgn);
    expect(parser.haveFEN).toBe(true);
    expect(parser.getRoot().fen).toBe("4k3/8/8/8/8/8/8/4K3 w - - 0 1");
    // First move should be from the custom position
    const move1 = parser.getRoot().children[0];
    expect(move1.move?.san).toBe("Ke2");
  });

  test("parse FEN with en passant", () => {
    const pgn = `
      [FEN "rnbqkbnr/1ppppppp/p7/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 2"]
      1. ... e5
    `;

    const parser = new PGNParser(pgn);
    expect(parser.haveFEN).toBe(true);
    expect(parser.getRoot().fen).toBe(
      "rnbqkbnr/1ppppppp/p7/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 2",
    );
  });

  test("parse FEN with no castling available", () => {
    const pgn = `
      [FEN "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w - - 0 1"]
      1. e4
    `;

    const parser = new PGNParser(pgn);
    expect(parser.haveFEN).toBe(true);
    expect(parser.getRoot().fen).toBe(
      "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w - - 0 1",
    );
  });

  test("default fen when no FEN tag provided", () => {
    const pgn = `
      1. e4 e5
    `;
    const parser = new PGNParser(pgn);
    expect(parser.haveFEN).toBe(false);
    expect(parser.getRoot().fen).toBe(
      "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    );
  });

  test('raw FEN in source (without [FEN "..."] tag) is recognized', () => {
    // This simulates what tokenizer does: raw FEN without [FEN "..."] wrapper
    const pgn = `4k3/8/8/8/8/8/8/4K3 w - - 0 1

1. e4 e5`;

    const parser = new PGNParser(pgn);
    expect(parser.haveFEN).toBe(true);
    expect(parser.getRoot().fen).toBe("4k3/8/8/8/8/8/8/4K3 w - - 0 1");
  });

  test("raw FEN with en passant in source is recognized", () => {
    const pgn = `rnbqkbnr/1ppppppp/p7/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 2

1. ... e5`;

    const parser = new PGNParser(pgn);
    expect(parser.haveFEN).toBe(true);
    expect(parser.getRoot().fen).toBe(
      "rnbqkbnr/1ppppppp/p7/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 2",
    );
  });

  test("invalid FEN (missing kings) should NOT set haveFEN", () => {
    const pgn = `
      [FEN "7q/8/2R5/6R1/8/8/8/3Q4 w - - 0 1"]
      1. Ra6
    `;

    const parser = new PGNParser(pgn);
    // chess.js rejects this FEN (missing both kings)
    expect(parser.haveFEN).toBe(false);
    // rootNode.fen should remain DEFAULT_FEN
    expect(parser.getRoot().fen).toBe(
      "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    );
  });

  // ============ 严格模式测试 ============

  test("strict mode throws on illegal move", () => {
    const pgn = `
      1. e4 e5 2. Ke4
    `;
    expect(() => new PGNParser(pgn, true)).toThrow();
  });

  test("strict mode throws on garbage input with no legal moves", () => {
    expect(() => new PGNParser("hello world", true)).toThrow();
  });

  test("strict mode throws on invalid FEN tag", () => {
    const pgn = `
      [FEN "7q/8/2R5/6R1/8/8/8/3Q4 w - - 0 1"]
      1. Ra6
    `;
    expect(() => new PGNParser(pgn, true)).toThrow();
  });

  test("strict mode accepts a valid game with variations", () => {
    const pgn = `
      [Event "Test"]
      1. e4 (1. d4 d5) e5 2. Nf3 Nc6 1/2-1/2
    `;
    const parser = new PGNParser(pgn, true);
    expect(parser.getRoot().children).toHaveLength(2);
  });

  test("non-strict mode still skips illegal moves", () => {
    const pgn = `
      1. e4 e5 2. Ke4
    `;
    const parser = new PGNParser(pgn);
    const root = parser.getRoot();
    expect(root.children[0].move?.san).toBe("e4");
    expect(root.children[0].children[0].move?.san).toBe("e5");
    expect(root.children[0].children[0].children).toHaveLength(0);
  });

  test("non-strict mode stops at the first invalid FEN tag", () => {
    const pgn = `
      [FEN "invalid fen"]
      1. e4 e5 2. Ke4
    `;
    const parser = new PGNParser(pgn);
    const skipped = parser.getSkipped();
    expect(skipped.map((s) => [s.text, s.kind])).toEqual([
      ['[FEN "invalid fen"]', "fen"],
    ]);
    expect(skipped[0].line).toBe(2);
  });

  test("non-strict mode stops at the first illegal move", () => {
    const pgn = "1. e4 e5 2. Ke4 Qxf7 (1... c5)";
    const parser = new PGNParser(pgn);
    const skipped = parser.getSkipped();
    expect(skipped.map((s) => [s.text, s.kind])).toEqual([["Ke4", "move"]]);
    expect(skipped[0].line).toBe(1);
    // Content after the first error is not parsed.
    expect(parser.getMap().size).toBe(3);
  });

  test("non-strict mode reports unrecognized content", () => {
    const parser = new PGNParser("1. D8-D91 E9-E8");
    const skipped = parser.getSkipped();
    expect(skipped.map((s) => [s.text, s.kind])).toEqual([
      ["D8-D91", "unknown"],
    ]);
    // Nothing was actually parsed.
    expect(parser.getMap().size).toBe(1);
  });

  test("NAGs and escape lines do not trigger warnings", () => {
    const parser = new PGNParser("1. e4 e5 $1 2. Nf3 Nc6\n% escape line");
    expect(parser.getSkipped()).toEqual([]);
    expect(parser.getMainLine()).toHaveLength(4);
  });

  // ============ NAG 解析测试 ============

  test("move-quality NAGs annotate the preceding move", () => {
    const parser = new PGNParser("1. e4 $1 e5 $6 2. Nf3 $5 Nc6 $4");
    expect(parser.getSkipped()).toEqual([]);
    const [e4, e5, nf3, nc6] = parser.getMainLine();
    expect(e4.glyph?.symbol).toBe("!");
    expect(e5.glyph?.symbol).toBe("?!");
    expect(nf3.glyph?.symbol).toBe("!?");
    expect(nc6.glyph?.symbol).toBe("??");
  });

  test("NAGs inside variations annotate the variation move", () => {
    const parser = new PGNParser("1. e4 (1. d4 $3 d5 $2) e5");
    const d4 = parser.getRoot().children[1];
    const d5 = d4.children[0];
    expect(d4.glyph?.symbol).toBe("!!");
    expect(d5.glyph?.symbol).toBe("?");
  });

  test("unmapped NAGs are skipped without warnings", () => {
    const parser = new PGNParser("1. e4 $7 e5 $40 2. Nf3 Nc6");
    expect(parser.getSkipped()).toEqual([]);
    const [e4, e5] = parser.getMainLine();
    expect(e4.glyph).toBeUndefined();
    expect(e4.annotation).toBeUndefined();
    expect(e5.glyph).toBeUndefined();
    expect(e5.annotation).toBeUndefined();
  });

  test("positional NAGs map to annotations", () => {
    const parser = new PGNParser(
      "1. e4 $16 e5 $17 2. Nf3 $10 Nc6 $24 3. Bb5 $14 a6 $15",
    );
    expect(parser.getSkipped()).toEqual([]);
    const [e4, e5, nf3, nc6, bb5, a6] = parser.getMainLine();
    expect(e4.annotation).toBe("+");
    expect(e5.annotation).toBe("-");
    expect(nf3.annotation).toBe("=");
    expect(nc6.annotation).toBe("st");
    expect(bb5.annotation).toBe("+");
    expect(a6.annotation).toBe("-");
    for (const n of [e4, e5, nf3, nc6, bb5, a6]) {
      expect(n.glyph).toBeUndefined();
    }
  });

  test("first mapped NAG wins when several follow a move", () => {
    const parser = new PGNParser("1. e4 $1 $14 e5");
    expect(parser.getMainLine()[0].glyph?.symbol).toBe("!");
  });

  test("suffix symbol glyphs annotate the preceding move", () => {
    const parser = new PGNParser("1. e4! e5?! 2. Nf3?? Nc6!! 3. Bb5+!? a6?");
    expect(parser.getSkipped()).toEqual([]);
    const [e4, e5, nf3, nc6, bb5, a6] = parser.getMainLine();
    expect(e4.glyph?.symbol).toBe("!");
    expect(e5.glyph?.symbol).toBe("?!");
    expect(nf3.glyph?.symbol).toBe("??");
    expect(nc6.glyph?.symbol).toBe("!!");
    expect(bb5.glyph?.symbol).toBe("!?");
    expect(a6.glyph?.symbol).toBe("?");
  });

  test("suffix symbols work inside variations and after black ellipsis", () => {
    const fen =
      "rn1r2k1/pb3ppp/1p2pn2/3p4/1PP5/q2N2P1/P2NPPBP/R2Q1RK1 b - - 0 14";
    const parser = new PGNParser(
      `[FEN "${fen}"]\n14... a5?? (14... Qxb4 15. Nxb4!?) 15. Nb1`,
    );
    expect(parser.getSkipped()).toEqual([]);
    const a5 = parser.getRoot().children[0];
    expect(a5.move?.san).toBe("a5");
    expect(a5.glyph?.symbol).toBe("??");
    const qxb4 = parser.getRoot().children[1];
    expect(qxb4.children[0].move?.san).toBe("Nxb4");
    expect(qxb4.children[0].glyph?.symbol).toBe("!?");
  });

  // ============ Lichess 形状（[%csl]/[%cal]）解析测试 ============

  test("parses [%csl] square highlights", () => {
    const parser = new PGNParser("1. e4 e5 2. Nf3 { [%csl Gb4,Yd5,Rf6] }");
    const nf3 = parser.getMainLine()[2];
    expect(nf3.shapes).toEqual([
      { orig: "b4", brush: "g" },
      { orig: "d5", brush: "y" },
      { orig: "f6", brush: "r" },
    ]);
    expect(nf3.comments).toEqual([]);
  });

  test("parses [%cal] arrows", () => {
    const parser = new PGNParser("1. e4 { [%cal Ge2e4,Ye2d4,Re2g4] } e5");
    const e4 = parser.getMainLine()[0];
    expect(e4.shapes).toEqual([
      { orig: "e2", dest: "e4", brush: "g" },
      { orig: "e2", dest: "d4", brush: "y" },
      { orig: "e2", dest: "g4", brush: "r" },
    ]);
  });

  test("parses combined [%csl][%cal] block without leftover text", () => {
    const parser = new PGNParser("1. e4 { [%csl Gb4][%cal Ge2e4] } e5");
    const e4 = parser.getMainLine()[0];
    expect(e4.shapes).toEqual([
      { orig: "b4", brush: "g" },
      { orig: "e2", dest: "e4", brush: "g" },
    ]);
    expect(e4.comments).toEqual([]);
  });

  test("keeps surrounding text when shapes are embedded in a comment", () => {
    const parser = new PGNParser(
      "1. e4 { best move [%cal Ge2e4] covers the center } e5",
    );
    const e4 = parser.getMainLine()[0];
    expect(e4.shapes).toEqual([{ orig: "e2", dest: "e4", brush: "g" }]);
    expect(e4.comments).toEqual(["best move covers the center"]);
  });

  test("unknown color letters degrade to blue", () => {
    const parser = new PGNParser("1. e4 { [%csl Pb4][%cal Ze2e4] } e5");
    const e4 = parser.getMainLine()[0];
    expect(e4.shapes).toEqual([
      { orig: "b4", brush: "b" },
      { orig: "e2", dest: "e4", brush: "b" },
    ]);
  });

  test("shapes accumulate across consecutive comment blocks", () => {
    const parser = new PGNParser(
      "1. e4 { first } { [%csl Gb4] } { [%cal Re2e4] } { second } e5",
    );
    const e4 = parser.getMainLine()[0];
    expect(e4.shapes).toEqual([
      { orig: "b4", brush: "g" },
      { orig: "e2", dest: "e4", brush: "r" },
    ]);
    expect(e4.comments).toEqual(["first", "second"]);
  });

  test("lichess study game: shapes attach and no raw metadata leaks", () => {
    const fen =
      "rn1r2k1/pb3ppp/1p2pn2/3p4/1PP5/q2N2P1/P2NPPBP/R2Q1RK1 b - - 0 14";
    const parser = new PGNParser(
      `[FEN "${fen}"]\n` +
        `14... a5?? { Before, it was a normal-looking position. } { [%clk 1:09:33] } ` +
        `15. Nb1 { Black's Queen is trapped. } { [%csl Ra3] } 1-0`,
    );
    const nb1 = parser.getMainLine()[1];
    expect(nb1.shapes).toEqual([{ orig: "a3", brush: "r" }]);
    expect(nb1.comments).toEqual(["Black's Queen is trapped."]);
  });

  // ============ Lichess [%eval] 解析测试 ============

  test("parses [%eval] with cp values", () => {
    const parser = new PGNParser(
      "1. e4 { [%eval 0.35] } e5 { [%eval +1.20] } 2. Nf3 { [%eval -0.5] }",
    );
    const [e4, e5, nf3] = parser.getMainLine();
    expect(e4.eval).toEqual({ score: 35, scoreType: "cp", depth: 0 });
    expect(e5.eval).toEqual({ score: 120, scoreType: "cp", depth: 0 });
    expect(nf3.eval).toEqual({ score: -50, scoreType: "cp", depth: 0 });
    expect(e4.comments).toEqual([]);
  });

  test("parses [%eval] with mate values", () => {
    const parser = new PGNParser("1. e4 { [%eval #4] } e5 { [%eval #-4] }");
    const [e4, e5] = parser.getMainLine();
    expect(e4.eval).toEqual({ score: 4, scoreType: "mate", depth: 0 });
    expect(e5.eval).toEqual({ score: -4, scoreType: "mate", depth: 0 });
  });

  test("mixed [%eval]/[%csl] block extracts both and leaves no text", () => {
    const parser = new PGNParser("1. e4 { [%eval 0.35][%csl Ge4] } e5");
    const e4 = parser.getMainLine()[0];
    expect(e4.eval).toEqual({ score: 35, scoreType: "cp", depth: 0 });
    expect(e4.shapes).toEqual([{ orig: "e4", brush: "g" }]);
    expect(e4.comments).toEqual([]);
  });

  test("invalid [%eval] value stays as comment text", () => {
    const parser = new PGNParser("1. e4 { [%eval nonsense] } e5");
    const e4 = parser.getMainLine()[0];
    expect(e4.eval).toBeUndefined();
    expect(e4.comments).toEqual(["[%eval nonsense]"]);
  });

  // ============ [SetUp] 标签测试 ============

  test("getTags pairs [FEN] with [SetUp]", () => {
    const parser = new PGNParser(
      '[FEN "4k3/8/8/8/8/8/8/4K3 w - - 0 1"]\n1. Ke2 Kd7',
    );
    const tags = parser.getTags();
    expect(tags).toContain('[FEN "4k3/8/8/8/8/8/8/4K3 w - - 0 1"]');
    expect(tags).toContain('[SetUp "1"]');
  });

  test("getTags does not duplicate an existing [SetUp]", () => {
    const parser = new PGNParser(
      '[FEN "4k3/8/8/8/8/8/8/4K3 w - - 0 1"]\n[SetUp "1"]\n1. Ke2 Kd7',
    );
    const tags = parser.getTags();
    expect(tags.match(/\[SetUp/g)).toHaveLength(1);
  });

  test("getTags adds no [SetUp] without [FEN]", () => {
    const parser = new PGNParser("1. e4 e5");
    expect(parser.getTags()).not.toContain("SetUp");
  });

  test("non-strict mode records nothing for valid PGN", () => {
    const parser = new PGNParser("1. e4 e5 2. Nf3 Nc6");
    expect(parser.getSkipped()).toEqual([]);
  });

  test("check and checkmate suffixes are part of the move token", () => {
    const withCheck = new PGNParser("1. e4 e5 2. Nf3 d6 3. Bb5+ c6");
    expect(withCheck.getSkipped()).toEqual([]);
    expect(withCheck.getMainLine().map((n) => n.move?.san)).toEqual([
      "e4",
      "e5",
      "Nf3",
      "d6",
      "Bb5+",
      "c6",
    ]);

    const withMate = new PGNParser("1. f3 e5 2. g4 Qh4#");
    expect(withMate.getSkipped()).toEqual([]);
    expect(withMate.getMainLine().map((n) => n.move?.san)).toEqual([
      "f3",
      "e5",
      "g4",
      "Qh4#",
    ]);
  });
});
