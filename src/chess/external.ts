import type { Piece } from "@weshell/chess.js";
import type { ChessNode, IHost } from "../types";
import { DEFAULT_FEN } from "./constants";
import { getTurnFromFen } from "./fen";
import { getSaveNotation } from "./notation";

// ========== Online Analysis Sites ==========
export interface AnalysisSite {
  label: string;
  labelZh: string;
  icon: string;
  positionUrl: (host: IHost) => string;
  gameUrl: (host: IHost) => string;
}

function buildBranchPgn(host: IHost): string {
  const nodes: ChessNode[] = [];
  let node: ChessNode | null = host.currentNode;
  while (node) {
    nodes.push(node);
    node = node.parentID ? (host.nodeMap.get(node.parentID) ?? null) : null;
  }
  nodes.reverse();
  let pgn = "";
  let stepNum = 1;
  for (let i = 1; i < nodes.length; i++) {
    const n = nodes[i];
    if (!n.move) continue;
    const san = getSaveNotation(n.move);
    if (n.color === "white") {
      pgn += `${stepNum}. ${san} `;
    } else {
      pgn += i === 1 ? `${stepNum}... ${san} ` : `${san} `;
      stepNum++;
    }
  }
  if (host.root.fen !== DEFAULT_FEN) {
    pgn = `[SetUp "1"][FEN "${host.root.fen}"] ${pgn}`;
  }
  return pgn.trim();
}

function lichessPositionUrl(host: IHost): string {
  return `https://lichess.org/analysis/${host.fen.replaceAll(" ", "_")}`;
}

function chessComPositionUrl(host: IHost): string {
  return `https://www.chess.com/analysis?fen=${encodeURIComponent(host.fen)}`;
}

export const ANALYSIS_SITES: AnalysisSite[] = [
  {
    label: "Lichess",
    labelZh: "Lichess",
    icon: "external-link",
    positionUrl: lichessPositionUrl,
    gameUrl: (host) => {
      const pgn = buildBranchPgn(host);
      if (!pgn) return lichessPositionUrl(host);
      const color = getTurnFromFen(host.fen) === "black" ? "black" : "white";
      return `https://lichess.org/analysis/pgn/${encodeURIComponent(pgn)}?color=${color}`;
    },
  },
  {
    label: "Chess.com",
    labelZh: "Chess.com",
    icon: "external-link",
    positionUrl: chessComPositionUrl,
    gameUrl: (host) => {
      const pgn = buildBranchPgn(host);
      if (!pgn) return chessComPositionUrl(host);
      return `https://www.chess.com/analysis?pgn=${encodeURIComponent(pgn)}`;
    },
  },
];

// ========== Other ==========
export function parseExternalUrl(_source: string): string | null {
  return null;
}

export function createPieceFromChar(_char: string): Piece | null {
  return null;
}
