import { getSaveNotation } from "../chess";
import type { ChessNode, NodeEval } from "../types";
import { ANNOTATION_PREFIX } from "./icon";

function genNodeBrothers(root: ChessNode): Map<ChessNode, ChessNode[]> {
  const map = new Map<ChessNode, ChessNode[]>();
  function dfs(node: ChessNode) {
    if (node.children.length > 1) {
      const [main, ...siblings] = node.children;
      map.set(main, siblings);
    }
    for (const child of node.children) dfs(child);
  }
  dfs(root);
  return map;
}

/** `#a:` annotation key -> standard NAG; unmappable keys keep `#a:` form. */
const ANNOTATION_NAG: Record<string, string> = {
  "+": "$16",
  "-": "$17",
  "=": "$10",
  st: "$24",
};

const COLOR_BY_BRUSH: Record<string, string> = {
  g: "G",
  r: "R",
  y: "Y",
  b: "B",
};

function shapeColor(brush: string): string {
  return COLOR_BY_BRUSH[brush] ?? "B";
}

/** Format an eval the lichess way: `+0.35` / `-1.20` / `#3` / `#-4`. */
function formatLichessEval(ev: NodeEval): string {
  if (ev.scoreType === "mate") {
    return `#${ev.score >= 0 ? "" : "-"}${Math.abs(ev.score)}`;
  }
  const pawns = ev.score / 100;
  return `${pawns >= 0 ? "+" : "-"}${Math.abs(pawns).toFixed(2)}`;
}

/** Private %e: eval string (m+n / +n.nn), consumed by EVAL_REGEX on import. */
function formatPrivateEval(ev: NodeEval): string {
  const absScore = Math.abs(ev.score);
  return ev.scoreType === "mate"
    ? `m${ev.score >= 0 ? "+" : "-"}${absScore}`
    : `${ev.score >= 0 ? "+" : "-"}${(absScore / 100).toFixed(2)}`;
}

export interface NodeMetaOptions {
  includeComments?: boolean;
  includeEval?: boolean;
}

/**
 * Serialize a node's metadata (glyph suffix, annotation NAG, comments,
 * shapes, eval) in lichess-compatible form, to be appended right after the
 * move notation:
 *   e4!? $16 {comment} { [%csl Gb4][%cal Ge2e4] } { [%eval +0.35] }
 */
export function serializeNodeMeta(
  node: ChessNode,
  options: NodeMetaOptions = {},
): string {
  const includeComments = options.includeComments ?? true;
  const includeEval = options.includeEval ?? true;
  let meta = "";

  if (node.glyph) {
    meta += node.glyph.symbol;
  }

  if (node.annotation) {
    const nag = ANNOTATION_NAG[node.annotation];
    // Keys without a standard NAG (e.g. bm) keep the private #a: comment.
    meta += nag ? ` ${nag}` : ` {${ANNOTATION_PREFIX}${node.annotation}}`;
  }

  if (includeComments && node.comments?.length) {
    for (const c of node.comments) meta += ` {${c}}`;
  }

  if (node.shapes?.length) {
    const highlights = node.shapes
      .filter((s) => !s.dest)
      .map((s) => shapeColor(s.brush) + s.orig);
    const arrows = node.shapes
      .filter((s) => s.dest)
      .map((s) => shapeColor(s.brush) + s.orig + s.dest);
    let block = "";
    if (highlights.length) block += `[%csl ${highlights.join(",")}]`;
    if (arrows.length) block += `[%cal ${arrows.join(",")}]`;
    if (block) meta += ` { ${block} }`;
  }

  if (includeEval && node.eval) {
    meta += ` { [%eval ${formatLichessEval(node.eval)}] }`;
    if (node.eval.bestmove) {
      // Keep the private %e: block only for lossless bestmove/ponder
      // round-trips; lichess strips it on import without showing it.
      let annotation = `%e:${formatPrivateEval(node.eval)}`;
      annotation += `,${node.eval.bestmove}`;
      if (node.eval.ponder) annotation += `,${node.eval.ponder}`;
      meta += ` {${annotation}}`;
    }
  }

  return meta;
}

export function stringifyPGN(root: ChessNode, includeEval = true): string {
  const nodeBrothers = genNodeBrothers(root);

  function walk(node: ChessNode, stepNum: number): string {
    let result = "";
    if (node.move) {
      const notation = getSaveNotation(node.move);
      if (node.color === "white") {
        result += `${stepNum}. ${notation}`;
      } else if (node.color === "black") {
        result += `${notation}`;
      }
    }
    result += serializeNodeMeta(node, { includeEval });
    const brothers = nodeBrothers.get(node);
    if (brothers?.length) {
      for (const brother of brothers) {
        if (brother.color === "white") {
          result += ` (${walk(brother, stepNum)})`;
        } else if (brother.color === "black") {
          result += ` (${stepNum}. ... ${walk(brother, stepNum)})`;
        }
      }
    }
    if (node.children[0]) {
      const next = node.children[0];
      const nextStepNum = next.color === "white" ? stepNum + 1 : stepNum;
      result += ` ${walk(next, nextStepNum)}`;
    } else if (node.result) {
      result += ` ${node.result}`;
    } else {
      result += " *";
    }
    return result;
  }
  return walk(root, 0).trim();
}
