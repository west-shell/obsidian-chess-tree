import { describe, expect, test } from "vitest";

import en from "../src/i18n/en.json";
import zh from "../src/i18n/zh.json";
import { NAV_ACTIONS } from "../src/nav-actions";

// Every btn-click action the PGN view's Scope registers (and thus the
// commands cover) — guards against typos in the NAV_ACTIONS table.
const KNOWN_ACTIONS = new Set([
  "back",
  "next",
  "toStart",
  "toEnd",
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

describe("NAV_ACTIONS", () => {
  test("command ids are unique", () => {
    const ids = NAV_ACTIONS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("covers all 16 scope navigation actions", () => {
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
});
