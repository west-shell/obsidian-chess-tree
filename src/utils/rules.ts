import type { IBoard, IMove, IPosition, ITurn, IGameState, ICastlingRights, PieceType } from "../types";

const COLS = 8;
const ROWS = 8;

// --- basic helpers ---

function inBounds(x: number, y: number): boolean {
	return x >= 0 && x < COLS && y >= 0 && y < ROWS;
}

function isSameSide(a: string, b: string | null): boolean {
	if (!b) return false;
	return (a === a.toUpperCase()) === (b === b.toUpperCase());
}

function isWhitePiece(p: string): boolean {
	return p === p.toUpperCase();
}

// --- directional ray helper ---

function rayClear(from: IPosition, to: IPosition, board: IBoard): boolean {
	const dx = Math.sign(to.x - from.x);
	const dy = Math.sign(to.y - from.y);
	let x = from.x + dx;
	let y = from.y + dy;
	while (x !== to.x || y !== to.y) {
		if (board[x][y]) return false;
		x += dx;
		y += dy;
	}
	return true;
}

// --- piece move generators (pseudo-legal, no check safety) ---

function kingMoves(from: IPosition, to: IPosition, _board: IBoard): boolean {
	const dx = Math.abs(to.x - from.x);
	const dy = Math.abs(to.y - from.y);
	return dx <= 1 && dy <= 1 && (dx + dy > 0);
}

function queenMoves(from: IPosition, to: IPosition, board: IBoard): boolean {
	return rookMoves(from, to, board) || bishopMoves(from, to, board);
}

function rookMoves(from: IPosition, to: IPosition, board: IBoard): boolean {
	if (from.x !== to.x && from.y !== to.y) return false;
	return rayClear(from, to, board);
}

function bishopMoves(from: IPosition, to: IPosition, board: IBoard): boolean {
	const dx = Math.abs(to.x - from.x);
	const dy = Math.abs(to.y - from.y);
	if (dx !== dy || dx === 0) return false;
	return rayClear(from, to, board);
}

function knightMoves(from: IPosition, to: IPosition, _board: IBoard): boolean {
	const dx = Math.abs(to.x - from.x);
	const dy = Math.abs(to.y - from.y);
	return (dx === 2 && dy === 1) || (dx === 1 && dy === 2);
}

function pawnMoves(from: IPosition, to: IPosition, board: IBoard, enPassant: IPosition | null): boolean {
	const piece = board[from.x][from.y]!;
	const isWhite = isWhitePiece(piece);
	const dir = isWhite ? -1 : 1;
	const startRank = isWhite ? 6 : 1;
	const dx = to.x - from.x;
	const dy = to.y - from.y;

	// forward one step
	if (dx === 0 && dy === dir && !board[to.x][to.y]) return true;

	// forward two steps from start
	if (dx === 0 && dy === 2 * dir && from.y === startRank &&
		!board[to.x][to.y] && !board[from.x][from.y + dir]) return true;

	// diagonal capture
	if (Math.abs(dx) === 1 && dy === dir && board[to.x][to.y]) return true;

	// en passant
	if (enPassant && Math.abs(dx) === 1 && dy === dir &&
		to.x === enPassant.x && to.y === enPassant.y) return true;

	return false;
}

// --- pseudo-legal move check ---

export function isValidMove(from: IPosition, to: IPosition, board: IBoard, gameState?: IGameState): boolean {
	if (!board) return false;
	if (!inBounds(from.x, from.y) || !inBounds(to.x, to.y)) return false;
	if (from.x === to.x && from.y === to.y) return false;

	const piece = board[from.x][from.y];
	if (!piece) return false;

	const target = board[to.x][to.y];
	if (target && isSameSide(piece, target)) return false;

	const enPassant = gameState?.enPassantTarget ?? null;

	// castling: king moves 2 squares horizontally
	if (piece.toUpperCase() === "K" && Math.abs(to.x - from.x) === 2 && from.y === to.y && gameState) {
		const isW = isWhitePiece(piece);
		if (to.x === 6) {
			const rights = isW ? gameState.castlingRights.w : gameState.castlingRights.b;
			if (rights.kingside && !board[5][from.y] && !board[6][from.y] && board[7][from.y]?.toUpperCase() === "R") return true;
		} else if (to.x === 2) {
			const rights = isW ? gameState.castlingRights.w : gameState.castlingRights.b;
			if (rights.queenside && !board[3][from.y] && !board[2][from.y] && !board[1][from.y] && board[0][from.y]?.toUpperCase() === "R") return true;
		}
		return false;
	}

	switch (piece.toUpperCase()) {
		case "K": return kingMoves(from, to, board);
		case "Q": return queenMoves(from, to, board);
		case "R": return rookMoves(from, to, board);
		case "B": return bishopMoves(from, to, board);
		case "N": return knightMoves(from, to, board);
		case "P": return pawnMoves(from, to, board, enPassant);
		default: return false;
	}
}

// --- simulate a move ---

function cloneBoard(board: IBoard): IBoard {
	return board.map(row => [...row]);
}

export function makeMove(board: IBoard, move: IMove, gameState: IGameState): { newBoard: IBoard; newState: IGameState } {
	const newBoard = cloneBoard(board);
	const piece = newBoard[move.from.x][move.from.y]!;
	const isWhite = isWhitePiece(piece);

	// handle castling rook movement
	if (move.flags === "castle") {
		newBoard[move.to.x][move.to.y] = piece;
		newBoard[move.from.x][move.from.y] = null;
		if (move.to.x === 6) {
			// kingside
			const rook = newBoard[7][move.from.y]!;
			newBoard[5][move.from.y] = rook;
			newBoard[7][move.from.y] = null;
		} else {
			// queenside
			const rook = newBoard[0][move.from.y]!;
			newBoard[3][move.from.y] = rook;
			newBoard[0][move.from.y] = null;
		}
	} else {
		// en passant capture
		if (piece.toUpperCase() === "P" && gameState.enPassantTarget &&
			move.to.x === gameState.enPassantTarget.x && move.to.y === gameState.enPassantTarget.y) {
			const capturedY = isWhite ? move.to.y + 1 : move.to.y - 1;
			newBoard[move.to.x][capturedY] = null;
		}

		// normal move
		newBoard[move.to.x][move.to.y] = move.promotion ?? piece;
		newBoard[move.from.x][move.from.y] = null;
	}

	// update castling rights
	const newCastling = { ...gameState.castlingRights };
	if (piece.toUpperCase() === "K") {
		if (isWhite) newCastling.w = { kingside: false, queenside: false };
		else newCastling.b = { kingside: false, queenside: false };
	}
	if (piece.toUpperCase() === "R") {
		if (isWhite) {
			if (move.from.x === 7 && move.from.y === 7) newCastling.w.kingside = false;
			if (move.from.x === 0 && move.from.y === 7) newCastling.w.queenside = false;
		} else {
			if (move.from.x === 7 && move.from.y === 0) newCastling.b.kingside = false;
			if (move.from.x === 0 && move.from.y === 0) newCastling.b.queenside = false;
		}
	}
	// if a rook is captured
	const capturedAt = move.flags === "enPassant"
		? { x: move.to.x, y: isWhite ? move.to.y + 1 : move.to.y - 1 }
		: move.to;
	const capturedPiece = move.flags === "castle" ? null : board[capturedAt.x][capturedAt.y];
	if (capturedPiece?.toUpperCase() === "R") {
		if (move.to.x === 7 && move.to.y === 7) newCastling.w.kingside = false;
		if (move.to.x === 0 && move.to.y === 7) newCastling.w.queenside = false;
		if (move.to.x === 7 && move.to.y === 0) newCastling.b.kingside = false;
		if (move.to.x === 0 && move.to.y === 0) newCastling.b.queenside = false;
	}

	// en passant target
	let newEnPassant: IPosition | null = null;
	if (piece.toUpperCase() === "P" && Math.abs(move.to.y - move.from.y) === 2) {
		newEnPassant = { x: move.from.x, y: (move.from.y + move.to.y) / 2 };
	}

	// halfmove clock
	const newHalfMove = (piece.toUpperCase() === "P" || capturedPiece)
		? 0
		: gameState.halfMoveClock + 1;

	const newFullMove = isWhite ? gameState.fullMoveNumber : gameState.fullMoveNumber + 1;

	const newState: IGameState = {
		board: newBoard,
		turn: gameState.turn === "white" ? "black" : "white",
		castlingRights: newCastling,
		enPassantTarget: newEnPassant,
		halfMoveClock: newHalfMove,
		fullMoveNumber: newFullMove,
	};

	return { newBoard, newState };
}

// --- SAN generation ---

export function toSAN(move: IMove, board: IBoard): string {
	if (move.flags === "castle") return move.SAN!;
	const piece = board[move.from.x][move.from.y]!;
	const pieceType = piece.toUpperCase();
	const isPawn = pieceType === "P";

	// disambiguation helpers
	const candidates: IPosition[] = [];
	for (let x = 0; x < COLS; x++) {
		for (let y = 0; y < ROWS; y++) {
			if (x === move.from.x && y === move.from.y) continue;
			const p = board[x][y];
			if (!p || p.toUpperCase() !== pieceType) continue;
			if (isSameSide(p, piece) && isValidMove({ x, y }, move.to, board)) {
				candidates.push({ x, y });
			}
		}
	}

	let disamb = "";
	if (candidates.length > 0) {
		const sameFile = candidates.some(c => c.x === move.from.x);
		const sameRank = candidates.some(c => c.y === move.from.y);
		if (!sameFile) {
			disamb = String.fromCharCode(97 + move.from.x);
		} else if (!sameRank) {
			disamb = String(8 - move.from.y);
		} else {
			disamb = String.fromCharCode(97 + move.from.x) + String(8 - move.from.y);
		}
	}

	const pieceSymbol = isPawn ? "" : pieceType;
	const capture = board[move.to.x][move.to.y] || (move.flags === "enPassant") ? "x" : "";
	const dest = String.fromCharCode(97 + move.to.x) + String(8 - move.to.y);

	let san = pieceSymbol + disamb + capture + dest;
	if (move.promotion) san += "=" + move.promotion.toUpperCase();
	return san;
}

// --- parse algebraic notation to position ---

export function parseAlgebraic(coord: string): IPosition {
	const file = coord.charCodeAt(0) - 97;
	const rank = 8 - parseInt(coord[1]);
	return { x: file, y: rank };
}
