import { describe, expect, test } from "vitest";

import { extractCommentMeta } from "../src/modules/Source/comment-meta";
import { PGNParser } from "../src/modules/Source/parser";
import {
  serializeNodeMeta,
  stringifyPGN,
} from "../src/modules/Actions/stringify-pgn";

describe("pinned-block persistence ([%pin c,b])", () => {
  test("extractCommentMeta parses pin flags and strips the marker", () => {
    const both = extractCommentMeta("[%pin c,b]");
    expect(both.pin).toEqual({ comment: true, board: true });
    expect(both.text).toBe("");

    const commentOnly = extractCommentMeta("[%pin c]");
    expect(commentOnly.pin).toEqual({ comment: true, board: false });

    const boardOnly = extractCommentMeta("[%pin b]");
    expect(boardOnly.pin).toEqual({ comment: false, board: true });
  });

  test("pin marker bundled with comment text survives extraction", () => {
    const meta = extractCommentMeta("great move [%pin b]");
    expect(meta.pin).toEqual({ comment: false, board: true });
    expect(meta.text).toBe("great move");
  });

  test("parser applies pin flags to the node", () => {
    const parser = new PGNParser("1. e4 {[%pin c,b]} e5 {[%pin c]}");
    const root = parser.getRoot();
    const e4 = root.children[0];
    expect(e4.pin).toEqual({ comment: true, board: true });
    const e5 = e4.children[0];
    expect(e5.pin).toEqual({ comment: true, board: false });
  });

  test("pin marker survives a stringify round-trip", () => {
    const parser = new PGNParser("1. e4 {[%pin c,b]} e5");
    const pgn = stringifyPGN(parser.getRoot());
    expect(pgn).toContain("{[%pin c,b]}");
    const reparsed = new PGNParser(pgn);
    expect(reparsed.getRoot().children[0].pin).toEqual({
      comment: true,
      board: true,
    });
  });

  test("includePins=false drops pin markers", () => {
    const parser = new PGNParser("1. e4 {[%pin c,b]} e5");
    const pgn = stringifyPGN(parser.getRoot(), true, "suffix", false);
    expect(pgn).not.toContain("%pin");
  });

  test("unpinning removes the marker from the output", () => {
    const parser = new PGNParser("1. e4 {[%pin c,b]} e5");
    delete parser.getRoot().children[0].pin;
    const pgn = stringifyPGN(parser.getRoot());
    expect(pgn).not.toContain("%pin");
  });

  test("serializeNodeMeta writes only the pinned flags", () => {
    const parser = new PGNParser("1. e4 e5");
    const e4 = parser.getRoot().children[0];
    e4.pin = { comment: false, board: true };
    expect(serializeNodeMeta(e4)).toContain("[%pin b]");
    expect(serializeNodeMeta(e4)).not.toContain("[%pin c");
  });
});
