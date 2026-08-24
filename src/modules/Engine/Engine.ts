import { DownloadModal } from "../../utils/confirmModal";
import { requestUrl } from "obsidian";
import { t } from "../../i18n";
import { BaseEngine, type EngineResult } from "./BaseEngine";

export type { EngineResult };

const WASM_NAME = "stockfish.wasm";
const JS_NAME = "stockfish.js";
const BASE_GITHUB =
  "https://raw.githubusercontent.com/west-shell/obsidian-chess-tree/main/assets/stockfish";
const BASE_GITEE_RELEASE =
  "https://gitee.com/wesnell/obsidian-chess-tree/releases/download/stockfish";

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
    if (!(await adapter.exists(`${baseDir}/${WASM_NAME}`)))
      missing.push(WASM_NAME);
    if (!(await adapter.exists(`${baseDir}/${JS_NAME}`))) missing.push(JS_NAME);
    return missing;
  }

  openDownloadModal(missingFiles: string[]): void {
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
      t("engine.downloadFile", 0),
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

  protected async initWorker(): Promise<void> {
    const adapter = this.plugin!.app.vault.adapter;
    const baseDir = `${this.plugin!.app.vault.configDir}/plugins/chess-tree`;
    const wasmBuffer = await adapter.readBinary(`${baseDir}/${WASM_NAME}`);
    const stockfishJs = await adapter.read(`${baseDir}/${JS_NAME}`);

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
