import { describe, expect, test } from "vitest";

import type { ChessNode, NodeMap } from "../src/types";
import {
  calculateTreeLayout,
  PINNED_BOARD_PREFIX,
} from "../src/lib/Game/panel/layout";

/** 固定盘 / 置顶评论块的参与尺寸（与 TreeGraph.svelte 一致）。 */
const BW = 140;
const BH = 140; // chess 方形棋盘
const NODE_H = 11;
const NODE_W = 26;
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

function mulberry32b(seed: number): () => number {
  return mulberry32(seed * 7919 + 131);
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
  // 随机评论（改变大小Fn的非棋盘参与尺寸分布）
  if (rng() < 0.35) {
    const lines = 1 + Math.floor(rng() * 16);
    n.comments = new Array(lines).fill("w".repeat(Math.floor(rng() * 30)));
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

/**
 * 回归：真实尺寸布局下固定盘 / 置顶评论块不能互相遮挡。
 *
 * 背景：nodeBottom 的纵向余量若低估高叶子（固定盘高数行、评论块可
 * 到 170+），轮廓行走会在 bands 仍重叠时提前换边，深处同侧 pinned
 * 盘不会被水平推开而与上方盘重叠。本测试用固定种子随机树扫描。
 *
 * 命中即说明轮廓余量公式回退（或新的虚拟叶子类型缺少正确尺寸）。
 */
describe("layout: pinned real-size blocks never overlap", () => {
  test("4000 random trees × random pins: no block-block band overlap", () => {
    const rng = mulberry32(11);
    const wideRng = mulberry32b(11);
    const findings: string[] = [];
    for (let t = 0; t < 4000 && findings.length < 3; t++) {
      idc = 0;
      const root = mk(rng, 2 + Math.floor(rng() * 5));
      root.id = "node-root";
      const map = toMap(root);
      const ids: string[] = ["node-root"];
      const walk = (n: ChessNode) => {
        for (const c of n.children) {
          ids.push(c.id);
          walk(c);
        }
      };
      walk(root);
      const picks = ids.slice();
      const pinCount = Math.min(picks.length, 1 + Math.floor(rng() * 10));
      const pins: string[] = [];
      for (let i = 0; i < pinCount; i++) {
        pins.push(picks.splice(Math.floor(rng() * picks.length), 1)[0]);
      }
      const sizeMemo = new Map<string, number>();
      const sizeOf = (n: ChessNode): number => {
        if (sizeMemo.has(n.id)) return sizeMemo.get(n.id)!;
        const w = rng() < 0.3 ? 13 : 14 + Math.floor(rng() * 32);
        sizeMemo.set(n.id, w);
        return w;
      };
      const res = calculateTreeLayout(map, new Set(), [], {
        gapX: GAP_X,
        gapY: GAP_Y,
        sizeFn: (n) => {
          if (n.id.startsWith(PINNED_BOARD_PREFIX))
            return { width: BW, height: BH };
          if (n.id.startsWith("pincomment:")) {
            const lines = (n.comments ?? []).length || 1;
            return {
              width: Math.min(180, (n.comments?.[0]?.length ?? 10) * 5.5) + 8,
              height: lines * 11 + 6,
            };
          }
          return { width: sizeOf(n) || NODE_W, height: NODE_H };
        },
        pinnedBoardIds: pins,
      });
      const boards = res.pinnedBoardNodes.filter(
        (b) => b.x !== undefined && b.y !== undefined,
      );
      for (let i = 0; i < boards.length; i++) {
        for (let j = i + 1; j < boards.length; j++) {
          const a = boards[i];
          const b = boards[j];
          const ox =
            Math.min(a.x! + BW / 2, b.x! + BW / 2) -
            Math.max(a.x! - BW / 2, b.x! - BW / 2);
          const oy =
            Math.min(a.y! + BH / 2, b.y! + BH / 2) -
            Math.max(a.y! - BH / 2, b.y! - BH / 2);
          if (ox > 0 && oy > 0) {
            findings.push(
              `tree#${t} ${a.id} vs ${b.id}: x-ov ${ox.toFixed(1)} y-ov ${oy.toFixed(1)}`,
            );
          }
        }
      }
    }
    expect(findings, findings.join("\n")).toEqual([]);
    void wideRng;
  });
});
