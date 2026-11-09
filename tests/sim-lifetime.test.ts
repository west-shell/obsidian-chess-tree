import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { Chess, type Move } from "../src/chess";
import { EventBus } from "../src/core/event-bus";
import type { ChessNode, IHost, ISettings } from "../src/types";

// The engine singleton is mocked: analyze resolves on the fake-timer
// schedule so the sim's wait/retry loop is fully controllable.
const analyzeMock = vi.hoisted(() => vi.fn());
const engineMock = vi.hoisted(() => ({
  setPlugin: vi.fn(),
  isReady: () => true,
  generation: 1,
  postCommand: vi.fn(),
  stop: vi.fn(),
  terminate: vi.fn(),
  ensureReady: vi.fn(async () => {}),
  checkFileExists: vi.fn(async () => []),
  openDownloadModal: vi.fn(),
  analyze: analyzeMock,
}));

vi.mock("../src/modules/Engine/Engine", () => ({
  engine: engineMock,
  ChessEngine: class {},
}));
vi.mock("obsidian", () => ({ Notice: class {} }));

const { EngineModule } = await import("../src/modules/Engine/EngineModule");

vi.stubGlobal("window", globalThis);

function makeSettings(): ISettings {
  return {
    engineDepth: 15,
    engineSkillLevel: 10,
    engineGhostLines: 3,
    engineGhostDepth: 5,
    engineSimInterval: 1,
    showEngineGhosts: false,
    showEngineAnnotations: false,
    savePrompt: false,
    saveEvalByDefault: false,
  } as unknown as ISettings;
}

function makeHost(): IHost {
  const chess = new Chess();
  const root: ChessNode = {
    id: "node-root",
    fen: chess.fen(),
    move: null,
    color: null,
    children: [],
    comments: [],
  };
  const nodeMap = new Map<string, ChessNode>([["node-root", root]]);
  const host = {
    plugin: {},
    settings: makeSettings(),
    generation: 0,
    nodeMap,
    currentNode: root,
    root,
    parser: { nodeId: 1 },
    games: [],
    currentGameIndex: 0,
    tags: "",
    pathChoices: new Map<string, number>(),
    currentPath: ["node-root"],
    stringifyPGN: () => "",
  } as unknown as IHost;
  host.eventBus = new EventBus(host);
  return host;
}

/** Minimal stand-in for NavigateModule's runmove handler: create or match
 * the child node so the sim sees the new position, like the real host. */
function wireFakeNavigate(host: IHost): void {
  host.eventBus.on<Move>("runmove", (move) => {
    if (!move) return;
    const parent = host.currentNode;
    const existing = parent.children.find(
      (c) =>
        c.move &&
        c.move.from === move.from &&
        c.move.to === move.to &&
        c.move.promotion === move.promotion,
    );
    if (existing) {
      host.currentNode = existing;
      return;
    }
    const node: ChessNode = {
      id: `node-${host.parser.nodeId++}`,
      fen: move.after,
      move,
      color: move.color === "w" ? "white" : "black",
      parentID: parent.id,
      children: [],
      comments: [],
    };
    parent.children.push(node);
    host.nodeMap.set(node.id, node);
    host.currentNode = node;
    host.eventBus.emit("updateUI");
  });
}

/** Resolves analyze after `ms` of fake time with the engine's best move. */
function fakeAnalyzeAfter(ms: number, uci: string): void {
  analyzeMock.mockImplementation(
    () =>
      new Promise((resolve) => {
        window.setTimeout(() => {
          resolve({
            bestmove: uci,
            score: 30,
            scoreType: "cp",
            depth: 15,
          });
        }, ms);
      }),
  );
}

function readSimState(host: IHost): { white: boolean; black: boolean } | null {
  let latest: { white: boolean; black: boolean } | null = null;
  host.eventBus.on("engine-sim-state", (s) => {
    latest = s as { white: boolean; black: boolean };
  });
  host.eventBus.emit("request-engine-state");
  return latest;
}

describe("engine simulation lifetime", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    analyzeMock.mockReset();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  test("sim survives while an auto-analysis blocks the engine (repro)", async () => {
    const host = makeHost();
    wireFakeNavigate(host);
    EngineModule.init(host);

    // Engine plays black. Its own search replies within 300 ms.
    fakeAnalyzeAfter(300, "e7e5");
    host.eventBus.emit("engine-sim-toggle", "black");
    // Auto-analyze on (idle for now: same node already "analyzed").
    host.eventBus.emit("engine-auto-toggle");

    // Human plays 1. e4. The runmove handler re-fires auto-analyze on the
    // new node — its full-depth search occupies the engine for 5 s.
    host.eventBus.emit("engine-analyze", true); // root analyzed already
    fakeAnalyzeAfter(5000, "e7e5"); // subsequent searches take 5 s
    const humanMove = new Chess().move("e4");
    host.eventBus.emit("runmove", humanMove);
    await vi.advanceTimersByTimeAsync(0);

    // Sim tick at 1 s: engine's turn (black) but the auto-analysis is
    // running — the sim must wait, retrying every 500 ms.
    await vi.advanceTimersByTimeAsync(1000); // retry 1
    await vi.advanceTimersByTimeAsync(500); // retry 2
    await vi.advanceTimersByTimeAsync(500); // retry 3

    // Three wait-retries on the same position must NOT be read as
    // threefold repetition: the sim has to stay armed.
    expect(readSimState(host)?.black).toBe(true);

    // Once the auto-analysis finishes, the sim must actually reply:
    // its own search runs, then 1... e5 lands on the board.
    await vi.advanceTimersByTimeAsync(5000); // auto-analysis settles
    await vi.advanceTimersByTimeAsync(6000); // sim search + reply tick
    expect((host.currentNode as ChessNode | null)?.move?.san).toBe("e5");
    expect(readSimState(host)?.black).toBe(true);
  });
});
