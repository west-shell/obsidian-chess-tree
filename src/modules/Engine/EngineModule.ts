import type { ITreeHost, IPGNViewHost, NodeEval } from "../../types";
import { registerTreeModule, registerPGNViewModule } from "../../core/module-system";
import { engine } from "./Engine";

function initEngine(host: object) {
  const h = host as ITreeHost | IPGNViewHost;
  engine.setPlugin(h.plugin);
  const { eventBus, settings } = h;

  let analyzing = false;

  eventBus.on("engine-analyze", async (fen?: string) => {
    if (analyzing) return;
    analyzing = true;
    try {
      await engine.ensureReady();
      engine.postCommand(`setoption name Skill Level value ${settings.engineSkillLevel}`);
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
      engine.postCommand(`setoption name Skill Level value ${settings.engineSkillLevel}`);
      const queue: string[] = [];
      const nodeMap = h.nodeMap;
      for (const [, node] of nodeMap) {
        if (!node.eval) {
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
