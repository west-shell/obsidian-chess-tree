export const DEFAULT_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

export interface ISettings {
	position: "bottom" | "right";
	theme: "wood" | "parchment" | "green" | "marble" | "light" | "dark";
	cellSize: number;
	fontSize: number;
	showCoordinateLabels: boolean;
	showLastMove: boolean;
	showNextMove: boolean;
	showTurnBorder: boolean;
	autoJump: "never" | "always" | "auto";
	enableSpeech: boolean;
	showMovelist: boolean;
	showMovelistText: boolean;
	boardMarginTop: number;
	boardMarginBottom: number;
	viewOnly?: boolean;
	rotated?: boolean;
}

export type IOptions = {
	protected?: boolean;
	rotated?: boolean;
};

export type ITurn = "white" | "black";

export const PIECE_CHARS: Record<string, string> = {
	k: "♚",
	q: "♛",
	r: "♜",
	b: "♝",
	n: "♞",
	p: "♟",
	K: "♔",
	Q: "♕",
	R: "♖",
	B: "♗",
	N: "♘",
	P: "♙",
};

export const PIECE_LABELS: Record<string, string> = {
	k: "K",
	q: "Q",
	r: "R",
	b: "B",
	n: "N",
	p: "",
	K: "K",
	Q: "Q",
	R: "R",
	B: "B",
	N: "N",
	P: "",
};

export type PieceType = keyof typeof PIECE_CHARS;
export type IBoard = (PieceType | null)[][];

export interface IPosition { x: number; y: number }

export interface IMove {
	piece?: PieceType;
	from: IPosition;
	to: IPosition;
	captured?: string | null;
	SAN?: string;
	promotion?: PieceType;
	flags?: string;
}

export interface ICastlingRights {
	w: { kingside: boolean; queenside: boolean };
	b: { kingside: boolean; queenside: boolean };
}

export interface IGameState {
	board: IBoard;
	turn: ITurn;
	castlingRights: ICastlingRights;
	enPassantTarget: IPosition | null;
	halfMoveClock: number;
	fullMoveNumber: number;
}

export type ChessNode = {
	id: string;
	data: IMove | null;
	step?: number;
	x?: number;
	y?: number;
	side: string | null;
	parentID?: string | null;
	mainID?: string | null;
	children: ChessNode[];
	board?: IBoard;
	gameState?: IGameState;
	comments?: string[];
};

export type NodeMap = Map<string, ChessNode>;
export type IHistory = IMove[];

import type { MarkdownPostProcessorContext, MarkdownSectionInformation } from "obsidian";
import type XQPlugin from "./main";
import type { EventBus } from "./core/event-bus";

export interface IHost {
	plugin: XQPlugin;
	eventBus: EventBus;
}

export interface IXQHost extends IHost {
	containerEl: HTMLElement;
	ctx: MarkdownPostProcessorContext & {
		getSectionInfo(el: HTMLElement): MarkdownSectionInformation;
	};
	board: IBoard;
	currentTurn: ITurn;
	history: IHistory;
	PGN: IMove[];
	currentStep: number;
	modified: boolean;
	modifiedStep: number | null;
	markedPos: IPosition | null;
	settings: ISettings;
	rotated: boolean;
	options?: IOptions;
	haveFEN?: boolean;
	gameState: IGameState;
	Chess?: any;
	source: string;
}

export interface IGenFENHost extends IHost {
	containerEl: HTMLElement;
	ctx: MarkdownPostProcessorContext & {
		getSectionInfo(el: HTMLElement): MarkdownSectionInformation;
	};
	board: IBoard;
	currentTurn: ITurn;
	markedPos: IPosition | null;
	selectedPiece: string | null;
	settings: ISettings;
	file: { path: string };
}

export interface IPGNViewHost extends IHost {
	nodeMap: NodeMap;
	currentNode: ChessNode | null;
	currentPath: string[];
	settings: ISettings;
}
