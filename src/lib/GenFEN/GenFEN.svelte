<script lang="ts">
  import Board from "../Board.svelte";
  import PieceBTNs from "./PieceBTNs.svelte";
  import type { ISettings } from "../../types";
  import type { EventBus } from "../../core/event-bus";
  import type { Square } from "chess.js";
  import Toolbar from "./Toolbar.svelte";
  import { onMount, onDestroy } from "svelte";

  interface Props {
    settings: ISettings;
    fen: string;
    selectedPiece: string | null;
    eventBus: EventBus;
  }

  let { settings, fen, selectedPiece, eventBus }: Props = $props();

  let position = $derived(settings.position);
  let flipped = $state(false);

  function onBtnClick(action: any) {
    if (typeof action === 'string' && action === 'flip') {
      flipped = !flipped;
    }
  }

  function onToggleTurn() {
    const parts = fen.split(' ');
    parts[1] = parts[1] === 'w' ? 'b' : 'w';
    eventBus.emit('btn-click', { action: 'setFen', fen: parts.join(' ') });
  }

  onMount(() => {
    eventBus.on('btn-click', onBtnClick);
    eventBus.on('toggle-turn', onToggleTurn);
  });
  onDestroy(() => {
    eventBus.off('btn-click', onBtnClick);
    eventBus.off('toggle-turn', onToggleTurn);
  });
</script>

<div class="XQ-container {position}">
  <div class="board-area">
    <Board {settings} {fen} {eventBus} rotated={flipped} freeMode={true} />
  </div>
  <div class="editor-sidebar {position}">
    <PieceBTNs {settings} {fen} {eventBus} {position} {selectedPiece} />
    <Toolbar {eventBus} {position} {fen} />
  </div>
</div>

<style>
  .XQ-container {
    --red: #861818;
    --black: #000080;
    margin: 10px;
  }

  .XQ-container.right {
    display: flex;
    flex-direction: row;
    gap: 8px;
    align-items: flex-start;
  }

  .XQ-container.bottom {
    display: flex;
    flex-direction: column;
  }

  .editor-sidebar {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .editor-sidebar.right {
    flex: 1;
    min-width: 200px;
    max-width: 280px;
    flex-direction: row;
    align-items: flex-start;
  }

  .editor-sidebar.bottom {
    width: 100%;
  }

  .board-area {
    flex-shrink: 0;
  }
</style>
