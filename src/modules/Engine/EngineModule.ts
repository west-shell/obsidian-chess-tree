import type { ITreeHost, IPGNViewHost } from "../../types";
import { registerTreeModule, registerPGNViewModule } from "../../core/module-system";
import { engine } from "./Engine";

function initEngine(host: object) {
  const h = host as ITreeHost | IPGNViewHost;
  engine.setPlugin(h.plugin);
  const { eventBus, settings } = h;

  let analyzing = false;

  eventBus.on("engine-analyze", async (fen: string) => {
    if (analyzing) return;
    analyzing = true;
    try {
      await engine.ensureReady();
      engine.postCommand(`setoption name Skill Level value ${settings.engineSkillLevel}`);
      const result = await engine.analyze(fen, settings.engineDepth);
      eventBus.emit("engine-result", result);
    } catch (err) {
      console.error("[Engine] analysis failed:", err);
      eventBus.emit("engine-result", null);
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
