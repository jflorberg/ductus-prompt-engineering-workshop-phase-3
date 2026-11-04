import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createMemeCatalog } from "../src/memes/catalog.js";
import { createSqliteSwipeRepository } from "../src/swipes/sqlite-repository.js";
import { createSwipeService } from "../src/swipes/service.js";

const T = "2026-11-04T12:00:00.000Z";

describe("SQLite swipe repository", () => {
  let dir: string;
  let file: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "meme-tinder-"));
    file = join(dir, "swipes.db");
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("lists a user's swipes in the order they were added", () => {
    const repo = createSqliteSwipeRepository(":memory:");
    repo.add("u1", { memeId: "b", direction: "nope", swipedAt: T });
    repo.add("u1", { memeId: "a", direction: "like", swipedAt: T });
    repo.add("u2", { memeId: "c", direction: "like", swipedAt: T });

    expect(repo.listByUser("u1")).toEqual([
      { memeId: "b", direction: "nope", swipedAt: T },
      { memeId: "a", direction: "like", swipedAt: T },
    ]);
    expect(repo.listByUser("nobody")).toEqual([]);
  });

  it("lists every user's swipes", () => {
    const repo = createSqliteSwipeRepository(":memory:");
    repo.add("u1", { memeId: "a", direction: "like", swipedAt: T });
    repo.add("u2", { memeId: "b", direction: "nope", swipedAt: T });

    expect(repo.listAll()).toEqual([
      { memeId: "a", direction: "like", swipedAt: T },
      { memeId: "b", direction: "nope", swipedAt: T },
    ]);
  });

  it("clears only the given user's swipes", () => {
    const repo = createSqliteSwipeRepository(":memory:");
    repo.add("u1", { memeId: "a", direction: "like", swipedAt: T });
    repo.add("u2", { memeId: "a", direction: "nope", swipedAt: T });

    repo.clearByUser("u1");

    expect(repo.listByUser("u1")).toEqual([]);
    expect(repo.listAll()).toEqual([{ memeId: "a", direction: "nope", swipedAt: T }]);
  });

  it("keeps swipes and their times when a new repository opens the same file", () => {
    const first = createSqliteSwipeRepository(file);
    first.add("u1", { memeId: "a", direction: "like", swipedAt: T });
    first.close();

    const second = createSqliteSwipeRepository(file);
    expect(second.listByUser("u1")).toEqual([{ memeId: "a", direction: "like", swipedAt: T }]);
    second.close();
  });

  it("upgrades a database from before swipes had timestamps, keeping its swipes as old ones", () => {
    const old = new DatabaseSync(file);
    old.exec(`
      CREATE TABLE swipes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        meme_id TEXT NOT NULL,
        direction TEXT NOT NULL CHECK (direction IN ('like', 'nope'))
      );
      INSERT INTO swipes (user_id, meme_id, direction) VALUES ('u1', 'a', 'like');
    `);
    old.close();

    const repo = createSqliteSwipeRepository(file);
    repo.add("u1", { memeId: "b", direction: "nope", swipedAt: T });

    expect(repo.listByUser("u1")).toEqual([
      { memeId: "a", direction: "like", swipedAt: "1970-01-01T00:00:00.000Z" },
      { memeId: "b", direction: "nope", swipedAt: T },
    ]);
    repo.close();
  });

  it("keeps likes across a restart of the swipe service", () => {
    const catalog = createMemeCatalog([
      { id: "a", caption: "A", file: "a.svg" },
      { id: "b", caption: "B", file: "b.svg" },
    ]);
    const firstRepo = createSqliteSwipeRepository(file);
    createSwipeService(catalog, firstRepo).recordSwipe("u1", "a", "like");
    firstRepo.close();

    const secondRepo = createSqliteSwipeRepository(file);
    const service = createSwipeService(catalog, secondRepo);
    expect(service.listLikedMemes("u1").map((meme) => meme.id)).toEqual(["a"]);
    expect(service.getNextMeme("u1")?.id).toBe("b");
    expect(service.getMemeStats("a")).toEqual({ likes: 1, nopes: 0, lovePercent: 100 });
    secondRepo.close();
  });
});
