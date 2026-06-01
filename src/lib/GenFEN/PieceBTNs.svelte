<script lang="ts">
  import { PIECE_CHARS, type IBoard } from "../../types";
  import type { EventBus } from "../../core/event-bus";
  import type { ISettings } from "../../types";

  interface Props {
    settings: ISettings;
    board: IBoard;
    eventBus: EventBus;
    position?: string;
    selectedPiece: string;
  }

  let { settings, board, eventBus, position = "", selectedPiece }: Props = $props();

  const isWhite = (piece: string) => piece === piece.toUpperCase();

  const MAX_COUNT: Record<string, number> = {
    K: 1, Q: 1, R: 2, B: 2, N: 2, P: 8,
    k: 1, q: 1, r: 2, b: 2, n: 2, p: 8,
  };

  let pieceCount = $derived(
    board.flat().reduce(
      (acc, piece) => {
        if (piece) acc[piece] = (acc[piece] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    ),
  );

  let count = $derived(
    Object.fromEntries(
      Object.keys(MAX_COUNT).map((piece) => [piece, MAX_COUNT[piece] - (pieceCount[piece] || 0)]),
    ),
  );
</script>

<div
  class={`piece-btn-container ${position}`}
  style="--height: {8 * settings.cellSize}px;
    --width: {8 * settings.cellSize}px;
    --font-size: {settings.cellSize * 0.3}px;"
>
  {#each Object.entries(PIECE_CHARS) as [piece, name]}
    <button
      class={`piece-btn ${position} ${isWhite(piece) ? "white-piece" : "black-piece"}`}
      class:empty={count[piece] === 0}
      class:active={selectedPiece === piece}
      onclick={() => eventBus.emit("clickPieceBTN", piece)}
    >
      {name}
    </button>
  {/each}
</div>

<style>
  .piece-btn-container {
    --piece-white: var(--xq-piece-red, var(--color-red));
    --piece-black: var(--xq-piece-black, var(--color-blue));
  }
  .piece-btn-container.right {
    display: grid;
    grid-template-columns: 1fr;
    flex-direction: column;
    height: var(--height);
    width: fit-content;
    align-items: stretch;
    display: flex;
    justify-content: space-between;
  }

  .piece-btn-container.bottom {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    grid-template-rows: repeat(2, 1fr);
    width: var(--width);
    height: auto;
    justify-content: center;
  }

  .piece-btn.right {
    flex: 1;
    width: 100%;
    border-radius: 4px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: var(--font-size);
    border: 1.5px solid rgba(0, 0, 0, 0.35);
    margin: 1px 0;
    transition: box-shadow 0.15s, border-color 0.15s;
  }

  .piece-btn.bottom {
    padding: 0;
    width: calc(var(--width) / 6);
    border-radius: 4px;
    cursor: pointer;
    font-size: var(--font-size);
    border: 1.5px solid rgba(0, 0, 0, 0.35);
    transition: box-shadow 0.15s, border-color 0.15s;
  }

  .white-piece {
    background-color: var(--piece-white);
    color: white;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
  }

  .black-piece {
    background-color: var(--piece-black);
    color: white;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
  }

  .active {
    border-color: #ffd700;
    box-shadow: 0 0 0 2px #ffd700;
    filter: brightness(1.5) saturate(1.4) drop-shadow(0 0 6px rgba(255, 255, 255, 0.6));
  }

  .empty {
    pointer-events: none;
    opacity: 0.35;
  }
</style>
