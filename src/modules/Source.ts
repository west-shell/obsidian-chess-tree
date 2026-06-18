import { validateFen } from '../chess';
import { registerGenFENModule, registerListModule, registerTreeModule } from '../core/module-system';
import { DEFAULT_FEN } from '../types';
import { parseSource } from '../utils/parse';
import { PGNParser } from './Tree/parser';

const SourceModule = {
  init(host: any) {
    const eventBus = host.eventBus;
    eventBus.on('load', (renderChild: string) => {
      if (renderChild === 'tree') {
        const parser = new PGNParser(host.source);
        host.parser = parser;
        host.haveFEN = parser.haveFEN;
        host.root = parser.getRoot();
        host.nodeMap = parser.getMap();
        host.tags = parser.getTags();
        host.currentNode = host.nodeMap.get('node-root');
        host.currentTurn = 'white';
        host.updateMainPath();
        return;
      }
      const { haveFEN, fen, fenRoot, PGN, firstTurn, options } = parseSource(host.source);
      switch (renderChild) {
        case 'fen': {
          host.fen = validateFen(fen).ok ? fen : DEFAULT_FEN; // 完整 FEN
          break;
        }
        case 'chess': {
          host.haveFEN = haveFEN;
          host.fen = fenRoot;
          host.fenRoot = fenRoot;
          host.PGN = PGN;
          host.history = [...PGN];
          host.currentTurn = firstTurn;
          host.currentStep = 0;
          host.options = options;
          break;
        }
      }
    });

    eventBus.on('full', () => {
      host.fen = DEFAULT_FEN;
    });
  },
};

registerGenFENModule('source', SourceModule);
registerListModule('source', SourceModule);
registerTreeModule('source', SourceModule);