<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import { Chessground } from "chessground";
  import type { Api } from "chessground/api";
  import type { Config } from "chessground/config";
  import type { DrawShape } from "chessground/draw";
  import type * as cg from "chessground/types";
  import { Chess, type Move, type Square } from "chess.js";
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
    boardWidth?: number;
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
    boardWidth: boardWidthOverride,
    userShapes = [],
  }: Props = $props();

  import ChessQueen from "@lucide/svelte/icons/chess-queen";
  import ChessRook from "@lucide/svelte/icons/chess-rook";
  import ChessBishop from "@lucide/svelte/icons/chess-bishop";
  import ChessKnight from "@lucide/svelte/icons/chess-knight";

  let boardWidth = $derived(boardWidthOverride ?? settings.cellSize * 8);
  let boardElement: HTMLDivElement;
  let api: Api | null = null;
  let layoutChangeHandler: (() => void) | null = null;

  // Promotion state
  let promotingMove: { from: Square; to: Square } | null = $state(null);
  let promotingColor: "w" | "b" = $state("w");

  const PROMOTION_PIECES: { type: "q" | "r" | "b" | "n"; component: any }[] = [
    { type: "q", component: ChessQueen },
    { type: "r", component: ChessRook },
    { type: "b", component: ChessBishop },
    { type: "n", component: ChessKnight },
  ];

  function isPromotionRank(to: string, color: "w" | "b"): boolean {
    return (color === "w" && to[1] === "8") || (color === "b" && to[1] === "1");
  }

  function completePromotion(pieceType: "q" | "r" | "b" | "n") {
    if (!promotingMove) return;
    try {
      const chess = new Chess(fen);
      const move = chess.move({ from: promotingMove.from, to: promotingMove.to, promotion: pieceType });
      if (move) {
        eventBus.emit("runmove", move);
      }
    } catch { /* ignore */ }
    promotingMove = null;
  }
  let turnColor: cg.Color = $derived(
    fen.split(' ')[1] === 'b' ? 'black' : 'white'
  );
  let turnClass = $derived(
    settings.showTurnBorder ? `turn-${fen.split(' ')[1] === 'b' ? 'black' : 'white'}` : ""
  );

  function computeDests(fen: string): Map<cg.Key, cg.Key[]> {
    try {
      const chess = new Chess(fen);
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

  let shapes = $derived(settings.showNextMove ? computeVariationShapes(variations) : []);
  let dests = $derived(computeDests(fen));
  let _check: cg.Color | false = $derived(checkColor || false);

  onMount(async () => {
    const events: Config["events"] = freeMode
      ? {
          change: () => {
            if (api) eventBus.emit("fen-updated", api.getFen());
          },
          select: (key) => {
            eventBus.emit("click", key);
          },
        }
      : {
          move: (orig, dest) => {
            const chess = new Chess(fen);
            const piece = chess.get(orig as Square);
            const color = piece?.color;
            if (piece?.type === "p" && color && isPromotionRank(dest, color)) {
              // Check if any legal promotion exists
              try {
                const testChess = new Chess(fen);
                const moves = testChess.moves({ square: orig as Square, verbose: true }) as Move[];
                const promoMoves = moves.filter((m) => m.to === dest && m.promotion);
                if (promoMoves.length > 0) {
                  api?.cancelMove();
                  promotingMove = { from: orig as Square, to: dest as Square };
                  promotingColor = color;
                  return;
                }
              } catch { /* fall through */ }
            }
            try {
              const move = chess.move({ from: orig, to: dest });
              if (move) {
                eventBus.emit("runmove", move);
              } else {
                api?.cancelMove();
                eventBus.emit("invalid-move", { from: orig, to: dest });
              }
            } catch {
              api?.cancelMove();
              eventBus.emit("invalid-move", { from: orig, to: dest });
            }
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
    };

    if (freeMode) {
      config.draggable = { deleteOnDropOff: true };
    }

    config.check = _check;

    if (lastMove) {
      config.lastMove = lastMove;
    }

    if (selectedSquare) {
      config.selected = selectedSquare;
    }

    // 等待容器布局完成，避免 bounds 为 0 时 renderCircle 产生 NaN
    if (!boardElement.offsetWidth) {
      await new Promise<void>(resolve => {
        const ro = new ResizeObserver(() => {
          if (boardElement.offsetWidth) { ro.disconnect(); resolve(); }
        });
        ro.observe(boardElement);
      });
    }
    api = Chessground(boardElement, config);

    layoutChangeHandler = () => {
      if (api) {
        api.state.dom.bounds.clear();
        api.state.dom.redraw();
      }
    };
    document.body.addEventListener("layout-change", layoutChangeHandler);
  });

  onDestroy(() => {
    if (layoutChangeHandler) {
      document.body.removeEventListener("layout-change", layoutChangeHandler);
    }
    if (api) {
      api.destroy();
    }
  });

  $effect(() => {
    if (!api) return;
    if (freeMode) {
      api.set({ fen, turnColor, check: _check });
    } else {
      api.set({ fen, turnColor, movable: { color: turnColor, dests }, check: _check });
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
    const cfg: any = {
      coordinates: true,
      viewOnly: settings.viewOnly ?? false,
    };
    if (!freeMode) {
      cfg.highlight = { lastMove: settings.showLastMove };
    }
    api.set(cfg);
  });
</script>

<div class="board-wrapper" style="width: {boardWidth}px">
  <div bind:this={boardElement} class="cg-wrap {turnClass}"></div>
  {#if promotingMove}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="promotion-overlay" onclick={() => (promotingMove = null)}>
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div class="promotion-choices {promotingColor}" onclick={(e) => e.stopPropagation()}>
        {#each PROMOTION_PIECES as { type, component: Icon }}
          <button class="promotion-btn" onclick={() => completePromotion(type)}>
            <Icon size={boardWidth * 0.11} strokeWidth={1.2} />
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

  :global(.xq-slider-value) {
    display: inline-flex; align-items: center; justify-content: center;
    min-width: 42px; height: 24px; margin-right: 8px;
    font-size: 13px; font-weight: 600;
    color: var(--text-accent); background: var(--background-modifier-border);
    border-radius: 4px; padding: 0 6px;
  }
  :global(.chess-setting-tab .setting-item) {
    border-top: none;
  }
  :global(cg-board) {
    background-color: var(--board-bg, #f0d9b5);
  }
</style>
