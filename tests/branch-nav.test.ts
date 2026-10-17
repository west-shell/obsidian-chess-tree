import { describe, expect, test } from "vitest";

import type { ChessNode, NodeMap } from "../src/types";
import {
  findForkAbove,
  findForkBelow,
  firstForkOnPath,
  pathBranchIndex,
  pathChild,
} from "../src/utils/branch-nav";

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

function n(id: string, children: ChessNode[] = []): ChessNode {
  return {
    id,
    fen: START_FEN,
    move: null,
    color: null,
    children,
    comments: [],
  };
}

/** Wire parentIDs and collect the node map for a hand-built tree. */
function prepare(root: ChessNode): NodeMap {
  const map: NodeMap = new Map();
  const walk = (node: ChessNode): void => {
    map.set(node.id, node);
    for (const child of node.children) {
      child.parentID = node.id;
      walk(child);
    }
  };
  walk(root);
  return map;
}

// Tree used by most tests:
//   root ─ a ─ b1 ─ c1
//             └ b2 ─ d1 ─ d2
function buildTree(): { root: ChessNode; a: ChessNode; nodeMap: NodeMap } {
  const root = n("root", [
    n("a", [n("b1", [n("c1")]), n("b2", [n("d1", [n("d2")])])]),
  ]);
  const nodeMap = prepare(root);
  return { root, a: root.children[0], nodeMap };
}

describe("pathChild", () => {
  test("defaults to the first child when no choice is stored", () => {
    const { a } = buildTree();
    expect(pathChild(a)?.id).toBe("b1");
  });

  test("follows a valid stored choice", () => {
    const { a } = buildTree();
    expect(pathChild(a, new Map([["a", 1]]))?.id).toBe("b2");
  });

  test("falls back to the first child on stale/out-of-range choices", () => {
    const { a } = buildTree();
    expect(pathChild(a, new Map([["a", 5]]))?.id).toBe("b1");
    expect(pathChild(a, new Map([["a", -1]]))?.id).toBe("b1");
  });

  test("returns null at a line tip", () => {
    const { root } = buildTree();
    expect(pathChild(root.children[0].children[0].children[0])).toBeNull();
  });
});

describe("pathBranchIndex", () => {
  test("defaults to 0 and clamps invalid stored indices", () => {
    const { a } = buildTree();
    expect(pathBranchIndex(a)).toBe(0);
    expect(pathBranchIndex(a, new Map([["a", 1]]))).toBe(1);
    expect(pathBranchIndex(a, new Map([["a", 9]]))).toBe(0);
  });
});

describe("findForkAbove", () => {
  test("finds the nearest ancestor fork from inside a variation", () => {
    const { root, nodeMap } = buildTree();
    const d2 = nodeMap.get("d2")!;
    expect(findForkAbove(d2, nodeMap)?.id).toBe("a");
    // Above the only fork there is nothing.
    expect(findForkAbove(root.children[0].children[0], nodeMap)?.id).toBe("a");
    expect(findForkAbove(root, nodeMap)).toBeNull();
  });

  test("the root counts as a fork when it has several children", () => {
    const root = n("root", [n("x"), n("y")]);
    const nodeMap = prepare(root);
    expect(findForkAbove(nodeMap.get("x")!, nodeMap)?.id).toBe("root");
  });
});

describe("findForkBelow", () => {
  test("finds the next fork strictly below along the displayed path", () => {
    const { root } = buildTree();
    expect(findForkBelow(root)?.id).toBe("a");
    // The fork itself is excluded.
    const { a } = buildTree();
    expect(findForkBelow(a)).toBeNull();
  });

  test("follows the choice at the current fork while walking down", () => {
    // root(fork) ─ a ─ a1 (fork: b1, b2)
    //            └ c (leaf)
    const root = n("root", [n("a", [n("a1", [n("b1"), n("b2")])]), n("c")]);
    prepare(root);
    // Default path goes through a, so a1 is the next fork below.
    expect(findForkBelow(root)?.id).toBe("a1");
    // Switching the root's branch to the childless c yields no fork below.
    expect(findForkBelow(root, new Map([["root", 1]]))).toBeNull();
  });
});

describe("firstForkOnPath", () => {
  test("returns the current node when it is itself a fork", () => {
    const { a } = buildTree();
    expect(firstForkOnPath(a)).toEqual({ fork: a, branchIndex: 0 });
    expect(firstForkOnPath(a, new Map([["a", 1]]))).toEqual({
      fork: a,
      branchIndex: 1,
    });
  });

  test("walks down a single-child chain to the first fork", () => {
    const { root, a } = buildTree();
    expect(firstForkOnPath(root)?.fork).toBe(a);
  });

  test("returns null when the displayed path has no fork", () => {
    const root = n("root", [n("x", [n("y")])]);
    prepare(root);
    expect(firstForkOnPath(root)).toBeNull();
    expect(firstForkOnPath(root.children[0])).toBeNull();
  });
});
