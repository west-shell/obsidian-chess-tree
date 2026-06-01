import { MarkdownView, Notice } from "obsidian";
import { registerXQModule } from "../../core/module-system";
import type { IMove, IXQHost, PieceType } from "../../types";
import { genFENFromBoard, parseSource } from "../../utils/parse";
import { toSAN, makeMove } from "../../utils/rules";
import { ConfirmModal } from "../../utils/confirmModal";

const ActionsModule = {
    init(host: IXQHost) {
        const eventBus = host.eventBus;

        eventBus.on('runmove', (move) => {
            if (!move) return;
            if (!host.modified) host.modifiedStep = host.currentStep;
            host.modified = true;
            eventBus.emit('edithistory', move);
            runmove(host, move);
            eventBus.emit('updateUI', 'runmove');
        })

        eventBus.on('undo', () => {
            undo(host);
            eventBus.emit('updateUI', 'undo');
        })

        eventBus.on('redo', () => {
            redo(host);
            eventBus.emit('updateUI', 'redo');
        })

        eventBus.on('toStart', () => {
            while (host.currentStep != 0) {
                undo(host);
            }
            eventBus.emit('updateUI', 'toStart');
        })

        eventBus.on('toEnd', () => {
            const step = host.modified ? host.history.length : host.PGN.length;
            const dif = step - host.currentStep;
            for (let i = 0; i < dif; i++) {
                redo(host);
            }
            eventBus.emit('updateUI', 'toEnd');
        })

        eventBus.on('reset', () => {
            if (host.modified) {
                while (host.currentStep != 0) {
                    undo(host);
                }
                host.modified = false;
                host.history = [];
                if (host.modifiedStep) {
                    for (let i = 0; i < host.modifiedStep; i++) {
                        redo(host);
                    }
                }
                host.modifiedStep = null;
                eventBus.emit('updateUI', 'reset');
            } else {
                eventBus.emit('toStart');
            }
        })

        eventBus.on('save', async () => {
            let message = "";
            if (host.history.length === 0 && host.PGN.length === 0) {
                new Notice("History and PGN are empty, nothing to save!");
                return;
            }
            if (host.history.length === 0 && host.PGN.length > 0)
                message = "PGN is not empty. Clear it?";
            if (host.history.length > 0 && host.PGN.length === 0)
                message = "PGN is empty. Save history as PGN?";
            if (host.history.length > 0 && host.PGN.length > 0)
                message = "PGN is not empty. Overwrite?";
            const modal = new ConfirmModal(
                host.plugin.app,
                "Confirm Save",
                message,
                "Save",
                "Cancel",
            );

            modal.open();
            const userConfirmed = await modal.promise;

            if (userConfirmed) {
                await savePGN(host);
                new Notice("Saved successfully!");
            }
            eventBus.emit('updateUI', 'save');
        })

        eventBus.on('clickstep', (step) => {
            if (step === undefined) return;
            const dif = step - host.currentStep;
            if (dif === 0) return;
            if (dif > 0) {
                for (let i = 0; i < dif; i++) {
                    redo(host);
                }
            } else {
                for (let i = 0; i < -dif; i++) {
                    undo(host);
                }
            }
            eventBus.emit('updateUI');
        })

        eventBus.on('rotate', () => {
            if (!host.options) {
                host.options = { rotated: true };
            } else {
                host.options.rotated = !host.options.rotated;
            }
            eventBus.emit('updateUI', 'rotate');
        })
    }
}

registerXQModule('actions', ActionsModule);

function runmove(host: IXQHost, move: IMove) {
	const { from, to, promotion } = move;
	const { newBoard, newState } = makeMove(host.board, move, host.gameState);
	for (let x = 0; x < 8; x++) {
		for (let y = 0; y < 8; y++) {
			host.board[x][y] = newBoard[x][y];
		}
	}
	host.gameState = newState;
	host.currentStep++;
	host.currentTurn = newState.turn;
}

function undo(host: IXQHost) {
    host.markedPos = null
    if (host.history.length === 0 || host.currentStep <= 0) return;
    host.currentStep--;
    replayGameState(host);
}

function replayGameState(host: IXQHost) {
    const { board: initBoard, gameState: initGS } = parseSource(host.source);
    for (let x = 0; x < 8; x++) {
        for (let y = 0; y < 8; y++) {
            host.board[x][y] = initBoard[x][y];
        }
    }
    let gs = initGS;
    for (let i = 0; i < host.currentStep; i++) {
        const move = host.history[i];
        const result = makeMove(host.board, move, gs);
        for (let x = 0; x < 8; x++) {
            for (let y = 0; y < 8; y++) {
                host.board[x][y] = result.newBoard[x][y];
            }
        }
        gs = result.newState;
    }
    host.gameState = gs;
    host.currentTurn = gs.turn;
}

function redo(host: IXQHost) {
    host.markedPos = null;
    const eventBus = host.eventBus;
    if (!host.modified && host.PGN.length > 0) {
        const nextMove = host.PGN[host.currentStep];
        if (!nextMove) return;
        eventBus.emit('edithistory', nextMove);
        runmove(host, nextMove);
    } else {
        if (host.history.length < host.currentStep) return;
        const moveToRedo = host.history[host.currentStep];
        if (!moveToRedo) return;
        runmove(host, moveToRedo);
    }
}

async function savePGN(host: IXQHost) {
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

        // Remove all SAN move lines
        blockLines = blockLines.filter((line) => !/\b(O-O(?:-O)?|[KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](?:=[QRBN])?)\b/.test(line));

        if (host.currentStep > 0) {
            const moves = host.history
                .slice(0, host.currentStep)
                .map((move: IMove) => move.SAN ?? "");

            const pgnLines: string[] = [];
            for (let i = 0; i < moves.length; i += 2) {
                const line =
                    `${Math.ceil((i + 1) / 2)}. ${moves[i]} ${moves[i + 1] || ""}`.trim();
                pgnLines.push(line);
            }
            const PGN = pgnLines.join("\n");

            blockLines.splice(blockLines.length - 1, 0, PGN);
        }

        const newContent = [
            ...lines.slice(0, lineStart),
            ...blockLines,
            ...lines.slice(lineEnd + 1),
        ].join("\n");
        return newContent;
    });
}
