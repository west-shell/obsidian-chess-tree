import { MarkdownView, Notice } from 'obsidian';

import { registerGenFENModule } from '../../core/module-system';
import { t } from '../../i18n';
import type { IGenFENHost } from '../../types';
import { DEFAULT_FEN } from '../../types';

function buildFullFen(host: IGenFENHost): string {
  return `${host.fen} ${host.currentTurn} ${host.castling} ${host.enPassant} 0 1`;
}

function setBoardOnly(host: IGenFENHost, boardPart: string): void {
  host.fen = boardPart;
  host.currentTurn = 'w';
  host.castling = '-';
  host.enPassant = '-';
}

function setFullStartPosition(host: IGenFENHost): void {
  const parts = DEFAULT_FEN.split(' ');
  host.fen = parts[0];
  host.currentTurn = parts[1];
  host.castling = parts[2];
  host.enPassant = parts[3];
}

const ActionsModule = {
  init(host: IGenFENHost) {
    const eventBus = host.eventBus;

    eventBus.on('clickPieceBTN', (piece: string) => {
      if (!piece) return;
      host.selectedPiece = piece;
      host.eventBus.emit('updateUI', host.fen);
    });

    eventBus.on('btn-click', (action: any) => {
      if (!action) return;

      // Simple string actions
      if (typeof action === 'string') {
        switch (action) {
          case 'turn':
            host.currentTurn = host.currentTurn === 'w' ? 'b' : 'w';
            break;
          case 'empty':
            setBoardOnly(host, '8/8/8/8/8/8/8/8');
            host.selectedPiece = null;
            break;
          case 'full':
            setFullStartPosition(host);
            host.selectedPiece = null;
            break;
          case 'save':
            onSaveBTNClick(host);
            break;
          case 'start':
            setFullStartPosition(host);
            host.selectedPiece = null;
            break;
        }
        eventBus.emit('updateUI', host.fen);
        return;
      }

      // Object actions
      switch (action.action) {
        case 'toggleCastling': {
          const right = action.right as string; // K, Q, k, q
          let castling = host.castling === '-' ? '' : host.castling;
          if (castling.includes(right)) {
            castling = castling.replace(right, '');
          } else {
            castling = (castling + right)
              .split('')
              .sort((a, b) => {
                const order = ['K', 'Q', 'k', 'q'];
                return order.indexOf(a) - order.indexOf(b);
              })
              .join('');
          }
          host.castling = castling || '-';
          break;
        }
        case 'setEnPassant': {
          const file = action.file as string;
          if (file === '-') {
            host.enPassant = '-';
          } else if (file) {
            const rank = host.currentTurn === 'w' ? '6' : '3';
            host.enPassant = `${file}${rank}`;
          }
          break;
        }
        case 'setPreset': {
          const fenStr = action.fen as string;
          if (fenStr) {
            const parts = fenStr.split(' ');
            host.fen = parts[0];
            host.currentTurn = parts[1] || 'w';
            host.castling = parts[2] || '-';
            host.enPassant = parts[3] || '-';
            host.selectedPiece = null;
          }
          break;
        }
        case 'setFen': {
          const newFen = action.fen as string;
          if (newFen) {
            const parts = newFen.split(' ');
            host.fen = parts[0];
            host.currentTurn = parts[1] || host.currentTurn;
            host.castling = parts[2] || host.castling;
            host.enPassant = parts[3] || host.enPassant;
          }
          break;
        }
      }
      eventBus.emit('updateUI', host.fen);
    });
  },
};

registerGenFENModule('actions', ActionsModule);

async function onSaveBTNClick(host: IGenFENHost) {
  const fullFen = buildFullFen(host);
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

    // Replace code block type from fen to chess and insert FEN
    blockLines[0] = blockLines[0].replace(/^```fen\b.*$/, '```chess');
    blockLines = [blockLines[0], `[FEN "${fullFen}"]`, '```'];

    const newContent = [...lines.slice(0, lineStart), ...blockLines, ...lines.slice(lineEnd + 1)].join('\n');

    return newContent;
  });
  new Notice(t('notice.fenSaved'));
}
