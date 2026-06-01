import GenFEN from "../../lib/GenFEN/GenFEN.svelte";
import { registerGenFENModule } from "../../core/module-system";
import { mount, unmount } from "svelte";

const BoardModule = {
    init(host: Record<string, any>) {
        const eventBus = host.eventBus;

        eventBus.on("load", () => {
            host.modified = false
            const Container = host.containerEl.createEl('div');
            host.Chess = mount(GenFEN, {
                target: Container,
                props: {
                    selectedPiece: host.selectedPiece,
                    settings: host.settings,
                    board: host.board,
                    markedPos: host.markedPos,
                    currentTurn: host.currentTurn,
                    eventBus: host.eventBus,
                },
            });
        })

        eventBus.on('updateUI', () => {
            host.Chess?.$set({
                selectedPiece: host.selectedPiece,
                settings: { ...host.settings },
                board: [...host.board.map(row => [...row])],
                markedPos: host.markedPos,
                currentTurn: host.currentTurn,
            });
        })

        eventBus.on("unload", () => {
            unmount(host.Chess)
        })
    }
}

registerGenFENModule('board', BoardModule);
