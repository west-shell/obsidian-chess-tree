<script lang="ts">
  import Board from "../Board.svelte";
  import Toolbar from "./Toolbar.svelte";
  import List from "./List.svelte";
  import type { ChessNode, IOptions, ISettings } from "../../types";
  import type { EventBus } from "../../core/event-bus";
  import type { Square } from "../../chess";
  import { onMount, tick } from "svelte";

  interface Props {
    settings: ISettings;
    fen: string;
    checkColor?: "white" | "black" | null | undefined;
    selectedSquare: Square | null;
    currentStep: number;
    eventBus: EventBus;
    modified: boolean;
    PGN: ChessNode[];
    history: ChessNode[];
    lastMove: [Square, Square] | null;
    options: IOptions;
  }

  let {
    settings,
    fen,
    checkColor,
    selectedSquare,
    currentStep,
    eventBus,
    modified,
    PGN,
    history,
    lastMove,
    options,
  }: Props = $props();

  let moves = $derived(modified ? history : PGN);
  let isprotected = $derived(options.protected || false);
  // svelte-ignore state_referenced_locally
  let rotated = $state(options.rotated || false);
  let boardEl: HTMLDivElement;
  let boardHeight = $state(0);

  $effect(() => {
    const el = boardEl;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      boardHeight = el.offsetHeight;
    });
    ro.observe(el);
    return () => ro.disconnect();
  });

  onMount(async () => {
    await tick();
    eventBus.emit("ready");
  });

  $effect(() => {
    eventBus.on("rotate", () => {
      rotated = !rotated;
    });
  });
</script>

<div class="chess-layout" style="--chess-board-height:{boardHeight}px">
  <div class="chess-layout__board" bind:this={boardEl}>
    <Board
      {settings}
      {fen}
      {lastMove}
      {checkColor}
      {selectedSquare}
      {eventBus}
      {rotated}
    />
  </div>
  <div class="chess-layout__toolbar">
    <Toolbar {eventBus} {modified} {PGN} {isprotected} />
  </div>
  {#if settings.showMovelist}
    <div class="chess-layout__tools">
      <List {settings} {currentStep} {moves} {eventBus} />
    </div>
  {/if}
</div>

<style>
  .chess-layout {
    height: var(--chess-board-height, 100%);
    --red: #861818;
    --black: #000080;
  }
</style>
