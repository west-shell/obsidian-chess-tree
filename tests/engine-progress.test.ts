import { describe, expect, test, vi } from "vitest";

import {
  BaseEngine,
  type EngineProgress,
} from "../src/modules/Engine/BaseEngine";

// BaseEngine schedules its analysis watchdog via window.setTimeout; the
// node test environment has no window, so point it at the node globals
// (fake timers patch the same globals, keeping the watchdog testable).
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

  count(command: string): number {
    return this.posted.filter((c) => c === command).length;
  }
}

describe("analyze progress streaming", () => {
  test("streams a coherent snapshot when an iteration's last line arrived", async () => {
    const engine = new FakeEngine();
    engine.boot();
    const progress: EngineProgress[] = [];
    const promise = engine.analyze("8/8/8/8/8/8/8/8 w - - 0 1", 2, (p) =>
      progress.push(p),
    );
    expect(engine.posted).toContain("go movetime 300");

    engine.feed("info depth 1 score cp 30 multipv 1 pv e2e4");
    engine.feed("info depth 1 score cp 20 multipv 2 pv d2d4");
    engine.feed("info depth 2 score cp 35 multipv 1 pv e2e4 e7e5");
    engine.feed("info depth 2 score cp 25 multipv 2 pv d2d4 d7d5");
    // Bound-flagged lines are not exact: no snapshot, no score update.
    engine.feed("info depth 2 score cp 99 lowerbound multipv 1 pv a2a3");
    // Target depth reached with the full iteration in: early stop.
    expect(engine.posted).toContain("stop");
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
    const promise = engine.analyze("8/8/8/8/8/8/8/8 w - - 0 1", 1);
    engine.feed("info depth 1 score cp 10 multipv 1 pv e2e4");
    engine.feed("bestmove e2e4");
    const result = await promise;
    expect(result.score).toBe(10);
    expect(result.bestmove).toBe("e2e4");
  });

  test("ramp-up snapshots of a later slice do not walk the eval backwards", async () => {
    const engine = new FakeEngine();
    engine.boot();
    const progress: EngineProgress[] = [];
    const promise = engine.analyze("fen-a", 10, (p) => progress.push(p));

    // Slice 1 reaches depth 3 of 10 and ends without the target.
    engine.feed("info depth 3 score cp 20 multipv 1 pv e2e4");
    expect(progress).toHaveLength(1);
    engine.feed("bestmove e2e4");
    // No settle, no re-posted position: the next slice reuses the TT.
    expect(engine.count("position fen fen-a")).toBe(1);
    expect(engine.count("go movetime 300")).toBe(2);

    // Slice 2 ramps through the already-covered depth: suppressed.
    engine.feed("info depth 2 score cp 18 multipv 1 pv d2d4");
    expect(progress).toHaveLength(1);
    // Beyond the previous deepest depth: streams again.
    engine.feed("info depth 4 score cp 25 multipv 1 pv e2e4 e7e5");
    expect(progress).toHaveLength(2);
    expect(progress[1].depth).toBe(4);
    engine.feed("bestmove e2e4");

    // Slice 3 reaches the target: early stop and settle.
    engine.feed("info depth 10 score cp 30 multipv 1 pv e2e4");
    engine.feed("bestmove e2e4");
    const result = await promise;
    expect(result.depth).toBe(10);
    expect(result.bestmove).toBe("e2e4");
  });
});

describe("work queue (lila ceval Protocol semantics)", () => {
  test("superseding search waits for the old bestmove before starting", async () => {
    const engine = new FakeEngine();
    engine.boot();
    const first = engine.analyze("fen-a", 1);
    expect(engine.posted).toContain("go movetime 300");

    // A second analysis parks in the queue; no position/go for it yet.
    const second = engine.analyze("fen-b", 1);
    expect(engine.posted).not.toContain("position fen fen-b");

    // The first search's bestmove resolves the first promise...
    engine.feed("info depth 1 score cp 30 multipv 1 pv e2e4");
    engine.feed("bestmove e2e4");
    const firstResult = await first;
    expect(firstResult.score).toBe(30);
    expect(firstResult.bestmove).toBe("e2e4");

    // ...and only then does the successor's search start.
    expect(engine.posted).toContain("position fen fen-b");
    expect(engine.count("go movetime 300")).toBe(2);

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
    const stopsBefore = engine.count("stop");
    engine.stop();
    expect(engine.count("stop")).toBe(stopsBefore);

    engine.feed("bestmove e2e4");
    const result = await promise;
    expect(result.bestmove).toBe("e2e4");
    expect(result.score).toBe(30);

    // The engine is free again: a follow-up analysis starts immediately.
    const next = engine.analyze("fen-b", 5);
    expect(engine.posted).toContain("position fen fen-b");
    engine.feed("info depth 5 score cp 10 multipv 1 pv d2d4");
    engine.feed("bestmove d2d4");
    await expect(next).resolves.toMatchObject({ bestmove: "d2d4" });
  });

  test("a queued analysis superseded before start is rejected", async () => {
    const engine = new FakeEngine();
    engine.boot();
    const first = engine.analyze("fen-a", 1);
    const queued = engine.analyze("fen-b", 10);
    const latest = engine.analyze("fen-c", 8);

    await expect(queued).rejects.toThrow("Analysis cancelled");

    engine.feed("info depth 1 score cp 30 multipv 1 pv e2e4");
    engine.feed("bestmove e2e4");
    await expect(first).resolves.toMatchObject({ bestmove: "e2e4" });

    // The latest request is the one that runs after the drain.
    expect(engine.posted).toContain("position fen fen-c");
    expect(engine.posted).toContain("go movetime 300");
    engine.feed("info depth 8 score cp 20 multipv 1 pv a2a3");
    engine.feed("bestmove a2a3");
    await expect(latest).resolves.toMatchObject({ bestmove: "a2a3" });
  });

  test("stop() rejects a queued-but-not-started analysis", async () => {
    const engine = new FakeEngine();
    engine.boot();
    const first = engine.analyze("fen-a", 1);
    const queued = engine.analyze("fen-b", 10);
    engine.stop();
    await expect(queued).rejects.toThrow("Analysis cancelled");
    engine.feed("info depth 1 score cp 30 multipv 1 pv e2e4");
    engine.feed("bestmove e2e4");
    await expect(first).resolves.toMatchObject({ bestmove: "e2e4" });
    expect(engine.posted).not.toContain("position fen fen-b");
  });
});

describe("iterative-deepening slices (movetime chunks)", () => {
  test("continues slice by slice until the target depth is reached", async () => {
    const engine = new FakeEngine();
    engine.boot();
    const promise = engine.analyze("fen-a", 10);
    expect(engine.count("go movetime 300")).toBe(1);

    // Slice 1: depth 3 of 10 — next slice posted, promise still pending.
    engine.feed("info depth 3 score cp 20 multipv 1 pv e2e4");
    engine.feed("bestmove e2e4");
    expect(engine.count("go movetime 300")).toBe(2);
    expect(engine.count("position fen fen-a")).toBe(1);

    // Slice 2: same depth (TT-warm ramp only) — no progress doubles it.
    engine.feed("info depth 3 score cp 20 multipv 1 pv e2e4");
    engine.feed("bestmove e2e4");
    expect(engine.posted).toContain("go movetime 600");

    // Slice 3: target depth — early stop, settle on the bestmove.
    engine.feed("info depth 10 score cp 42 multipv 1 pv d2d4");
    expect(engine.posted).toContain("stop");
    engine.feed("bestmove d2d4");
    const result = await promise;
    expect(result.bestmove).toBe("d2d4");
    expect(result.depth).toBe(10);
    expect(result.score).toBe(42);
  });

  test("a proven mate settles without further slices", async () => {
    const engine = new FakeEngine();
    engine.boot();
    const promise = engine.analyze("fen-a", 30);
    // Mate in 3 is proven once depth 5 (2*3-1) is completed.
    engine.feed("info depth 5 score mate 3 multipv 1 pv e2e4 g8f6");
    expect(engine.posted).toContain("stop");
    engine.feed("bestmove e2e4");
    const result = await promise;
    expect(result.bestmove).toBe("e2e4");
    expect(result.scoreType).toBe("mate");
    expect(result.score).toBe(3);
    expect(result.depth).toBe(5);
  });

  test("a terminal bestmove settles immediately without another slice", async () => {
    const engine = new FakeEngine();
    engine.boot();
    const promise = engine.analyze("fen-a", 30);
    engine.feed("bestmove (none)");
    const result = await promise;
    expect(result.bestmove).toBe("(none)");
    expect(
      engine.posted.filter((c) => c.startsWith("go movetime")).length,
    ).toBe(1);
  });

  test("idle watchdog rejects a wedged engine, fed while output flows", async () => {
    vi.useFakeTimers();
    try {
      const engine = new FakeEngine();
      engine.boot();
      const promise = engine.analyze("fen-a", 30);

      // Info output keeps resetting the idle watchdog.
      engine.feed("info depth 5 score cp 20 multipv 1 pv e2e4");
      vi.advanceTimersByTime(30_000);
      engine.feed("info depth 6 score cp 21 multipv 1 pv e2e4");
      vi.advanceTimersByTime(30_000);

      // A full idle window without any output: reject with a timeout.
      vi.advanceTimersByTime(60_000);
      await expect(promise).rejects.toThrow("Analysis timeout");
    } finally {
      vi.useRealTimers();
    }
  });
});
