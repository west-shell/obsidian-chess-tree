import type { MarkdownPostProcessorContext, MarkdownSectionInformation } from 'obsidian';

import type { Move } from './chess';
import type { EventBus } from './core/event-bus';
import type { ThemeName } from './themes';
import type XQPlugin from './main';

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
export type IHistory = Move[];

export interface IHost {
  plugin: XQPlugin;
  eventBus: EventBus;
}

export interface IXQHost extends IHost {
  containerEl: HTMLElement;
  ctx: MarkdownPostProcessorContext & {
    getSectionInfo(el: HTMLElement): MarkdownSectionInformation;
  };
  fen: string;
  fenRoot: string;
  currentTurn: ITurn;
  history: IHistory;
  PGN: Move[];
  currentStep: number;
  modified: boolean;
  modifiedStep: number | null;
  markedPos?: any;
  settings: ISettings;
  rotated: boolean;
  options?: IOptions;
  haveFEN?: boolean;
  Chess?: any;
  source: string;
}

export interface IGenFENHost extends IHost {
  containerEl: HTMLElement;
  ctx: MarkdownPostProcessorContext & {
    getSectionInfo(el: HTMLElement): MarkdownSectionInformation;
  };
  fen: string; // 完整 FEN，如 "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
  selectedPiece: string | null;
  settings: ISettings;
  file: { path: string };
}
export interface ITreeHost extends IXQHost {
  fen: string;
  nodeMap: NodeMap;
  currentNode: ChessNode | null;
  currentPath: string[];
}
export interface IPGNViewHost extends IHost {
  nodeMap: NodeMap;
  currentNode: ChessNode | null;
  currentPath: string[];
  settings: ISettings;
}
