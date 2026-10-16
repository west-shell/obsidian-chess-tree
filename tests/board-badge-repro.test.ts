import { describe, expect, test } from "vitest";

import { getMoveDest, isMoveCheckmate } from "../src/chess";
import { PGNParser } from "../src/modules/Source/parser";
import { badgeBoardSvg, resultBadgeKeyOf } from "../src/utils/icon";

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

  test("result key maps mates to #, resignations to the flag", () => {
    // Resignation win: result set, no checkmate — the flag badge on the
    // winner's color (board and tree share resultBadgeKeyOf).
    expect(resultBadgeKeyOf("1-0", false)).toBe("resign_1-0");
    expect(badgeBoardSvg("resign_1-0")).toContain("matrix");
    // Real mate keeps the "#" mark (result-colored disc).
    expect(resultBadgeKeyOf("0-1", true)).toBe("result_0-1");
    expect(resultBadgeKeyOf("1-0", true)).toBe("result_1-0");
    // Mate without a stored result falls back to the checkmate mark.
    expect(resultBadgeKeyOf(undefined, true)).toBe("checkmate");
    expect(badgeBoardSvg("checkmate")).toContain("matrix");
    // Draws keep the handshake.
    expect(resultBadgeKeyOf("1/2-1/2", false)).toBe("result_1/2-1/2");
    // Ongoing positions render nothing.
    expect(resultBadgeKeyOf(undefined, false)).toBe("");
  });
});
