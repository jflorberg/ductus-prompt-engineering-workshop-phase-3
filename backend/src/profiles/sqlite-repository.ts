import { DatabaseSync } from "node:sqlite";
import type { Profile, ProfileRepository } from "./repository.js";

type Row = Record<string, unknown>;

function toProfile(row: Row): Profile {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    nickname: String(row.nickname),
    emoji: String(row.emoji),
    bot: Number(row.bot) === 1,
  };
}

/**
 * A `ProfileRepository` backed by SQLite (Node's built-in `node:sqlite`). It can share a database
 * file with the swipe repository. Pass ":memory:" for a throwaway database.
 */
export function createSqliteProfileRepository(path: string): ProfileRepository & { close(): void } {
  const db = new DatabaseSync(path);
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS profiles (
      user_id TEXT PRIMARY KEY,
      id TEXT NOT NULL UNIQUE,
      nickname TEXT NOT NULL,
      emoji TEXT NOT NULL,
      bot INTEGER NOT NULL DEFAULT 0
    );
  `);

  const columns = "id, user_id, nickname, emoji, bot";
  const findByUserId = db.prepare(`SELECT ${columns} FROM profiles WHERE user_id = ?`);
  const findById = db.prepare(`SELECT ${columns} FROM profiles WHERE id = ?`);
  const list = db.prepare(`SELECT ${columns} FROM profiles ORDER BY rowid`);
  const upsert = db.prepare(`
    INSERT INTO profiles (user_id, id, nickname, emoji, bot) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT (user_id) DO UPDATE SET
      id = excluded.id, nickname = excluded.nickname, emoji = excluded.emoji, bot = excluded.bot
  `);

  return {
    findByUserId: (userId) => {
      const row = findByUserId.get(userId);
      return row ? toProfile(row) : undefined;
    },
    findById: (id) => {
      const row = findById.get(id);
      return row ? toProfile(row) : undefined;
    },
    list: () => list.all().map(toProfile),
    save: (profile) => {
      upsert.run(profile.userId, profile.id, profile.nickname, profile.emoji, profile.bot ? 1 : 0);
    },
    close: () => {
      db.close();
    },
  };
}
