<script lang="ts">
  import { setIcon } from "obsidian";
  import type { Piece } from "../../chess";
  import type { EventBus } from "../../core/event-bus";

  interface Props {
    fen: string;
    eventBus: EventBus;
    selectedPiece: Piece | null;
  }
  let { fen, eventBus, selectedPiece }: Props = $props();

  const PIECE_DEFS: {
    key: string;
    color: "white" | "black";
    icon: string;
    maxCount: number;
  }[] = [
    { key: "k", color: "black", icon: "chess-king", maxCount: 1 },
    { key: "q", color: "black", icon: "chess-queen", maxCount: 1 },
    { key: "r", color: "black", icon: "chess-rook", maxCount: 2 },
    { key: "b", color: "black", icon: "chess-bishop", maxCount: 2 },
    { key: "n", color: "black", icon: "chess-knight", maxCount: 2 },
    { key: "p", color: "black", icon: "chess-pawn", maxCount: 8 },
    { key: "K", color: "white", icon: "chess-king", maxCount: 1 },
    { key: "Q", color: "white", icon: "chess-queen", maxCount: 1 },
    { key: "R", color: "white", icon: "chess-rook", maxCount: 2 },
    { key: "B", color: "white", icon: "chess-bishop", maxCount: 2 },
    { key: "N", color: "white", icon: "chess-knight", maxCount: 2 },
    { key: "P", color: "white", icon: "chess-pawn", maxCount: 8 },
  ];

  const PIECES: {
    key: string;
    piece: Piece;
    color: "white" | "black";
    icon: string;
    maxCount: number;
  }[] = PIECE_DEFS.map((def) => ({
    ...def,
    piece: {
      type: def.key.toLowerCase() as Piece["type"],
      color:
        def.key === def.key.toUpperCase() ? ("w" as const) : ("b" as const),
    },
  }));

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

<div class="ct-layout__palette">
  {#each PIECES as { key, color, icon, piece } (key)}
    <!-- svelte-ignore a11y_consider_explicit_label -->
    <button
      class="ct-palette__btn ct-palette__btn--{color}"
      class:ct-palette__btn--empty={count[key] === 0}
      class:ct-palette__btn--active={selectedPiece &&
        selectedPiece.type === piece.type &&
        selectedPiece.color === piece.color}
      use:useIcon={icon}
      onclick={() => eventBus.emit("clickPieceBTN", piece)}
    ></button>
  {/each}
</div>
