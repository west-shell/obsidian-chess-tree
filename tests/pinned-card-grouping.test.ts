import { describe, expect, test } from "vitest";

import type { ChessNode, NodeMap } from "../src/types";
import {
  calculateTreeLayout,
  PINNED_BOARD_PREFIX,
  PINNED_COMMENT_PREFIX,
} from "../src/lib/Game/panel/layout";

/** 参与尺寸（与 TreeGraph.svelte 一致）。 */
const BW = 135;
const BH = 135; // chess 方形棋盘 = 精确 9 行步（9 × 15）
const CW = 100;
const CH = 40;
const GAP_X = 6;
const GAP_Y = 4;

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d_2b_79_f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

let idc = 0;
function mk(rng: () => number, depth: number): ChessNode {
  const n: ChessNode = {
    id: `n${idc++}`,
    fen: "",
    move: null,
    color: null,
    children: [],
    comments: [],
  };
  const kids = rng() < 0.72 ? 1 : 2 + Math.floor(rng() * 3);
  if (depth > 0) {
    for (let i = 0; i < kids; i++) n.children.push(mk(rng, depth - 1));
  }
  if (rng() < 0.35) {
    const lines = 1 + Math.floor(rng() * 4);
    n.comments = new Array(lines).fill("w".repeat(12));
  }
  return n;
}

function toMap(root: ChessNode): NodeMap {
  const map: NodeMap = new Map([["node-root", root]]);
  const walk = (n: ChessNode) => {
    map.set(n.id, n);
    for (const c of n.children) walk(c);
  };
  walk(root);
  return map;
}

function allIds(root: ChessNode): string[] {
  const ids: string[] = [];
  const walk = (n: ChessNode) => {
    for (const c of n.children) {
      ids.push(c.id);
      walk(c);
    }
  };
  walk(root);
  return ids;
}

function sizeFnFor(n: ChessNode): { width: number; height: number } {
  if (n.id.startsWith(PINNED_COMMENT_PREFIX)) return { width: CW, height: CH };
  if (n.id.startsWith(PINNED_BOARD_PREFIX)) return { width: BW, height: BH };
  return { width: 26, height: 11 };
}

/**
 * 回归：同一节点同时固定评论 + 棋盘时组成一张卡片——评论挂在棋盘
 * 正下方（同中心线，垂直链 = 棋盘底 + gapY + 评论半高），随卡片整体
 * 移动；卡片间 / 卡片与固定盘之间不互相遮挡。
 */
describe("layout: pinned comment+board card", () => {
  test("comment hangs centered directly under its board", () => {
    const rng = mulberry32(3);
    let cases = 0;
    let maxDx = 0;
    let maxChainErr = 0;
    for (let t = 0; t < 2000; t++) {
      idc = 0;
      const root = mk(rng, 2 + Math.floor(rng() * 5));
      root.id = "node-root";
      const map = toMap(root);
      const ids = allIds(root);
      const target = ids[Math.floor(rng() * ids.length)];
      if ((map.get(target)?.comments ?? []).length === 0) continue;
      cases++;
      const res = calculateTreeLayout(map, new Set(), [], {
        gapX: GAP_X,
        gapY: GAP_Y,
        sizeFn: sizeFnFor,
        pinnedCommentIds: [target],
        pinnedBoardIds: [target],
      });
      const cn = res.pinnedCommentNodes[0];
      const bn = res.pinnedBoardNodes[0];
      if (!cn || !bn || cn.x === undefined || bn.x === undefined) continue;
      maxDx = Math.max(maxDx, Math.abs(cn.x - bn.x));
      const chain = bn.y! + BH / 2 + GAP_Y + CH / 2 - cn.y!;
      maxChainErr = Math.max(maxChainErr, Math.abs(chain));
    }
    expect(cases).toBeGreaterThan(100);
    expect(maxDx).toBe(0);
    expect(maxChainErr).toBe(0);
  });

  test("cards and boards never overlap (4000 random trees)", () => {
    const rng = mulberry32(7);
    const findings: string[] = [];
    for (let t = 0; t < 4000 && findings.length < 3; t++) {
      idc = 0;
      const root = mk(rng, 2 + Math.floor(rng() * 5));
      root.id = "node-root";
      const map = toMap(root);
      const ids = allIds(root);
      const c1 = ids[Math.floor(rng() * ids.length)];
      let c2 = ids[Math.floor(rng() * ids.length)];
      if (c2 === c1) c2 = ids[(ids.indexOf(c1) + 1) % ids.length];
      if ((map.get(c1)?.comments ?? []).length === 0) continue;
      const res = calculateTreeLayout(map, new Set(), [], {
        gapX: GAP_X,
        gapY: GAP_Y,
        sizeFn: sizeFnFor,
        pinnedCommentIds: [c1],
        pinnedBoardIds: [c1, c2],
      });
      const boxes = [
        ...res.pinnedBoardNodes.map((bn) => ({
          x0: bn.x! - BW / 2,
          y0: bn.y! - BH / 2,
          x1: bn.x! + BW / 2,
          y1: bn.y! + BH / 2,
          key: bn.id.slice(PINNED_BOARD_PREFIX.length),
          kind: "board",
        })),
        ...res.pinnedCommentNodes.map((cn) => ({
          x0: cn.x! - CW / 2,
          y0: cn.y! - CH / 2,
          x1: cn.x! + CW / 2,
          y1: cn.y! + CH / 2,
          key: cn.id.slice(PINNED_COMMENT_PREFIX.length),
          kind: "comment",
        })),
      ];
      for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
          const a = boxes[i];
          const b = boxes[j];
          // the grouped comment touches its own board by design
          if (a.key === b.key && a.kind !== b.kind) continue;
          const w = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
          const h = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
          if (w > 0 && h > 0) {
            findings.push(`tree#${t} ${a.kind}:${a.key} x ${b.kind}:${b.key}`);
          }
        }
      }
    }
    expect(findings).toEqual([]);
  });
});
