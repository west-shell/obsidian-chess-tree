import type { MarkdownPostProcessorContext } from 'obsidian';

import type { Move, Square } from './chess';
import type { EventBus } from './core/event-bus';
import type XQPlugin from './main';
import type { ThemeName } from './themes';

export const DEFAULT_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export interface ISettings {
  position: 'bottom' | 'right';
  lang: 'auto' | 'en' | 'zh';
  theme: ThemeName;
  cellSize: number;
  fontSize: number;
  showCoordinateLabels: boolean;
  showLastMove: boolean;
  showNextMove: boolean;
  showTurnBorder: boolean;
  autoJump: 'never' | 'always' | 'auto';
  enableSpeech: boolean;
  showMovelist: boolean;
  showMovelistText: boolean;
  boardMarginTop: number;
  boardMarginBottom: number;
  viewOnly?: boolean;
  rotated?: boolean;
  codeBlockNames: {
    chess: string[];
    fen: string[];
    tree: string[];
  };
  genfenSaveType: 'chess' | 'tree';
  enablePGNView: boolean;
  pgnFileExtensions: string[];
}

export type IOptions = {
  protected?: boolean;
  rotated?: boolean;
};

export type ITurn = 'white' | 'black';

export type ChessNode = {
  id: string;
  fen: string;
  move: Move | null;
  side: string | null;
  step?: number;
  x?: number;
  y?: number;
  parentID?: string | null;
  mainID?: string | null;
  children: ChessNode[];
  comments?: string[];
};

export type NodeMap = Map<string, ChessNode>;

export interface IHost {
  plugin: XQPlugin;
  eventBus: EventBus;
  settings: ISettings;
}
interface IBlockHost extends IHost {
  containerEl: HTMLElement;
  ctx: MarkdownPostProcessorContext;
  source: string;
}

export interface IGenFENHost extends IBlockHost {
  fen: string;
  selectedPiece: string | null;
  markedPos: Square | null;
}

export interface IListHost extends IBlockHost {
  fen: string;
  initFEN: string;
  currentTurn: ITurn;
  history: Move[];
  PGN: Move[];
  currentStep: number;
  modified: boolean;
  modifiedStep: number | null;
  markedPos: Square | null;
  haveFEN: boolean;
  options: IOptions;
  Chess: any;
}

export interface ITreeHost extends IBlockHost {
  fen: string;
  tags: Map<string, string>;
  root: ChessNode;
  nodeMap: NodeMap;
  currentNode: ChessNode | null;
  currentPath: string[];
  modified: boolean;
  markedPos: Square | null;
  haveFEN: boolean;
  options: IOptions;
  stringifyPGN: (root: ChessNode) => string;
  Chess: any;
}

export interface IPGNViewHost extends IHost {
  nodeMap: NodeMap;
  currentNode: ChessNode | null;
  currentPath: string[];
  settings: ISettings;
}
