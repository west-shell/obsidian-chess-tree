import { describe, expect, test } from "vitest";

import { getMoveDest, isMoveCheckmate } from "../src/chess";
import { PGNParser } from "../src/modules/Source/parser";
import { badgeBoardSvg } from "../src/utils/icon";

describe("board checkmate badge conditions", () => {
  test("parsed mate node satisfies board # conditions", () => {
    const parser = new PGNParser("1. f3 e5 2. g4 Qh4# 0-1");
    const root = parser.getRoot();
    let tip = root;
    while (tip.children.length > 0) tip = tip.children[0];
    expect(tip.move?.san).toBe("Qh4#");
    expect(isMoveCheckmate(tip.move!)).toBe(true);
    expect(tip.isCheckmate).toBe(true);
    expect(tip.result).toBe("0-1");
    expect(getMoveDest(tip.move!)).toBe("h4");
    expect(badgeBoardSvg("checkmate")).toContain("matrix");
  });

  test("result-only tip (resignation) lacks isCheckmate", () => {
    const parser = new PGNParser(
      '[Result "1-0"]\n\n1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 1-0',
    );
    const root = parser.getRoot();
    let tip = root;
    while (tip.children.length > 0) tip = tip.children[0];
    expect(tip.result).toBe("1-0");
    expect(tip.isCheckmate).toBe(false);
  });

  test("board result key mirrors the tree's resultBadgeKey", () => {
    const boardResultKey = (node: {
      result?: string;
      isCheckmate?: boolean;
    }): string =>
      node.result
        ? `result_${node.result}`
        : node.isCheckmate
          ? "checkmate"
          : "";
    // Resignation win: result set, no checkmate — the board must still
    // render the result "#" badge (mirrors the tree node badge).
    expect(boardResultKey({ result: "1-0", isCheckmate: false })).toBe(
      "result_1-0",
    );
    expect(badgeBoardSvg("result_1-0")).toContain("matrix");
    // Real mate without a stored result falls back to the checkmate mark.
    expect(boardResultKey({ isCheckmate: true })).toBe("checkmate");
    expect(badgeBoardSvg("checkmate")).toContain("matrix");
    // Ongoing positions render nothing.
    expect(boardResultKey({})).toBe("");
  });
});
