import { registerGenFENModule, registerListModule, registerTreeModule } from '../../core/module-system';
import { DEFAULT_FEN, type IGenFENHost, type IListHost, type ITreeHost } from '../../types';
import { parseOption } from '../../utils/parse';

import { PGNParser } from './parser';

/**
 * Prepare source for PGNParser:
 * 1. Extract options (p/protected, r/rotated)
 * 2. Remove option lines from source
 * 3. Ensure FEN is in [FEN "..."] tag format
 * 4. Return cleaned source + options
 */
function prepareSource(raw: string): { cleaned: string; options: ReturnType<typeof parseOption> } {
  const options = parseOption(raw);

  // Remove option lines (e.g. "p: true", "protected: true", "r: false")
  let cleaned = raw.replace(/^(protected|P|rotated|R|r)\s*[:：]\s*(true|false)\s*$/gim, '');

  // If raw FEN exists without [FEN "..."] tag, wrap it
  const fenMatch = cleaned.match(
    /([rnbqkpRNBQKP1-8]+\/){7}[rnbqkpRNBQKP1-8]+(?:\s+[wb]\s+(?:K?Q?k?q?|-)\s+(?:-|[a-h][3-6])\s+\d+\s+\d+)/,
  );
  const hasFENTag = /\[FEN\s+"/.test(cleaned);
  if (fenMatch && !hasFENTag) {
    cleaned = cleaned.replace(fenMatch[0], `[FEN "${fenMatch[0]}"]`);
  }

  // Inject Protected/Rotated PGN tags if present in source
  const tags: string[] = [];
  if (options.protected !== undefined) tags.push(`[Protected "${options.protected}"]`);
  if (options.rotated !== undefined) tags.push(`[Rotated "${options.rotated}"]`);
  if (tags.length > 0) {
    cleaned = tags.join('\n') + '\n' + cleaned;
  }

  return { cleaned, options };
}

/** Extract fen string from source */
function extractFEN(source: string): string {
  const fen = source.match(
    /([rnbqkpRNBQKP1-8]+\/){7}[rnbqkpRNBQKP1-8]+(?:\s+[wb]\s+(?:K?Q?k?q?|-)\s+(?:-|[a-h][3-6])\s+\d+\s+\d+)/,
  )?.[0];
  return fen ?? DEFAULT_FEN;
}

const SourceModule = {
  init(host: IGenFENHost) {
    const eventBus = host.eventBus;
    eventBus.on<string>('load', renderChild => {
      switch (renderChild) {
        case 'tree': {
          const treeHost = host as ITreeHost;
          const parser = new PGNParser(treeHost.source);
          treeHost.parser = parser;
          treeHost.haveFEN = parser.haveFEN;
          treeHost.root = parser.getRoot();
          treeHost.nodeMap = parser.getMap();
          treeHost.tags = parser.getTags();
          treeHost.currentNode = treeHost.nodeMap.get('node-root')!;
          treeHost.currentTurn = treeHost.currentNode.move?.color === 'b' ? 'white' : 'black';
          eventBus.emit('updateMainPath');

          // 根据 autoJump 设置决定初始节点位置
          const shouldJump =
            host.settings.autoJump === 'always' ||
            (host.settings.autoJump === 'auto' && !treeHost.haveFEN);
          if (shouldJump && treeHost.currentPath.length > 0) {
            treeHost.currentNode = treeHost.nodeMap.get(
              treeHost.currentPath[treeHost.currentPath.length - 1],
            )!;
          }
          break;
        }
        case 'list': {
          const listHost = host as IListHost;

          // Prepare source and use PGNParser to build tree
          const { cleaned, options: opts } = prepareSource(host.source);
          const parser = new PGNParser(cleaned);
          const mainLine = parser.getMainLine();

          listHost.root = parser.getRoot();
          listHost.nodeMap = parser.getMap();
          listHost.haveFEN = parser.haveFEN;
          listHost.initFEN = parser.getRoot().fen;
          listHost.PGN = mainLine;
          listHost.history = [...mainLine];
          listHost.currentTurn = getTurnFromFen(parser.getRoot().fen);
          listHost.options = opts;
          listHost.tags = new Map(parser.tags);

          // 根据 autoJump 设置决定初始步数和棋盘局面
          const shouldJump =
            host.settings.autoJump === 'always' ||
            (host.settings.autoJump === 'auto' && !listHost.haveFEN);
          if (shouldJump) {
            listHost.currentStep = mainLine.length;
            listHost.fen = mainLine.length > 0 ? mainLine[mainLine.length - 1].fen : parser.getRoot().fen;
          } else {
            listHost.currentStep = 0;
            listHost.fen = parser.getRoot().fen;
          }
          break;
        }

        case 'fen': {
          host.fen = extractFEN(host.source);
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

/** Read turn from fen string */
function getTurnFromFen(fen: string): 'white' | 'black' {
  return fen.split(' ')[1] === 'b' ? 'black' : 'white';
}
