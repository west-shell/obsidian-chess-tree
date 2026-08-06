import { Chess, type Square } from "../chess";
import {
  registerPGNViewModule,
  registerTreeModule,
} from "../core/module-system";
import type { IPGNViewHost, ITreeHost } from "../types";

type TryMovePayload = { from: Square; to: Square };

function isPromotionRank(to: string, color: "w" | "b"): boolean {
  return (color === "w" && to[1] === "8") || (color === "b" && to[1] === "1");
}

function tryMove(
  chess: Chess,
  host: ITreeHost | IPGNViewHost,
  from: Square,
  to: Square,
): void {
  const eventBus = host.eventBus;
  try {
    chess.load(host.fen);
    const piece = chess.get(from);
    const color = piece?.color;
    if (piece?.type === "p" && color && isPromotionRank(to, color)) {
      const moves = chess.moves({ square: from, verbose: true });
      const promoMoves = moves.filter((m) => m.to === to && m.promotion);
      if (promoMoves.length > 0) {
        host.markedPos = null;
        eventBus.emit("promote", { from, to, color });
        return;
      }
    }
    const move = chess.move({ from, to });
    if (move) {
      host.markedPos = null;
      eventBus.emit("runmove", move);
    } else {
      host.markedPos = to;
      eventBus.emit("updateUI");
    }
  } catch {
    host.markedPos = null;
    eventBus.emit("updateUI");
  }
}

const BoardClickModule = {
  init(host: ITreeHost | IPGNViewHost) {
    const eventBus = host.eventBus;
    const chess = new Chess();

    eventBus.on<Square>("click", (clickedKey) => {
      if (!clickedKey) return;
      if (!host.markedPos) {
        host.markedPos = clickedKey;
        eventBus.emit("updateUI");
        return;
      }
      tryMove(chess, host, host.markedPos, clickedKey);
    });

    eventBus.on<TryMovePayload>("trymove", (payload) => {
      if (!payload) return;
      tryMove(chess, host, payload.from, payload.to);
    });
  },
};

registerPGNViewModule("BoardClick", BoardClickModule);
registerTreeModule("BoardClick", BoardClickModule);
