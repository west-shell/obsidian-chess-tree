import { Chess } from 'chess.js';

import { registerPGNViewModule, registerXQModule } from '../core/module-system';
import type { IXQHost } from '../types';

const BoardClickModule = {
  init(host: IXQHost) {
    const eventBus = host.eventBus;

    eventBus.on('click', (clickedKey: string) => {
      // In non-free mode, Board.svelte handles moves via "runmove" directly
      // This is kept for PGN view compatibility
      if (!host.markedPos) {
        // Try to read the piece at the clicked square
        host.markedPos = clickedKey;
        eventBus.emit('updateUI');
        return;
      }

      // Second click - try to make a move
      try {
        const chess = new Chess(host.fen);
        const move = chess.move({ from: host.markedPos as string, to: clickedKey });
        if (move) {
          host.markedPos = null;
          eventBus.emit('runmove', move);
        } else {
          // Perhaps selecting a different piece
          host.markedPos = clickedKey;
          eventBus.emit('updateUI');
        }
      } catch {
        host.markedPos = null;
        eventBus.emit('updateUI');
      }
    });
  },
};

registerXQModule('BoardClick', BoardClickModule);
registerPGNViewModule('BoardClick', BoardClickModule);
