import { MarkdownView, Notice } from 'obsidian';

import type { Move } from '../../chess';
import { registerListModule } from '../../core/module-system';
import { t } from '../../i18n';
import type { ChessNode, IListHost, ITurn } from '../../types';
import { SaveConfirmModal } from '../../utils/confirmModal';

const ActionsModule = {
  init(host: IListHost) {
    const eventBus = host.eventBus;

    eventBus.on<Move>('runmove', move => {
      if (!move) return;
      if (!host.modified) host.modifiedStep = host.currentStep;
      host.modified = true;
      eventBus.emit('edithistory', move);
      host.fen = move.after;
      host.currentStep++;
      host.currentTurn = getTurnFromFen(host.fen);
      eventBus.emit('updateUI');
    });

    eventBus.on('undo', () => {
      undo(host);
      eventBus.emit('updateUI');
    });

    eventBus.on('redo', () => {
      redo(host);
      eventBus.emit('updateUI');
    });

    eventBus.on('toStart', () => {
      host.currentStep = 0;
      host.fen = host.root.fen;
      host.currentTurn = getTurnFromFen(host.fen);
      eventBus.emit('updateUI');
    });

    eventBus.on('toEnd', () => {
      const line = host.modified ? host.history : host.PGN;
      if (line.length === 0) {
        eventBus.emit('toStart');
        return;
      }
      const lastNode = line[line.length - 1];
      host.currentStep = line.length;
      host.fen = lastNode.fen;
      host.currentTurn = getTurnFromFen(host.fen);
      eventBus.emit('updateUI');
    });

    eventBus.on('delete', () => {
      if (host.currentStep <= 0) return;
      host.history.splice(host.currentStep - 1);
      host.currentStep--;
      if (host.currentStep === 0) {
        host.fen = host.root.fen;
      } else {
        host.fen = host.history[host.currentStep - 1].fen;
      }
      host.currentTurn = getTurnFromFen(host.fen);
      host.modified = true;
      eventBus.emit('updateUI');
    });

    eventBus.on('reset', () => {
      host.history = [...host.PGN];
      host.modified = false;
      host.modifiedStep = null;
      host.currentStep = 0;
      host.fen = host.root.fen;
      host.currentTurn = getTurnFromFen(host.fen);
      eventBus.emit('updateUI');
    });

    eventBus.on('save', async () => {
      if (host.history.length === 0 && host.PGN.length === 0) {
        new Notice(t('notice.saveEmpty'));
        return;
      }

      const hasBranches = host.history.some(n => n.children.length > 1);
      const modal = new SaveConfirmModal(host.plugin.app, hasBranches, t);

      modal.open();
      const result = await modal.promise;

      if (result === 'save') {
        await savePGN(host);
        new Notice(t('notice.saveSuccess'));
      } else if (result === 'saveAll') {
        await saveAllPGN(host);
        new Notice(t('notice.saveSuccess'));
      }
      eventBus.emit('updateUI');
    });

    eventBus.on<number>('clickstep', step => {
      if (step === undefined || step === host.currentStep) return;
      const line = host.modified ? host.history : host.PGN;
      host.currentStep = step;
      if (step === 0) {
        host.fen = host.root.fen;
      } else {
        const node = line[step - 1];
        host.fen = node?.fen ?? host.root.fen;
      }
      host.currentTurn = getTurnFromFen(host.fen);
      eventBus.emit('updateUI');
    });

    eventBus.on('rotate', () => {
      if (!host.options) {
        host.options = { rotated: true };
      } else {
        host.options.rotated = !host.options.rotated;
      }
      eventBus.emit('updateUI');
    });

    host.stringifyPGN = stringifyPGN;
  },
};

registerListModule('actions', ActionsModule);

function undo(host: IListHost) {
  if (host.currentStep > 0) {
    host.currentStep--;
    host.fen = host.currentStep === 0 ? host.root.fen : (host.modified ? host.history : host.PGN)[host.currentStep - 1].fen;
    host.currentTurn = getTurnFromFen(host.fen);
  }
}

function redo(host: IListHost) {
  const line = host.modified ? host.history : host.PGN;
  if (host.currentStep < line.length) {
    const nextNode = line[host.currentStep];
    if (!nextNode) return;
    host.currentStep++;
    host.fen = nextNode.fen;
    host.currentTurn = getTurnFromFen(host.fen);
  }
}

/** Read turn from fen string */
function getTurnFromFen(fen: string): ITurn {
  return fen.split(' ')[1] === 'b' ? 'black' : 'white';
}

function stringifyPGN(root: ChessNode): string {
  const nodeBrothers = genNodeBrothers(root);

  function genNodeBrothers(root: ChessNode): Map<ChessNode, ChessNode[]> {
    const map = new Map<ChessNode, ChessNode[]>();
    function dfs(node: ChessNode) {
      if (node.children.length > 1) {
        const [main, ...siblings] = node.children;
        map.set(main, siblings);
      }
      for (const child of node.children) dfs(child);
    }
    dfs(root);
    return map;
  }

  function walk(node: ChessNode, stepNum: number): string {
    let result = '';
    if (!node.move) return result;
    if (node.side === 'white') {
      result += `${stepNum}. ${node.move.san}`;
    } else if (node.side === 'black') {
      result += `${node.move.san}`;
    }
    if (node.comments?.length) {
      for (const c of node.comments) result += `{${c}}`;
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
  return walk(root, 0);
}

async function savePGN(host: IListHost) {
  const view = host.plugin.app.workspace.getActiveViewOfType(MarkdownView);
  if (!view) return;
  const file = view.file;
  if (!file) return;

  host.plugin.app.vault.process(file, fileContent => {
    const section = host.ctx.getSectionInfo(host.containerEl);
    if (!section) return fileContent;

    const { lineStart, lineEnd } = section;
    const lines = fileContent.split('\n');

    let blockLines: string[] = lines.slice(lineStart, lineEnd + 1);

    if (blockLines.length < 2) return fileContent;

    // Remove all SAN move lines
    blockLines = blockLines.filter(
      line => !/\b(O-O(?:-O)?|[KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](?:=[QRBN])?)\b/.test(line),
    );

    if (host.currentStep > 0) {
      const moves = host.history.slice(0, host.currentStep).map((node: ChessNode) => node.move?.san ?? '');

      const pgnLines: string[] = [];
      for (let i = 0; i < moves.length; i += 2) {
        const line = `${Math.ceil((i + 1) / 2)}. ${moves[i]} ${moves[i + 1] || ''}`.trim();
        pgnLines.push(line);
      }
      const PGN = pgnLines.join('\n');

      blockLines.splice(blockLines.length - 1, 0, PGN);
    }

    const newContent = [...lines.slice(0, lineStart), ...blockLines, ...lines.slice(lineEnd + 1)].join('\n');
    return newContent;
  });
}

async function saveAllPGN(host: IListHost) {
  const view = host.plugin.app.workspace.getActiveViewOfType(MarkdownView);
  if (!view) return;
  const file = view.file;
  if (!file) return;

  const pgn = stringifyPGN(host.root);

  host.plugin.app.vault.process(file, fileContent => {
    const section = host.ctx.getSectionInfo(host.containerEl);
    if (!section) return fileContent;

    const { lineStart, lineEnd } = section;
    const lines = fileContent.split('\n');
    const blockLines = lines.slice(lineStart, lineEnd + 1);

    if (blockLines.length < 2) return fileContent;

    // Keep first line (```chess) and last line (```), replace middle with full PGN (with variations)
    const updated = [blockLines[0], pgn, blockLines[blockLines.length - 1]];
    const newLines = [...lines.slice(0, lineStart), ...updated, ...lines.slice(lineEnd + 1)];
    return newLines.join('\n');
  });
}
