import { describe, expect, test } from "vitest";

import en from "../src/i18n/en.json";
import zh from "../src/i18n/zh.json";
import { NAV_ACTIONS } from "../src/utils/nav-actions";

// Every btn-click branch navigation action the PGN view supports (and
// thus the commands cover) — guards against typos in the NAV_ACTIONS
// table. The four plain move-stepping actions (back/next/toStart/
// toEnd) are intentionally absent: they stay view-internal Scope
// bindings, not commands.
const KNOWN_ACTIONS = new Set([
  "navPrevFork",
  "navNextFork",
  "prevPathBranch",
  "nextPathBranch",
  "prevAllBranches",
  "nextAllBranches",
  "prevSamePly",
  "nextSamePly",
  "prevBranchEnd",
  "nextBranchEnd",
  "prevBranchStart",
  "nextBranchStart",
]);

// The default hotkey of every branch navigation command — the binding
// the PGN view uses for the modifier combos. The four plain
// move-stepping commands carry no default on purpose: global arrow-key
// defaults would break arrow navigation elsewhere.
const EXPECTED_PRESETS: Record<string, string[]> = {
  "prev-fork": ["Ctrl", "ArrowUp"],
  "next-fork": ["Ctrl", "ArrowDown"],
  "prev-path-branch": ["Ctrl", "ArrowLeft"],
  "next-path-branch": ["Ctrl", "ArrowRight"],
  "prev-variation": ["Ctrl", "Alt", "Shift", "ArrowLeft"],
  "next-variation": ["Ctrl", "Alt", "Shift", "ArrowRight"],
  "prev-same-ply": ["Alt", "ArrowLeft"],
  "next-same-ply": ["Alt", "ArrowRight"],
  "prev-branch-end": ["Alt", "Shift", "ArrowLeft"],
  "next-branch-end": ["Alt", "Shift", "ArrowRight"],
  "prev-branch-start": ["Ctrl", "Shift", "ArrowLeft"],
  "next-branch-start": ["Ctrl", "Shift", "ArrowRight"],
};

describe("NAV_ACTIONS", () => {
  test("command ids are unique", () => {
    const ids = NAV_ACTIONS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("covers all 12 branch navigation actions", () => {
    expect(NAV_ACTIONS.map((a) => a.action).sort()).toEqual(
      [...KNOWN_ACTIONS].sort(),
    );
  });

  test("every label key exists in both locales", () => {
    for (const { labelKey } of NAV_ACTIONS) {
      expect(en, `missing en key: ${labelKey}`).toHaveProperty(labelKey);
      expect(zh, `missing zh key: ${labelKey}`).toHaveProperty(labelKey);
    }
  });

  test("no command exposes a plain arrow key", () => {
    for (const action of NAV_ACTIONS) {
      for (const hotkey of action.hotkeys ?? []) {
        expect(hotkey.modifiers, action.id).not.toHaveLength(0);
      }
    }
  });

  test("branch navigation commands define the expected default hotkeys", () => {
    expect(new Set(Object.keys(EXPECTED_PRESETS))).toEqual(
      new Set(NAV_ACTIONS.filter((action) => action.hotkeys).map((a) => a.id)),
    );
    for (const action of NAV_ACTIONS) {
      const preset = EXPECTED_PRESETS[action.id];
      if (!preset) continue;
      expect(action.hotkeys, action.id).toHaveLength(1);
      const [hotkey] = action.hotkeys!;
      expect([...hotkey.modifiers, hotkey.key], action.id).toEqual(preset);
    }
  });
});
