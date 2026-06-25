import type { ChessNode, IListHost } from '../../types';
import type { Move } from '../../chess';
import { registerListModule } from '../../core/module-system';

const HistoryModule = {
  init(host: IListHost) {
    const eventBus = host.eventBus;

    eventBus.on('load', () => {
      host.modified = false;
    });

    eventBus.on('edithistory', (payload?: unknown) => {
      if (!payload || typeof payload !== 'object') return;
      editHistory(host, payload as Move);
    });
  },
};

let nodeIdCounter = 1; // Simple counter for generating node IDs

function editHistory(host: IListHost, move: Move) {
  const { currentStep } = host;
  const parentNode = currentStep > 0 ? host.history[currentStep - 1] : host.root;

  // Check if parent already has this move as a child
  for (const child of parentNode.children) {
    if (child.move?.from === move.from && child.move?.to === move.to && child.move?.promotion === move.promotion) {
      host.history = [...host.history.slice(0, currentStep), child];
      return;
    }
  }

  // Create new ChessNode
  const side = move.color === 'w' ? 'white' : 'black';
  const newNode: ChessNode = {
    id: `node-${nodeIdCounter++}`,
    fen: move.after,
    move,
    step: parentNode.step! + 1,
    side,
    parentID: parentNode.id,
    children: [],
    mainID: null,
    comments: [],
  };

  host.nodeMap.set(newNode.id, newNode);
  parentNode.children.unshift(newNode);
  host.history = [...host.history.slice(0, currentStep), newNode];
}

registerListModule('history', HistoryModule);
