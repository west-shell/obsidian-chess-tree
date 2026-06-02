<script lang="ts">
  import type { EventBus } from "../../core/event-bus";
  import { t } from "../../i18n";

  interface Props {
    eventBus: EventBus;
    position: string;
    currentTurn: string;
  }
  let { eventBus, position, currentTurn }: Props = $props();

  const buttons = [
    { text: t("genfen.turn"), action: "turn", color: true },
    { text: t("genfen.empty"), action: "empty" },
    { text: t("genfen.full"), action: "full" },
    { text: t("genfen.save"), action: "save" },
  ];
</script>

<div class={`fen-toolbar ${position}`}>
  {#each buttons as { text, action, color }}
    <button
      class="fen-btn"
      class:turn-white={color && currentTurn === "white"}
      class:turn-black={color && currentTurn === "black"}
      onclick={() => eventBus.emit("btn-click", action)}
    >
      {text}
    </button>
  {/each}
</div>

<style>
  .fen-toolbar.right { display: flex; flex-direction: column; gap: 0.5em; }
  .fen-toolbar.bottom { display: flex; flex-direction: row; gap: 0.5em; }
  .fen-btn {
    padding: 0.4em 0.8em; border: none; border-radius: 4px; cursor: pointer;
    background: var(--background-secondary);
    color: var(--text-normal);
  }
  .turn-white { background: #f0d9b5; color: #5a4a3a; }
  .turn-black { background: #3a3a3a; color: #d0d0d0; }
</style>
