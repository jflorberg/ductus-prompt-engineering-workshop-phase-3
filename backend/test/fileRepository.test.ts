import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createMemeCatalog } from "../src/memes/catalog.js";
import { CorruptDataFileError, createFileSwipeRepository } from "../src/swipes/fileRepository.js";
import { createSwipeService } from "../src/swipes/service.js";

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
    before.add("u1", { memeId: "a", direction: "like" });
    before.add("u1", { memeId: "b", direction: "nope" });
    before.add("u2", { memeId: "a", direction: "nope" });

    const after = createFileSwipeRepository(file);

    expect(after.listByUser("u1")).toEqual([
      { memeId: "a", direction: "like" },
      { memeId: "b", direction: "nope" },
    ]);
    expect(after.listByUser("u2")).toEqual([{ memeId: "a", direction: "nope" }]);
  });

  it("keeps a reset after a restart", () => {
    const before = createFileSwipeRepository(file);
    before.add("u1", { memeId: "a", direction: "like" });
    before.add("u2", { memeId: "a", direction: "like" });
    before.clearByUser("u1");

    const after = createFileSwipeRepository(file);

    expect(after.listByUser("u1")).toEqual([]);
    expect(after.listByUser("u2")).toEqual([{ memeId: "a", direction: "like" }]);
  });

  it("does not leave a temporary file behind", () => {
    createFileSwipeRepository(file).add("u1", { memeId: "a", direction: "like" });
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
