import { describe, expect, test } from "vitest";

import { Chess, DEFAULT_FEN, type Move } from "../src/chess";
import type { ChessNode, NodeEval, PvLine } from "../src/types";
import {
  buildGhostLines,
  GHOST_ID_PREFIX,
  isGhostNode,
} from "../src/modules/Engine/ghost-lines";

function makeNode(
  id: string,
  fen: string,
  move: Move | null,
  children: ChessNode[] = [],
): ChessNode {
  return {
    id,
    fen,
    move,
    color: move ? (move.color === "w" ? "white" : "black") : null,
    children,
    comments: [],
  };
}

function playFrom(fen: string, san: string): Move {
  const chess = new Chess();
  chess.load(fen);
  return chess.move(san);
}

const pv = (score: number, moves: string[], scoreType = "cp"): PvLine => ({
  score,
  scoreType,
  moves,
});

const ev = (score: number, depth: number, pvs: PvLine[]): NodeEval => ({
  score,
  scoreType: "cp",
  depth,
  pvs,
});

describe("buildGhostLines", () => {
  const e4 = playFrom(DEFAULT_FEN, "e4");
  const d4 = playFrom(DEFAULT_FEN, "d4");

  function rootWithEval(children: ChessNode[], pvs: PvLine[]): ChessNode {
    const root = makeNode("root", DEFAULT_FEN, null, children);
    root.eval = ev(35, 15, pvs);
    return root;
  }

  test("line matching a played move attaches ghosts after it", () => {
    const root = rootWithEval(
      [makeNode("n-e4", e4.after, e4), makeNode("n-d4", d4.after, d4)],
      [pv(35, ["e2e4", "e7e5", "g1f3"])],
    );
    const result = buildGhostLines(root);
    expect(result?.nodeId).toBe("root");
    expect(result?.lines).toHaveLength(1);
    const line = result!.lines[0];
    expect(line.rank).toBe(0);
    expect(line.score).toBe(35);
    expect(line.matchedIds).toEqual(["n-e4"]);
    expect(line.attachId).toBe("n-e4");
    // Ghost chain: e5 then Nf3.
    const head = line.head!;
    expect(isGhostNode(head)).toBe(true);
    expect(head.id).toBe(`${GHOST_ID_PREFIX}0:1`);
    expect(head.move?.san).toBe("e5");
    expect(head.parentID).toBe("n-e4");
    expect(head.fen).toBe(
      "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2",
    );
    expect(head.children).toHaveLength(1);
    const second = head.children[0];
    expect(second.move?.san).toBe("Nf3");
    expect(second.parentID).toBe(head.id);
    expect(isGhostNode(second)).toBe(true);
  });

  test("line with no played match attaches the whole chain at the node", () => {
    const root = rootWithEval([], [pv(12, ["c2c4", "e7e5"])]);
    const line = buildGhostLines(root)!.lines[0];
    expect(line.matchedIds).toEqual([]);
    expect(line.attachId).toBe("root");
    expect(line.head?.move?.san).toBe("c4");
    expect(line.head?.parentID).toBe("root");
    expect(line.head?.children[0]?.move?.san).toBe("e5");
  });

  test("fully played line keeps only matched ids and a null head", () => {
    const chess = new Chess();
    chess.load(DEFAULT_FEN);
    const e4m = chess.move("e4");
    const e5m = chess.move("e5");
    const nf3m = chess.move("Nf3");
    const e4Node = makeNode("n-e4", e4m.after, e4m);
    const e5Node = makeNode("n-e5", e5m.after, e5m);
    const nf3Node = makeNode("n-nf3", nf3m.after, nf3m);
    e4Node.children = [e5Node];
    e5Node.children = [nf3Node];
    const root = rootWithEval([e4Node], [pv(35, ["e2e4", "e7e5", "g1f3"])]);
    const line = buildGhostLines(root)!.lines[0];
    expect(line.head).toBeNull();
    expect(line.matchedIds).toEqual(["n-e4", "n-e5", "n-nf3"]);
    expect(line.attachId).toBe("n-nf3");
  });

  test("multiple lines diverge at different nodes", () => {
    const root = rootWithEval(
      [makeNode("n-e4", e4.after, e4), makeNode("n-d4", d4.after, d4)],
      [
        pv(35, ["e2e4", "e7e5"]),
        pv(12, ["d2d4", "d7d5", "c2c4"]),
        pv(5, ["c2c4", "g8f6"]),
      ],
    );
    const lines = buildGhostLines(root)!.lines;
    expect(lines).toHaveLength(3);
    expect(lines[0].rank).toBe(0);
    expect(lines[0].attachId).toBe("n-e4");
    expect(lines[1].rank).toBe(1);
    expect(lines[1].attachId).toBe("n-d4");
    expect(lines[1].head?.children).toHaveLength(1);
    expect(lines[2].rank).toBe(2);
    expect(lines[2].attachId).toBe("root");
    expect(lines[2].matchedIds).toEqual([]);
  });

  test("truncates ghost chains at maxPlies", () => {
    const root = rootWithEval(
      [],
      [pv(35, ["e2e4", "e7e5", "g1f3", "b8c6", "f1b5"])],
    );
    const line = buildGhostLines(root, 3)!.lines[0];
    let count = 0;
    let g = line.head;
    while (g) {
      count++;
      g = g.children[0] ?? null;
    }
    expect(count).toBe(3);
  });

  test("stops the chain at an illegal pv move", () => {
    const root = rootWithEval([], [pv(35, ["e2e4", "zz9z9", "e7e5"])]);
    const line = buildGhostLines(root)!.lines[0];
    const head = line.head!;
    expect(head.move?.san).toBe("e4");
    expect(head.children).toHaveLength(0);
  });

  test("returns null without pvs or when no line renders", () => {
    const plain = makeNode("root", DEFAULT_FEN, null);
    expect(buildGhostLines(plain)).toBeNull();
    plain.eval = ev(35, 15, []);
    expect(buildGhostLines(plain)).toBeNull();
    // Empty-move lines are skipped entirely.
    const emptyLine = rootWithEval([], [pv(35, [])]);
    expect(buildGhostLines(emptyLine)).toBeNull();
  });

  test("never mutates the real tree", () => {
    const e4Node = makeNode("n-e4", e4.after, e4);
    const root = rootWithEval([e4Node], [pv(35, ["e2e4", "e7e5"])]);
    buildGhostLines(root);
    expect(root.children).toEqual([e4Node]);
    expect(e4Node.children).toEqual([]);
  });
});
