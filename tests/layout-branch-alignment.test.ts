import { describe, expect, test } from "vitest";
import type { ChessNode, NodeMap } from "../src/types";
import {
  calculateTreeLayout,
  PINNED_BOARD_PREFIX,
} from "../src/lib/Game/panel/layout";

/**
 * 回归：紧凑叶子的轮廓余量必须保持旧行为（下探 2 行）。
 *
 * 背景：nodeBottom 一度对普通招法叶子（h=11）也套用高叶子的
 * h/2 + 5*ROW_STEP 余量（80.5px ≈ 5.4 行），轮廓行走在纵向并不
 * 重叠的单步侧分支之间也做横向分离，主干上相隔 2~5 行的分支全部
 * 阶梯化错开（旧布局同列）。高叶子余量只应属于置顶评论块 / 固定
 * 盘预览（h>11）。
 *
 * 例：1. e4 e6 (1... d5) 2. f4 f5 (2... h5) —— d5 与 h5 都是单步
 * 侧分支、纵向不重叠，应在同一竖直列上。
 */

const NODE_W = 13;
const NODE_H = 11;
const GAP_X = 6;
const GAP_Y = 4;

let idc = 0;
function leaf(): ChessNode {
  return { id: `n${idc++}`, fen: "", move: null, color: null, children: [] };
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
function layout(map: NodeMap) {
  return calculateTreeLayout(map, new Set(), [], {
    gapX: GAP_X,
    gapY: GAP_Y,
    sizeFn: () => ({ width: NODE_W, height: NODE_H }),
  });
}

describe("layout: single-move side branches share the column", () => {
  test("branches 2 plies apart stay on one vertical line", () => {
    // 1. e4 e6 (1... d5) 2. f4 f5 (2... h5)
    idc = 0;
    const [e4, d5] = [leaf(), leaf()];
    const [f4, h5] = [leaf(), leaf()];
    const [e6, f5] = [leaf(), leaf()];
    e4.children = [e6, d5];
    e6.children = [f4];
    f4.children = [f5, h5];
    const root = leaf();
    root.children = [e4];
    const res = layout(toMap(root));
    const byId = new Map(res.nodes.map((n) => [n.id, n]));
    const d5x = byId.get(d5.id)!.x;
    const h5x = byId.get(h5.id)!.x;
    expect(d5x).toBeDefined();
    expect(h5x).toBeDefined();
    expect(d5x).toBe(h5x);
  });

  test("branches 4 plies apart stay on one vertical line", () => {
    // 1. e4 e6 (1... d5) 2. f4 f5 3. g4 g5 (3... h5)
    idc = 0;
    const [e4, d5] = [leaf(), leaf()];
    const [g4, h5] = [leaf(), leaf()];
    const [e6, f4, f5, g5] = [leaf(), leaf(), leaf(), leaf()];
    e4.children = [e6, d5];
    e6.children = [f4];
    f4.children = [f5];
    f5.children = [g4];
    g4.children = [g5, h5];
    const root = leaf();
    root.children = [e4];
    const res = layout(toMap(root));
    const byId = new Map(res.nodes.map((n) => [n.id, n]));
    expect(byId.get(d5.id)!.x).toBe(byId.get(h5.id)!.x);
  });

  test("same-row branches are still separated", () => {
    // root -> a (x) with two leaf branches at the same row
    idc = 0;
    const a = leaf();
    const [b1, b2] = [leaf(), leaf()];
    a.children = [b1, b2];
    const root = leaf();
    root.children = [a];
    const res = layout(toMap(root));
    const byId = new Map(res.nodes.map((n) => [n.id, n]));
    const dx = Math.abs(byId.get(b1.id)!.x! - byId.get(b2.id)!.x!);
    // one pitch apart: 13 + 6 = 19
    expect(dx).toBeCloseTo(NODE_W + GAP_X, 5);
  });
});

describe("layout: pinned board deep-walk regression (user repro)", () => {
  // 1. e4 e6 (1... d5 2. f4 (2. g4 dxe4 3. f3)) 2. f4 (2. e5 f5 3. c4)
  // 2... f5 {[%pin b]} (2... h5) 3. g4 (3. h4) *
  //
  // f5 固定盘后，separate() 的轮廓行走必须按真实 band 下探到
  // "c4 vs 固定盘" 的比较站并完成横推；若轮廓提前终止（旧实现用
  // nodeBottom 余量估计推进深度），h4 会与 c4 同列重叠。
  const BW = 135;
  const BH = 135;

  test("no overlaps; h4 horizontally clear of c4", () => {
    idc = 0;
    const e4 = leaf(),
      d5 = leaf();
    const f4b = leaf(),
      g4b = leaf(),
      dxe4 = leaf(),
      f3 = leaf();
    const e6 = leaf(),
      f4 = leaf(),
      e5 = leaf(),
      f5b = leaf(),
      c4 = leaf();
    const f5 = leaf(),
      h5 = leaf(),
      g4 = leaf(),
      h4 = leaf();
    e4.children = [e6, d5];
    d5.children = [f4b, g4b];
    g4b.children = [dxe4];
    dxe4.children = [f3];
    e6.children = [f4, e5];
    e5.children = [f5b];
    f5b.children = [c4];
    f4.children = [f5, h5];
    f5.children = [g4, h4];
    const root = leaf();
    root.children = [e4];

    const res = calculateTreeLayout(toMap(root), new Set(), [], {
      gapX: GAP_X,
      gapY: GAP_Y,
      sizeFn: (n) =>
        n.id.startsWith(PINNED_BOARD_PREFIX)
          ? { width: BW, height: BH }
          : {
              width: NODE_W,
              height: NODE_H,
              // 镜像生产 sizeFn：末端底部预留一个节点高。
              padBottom: n.children.length === 0 ? NODE_H : 0,
            },
      pinnedBoardIds: [f5.id],
    });

    const boxes = [
      ...res.nodes.map((n) => ({
        id: n.id,
        w: NODE_W,
        h: NODE_H,
        x: n.x!,
        y: n.y!,
      })),
      ...res.pinnedBoardNodes.map((n) => ({
        id: n.id,
        w: BW,
        h: BH,
        x: n.x!,
        y: n.y!,
      })),
    ].map((e) => ({
      id: e.id,
      l: e.x - e.w / 2,
      r: e.x + e.w / 2,
      t: e.y - e.h / 2,
      b: e.y + e.h / 2,
    }));
    const overlaps: string[] = [];
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i];
        const b = boxes[j];
        if (
          Math.min(a.r, b.r) - Math.max(a.l, b.l) > 0.01 &&
          Math.min(a.b, b.b) - Math.max(a.t, b.t) > 0.01
        ) {
          overlaps.push(`${a.id} <-> ${b.id}`);
        }
      }
    }
    expect(overlaps, overlaps.join("; ")).toEqual([]);

    // 原重叠对：c4 与 h4 至少间隔一列（13 + 6）
    const byId = new Map(res.nodes.map((n) => [n.id, n]));
    const dx = byId.get(h4.id)!.x! - byId.get(c4.id)!.x!;
    expect(dx).toBeGreaterThanOrEqual(NODE_W + GAP_X);
  });
});

describe("layout: terminal-node bottom pad (line-blockage clearance)", () => {
  // 末端节点的"2 倍高度"= 底部多预留一个节点高的空隙（padBottom），
  // 只加宽纵向 band 用于横向分离判定：相邻行同列的末端会被分开，
  // 肘部连线不被挡；节点自身的 y 与行距完全不变。
  function padLayout(map: NodeMap, pad: boolean) {
    return calculateTreeLayout(map, new Set(), [], {
      gapX: GAP_X,
      gapY: GAP_Y,
      sizeFn: (n) => ({
        width: NODE_W,
        height: NODE_H,
        padBottom: pad && n.children.length === 0 ? NODE_H : 0,
      }),
    });
  }

  test("adjacent-row terminals same column get separated; y unchanged", () => {
    // 1. e4 e6 (1... d5 2. f4b) 2. f4 f5 (2... h5)
    // 末端 f4b 与 h5 相邻行同列：无 pad 时 f4→h5 的肘部连线被 f4b
    // 挡住；有 pad 时触发横向分离。
    idc = 0;
    const e4 = leaf(),
      d5 = leaf(),
      f4b = leaf();
    const e6 = leaf(),
      f4 = leaf(),
      f5 = leaf(),
      h5 = leaf();
    e4.children = [e6, d5];
    e6.children = [f4];
    f4.children = [f5, h5];
    d5.children = [f4b];
    const root = leaf();
    root.children = [e4];
    const map = toMap(root);

    const plain = padLayout(map, false);
    // 快照 plain 的 x/y：两次布局复用同一批节点对象，padded 运行会
    // 覆写 x/y，直接持有引用会读到 padded 的值。
    const plainXY = new Map(plain.nodes.map((n) => [n.id, { x: n.x, y: n.y }]));
    const padded = padLayout(map, true);
    // pad 不改变任何节点的 y（末端位置不下移、行距不变）
    for (const n of padded.nodes) {
      expect(n.y).toBe(plainXY.get(n.id)!.y);
    }
    // 无 pad：f4b 与 h5 同列（连线被挡的形态）
    expect(plainXY.get(f4b.id)!.x).toBe(plainXY.get(h5.id)!.x);
    // 有 pad：f4b 与 h5 至少隔一列
    const paddedById = new Map(padded.nodes.map((n) => [n.id, n]));
    const dx = paddedById.get(f4b.id)!.x! - paddedById.get(h5.id)!.x!;
    expect(Math.abs(dx)).toBeGreaterThanOrEqual(NODE_W + GAP_X);
  });

  test("2-row-apart terminals stay on one column with pad", () => {
    // 1. e4 e6 (1... d5) 2. f4 f5 (2... h5)
    // 相隔 2 行的末端带不重叠：pad 不破坏同列对齐。
    idc = 0;
    const [e4, d5] = [leaf(), leaf()];
    const [f4, h5] = [leaf(), leaf()];
    const [e6, f5] = [leaf(), leaf()];
    e4.children = [e6, d5];
    e6.children = [f4];
    f4.children = [f5, h5];
    const root = leaf();
    root.children = [e4];
    const res = padLayout(toMap(root), true);
    const byId = new Map(res.nodes.map((n) => [n.id, n]));
    expect(byId.get(d5.id)!.x).toBe(byId.get(h5.id)!.x);
  });
});
