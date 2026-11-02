import { describe, expect, test, vi } from "vitest";

import {
  BaseEngine,
  type EngineProgress,
} from "../src/modules/Engine/BaseEngine";

// BaseEngine schedules its analysis watchdog via window.setTimeout; the
// node test environment has no window, so point it at the node globals.
vi.stubGlobal("window", window);

class FakeEngine extends BaseEngine {
  posted: string[] = [];

  async checkFileExists(): Promise<string[]> {
    return [];
  }

  openDownloadModal(): void {}

  protected async initWorker(): Promise<void> {}

  boot(): void {
    this.worker = {
      postMessage: (msg: unknown) => {
        this.posted.push(String(msg));
      },
    } as unknown as Worker;
    this.ready = true;
  }

  feed(line: string): void {
    this.handleMessage(line);
  }
}

describe("analyze progress streaming", () => {
  test("streams a coherent snapshot when an iteration's last line arrived", async () => {
    const engine = new FakeEngine();
    engine.boot();
    const progress: EngineProgress[] = [];
    const promise = engine.analyze("8/8/8/8/8/8/8/8 w - - 0 1", 30, (p) =>
      progress.push(p),
    );
    expect(engine.posted).toContain("go depth 30");

    engine.feed("info depth 1 score cp 30 multipv 1 pv e2e4");
    engine.feed("info depth 1 score cp 20 multipv 2 pv d2d4");
    engine.feed("info depth 2 score cp 35 multipv 1 pv e2e4 e7e5");
    engine.feed("info depth 2 score cp 25 multipv 2 pv d2d4 d7d5");
    // Bound-flagged lines are not exact: no snapshot, no score update.
    engine.feed("info depth 2 score cp 99 lowerbound multipv 1 pv a2a3");
    engine.feed("bestmove e2e4 ponder e7e5");

    const result = await promise;
    // mpv-1 of depth 1: iteration complete (only one pv known yet).
    expect(progress[0]).toEqual({
      score: 30,
      scoreType: "cp",
      depth: 1,
      pvs: [{ score: 30, scoreType: "cp", moves: ["e2e4"] }],
    });
    // mpv-2 of depth 1: full iteration snapshot — same depth for both.
    expect(progress[1]).toEqual({
      score: 30,
      scoreType: "cp",
      depth: 1,
      pvs: [
        { score: 30, scoreType: "cp", moves: ["e2e4"] },
        { score: 20, scoreType: "cp", moves: ["d2d4"] },
      ],
    });
    // Depth 2's mpv-1 line alone does not emit; the mpv-2 line completes
    // the iteration, and the snapshot's primary score is the mpv-1 score.
    expect(progress).toHaveLength(3);
    expect(progress[2]).toEqual({
      score: 35,
      scoreType: "cp",
      depth: 2,
      pvs: [
        { score: 35, scoreType: "cp", moves: ["e2e4", "e7e5"] },
        { score: 25, scoreType: "cp", moves: ["d2d4", "d7d5"] },
      ],
    });
    // The final result carries bestmove/ponder plus the full iteration.
    expect(result.bestmove).toBe("e2e4");
    expect(result.ponder).toBe("e7e5");
    expect(result.score).toBe(35);
    expect(result.depth).toBe(2);
    expect(result.pvs).toEqual([
      { score: 35, scoreType: "cp", moves: ["e2e4", "e7e5"] },
      { score: 25, scoreType: "cp", moves: ["d2d4", "d7d5"] },
    ]);
  });

  test("works without a progress callback", async () => {
    const engine = new FakeEngine();
    engine.boot();
    const promise = engine.analyze("8/8/8/8/8/8/8/8 w - - 0 1", 5);
    engine.feed("info depth 1 score cp 10 multipv 1 pv e2e4");
    engine.feed("bestmove e2e4");
    const result = await promise;
    expect(result.score).toBe(10);
    expect(result.bestmove).toBe("e2e4");
  });
});
