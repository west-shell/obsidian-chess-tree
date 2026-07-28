<script lang="ts">
  import Board from "../Board.svelte";
  import PieceBTNs from "./PieceBTNs.svelte";
  import type { ISettings } from "../../types";
  import type { EventBus } from "../../core/event-bus";
  import Toolbar from "./Toolbar.svelte";
  import { onDestroy, onMount } from "svelte";
  import type { Piece } from "../../chess";

  interface Props {
    settings: ISettings;
    fen: string;
    selectedPiece: Piece | null;
    eventBus: EventBus;
  }

  let { settings, fen, selectedPiece, eventBus }: Props = $props();

  let flipped = $state(false);

  function onBtnClick(action: string | { action: string; fen?: string }) {
    if (typeof action === "string" && action === "flip") {
      flipped = !flipped;
    }
  }

  onMount(() => {
    eventBus.on("btn-click", onBtnClick);
  });
  onDestroy(() => {
    eventBus.off("btn-click", onBtnClick);
  });
</script>

<div class="chess-layout chess-layout--genfen">
  <div class="chess-layout__board">
    <Board {settings} {fen} {eventBus} rotated={flipped} freeMode={true} />
  </div>
  <div class="chess-layout__piecebtns">
    <PieceBTNs {fen} {eventBus} {selectedPiece} />
  </div>
  <div class="chess-layout__toolbar">
    <Toolbar {eventBus} {fen} />
  </div>
</div>

<style>
  .chess-layout {
    --red: #861818;
    --black: #000080;
  }
</style>
