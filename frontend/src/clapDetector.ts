/** Settings for recognising claps in microphone levels. Levels are peak amplitudes from 0 to 1. */
export interface ClapDetectorOptions {
  /** A frame at or above this level can be a clap. Talking is usually well below it. */
  threshold: number;
  /** The level must drop below this between claps, so one long noise counts only once. */
  quietLevel: number;
  /** Loud frames closer than this to the last clap belong to the same clap (echo, double peak). */
  minGapMs: number;
  /** A pause longer than this between claps starts the count over. */
  maxGapMs: number;
  /** Claps needed to log in. */
  requiredClaps: number;
}

export const DEFAULT_CLAP_OPTIONS: ClapDetectorOptions = {
  threshold: 0.3,
  quietLevel: 0.1,
  minGapMs: 120,
  maxGapMs: 1500,
  requiredClaps: 3,
};

export interface ClapDetector {
  /**
   * Feeds the peak level of one microphone frame. Returns the clap count in the current series
   * (1 to requiredClaps) when this frame is a new clap, otherwise null.
   */
  feed(level: number, timeMs: number): number | null;
  /** Counts a clap without sound, for example from the clap button. Returns the new count. */
  clap(timeMs: number): number;
}

export function createClapDetector(options: Partial<ClapDetectorOptions> = {}): ClapDetector {
  const { threshold, quietLevel, minGapMs, maxGapMs, requiredClaps } = {
    ...DEFAULT_CLAP_OPTIONS,
    ...options,
  };
  let count = 0;
  let lastClapAt: number | null = null;
  // A clap only counts after the room has been quiet, so a long loud noise is one clap, not many.
  let armed = true;

  function clap(timeMs: number): number {
    if (lastClapAt !== null && timeMs - lastClapAt > maxGapMs) count = 0;
    count++;
    lastClapAt = timeMs;
    const result = count;
    if (count >= requiredClaps) {
      count = 0;
      lastClapAt = null;
    }
    return result;
  }

  return {
    feed(level, timeMs) {
      if (level < quietLevel) armed = true;
      if (!armed || level < threshold) return null;
      armed = false;
      if (lastClapAt !== null && timeMs - lastClapAt < minGapMs) return null;
      return clap(timeMs);
    },
    clap,
  };
}
