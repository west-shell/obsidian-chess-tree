import { MarkdownView, Notice } from "obsidian";

import { registerGenFENModule } from "../../core/module-system";
import { t } from "../../i18n";
import { DEFAULT_FEN, type IGenFENHost } from "../../types";
import type { Piece } from "../../chess";

function setBoardOnly(host: IGenFENHost, boardPart: string): void {
  const parts = host.fen.split(" ");
  parts[0] = boardPart;
  host.fen = parts.join(" ");
}

function setFullStartPosition(host: IGenFENHost): void {
  host.fen = DEFAULT_FEN;
}

type BtnAction =
  | string
  | { action: "setPreset"; fen?: string }
  | { action: "setFen"; fen?: string };

const ActionsModule = {
  init(host: IGenFENHost) {
    const eventBus = host.eventBus;

    eventBus.on<Piece>("clickPieceBTN", (piece) => {
      if (!piece) return;
      if (
        host.selectedPiece &&
        host.selectedPiece.type === piece.type &&
        host.selectedPiece.color === piece.color
      ) {
        host.selectedPiece = null;
      } else {
        host.selectedPiece = piece;
      }
      eventBus.emit("updateUI", host.fen);
    });

    eventBus.on<{ turn: string; castling: string; enPassant: string }>(
      "saveFen",
      (meta) => {
        if (!meta) return;
        void onSaveBTNClick(host, meta);
      },
    );

    eventBus.on<BtnAction>("btn-click", (action) => {
      if (!action) return;

      if (typeof action === "string") {
        switch (action) {
          case "empty":
            setBoardOnly(host, "4k3/8/8/8/8/8/8/4K3");
            host.selectedPiece = null;
            break;
          case "full":
            setFullStartPosition(host);
            host.selectedPiece = null;
            break;
          case "save":
            break;
          case "start":
            setFullStartPosition(host);
            host.selectedPiece = null;
            break;
        }
        eventBus.emit("updateUI", host.fen);
        return;
      }

      switch (action.action) {
        case "setPreset": {
          const fenStr = action.fen;
          if (fenStr) {
            host.fen = fenStr;
            host.selectedPiece = null;
          }
          break;
        }
        case "setFen": {
          const newFen = action.fen;
          if (newFen) {
            host.fen = newFen;
          }
          break;
        }
      }
      eventBus.emit("updateUI", host.fen);
    });
  },
};

registerGenFENModule("actions", ActionsModule);

async function onSaveBTNClick(
  host: IGenFENHost,
  meta: { turn: string; castling: string; enPassant: string },
) {
  const view = host.plugin.app.workspace.getActiveViewOfType(MarkdownView);
  if (!view) return;
  const file = view.file;
  if (!file) return;

  const boardPart = host.fen.split(" ")[0];
  const fullFen = `${boardPart} ${meta.turn} ${meta.castling} ${meta.enPassant} 0 1`;

  void host.plugin.app.vault.process(file, (fileContent) => {
    const section = host.ctx.getSectionInfo(host.containerEl);
    if (!section) return fileContent;
    const { lineStart, lineEnd } = section;

    const lines = fileContent.split("\n");

    let blockLines: string[] = lines.slice(lineStart, lineEnd + 1);
    if (blockLines.length < 2) return fileContent;

    blockLines[0] = blockLines[0].replace(/^```\S+\b.*$/, `\`\`\`tree`);
    blockLines = [blockLines[0], `[FEN "${fullFen}"]`, "```"];

    const newContent = [
      ...lines.slice(0, lineStart),
      ...blockLines,
      ...lines.slice(lineEnd + 1),
    ].join("\n");

    return newContent;
  });
  new Notice(t("notice.fenSaved"));
}
