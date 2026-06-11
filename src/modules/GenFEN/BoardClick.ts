import { Chess } from 'chess.js';
import type { Square } from 'chess.js';

import { registerGenFENModule } from '../../core/module-system';

const BOARD_CLICK_EMPTY = '__EMPTY__';

const BoardClickModule = {
  init(host: Record<string, any>) {
    const eventBus = host.eventBus;

    eventBus.on('click', (clickedKey: string) => {
      if (!host.markedPos && !host.selectedPiece) {
        // First click: select a piece on the board
        const chess = new Chess(host.fen);
        const piece = chess.get(clickedKey as Square);
        if (piece) {
          host.markedPos = clickedKey;
          eventBus.emit('updateUI', host.fen);
        }
      } else if (host.markedPos && !host.selectedPiece) {
        // Move piece from markedPos to clickedKey
        const from = host.markedPos as Square;
        const to = clickedKey as Square;
        const chess = new Chess(host.fen);
        const piece = chess.get(from);
        if (piece) {
          // Only allow moving within the board; remove the target piece first
          chess.remove(to);
          const squarePiece = chess.get(from);
          chess.remove(from);
          if (squarePiece) {
            chess.put(squarePiece, to);
          }
          host.fen = chess.fen();
          host.markedPos = null;
          eventBus.emit('updateUI', host.fen);
        } else {
          host.markedPos = null;
          eventBus.emit('updateUI', host.fen);
        }
      } else if (host.selectedPiece) {
        if (host.selectedPiece === BOARD_CLICK_EMPTY) {
          // Clear square
          const chess = new Chess(host.fen);
          chess.remove(clickedKey as Square);
          host.fen = chess.fen();
        } else {
          const chess = new Chess(host.fen);
          chess.remove(clickedKey as Square);
          const color = host.selectedPiece === host.selectedPiece.toUpperCase() ? 'w' : 'b';
          const type = host.selectedPiece.toLowerCase();
          chess.put({ type, color }, clickedKey as Square);
          host.fen = chess.fen();
        }
        host.selectedPiece = null;
        host.markedPos = null;
        eventBus.emit('updateUI', host.fen);
      }
    });
  },
};
registerGenFENModule('BoardClick', BoardClickModule);
