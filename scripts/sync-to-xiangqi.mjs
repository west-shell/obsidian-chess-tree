import { cpSync, mkdirSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";

const CHESS_TREE_ROOT = join(import.meta.dirname, "..");
const XIANGQI_ROOT = join(import.meta.dirname, "..", "..", "obsidian-xiangqi");

if (!existsSync(XIANGQI_ROOT)) {
  console.error(`Xiangqi repo not found at ${XIANGQI_ROOT}`);
  process.exit(1);
}

const EXCLUDED_FILES = new Set([
  "chess.ts",
  "css-imports.ts",
  "themes.ts",
  "icon.ts",
  "confirmModal.ts",
  "parser.test.ts",
  "parse.test.ts",
  "declarations.d.ts",
]);

const EXCLUDED_DIRS = new Set([
  "Engine",
  "assets",
]);

const EXCLUDED_EXTENSIONS = new Set([
  ".scss",
]);

const SRC_DIR = join(CHESS_TREE_ROOT, "src");
const DEST_SRC_DIR = join(XIANGQI_ROOT, "src");

function syncDir(srcDir, destDir, relPrefix) {
  if (!existsSync(srcDir)) return;
  mkdirSync(destDir, { recursive: true });

  for (const entry of readdirSync(srcDir)) {
    const srcPath = join(srcDir, entry);
    const destPath = join(destDir, entry);
    const rel = relPrefix ? `${relPrefix}/${entry}` : entry;

    if (statSync(srcPath).isDirectory()) {
      if (EXCLUDED_DIRS.has(entry)) {
        console.log(`  SKIP dir:  src/${rel}/`);
        continue;
      }
      syncDir(srcPath, destPath, rel);
      continue;
    }

    if (EXCLUDED_FILES.has(entry)) {
      console.log(`  SKIP file: src/${rel}`);
      continue;
    }

    if (EXCLUDED_EXTENSIONS.has(extname(entry))) {
      console.log(`  SKIP ext:  src/${rel}`);
      continue;
    }

    cpSync(srcPath, destPath);
    console.log(`  SYNC:      src/${rel}`);
  }
}

console.log("Syncing chess-tree -> xiangqi...\n");
syncDir(SRC_DIR, DEST_SRC_DIR, "");
console.log("\nDone! Now manually update xiangqi's chess.ts with xiangqi-specific values.");
