import { DatabaseSync } from "node:sqlite";
import type { Direction, Swipe, SwipeRepository } from "./repository.js";

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

  const listByUser = db.prepare(
    "SELECT meme_id, direction FROM swipes WHERE user_id = ? ORDER BY id",
  );
  const insert = db.prepare("INSERT INTO swipes (user_id, meme_id, direction) VALUES (?, ?, ?)");
  const clearByUser = db.prepare("DELETE FROM swipes WHERE user_id = ?");

  return {
    listByUser: (userId) =>
      listByUser.all(userId).map((row): Swipe => ({
        memeId: String(row.meme_id),
        direction: row.direction as Direction,
      })),
    add: (userId, swipe) => {
      insert.run(userId, swipe.memeId, swipe.direction);
    },
    clearByUser: (userId) => {
      clearByUser.run(userId);
    },
    close: () => {
      db.close();
    },
  };
}
