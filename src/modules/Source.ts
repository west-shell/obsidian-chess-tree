import { registerGenFENModule, registerXQModule } from "../core/module-system";
import { parseSource, genFENFromBoard } from "../utils/parse";

const SourceModule = {
    init(host: any) {
        const eventBus = host.eventBus;
        eventBus.on('load', (renderChild: string) => {
            const { haveFEN, board, PGN, firstTurn, options, gameState } = parseSource(host.source);
            switch (renderChild) {
                case 'chess':
                    host.haveFEN = haveFEN;
                    host.board = board;
                    host.PGN = PGN;
                    host.currentTurn = firstTurn;
                    host.currentStep = 0;
                    host.options = options;
                    host.gameState = gameState;
                    break;
                case 'fen':
                    host.board = board;
                    host.currentTurn = 'white';
                    break;
            }
        })

        eventBus.on('full', () => {
            host.board = parseSource('').board;
        })
    }
}

registerXQModule('source', SourceModule);
registerGenFENModule('source', SourceModule);
