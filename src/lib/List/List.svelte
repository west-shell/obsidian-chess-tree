<script lang="ts">
  import { tick } from "svelte";
  import { scrollToBTN } from "../../utils/utils";
  import type { EventBus } from "../../core/event-bus";
  import type { ChessNode, ISettings } from "../../types";

  interface Props {
    settings: ISettings;
    currentStep: number;
    moves: ChessNode[];
    eventBus: EventBus;
  }
  let { settings, currentStep, moves, eventBus }: Props = $props();

  let itemRefs: HTMLLIElement[] = [];
  let ulRef: HTMLUListElement | null = null;

  $effect(() => {
    void currentStep;
    void moves;
    (async () => {
      await tick();
      const index = currentStep === 0 ? 0 : Math.ceil(currentStep / 2);
      const targetEl = itemRefs[index];
      if (targetEl) {
        scrollToBTN(targetEl, ulRef);
      }
    })();
  });
</script>

<div class="move-container {settings.position}">
  <ul class="move-list {settings.position}" bind:this={ulRef}>
    <li class="start" bind:this={itemRefs[0]}>
      <span class="roundnum">0</span>
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <span
        class="move start"
        class:active={currentStep === 0}
        onclick={() => eventBus.emit("clickstep", 0)}
      >
        {settings.showMovelistText ? "= Start =" : "Start"}
      </span>
    </li>
    {#each moves as move, i (i)}
      {#if i % 2 === 0}
        <li class="round" bind:this={itemRefs[i / 2 + 1]}>
          <span class="roundnum">{i / 2 + 1}</span>
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <span
            class="move white"
            class:active={currentStep === i + 1}
            onclick={() => eventBus.emit("clickstep", i + 1)}
          >
            {settings.showMovelistText ? (move.move?.san ?? "...") : "W"}
          </span>
          {#if moves[i + 1]}
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <span
              class="move black"
              class:active={currentStep === i + 2}
              onclick={() => eventBus.emit("clickstep", i + 2)}
            >
              {settings.showMovelistText
                ? (moves[i + 1].move?.san ?? "...")
                : "B"}
            </span>
          {/if}
        </li>
      {/if}
    {/each}
  </ul>
</div>

<style>
  /* ========== 基础容器样式 ========== */
  .move-container {
    font-size: var(--chess-font-size, 12px);
    padding: 0;
    margin: 0;
  }

  .move-list {
    display: flex;
    padding: 0;
    margin: 0;
    color: var(--text-normal);
    background-color: var(--background-primary-alt);
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--radius-s);
  }

  /* ========== 共用行样式 ========== */
  .move-list li {
    display: flex;
    flex-wrap: nowrap;
    flex-shrink: 0;
    flex-grow: 0;
    align-items: center;
    gap: 0.5em;
    padding: 0;
    margin: 0;
    border-bottom: none;
    white-space: nowrap;
  }

  .move-list .roundnum {
    display: inline-block;
    min-width: 1.5em;
    max-width: 3em;
    text-align: right;
    margin-right: 0.4em;
    color: var(--text-muted);
    flex-shrink: 0;
    white-space: nowrap;
  }

  .move-list span.move {
    display: inline-block;
    line-height: 1.2;
    text-align: center;
    border-radius: 0.375em;
    cursor: pointer;
    transition: all 0.2s ease;
    white-space: nowrap;
    flex-shrink: 0;
    padding: 0.25em 0.5em;
    margin: 0.125em 0;
    color: var(--text-normal);
  }

  .move-list span.move.white,
  .move-list span.move.black {
    min-width: 4em;
  }

  .move-list span.start {
    flex: 1;
  }

  .move-list span.move:hover {
    background-color: var(--background-modifier-hover);
    transform: scale(1.02);
  }

  .move-list span.move.active {
    background-color: var(--color-accent);
    color: var(--text-on-accent);
    box-shadow: 0 0.125em 0.375em rgba(0, 0, 0, 0.15);
    font-weight: 500;
    transform: scale(1.02);
  }

  /* ========== 右侧垂直布局 (right) ========== */
  .move-list.right {
    flex-direction: column;
    height: calc(var(--chess-cell-size, 50px) * 8);
    overflow-y: auto;
    overflow-x: hidden;
    flex-wrap: nowrap;
    align-items: flex-start;
  }

  .move-list.right li {
    width: 100%;
  }

  /* ========== 底部多列布局 (bottom) ========== */
  .move-list.bottom {
    flex-direction: column;
    flex-wrap: wrap;
    align-items: flex-start;
    max-height: 11.5em;
    overflow-x: auto;
    overflow-y: hidden;
    gap: 0 0.5em;
  }

  .move-list.bottom li {
    width: fit-content;
  }
</style>
