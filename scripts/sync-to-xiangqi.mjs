import {
  cpSync,
  mkdirSync,
  existsSync,
  readdirSync,
  rmSync,
  statSync,
} from "node:fs";
import { join } from "node:path";

const CHESS_TREE_ROOT = join(import.meta.dirname, "..");
const XIANGQI_ROOT = join(import.meta.dirname, "..", "..", "obsidian-xiangqi");

if (!existsSync(XIANGQI_ROOT)) {
  console.error(`Xiangqi repo not found at ${XIANGQI_ROOT}`);
  process.exit(1);
}

const EXCLUDED_FILES = new Set([
  "css-imports.ts",
  "icon.ts",
  "declarations.d.ts",
  "_variant.scss",
]);

const EXCLUDED_PATHS = new Set([
  // Variant adapter folder: each repo owns its chess/ entirely.
  "chess",
  "lib/GenFEN/PieceBTNs.svelte",
  "lib/GenFEN/Toolbar.svelte",
  "modules/Engine/Engine.ts",
]);

const EXCLUDED_DIRS = new Set(["assets", "pieces", "themes"]);

const SRC_DIR = join(CHESS_TREE_ROOT, "src");
const DEST_SRC_DIR = join(XIANGQI_ROOT, "src");

function syncDir(srcDir, destDir, relPrefix) {
  if (!existsSync(srcDir)) return;
  mkdirSync(destDir, { recursive: true });

  const srcEntries = readdirSync(srcDir);

  // Mirror deletions: dest entries absent from src are stale copies from
  // earlier syncs (renames/moves in chess-tree). Excluded entries are
  // xiangqi-specific and always kept.
  for (const entry of readdirSync(destDir)) {
    const rel = relPrefix ? `${relPrefix}/${entry}` : entry;
    if (
      EXCLUDED_FILES.has(entry) ||
      EXCLUDED_PATHS.has(rel) ||
      EXCLUDED_DIRS.has(entry)
    ) {
      continue;
    }
    if (!srcEntries.includes(entry)) {
      rmSync(join(destDir, entry), { recursive: true, force: true });
      console.log(`  DELETE:    src/${rel}`);
    }
  }

  for (const entry of srcEntries) {
    const srcPath = join(srcDir, entry);
    const destPath = join(destDir, entry);
    const rel = relPrefix ? `${relPrefix}/${entry}` : entry;

    if (statSync(srcPath).isDirectory()) {
      if (EXCLUDED_DIRS.has(entry) || EXCLUDED_PATHS.has(rel)) {
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

    if (EXCLUDED_PATHS.has(rel)) {
      console.log(`  SKIP path: src/${rel}`);
      continue;
    }

    cpSync(srcPath, destPath);
    console.log(`  SYNC:      src/${rel}`);
  }
}

console.log("Syncing chess-tree -> xiangqi...\n");
syncDir(SRC_DIR, DEST_SRC_DIR, "");
console.log(
  "\nDone! Now manually update xiangqi's chess/ folder with xiangqi-specific values.",
);
