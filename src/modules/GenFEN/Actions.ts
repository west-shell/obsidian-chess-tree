import { MarkdownView, Notice } from 'obsidian';

import { registerGenFENModule } from '../../core/module-system';
import { t } from '../../i18n';
import type { IGenFENHost } from '../../types';
import { DEFAULT_FEN } from '../../types';

function setBoardOnly(host: IGenFENHost, boardPart: string): void {
  host.fen = boardPart;
}

function setFullStartPosition(host: IGenFENHost): void {
  const parts = DEFAULT_FEN.split(' ');
  host.fen = parts[0];
}

const ActionsModule = {
  init(host: IGenFENHost) {
    const eventBus = host.eventBus;

    eventBus.on('clickPieceBTN', (piece: string) => {
      if (!piece) return;
      host.selectedPiece = piece;
      host.eventBus.emit('updateUI', host.fen);
    });

    eventBus.on('saveFen', (fullFen: string) => {
      onSaveBTNClick(host, fullFen);
    });

    eventBus.on('btn-click', (action: any) => {
      if (!action) return;

      if (typeof action === 'string') {
        switch (action) {
          case 'empty':
            setBoardOnly(host, '8/8/8/8/8/8/8/8');
            host.selectedPiece = null;
            break;
          case 'full':
            setFullStartPosition(host);
            host.selectedPiece = null;
            break;
          case 'save':
            break;
          case 'start':
            setFullStartPosition(host);
            host.selectedPiece = null;
            break;
        }
        eventBus.emit('updateUI', host.fen);
        return;
      }

      switch (action.action) {
        case 'setPreset': {
          const fenStr = action.fen as string;
          if (fenStr) {
            const parts = fenStr.split(' ');
            host.fen = parts[0];
            host.selectedPiece = null;
          }
          break;
        }
        case 'setFen': {
          const newFen = action.fen as string;
          if (newFen) {
            const parts = newFen.split(' ');
            host.fen = parts[0];
          }
          break;
        }
      }
      eventBus.emit('updateUI', host.fen);
    });
  },
};

registerGenFENModule('actions', ActionsModule);

async function onSaveBTNClick(host: IGenFENHost, fullFen: string) {
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

    blockLines[0] = blockLines[0].replace(/^```fen\b.*$/, '```chess');
    blockLines = [blockLines[0], `[FEN "${fullFen}"]`, '```'];

    const newContent = [...lines.slice(0, lineStart), ...blockLines, ...lines.slice(lineEnd + 1)].join('\n');

    return newContent;
  });
  new Notice(t('notice.fenSaved'));
}
