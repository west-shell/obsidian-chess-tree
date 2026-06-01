<script lang="ts">
  import type { EventBus } from "../../core/event-bus";

  interface Props {
    eventBus: EventBus;
    position: string;
    currentTurn: string;
  }
  let { eventBus, position, currentTurn }: Props = $props();

  const buttons = [
    { title: "Turn", text: "Turn", action: "turn", color: true },
    { title: "Clear", text: "Clr", action: "empty" },
    { title: "Fill", text: "Fill", action: "full" },
    { title: "Save", text: "Sav", action: "save" },
  ];
</script>

<div class={`getFENT-toolbar-container ${position}`}>
  {#each buttons as { title, text, action, color }}
    <button
      {title}
      class={`toolbar-btn ${color ? currentTurn : ""}`}
      onclick={() => eventBus.emit("btn-click", action)}
    >
      {text}
    </button>
  {/each}
</div>

<style>
  .getFENT-toolbar-container.right {
    display: flex;
    flex-direction: column;
    gap: 0.5em;
  }

  .getFENT-toolbar-container.bottom {
    display: flex;
    flex-direction: row;
    gap: 0.5em;
  }

  .toolbar-btn {
    padding: 0.4em 0.8em;
    border: none;
    border-radius: 4px;
    cursor: pointer;
  }

  .white {
    background-color: var(--xq-piece-red);
    color: white;
  }

  .black {
    background-color: var(--xq-piece-black);
    color: white;
  }
</style>
