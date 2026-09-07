<script lang="ts">
  import type { EventBus } from "../../core/event-bus";
  import { onLangChange, t } from "../../i18n";
  import { onDestroy, onMount } from "svelte";

  interface Props {
    eventBus: EventBus;
    fen: string;
    isFenMode?: boolean;
  }
  let { eventBus, fen, isFenMode = false }: Props = $props();

  let _lv = $state(0);
  const unsubLang = onLangChange(() => _lv++);
  onDestroy(() => {
    unsubLang();
  });

  function parseFen(fen: string) {
    const parts = fen.split(" ");
    return {
      turn: (parts[1] || "w") as string,
      castling: (parts[2] || "-") as string,
      enPassant: (parts[3] || "-") as string,
    };
  }

  let _turn = $state("w");
  let _castling = $state("-");
  let _enPassant = $state("-");

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
    eventBus.emit("btn-click", { name: "turn" });
  }

  function buttonClick(action: string) {
    if (action === "save") {
      const bp = boardPart(fen);
      const fullFen = `${bp} ${_turn} ${_castling} ${_enPassant} 0 1`;
      eventBus.emit("btn-click", { name: "save", payload: fullFen });
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

  const onFenUpdated = (fenStr?: string) => {
    const currentFen = fenStr || fen;
    const currentBp = boardPart(currentFen);
    const parsed = parseFen(currentFen);
    _turn = parsed.turn;
    syncCastlingFromBoard(currentBp);
    enPassantFiles = computeEnPassantFilesFor(currentBp, _turn);
    validateEnPassant();
  };

  onMount(() => {
    const parsed = parseFen(fen);
    _turn = parsed.turn;
    _castling = parsed.castling;
    _enPassant = parsed.enPassant;
    const bp = boardPart(fen);
    syncCastlingFromBoard(bp);
    enPassantFiles = computeEnPassantFilesFor(bp, _turn);
    validateEnPassant();
    eventBus.on<string>("updateUI", onFenUpdated);
  });
  onDestroy(() => {
    eventBus.off("updateUI", onFenUpdated);
  });
</script>

<div class="ct-genfen">
  <div class="ct-genfen__group">
    <div class="ct-genfen__section ct-genfen__section--row">
      <button
        class="ct-genfen__turn ct-genfen__turn--{_turn === 'b'
          ? 'black'
          : 'white'}"
        onclick={toggleTurn}
        >{_turn === "b"
          ? t("genfen.black_turn", _lv)
          : t("genfen.white_turn", _lv)}</button
      >
    </div>

    <div class="ct-genfen__section">
      <span class="ct-genfen__label">{t("genfen.castling", _lv)}</span>
      <div class="ct-genfen__rights">
        <span class="ct-genfen__side">{t("genfen.castling_black", _lv)}</span>
        <label
          class="ct-genfen__right"
          class:ct-genfen__right--on={hasCastling.q}
          class:ct-genfen__right--off={!validCastling.q}
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
          class="ct-genfen__right"
          class:ct-genfen__right--on={hasCastling.k}
          class:ct-genfen__right--off={!validCastling.k}
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
      <div class="ct-genfen__rights">
        <span class="ct-genfen__side">{t("genfen.castling_white", _lv)}</span>
        <label
          class="ct-genfen__right"
          class:ct-genfen__right--on={hasCastling.Q}
          class:ct-genfen__right--off={!validCastling.Q}
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
          class="ct-genfen__right"
          class:ct-genfen__right--on={hasCastling.K}
          class:ct-genfen__right--off={!validCastling.K}
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

    <div class="ct-genfen__section">
      <label class="ct-genfen__label" for="genfen-ep"
        >{t("genfen.enpassant", _lv)}</label
      >
      <select
        id="genfen-ep"
        class="ct-genfen__select"
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

  <div class="ct-genfen__section ct-genfen__actions">
    <button class="ct-genfen__action" onclick={() => buttonClick("start")}>
      {t("genfen.start", _lv)}
    </button>
    <button class="ct-genfen__action" onclick={() => buttonClick("empty")}>
      {t("genfen.empty", _lv)}
    </button>
    <button class="ct-genfen__action" onclick={() => buttonClick("flip")}>
      {t("genfen.flip", _lv)}
    </button>
    <button
      class="ct-genfen__action ct-genfen__action--save"
      onclick={() => buttonClick("save")}
    >
      {t("genfen.save", _lv)}
    </button>
    {#if !isFenMode}
      <button
        class="ct-genfen__action ct-genfen__action--back"
        onclick={() => eventBus.emit("exit-edit")}
      >
        {t("genfen.back", _lv)}
      </button>
    {/if}
  </div>
</div>
