import { mount, unmount } from 'svelte';
import { registerTreeModule } from '../../core/module-system';
import Chess from '../../lib/Tree/Chess.svelte';
import type { ITreeHost } from '../../types';

const BoardModule = {
  init(host: ITreeHost) {
    const eventBus = host.eventBus;

    eventBus.on('load', () => {
      host.modified = false;
      const Container = host.containerEl.createEl('div');
      host.Chess = mount(Chess, {
        target: Container,
        props: {
        nodeMap: host.nodeMap,
          settings: host.settings,
          fen: host.currentNode!.fen,
          eventBus: host.eventBus,
          currentNode: host.currentNode!,
          currentPath: host.currentPath,
          options: host.options || {},
        },
      });
    });

    eventBus.on('ready', () => {
      if (!host.settings.autoJump) return;
      switch (host.settings.autoJump) {
        case 'never':
          break;
        case 'always':
          eventBus.emit('toEnd');
          break;
        case 'auto':
          if (!host.haveFEN) eventBus.emit('toEnd');
          break;
      }
    });

   eventBus.on('updateUI', () => {
      host.Chess?.$set({
        settings: { ...host.settings },
        nodeMap: new Map(host.nodeMap),
        fen: host.currentNode?.fen ?? '',
        currentNode: host.currentNode,
        currentPath: host.currentPath,
      });
    });

    eventBus.on('unload', () => {
      unmount(host.Chess);
    });
  },
};

registerTreeModule('board', BoardModule);
