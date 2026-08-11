import { registerTreeModule } from "../../core/module-system";
import { DEFAULT_FEN, type ITreeHost } from "../../types";
import { parseOption } from "../../utils/parse";
import { computeGlyph } from "../../utils/winningChances";

import { PGNParser } from "./parser";

/**
 * Prepare source for PGNParser:
 * 1. Extract options (p/protected, r/rotated)
 * 2. Remove option lines from source
 * 3. Ensure FEN is in [FEN "..."] tag format
 * 4. Return cleaned source + options
 */
function prepareSource(raw: string): {
  cleaned: string;
  options: ReturnType<typeof parseOption>;
} {
  const options = parseOption(raw);

  // Remove option lines (e.g. "p: true", "protected: true", "r: false")
  let cleaned = raw.replace(
    /^(protected|P|rotated|R|r)\s*[:：]\s*(true|false)\s*$/gim,
    "",
  );

  // If raw FEN exists without [FEN "..."] tag, wrap it
  const fenMatch = cleaned.match(
    /([rnbqkpRNBQKP1-8]+\/){7}[rnbqkpRNBQKP1-8]+(?:\s+[wb]\s+(?:K?Q?k?q?|-)\s+(?:-|[a-h][3-6])\s+\d+\s+\d+)/,
  );
  const hasFENTag = /\[FEN\s+"/.test(cleaned);
  if (fenMatch && !hasFENTag) {
    cleaned = cleaned.replace(fenMatch[0], `[FEN "${fenMatch[0]}"]`);
  }

  // Inject Protected/Rotated PGN tags if present in source
  const tags: string[] = [];
  if (options.protected !== undefined)
    tags.push(`[Protected "${options.protected}"]`);
  if (options.rotated !== undefined)
    tags.push(`[Rotated "${options.rotated}"]`);
  if (tags.length > 0) {
    cleaned = tags.join("\n") + "\n" + cleaned;
  }

  return { cleaned, options };
}

/** Extract fen string from source */
function extractFEN(source: string): string {
  const fen = source.match(
    /([rnbqkpRNBQKP1-8]+\/){7}[rnbqkpRNBQKP1-8]+(?:\s+[wb]\s+(?:K?Q?k?q?|-)\s+(?:-|[a-h][3-6])\s+\d+\s+\d+)/,
  )?.[0];
  return fen ?? DEFAULT_FEN;
}

const SourceModule = {
  init(host: ITreeHost) {
    const eventBus = host.eventBus;
    eventBus.on<string>("load", (renderChild) => {
      switch (renderChild) {
        case "tree": {
          host.isFenMode = false;
          const { cleaned, options: opts } = prepareSource(host.source);
          const parser = new PGNParser(cleaned);
          host.parser = parser;
          host.haveFEN = parser.haveFEN;
          host.root = parser.getRoot();
          host.nodeMap = parser.getMap();
          host.tags = parser.getTags();
          host.options = opts;
          computeAllGlyphs(host);
          host.currentNode = host.nodeMap.get("node-root")!;
          host.fen = host.currentNode.fen;
          host.currentTurn =
            host.currentNode.move?.color === "b" ? "white" : "black";
          eventBus.emit("updateMainPath");

          const shouldJump =
            host.settings.autoJump === "always" ||
            (host.settings.autoJump === "auto" && !host.haveFEN);
          if (shouldJump && host.currentPath.length > 0) {
            host.currentNode = host.nodeMap.get(
              host.currentPath[host.currentPath.length - 1],
            )!;
            host.fen = host.currentNode.fen;
          }
          break;
        }
        case "fen": {
          host.isFenMode = true;
          const fen = extractFEN(host.source);
          host.fen = fen;
          host.editing = true;
          host.parser = new PGNParser("");
          host.root = host.parser.getRoot();
          host.nodeMap = host.parser.getMap();
          host.currentNode = host.nodeMap.get("node-root")!;
          host.currentNode.fen = fen;
          host.currentTurn = fen.includes(" b ") ? "black" : "white";
          host.tags = "";
          host.options = {};
          eventBus.emit("updateMainPath");
          break;
        }
      }
    });

    eventBus.on("full", () => {
      host.fen = DEFAULT_FEN;
    });
  },
};

registerTreeModule("source", SourceModule);

function computeAllGlyphs(host: ITreeHost) {
  for (const [, node] of host.nodeMap) {
    if (!node.eval || !node.parentID) continue;
    const parent = host.nodeMap.get(node.parentID);
    node.glyph = computeGlyph(parent?.eval, node.eval, node.side);
  }
}
