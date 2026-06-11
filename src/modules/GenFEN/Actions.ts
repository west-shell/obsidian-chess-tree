import { MarkdownView, Notice } from 'obsidian';

import { registerGenFENModule } from '../../core/module-system';
import { t } from '../../i18n';
import type { IGenFENHost } from '../../types';
import { DEFAULT_FEN } from '../../types';

function parseFen(fen: string): string[] {
  const parts = fen.split(' ');
  while (parts.length < 6) parts.push('-');
  return parts;
}

function setFenField(fen: string, idx: number, val: string): string {
  const parts = parseFen(fen);
  parts[idx] = val;
  return parts.join(' ');
}

const ActionsModule = {
  init(host: IGenFENHost) {
    const eventBus = host.eventBus;

    eventBus.on('clickPieceBTN', (piece: string) => {
      if (!piece) return;
      host.selectedPiece = piece;
      host.eventBus.emit('updateUI');
    });

    eventBus.on('btn-click', (action: any) => {
      if (!action) return;

      // Simple string actions
      if (typeof action === 'string') {
        switch (action) {
          case 'turn':
            host.fen = setFenField(host.fen, 1, parseFen(host.fen)[1] === 'w' ? 'b' : 'w');
            break;
          case 'empty':
            host.fen = '8/8/8/8/8/8/8/8 w - - 0 1';
            host.selectedPiece = null;
            break;
          case 'full':
            host.fen = DEFAULT_FEN;
            host.selectedPiece = null;
            break;
          case 'save':
            onSaveBTNClick(host);
            break;
          case 'start':
            host.fen = DEFAULT_FEN;
            host.selectedPiece = null;
            break;
        }
        eventBus.emit('updateUI');
        return;
      }

      // Object actions
      switch (action.action) {
        case 'toggleCastling': {
          const right = action.right as string; // K, Q, k, q
          let castling = parseFen(host.fen)[2];
          if (castling === '-') castling = '';
          if (castling.includes(right)) {
            castling = castling.replace(right, '');
          } else {
            castling = (castling + right).split('').sort((a, b) => {
              const order = ['K', 'Q', 'k', 'q'];
              return order.indexOf(a) - order.indexOf(b);
            }).join('');
          }
          if (!castling) castling = '-';
          host.fen = setFenField(host.fen, 2, castling);
          break;
        }
        case 'setEnPassant': {
          const file = action.file as string;
          if (file === '-') {
            host.fen = setFenField(host.fen, 3, '-');
          } else if (file) {
            const turn = parseFen(host.fen)[1];
            const rank = turn === 'w' ? '6' : '3';
            host.fen = setFenField(host.fen, 3, `${file}${rank}`);
          }
          break;
        }
        case 'setPreset': {
          const fenStr = action.fen as string;
          if (fenStr) {
            host.fen = fenStr;
            host.selectedPiece = null;
          }
          break;
        }
        case 'setFen': {
          const newFen = action.fen as string;
          if (newFen) {
            host.fen = newFen;
          }
          break;
        }
      }
      eventBus.emit('updateUI');
    });
  },
};

registerGenFENModule('actions', ActionsModule);

async function onSaveBTNClick(host: IGenFENHost) {
  const fen = host.fen;
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
    blockLines = [blockLines[0], `[FEN "${fen}"]`, '```'];

    const newContent = [...lines.slice(0, lineStart), ...blockLines, ...lines.slice(lineEnd + 1)].join('\n');

    return newContent;
  });
  new Notice(t('notice.fenSaved'));
}
