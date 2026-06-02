<script lang="ts">
  import { setIcon } from "obsidian";
  import type { IBoard, ISettings } from "../../types";
  import type { EventBus } from "../../core/event-bus";

  interface Props {
    settings: ISettings;
    board: IBoard;
    eventBus: EventBus;
    position?: string;
    selectedPiece: string;
  }
  let { settings, board, eventBus, position = "", selectedPiece }: Props = $props();

  const isWhite = (p: string) => p === p.toUpperCase();

  const MAX_COUNT: Record<string, number> = {
    K: 1,
    Q: 1,
    R: 2,
    B: 2,
    N: 2,
    P: 8,
    k: 1,
    q: 1,
    r: 2,
    b: 2,
    n: 2,
    p: 8,
  };

  const PIECES: { key: string; color: "white" | "black"; icon: string }[] = [
    { key: "K", color: "white", icon: "chess-king" },
    { key: "Q", color: "white", icon: "chess-queen" },
    { key: "R", color: "white", icon: "chess-rook" },
    { key: "B", color: "white", icon: "chess-bishop" },
    { key: "N", color: "white", icon: "chess-knight" },
    { key: "P", color: "white", icon: "chess-pawn" },
    { key: "k", color: "black", icon: "chess-king" },
    { key: "q", color: "black", icon: "chess-queen" },
    { key: "r", color: "black", icon: "chess-rook" },
    { key: "b", color: "black", icon: "chess-bishop" },
    { key: "n", color: "black", icon: "chess-knight" },
    { key: "p", color: "black", icon: "chess-pawn" },
  ];

  let pieceCount = $derived(
    board.flat().reduce((acc: Record<string, number>, p) => {
      if (p) acc[p] = (acc[p] || 0) + 1;
      return acc;
    }, {}),
  );

  let count = $derived(
    Object.fromEntries(Object.keys(MAX_COUNT).map((p) => [p, MAX_COUNT[p] - (pieceCount[p] || 0)])),
  );

  function useIcon(el: HTMLElement, icon: string) {
    setIcon(el, icon);
  }
</script>

<div class="pieces {position}" style="--h:{8 * settings.cellSize}px;--w:{8 * settings.cellSize}px;">
  {#each PIECES as { key, color, icon }}
    <!-- svelte-ignore a11y_consider_explicit_label -->
    <button
      class="btn {position} {color}"
      class:empty={count[key] === 0}
      class:active={selectedPiece === key}
      use:useIcon={icon}
      onclick={() => eventBus.emit("clickPieceBTN", key)}
    ></button>
  {/each}
</div>

<style>
  .pieces.right {
    display: flex;
    flex-direction: column;
    height: var(--h);
    justify-content: space-between;
  }
  .pieces.bottom {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    grid-template-rows: repeat(2, 1fr);
    width: var(--w);
  }
  .btn {
    border: 2px solid transparent;
    border-radius: 4px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 4px;
  }
  .btn.right {
    flex: 1;
    margin: 1px 0;
  }
  .btn.bottom {
    margin: 1px;
  }
  .btn.white {
    background: #f0d9b5;
    border-color: rgba(0, 0, 0, 0.15);
    color: #3a3a3a;
  }
  .btn.black {
    background: #3a3a3a;
    border-color: rgba(255, 255, 255, 0.1);
    color: #e8e8e8;
  }
  .btn.active {
    border-color: #ffd700;
    box-shadow: 0 0 0 2px #ffd700;
  }
  .btn.empty {
    pointer-events: none;
    opacity: 0.2;
  }
</style>
