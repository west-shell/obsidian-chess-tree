import { describe, expect, test } from "vitest";

import { computeGlyph, EVAL_NOISE_BAND } from "../src/utils/winningChances";
import type { NodeEval } from "../src/types";

const ev = (cp: number): NodeEval => ({
  score: cp,
  scoreType: "cp",
  depth: 20,
});

const mateEv = (mate: number): NodeEval => ({
  score: mate,
  scoreType: "mate",
  depth: 20,
});

describe("computeGlyph", () => {
  test("missing inputs yield no glyph", () => {
    expect(computeGlyph(undefined, ev(0), "white", true)).toBeNull();
    expect(computeGlyph(ev(0), undefined, "white", true)).toBeNull();
    expect(computeGlyph(ev(0), ev(0), null, true)).toBeNull();
  });

  test("best move from the same search is never annotated", () => {
    // delta 0: the played PV equals the parent eval
    expect(computeGlyph(ev(0), ev(0), "white", true)).toBeNull();
    expect(computeGlyph(ev(100), ev(100), "white", true)).toBeNull();
  });

  test("negative glyphs at exact thresholds (same search)", () => {
    expect(computeGlyph(ev(0), ev(-200), "white", true)?.symbol).toBe("??");
    expect(computeGlyph(ev(0), ev(-150), "white", true)?.symbol).toBe("?");
    expect(computeGlyph(ev(0), ev(-100), "white", true)?.symbol).toBe("?!");
  });

  test("tiny same-search deltas are not annotated", () => {
    expect(computeGlyph(ev(0), ev(-10), "white", true)).toBeNull();
  });

  test("cross-search deltas inside the noise band are not annotated", () => {
    // -0.11 would be ?! with an exact measurement, but is noise cross-search
    expect(computeGlyph(ev(0), ev(-60), "white", false)).toBeNull();
    expect(computeGlyph(ev(0), ev(60), "white", false)).toBeNull();
    expect(EVAL_NOISE_BAND).toBeGreaterThan(0.1);
    expect(EVAL_NOISE_BAND).toBeLessThan(0.2);
  });

  test("cross-search deltas beyond the noise band are annotated", () => {
    expect(computeGlyph(ev(0), ev(-100), "white", false)?.symbol).toBe("?!"); // -0.18
    expect(computeGlyph(ev(0), ev(-200), "white", false)?.symbol).toBe("??");
  });

  test("positive glyphs kept for real gains", () => {
    // +0.11 same search → !
    expect(computeGlyph(ev(0), ev(60), "white", true)?.symbol).toBe("!");
    // +0.055 same search → !?
    expect(computeGlyph(ev(0), ev(30), "white", true)?.symbol).toBe("!?");
    // +0.18 cross search → !
    expect(computeGlyph(ev(0), ev(100), "white", false)?.symbol).toBe("!");
    // +0.11 cross search → swallowed by the noise band
    expect(computeGlyph(ev(0), ev(60), "white", false)).toBeNull();
  });

  test("black flips the sign convention", () => {
    // +100cp white-view after a black move is a 0.18 loss for black
    expect(computeGlyph(ev(0), ev(100), "black", true)?.symbol).toBe("?!");
    expect(computeGlyph(ev(0), ev(-100), "black", true)?.symbol).toBe("!");
  });

  test("mate scores", () => {
    expect(computeGlyph(mateEv(1), mateEv(-1), "white", true)?.symbol).toBe(
      "??",
    );
    expect(computeGlyph(mateEv(-1), mateEv(1), "white", true)?.symbol).toBe(
      "!!",
    );
    expect(computeGlyph(mateEv(0), mateEv(0), "white", true)).toBeNull();
  });
});
