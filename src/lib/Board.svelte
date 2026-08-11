<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import { SvelteMap } from "svelte/reactivity";
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
    engineBestMove?: { from: Square; to: Square } | null;
    enginePonder?: { from: Square; to: Square } | null;
    glyphShapes?: DrawShape[];
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
    engineBestMove = null,
    enginePonder = null,
    glyphShapes = [],
  }: Props = $props();

  import { iconSvg } from "../utils/icon";

  let boardElement!: HTMLDivElement;
  let api: Api | null = $state(null);
  let layoutChangeHandler: (() => void) | null = null;
  let boardResizeRo: ResizeObserver | null = null;
  let resizeTimer: ReturnType<typeof setTimeout> | null = null;
  let promoIconSize = $derived(
    boardElement?.offsetWidth ? boardElement.offsetWidth * 0.11 : 30,
  );
  function handleWheel(e: WheelEvent) {
    if (Math.abs(e.deltaY) < Math.abs(e.deltaX)) return;
    e.preventDefault();
    if (e.deltaY > 0) {
      eventBus.emit("btn-click", { name: "next" });
    } else if (e.deltaY < 0) {
      eventBus.emit("btn-click", { name: "back" });
    }
  }

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
      const dests = new SvelteMap<cg.Key, cg.Key[]>();
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
      return new SvelteMap();
    }
  }

  function computeVariationShapes(variations: Move[]): DrawShape[] {
    return variations.map((move) => ({
      orig: move.from,
      dest: move.to,
      brush: "blue",
    }));
  }

  let engineShapes: DrawShape[] = $derived([
    ...(settings.showEngineBestMove && engineBestMove
      ? [{ orig: engineBestMove.from, dest: engineBestMove.to, brush: "green" }]
      : []),
    ...(settings.showEnginePonder && enginePonder
      ? [{ orig: enginePonder.from, dest: enginePonder.to, brush: "yellow" }]
      : []),
  ]);
  let shapes = $derived([
    ...(settings.showNextMove ? computeVariationShapes(variations) : []),
    ...engineShapes,
    ...glyphShapes,
  ]);
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

    boardResizeRo = new ResizeObserver(() => {
      if (!api || !boardElement.offsetWidth) return;
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        resizeTimer = null;
        if (api && boardElement.offsetWidth) {
          api.state.dom.bounds.clear();
          api.state.dom.redraw();
        }
      }, 100);
    });
    boardResizeRo.observe(boardElement);

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
    if (boardResizeRo) {
      boardResizeRo.disconnect();
      boardResizeRo = null;
    }
    if (resizeTimer) {
      clearTimeout(resizeTimer);
      resizeTimer = null;
    }
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

  function eventPosition(e: Event): [number, number] | undefined {
    const me = e as MouseEvent;
    if (me.clientX || me.clientX === 0) return [me.clientX, me.clientY];
    const te = e as TouchEvent;
    if (te.targetTouches?.[0])
      return [te.targetTouches[0].clientX, te.targetTouches[0].clientY];
    return undefined;
  }

  function startResize(start: Event) {
    start.preventDefault();
    const moveEvent = start.type === "touchstart" ? "touchmove" : "mousemove";
    const upEvent = start.type === "touchstart" ? "touchend" : "mouseup";
    const startPos = eventPosition(start);
    if (!startPos) return;
    const initialZoom = settings.zoom;
    let zoom = initialZoom;

    const resize = (move: Event) => {
      const pos = eventPosition(move);
      if (!pos) return;
      const delta = pos[0] - startPos[0] + pos[1] - startPos[1];
      zoom = Math.round(Math.min(100, Math.max(0, initialZoom + delta / 5)));
      const boardScale = (zoom / 100) * 0.75 + 0.25;
      activeDocument.body.style.setProperty(
        "--chess-board-scale",
        `${boardScale}`,
      );
      activeDocument.body.dispatchEvent(new Event("chessground.resize"));
    };

    activeDocument.body.classList.add("resizing");
    activeDocument.addEventListener(moveEvent, resize);
    activeDocument.addEventListener(
      upEvent,
      () => {
        activeDocument.removeEventListener(moveEvent, resize);
        activeDocument.body.classList.remove("resizing");
        activeDocument.body.dispatchEvent(
          new CustomEvent("chess-zoom-changed", { detail: zoom }),
        );
      },
      { once: true },
    );
  }
</script>

<div
  class="board-wrapper chess-layout__board {turnClass}"
  onwheel={handleWheel}
>
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
        {#each PROMOTION_PIECES as { type, icon } (type)}
          <button class="promotion-btn" onclick={() => completePromotion(type)}>
            <!-- eslint-disable-next-line svelte/no-at-html-tags -->
            {@html iconSvg(icon, promoIconSize, 1.2)}
          </button>
        {/each}
      </div>
    </div>
  {/if}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="board-resize"
    onmousedown={startResize}
    ontouchstart={startResize}
  ></div>
</div>

<style>
  :global(.cg-wrap) {
    container-type: inline-size;
    flex-shrink: 0;
    aspect-ratio: 1;
    border-radius: 2px;
  }

  :global(cg-container) {
    left: 0;
    right: 0;
    bottom: 0;
    margin: auto;
  }

  .cg-wrap :global(coords) {
    display: var(--chess-coords-display, flex);
    font-size: clamp(7px, 2.5cqw, 14px);
  }

  .cg-wrap :global(coords.ranks) {
    left: 0;
    top: 0;
    width: 12.5%;
    align-items: flex-start;
    justify-content: flex-start;
  }

  .cg-wrap :global(coords.files) {
    bottom: 0;
    left: 0;
    height: 12.5%;
    align-items: flex-end;
    justify-content: flex-end;
  }

  .cg-wrap :global(coords coord) {
    line-height: 1;
  }

  .cg-wrap :global(coords.ranks coord) {
    transform: none;
    padding-left: 2%;
    padding-top: 2%;
  }

  .cg-wrap :global(coords.files coord) {
    padding-right: 0%;
    padding-bottom: 0%;
    text-align: right;
  }

  .cg-wrap :global(cg-board) {
    background-color: var(--chess-board-bg, #f0d9b5);
  }

  .cg-wrap :global(piece) {
    touch-action: none;
  }

  .cg-wrap :global(cg-board square.oc.move-dest) {
    background: radial-gradient(
      transparent 0%,
      transparent 75%,
      rgba(20, 85, 0, 0.3) 75%
    );
  }

  .board-wrapper {
    --bw: var(
      --chess-board-width,
      min(
        var(--chess-board-max-size, 100vh) * var(--chess-board-scale, 0.85),
        100%
      )
    );
    width: var(--bw);
    position: relative;
    border-radius: 2px;
  }

  .board-wrapper.turn-white {
    background: rgba(255, 255, 255, 0.7);
    box-shadow: 0 0 12px 3px rgba(255, 255, 255, 0.7);
  }

  .board-wrapper.turn-black {
    background: rgba(0, 0, 0, 0.7);
    box-shadow: 0 0 12px 3px rgba(0, 0, 0, 0.7);
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

  .board-resize {
    position: absolute;
    right: 0;
    bottom: 0;
    width: 14px;
    height: 14px;
    cursor: nwse-resize;
    z-index: 5;

    &::before,
    &::after {
      background: var(--text-muted);
      content: "";
      position: absolute;
      height: 1px;
      left: 0;
    }

    &::before {
      width: 5px;
      transform: translate(7px, 8px) rotate(-45deg);
    }

    &::after {
      width: 10px;
      transform: translate(1px, 6px) rotate(-45deg);
    }

    &:hover {
      border-radius: 50%;
      background: var(--interactive-accent);
    }
  }

  :global(body.resizing) {
    user-select: none;
    -webkit-user-select: none;
  }
</style>
