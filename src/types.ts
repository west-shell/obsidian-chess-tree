import type { MarkdownPostProcessorContext } from 'obsidian';

import type { Move,Piece,  Square } from './chess';
import type { EventBus } from './core/event-bus';
import type ChessPlugin from './main';
import type { PGNParser } from './modules/Source/parser';
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
  containerEl: HTMLElement;
  ctx: MarkdownPostProcessorContext;
  plugin: ChessPlugin;
  eventBus: EventBus;
  settings: ISettings;
  source: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SvelteComponent = { $set?(props: Partial<Record<string, any>>): void };

export interface IGenFENHost extends IHost {
  fen: string;
  modified: boolean;
  selectedPiece: Piece  | null;
  markedPos: Square | null;
  Chess: SvelteComponent | null;
}

export interface IListHost extends IGenFENHost {
  fen: string;
  initFEN: string;
  history: ChessNode[];
  PGN: ChessNode[];
  currentTurn: ITurn;
  currentStep: number;
  modified: boolean;
  modifiedStep: number | null;
  haveFEN: boolean;
  options: IOptions;
  Chess: SvelteComponent | null;
  nodeMap: NodeMap;
  root: ChessNode;
  stringifyPGN?: (root: ChessNode) => string;
  tags?: Map<string, string>;
}

export interface ITreeHost extends IGenFENHost {
  parser: PGNParser;
  fen: string;
  tags: string;
  root: ChessNode;
  nodeMap: NodeMap;
  currentStep: number;
  currentTurn: ITurn;
  currentNode: ChessNode;
  currentPath: string[];
  haveFEN: boolean;
  options: IOptions;
  stringifyPGN: (root: ChessNode) => string;
}

export interface IPGNViewHost extends ITreeHost {
  data: string;
  contentEl: HTMLElement;
  saveFile: () => void;
}
