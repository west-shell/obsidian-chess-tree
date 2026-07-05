import { Chess, type Move } from "../chess";
import { DEFAULT_FEN, type IOptions, type ITurn } from "../types";

export function parseSource(source: string): {
  haveFEN: boolean;
  fen: string;
  initFEN: string;
  PGN: Move[];
  firstTurn: ITurn;
  options: IOptions;
} {
  const options = parseOption(source);

  // try to find FEN in source
  let fen =
    source.match(
      /([rnbqkpRNBQKP1-8]+\/){7}[rnbqkpRNBQKP1-8]+(?:\s+[wb]\s+(?:K?Q?k?q?|-)\s+(?:-|[a-h][3-6])\s+\d+\s+\d+)/,
    )?.[0] ?? DEFAULT_FEN;

  const firstTurn: ITurn = fen.split(" ")[1] === "b" ? "black" : "white";

  // parse SAN moves from source using chess.js
  const sanStrings = extractSANMoves(source);
  const chess = new Chess(fen);
  const PGN: Move[] = [];

  for (const san of sanStrings) {
    try {
      const move = chess.move(san);
      if (move) PGN.push(move);
    } catch {
      // skip invalid moves
    }
  }

  return {
    haveFEN: fen !== DEFAULT_FEN,
    fen: chess.fen(),
    initFEN: fen,
    PGN,
    firstTurn,
    options,
  };
}

// --- SAN move extraction ---

function extractSANMoves(source: string): string[] {
  // Remove FEN and options lines
  const clean = source
    .replace(/[rnbqkpRNBQKP1-8/]+\s+[wb].*/g, "")
    .replace(/^[pr]\s*[:：].*/gim, "");

  // Match SAN moves: O-O, O-O-O, Nf3, exd5, e8=Q, etc.
  const movePattern =
    /\b(O-O(?:-O)?|[KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](?:=[QRBN])?[+#]?)\b/g;
  const matches = clean.match(movePattern);
  if (!matches) return [];

  // Filter move numbers like "1." "2."
  return matches.filter((m) => !/^\d+\.?$/.test(m));
}

// --- options parsing ---

export function parseOption(source: string): IOptions {
  const options: IOptions = {};
  // 旧格式: p:true / r:false / protected:true / rotated:false
  const oldPatterns: { key: string; regex: RegExp }[] = [
    { key: "protected", regex: /\b(protected|P)\s*[:：]\s*(true|false)\s*/i },
    { key: "rotated", regex: /\b(rotated|r)\s*[:：]\s*(true|false)\s*/i },
  ];
  // 新格式: [Protected "true"] / [Rotated "false"]
  const tagPatterns: { key: string; regex: RegExp }[] = [
    { key: "protected", regex: /\[(?:Protected|P)\s+"(true|false)"\]/i },
    { key: "rotated", regex: /\[(?:Rotated|R)\s+"(true|false)"\]/i },
  ];
  for (const { key, regex } of [...oldPatterns, ...tagPatterns]) {
    const match = source.match(regex);
    if (match && options[key as keyof IOptions] === undefined) {
      options[key as keyof IOptions] =
        match[match.length - 1].toLowerCase() === "true";
    }
  }
  return options;
}
