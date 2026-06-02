import { MarkdownView, Notice } from "obsidian";
import { registerGenFENModule } from "../../core/module-system";
import type { IBoard, IGenFENHost, ITurn, PieceType } from "../../types";
import { genFENFromBoard } from "../../utils/parse";
import { t } from "../../i18n";

const ActionsModule = {
    init(host: IGenFENHost) {
        const eventBus = host.eventBus;

        eventBus.on("clickPieceBTN", (piece: PieceType) => {
            if (!piece) return;
            host.markedPos = null;
            host.selectedPiece = piece;
            host.eventBus.emit('updateUI');
        })

        eventBus.on("btn-click", (action) => {
            if (!action) return;
            switch (action) {
                case 'turn':
                    host.currentTurn = host.currentTurn === 'white' ? 'black' : 'white';
                    break
                case 'empty':
                    host.board = Array.from({ length: 8 }, () => Array(8).fill(null));
                    host.board[4][0] = 'k';
                    host.board[4][7] = 'K';
                    host.selectedPiece = null
                    host.markedPos = null;
                    break
                case 'full':
                    host.eventBus.emit('full');
                    host.selectedPiece = null
                    host.markedPos = null;
                    break
                case 'save':
                    onSaveBTNClick(host);
                    break
            }
            eventBus.emit('updateUI');
        })
    }
}

registerGenFENModule('actions', ActionsModule)

async function onSaveBTNClick(host: IGenFENHost) {
    const fen = genFENFromBoard(host.board, host.currentTurn);
    const view = host.plugin.app.workspace.getActiveViewOfType(MarkdownView);
    if (!view) return;
    const file = view.file;
    if (!file) return;

    host.plugin.app.vault.process(file, fileContent => {
        const section = host.ctx.getSectionInfo(host.containerEl);
        if (!section) return fileContent;
        const { lineStart, lineEnd } = section;

        const lines = fileContent.split("\n");

        let blockLines: string[] = lines.slice(lineStart, lineEnd + 1);
        if (blockLines.length < 2) return fileContent;

        // Replace code block type from chessboard to chess and insert FEN
        blockLines[0] = blockLines[0].replace(/^```fen\b.*$/, "```chess");
        blockLines = [blockLines[0], `[FEN "${fen}"]`, "```"];

        const newContent = [
            ...lines.slice(0, lineStart),
            ...blockLines,
            ...lines.slice(lineEnd + 1),
        ].join("\n");

        return newContent;
    });
    new Notice(t("notice.fenSaved"));
}
