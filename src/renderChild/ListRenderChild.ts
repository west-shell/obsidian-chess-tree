import "../core/event-bus";
import "../modules/Source/Source";
import "../modules/BoardClick";
import "../modules/List/ChessBoard";
import "../modules/List/History";
import "../modules/List/Actions";
import "../modules/List/Speak";

import {
  type MarkdownPostProcessorContext,
  MarkdownRenderChild,
} from "obsidian";

import type { EventBus } from "../core/event-bus";
import { createListModuleRegistry } from "../core/module-system";
import type ChessPlugin from "../main";
import type { ISettings } from "../types";

export class ChessRenderChild extends MarkdownRenderChild {
  settings: ISettings;
  eventBus!: EventBus;
  constructor(
    public containerEl: HTMLElement,
    public ctx: MarkdownPostProcessorContext,
    public source: string,
    public plugin: ChessPlugin,
  ) {
    super(containerEl);
    this.settings = this.plugin.settings;
    createListModuleRegistry(this);
  }

  onload(): void {
    this.plugin.instances.add(this);
    this.eventBus.emit("load", "list");
    this.eventBus.emit("creatUI");
    this.eventBus.on<number>("zoom-changed", (zoom) => {
      this.settings.zoom = zoom;
      void this.plugin.saveSettings();
    });
  }

  refresh(): void {
    this.eventBus.emit("updateUI");
  }

  onunload(): void {
    this.plugin.instances.delete(this);
    this.eventBus.emit("unload");
    // destroyListModuleRegistry(this);
  }
}
