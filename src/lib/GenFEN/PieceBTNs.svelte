<script lang="ts">
  import { setIcon } from "obsidian";
  import type { Piece } from "../../chess";
  import type { ISettings } from "../../types";
  import type { EventBus } from "../../core/event-bus";

  interface Props {
    settings: ISettings;
    fen: string;
    eventBus: EventBus;
    position: string;
    selectedPiece: Piece | null;
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let { settings, fen, eventBus, position, selectedPiece }: Props = $props();

  const PIECES: {
    key: string;
    piece: Piece;
    color: "white" | "black";
    icon: string;
    maxCount: number;
  }[] = [
    {
      key: "k",
      color: "black",
      piece: { type: "k", color: "b" },
      icon: "chess-king",
      maxCount: 1,
    },
    {
      key: "q",
      color: "black",
      piece: { type: "q", color: "b" },
      icon: "chess-queen",
      maxCount: 1,
    },
    {
      key: "r",
      color: "black",
      piece: { type: "r", color: "b" },
      icon: "chess-rook",
      maxCount: 2,
    },
    {
      key: "b",
      color: "black",
      piece: { type: "b", color: "b" },
      icon: "chess-bishop",
      maxCount: 2,
    },
    {
      key: "n",
      color: "black",
      piece: { type: "n", color: "b" },
      icon: "chess-knight",
      maxCount: 2,
    },
    {
      key: "p",
      color: "black",
      piece: { type: "p", color: "b" },
      icon: "chess-pawn",
      maxCount: 8,
    },
    {
      key: "K",
      color: "white",
      piece: { type: "k", color: "w" },
      icon: "chess-king",
      maxCount: 1,
    },
    {
      key: "Q",
      color: "white",
      piece: { type: "q", color: "w" },
      icon: "chess-queen",
      maxCount: 1,
    },
    {
      key: "R",
      color: "white",
      piece: { type: "r", color: "w" },
      icon: "chess-rook",
      maxCount: 2,
    },
    {
      key: "B",
      color: "white",
      piece: { type: "b", color: "w" },
      icon: "chess-bishop",
      maxCount: 2,
    },
    {
      key: "N",
      color: "white",
      piece: { type: "n", color: "w" },
      icon: "chess-knight",
      maxCount: 2,
    },
    {
      key: "P",
      color: "white",
      piece: { type: "p", color: "w" },
      icon: "chess-pawn",
      maxCount: 8,
    },
  ];

  let pieceCount = $derived(
    fen
      .split(" ")[0]
      .split("")
      .reduce((acc: Record<string, number>, c) => {
        if (/[1-8]/.test(c)) return acc;
        if (/[a-zA-Z]/.test(c)) {
          acc[c] = (acc[c] || 0) + 1;
        }
        return acc;
      }, {}),
  );

  let count = $derived(
    (() => {
      const whitePromoBudget = 8 - (pieceCount["P"] || 0);
      const blackPromoBudget = 8 - (pieceCount["p"] || 0);
      const whiteOverflow = ["Q", "R", "B", "N"].reduce(
        (s, k) =>
          s +
          Math.max(
            0,
            (pieceCount[k] || 0) - PIECES.find((p) => p.key === k)!.maxCount,
          ),
        0,
      );
      const blackOverflow = ["q", "r", "b", "n"].reduce(
        (s, k) =>
          s +
          Math.max(
            0,
            (pieceCount[k] || 0) - PIECES.find((p) => p.key === k)!.maxCount,
          ),
        0,
      );

      return Object.fromEntries(
        PIECES.map(({ key, maxCount }) => {
          const onBoard = pieceCount[key] || 0;
          const isWhite = key === key.toUpperCase();
          const isPawn = key === "P" || key === "p";
          const isKing = key === "K" || key === "k";
          if (isKing) return [key, maxCount - onBoard];
          if (isPawn) {
            const overflow = isWhite ? whiteOverflow : blackOverflow;
            return [key, maxCount - onBoard - overflow];
          }
          const promoBudget = isWhite ? whitePromoBudget : blackPromoBudget;
          const selfOverflow = Math.max(0, onBoard - maxCount);
          const otherOverflow =
            (isWhite ? whiteOverflow : blackOverflow) - selfOverflow;
          return [key, maxCount + promoBudget - onBoard - otherOverflow];
        }),
      );
    })(),
  );

  function useIcon(el: HTMLElement, icon: string) {
    setIcon(el, icon);
  }
</script>

<div class="piece-btn-container {position}">
  {#each PIECES as { key, color, icon, piece } (key)}
    <!-- svelte-ignore a11y_consider_explicit_label -->
    <button
      class="piece-btn {position} {color}"
      class:empty={count[key] === 0}
      class:active={selectedPiece &&
        selectedPiece.type === piece.type &&
        selectedPiece.color === piece.color}
      use:useIcon={icon}
      onclick={() => eventBus.emit("clickPieceBTN", piece)}
    ></button>
  {/each}
</div>

<style>
  .piece-btn-container {
    font-size: clamp(10px, calc(var(--xq-cell-size, 50px) * 0.3), 24px);
  }

  /* 共用样式 */
  .piece-btn {
    border-radius: 4px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1.5px solid rgba(0, 0, 0, 0.35);
    transition:
      box-shadow 0.15s,
      border-color 0.15s;
    color: white;
  }

  /* 右侧布局 - 使用flex（因为子元素用了flex:1） */
  .piece-btn-container.right {
    display: grid;
    grid-template-rows: repeat(6, 1fr);
    grid-template-columns: repeat(2, 1fr);
    height: calc(var(--chess-cell-size, 50px) * 6);
    width: auto;
    justify-content: left;
  }

  .piece-btn.right {
    height: calc(var(--chess-cell-size, 50px) * 8 / 6);
  }

  /* 底部布局 - 使用grid */
  .piece-btn-container.bottom {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    grid-template-rows: repeat(2, 1fr);
    width: calc(var(--chess-cell-size, 50px) * 6);
    height: auto;
    justify-content: left;
  }

  .piece-btn.bottom {
    width: calc(var(--chess-cell-size, 50px) * 8 / 6);
  }

  /* 颜色 - 合并color: white */
  .piece-btn.white {
    background-color: var(--chess-piece-white);
    color: black;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
  }

  .piece-btn.black {
    background-color: var(--chess-piece-black);
    color: white;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
  }

  /* 状态样式 */
  .active {
    border-color: #ffd700;
    box-shadow: 0 0 0 2px #ffd700;
    filter: brightness(1.5) saturate(1.4)
      drop-shadow(0 0 6px rgba(255, 255, 255, 0.6));
  }

  .empty {
    pointer-events: none;
    opacity: 0.35;
  }
</style>
