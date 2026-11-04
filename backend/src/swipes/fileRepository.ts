import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { Swipe, SwipeRepository } from "./repository.js";

/** Shape of the JSON file. The version lets a later format migrate old files instead of dropping them. */
interface SwipeFile {
  version: 1;
  swipesByUser: Record<string, Swipe[]>;
}

export class CorruptDataFileError extends Error {
  constructor(filePath: string, cause: unknown) {
    super(
      `Cannot read swipe data from ${filePath}: ${cause instanceof Error ? cause.message : String(cause)}. ` +
        "The file was left untouched; fix or move it, then restart.",
    );
  }
}

const EPOCH = new Date(0).toISOString();

function load(filePath: string): Map<string, Swipe[]> {
  if (!existsSync(filePath)) return new Map();
  try {
    const data = JSON.parse(readFileSync(filePath, "utf8")) as Partial<SwipeFile>;
    if (data.version !== 1 || typeof data.swipesByUser !== "object" || data.swipesByUser === null) {
      throw new Error("unexpected file format");
    }
    return new Map(
      Object.entries(data.swipesByUser).map(([userId, swipes]) => {
        if (!Array.isArray(swipes)) throw new Error(`swipes of user ${userId} are not a list`);
        // Swipes saved before timestamps existed get the epoch: they count for all-time stats,
        // never as "recent".
        return [userId, swipes.map((swipe) => ({ ...swipe, swipedAt: swipe.swipedAt ?? EPOCH }))];
      }),
    );
  } catch (err) {
    // Refuse to start rather than overwrite the file with an empty store: losing likes is the one thing we must not do.
    throw new CorruptDataFileError(filePath, err);
  }
}

/**
 * A SwipeRepository that keeps swipes in memory and saves them to a JSON file on every change,
 * so they survive a restart. Writes go to a temporary file first and are then renamed over the
 * real file, so a crash mid-write never leaves a half-written file behind.
 */
export function createFileSwipeRepository(filePath: string): SwipeRepository {
  const swipesByUser = load(filePath);
  const tempPath = `${filePath}.tmp`;

  function save() {
    const data: SwipeFile = { version: 1, swipesByUser: Object.fromEntries(swipesByUser) };
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(tempPath, JSON.stringify(data, null, 2));
    renameSync(tempPath, filePath);
  }

  return {
    listByUser: (userId) => [...(swipesByUser.get(userId) ?? [])],
    listAll: () => [...swipesByUser.values()].flat(),
    add: (userId, swipe) => {
      swipesByUser.set(userId, [...(swipesByUser.get(userId) ?? []), swipe]);
      save();
    },
    clearByUser: (userId) => {
      if (!swipesByUser.delete(userId)) return;
      save();
    },
  };
}
