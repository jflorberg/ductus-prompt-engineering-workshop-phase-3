import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createMemeCatalog } from "../src/memes/catalog.js";
import { createSqliteSwipeRepository } from "../src/swipes/sqlite-repository.js";
import { createSwipeService } from "../src/swipes/service.js";

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
    repo.add("u1", { memeId: "b", direction: "nope" });
    repo.add("u1", { memeId: "a", direction: "like" });
    repo.add("u2", { memeId: "c", direction: "like" });

    expect(repo.listByUser("u1")).toEqual([
      { memeId: "b", direction: "nope" },
      { memeId: "a", direction: "like" },
    ]);
    expect(repo.listByUser("nobody")).toEqual([]);
  });

  it("clears only the given user's swipes", () => {
    const repo = createSqliteSwipeRepository(":memory:");
    repo.add("u1", { memeId: "a", direction: "like" });
    repo.add("u2", { memeId: "a", direction: "nope" });

    repo.clearByUser("u1");

    expect(repo.listByUser("u1")).toEqual([]);
    expect(repo.listByUser("u2")).toEqual([{ memeId: "a", direction: "nope" }]);
  });

  it("keeps swipes when a new repository opens the same file", () => {
    const first = createSqliteSwipeRepository(file);
    first.add("u1", { memeId: "a", direction: "like" });
    first.close();

    const second = createSqliteSwipeRepository(file);
    expect(second.listByUser("u1")).toEqual([{ memeId: "a", direction: "like" }]);
    second.close();
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
    secondRepo.close();
  });
});
