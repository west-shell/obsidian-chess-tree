import { Chess, type PieceSymbol, type Square } from '../../chess';
import { registerGenFENModule } from '../../core/module-system';

function getFullFen(host: Record<string, any>): string {
  return `${host.fen} ${host.currentTurn || 'w'} ${host.castling || '-'} ${host.enPassant || '-'} 0 1`;
}

function setHostFenParts(host: Record<string, any>, fullFen: string): void {
  const parts = fullFen.split(' ');
  host.fen = parts[0];
  host.currentTurn = parts[1] || 'w';
  host.castling = parts[2] || '-';
  host.enPassant = parts[3] || '-';
}

const BoardClickModule = {
  init(host: Record<string, any>) {
    const eventBus = host.eventBus;

    eventBus.on('click', (clickedKey: string) => {
      const chess = new Chess(getFullFen(host), { skipValidation: true });

      if (!host.markedPos && !host.selectedPiece) {
        const piece = chess.get(clickedKey as Square);
        if (piece) {
          host.markedPos = clickedKey;
          eventBus.emit('updateUI');
        }
      } else if (host.markedPos && !host.selectedPiece) {
        const from = host.markedPos as Square;
        const to = clickedKey as Square;
        const piece = chess.get(from);
        if (piece) {
          chess.remove(to);
          const sqPiece = chess.get(from);
          chess.remove(from);
          if (sqPiece) chess.put(sqPiece, to);
          setHostFenParts(host, chess.fen());
          host.markedPos = null;
          eventBus.emit('updateUI');
        } else {
          host.markedPos = null;
          eventBus.emit('updateUI');
        }
      } else if (host.selectedPiece) {
        chess.remove(clickedKey as Square);
        if (host.selectedPiece) {
          const color = host.selectedPiece === host.selectedPiece.toUpperCase() ? 'w' : 'b';
          const type = host.selectedPiece.toLowerCase();
          chess.put({ type: type as PieceSymbol, color }, clickedKey as Square);
        }
        setHostFenParts(host, chess.fen());
        host.selectedPiece = null;
        host.markedPos = null;
        eventBus.emit('updateUI');
      }
    });

    eventBus.on('fen-updated', (fen: string) => {
      if (!fen) return;
      setHostFenParts(host, fen);
      host.markedPos = null;
      eventBus.emit('updateUI');
    });
  },
};
registerGenFENModule('BoardClick', BoardClickModule);
