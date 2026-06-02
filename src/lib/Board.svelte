<script lang="ts">
  import { onMount, onDestroy } from "svelte";
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
    variations = [],
    freeMode = false,
    boardWidth: boardWidthOverride,
    userShapes = [],
  }: Props = $props();

  let boardWidth = $derived(boardWidthOverride ?? settings.cellSize * 8);
  let boardElement: HTMLDivElement;
  let api: Api | null = null;
  let layoutChangeHandler: (() => void) | null = null;
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
            try {
              const chess = new Chess(fen);
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
      highlight: {
        lastMove: settings.showLastMove,
        check: true,
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

    if (lastMove) {
      config.lastMove = lastMove;
    }

    if (selectedSquare) {
      config.selected = selectedSquare;
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
      api.set({ fen, turnColor });
    } else {
      api.set({ fen, turnColor, movable: { color: turnColor, dests } });
    }
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
    api.set({
      coordinates: true,
      viewOnly: settings.viewOnly ?? false,
      highlight: { lastMove: settings.showLastMove },
    });
  });
</script>

<div bind:this={boardElement} class="cg-wrap {turnClass}" style="width: {boardWidth}px"></div>

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
</style>
