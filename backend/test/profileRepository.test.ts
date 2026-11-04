import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createInMemoryProfileRepository, type Profile } from "../src/profiles/repository.js";
import { createSqliteProfileRepository } from "../src/profiles/sqlite-repository.js";
import { createSqliteSwipeRepository } from "../src/swipes/sqlite-repository.js";

const sara: Profile = { id: "p1", userId: "u1", nickname: "Sara", emoji: "🐸", bot: false };
const bea: Profile = { id: "p2", userId: "bot-bea", nickname: "Bea", emoji: "🤖", bot: true };

describe.each([
  ["in memory", createInMemoryProfileRepository],
  ["SQLite", () => createSqliteProfileRepository(":memory:")],
])("%s profile repository", (_name, create) => {
  it("finds a saved profile by user id and by public id", () => {
    const repo = create();
    repo.save(sara);

    expect(repo.findByUserId("u1")).toEqual(sara);
    expect(repo.findById("p1")).toEqual(sara);
    expect(repo.findByUserId("nobody")).toBeUndefined();
    expect(repo.findById("nobody")).toBeUndefined();
  });

  it("replaces the profile with the same user id on save", () => {
    const repo = create();
    repo.save(sara);
    repo.save({ ...sara, nickname: "Sara B", emoji: "🦄" });

    expect(repo.list()).toEqual([{ ...sara, nickname: "Sara B", emoji: "🦄" }]);
  });

  it("lists profiles in the order they were created, bots included", () => {
    const repo = create();
    repo.save(sara);
    repo.save(bea);

    expect(repo.list()).toEqual([sara, bea]);
  });

  it("returns copies, so changing a result does not change the stored profile", () => {
    const repo = create();
    repo.save(sara);
    const found = repo.findByUserId("u1");
    if (found) found.nickname = "changed";

    expect(repo.findByUserId("u1")?.nickname).toBe("Sara");
  });
});

describe("SQLite profile repository on a file", () => {
  let dir: string;
  let file: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "meme-tinder-"));
    file = join(dir, "data.db");
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("keeps profiles after reopening the file", () => {
    const first = createSqliteProfileRepository(file);
    first.save(sara);
    first.close();

    const second = createSqliteProfileRepository(file);
    expect(second.findByUserId("u1")).toEqual(sara);
    second.close();
  });

  it("shares a database file with the swipe repository without losing swipes", () => {
    const swipes = createSqliteSwipeRepository(file);
    swipes.add("u1", { memeId: "a", direction: "like" });
    const profiles = createSqliteProfileRepository(file);
    profiles.save(sara);

    expect(swipes.listByUser("u1")).toEqual([{ memeId: "a", direction: "like" }]);
    expect(profiles.findByUserId("u1")).toEqual(sara);
    swipes.close();
    profiles.close();
  });
});
