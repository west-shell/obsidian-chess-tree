<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import {
    type Api,
    type cg,
    Chess,
    Chessground,
    type Config,
    type DrawShape,
    type Move,
    type Square,
  } from "../chess";
  import type { EventBus } from "../core/event-bus";
  import type { ISettings } from "../types";

  interface Props {
    settings: ISettings;
    fen: string;
    lastMove?: [Square, Square] | null;
    selectedSquare?: Square | null;
    eventBus: EventBus;
    rotated: boolean;
    checkColor?: cg.Color | null;
    variations?: Move[];
    freeMode?: boolean;
    userShapes?: DrawShape[];
  }

  let {
    settings,
    fen,
    lastMove = null,
    selectedSquare = null,
    eventBus,
    rotated,
    checkColor = null,
    variations = [],
    freeMode = false,
    userShapes = [],
  }: Props = $props();

  import { iconSvg } from "../utils/icon";

  // 升变弹窗图标尺寸基于 cellSize 推算（棋盘宽 = cellSize * 8）
  let promoIconSize = $derived(settings.cellSize * 8 * 0.11);
  // oxlint-disable-next-line no-unassigned-vars
  let boardElement: HTMLDivElement;
  let api: Api | null = null;
  let layoutChangeHandler: (() => void) | null = null;

  // Promotion state (driven by promote event from BoardClick)
  let promotingMove: { from: Square; to: Square } | null = $state(null);
  let promotingColor: "w" | "b" = $state("w");

  const PROMOTION_PIECES: { type: "q" | "r" | "b" | "n"; icon: string }[] = [
    { type: "q", icon: "chess-queen" },
    { type: "r", icon: "chess-rook" },
    { type: "b", icon: "chess-bishop" },
    { type: "n", icon: "chess-knight" },
  ];

  function completePromotion(pieceType: "q" | "r" | "b" | "n") {
    if (!promotingMove) return;
    try {
      chess.load(fen);
      const move = chess.move({
        from: promotingMove.from,
        to: promotingMove.to,
        promotion: pieceType,
      });
      if (move) {
        eventBus.emit("runmove", move);
      }
    } catch {
      /* ignore */
    }
    promotingMove = null;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  function cancelPromotion() {}
  let turnColor: cg.Color = $derived(
    fen.split(" ")[1] === "b" ? "black" : "white",
  );
  let turnClass = $derived(
    settings.showTurnBorder
      ? `turn-${fen.split(" ")[1] === "b" ? "black" : "white"}`
      : "",
  );

  const chess = new Chess();

  function computeDests(fen: string): Map<cg.Key, cg.Key[]> {
    try {
      chess.load(fen);
      const dests = new Map<cg.Key, cg.Key[]>();
      const moves = chess.moves({ verbose: true }) as Move[];
      for (const move of moves) {
        const orig = move.from;
        const dest = move.to;
        if (!dests.has(orig)) {
          dests.set(orig, []);
        }
        dests.get(orig)!.push(dest);
      }
      return dests;
    } catch {
      return new Map();
    }
  }

  function computeVariationShapes(variations: Move[]): DrawShape[] {
    return variations.map((move) => ({
      orig: move.from,
      dest: move.to,
      brush: "blue",
    }));
  }

  let shapes = $derived(
    settings.showNextMove ? computeVariationShapes(variations) : [],
  );
  let dests = $derived(computeDests(fen));
  let _check: cg.Color | false = $derived(checkColor || false);
  onMount(async () => {
    const events: Config["events"] = freeMode
      ? {
          change: () => {},
          select: (key) => {
            eventBus.emit("click", key);
          },
        }
      : {
          move: (orig, dest) => {
            api?.cancelMove();
            eventBus.emit("trymove", {
              from: orig as Square,
              to: dest as Square,
            });
          },
        };

    const config: Config = {
      fen,
      orientation: rotated ? "black" : "white",
      turnColor,
      coordinates: true,
      viewOnly: settings.viewOnly ?? false,
      movable: freeMode
        ? { free: true, color: "both" }
        : {
            free: false,
            color: turnColor,
            showDests: true,
            dests,
          },
      highlight: freeMode
        ? { lastMove: false }
        : {
            lastMove: settings.showLastMove,
          },
      drawable: {
        enabled: true,
        visible: true,
        shapes: userShapes,
        autoShapes: shapes,
        onChange: (s) => {
          eventBus.emit("user-shapes-changed", s);
        },
      },
      events,
      ...(freeMode ? { draggable: { deleteOnDropOff: true } } : {}),
      ...(_check ? { check: _check } : {}),
      ...(lastMove ? { lastMove } : {}),
      ...(selectedSquare ? { selected: selectedSquare } : {}),
    };

    // 等待容器布局完成，避免 bounds 为 0 时 renderCircle 产生 NaN
    if (!boardElement.offsetWidth) {
      await new Promise<void>((resolve) => {
        const ro = new ResizeObserver(() => {
          if (boardElement.offsetWidth) {
            ro.disconnect();
            resolve();
          }
        });
        ro.observe(boardElement);
      });
    }
    api = Chessground(boardElement, config);

    eventBus.on<{ from: Square; to: Square; color: "w" | "b" }>(
      "promote",
      (payload) => {
        if (!payload) return;
        promotingMove = { from: payload.from, to: payload.to };
        promotingColor = payload.color;
      },
    );

    layoutChangeHandler = () => {
      if (api && boardElement.offsetWidth) {
        api.state.dom.bounds.clear();
        api.state.dom.redraw();
      }
    };
    activeDocument.body.addEventListener(
      "chess-layout-change",
      layoutChangeHandler,
    );
  });

  onDestroy(() => {
    if (layoutChangeHandler) {
      activeDocument.body.removeEventListener(
        "chess-layout-change",
        layoutChangeHandler,
      );
    }
    if (api) {
      api.destroy();
    }
  });

  $effect(() => {
    if (!api || promotingMove) return;
    if (freeMode) {
      api.set({ fen, turnColor, check: _check });
    } else {
      api.set({
        fen,
        turnColor,
        movable: { color: turnColor, dests },
        check: _check,
      });
    }
    api.selectSquare(null);
  });

  $effect(() => {
    if (!api) return;
    api.set({ orientation: rotated ? "black" : "white" });
  });

  $effect(() => {
    if (!api) return;
    api.set({
      lastMove: lastMove ? lastMove : undefined,
    });
  });

  $effect(() => {
    if (!api) return;
    api.set({ drawable: { autoShapes: shapes } });
  });

  $effect(() => {
    if (!api) return;
    api.setShapes(userShapes);
  });

  $effect(() => {
    if (!api || freeMode) return;
    if (selectedSquare) {
      api.selectSquare(selectedSquare, true);
    } else {
      api.selectSquare(null);
    }
  });

  $effect(() => {
    if (!api) return;
    const cfg: Config = {
      coordinates: true,
      viewOnly: settings.viewOnly ?? false,
    };
    if (!freeMode) {
      cfg.highlight = { lastMove: settings.showLastMove };
    }
    api.set(cfg);
  });
</script>

<div class="board-wrapper">
  <div bind:this={boardElement} class="cg-wrap {turnClass}"></div>
  {#if promotingMove}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="promotion-overlay">
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="promotion-choices {promotingColor}"
        onclick={(e) => e.stopPropagation()}
      >
        {#each PROMOTION_PIECES as { type, icon }}
          <button class="promotion-btn" onclick={() => completePromotion(type)}>
            {@html iconSvg(icon, promoIconSize, 1.2)}
          </button>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  .cg-wrap {
    flex-shrink: 0;
    aspect-ratio: 1;
    border-radius: 2px;
  }

  .cg-wrap.turn-white {
    box-shadow: 0 0 12px 3px rgba(255, 255, 255, 0.7);
  }

  .cg-wrap.turn-black {
    box-shadow: 0 0 12px 3px rgba(0, 0, 0, 0.7);
  }

  .board-wrapper {
    --bw: var(--chess-board-width, calc(var(--chess-cell-size, 50px) * 8));
    width: var(--bw);
    position: relative;
  }

  .promotion-overlay {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10;
  }

  .promotion-choices {
    display: flex;
    gap: 4px;
    padding: 6px;
    border-radius: 6px;
    background: var(--background-primary);
    color: var(--text-normal);
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.3);
  }

  .promotion-btn {
    all: unset;
    cursor: pointer;
    padding: 4px;
    border-radius: 4px;
    border: 1px solid transparent;
    color: var(--text-normal);
    transition: background 0.15s;
  }

  .promotion-btn:hover {
    background: var(--background-modifier-hover);
    border-color: var(--color-accent);
  }
</style>
