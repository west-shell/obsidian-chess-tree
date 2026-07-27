<script lang="ts">
  import Tree from "./Tree.svelte";
  import Board from "../Board.svelte";
  import Toolbar from "./Toolbar.svelte";
  import type { ChessNode, ISettings, NodeMap } from "../../types";
  import type { EventBus } from "../../core/event-bus";
  import type { cg, DrawShape, Move, Square } from "../../chess";
  import { onMount, tick } from "svelte";

  const SHAPES_RE = /^([a-h][1-8])([a-h][1-8])?:([gryb])$/;
  const BRUSH_MAP: Record<string, string> = {
    green: "g",
    red: "r",
    blue: "b",
    yellow: "y",
  };
  const BRUSH_REV: Record<string, string> = {
    g: "green",
    r: "red",
    b: "blue",
    y: "yellow",
  };

  function loadShapes(node: ChessNode): DrawShape[] {
    if (!node.comments) return [];
    const shapes: DrawShape[] = [];
    for (const c of node.comments) {
      const m = c.match(SHAPES_RE);
      if (m) {
        const brush = BRUSH_REV[m[3]];
        shapes.push({
          orig: m[1] as cg.Key,
          dest: m[2] as cg.Key | undefined,
          brush,
        });
      }
    }
    return shapes;
  }

  function saveShapes(node: ChessNode, shapes: DrawShape[]) {
    const shapeComments = shapes.map(
      (s) => s.orig + (s.dest ?? "") + ":" + BRUSH_MAP[s.brush ?? "green"],
    );
    node.comments = [
      ...(node.comments ?? []).filter((c) => !SHAPES_RE.test(c)),
      ...shapeComments,
    ];
  }

  interface Props {
    settings: ISettings;
    fen: string;
    eventBus: EventBus;
    nodeMap: NodeMap;
    currentNode: ChessNode;
    currentPath: string[];
    isPGNView?: boolean;
  }

  let {
    settings,
    fen,
    eventBus,
    nodeMap,
    currentNode,
    currentPath,
    isPGNView = false,
  }: Props = $props();

  let lastMove: [Square, Square] | null = $derived(
    currentNode.move ? [currentNode.move.from, currentNode.move.to] : null,
  );
  let rotated = $state(false);
  let variations = $derived(
    currentNode.children
      .map((child) => child.move)
      .filter((m): m is Move => m != null) ?? [],
  );
  let userShapes = $derived(loadShapes(currentNode));
  let engineBestMove: { from: Square; to: Square } | null = $state(null);
  let enginePonder: { from: Square; to: Square } | null = $state(null);
  let checkColor = $derived(
    currentNode.move && /\+|#/.test(currentNode.move.san)
      ? currentNode.move.color === "w"
        ? "black"
        : "white"
      : null,
  ) as "white" | "black" | null;

  let treeViewEl: HTMLDivElement;
  let adaptiveBoardWidth = $state(300);

  $effect(() => {
    const el = treeViewEl;
    if (!el) return;
    const scale = Number.parseFloat(
      getComputedStyle(document.body).getPropertyValue("--chess-board-scale") ||
        "0.85",
    );
    const ro = new ResizeObserver(() => {
      const rect = el.getBoundingClientRect();
      const maxSize = Math.min(rect.width - 240, rect.height);
      adaptiveBoardWidth = Math.max(200, maxSize * scale);
    });
    ro.observe(el);
    return () => ro.disconnect();
  });

  onMount(async () => {
    await tick();
    eventBus.emit("ready");
  });

  $effect(() => {
    eventBus.on<{
      bestmove: string;
      ponder?: string;
      score?: number;
      depth?: number;
    } | null>("engine-result", (result) => {
      if (result) {
        const from = result.bestmove.slice(0, 2) as Square;
        const to = result.bestmove.slice(2, 4) as Square;
        engineBestMove = { from, to };
        if (result.ponder) {
          enginePonder = {
            from: result.ponder.slice(0, 2) as Square,
            to: result.ponder.slice(2, 4) as Square,
          };
        } else {
          enginePonder = null;
        }
      } else {
        engineBestMove = null;
        enginePonder = null;
      }
    });
    eventBus.on("clear-engine-bestmove", () => {
      engineBestMove = null;
      enginePonder = null;
    });
  });

  $effect(() => {
    eventBus.on<DrawShape[]>("user-shapes-changed", (shapes) => {
      saveShapes(currentNode, shapes ?? []);
      eventBus.emit("modified", null);
      eventBus.emit("updateUI", null);
    });
  });

  $effect(() => {
    eventBus.on("rotate", () => {
      rotated = !rotated;
    });
  });
</script>

<div
  class="chess-layout"
  bind:this={treeViewEl}
  style="--adaptive-board-width:{adaptiveBoardWidth}px"
>
  <div class="chess-layout__board">
    <Board
      {settings}
      {fen}
      {lastMove}
      {checkColor}
      {eventBus}
      {rotated}
      {variations}
      {userShapes}
      {engineBestMove}
      {enginePonder}
      disableResize={isPGNView}
    />
  </div>
  <div class="chess-layout__toolbar">
    <Toolbar {eventBus} {fen} />
  </div>
  <div class="chess-layout__tools">
    <Tree {nodeMap} {eventBus} {currentNode} {currentPath} />
  </div>
</div>

<style>
  .chess-layout {
    height: 100%;
  }
</style>
