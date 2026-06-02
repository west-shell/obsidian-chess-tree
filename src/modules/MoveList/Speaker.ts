import { registerXQModule } from "../../core/module-system";
import type { Move } from "chess.js";
import type { IXQHost } from "../../types";

const SpeakerModule = {
    init(host: IXQHost) {
        const eventBus = host.eventBus;

        eventBus.on('updateUI', () => {
            if (
                host.settings.enableSpeech &&
                window.speechSynthesis &&
                host.currentStep > 0 &&
                host.history[host.currentStep - 1]
            ) {
                speak(host.history[host.currentStep - 1]);
            }
        })
    }
}

registerXQModule('speech', SpeakerModule);

function speak(move: Move) {
    const { san } = move;
    if (!san) return;
    const finalSpeech = san
        .replace(/O-O-O/g, "queenside castle")
        .replace(/O-O/g, "kingside castle")
        .replace(/\+/g, " check")
        .replace(/\#/g, " checkmate")
        .replace(/=/g, " promotes to ");

    if (!window.speechSynthesis) return;
    const utter = new SpeechSynthesisUtterance(finalSpeech);
    utter.lang = "en-US";
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utter);
}
