<script lang="ts">
  import { setIcon, Menu } from "obsidian";
  import type { EventBus } from "../../core/event-bus";

  interface Props {
    eventBus: EventBus;
  }
  let { eventBus }: Props = $props();

  const buttons = [
    { title: "Delete", icon: "circle-x", event: "remove" },
    { title: "Promote", icon: "arrow-up-wide-narrow", event: "promote" },
    { title: "Start", icon: "arrow-left-to-line", event: "toStart" },
    { title: "Back", icon: "arrow-left", event: "back" },
    { title: "Forward", icon: "arrow-right", event: "next" },
    { title: "End", icon: "arrow-right-to-line", event: "toEnd" },
    { title: "Flip", icon: "flip-vertical", event: "rotate" },
    { title: "Annotate", icon: "tag", event: "toggle-annotation-menu" },
  ];

  const annotations = [
    { title: "White advantage", icon: "thumbs-up", symbol: "W+", event: "annotation" },
    { title: "Black advantage", icon: "thumbs-down", symbol: "B+", event: "annotation" },
    { title: "Equal", icon: "handshake", symbol: "=", event: "annotation" },
    { title: "Key move", icon: "bookmark", symbol: "?", event: "annotation" },
    { title: "Brilliant", icon: "star", symbol: "!", event: "annotation" },
  ];

  function emitEvent(name: string, payload: any = null) {
    eventBus.emit("btn-click", { name, payload });
  }

  function useSetIcon(el: HTMLElement, icon: string) {
    setIcon(el, icon);
  }

  function handleAnnotationMenu(evt: MouseEvent) {
    const menu = new Menu();

    annotations.forEach((item) => {
      menu.addItem((mi) => {
        mi.setTitle(item.title)
          .setIcon(item.icon)
          .onClick(() => emitEvent(item.event, item.symbol));
      });
    });

    menu.showAtMouseEvent(evt);
  }
</script>

<div class="toolbar-container">
  {#each buttons as { title, icon, event }}
    <button
      class="toolbar-btn"
      aria-label={title}
      use:useSetIcon={icon}
      onclick={(e) => {
        if (event === "toggle-annotation-menu") {
          handleAnnotationMenu(e);
        } else if (event === "rotate") {
          eventBus.emit("rotate");
        } else {
          emitEvent(event);
        }
      }}
    ></button>
  {/each}
</div>

<style>
  :global(.tree-view.right) .toolbar-container {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  :global(.tree-view.bottom) .toolbar-container {
    display: flex;
    flex-direction: row;
    flex-wrap: nowrap;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    box-sizing: border-box;
  }

  :global(.tree-view.bottom) .toolbar-container .toolbar-btn {
    flex: 1 1 0;
    min-width: 24px;
    max-width: 100%;
    font-size: clamp(12px, 3vw, 16px);
    padding: 0;
    margin: 0;
  }
</style>
