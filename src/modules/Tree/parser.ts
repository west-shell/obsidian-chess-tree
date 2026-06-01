import { tokenize, type Token, type TokenType } from './Tokenizer';
import type { ChessNode, IBoard, IMove, IPosition, ITurn, IGameState } from '../../types';
import { loadBoardFromFEN, parseSANMove } from '../../utils/parse';
import { DEFAULT_FEN } from '../../types';
import { isValidMove, toSAN, makeMove, isInCheck, isSquareAttacked, findKing } from '../../utils/rules';

const COLS = 8;
const ROWS = 8;

function defaultGameState(board: IBoard): IGameState {
    return {
        board: board.map(row => [...row]),
        turn: "white",
        castlingRights: {
            w: { kingside: true, queenside: true },
            b: { kingside: true, queenside: true },
        },
        enPassantTarget: null,
        halfMoveClock: 0,
        fullMoveNumber: 1,
    };
}

export class PGNParser {
    haveFEN: boolean = false;
    tokens: Token[];
    nodeMap: Map<string, ChessNode>;
    currentIndex: number;
    rootNode: ChessNode;
    currentNode: ChessNode;
    nodeId: number;
    currentStep: number = 0;
    currentSide: ITurn = 'white';
    tags: Map<string, string> = new Map();
    gameState: IGameState;

    constructor(input: string | Token[]) {
        this.nodeMap = new Map<string, ChessNode>();
        this.tokens = typeof input === 'string' ? tokenize(input) : input;
        this.currentIndex = 0;
        this.nodeId = 1;

        const initialBoard = loadBoardFromFEN(DEFAULT_FEN).board;
        this.gameState = defaultGameState(initialBoard);

        this.rootNode = {
            id: `node-root`,
            data: null,
            step: 0,
            side: null,
            parentID: null,
            children: [],
            mainID: null,
            board: initialBoard.map(row => [...row]),
            gameState: { ...this.gameState },
            comments: []
        };
        this.nodeMap.set(this.rootNode.id, this.rootNode);
        this.currentStep++;

        this.currentNode = this.rootNode;

        while (!this.match('eof')) {
            if (this.match('tag')) {
                this.parseTag();
            } else if (this.match('san-move')) {
                this.processSAN(this.consume().value);
            } else if (this.match('left-paren')) {
                this.parseVariation();
            } else if (this.match('comment')) {
                this.parseComment();
            } else if (this.match('result')) {
                this.parseResult();
            } else {
                this.consume();
            }
        }
    }

    parseTag() {
        const token = this.consume();
        const tagText = token.value;

        const match = tagText.match(/^\[(\w+)\s+"([^"]*)"\]$/);
        if (!match) return;

        const [, tagName, tagValue] = match;

        this.tags.set(tagName, tagValue);

        if (tagName.toUpperCase() === 'FEN') {
            this.haveFEN = true;
            const { board, turn } = loadBoardFromFEN(tagValue);
            this.currentNode.board = board.map(row => [...row]);
            this.currentSide = turn === 'b' ? 'black' : 'white';
            this.gameState = defaultGameState(board);
            this.gameState.turn = this.currentSide;
            if (this.currentNode.gameState) {
                this.currentNode.gameState = { ...this.gameState };
            }
        }
    }

    createNode(move: IMove | null): ChessNode {
        const node: ChessNode = {
            id: `node-${this.nodeId++}`,
            data: move,
            step: this.currentStep,
            side: this.currentSide,
            parentID: this.currentNode.id,
            children: [],
            mainID: null,
            comments: []
        };
        this.nodeMap.set(node.id, node);
        return node;
    }

    peek(): Token {
        return this.tokens[this.currentIndex];
    }

    consume(): Token {
        return this.tokens[this.currentIndex++];
    }

    match(type: TokenType): boolean {
        return this.peek().type === type;
    }

    parseSANMoveString(san: string, board: IBoard, gs: IGameState): IMove | null {
        return parseSANMove(san, board, gs);
    }

    processSAN(san: string) {
        const board = this.currentNode.board || this.gameState.board;
        const gs = this.currentNode.gameState || this.gameState;
        const move = this.parseSANMoveString(san, board, gs);
        if (!move) return;
        const newNode = this.createNode(move);
        newNode.data!.piece = board[move.from.x][move.from.y] ?? undefined;
        newNode.data!.SAN = san;
        newNode.data!.captured = board[move.to.x]?.[move.to.y] ?? null;

        const { newBoard, newState } = makeMove(board, move, gs);
        newNode.board = newBoard;
        newNode.gameState = newState;

        this.nodeMap.set(newNode.id, newNode);
        this.currentNode.children.push(newNode);
        this.currentNode = newNode;
        this.gameState = newState;
        this.switchSide();
        this.currentStep++;
    }

    parseVariation() {
        this.consume(); // consume '('

        const variationBase = this.nodeMap.get(this.currentNode.parentID!);
        const prevState = {
            node: this.currentNode,
            step: this.currentStep,
            side: this.currentSide,
            gameState: this.gameState,
        };

        this.currentNode = variationBase!;
        this.currentStep = this.currentStep - 1;
        this.currentSide = this.currentSide === 'white' ? 'black' : 'white';
        this.gameState = this.currentNode.gameState || this.gameState;

        while (!this.match('right-paren') && !this.match('eof')) {
            if (this.match('san-move')) {
                this.processSAN(this.consume().value);
            } else if (this.match('comment')) {
                this.parseComment();
            } else if (this.match('left-paren')) {
                this.parseVariation();
            } else if (this.match('result')) {
                this.consume();
                break;
            } else {
                this.consume();
            }
        }

        if (this.match('right-paren')) {
            this.consume();
        }

        this.currentNode = prevState.node;
        this.currentStep = prevState.step;
        this.currentSide = prevState.side;
        this.gameState = prevState.gameState;
    }

    parseComment() {
        const token = this.consume();
        const comment = token.value
            .replace(/^{|}$/g, '')
            .replace(/^;/, '')
            .trim();

        if (!this.currentNode.comments) {
            this.currentNode.comments = [];
        }
        this.currentNode.comments.push(comment);
    }

    parseResult() {
        const token = this.consume();
        let result = '';
        switch (token.value) {
            case "1-0":
                result = "1-0";
                break;
            case "0-1":
                result = "0-1";
                break;
            case "1/2-1/2":
                result = "1/2-1/2";
                break;
            case "*":
                result = "?";
                break;
        }
        if (!this.currentNode.comments) {
            this.currentNode.comments = [];
        }
        this.currentNode.comments.push(result);
    }

    switchSide() {
        this.currentSide = this.currentSide === 'white' ? 'black' : 'white';
    }

    public getTags(): string {
        const lines: string[] = [];
        for (const [key, value] of this.tags.entries()) {
            lines.push(`[${key} "${value}"]`);
        }
        return lines.join('\n');
    }
    public getRoot(): ChessNode {
        return this.rootNode;
    }
    public getMap(): Map<string, ChessNode> {
        return this.nodeMap;
    }
}
