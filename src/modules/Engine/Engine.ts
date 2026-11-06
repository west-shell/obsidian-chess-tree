import { requestUrl } from "obsidian";
import { t } from "../../i18n";
import { DownloadModal } from "./DownloadModal";
import { BaseEngine, type EngineResult } from "./BaseEngine";

export type { EngineResult };

const WASM_NAME = "stockfish.wasm";
const JS_NAME = "stockfish.js";
/**
 * Versioned engine asset release. Bump on every engine rebuild and
 * publish a matching release tag (`stockfish-<version>`) on both GitHub
 * and Gitee; older plugin versions keep downloading their own assets
 * from the older, untouched releases.
 */
const ENGINE_VERSION = "1.0.0";
const BASE_GITHUB = `https://github.com/west-shell/obsidian-chess-tree/releases/download/stockfish-${ENGINE_VERSION}`;
const BASE_GITEE_RELEASE = `https://gitee.com/wesnell/obsidian-chess-tree/releases/download/stockfish-${ENGINE_VERSION}`;
/**
 * Exact byte size of each engine asset in the `stockfish-<ENGINE_VERSION>`
 * release (identical on GitHub and Gitee). Verified via adapter.stat()
 * before the engine starts: a size mismatch marks a wrong-version,
 * corrupted, or truncated download and re-downloads that file, while
 * manually installed assets of the right release pass without any
 * marker file.
 */
const EXPECTED_SIZES: Record<string, number> = {
  [JS_NAME]: 20_570,
  [WASM_NAME]: 7_295_411,
};
/**
 * SHA-256 of the same release assets (confirmed identical on GitHub
 * and Gitee). Verified once per session at engine init, where the
 * bytes are already loaded in memory — catches the rare size-matched
 * corruption (e.g. a download manager that preallocates the file and
 * is interrupted mid-download) that the byte-size check above cannot
 * see.
 */
const EXPECTED_SHA256: Record<string, string> = {
  [JS_NAME]: "bde83899af9c9573140556c4d2c754268ede7a78d6a1ca9522ff57608f4644e6",
  [WASM_NAME]:
    "a8fbc05ec6920b56d7485826dcb02c5ffd2826bcbf751cf973046f237a9096f1",
};

/** Engine assets already hash-verified in this app session. */
const hashVerified = new Set<string>();

async function sha256Hex(buffer: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

interface DownloadSource {
  key: string;
  label: string;
  getUrl: (file: string) => string;
}

const DOWNLOAD_SOURCES: DownloadSource[] = [
  {
    key: "github",
    label: "GitHub",
    getUrl: (file) => `${BASE_GITHUB}/${file}`,
  },
  {
    key: "gitee",
    label: "Gitee",
    getUrl: (file) => `${BASE_GITEE_RELEASE}/${file}`,
  },
];

export class ChessEngine extends BaseEngine {
  async checkFileExists(): Promise<string[]> {
    const adapter = this.plugin!.app.vault.adapter;
    const baseDir = `${this.plugin!.app.vault.configDir}/plugins/chess-tree`;
    const missing: string[] = [];
    for (const file of [WASM_NAME, JS_NAME]) {
      const stat = await adapter.stat(`${baseDir}/${file}`);
      if (!stat || stat.type !== "file" || stat.size !== EXPECTED_SIZES[file]) {
        missing.push(file);
      }
    }
    return missing;
  }

  openDownloadModal(missingFiles: string[], corrupted = false): void {
    const files = missingFiles.map((f) => ({
      name: f,
      sources: DOWNLOAD_SOURCES.map((s) => ({
        key: s.key,
        label: s.label,
        url: s.getUrl(f),
      })),
    }));
    const modal = new DownloadModal(
      this.plugin!.app,
      corrupted ? t("engine.corrupted", 0) : t("engine.downloadFile", 0),
      files,
      t("engine.downloadBtn", 0),
      t("engine.downloadCancel", 0),
      t("engine.downloadSource", 0),
    );
    modal.setCallbacks(
      () => {
        const sourceKey = modal.getSelectedSource();
        const source =
          DOWNLOAD_SOURCES.find((s) => s.key === sourceKey) ??
          DOWNLOAD_SOURCES[0];
        const adapter = this.plugin!.app.vault.adapter;
        const baseDir = `${this.plugin!.app.vault.configDir}/plugins/chess-tree`;
        void (async () => {
          for (let i = 0; i < missingFiles.length; i++) {
            const file = missingFiles[i];
            const destPath = `${baseDir}/${file}`;
            const url = source.getUrl(file);
            modal.showProgress(i);
            try {
              const resp = await requestUrl({ url });
              if (file.endsWith(".wasm")) {
                await adapter.writeBinary(destPath, resp.arrayBuffer);
              } else {
                await adapter.write(destPath, resp.text);
              }
              hashVerified.delete(file);
              modal.done(i);
            } catch {
              modal.error(i, t("engine.downloadFailed", 0));
              return;
            }
          }
        })();
      },
      () => {},
    );
    modal.open();
  }

  /**
   * Read an engine asset and hash-verify it on first load this
   * session. A size-matched but corrupted file falls through
   * checkFileExists and is caught here, before the worker swallows
   * it as a cryptic wasm compile error; the download modal is opened
   * for the corrupted file instead.
   */
  private async readVerifiedAsset(name: string): Promise<ArrayBuffer> {
    const adapter = this.plugin!.app.vault.adapter;
    const baseDir = `${this.plugin!.app.vault.configDir}/plugins/chess-tree`;
    const buffer = await adapter.readBinary(`${baseDir}/${name}`);
    if (hashVerified.has(name) || !crypto.subtle) return buffer;
    if ((await sha256Hex(buffer)) === EXPECTED_SHA256[name]) {
      hashVerified.add(name);
      return buffer;
    }
    this.openDownloadModal([name], true);
    throw new Error(`Engine asset corrupted: ${name}`);
  }

  protected async initWorker(): Promise<void> {
    const wasmBuffer = await this.readVerifiedAsset(WASM_NAME);
    const stockfishJs = new TextDecoder().decode(
      await this.readVerifiedAsset(JS_NAME),
    );

    const workerCode = `
self.addEventListener('unhandledrejection', function(e) {
  self.postMessage({type:'error', data:'UNHANDLED:' + String(e.reason ? (e.reason.message || e.reason) : 'unknown')});
});

if (typeof global !== 'undefined' && global.process) {
  try { delete global.process; } catch(e) {
    try { global.process = undefined; } catch(e) {}
  }
}
if (typeof process !== 'undefined' && process.versions) {
  try { delete process.versions.node; } catch(e) {}
}

var _SF_WB_ = null;

self.onmessage = function(e) {
  if (e.data && e.data.type === 'wasm') {
    _SF_WB_ = new Uint8Array(e.data.buffer);
    self.onmessage = null;
    try {
      ${stockfishJs}
    } catch(e) {
      self.postMessage({type:'error', data:'SF_LOAD:' + e.message + '|' + (e.stack||'')});
    }
  }
};
`;

    const blobUrl = URL.createObjectURL(
      new Blob([workerCode], { type: "text/javascript" }),
    );
    this.worker = new Worker(blobUrl);
    URL.revokeObjectURL(blobUrl);

    return new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        this.initResolve = null;
        this.initReject = null;
        reject(new Error("Engine init timeout"));
      }, 120_000);

      this.initResolve = () => {
        window.clearTimeout(timeout);
        // Enable Chess960 castling semantics (king-takes-rook UCI moves,
        // X-FEN/Shredder castling FENs). Semantics for standard games are
        // unchanged, and this is re-sent on every worker init.
        this.worker!.postMessage("setoption name UCI_Chess960 value true");
        resolve();
      };
      this.initReject = (err: Error) => {
        window.clearTimeout(timeout);
        reject(err);
      };

      this.worker!.onmessage = (e: MessageEvent) => this.handleMessage(e.data);
      this.worker!.onerror = (err: ErrorEvent) => {
        window.clearTimeout(timeout);
        reject(new Error(err.message || "Engine error"));
      };

      this.worker!.postMessage({ type: "wasm", buffer: wasmBuffer }, [
        wasmBuffer,
      ]);
      this.worker!.postMessage("uci");
    });
  }
}

export const engine = new ChessEngine();
