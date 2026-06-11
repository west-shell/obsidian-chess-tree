<script lang="ts">
  import type { EventBus } from "../../core/event-bus";
  import { onLangChange, t } from "../../i18n";
  import { onMount } from "svelte";

  interface Props {
    eventBus: EventBus;
    position: string;
    fen: string;
  }
  let { eventBus, position, fen }: Props = $props();

  let _lv = $state(0);
  onLangChange(() => _lv++);

  // Parse FEN
  let parts = $derived(fen.split(' '));
  let currentTurn = $derived(parts[1] === 'b' ? 'black' : 'white');
  let castlingStr = $derived(parts[2] || '');
  let enPassantStr = $derived(parts[3] || '-');

  let hasCastling = $derived({
    K: castlingStr.includes('K'),
    Q: castlingStr.includes('Q'),
    k: castlingStr.includes('k'),
    q: castlingStr.includes('q'),
  });

  function toggleCastling(right: 'K' | 'Q' | 'k' | 'q') {
    eventBus.emit('btn-click', { action: 'toggleCastling', right });
  }

  function setEnPassant(file: string) {
    eventBus.emit('btn-click', { action: 'setEnPassant', file });
  }

  function toggleTurn() {
    eventBus.emit('toggle-turn');
  }

  function buttonClick(action: string) {
    eventBus.emit('btn-click', action);
  }

  const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

  // Compute en passant files on demand (when dropdown is opened)
  function expandRow(row: string): string[] {
    const result: string[] = [];
    for (const ch of row) {
      if (/[1-8]/.test(ch)) {
        for (let i = 0; i < parseInt(ch); i++) result.push('');
      } else {
        result.push(ch);
      }
    }
    return result;
  }

  function computeEnPassantFilesFor(fenStr: string): string[] {
    const p = fenStr.split(' ');
    const board = p[0].split('/'); // rank 8 to rank 1
    const turn = p[1]; // 'w' or 'b'
    const valid: string[] = [];

    if (turn === 'w') {
      const row = expandRow(board[3]); // rank 5
      for (let f = 0; f < 8; f++) {
        if (row[f] === 'p') {
          if ((f > 0 && row[f - 1] === 'P') || (f < 7 && row[f + 1] === 'P')) {
            valid.push(FILES[f]);
          }
        }
      }
    } else {
      const row = expandRow(board[4]); // rank 4
      for (let f = 0; f < 8; f++) {
        if (row[f] === 'P') {
          if ((f > 0 && row[f - 1] === 'p') || (f < 7 && row[f + 1] === 'p')) {
            valid.push(FILES[f]);
          }
        }
      }
    }
    return [...new Set(valid)].sort();
  }

  let enPassantFiles = $state([]);

  onMount(() => {
    enPassantFiles = computeEnPassantFilesFor(fen);
    // Recalc on every FEN update (from any source)
    eventBus.on('updateUI', (fenStr: string) => {
      if (fenStr) {
        enPassantFiles = computeEnPassantFilesFor(fenStr);
      } else {
        enPassantFiles = computeEnPassantFilesFor(fen);
      }
    });
  });

</script>

<div class="fen-editor-tools {position}">
  <!-- Side to move -->
  <div class="tool-section turn-row">
    <button
      class="turn-toggle"
      onclick={toggleTurn}
    >{currentTurn === 'white' ? t("genfen.white_turn", _lv) : t("genfen.black_turn", _lv)}</button>
  </div>

  <!-- Castling -->
  <div class="tool-section">
    <span class="section-label">{t("genfen.castling", _lv)}</span>
    <div class="castling-grid">
      <span class="castling-color">{t("genfen.castling_white", _lv)}</span>
      <label class="castling-checkbox" class:active={hasCastling.K}>
        <input type="checkbox" checked={hasCastling.K} onchange={() => toggleCastling('K')} />
        <span>{t("genfen.castling_short", _lv)}</span>
      </label>
      <label class="castling-checkbox" class:active={hasCastling.Q}>
        <input type="checkbox" checked={hasCastling.Q} onchange={() => toggleCastling('Q')} />
        <span>{t("genfen.castling_long", _lv)}</span>
      </label>
      <span class="castling-color">{t("genfen.castling_black", _lv)}</span>
      <label class="castling-checkbox" class:active={hasCastling.k}>
        <input type="checkbox" checked={hasCastling.k} onchange={() => toggleCastling('k')} />
        <span>{t("genfen.castling_short", _lv)}</span>
      </label>
      <label class="castling-checkbox" class:active={hasCastling.q}>
        <input type="checkbox" checked={hasCastling.q} onchange={() => toggleCastling('q')} />
        <span>{t("genfen.castling_long", _lv)}</span>
      </label>
    </div>
  </div>

  <!-- En passant -->
  <div class="tool-section">
    <label class="section-label" for="genfen-ep">{t("genfen.enpassant", _lv)}</label>
    <select
      id="genfen-ep"
      class="fen-select"
      value={enPassantStr === '-' ? '-' : enPassantStr[0]}
      onfocus={() => { enPassantFiles = computeEnPassantFilesFor(fen); }}
      onchange={(e) => setEnPassant((e.target as HTMLSelectElement).value)}
    >
      <option value="-">{t("genfen.enpassant_off", _lv)}</option>
      {#each enPassantFiles as f}
        <option value={f}>{f}{currentTurn === 'white' ? '6' : '3'}</option>
      {/each}
    </select>
  </div>

  <!-- Action buttons -->
  <div class="tool-section tool-buttons">
    <button class="fen-btn" onclick={() => buttonClick('start')}>
      {t("genfen.start", _lv)}
    </button>
    <button class="fen-btn" onclick={() => buttonClick('empty')}>
      {t("genfen.empty", _lv)}
    </button>
    <button class="fen-btn" onclick={() => buttonClick('flip')}>
      {t("genfen.flip", _lv)}
    </button>
    <button class="fen-btn fen-btn-save" onclick={() => buttonClick('save')}>
      {t("genfen.save", _lv)}
    </button>
  </div>
</div>

<style>
  .fen-editor-tools {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 8px;
  }
  .fen-editor-tools.bottom {
    flex-direction: row;
    flex-wrap: wrap;
    align-items: flex-start;
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
  .castling-grid {
    display: grid;
    grid-template-columns: auto 1fr 1fr;
    gap: 4px 8px;
    align-items: center;
  }
  .castling-color {
    font-weight: 600;
    font-size: 0.85em;
    text-align: right;
  }
  .castling-checkbox {
    display: flex;
    align-items: center;
    gap: 4px;
    cursor: pointer;
    font-size: 0.9em;
    padding: 2px 6px;
    border-radius: 4px;
    border: 1px solid transparent;
    transition: all 0.15s;
  }
  .castling-checkbox.active {
    border-color: var(--interactive-accent, #6a9fb5);
    background: color-mix(in srgb, var(--interactive-accent, #6a9fb5) 15%, transparent);
  }
  .castling-checkbox input {
    margin: 0;
  }
  .tool-buttons {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
  .tool-buttons.bottom {
    flex-direction: row;
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
