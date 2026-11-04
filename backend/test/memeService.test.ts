import { describe, expect, it } from "vitest";
import { createMemeCatalog } from "../src/memes/catalog.js";
import { createInMemoryImageStore } from "../src/memes/imageStore.js";
import { createMemeService, InvalidMemeError, MAX_IMAGE_BYTES } from "../src/memes/service.js";
import { createInMemorySwipeRepository } from "../src/swipes/repository.js";
import { createSwipeService } from "../src/swipes/service.js";

const svg = `data:image/svg+xml;base64,${Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>').toString("base64")}`;
const png = `data:image/png;base64,${Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]).toString("base64")}`;

function setup() {
  const catalog = createMemeCatalog([{ id: "a", caption: "A", file: "a.svg" }]);
  const memes = createMemeService(catalog, createInMemoryImageStore());
  const swipes = createSwipeService(catalog, createInMemorySwipeRepository());
  return { memes, swipes };
}

describe("meme service", () => {
  it("returns the posted meme with a trimmed caption and an image url", () => {
    const meme = setup().memes.postMeme({ caption: "  Mine  ", image: svg });

    expect(meme).toEqual({
      id: expect.stringMatching(/^upload-/),
      caption: "Mine",
      imageUrl: `/api/memes/uploads/${meme.id}`,
    });
  });

  it("stores an SVG with the uploaded image and the caption in it, like the seed memes", () => {
    const { memes } = setup();
    const meme = memes.postMeme({ caption: "Mine & yours", image: png });

    const stored = memes.getImage(meme.id);
    expect(stored?.contentType).toBe("image/svg+xml");
    const svgText = stored?.data.toString() ?? "";
    expect(svgText).toContain(png);
    expect(svgText).toContain("MINE &amp; YOURS");
    expect(memes.getImage("missing")).toBeUndefined();
  });

  it("puts the posted meme first in every user's pile, newest first", () => {
    const { memes, swipes } = setup();
    const older = memes.postMeme({ caption: "Older", image: svg });
    const newer = memes.postMeme({ caption: "Newer", image: svg });

    for (const user of ["poster", "someone-else"]) {
      expect(swipes.getNextMeme(user)).toEqual(newer);
      swipes.recordSwipe(user, newer.id, "like");
      expect(swipes.getNextMeme(user)).toEqual(older);
    }
  });

  it("gives each posted meme its own id", () => {
    const { memes } = setup();
    expect(memes.postMeme({ caption: "x", image: svg }).id).not.toBe(
      memes.postMeme({ caption: "x", image: svg }).id,
    );
  });

  it.each([
    ["an empty caption", { caption: "   ", image: svg }],
    ["a too long caption", { caption: "x".repeat(141), image: svg }],
    ["an image that is not a data URL", { caption: "x", image: "https://example.com/a.png" }],
    [
      "an image type that is not allowed",
      { caption: "x", image: `data:text/html;base64,${Buffer.from("<svg>").toString("base64")}` },
    ],
    [
      "content that does not match the type",
      {
        caption: "x",
        image: `data:image/png;base64,${Buffer.from("not a png").toString("base64")}`,
      },
    ],
    ["an empty image", { caption: "x", image: "data:image/png;base64," }],
    [
      "an image over 1 MB",
      {
        caption: "x",
        image: `data:image/svg+xml;base64,${Buffer.from(`<svg>${" ".repeat(MAX_IMAGE_BYTES)}</svg>`).toString("base64")}`,
      },
    ],
  ])("rejects %s", (_name, input) => {
    const { memes, swipes } = setup();

    expect(() => memes.postMeme(input)).toThrow(InvalidMemeError);
    swipes.recordSwipe("u1", "a", "like");
    expect(swipes.getNextMeme("u1")).toBeNull();
  });
});
