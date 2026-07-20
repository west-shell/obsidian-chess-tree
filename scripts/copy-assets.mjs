import { copyFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const mode = process.argv[2];
const wasmSrc = join(root, 'assets', 'stockfish', 'stockfish-18-lite-single.wasm');
const wasmName = 'stockfish-18-lite-single.wasm';

function copy(src, dest) {
  const destDir = dirname(dest);
  if (!existsSync(destDir)) mkdirSync(destDir, { recursive: true });
  copyFileSync(src, dest);
  console.log(`  copied: ${dest}`);
}

if (mode === 'dev') {
  const outDir = join(root, 'test-vault', '.obsidian', 'plugins', 'chess-tree');
  copy(join(root, 'manifest.json'), join(outDir, 'manifest.json'));
  copy(wasmSrc, join(outDir, wasmName));
} else if (mode === 'build') {
  const outDir = join(root, 'build');
  copy(join(root, 'manifest.json'), join(outDir, 'manifest.json'));
  copy(wasmSrc, join(outDir, wasmName));
} else {
  console.error('Usage: node copy-assets.mjs <dev|build>');
  process.exit(1);
}
