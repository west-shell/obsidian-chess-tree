import type { Move } from "../chess";
import { getLang, t } from "../i18n";

const PIECE_SPEECH_KEYS: Record<string, string> = {
  K: "speech.pieceK",
  Q: "speech.pieceQ",
  R: "speech.pieceR",
  B: "speech.pieceB",
  N: "speech.pieceN",
};

export function speak(move: Move) {
  const { san } = move;
  if (!san) return;
  const isZh = getLang() === "zh-cn";
  const finalSpeech = san
    .replace(/O-O-O/g, t("speech.queensideCastle"))
    .replace(/O-O/g, t("speech.kingsideCastle"))
    .replace(/^[KQRBN]/, (m) =>
      isZh ? t(PIECE_SPEECH_KEYS[m]) : t(PIECE_SPEECH_KEYS[m]),
    )
    .replace(
      /=([QRBN])/g,
      (_, piece) => ` ${t("speech.promotesTo")} ${t("speech.piece" + piece)}`,
    )
    .replace(/\+/g, ` ${t("speech.check")}`)
    .replace(/#/g, ` ${t("speech.checkmate")}`);

  if (!window.speechSynthesis) return;
  const utter = new SpeechSynthesisUtterance(finalSpeech);
  utter.lang = isZh ? "zh-CN" : "en-US";
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utter);
}
