import stockfishJs from "../../engine/stockfish.txt?raw";

export interface EngineResult {
  bestmove: string;
  score?: number;
  depth?: number;
  scoreType?: 'cp' | 'mate';
}

type UciHandler = (msg: string) => void;

export class ChessEngine {
  private worker: Worker | null = null;
  private ready = false;
  private plugin: any = null;
  private msgHandler: UciHandler | null = null;
  private initResolve: ((value: void) => void) | null = null;
  private initReject: ((reason: Error) => void) | null = null;

  setPlugin(plugin: any): void {
    this.plugin = plugin;
  }

  async ensureReady(): Promise<void> {
    if (this.worker && this.ready) return;
    this.terminate();
    await this.initWorker();
  }

  private async initWorker(): Promise<void> {
    const adapter = this.plugin.app.vault.adapter;
    const baseDir = `${this.plugin.app.vault.configDir}/plugins/chess-tree`;

    const wasmBuffer = await adapter.readBinary(`${baseDir}/stockfish-18-lite-single.wasm`) as ArrayBuffer;
    const wasmBase64 = this.arrayBufferToBase64(wasmBuffer);

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

var _SF_WB_ = (function() {
  var b = atob('${wasmBase64}'), a = new Uint8Array(b.length), i;
  for (i = 0; i < b.length; i++) a[i] = b.charCodeAt(i);
  return a;
})();

try {
  ${stockfishJs}
} catch(e) {
  self.postMessage({type:'error', data:'SF_LOAD:' + e.message + '|' + (e.stack||'')});
}
`;

    const blobUrl = URL.createObjectURL(new Blob([workerCode], { type: 'text/javascript' }));
    this.worker = new Worker(blobUrl);
    URL.revokeObjectURL(blobUrl);

    return new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        this.initResolve = null;
        this.initReject = null;
        reject(new Error('Engine init timeout'));
      }, 60_000);

      this.initResolve = () => { window.clearTimeout(timeout); resolve(); };
      this.initReject = (err: Error) => { window.clearTimeout(timeout); reject(err); };

      this.worker!.onmessage = (e: MessageEvent) => this.handleMessage(e.data);
      this.worker!.onerror = (err: ErrorEvent) => {
        window.clearTimeout(timeout);
        reject(new Error(err.message || 'Engine error'));
      };

      this.worker!.postMessage('uci');
    });
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    const chunks: string[] = [];
    for (let i = 0; i < bytes.length; i += 0x8000) {
      const slice = bytes.subarray(i, Math.min(i + 0x8000, bytes.length));
      let chunk = '';
      for (let j = 0; j < slice.length; j++) chunk += String.fromCharCode(slice[j]);
      chunks.push(chunk);
    }
    return btoa(chunks.join(''));
  }

  private handleMessage(raw: unknown): void {
    if (raw && typeof raw === 'object' && (raw as Record<string, unknown>).type) {
      const obj = raw as Record<string, string>;
      if (obj.type === 'error') {
        this.initReject?.(new Error(obj.data));
        this.initResolve = null;
        this.initReject = null;
      }
      return;
    }

    if (typeof raw !== 'string') return;
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      if (trimmed === 'uciok') {
        this.ready = true;
        this.initResolve?.();
        this.initResolve = null;
        this.initReject = null;
      } else {
        this.msgHandler?.(trimmed);
      }
    }
  }

  analyze(fen: string, depth = 15): Promise<EngineResult> {
    return new Promise((resolve, reject) => {
      if (!this.worker || !this.ready) {
        reject(new Error('Engine not ready'));
        return;
      }

      let lastScore: number | undefined;
      let lastDepth: number | undefined;
      let lastScoreType: 'cp' | 'mate' | undefined;

      this.msgHandler = (msg: string) => {
        if (msg.startsWith('info')) {
          const mateMatch = msg.match(/score mate (-?\d+)/);
          if (mateMatch) {
            lastScoreType = 'mate';
            lastScore = Number.parseInt(mateMatch[1]);
          } else {
            const cpMatch = msg.match(/score cp (-?\d+)/);
            if (cpMatch) {
              lastScoreType = 'cp';
              lastScore = Number.parseInt(cpMatch[1]);
            }
          }
          const depthMatch = msg.match(/depth (\d+)/);
          if (depthMatch) lastDepth = Number.parseInt(depthMatch[1]);
        } else if (msg.startsWith('bestmove')) {
          const bestmove = msg.split(' ')[1];
          this.msgHandler = null;
          if (bestmove && bestmove !== '(none)') {
            resolve({ bestmove, score: lastScore, depth: lastDepth, scoreType: lastScoreType });
          } else {
            reject(new Error('No move found'));
          }
        }
      };

      this.worker.postMessage(`position fen ${fen}`);
      this.worker.postMessage(`go depth ${depth}`);
    });
  }

  postCommand(cmd: string): void {
    if (this.worker && this.ready) {
      this.worker.postMessage(cmd);
    }
  }

  stop(): void {
    if (this.worker && this.ready) {
      this.worker.postMessage('stop');
    }
  }

  terminate(): void {
    if (this.worker) {
      try { this.worker.postMessage('quit'); } catch { /* ignore */ }
      this.worker.terminate();
      this.worker = null;
    }
    this.ready = false;
    this.msgHandler = null;
    this.initResolve = null;
    this.initReject = null;
  }
}

export const engine = new ChessEngine();
