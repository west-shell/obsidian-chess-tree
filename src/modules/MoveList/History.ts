import { registerXQModule } from "../../core/module-system";
import { toSAN } from "../../utils/rules";
import type { IMove, IXQHost } from "../../types";

const HistoryModule = {

    init(host: IXQHost) {
        const eventBus = host.eventBus;

        eventBus.on("load", () => {
            host.modified = false;
            host.history = [];
        })

        eventBus.on("edithistory", (move: IMove) => {
            editHistory(host, move);
        })
    }
}

function editHistory(host: IXQHost, move: IMove) {
    move.SAN = toSAN(move, host.board);
    move.captured = host.board[move.to.x]?.[move.to.y] ?? null;
    let { currentStep, history } = host;
    const currentMove = move;

    const existingMove = history[currentStep];
    if (
        existingMove &&
        existingMove.from.x === currentMove.from.x &&
        existingMove.from.y === currentMove.from.y &&
        existingMove.to.x === currentMove.to.x &&
        existingMove.to.y === currentMove.to.y
    ) {
        return;
    }

    host.history.splice(currentStep);
    host.history.push(currentMove);
}

registerXQModule('history', HistoryModule);
