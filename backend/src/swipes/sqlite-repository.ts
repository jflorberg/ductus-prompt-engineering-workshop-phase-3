import { DatabaseSync } from "node:sqlite";
import type { Direction, Swipe, SwipeRepository } from "./repository.js";

/** The time given to swipes saved before timestamps existed: they count for all-time stats, never as recent. */
const EPOCH = new Date(0).toISOString();

/**
 * A `SwipeRepository` backed by SQLite, using Node's built-in `node:sqlite` (no extra dependency).
 * Pass a file path to keep swipes across restarts, or ":memory:" for a throwaway database.
 */
export function createSqliteSwipeRepository(path: string): SwipeRepository & { close(): void } {
  const db = new DatabaseSync(path);
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS swipes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      meme_id TEXT NOT NULL,
      direction TEXT NOT NULL CHECK (direction IN ('like', 'nope'))
    );
    CREATE INDEX IF NOT EXISTS swipes_user_id ON swipes (user_id, id);
  `);

  // Migration: databases created before swipes had timestamps get the column, with old rows at the epoch.
  const columns = db.prepare("PRAGMA table_info(swipes)").all();
  if (!columns.some((column) => column.name === "swiped_at")) {
    db.exec(`ALTER TABLE swipes ADD COLUMN swiped_at TEXT NOT NULL DEFAULT '${EPOCH}'`);
  }

  const listByUser = db.prepare(
    "SELECT meme_id, direction, swiped_at FROM swipes WHERE user_id = ? ORDER BY id",
  );
  const listAll = db.prepare("SELECT meme_id, direction, swiped_at FROM swipes ORDER BY id");
  const insert = db.prepare(
    "INSERT INTO swipes (user_id, meme_id, direction, swiped_at) VALUES (?, ?, ?, ?)",
  );
  const clearByUser = db.prepare("DELETE FROM swipes WHERE user_id = ?");

  const toSwipe = (row: Record<string, unknown>): Swipe => ({
    memeId: String(row.meme_id),
    direction: row.direction as Direction,
    swipedAt: String(row.swiped_at),
  });

  return {
    listByUser: (userId) => listByUser.all(userId).map(toSwipe),
    listAll: () => listAll.all().map(toSwipe),
    add: (userId, swipe) => {
      insert.run(userId, swipe.memeId, swipe.direction, swipe.swipedAt);
    },
    clearByUser: (userId) => {
      clearByUser.run(userId);
    },
    close: () => {
      db.close();
    },
  };
}
