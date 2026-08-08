<script lang="ts">
  import type { EventBus } from "../../core/event-bus";
  import { onLangChange, t } from "../../i18n";
  import { onMount } from "svelte";

  interface Props {
    eventBus: EventBus;
    fen: string;
  }
  let { eventBus, fen }: Props = $props();

  let _lv = $state(0);
  onLangChange(() => _lv++);

  // 从完整 FEN 解析一次作为本地状态初始值
  function parseFen(fen: string) {
    const parts = fen.split(" ");
    return {
      turn: (parts[1] || "w") as string,
      castling: (parts[2] || "-") as string,
      enPassant: (parts[3] || "-") as string,
    };
  }

  // svelte-ignore state_referenced_locally
  const initial = parseFen(fen);
  let _turn = $state(initial.turn);
  let _castling = $state(initial.castling);
  let _enPassant = $state(initial.enPassant);

  let turnLabel = $derived(_turn === "b" ? "black" : "white");

  let validCastling = $derived(computeValidCastlingRights(boardPart(fen)));

  let hasCastling = $derived({
    K: _castling.includes("K") && validCastling.K,
    Q: _castling.includes("Q") && validCastling.Q,
    k: _castling.includes("k") && validCastling.k,
    q: _castling.includes("q") && validCastling.q,
  });

  function toggleCastling(right: "K" | "Q" | "k" | "q") {
    const valid = computeValidCastlingRights(boardPart(fen));
    if (!valid[right]) return;
    let c = _castling === "-" ? "" : _castling;
    if (c.includes(right)) {
      c = c.replace(right, "");
    } else {
      c = (c + right)
        .split("")
        .sort((a, b) => {
          const order = ["K", "Q", "k", "q"];
          return order.indexOf(a) - order.indexOf(b);
        })
        .join("");
    }
    _castling = c || "-";
  }

  function setEnPassant(file: string) {
    if (file === "-") {
      _enPassant = "-";
    } else if (file) {
      const rank = _turn === "w" ? "6" : "3";
      _enPassant = `${file}${rank}`;
    }
  }

  function toggleTurn() {
    _turn = _turn === "w" ? "b" : "w";
    enPassantFiles = computeEnPassantFilesFor(boardPart(fen), _turn);
    validateEnPassant();
  }

  function buttonClick(action: string) {
    if (action === "save") {
      eventBus.emit("saveFen", {
        turn: _turn,
        castling: _castling,
        enPassant: _enPassant,
      });
      return;
    }
    eventBus.emit("btn-click", { name: action });
  }

  const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];

  function expandRow(row: string): string[] {
    const result: string[] = [];
    for (const ch of row) {
      if (/[1-8]/.test(ch)) {
        for (let i = 0; i < Number.parseInt(ch); i++) result.push("");
      } else {
        result.push(ch);
      }
    }
    return result;
  }

  function expandBoard(boardFen: string): string[][] {
    return boardFen.split("/").map((row) => expandRow(row));
  }

  function computeValidCastlingRights(boardFen: string): {
    K: boolean;
    Q: boolean;
    k: boolean;
    q: boolean;
  } {
    const board = expandBoard(boardFen);
    const result = { K: false, Q: false, k: false, q: false };

    const wKingRank = board[7];
    const bKingRank = board[0];

    if (wKingRank[4] === "K") {
      if (wKingRank[7] === "R") result.K = true;
      if (wKingRank[0] === "R") result.Q = true;
    }

    if (bKingRank[4] === "k") {
      if (bKingRank[7] === "r") result.k = true;
      if (bKingRank[0] === "r") result.q = true;
    }

    return result;
  }

  function syncCastlingFromBoard(boardFen: string) {
    const valid = computeValidCastlingRights(boardFen);
    let c = "";
    if (valid.K) c += "K";
    if (valid.Q) c += "Q";
    if (valid.k) c += "k";
    if (valid.q) c += "q";
    _castling = c || "-";
  }

  function computeEnPassantFilesFor(boardFen: string, turn: string): string[] {
    const board = boardFen.split("/");
    const valid: string[] = [];

    if (turn === "w") {
      const row = expandRow(board[3]);
      for (let f = 0; f < 8; f++) {
        if (row[f] === "p") {
          if ((f > 0 && row[f - 1] === "P") || (f < 7 && row[f + 1] === "P")) {
            valid.push(FILES[f]);
          }
        }
      }
    } else {
      const row = expandRow(board[4]);
      for (let f = 0; f < 8; f++) {
        if (row[f] === "P") {
          if ((f > 0 && row[f - 1] === "p") || (f < 7 && row[f + 1] === "p")) {
            valid.push(FILES[f]);
          }
        }
      }
    }
    return [...new Set(valid)].sort();
  }

  let enPassantFiles = $state<string[]>([]);

  function boardPart(fen: string): string {
    return fen.split(" ")[0];
  }

  function validateEnPassant() {
    if (_enPassant !== "-" && !enPassantFiles.includes(_enPassant[0])) {
      _enPassant = "-";
    }
  }

  onMount(() => {
    const bp = boardPart(fen);
    syncCastlingFromBoard(bp);
    enPassantFiles = computeEnPassantFilesFor(bp, _turn);
    validateEnPassant();
    eventBus.on<string>("updateUI", (fenStr) => {
      const currentFen = fenStr || fen;
      const currentBp = boardPart(currentFen);
      syncCastlingFromBoard(currentBp);
      enPassantFiles = computeEnPassantFilesFor(currentBp, _turn);
      validateEnPassant();
    });
  });
</script>

<div class="fen-editor-tools chess-layout__toolbar">
  <div class="tool-group-fen-meta">
    <div class="tool-section turn-row">
      <button class="turn-toggle" onclick={toggleTurn}
        >{turnLabel === "black"
          ? t("genfen.black_turn", _lv)
          : t("genfen.white_turn", _lv)}</button
      >
    </div>

    <div class="tool-section">
      <span class="section-label">{t("genfen.castling", _lv)}</span>
      <div class="castling-row">
        <span class="castling-color">{t("genfen.castling_black", _lv)}</span>
        <label
          class="castling-checkbox"
          class:active={hasCastling.q}
          class:invalid={!validCastling.q}
        >
          <input
            type="checkbox"
            checked={hasCastling.q}
            disabled={!validCastling.q}
            onchange={() => toggleCastling("q")}
          />
          <span>q</span>
        </label>
        <label
          class="castling-checkbox"
          class:active={hasCastling.k}
          class:invalid={!validCastling.k}
        >
          <input
            type="checkbox"
            checked={hasCastling.k}
            disabled={!validCastling.k}
            onchange={() => toggleCastling("k")}
          />
          <span>k</span>
        </label>
      </div>
      <div class="castling-row">
        <span class="castling-color">{t("genfen.castling_white", _lv)}</span>
        <label
          class="castling-checkbox"
          class:active={hasCastling.Q}
          class:invalid={!validCastling.Q}
        >
          <input
            type="checkbox"
            checked={hasCastling.Q}
            disabled={!validCastling.Q}
            onchange={() => toggleCastling("Q")}
          />
          <span>Q</span>
        </label>
        <label
          class="castling-checkbox"
          class:active={hasCastling.K}
          class:invalid={!validCastling.K}
        >
          <input
            type="checkbox"
            checked={hasCastling.K}
            disabled={!validCastling.K}
            onchange={() => toggleCastling("K")}
          />
          <span>K</span>
        </label>
      </div>
    </div>

    <div class="tool-section">
      <label class="section-label" for="genfen-ep"
        >{t("genfen.enpassant", _lv)}</label
      >
      <select
        id="genfen-ep"
        class="fen-select"
        value={_enPassant === "-" ? "-" : _enPassant[0]}
        onfocus={() =>
          (enPassantFiles = computeEnPassantFilesFor(boardPart(fen), _turn))}
        onchange={(e) => setEnPassant((e.target as HTMLSelectElement).value)}
      >
        <option value="-">{t("genfen.enpassant_off", _lv)}</option>
        {#each enPassantFiles as f (f)}
          <option value={f}>{f}{_turn === "w" ? "6" : "3"}</option>
        {/each}
      </select>
    </div>
  </div>

  <div class="tool-section tool-buttons">
    <button class="fen-btn" onclick={() => buttonClick("start")}>
      {t("genfen.start", _lv)}
    </button>
    <button class="fen-btn" onclick={() => buttonClick("empty")}>
      {t("genfen.empty", _lv)}
    </button>
    <button class="fen-btn" onclick={() => buttonClick("flip")}>
      {t("genfen.flip", _lv)}
    </button>
    <button class="fen-btn fen-btn-save" onclick={() => buttonClick("save")}>
      {t("genfen.save", _lv)}
    </button>
    <button
      class="fen-btn fen-btn-back"
      onclick={() => eventBus.emit("exit-edit")}
    >
      {t("genfen.back", _lv)}
    </button>
  </div>
</div>

<style>
  .fen-editor-tools {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 8px;
    max-height: 100%;
  }

  .tool-section {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .section-label {
    font-size: 0.8em;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    opacity: 0.7;
  }
  .turn-row {
    flex-direction: row;
    align-items: center;
    gap: 4px;
  }
  .turn-toggle {
    padding: 2px 12px;
    border: 1px solid var(--background-modifier-border, #ccc);
    border-radius: 4px;
    cursor: pointer;
    background: var(--background-secondary, #f0f0f0);
    color: var(--text-normal, #000);
    font-size: 0.85em;
    transition: background 0.15s;
    white-space: nowrap;
  }
  .turn-toggle:hover {
    background: var(--background-modifier-hover, #e0e0e0);
  }
  .fen-select {
    padding: 4px 8px;
    border: 1px solid var(--background-modifier-border, #ccc);
    border-radius: 4px;
    background: var(--background-primary, #fff);
    color: var(--text-normal, #000);
    font-size: 0.9em;
    max-width: 100%;
  }
  .castling-row {
    display: flex;
    flex-wrap: nowrap;
    gap: 4px;
    align-items: center;
  }
  .castling-row + .castling-row {
    margin-top: 2px;
  }
  .castling-color {
    font-weight: 600;
    font-size: 0.85em;
    white-space: nowrap;
    min-width: 3em;
  }
  .castling-checkbox {
    display: flex;
    align-items: center;
    gap: 2px;
    cursor: pointer;
    font-size: 0.85em;
    padding: 2px 4px;
    border-radius: 4px;
    border: 1px solid transparent;
    white-space: nowrap;
    transition: all 0.15s;
  }
  .castling-checkbox.active {
    border-color: var(--interactive-accent, #6a9fb5);
    background: color-mix(
      in srgb,
      var(--interactive-accent, #6a9fb5) 15%,
      transparent
    );
  }
  .castling-checkbox input {
    margin: 0;
  }
  .castling-checkbox.invalid {
    opacity: 0.3;
    pointer-events: none;
  }
  .tool-buttons {
    display: flex;
    flex-direction: column;
    flex-wrap: wrap;
    gap: 4px;
    align-content: start;
  }
  .fen-btn {
    padding: 6px 12px;
    border: 1px solid var(--background-modifier-border, #ccc);
    border-radius: 4px;
    cursor: pointer;
    background: var(--background-secondary, #f0f0f0);
    color: var(--text-normal, #000);
    font-size: 0.85em;
    transition: background 0.15s;
  }
  .fen-btn:hover {
    background: var(--background-modifier-hover, #e0e0e0);
  }
  .fen-btn-save {
    background: var(--interactive-accent, #6a9fb5);
    color: var(--text-on-accent, #fff);
    border-color: var(--interactive-accent, #6a9fb5);
    font-weight: 600;
  }
  .fen-btn-save:hover {
    opacity: 0.9;
  }
</style>
