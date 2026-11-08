import type { Move } from "@weshell/chess.js";

// ========== Move Notation ==========
// Figurine notation: SAN piece letters -> figurine glyphs. Display-only
// (move list); saved PGN and speech always use plain SAN.
const FIGURINE_NOTATION: Record<string, string> = {
  K: "♔",
  Q: "♕",
  R: "♖",
  B: "♗",
  N: "♘",
};

// Notation modes offered in the move-list settings. The adapter owns this
// list so variants can define their own; each label key resolves to a
// dropdown label showing a notation example.
export interface NotationType {
  value: string;
  labelKey: string;
}

export const NOTATION_TYPES: readonly NotationType[] = [
  { value: "figurine", labelKey: "movelist.notation.figurine" },
  { value: "letter", labelKey: "movelist.notation.letter" },
];
export const DEFAULT_NOTATION_TYPE = "figurine";

export function getMoveNotation(move: Move, notationType?: string): string {
  if (notationType === "figurine") {
    return (move.san ?? "").replace(
      /[KQRBN]/g,
      (m) => FIGURINE_NOTATION[m] ?? m,
    );
  }
  return move.san;
}

export function getSaveNotation(move: Move): string {
  return move.san;
}

// Variant hook: substitutions applied to spoken notation so TTS picks the
// right reading (e.g. xiangqi's 卒→足). Chess SAN is read as-is.
export function applySpeechSubstitutions(text: string): string {
  return text;
}
