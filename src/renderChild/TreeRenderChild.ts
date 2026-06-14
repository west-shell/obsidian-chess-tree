import '../core/event-bus';
import '../modules/Tree/TreeMap';
import '../modules/Tree/TreeView';
import '../modules/BoardClick';
import '../modules/Tree/Actions';

import { type MarkdownPostProcessorContext, MarkdownRenderChild, MarkdownView } from 'obsidian';

import type { EventBus } from '../core/event-bus';
import { createTreeModuleRegistry, destroyTreeModuleRegistry } from '../core/module-system';
import type ChessPlugin from '../main';
import type { ISettings } from '../types';

export class TreeRenderChild extends MarkdownRenderChild {
  settings: ISettings;
  eventBus!: EventBus;
  contentEl!: HTMLElement;
  constructor(
    public containerEl: HTMLElement,
    public ctx: MarkdownPostProcessorContext,
    public source: string,
    public plugin: ChessPlugin,
  ) {
    super(containerEl);
    this.settings = this.plugin.settings;
    this.contentEl = containerEl;
    containerEl.classList.add('tree-codeblock');
    createTreeModuleRegistry(this);
  }

  saveFile = () => {
    const view = this.plugin.app.workspace.getActiveViewOfType(MarkdownView);
    if (!view?.file) return;
    const content = (this as any).data as string;
    this.plugin.app.vault.modify(view.file, content);
  };

  onload(): void {
    this.plugin.instances.add(this);
    (this as any).data = this.source;
    this.eventBus.emit('setViewData');
    this.eventBus.emit('createUI');

    requestAnimationFrame(() => {
      const h = this.settings.cellSize * 10;
      if (h > 300) this.containerEl.style.height = h + 'px';
    });
  }

  refresh(): void {
    this.eventBus.emit('updateUI');
  }

  onunload(): void {
    this.plugin.instances.delete(this);
    this.eventBus.emit('unload');
    destroyTreeModuleRegistry(this);
  }
}
