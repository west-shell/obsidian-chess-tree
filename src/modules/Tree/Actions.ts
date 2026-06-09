import { Chess, type Move } from 'chess.js';

import { registerPGNViewModule } from '../../core/module-system';
import { t } from '../../i18n';
import type { ChessNode } from '../../types';
import { ConfirmModal } from '../../utils/confirmModal';

const ActionsModule = {
  init(host: Record<string, any>) {
    const eventBus = host.eventBus;

    eventBus.on('runmove', (move: Move) => {
      const { from, to, promotion } = move;
      const currentNode = host.currentNode;
      for (let node of currentNode.children) {
        if (
          node.move &&
          node.move.from === from &&
          node.move.to === to &&
          node.move.promotion === promotion
        ) {
          host.currentNode = node;
          host.updateMainPath();
          eventBus.emit('updateUI');
          return;
        }
      }
      const newNode: ChessNode = {
        id: `node-${host.parser.nodeId++}`,
        fen: move.after,
        move,
        step: host.currentStep,
        side: move.color === 'w' ? 'white' : 'black',
        parentID: host.currentNode.id,
        children: [],
        mainID: null,
        comments: [],
      };
      host.nodeMap.set(newNode.id, newNode);
      host.currentNode.children.push(newNode);
      host.currentNode = newNode;
      host.currentStep++;
      host.updateMainPath();
      eventBus.emit('updateUI');
      eventBus.emit('updatePGN');
    });

    eventBus.on('node-click', (id: string) => {
      host.markedPos = null;
      host.currentNode = host.nodeMap.get(id);
      host.updateMainPath();
      host.eventBus.emit('updateUI');
    });

    eventBus.on('updatePGN', () => {
      const pgn = stringifyPGN(host.root);
      const content = [host.tags?.trim(), pgn].filter(Boolean).join('\n');
      host.data = content;
      host.saveFile();
    });

    eventBus.on('btn-click', async (payload: { name: string; payload: any }) => {
      host.markedPos = null;
      const { name, payload: data } = payload;
      switch (name) {
        case 'annotation': {
          if (!host.currentNode) break;
          const node = host.currentNode;
          if (!node.comments) {
            node.comments = [];
          }
          const ALL_ANNOTATIONS = ['W+', 'B+', '=', '?', '!', '1-0', '0-1', '1/2-1/2'];
          const isClickedDataAnnotation = ALL_ANNOTATIONS.includes(data);
          if (isClickedDataAnnotation) {
            const existingAnnotationIndex = node.comments.indexOf(data);
            if (existingAnnotationIndex !== -1) {
              node.comments.splice(existingAnnotationIndex, 1);
            } else {
              node.comments = node.comments.filter((comment: string) => !ALL_ANNOTATIONS.includes(comment));
              node.comments.push(data);
            }
          }
          break;
        }
        case 'remove': {
          if (host.currentNode.id === 'node-root') {
            const modal = new ConfirmModal(
              host.plugin.app,
              t('confirm.deleteTitle'),
              t('confirm.deleteMsg'),
              t('confirm.yes'),
              t('confirm.cancel'),
            );
            modal.open();
            const userConfirmed = await modal.promise;
            if (userConfirmed) {
              host.currentNode.children = [];
              host.nodeMap.clear();
              host.currentNode = { ...host.currentNode };
              host.nodeMap.set(host.currentNode.id, host.currentNode);
              eventBus.emit('node-click', host.currentNode.id);
            }
            break;
          }
          const removeNode = host.currentNode;
          const parentNode = host.nodeMap.get(removeNode.parentID!);
          host.currentNode = parentNode;
          if (parentNode) {
            const index = parentNode.children.indexOf(removeNode);
            if (index !== -1) parentNode.children.splice(index, 1);
          }
          function deleteSubtree(node: ChessNode) {
            for (const child of node.children) {
              deleteSubtree(child);
            }
            host.nodeMap.delete(node.id);
          }
          deleteSubtree(removeNode);
          host.updateMainPath();
          eventBus.emit('node-click', host.currentNode.id);
          break;
        }
        case 'promote': {
          if (!host.currentNode.parentID || host.currentNode.id === 'node-root') break;
          let nodeToPromote = host.currentNode;
          let parent = host.nodeMap.get(nodeToPromote.parentID!);
          if (!parent) break;
          while (parent.children.length > 0 && parent.children[0].id === nodeToPromote.id) {
            if (!parent.parentID) break;
            nodeToPromote = parent;
            parent = host.nodeMap.get(parent.parentID);
            if (!parent) break;
          }
          for (const child of parent.children) {
            child.mainID = null;
          }
          const children = parent.children;
          const index = children.findIndex((c: ChessNode) => c.id === nodeToPromote.id);
          if (index > 0) {
            const item = children[index];
            const otherChildren = children.filter((c: ChessNode) => c.id !== item.id);
            parent.children = [item, ...otherChildren];
          }
          host.updateMainPath();
          break;
        }
        case 'toStart': {
          host.currentNode = host.nodeMap.get(host.currentPath[0]);
          break;
        }
        case 'back': {
          if (host.currentNode.parentID) {
            host.currentNode = host.nodeMap.get(host.currentNode.parentID);
          }
          break;
        }
        case 'next': {
          const currentIndex = host.currentPath.indexOf(host.currentNode.id);
          if (currentIndex < host.currentPath.length - 1) {
            const nextNodeId = host.currentPath[currentIndex + 1];
            host.currentNode = host.nodeMap.get(nextNodeId);
          }
          break;
        }
        case 'toEnd': {
          host.currentNode = host.nodeMap.get(host.currentPath[host.currentPath.length - 1]);
          break;
        }
      }

      eventBus.emit('updateUI');
      eventBus.emit('updatePGN');
    });
  },
};

registerPGNViewModule('actions', ActionsModule);

function stringifyPGN(root: ChessNode): string {
  let nodeBrothers = genNodeBrothers(root);
  function genNodeBrothers(root: ChessNode): Map<ChessNode, ChessNode[]> {
    const nodeBrothers = new Map<ChessNode, ChessNode[]>();
    function dfs(node: ChessNode) {
      if (node.children.length > 1) {
        const [mainChild, ...siblings] = node.children;
        nodeBrothers.set(mainChild, siblings);
      }
      for (const child of node.children) {
        dfs(child);
      }
    }
    dfs(root);
    return nodeBrothers;
  }

  function walk(node: ChessNode, stepNum: number): string {
    let result = '';
    if (node.side === 'white') {
      result += `${stepNum}. ${node.move!.san}`;
    } else if (node.side === 'black') {
      result += `${node.move!.san}`;
    }
    if (node.comments?.length) {
      for (const c of node.comments) {
        result += `{${c}}`;
      }
    }
    const brothers = nodeBrothers.get(node);
    if (brothers?.length) {
      for (const brother of brothers) {
        if (brother.side === 'white') {
          result += ` (${walk(brother, stepNum)})`;
        } else if (brother.side === 'black') {
          result += ` (${stepNum}. ... ${walk(brother, stepNum)})`;
        }
      }
    }
    if (node.children[0]) {
      const next = node.children[0];
      const nextStepNum = next.side === 'white' ? stepNum + 1 : stepNum;
      result += ` ${walk(next, nextStepNum)}`;
    }
    return result;
  }

  const pgn = walk(root, 0);
  return pgn;
}
