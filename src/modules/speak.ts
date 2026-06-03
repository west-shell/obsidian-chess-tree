import type { Move } from "chess.js";
import { t } from "../i18n";

export function speak(move: Move) {
    const { san } = move;
    if (!san) return;
    const finalSpeech = san
        .replace(/O-O-O/g, t("speech.queensideCastle"))
        .replace(/O-O/g, t("speech.kingsideCastle"))
        .replace(/\+/g, ` ${t("speech.check")}`)
        .replace(/\#/g, ` ${t("speech.checkmate")}`)
        .replace(/=/g, ` ${t("speech.promotesTo")} `);

    if (!window.speechSynthesis) return;
    const utter = new SpeechSynthesisUtterance(finalSpeech);
    utter.lang = "en-US";
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utter);
}
