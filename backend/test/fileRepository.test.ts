import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createMemeCatalog } from "../src/memes/catalog.js";
import { CorruptDataFileError, createFileSwipeRepository } from "../src/swipes/fileRepository.js";
import { createSwipeService } from "../src/swipes/service.js";

const T = "2026-11-04T12:00:00.000Z";

let dir: string;
let file: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "meme-tinder-"));
  file = join(dir, "nested", "swipes.json");
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("file swipe repository", () => {
  it("starts empty when the file does not exist", () => {
    expect(createFileSwipeRepository(file).listByUser("u1")).toEqual([]);
  });

  it("keeps swipes after a restart (a new repository on the same file)", () => {
    const before = createFileSwipeRepository(file);
    before.add("u1", { memeId: "a", direction: "like", swipedAt: T });
    before.add("u1", { memeId: "b", direction: "nope", swipedAt: T });
    before.add("u2", { memeId: "a", direction: "nope", swipedAt: T });

    const after = createFileSwipeRepository(file);

    expect(after.listByUser("u1")).toEqual([
      { memeId: "a", direction: "like", swipedAt: T },
      { memeId: "b", direction: "nope", swipedAt: T },
    ]);
    expect(after.listByUser("u2")).toEqual([{ memeId: "a", direction: "nope", swipedAt: T }]);
  });

  it("keeps a reset after a restart", () => {
    const before = createFileSwipeRepository(file);
    before.add("u1", { memeId: "a", direction: "like", swipedAt: T });
    before.add("u2", { memeId: "a", direction: "like", swipedAt: T });
    before.clearByUser("u1");

    const after = createFileSwipeRepository(file);

    expect(after.listByUser("u1")).toEqual([]);
    expect(after.listByUser("u2")).toEqual([{ memeId: "a", direction: "like", swipedAt: T }]);
  });

  it("lists every user's swipes after a restart", () => {
    const before = createFileSwipeRepository(file);
    before.add("u1", { memeId: "a", direction: "like", swipedAt: T });
    before.add("u2", { memeId: "b", direction: "nope", swipedAt: T });

    expect(createFileSwipeRepository(file).listAll()).toHaveLength(2);
  });

  it("loads swipes saved before timestamps existed, as old swipes", () => {
    const old = join(dir, "swipes.json");
    writeFileSync(
      old,
      JSON.stringify({ version: 1, swipesByUser: { u1: [{ memeId: "a", direction: "like" }] } }),
    );

    expect(createFileSwipeRepository(old).listByUser("u1")).toEqual([
      { memeId: "a", direction: "like", swipedAt: "1970-01-01T00:00:00.000Z" },
    ]);
  });

  it("refuses a file where a user's swipes are not a list", () => {
    const bad = join(dir, "swipes.json");
    writeFileSync(bad, JSON.stringify({ version: 1, swipesByUser: { u1: "oops" } }));

    expect(() => createFileSwipeRepository(bad)).toThrow(CorruptDataFileError);
  });

  it("does not leave a temporary file behind", () => {
    createFileSwipeRepository(file).add("u1", { memeId: "a", direction: "like", swipedAt: T });
    expect(existsSync(`${file}.tmp`)).toBe(false);
  });

  it("refuses to start on a corrupt file and leaves it untouched", () => {
    const corrupt = join(dir, "swipes.json");
    writeFileSync(corrupt, "{ not json");

    expect(() => createFileSwipeRepository(corrupt)).toThrow(CorruptDataFileError);
    expect(readFileSync(corrupt, "utf8")).toBe("{ not json");
  });

  it("refuses a file in an unknown format", () => {
    const unknown = join(dir, "swipes.json");
    writeFileSync(unknown, JSON.stringify({ version: 99 }));

    expect(() => createFileSwipeRepository(unknown)).toThrow(CorruptDataFileError);
  });

  it("lets the swipe service remember likes across a restart", () => {
    const catalog = createMemeCatalog([
      { id: "a", caption: "A", file: "a.svg" },
      { id: "b", caption: "B", file: "b.svg" },
    ]);
    createSwipeService(catalog, createFileSwipeRepository(file)).recordSwipe("u1", "a", "like");

    const restarted = createSwipeService(catalog, createFileSwipeRepository(file));

    expect(restarted.listLikedMemes("u1").map((meme) => meme.id)).toEqual(["a"]);
    expect(restarted.getNextMeme("u1")?.id).toBe("b");
  });
});
