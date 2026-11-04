import { describe, expect, test } from "vitest";

import {
  type NavKeyEvent,
  resolveKeyboardAction,
} from "../src/modules/KeyboardNav";
import { NAV_ACTIONS } from "../src/utils/nav-actions";

function event(
  key: string,
  mods: { ctrl?: boolean; alt?: boolean; shift?: boolean; meta?: boolean } = {},
): NavKeyEvent {
  return {
    key,
    metaKey: mods.meta ?? false,
    ctrlKey: mods.ctrl ?? false,
    altKey: mods.alt ?? false,
    shiftKey: mods.shift ?? false,
  };
}

describe("resolveKeyboardAction", () => {
  test("plain arrows step moves like the PGN view scope", () => {
    expect(resolveKeyboardAction(event("ArrowUp"))).toBe("back");
    expect(resolveKeyboardAction(event("ArrowDown"))).toBe("next");
    expect(resolveKeyboardAction(event("ArrowLeft"))).toBe("toStart");
    expect(resolveKeyboardAction(event("ArrowRight"))).toBe("toEnd");
  });

  test("every NAV_ACTIONS hotkey resolves to its action", () => {
    for (const { action, hotkeys } of NAV_ACTIONS) {
      for (const { modifiers, key } of hotkeys ?? []) {
        const resolved = resolveKeyboardAction(
          event(key, {
            ctrl: modifiers.includes("Ctrl"),
            alt: modifiers.includes("Alt"),
            shift: modifiers.includes("Shift"),
          }),
        );
        expect(resolved, `${modifiers.join("+")}+${key}`).toBe(action);
      }
    }
  });

  test("Cmd combos have no action (macOS)", () => {
    expect(resolveKeyboardAction(event("ArrowUp", { meta: true }))).toBeNull();
    expect(
      resolveKeyboardAction(event("ArrowUp", { meta: true, ctrl: true })),
    ).toBeNull();
  });

  test("bare Shift and non-navigation keys have no action", () => {
    expect(
      resolveKeyboardAction(event("ArrowLeft", { shift: true })),
    ).toBeNull();
    expect(resolveKeyboardAction(event("a"))).toBeNull();
    expect(resolveKeyboardAction(event("a", { ctrl: true }))).toBeNull();
    expect(resolveKeyboardAction(event("Enter"))).toBeNull();
  });

  test("Ctrl+Alt without Shift has no action", () => {
    expect(
      resolveKeyboardAction(event("ArrowLeft", { ctrl: true, alt: true })),
    ).toBeNull();
  });
});
