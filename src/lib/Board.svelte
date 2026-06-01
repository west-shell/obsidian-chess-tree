<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { Chessground } from "chessground";
  import type { Api } from "chessground/api";
  import type { Config } from "chessground/config";
  import type { DrawShape } from "chessground/draw";
  import { pos2key, key2pos } from "chessground/util";
  import type * as cg from "chessground/types";
  import { genFENFromBoard } from "../utils/parse";
  import { isValidMove, findKing, isSquareAttacked, isInCheck } from "../utils/rules";
  import type { ITurn } from "../types";
  import type { EventBus } from "../core/event-bus";
  import type { IBoard, IMove, IPosition, ISettings, IGameState } from "../types";

  const COLS = 8;
  const ROWS = 8;

  interface Props {
    settings: ISettings;
    board: IBoard;
    lastMove?: IMove | null;
    markedPos?: IPosition | null;
    currentTurn: ITurn;
    eventBus: EventBus;
    rotated: boolean;
    variations?: IMove[];
    freeMode?: boolean;
    boardWidth?: number;
    userShapes?: DrawShape[];
    gameState?: IGameState | null;
  }

  let {
    settings,
    board,
    lastMove = null,
    markedPos = null,
    currentTurn,
    eventBus,
    rotated,
    variations = [],
    freeMode = false,
    boardWidth: boardWidthOverride,
    userShapes = [],
    gameState = null,
  }: Props = $props();

  let boardWidth = $derived(boardWidthOverride ?? settings.cellSize * 8);

  let boardElement: HTMLDivElement;
  let api: Api | null = null;
  let layoutChangeHandler: (() => void) | null = null;
  let fen = $derived(genFENFromBoard(board, currentTurn));
  let turnColor: cg.Color = $derived(currentTurn === "black" ? "black" : "white");
  let turnClass = $derived(settings.showTurnBorder ? `turn-${currentTurn}` : "");

  // Our internal coords: y=0 top, y=7 bottom
  // Chessground coords: y=0 bottom (rank1), y=7 top (rank8)
  function toKey(pos: IPosition): cg.Key {
    return pos2key([pos.x, ROWS - 1 - pos.y])!;
  }

  function toPos(key: cg.Key): IPosition {
    const [x, y] = key2pos(key);
    return { x, y: ROWS - 1 - y };
  }

  function computeDests(board: IBoard, turn: ITurn, gs: IGameState | null): Map<cg.Key, cg.Key[]> {
    const dests = new Map<cg.Key, cg.Key[]>();
    for (let x = 0; x < COLS; x++) {
      for (let y = 0; y < ROWS; y++) {
        const piece = board[x][y];
        if (!piece) continue;
        const isWhite = piece === piece.toUpperCase();
        if ((turn === "white" && !isWhite) || (turn === "black" && isWhite)) continue;

        const from: IPosition = { x, y };
        const keys: cg.Key[] = [];
        for (let tx = 0; tx < COLS; tx++) {
          for (let ty = 0; ty < ROWS; ty++) {
            if (tx === x && ty === y) continue;
            if (isValidMove(from, { x: tx, y: ty }, board, gs ?? undefined)) {
              keys.push(toKey({ x: tx, y: ty }));
            }
          }
        }
        if (keys.length > 0) {
          dests.set(toKey(from), keys);
        }
      }
    }
    return dests;
  }

  function computeVariationShapes(variations: IMove[]): DrawShape[] {
    return variations.map((move) => ({
      orig: toKey(move.from),
      dest: toKey(move.to),
      brush: "blue",
    }));
  }

  let shapes = $derived(settings.showNextMove ? computeVariationShapes(variations) : []);
  let dests = $derived(computeDests(board, currentTurn, gameState));

  onMount(async () => {
    const events: Config["events"] = freeMode
      ? {
          change: () => {
            if (api) eventBus.emit("fen-updated", api.getFen());
          },
          select: (key) => {
            eventBus.emit("click", toPos(key));
          },
        }
      : {
          move: (orig, dest) => {
            const from = toPos(orig);
            const to = toPos(dest);

            if (isValidMove(from, to, board, gameState ?? undefined)) {
              eventBus.emit("runmove", {
                from,
                to,
              } as IMove);
            } else {
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
      config.lastMove = [toKey(lastMove.from), toKey(lastMove.to)];
    }

    if (markedPos) {
      config.selected = toKey(markedPos);
    }

    api = Chessground(boardElement, config);

    layoutChangeHandler = () => {
      if (api) {
        api.state.dom.bounds.clear();
        api.state.dom.redraw();
      }
    };
    document.body.addEventListener("xq-layout-change", layoutChangeHandler);
  });

  onDestroy(() => {
    if (layoutChangeHandler) {
      document.body.removeEventListener("xq-layout-change", layoutChangeHandler);
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
      lastMove: lastMove ? [toKey(lastMove.from), toKey(lastMove.to)] : undefined,
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
    void board;
    if (markedPos) {
      api.selectSquare(toKey(markedPos), true);
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

<div bind:this={boardElement} class="xq-wrap {turnClass}" style="width: {boardWidth}px"></div>

<style>
  .xq-wrap {
    flex-shrink: 0;
    aspect-ratio: 1;
  }
</style>
