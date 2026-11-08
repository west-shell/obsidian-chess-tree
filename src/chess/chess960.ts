import { Chess } from "@weshell/chess.js";

// ========== Chess960 (Fischer Random) ==========
const CHESS960_DARK_FILES: readonly string[] = ["a", "c", "e", "g"];
const CHESS960_LIGHT_FILES: readonly string[] = ["b", "d", "f", "h"];
// Lexicographic index pairs for placing the two knights on the five
// squares left after the bishops and the queen (C(5,2) = 10 patterns).
const CHESS960_KNIGHT_PATTERNS: readonly (readonly [number, number])[] = [
  [0, 1],
  [0, 2],
  [0, 3],
  [0, 4],
  [1, 2],
  [1, 3],
  [1, 4],
  [2, 3],
  [2, 4],
  [3, 4],
];

// Shared tail of every 960 start generator: assemble the raw start FEN
// from a lowercase backrank arrangement (k/q/r/b/n, files a-h) with
// Shredder castling letters (king-side rook first; standard -> HAha),
// then re-emit through chess.js so the FEN is canonical (field order
// and castling normalization match what load/fen() produce everywhere).
function chess960StartFen(arrangement: string[]): string {
  const files = ["a", "b", "c", "d", "e", "f", "g", "h"];
  const kingIdx = arrangement.indexOf("k");
  let ksRook = -1;
  let qsRook = -1;
  for (let i = kingIdx + 1; i < 8 && ksRook === -1; i++) {
    if (arrangement[i] === "r") ksRook = i;
  }
  for (let i = kingIdx - 1; i >= 0 && qsRook === -1; i--) {
    if (arrangement[i] === "r") qsRook = i;
  }
  const backrank = arrangement.join("");
  const castling =
    files[ksRook].toUpperCase() +
    files[qsRook].toUpperCase() +
    files[ksRook] +
    files[qsRook];
  const raw = `${backrank}/pppppppp/8/8/8/8/PPPPPPPP/${backrank.toUpperCase()} w ${castling} - 0 1`;
  return new Chess(raw).fen();
}

// Generate a uniformly random Chess960 start position. Uniformity:
// dark-square bishop (4) x light-square bishop (4) x queen (6) x knight
// pair (C(5,2)=10) = 960 equally likely arrangements.
export function randomChess960Fen(): string {
  const files = ["a", "b", "c", "d", "e", "f", "g", "h"];
  const arrangement: string[] = ["", "", "", "", "", "", "", ""];
  const darkIdx = files.indexOf(
    CHESS960_DARK_FILES[Math.floor(Math.random() * 4)],
  );
  const lightIdx = files.indexOf(
    CHESS960_LIGHT_FILES[Math.floor(Math.random() * 4)],
  );
  arrangement[darkIdx] = "b";
  arrangement[lightIdx] = "b";
  const freeAfterBishops = arrangement
    .map((v, i) => (v === "" ? i : -1))
    .filter((i) => i >= 0);
  arrangement[freeAfterBishops[Math.floor(Math.random() * 6)]] = "q";
  const freeAfterQueen = arrangement
    .map((v, i) => (v === "" ? i : -1))
    .filter((i) => i >= 0);
  const n1 = Math.floor(Math.random() * 5);
  let n2 = Math.floor(Math.random() * 4);
  if (n2 >= n1) n2++;
  arrangement[freeAfterQueen[n1]] = "n";
  arrangement[freeAfterQueen[n2]] = "n";
  const rkr = arrangement
    .map((v, i) => (v === "" ? i : -1))
    .filter((i) => i >= 0);
  arrangement[rkr[0]] = "r";
  arrangement[rkr[1]] = "k";
  arrangement[rkr[2]] = "r";
  return chess960StartFen(arrangement);
}

// The Chess960 start position with the given official number
// (Scharnagl, 0-959; 518 is the standard position). Returns null for
// numbers outside the range.
export function chess960FenByNumber(spn: number): string | null {
  if (!Number.isInteger(spn) || spn < 0 || spn > 959) return null;
  const files = ["a", "b", "c", "d", "e", "f", "g", "h"];
  const arrangement: string[] = ["", "", "", "", "", "", "", ""];
  const lightIdx = files.indexOf(CHESS960_LIGHT_FILES[spn % 4]);
  const darkIdx = files.indexOf(CHESS960_DARK_FILES[Math.floor(spn / 4) % 4]);
  arrangement[darkIdx] = "b";
  arrangement[lightIdx] = "b";
  const freeAfterBishops = arrangement
    .map((v, i) => (v === "" ? i : -1))
    .filter((i) => i >= 0);
  arrangement[freeAfterBishops[Math.floor(spn / 16) % 6]] = "q";
  const freeAfterQueen = arrangement
    .map((v, i) => (v === "" ? i : -1))
    .filter((i) => i >= 0);
  const knights = CHESS960_KNIGHT_PATTERNS[Math.floor(spn / 96)];
  arrangement[freeAfterQueen[knights[0]]] = "n";
  arrangement[freeAfterQueen[knights[1]]] = "n";
  const rkr = arrangement
    .map((v, i) => (v === "" ? i : -1))
    .filter((i) => i >= 0);
  arrangement[rkr[0]] = "r";
  arrangement[rkr[1]] = "k";
  arrangement[rkr[2]] = "r";
  return chess960StartFen(arrangement);
}

function isChess960Backrank(rank: string): boolean {
  if (rank.length !== 8) return false;
  const counts: Record<string, number> = { k: 0, q: 0, r: 0, b: 0, n: 0 };
  for (const ch of rank) {
    if (counts[ch] === undefined) return false;
    counts[ch] += 1;
  }
  if (
    counts.k !== 1 ||
    counts.q !== 1 ||
    counts.r !== 2 ||
    counts.b !== 2 ||
    counts.n !== 2
  ) {
    return false;
  }
  // King strictly between the two rooks, bishops on opposite colors.
  const kingIdx = rank.indexOf("k");
  if (!(rank.indexOf("r") < kingIdx && kingIdx < rank.lastIndexOf("r"))) {
    return false;
  }
  return (rank.indexOf("b") + rank.lastIndexOf("b")) % 2 === 1;
}

// The lowercase backrank of `fen` if it shows a start shape: mirrored
// valid (standard or 960) backranks, full pawn rows, empty middle
// ranks. Null otherwise.
function chess960StartBoard(fen: string): string | null {
  try {
    const ranks = new Chess(fen).fen().split(" ")[0].split("/");
    if (ranks.length !== 8) return null;
    const white = ranks[7].toLowerCase();
    const black = ranks[0];
    if (!isChess960Backrank(white) || !isChess960Backrank(black)) {
      return null;
    }
    // Start positions are always mirrored.
    if (white !== black) return null;
    if (ranks[1] !== "pppppppp" || ranks[6] !== "PPPPPPPP") return null;
    for (let i = 2; i <= 5; i++) {
      if (ranks[i] !== "8") return null;
    }
    return white;
  } catch {
    return null;
  }
}

// Detect whether a FEN is a Chess960 start position; used to emit the
// [Variant "Chess960"] PGN header for games whose tags lack it.
export function getPgnVariantTag(fen: string): string | null {
  const backrank = chess960StartBoard(fen);
  // Standard start never needs a Variant tag.
  if (backrank === null || backrank === "rnbqkbnr") return null;
  return "Chess960";
}

// Inverse of chess960FenByNumber: the official number (0-959) of the
// Chess960 start position shown by a FEN, or null if the FEN is not a
// start position (the standard start resolves to 518).
export function chess960SpnFromFen(fen: string): number | null {
  const backrank = chess960StartBoard(fen);
  if (backrank === null) return null;
  let darkFile = -1;
  let lightFile = -1;
  const freeAfterBishops: number[] = [];
  for (let i = 0; i < 8; i++) {
    if (backrank[i] === "b") {
      if (i % 2 === 0) darkFile = i;
      else lightFile = i;
    } else {
      freeAfterBishops.push(i);
    }
  }
  const queenIdx = freeAfterBishops.findIndex((i) => backrank[i] === "q");
  if (queenIdx === -1) return null;
  const freeAfterQueen = freeAfterBishops.filter((i) => backrank[i] !== "q");
  const knightPos: number[] = [];
  for (let j = 0; j < freeAfterQueen.length; j++) {
    if (backrank[freeAfterQueen[j]] === "n") knightPos.push(j);
  }
  const knightIdx = CHESS960_KNIGHT_PATTERNS.findIndex(
    (p) => p[0] === knightPos[0] && p[1] === knightPos[1],
  );
  if (knightIdx === -1) return null;
  // N = light bishop + 4*dark bishop + 16*queen + 96*knight pattern
  const lightIdx = (lightFile - 1) / 2; // position within [b,d,f,h]
  const darkIdx = darkFile / 2; // position within [a,c,e,g]
  return lightIdx + 4 * darkIdx + 16 * queenIdx + 96 * knightIdx;
}
