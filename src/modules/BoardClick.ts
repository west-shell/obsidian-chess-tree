import type { IMove, IPosition, IXQHost } from "../types";
import { isValidMove } from "../utils/rules";
import { registerXQModule, registerPGNViewModule } from "../core/module-system";

const BoardClickModule = {
    init(host: IXQHost) {
        const eventBus = host.eventBus;

        eventBus.on('click', (clickedPos: IPosition) => {
            const clickedPiece = host.board[clickedPos.x][clickedPos.y];

            if (!host.markedPos) {
                if (clickedPiece) {
                    const clickedIsWhite = clickedPiece === clickedPiece.toUpperCase();
                    if (
                        (host.currentTurn === "white" && clickedIsWhite) ||
                        (host.currentTurn !== "white" && !clickedIsWhite)
                    ) {
                        host.markedPos = clickedPos;
                        eventBus.emit('updateUI');
                    }
                }
                return;
            }

            const moveValid = isValidMove(
                host.markedPos,
                clickedPos,
                host.board,
                host.gameState,
            );

            if (moveValid) {
                const move: IMove = {
                    from: { ...host.markedPos },
                    to: { ...clickedPos },
                };
                if (!host.modified) host.modifiedStep = host.currentStep;
                host.modified = true;
                host.markedPos = null;
                eventBus.emit('runmove', move);
            } else {
                if (clickedPiece) {
                    const clickedIsWhite = clickedPiece === clickedPiece.toUpperCase();
                    if (
                        (host.currentTurn === "white" && clickedIsWhite) ||
                        (host.currentTurn === "black" && !clickedIsWhite)
                    ) {
                        host.markedPos = clickedPos;
                        eventBus.emit('updateUI');
                        return;
                    }
                }
                host.markedPos = null;
                eventBus.emit('updateUI');
            }
        })
    }
}

registerXQModule('BoardClick', BoardClickModule);
registerPGNViewModule('BoardClick', BoardClickModule);
