import type { IPosition } from "../../types";
import { registerGenFENModule } from "../../core/module-system";
import { loadBoardFromFEN } from "../../utils/parse";

const BoardClickModule = {
    init(host: Record<string, any>) {
        const eventBus = host.eventBus;

        eventBus.on('click', (clickedPos: IPosition) => {
            const clickedPiece = host.board[clickedPos.x][clickedPos.y];
            if (!host.markedPos && !host.selectedPiece) {
                if (clickedPiece) {
                    host.markedPos = clickedPos;
                    eventBus.emit('updateUI');
                }
            } else if (host.markedPos && !host.selectedPiece) {
                const from = host.markedPos
                const to = clickedPos
                host.board[to.x][to.y] = host.board[from.x][from.y];
                host.board[from.x][from.y] = null;
                host.markedPos = null;
                eventBus.emit('updateUI');
            } else if (host.selectedPiece) {
                host.board[clickedPos.x][clickedPos.y] = host.selectedPiece;
                host.selectedPiece = null;
                host.markedPos = null;
                eventBus.emit('updateUI');
            }
        })

        eventBus.on('fen-updated', (fen: string) => {
            if (!fen) return;
            const { board } = loadBoardFromFEN(fen);
            host.board = board;
            host.markedPos = null;
            eventBus.emit('updateUI');
        })
    }
}
registerGenFENModule('BoardClick', BoardClickModule);
