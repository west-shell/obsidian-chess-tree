import { SQUARE_PATTERN } from "../chess";
import type { NodeShape } from "../types";

// Lichess comment shape blocks (lila modules/study/src/main/CommentParser.scala):
//   { [%csl Gb4,Yd5,Rf6][%cal Ge2e4,Ye2d4,Re2g4] }
// Each shape is a color letter + one square (highlight) or two squares (arrow).
const CSL_REGEX = new RegExp(
  `\\[\\s*%csl\\s+((?:\\w${SQUARE_PATTERN}[\\s,]*)+)\\]`,
  "g",
);
const CAL_REGEX = new RegExp(
  `\\[\\s*%cal\\s+((?:\\w${SQUARE_PATTERN}${SQUARE_PATTERN}[\\s,]*)+)\\]`,
  "g",
);

// Lichess server eval: { [%eval 0.35] } / { [%eval +0.35] } / { [%eval #-4] }
const EVAL_TAG_REGEX = /\[\s*%eval\s+([^\]]*?)\]/g;

const BRUSH_BY_COLOR: Record<string, string> = {
  G: "g",
  R: "r",
  Y: "y",
  B: "b",
};

/** Unknown color letters degrade to blue, mirroring lila's toBrush. */
function toBrush(color: string): string {
  return BRUSH_BY_COLOR[color] ?? "b";
}

/** Parse a lichess eval value: `+0.35`, `-1.2`, `0.35`, `#4`, `#-4`. */
function parseLichessEval(
  value: string,
): { score: number; scoreType: "cp" | "mate" } | undefined {
  const str = value.trim();
  const mateMatch = str.match(/^[#M]([+-]?\d+)$/);
  if (mateMatch) {
    return { score: Number.parseInt(mateMatch[1], 10), scoreType: "mate" };
  }
  const cpMatch = str.match(/^([+-]?\d+(?:\.\d+)?)$/);
  if (cpMatch) {
    return {
      score: Math.round(Number.parseFloat(cpMatch[1]) * 100),
      scoreType: "cp",
    };
  }
  return undefined;
}

export interface CommentMeta {
  /** Extracted shapes (accumulated across [%csl]/[%cal] blocks). */
  shapes: NodeShape[];
  /** Evaluation from [%eval]; depth unknown (0), later blocks win. */
  eval?: { score: number; scoreType: "cp" | "mate" };
  /** Comment text with all recognized metadata stripped; empty when pure. */
  text: string;
}

/**
 * Extract Lichess metadata ([%csl]/[%cal] shapes, [%eval]) from a comment
 * and return the remaining plain text. More lenient than lila (which only
 * reads the first block of each kind): every block is collected — a
 * superset, so re-imported exports stay compatible.
 */
export function extractCommentMeta(raw: string): CommentMeta {
  const shapes: NodeShape[] = [];
  let stripped = false;

  const consumeShapes = (group: string, squareCount: number): string => {
    const partRegex = new RegExp(
      `\\w(?:${SQUARE_PATTERN}){${squareCount}}`,
      "g",
    );
    for (const part of group.match(partRegex) ?? []) {
      shapes.push({
        orig: part.slice(1, 3),
        ...(squareCount > 1 ? { dest: part.slice(3, 5) } : {}),
        brush: toBrush(part[0]),
      });
    }
    return "";
  };

  let text = raw.replace(CSL_REGEX, (_match, group: string) => {
    stripped = true;
    return consumeShapes(group, 1);
  });
  text = text.replace(CAL_REGEX, (_match, group: string) => {
    stripped = true;
    return consumeShapes(group, 2);
  });

  let evalMeta: CommentMeta["eval"];
  text = text.replace(EVAL_TAG_REGEX, (match, value: string) => {
    const parsed = parseLichessEval(value);
    if (!parsed) return match;
    stripped = true;
    evalMeta = parsed;
    return "";
  });

  if (stripped) {
    // Collapse the whitespace left behind by stripped blocks.
    text = text.replace(/\s+/g, " ").trim();
  }
  return { shapes, eval: evalMeta, text };
}
