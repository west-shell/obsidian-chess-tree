import type { ChessNode, IListHost, NodeMap } from '../../types';
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
  let { currentStep, history } = host;

  const existingNode = history[currentStep];
  if (
    existingNode &&
    existingNode.move &&
    existingNode.move.from === move.from &&
    existingNode.move.to === move.to &&
    existingNode.move.promotion === move.promotion
  ) {
    return;
  }

  // Find parent node: the node at currentStep-1, or root if step === 0
  let parentNode: ChessNode;
  if (currentStep === 0) {
    parentNode = host.root;
  } else {
    parentNode = history[currentStep - 1];
  }

  // Create new ChessNode
  const side = move.color === 'w' ? 'white' : 'black';
  const newNode: ChessNode = {
    id: `node-${nodeIdCounter++}`,
    fen: move.after,
    move,
    step: currentStep,
    side,
    parentID: parentNode.id,
    children: [],
    mainID: null,
    comments: [],
  };

  // Register in nodeMap
  host.nodeMap.set(newNode.id, newNode);

  // Truncate history at currentStep and add new node
  host.history.splice(currentStep);
  host.history.push(newNode);

  // Link to parent
  parentNode.children.push(newNode);
}

registerListModule('history', HistoryModule);
