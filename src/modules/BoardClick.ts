import { Chess, type Square } from '../chess';
import { registerListModule, registerPGNViewModule, registerTreeModule } from '../core/module-system';
import type { IListHost, IPGNViewHost, ITreeHost } from '../types';

const BoardClickModule = {
  init(host: IListHost | ITreeHost | IPGNViewHost) {
    const eventBus = host.eventBus;

    eventBus.on<Square>('click', clickedKey => {
      if (!clickedKey) return;
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

registerListModule('BoardClick', BoardClickModule);
registerPGNViewModule('BoardClick', BoardClickModule);
registerTreeModule('BoardClick', BoardClickModule);
