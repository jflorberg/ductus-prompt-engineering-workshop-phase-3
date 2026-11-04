import { describe, expect, it } from "vitest";
import { createClapDetector, DEFAULT_CLAP_OPTIONS } from "../src/clapDetector";

const LOUD = 0.8;
const QUIET = 0.02;

/** Feeds [level, time] frames and returns the clap counts the detector reported. */
function feedAll(frames: [number, number][]) {
  const detector = createClapDetector();
  return frames
    .map(([level, time]) => detector.feed(level, time))
    .filter((count) => count !== null);
}

describe("clap detector", () => {
  it("counts three claps with quiet in between", () => {
    expect(
      feedAll([
        [QUIET, 0],
        [LOUD, 100],
        [QUIET, 200],
        [LOUD, 500],
        [QUIET, 600],
        [LOUD, 900],
      ]),
    ).toEqual([1, 2, 3]);
  });

  it("counts one long loud noise only once", () => {
    expect(
      feedAll([
        [LOUD, 0],
        [LOUD, 200],
        [LOUD, 400],
        [LOUD, 600],
      ]),
    ).toEqual([1]);
  });

  it("ignores talking and other sounds below the threshold", () => {
    expect(
      feedAll([
        [0.2, 0],
        [QUIET, 100],
        [0.25, 200],
        [QUIET, 300],
      ]),
    ).toEqual([]);
  });

  it("counts an echo right after a clap as the same clap", () => {
    expect(
      feedAll([
        [LOUD, 0],
        [QUIET, 30],
        [LOUD, 60], // closer than minGapMs
        [QUIET, 200],
        [LOUD, 400],
      ]),
    ).toEqual([1, 2]);
  });

  it("starts over after a long pause", () => {
    const pause = DEFAULT_CLAP_OPTIONS.maxGapMs + 1;
    expect(
      feedAll([
        [LOUD, 0],
        [QUIET, 100],
        [LOUD, 400],
        [QUIET, 500],
        [LOUD, 400 + pause],
      ]),
    ).toEqual([1, 2, 1]);
  });

  it("starts a new series after the third clap", () => {
    const detector = createClapDetector();
    expect([0, 100, 200, 300].map((time) => detector.clap(time))).toEqual([1, 2, 3, 1]);
  });

  it("counts claps from the button the same way, without an echo limit", () => {
    const detector = createClapDetector();
    expect([0, 10, 20].map((time) => detector.clap(time))).toEqual([1, 2, 3]);
  });
});
