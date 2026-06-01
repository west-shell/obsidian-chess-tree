import type { IBoard, IMove, IOptions, ITurn, PieceType } from "../types";
import type { IGameState, ICastlingRights } from "../types";
import { DEFAULT_FEN } from "../types";
import { isValidMove, makeMove, parseAlgebraic } from "./rules";

function sameSide(a: string, b: string | null): boolean {
	if (!b) return false;
	return (a === a.toUpperCase()) === (b === b.toUpperCase());
}

const COLS = 8;
const ROWS = 8;

export function parseSource(source: string): {
	haveFEN: boolean;
	board: IBoard;
	PGN: IMove[];
	firstTurn: ITurn;
	gameState: IGameState;
	options: IOptions;
} {
	const options = parseOption(source);

	// try to find FEN in source
	let fen = source.match(
		/([rnbqkpRNBQKP1-8]+\/){7}[rnbqkpRNBQKP1-8]+(?:\s+[wb]\s+(?:K?Q?k?q?|-)\s+(?:-|[a-h][3-6])\s+\d+\s+\d+)/,
	)?.[0];
	if (!fen) {
		fen = DEFAULT_FEN;
	}

	const { board, turn, castlingRights, enPassantTarget, halfMoveClock, fullMoveNumber } = loadFullFEN(fen);
	const firstTurn = turn === "b" ? "black" : "white";

	const gameState: IGameState = {
		board: board.map(row => [...row]),
		turn: firstTurn,
		castlingRights,
		enPassantTarget,
		halfMoveClock,
		fullMoveNumber: fullMoveNumber || 1,
	};

	// parse SAN moves from source
	const sanStrings = extractSANMoves(source);
	let tmpBoard = board.map(row => [...row]);
	let tmpState = { ...gameState, board: tmpBoard };

	const PGN: IMove[] = [];
	for (const san of sanStrings) {
		const move = parseSANMove(san, tmpBoard, tmpState);
		if (move) {
			const { newBoard, newState } = makeMove(tmpBoard, move, tmpState);
			tmpBoard = newBoard;
			tmpState = newState;
			PGN.push(move);
		}
	}

	return {
		haveFEN: fen !== DEFAULT_FEN,
		board,
		PGN,
		firstTurn,
		gameState: {
			board,
			turn: firstTurn,
			castlingRights,
			enPassantTarget,
			halfMoveClock,
			fullMoveNumber: fullMoveNumber || 1,
		},
		options,
	};
}

// --- FEN parsing (standard chess) ---

export function loadBoardFromFEN(fen: string): { board: IBoard; turn: string } {
	const { board, turn } = loadFullFEN(fen);
	return { board, turn };
}

function loadFullFEN(fen: string): {
	board: IBoard;
	turn: string;
	castlingRights: ICastlingRights;
	enPassantTarget: { x: number; y: number } | null;
	halfMoveClock: number;
	fullMoveNumber: number;
} {
	const parts = fen.trim().split(/\s+/);
	const position = parts[0];
	const turn = parts[1] || "w";
	const castlingStr = parts[2] || "-";
	const epStr = parts[3] || "-";
	const halfMove = parseInt(parts[4] || "0");
	const fullMove = parseInt(parts[5] || "1");

	const board: IBoard = Array.from({ length: COLS }, () => Array(ROWS).fill(null));
	const rows = position.split("/");
	rows.forEach((row, y) => {
		let x = 0;
		for (const char of row) {
			if (/[1-8]/.test(char)) {
				x += parseInt(char);
			} else if (/[a-zA-Z]/.test(char)) {
				if (x < COLS && y < ROWS) {
					board[x][y] = char as PieceType;
				}
				x++;
			}
		}
	});

	const castlingRights: ICastlingRights = {
		w: { kingside: castlingStr.includes("K"), queenside: castlingStr.includes("Q") },
		b: { kingside: castlingStr.includes("k"), queenside: castlingStr.includes("q") },
	};

	let enPassantTarget = null;
	if (epStr !== "-") {
		const file = epStr.charCodeAt(0) - 97;
		const rank = 8 - parseInt(epStr[1]);
		enPassantTarget = { x: file, y: rank };
	}

	return { board, turn, castlingRights, enPassantTarget, halfMoveClock: halfMove, fullMoveNumber: fullMove };
}

// --- SAN move extraction ---

function extractSANMoves(source: string): string[] {
	// Remove FEN and options lines
	const clean = source.replace(/[rnbqkpRNBQKP1-8\/]+\s+[wb].*/g, "").replace(/^[pr]\s*[:：].*/gim, "");

	// Match SAN moves: O-O, O-O-O, Nf3, exd5, e8=Q, etc.
	const movePattern = /\b(O-O(?:-O)?|[KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](?:=[QRBN])?[+#]?)\b/g;
	const matches = clean.match(movePattern);
	if (!matches) return [];

	// Filter move numbers like "1." "2."
	return matches.filter(m => !/^\d+\.?$/.test(m));
}

// --- SAN move parsing ---

export function parseSANMove(san: string, board: IBoard, gameState: IGameState): IMove | null {
	if (san === "O-O" || san === "O-O-O") {
		return parseCastlingSAN(san, board, gameState);
	}

	// Remove check/checkmate symbols
	let clean = san.replace(/[+#]$/, "");

	// Promotion
	let promotion: PieceType | undefined;
	const promoMatch = clean.match(/=([QRBN])$/);
	if (promoMatch) {
		const color = gameState.turn === "white" ? "W" : "B";
		const promoChar = color === "W" ? promoMatch[1] : promoMatch[1].toLowerCase();
		promotion = promoChar as PieceType;
		clean = clean.replace(/=[QRBN]$/, "");
	}

	// Extract destination square (last two chars: file+rank)
	const destMatch = clean.match(/([a-h])([1-8])$/);
	if (!destMatch) return null;
	const dest = parseAlgebraic(clean.slice(-2));
	clean = clean.slice(0, -2);

	// Capture indicator
	const isCapture = clean.endsWith("x");
	if (isCapture) clean = clean.slice(0, -1);

	// Remaining: piece letter + optional disambiguation
	let pieceChar = "P";
	let disambFile: number | undefined;
	let disambRank: number | undefined;

	if (clean.length > 0) {
		if (/^[KQRBN]$/.test(clean)) {
			pieceChar = clean;
		} else {
			// Could be disambiguation
			pieceChar = clean[0].toUpperCase();
			if (/^[KQRBN]$/.test(pieceChar)) {
				const rest = clean.slice(1);
				if (rest.length >= 1 && /[a-h]/.test(rest[0])) {
					disambFile = rest.charCodeAt(0) - 97;
				}
				if (rest.length >= 2 && /[1-8]/.test(rest[1])) {
					disambRank = 8 - parseInt(rest[1]);
				} else if (rest.length === 1 && /[1-8]/.test(rest[0])) {
					disambRank = 8 - parseInt(rest[0]);
				}
			} else if (/[a-h]/.test(clean[0])) {
				pieceChar = "P";
				disambFile = clean.charCodeAt(0) - 97;
			}
		}
	}

	const color = gameState.turn;
	const pieceUpper = color === "white" ? pieceChar.toUpperCase() : pieceChar.toLowerCase();

	// Find the piece that can make this move
	for (let x = 0; x < COLS; x++) {
		for (let y = 0; y < ROWS; y++) {
			if (board[x][y] !== pieceUpper) continue;
			if (disambFile !== undefined && x !== disambFile) continue;
			if (disambRank !== undefined && y !== disambRank) continue;

			const from = { x, y };
			if (isValidMove(from, dest, board, gameState)) {
				const piece = board[x][y]!;
				const move: IMove = { from, to: dest, piece, SAN: san };
				if (promotion) move.promotion = promotion;
				if (board[dest.x][dest.y]) move.captured = board[dest.x][dest.y];
				// en passant flag
				if (piece.toUpperCase() === "P" && gameState.enPassantTarget &&
					dest.x === gameState.enPassantTarget.x && dest.y === gameState.enPassantTarget.y) {
					move.flags = "enPassant";
				}
				return move;
			}
		}
	}

	return null;
}

function parseCastlingSAN(san: string, board: IBoard, gameState: IGameState): IMove | null {
	const y = gameState.turn === "white" ? 7 : 0;
	const from = { x: 4, y };
	const to = san === "O-O" ? { x: 6, y } : { x: 2, y };
	return {
		from,
		to,
		piece: board[4][y]!,
		SAN: san,
		flags: "castle",
	};
}

// --- FEN generation ---

export function genFENFromBoard(board: IBoard, turn: ITurn): string {
	const rows: string[] = [];
	for (let y = 0; y < ROWS; y++) {
		let fenRow = "";
		let empty = 0;
		for (let x = 0; x < COLS; x++) {
			const cell = board[x][y];
			if (!cell) {
				empty++;
			} else {
				if (empty > 0) { fenRow += empty; empty = 0; }
				fenRow += cell;
			}
		}
		if (empty > 0) fenRow += empty;
		rows.push(fenRow);
	}
	return `${rows.join("/")} ${turn === "white" ? "w" : "b"}`;
}

// --- simple helper ---

export function isSameSide(fromPiece: string, toPiece: string | null): boolean {
	return sameSide(fromPiece, toPiece);
}

// --- options parsing ---

export function parseOption(source: string): IOptions {
	const options: IOptions = {};
	const optionPatterns = [
		{ key: "protected", regex: /\b(protected|P)\s*[:：]\s*(true|false)\s*/i },
		{ key: "rotated", regex: /\b(rotated|r)\s*[:：]\s*(true|false)\s*/i },
	];
	optionPatterns.forEach(({ key, regex }) => {
		const match = source.match(regex);
		if (match) {
			options[key as keyof IOptions] = match[2].toLowerCase() === "true";
		}
	});
	return options;
}
