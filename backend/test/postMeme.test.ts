import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { createMemeCatalog } from "../src/memes/catalog.js";
import { createInMemoryImageStore } from "../src/memes/imageStore.js";
import { createMemeService } from "../src/memes/service.js";
import { createInMemorySwipeRepository } from "../src/swipes/repository.js";
import { createSwipeService } from "../src/swipes/service.js";

const svgSource = '<svg xmlns="http://www.w3.org/2000/svg"><text>hi</text></svg>';
const svg = `data:image/svg+xml;base64,${Buffer.from(svgSource).toString("base64")}`;

function setup() {
  const catalog = createMemeCatalog([{ id: "a", caption: "A", file: "works-on-my-machine.svg" }]);
  const swipeService = createSwipeService(catalog, createInMemorySwipeRepository());
  const memeService = createMemeService(catalog, createInMemoryImageStore());
  return createApp(swipeService, { memeService });
}

const post = (app: ReturnType<typeof setup>, body: object, userId = "u1") =>
  request(app).post("/api/memes").set("X-User-Id", userId).send(body);

describe("POST /api/memes", () => {
  it("returns 201 with the new meme", async () => {
    const res = await post(setup(), { caption: "My meme", image: svg });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ id: expect.any(String), caption: "My meme", imageUrl: expect.stringContaining(res.body.id) });
  });

  it("shows the posted meme to other users", async () => {
    const app = setup();
    const { body: meme } = await post(app, { caption: "My meme", image: svg });

    const next = await request(app).get("/api/memes/next").set("X-User-Id", "u2");

    expect(next.body.meme).toEqual(meme);
  });

  it("lets users swipe and like a posted meme", async () => {
    const app = setup();
    const { body: meme } = await post(app, { caption: "My meme", image: svg });

    const swipe = await request(app).post("/api/swipes").set("X-User-Id", "u2").send({ memeId: meme.id, direction: "like" });
    const likes = await request(app).get("/api/likes").set("X-User-Id", "u2");

    expect(swipe.status).toBe(200);
    expect(likes.body.memes).toEqual([meme]);
  });

  it("serves the meme as an SVG with the caption and a locked-down CSP", async () => {
    const app = setup();
    const { body: meme } = await post(app, { caption: "My meme", image: svg });

    const image = await request(app).get(meme.imageUrl);

    expect(image.status).toBe(200);
    expect(image.headers["content-type"]).toContain("image/svg+xml");
    expect(image.headers["content-security-policy"]).toContain("default-src 'none'");
    expect(image.headers["x-content-type-options"]).toBe("nosniff");
    expect(image.body.toString()).toContain("MY MEME");
    expect(image.body.toString()).toContain(svg);
  });

  it("returns 404 for an unknown uploaded image", async () => {
    const res = await request(setup()).get("/api/memes/uploads/nope");

    expect(res.status).toBe(404);
    expect(res.body.error).toEqual(expect.any(String));
  });

  it("rejects a request without a user id", async () => {
    const res = await request(setup()).post("/api/memes").send({ caption: "x", image: svg });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/X-User-Id/);
  });

  it.each([
    ["a missing caption", { image: svg }, /caption/],
    ["a blank caption", { caption: "  ", image: svg }, /caption/],
    ["a missing image", { caption: "x" }, /image/],
    ["an image that is not allowed", { caption: "x", image: "data:text/plain;base64,aGk=" }, /image type/],
  ])("returns 400 for %s", async (_name, body, error) => {
    const res = await post(setup(), body);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(error);
  });

  it("returns 413 with a JSON error for a body over 2 MB", async () => {
    const res = await post(setup(), { caption: "x", image: `data:image/png;base64,${"A".repeat(3 * 1024 * 1024)}` });

    expect(res.status).toBe(413);
    expect(res.body.error).toEqual(expect.any(String));
  });
});
