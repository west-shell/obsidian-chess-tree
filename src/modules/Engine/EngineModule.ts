import type { ITreeHost, IPGNViewHost, NodeEval } from "../../types";
import { registerTreeModule, registerPGNViewModule } from "../../core/module-system";
import { engine } from "./Engine";

function initEngine(host: object) {
  const h = host as ITreeHost | IPGNViewHost;
  engine.setPlugin(h.plugin);
  const { eventBus, settings } = h;

  let analyzing = false;
  let lastResult: { bestmove: string; ponder?: string; score?: number; depth?: number; scoreType?: 'cp' | 'mate' } | null = null;

  function applyOptions() {
    engine.postCommand(`setoption name Skill Level value ${settings.engineSkillLevel}`);
    engine.postCommand(`setoption name Ponder value false`);
    engine.postCommand(`setoption name Hash value 16`);
  }

  eventBus.on<import("../../chess").Move>("runmove", (move) => {
    if (!move || !lastResult) return;
    const moveUci = move.from + move.to;
    if (moveUci === lastResult.bestmove.slice(0, 4)) {
      if (lastResult.ponder) {
        const ponderMove = lastResult.ponder;
        lastResult = { bestmove: ponderMove, score: lastResult.score, depth: lastResult.depth, scoreType: lastResult.scoreType };
        eventBus.emit("engine-result", lastResult);
      } else {
        lastResult = null;
        eventBus.emit("engine-result", null);
      }
    } else {
      lastResult = null;
      eventBus.emit("engine-result", null);
    }
  });

  eventBus.on("engine-analyze", async (fen?: string) => {
    if (analyzing) return;
    analyzing = true;
    try {
      await engine.ensureReady();
      applyOptions();
      const result = await engine.analyze(fen ?? h.currentNode.fen, settings.engineDepth);
      if (result && result.score != null) {
        const nodeEval: NodeEval = {
          score: result.score,
          scoreType: result.scoreType ?? 'cp',
          depth: result.depth ?? 0,
        };
        const node = h.nodeMap.get(h.currentNode.id);
        if (node) {
          node.eval = nodeEval;
          h.currentNode = node;
        }
        lastResult = result;
        eventBus.emit("engine-result", result);
        h.eventBus.emit("modified", null);
        h.eventBus.emit("updateUI");
        return;
      }
      eventBus.emit("engine-result", result);
    } catch (err) {
      console.error("[Engine] analysis failed:", err);
      eventBus.emit("engine-result", null);
    } finally {
      analyzing = false;
    }
  });

  eventBus.on("engine-analyze-batch", async () => {
    if (analyzing) return;
    analyzing = true;
    try {
      await engine.ensureReady();
      applyOptions();
      const queue: string[] = [];
      const nodeMap = h.nodeMap;
      for (const [, node] of nodeMap) {
        if (!node.eval || node.eval.depth < settings.engineDepth) {
          queue.push(node.id);
        }
      }
      for (const nodeId of queue) {
        const node = nodeMap.get(nodeId);
        if (!node) continue;
        try {
          const result = await engine.analyze(node.fen, settings.engineDepth);
          if (result && result.score != null) {
            node.eval = {
              score: result.score,
              scoreType: result.scoreType ?? 'cp',
              depth: result.depth ?? 0,
            };
          }
        } catch {
          break;
        }
      }
      h.eventBus.emit("modified", null);
      h.eventBus.emit("updateUI");
      h.eventBus.emit("engine-batch-done");
    } finally {
      analyzing = false;
    }
  });

  eventBus.on("engine-stop", () => {
    engine.stop();
    analyzing = false;
    lastResult = null;
  });

  eventBus.on("clear-engine-bestmove", () => {
    lastResult = null;
  });

  eventBus.on("unload", () => {
    engine.terminate();
  });

  return {
    destroy() {
      engine.terminate();
    },
  };
}

registerTreeModule("engine", { init: initEngine });
registerPGNViewModule("engine", { init: initEngine });
