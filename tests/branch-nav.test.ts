import { describe, expect, test } from "vitest";

import type { ChessNode, NodeMap } from "../src/types";
import {
  branchStepDirection,
  currentVariation,
  enumerateVariations,
  findForkAbove,
  findForkBelow,
  firstForkOnPath,
  nearestBranchStart,
  nodeDepth,
  nodesAtDepth,
  orderedBranchStarts,
  orderedTips,
  pathBranchIndex,
  pathChild,
  renderedChild,
  renderedTip,
  samePlyNodes,
  visibleBranchStarts,
  visibleTips,
} from "../src/modules/Tree/Actions/branch-nav";

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

describe("branchStepDirection", () => {
  test("depth is counted in plies from the root", () => {
    // root(depth 0) → x(1) → y(2)
    const root = n("root", [n("x", [n("y")])]);
    const nodeMap = prepare(root);
    expect(nodeDepth(nodeMap.get("y")!, nodeMap)).toBe(2);
  });

  test("odd-layer forks (branches right): right steps +1, left steps -1", () => {
    // Fork at depth 1: branches stack to the RIGHT of the trunk.
    const root = n("root", [n("f", [n("b1"), n("b2"), n("b3")])]);
    const nodeMap = prepare(root);
    const fork = nodeMap.get("f")!;
    expect(branchStepDirection(fork, nodeMap, true)).toBe(1);
    expect(branchStepDirection(fork, nodeMap, false)).toBe(-1);
  });

  test("even-layer forks (branches left): right steps -1, left steps +1", () => {
    // Fork at depth 0 (the root itself): branches stack to the LEFT.
    const root = n("root", [n("b1"), n("b2"), n("b3")]);
    const nodeMap = prepare(root);
    expect(branchStepDirection(root, nodeMap, true)).toBe(-1);
    expect(branchStepDirection(root, nodeMap, false)).toBe(1);
    // Fork at depth 2: also even.
    const deep = n("root", [n("x", [n("f", [n("b1"), n("b2")])])]);
    const deepMap = prepare(deep);
    expect(branchStepDirection(deepMap.get("f")!, deepMap, true)).toBe(-1);
    expect(branchStepDirection(deepMap.get("f")!, deepMap, false)).toBe(1);
  });
});

describe("enumerateVariations", () => {
  test("lists every displayed-path variation below a fork in DFS order", () => {
    // root(fork) ─ a ─ b1
    //            └ c ─ d1
    //               └ d2
    const root = n("root", [n("a", [n("b1")]), n("c", [n("d1"), n("d2")])]);
    prepare(root);
    // From the root: three leaf tips (b1, d1, d2) → three variations,
    // the index taken at every node with children down to the tip.
    expect(enumerateVariations(root)).toEqual([
      [0, 0],
      [1, 0],
      [1, 1],
    ]);
  });

  test("returns a single variation on a branchless chain", () => {
    const root = n("root", [n("x", [n("y")])]);
    prepare(root);
    expect(enumerateVariations(root)).toEqual([[0, 0]]);
    expect(enumerateVariations(root.children[0].children[0])).toEqual([[]]);
  });
});

describe("currentVariation", () => {
  test("follows stored choices down the displayed path", () => {
    // root(fork) ─ a ─ b1
    //            └ c ─ d1
    //               └ d2
    const root = n("root", [n("a", [n("b1")]), n("c", [n("d1"), n("d2")])]);
    prepare(root);
    expect(currentVariation(root)).toEqual([0, 0]);
    // Root switched to c, then to d2.
    expect(currentVariation(root, new Map([["root", 1]]))).toEqual([1, 0]);
    expect(
      currentVariation(
        root,
        new Map([
          ["root", 1],
          ["c", 1],
        ]),
      ),
    ).toEqual([1, 1]);
  });

  test("clamps stale out-of-range choices", () => {
    const { a } = buildTree();
    expect(currentVariation(a, new Map([["a", 9]]))).toEqual([0, 0]);
  });
});

describe("renderedChild", () => {
  test("follows the stored choice at unfolded forks", () => {
    const { a } = buildTree();
    expect(renderedChild(a, new Map([["a", 1]]))?.id).toBe("b2");
  });

  test("a folded node always continues into its first child", () => {
    const { a } = buildTree();
    expect(renderedChild(a, new Map([["a", 1]]), new Set(["a"]))?.id).toBe(
      "b1",
    );
  });

  test("returns null at a line tip", () => {
    const { root } = buildTree();
    expect(renderedChild(root.children[0].children[0].children[0])).toBeNull();
  });
});

describe("findForkBelow (folding)", () => {
  test("the rendered walk never enters a folded-away subtree", () => {
    // root(fork) ─ a ─ a1(fork: b1, b2)
    //            └ c ─ c1(fork: d1, d2)
    const root = n("root", [
      n("a", [n("a1", [n("b1"), n("b2")])]),
      n("c", [n("c1", [n("d1"), n("d2")])]),
    ]);
    prepare(root);
    // Without folding the stored choice points the walk into c's subtree.
    expect(findForkBelow(root, new Map([["root", 1]]))?.id).toBe("c1");
    // Folding the root renders only the a subtree.
    expect(
      findForkBelow(root, new Map([["root", 1]]), new Set(["root"]))?.id,
    ).toBe("a1");
  });
});

describe("firstForkOnPath (folding)", () => {
  test("skips a folded fork and lands on the next unfolded one below", () => {
    // root ─ f1(fork: x, y) ─ x ─ g(fork: g1, g2)
    const root = n("root", [
      n("f1", [n("x", [n("g", [n("g1"), n("g2")])]), n("y")]),
    ]);
    prepare(root);
    expect(firstForkOnPath(root)?.fork.id).toBe("f1");
    expect(firstForkOnPath(root, undefined, new Set(["f1"]))?.fork.id).toBe(
      "g",
    );
  });

  test("returns null when every fork below is folded", () => {
    const root = n("root", [n("f1", [n("x"), n("y")])]);
    prepare(root);
    expect(firstForkOnPath(root, undefined, new Set(["f1"]))).toBeNull();
  });
});

describe("enumerateVariations (folding)", () => {
  test("skips branches hidden by folding", () => {
    // root(fork) ─ a ─ b1
    //            └ c ─ d1
    //               └ d2
    const root = n("root", [n("a", [n("b1")]), n("c", [n("d1"), n("d2")])]);
    prepare(root);
    expect(enumerateVariations(root, new Set(["root"]))).toEqual([[0, 0]]);
    expect(enumerateVariations(root, new Set(["c"]))).toEqual([
      [0, 0],
      [1, 0],
    ]);
  });
});

describe("currentVariation (folding)", () => {
  test("a folded node contributes index 0 whatever the stored choice", () => {
    // root(fork) ─ a ─ b1
    //            └ c ─ d1
    //               └ d2
    const root = n("root", [n("a", [n("b1")]), n("c", [n("d1"), n("d2")])]);
    prepare(root);
    expect(
      currentVariation(
        root,
        new Map([
          ["root", 1],
          ["c", 1],
        ]),
      ),
    ).toEqual([1, 1]);
    expect(
      currentVariation(
        root,
        new Map([
          ["root", 1],
          ["c", 1],
        ]),
        new Set(["c"]),
      ),
    ).toEqual([1, 0]);
  });
});

// Tree used by the nodesAtDepth / samePlyNodes tests:
//   root ─ a ─ b1
//        └ c ─ d1 ─ d2
function buildDepthTree(): ChessNode {
  return n("root", [n("a", [n("b1")]), n("c", [n("d1", [n("d2")])])]);
}

const NO_FOLD = new Set<string>();

describe("nodesAtDepth", () => {
  test("collects every node at the depth in DFS pre-order", () => {
    const root = buildDepthTree();
    prepare(root);
    expect(nodesAtDepth(root, 0, NO_FOLD).map((x) => x.id)).toEqual(["root"]);
    expect(nodesAtDepth(root, 1, NO_FOLD).map((x) => x.id)).toEqual(["a", "c"]);
    expect(nodesAtDepth(root, 2, NO_FOLD).map((x) => x.id)).toEqual([
      "b1",
      "d1",
    ]);
    expect(nodesAtDepth(root, 3, NO_FOLD).map((x) => x.id)).toEqual(["d2"]);
  });

  test("returns an empty list past the deepest tip", () => {
    const root = buildDepthTree();
    prepare(root);
    expect(nodesAtDepth(root, 4, NO_FOLD)).toEqual([]);
  });

  test("prunes the extra children of a folded node", () => {
    // Folding the root keeps only its first child's subtree.
    const root = buildDepthTree();
    prepare(root);
    const folded = new Set(["root"]);
    expect(nodesAtDepth(root, 1, folded).map((x) => x.id)).toEqual(["a"]);
    expect(nodesAtDepth(root, 2, folded).map((x) => x.id)).toEqual(["b1"]);
    expect(nodesAtDepth(root, 3, folded)).toEqual([]);
  });

  test("keeps the folded node itself and single-child chains intact", () => {
    // Folding a (one child) prunes nothing; the folded node itself stays.
    const root = buildDepthTree();
    prepare(root);
    const folded = new Set(["a"]);
    expect(nodesAtDepth(root, 0, folded).map((x) => x.id)).toEqual(["root"]);
    expect(nodesAtDepth(root, 2, folded).map((x) => x.id)).toEqual([
      "b1",
      "d1",
    ]);
  });
});

describe("samePlyNodes", () => {
  test("sorts by layout x when every node has a finite x", () => {
    const root = buildDepthTree();
    const nodeMap = prepare(root);
    nodeMap.get("d1")!.x = 1;
    nodeMap.get("b1")!.x = 3;
    expect(samePlyNodes(root, 2, NO_FOLD).map((x) => x.id)).toEqual([
      "d1",
      "b1",
    ]);
  });

  test("falls back to DFS pre-order when any x is missing", () => {
    const root = buildDepthTree();
    const nodeMap = prepare(root);
    nodeMap.get("d1")!.x = 1;
    // b1 has no x yet (never rendered): keep the DFS order for all.
    expect(samePlyNodes(root, 2, NO_FOLD).map((x) => x.id)).toEqual([
      "b1",
      "d1",
    ]);
  });

  test("skips folded branches", () => {
    const root = buildDepthTree();
    prepare(root);
    const folded = new Set(["root"]);
    expect(samePlyNodes(root, 2, folded).map((x) => x.id)).toEqual(["b1"]);
  });
});

describe("renderedTip", () => {
  test("follows the stored choices down to the line tip", () => {
    const { a } = buildTree();
    expect(renderedTip(a).id).toBe("c1");
    expect(renderedTip(a, new Map([["a", 1]])).id).toBe("d2");
  });

  test("a folded node continues into its first child's tip", () => {
    const { a } = buildTree();
    expect(renderedTip(a, new Map([["a", 1]]), new Set(["a"])).id).toBe("c1");
  });

  test("a line tip anchors to itself", () => {
    const { root } = buildTree();
    const tip = root.children[0].children[0].children[0]; // c1
    expect(renderedTip(tip).id).toBe("c1");
  });
});

describe("visibleTips", () => {
  test("collects every rendered leaf in DFS pre-order", () => {
    const { root } = buildTree();
    expect(visibleTips(root).map((t) => t.id)).toEqual(["c1", "d2"]);
  });

  test("skips branch ends hidden by folding", () => {
    const { root } = buildTree();
    // Folding a hides the b2 subtree, so only c1 remains a visible tip.
    expect(visibleTips(root, new Set(["a"])).map((t) => t.id)).toEqual(["c1"]);
  });

  test("a lone root is itself a tip", () => {
    const solo = n("root");
    prepare(solo);
    expect(visibleTips(solo).map((t) => t.id)).toEqual(["root"]);
  });
});

describe("orderedTips", () => {
  test("sorts by layout x when every tip has a finite x", () => {
    const { root, nodeMap } = buildTree();
    nodeMap.get("c1")!.x = 2;
    nodeMap.get("d2")!.x = 1;
    expect(orderedTips(root).map((t) => t.id)).toEqual(["d2", "c1"]);
  });

  test("falls back to DFS pre-order when any x is missing", () => {
    const { root, nodeMap } = buildTree();
    nodeMap.get("d2")!.x = 1;
    expect(orderedTips(root).map((t) => t.id)).toEqual(["c1", "d2"]);
  });
});

// Tree used by the visibleBranchStarts / nearestBranchStart tests:
//   root ─ a ─ b1 ─ c1
//             └ b2 ─ d1 ─ d2
//                    └ e1 ─ e2
function buildStartsTree(): { root: ChessNode; nodeMap: NodeMap } {
  const root = n("root", [
    n("a", [
      n("b1", [n("c1")]),
      n("b2", [n("d1", [n("d2"), n("e1", [n("e2")])])]),
    ]),
  ]);
  const nodeMap = prepare(root);
  return { root, nodeMap };
}

describe("visibleBranchStarts", () => {
  test("collects the main line start plus every extra fork child", () => {
    const { root } = buildStartsTree();
    expect(visibleBranchStarts(root).map((s) => s.id)).toEqual([
      "a",
      "b2",
      "e1",
    ]);
  });

  test("skips branch starts hidden by folding", () => {
    const { root } = buildStartsTree();
    // Folding a hides the whole b2 subtree (b2 and the nested e1).
    expect(visibleBranchStarts(root, new Set(["a"])).map((s) => s.id)).toEqual([
      "a",
    ]);
    // Folding d1 hides only the nested variation start e1.
    expect(visibleBranchStarts(root, new Set(["d1"])).map((s) => s.id)).toEqual(
      ["a", "b2"],
    );
  });

  test("a lone root is itself the only start", () => {
    const solo = n("root");
    prepare(solo);
    expect(visibleBranchStarts(solo).map((s) => s.id)).toEqual(["root"]);
  });

  test("a single line has only the main line start", () => {
    const root = n("root", [n("a", [n("b1")])]);
    prepare(root);
    expect(visibleBranchStarts(root).map((s) => s.id)).toEqual(["a"]);
  });
});

describe("orderedBranchStarts", () => {
  test("sorts by layout x when every start has a finite x", () => {
    const { root, nodeMap } = buildStartsTree();
    nodeMap.get("a")!.x = 0;
    nodeMap.get("b2")!.x = 2;
    nodeMap.get("e1")!.x = 1;
    expect(orderedBranchStarts(root).map((s) => s.id)).toEqual([
      "a",
      "e1",
      "b2",
    ]);
  });

  test("falls back to DFS pre-order when any x is missing", () => {
    const { root, nodeMap } = buildStartsTree();
    nodeMap.get("e1")!.x = 0;
    expect(orderedBranchStarts(root).map((s) => s.id)).toEqual([
      "a",
      "b2",
      "e1",
    ]);
  });
});

describe("nearestBranchStart", () => {
  test("main-line nodes anchor to the main line start", () => {
    const { root, nodeMap } = buildStartsTree();
    // The game-start root itself is not a branch start (no ancestor
    // hits the set) — Actions falls back to first/last start.
    expect(
      nearestBranchStart(root, visibleBranchStarts(root), nodeMap),
    ).toBeNull();
    expect(
      nearestBranchStart(nodeMap.get("c1")!, visibleBranchStarts(root), nodeMap)
        ?.id,
    ).toBe("a");
  });

  test("variation nodes anchor to their own branch start", () => {
    const { root, nodeMap } = buildStartsTree();
    const starts = visibleBranchStarts(root);
    expect(nearestBranchStart(nodeMap.get("d2")!, starts, nodeMap)?.id).toBe(
      "b2",
    );
    expect(nearestBranchStart(nodeMap.get("e2")!, starts, nodeMap)?.id).toBe(
      "e1",
    );
  });

  test("returns null when no ancestor is a visible branch start", () => {
    const { root, nodeMap } = buildStartsTree();
    // With a folded, b2 is no longer a visible start: d2's nearest
    // visible start would be a — but a IS in the set. Use a node whose
    // whole ancestor chain misses the set: none here, so craft one.
    const solo = n("root");
    const map = prepare(solo);
    expect(nearestBranchStart(solo, [], map)).toBeNull();
    // A folded fork hides b2; a node in that hidden branch anchors to
    // the main line start instead.
    const folded = new Set(["a"]);
    const visibleStarts = visibleBranchStarts(root, folded);
    expect(
      nearestBranchStart(nodeMap.get("d2")!, visibleStarts, nodeMap)?.id,
    ).toBe("a");
  });
});
