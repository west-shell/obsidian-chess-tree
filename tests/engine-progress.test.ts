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

describe("work queue (lila ceval Protocol semantics)", () => {
  test("superseding search waits for the old bestmove before starting", async () => {
    const engine = new FakeEngine();
    engine.boot();
    const first = engine.analyze("fen-a", 30);
    expect(engine.posted).toContain("go depth 30");

    // A second analysis parks in the queue; no position/go for it yet.
    const second = engine.analyze("fen-b", 10);
    expect(engine.posted).not.toContain("position fen fen-b");

    // The first search's bestmove resolves the first promise...
    engine.feed("info depth 1 score cp 30 multipv 1 pv e2e4");
    engine.feed("bestmove e2e4");
    const firstResult = await first;
    expect(firstResult.score).toBe(30);
    expect(firstResult.bestmove).toBe("e2e4");

    // ...and only then does the successor's search start.
    expect(engine.posted).toContain("position fen fen-b");
    expect(engine.posted).toContain("go depth 10");

    // The successor settles on ITS OWN data, never the stale bestmove.
    engine.feed("info depth 1 score cp 12 multipv 1 pv d2d4");
    engine.feed("bestmove d2d4");
    const secondResult = await second;
    expect(secondResult.score).toBe(12);
    expect(secondResult.bestmove).toBe("d2d4");
  });

  test("stop() resolves the running search with its partial result", async () => {
    const engine = new FakeEngine();
    engine.boot();
    const promise = engine.analyze("fen-a", 30);
    engine.feed("info depth 1 score cp 30 multipv 1 pv e2e4");
    engine.stop();
    expect(engine.posted).toContain("stop");
    // Idempotent: a second stop must not post "stop" again.
    const stopsBefore = engine.posted.filter((c) => c === "stop").length;
    engine.stop();
    expect(engine.posted.filter((c) => c === "stop").length).toBe(stopsBefore);

    engine.feed("bestmove e2e4");
    const result = await promise;
    expect(result.bestmove).toBe("e2e4");
    expect(result.score).toBe(30);

    // The engine is free again: a follow-up analysis starts immediately.
    const next = engine.analyze("fen-b", 5);
    expect(engine.posted).toContain("position fen fen-b");
    engine.feed("bestmove d2d4");
    await expect(next).resolves.toMatchObject({ bestmove: "d2d4" });
  });

  test("a queued analysis superseded before start is rejected", async () => {
    const engine = new FakeEngine();
    engine.boot();
    const first = engine.analyze("fen-a", 30);
    const queued = engine.analyze("fen-b", 10);
    const latest = engine.analyze("fen-c", 8);

    await expect(queued).rejects.toThrow("Analysis cancelled");

    engine.feed("bestmove e2e4");
    await expect(first).resolves.toMatchObject({ bestmove: "e2e4" });

    // The latest request is the one that runs after the drain.
    expect(engine.posted).toContain("position fen fen-c");
    expect(engine.posted).toContain("go depth 8");
    engine.feed("bestmove a2a3");
    await expect(latest).resolves.toMatchObject({ bestmove: "a2a3" });
  });

  test("stop() rejects a queued-but-not-started analysis", async () => {
    const engine = new FakeEngine();
    engine.boot();
    const first = engine.analyze("fen-a", 30);
    const queued = engine.analyze("fen-b", 10);
    engine.stop();
    await expect(queued).rejects.toThrow("Analysis cancelled");
    engine.feed("bestmove e2e4");
    await expect(first).resolves.toMatchObject({ bestmove: "e2e4" });
    expect(engine.posted).not.toContain("position fen fen-b");
  });
});
