import type { Move } from "chess.js";
import { t, getLang } from "../i18n";

export function speak(move: Move) {
    const { san } = move;
    if (!san) return;
    const finalSpeech = san
        .replace(/O-O-O/g, t("speech.queensideCastle"))
        .replace(/O-O/g, t("speech.kingsideCastle"))
        .replace(/=([QRBN])/g, (_, piece) => `：${t("speech.promotesTo")}${t("speech.piece" + piece)}`)
        .replace(/\+/g, ` ${t("speech.check")}`)
        .replace(/\#/g, ` ${t("speech.checkmate")}`);

    if (!window.speechSynthesis) return;
    const utter = new SpeechSynthesisUtterance(finalSpeech);
    utter.lang = getLang() === "zh-cn" ? "zh-CN" : "en-US";
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utter);
}
