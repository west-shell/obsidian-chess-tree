import type { MarkdownPostProcessorContext } from "obsidian";

import type { Move, Piece, Square } from "./chess";
import type { EventBus } from "./core/event-bus";
import type ChessPlugin from "./main";
import type { PGNParser } from "./modules/Source/parser";
import type { ThemeName } from "./themes";

export const DEFAULT_FEN =
  "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

export interface ISettings {
  lang: "auto" | "en" | "zh";
  theme: ThemeName;
  zoom: number;
  fontSize: number;
  showCoordinateLabels: boolean;
  showLastMove: boolean;
  showNextMove: boolean;
  showTurnBorder: boolean;
  autoJump: "never" | "always" | "auto";
  enableSpeech: boolean;
  showMovelist: boolean;
  boardMarginTop: number;
  boardMarginBottom: number;
  viewOnly?: boolean;
  rotated?: boolean;
  treeBlockNames: string[];
  fenBlockNames: string[];
  enablePGNView: boolean;
  pgnFileExtensions: string[];
  engineDepth: number;
  engineSkillLevel: number;
  saveEvalByDefault: boolean;
  saveEvalPrompt: boolean;
}

export type IOptions = {
  protected?: boolean;
  rotated?: boolean;
};

export type ITurn = "white" | "black";

export type NodeEval = {
  score: number;
  scoreType: "cp" | "mate";
  depth: number;
  bestmove?: string;
  ponder?: string;
};

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
  eval?: NodeEval;
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

export type SvelteComponent = {
  $set?(props: Partial<Record<string, unknown>>): void;
};

export interface IGenFENHost extends IHost {
  fen: string;
  modified: boolean;
  selectedPiece: Piece | null;
  markedPos: Square | null;
  Chess: SvelteComponent | null;
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
  stringifyPGN: (root: ChessNode, includeEval?: boolean) => string;
}

export interface IPGNViewHost extends ITreeHost {
  data: string;
  contentEl: HTMLElement;
  saveFile: () => void;
}
