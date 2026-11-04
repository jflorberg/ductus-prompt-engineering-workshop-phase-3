import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { createMemeCatalog } from "../src/memes/catalog.js";
import { createInMemoryProfileRepository } from "../src/profiles/repository.js";
import { createProfileService } from "../src/profiles/service.js";
import { createInMemorySwipeRepository } from "../src/swipes/repository.js";
import { createSwipeService } from "../src/swipes/service.js";

function setup() {
  const catalog = createMemeCatalog([{ id: "a", caption: "A", file: "works-on-my-machine.svg" }]);
  const swipeService = createSwipeService(catalog, createInMemorySwipeRepository());
  const profileService = createProfileService(createInMemoryProfileRepository());
  return createApp(swipeService, { profileService });
}

const put = (app: ReturnType<typeof setup>, body: unknown, userId = "u1") =>
  request(app)
    .put("/api/me")
    .set("X-User-Id", userId)
    .send(body as object);

describe("GET /api/me", () => {
  it("creates a profile on the first call and returns the same one later", async () => {
    const app = setup();

    const first = await request(app).get("/api/me").set("X-User-Id", "u1");
    const again = await request(app).get("/api/me").set("X-User-Id", "u1");

    expect(first.status).toBe(200);
    expect(first.body).toEqual({
      profile: {
        id: expect.any(String),
        nickname: expect.any(String),
        emoji: expect.any(String),
        bot: false,
      },
    });
    expect(again.body).toEqual(first.body);
  });

  it("does not include the secret user id", async () => {
    const res = await request(setup()).get("/api/me").set("X-User-Id", "secret-user-id");

    expect(JSON.stringify(res.body)).not.toContain("secret-user-id");
  });

  it("returns 400 without X-User-Id", async () => {
    const res = await request(setup()).get("/api/me");

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "Missing X-User-Id header" });
  });
});

describe("PUT /api/me", () => {
  it("changes the nickname and emoji and keeps the public id", async () => {
    const app = setup();
    const { body: before } = await request(app).get("/api/me").set("X-User-Id", "u1");

    const res = await put(app, { nickname: "Mum", emoji: "🦄" });
    const after = await request(app).get("/api/me").set("X-User-Id", "u1");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      profile: { id: before.profile.id, nickname: "Mum", emoji: "🦄", bot: false },
    });
    expect(after.body).toEqual(res.body);
  });

  it.each([
    ["no nickname", { emoji: "🦄" }, "nickname is required"],
    ["no emoji", { nickname: "Mum" }, "emoji is required"],
    ["an empty nickname", { nickname: " ", emoji: "🦄" }, "nickname is required"],
    ["a nickname over 30 characters", { nickname: "x".repeat(31), emoji: "🦄" }, "30 characters"],
    ["text as emoji", { nickname: "Mum", emoji: "mum" }, "emoji must be one emoji"],
  ])("returns 400 for %s", async (_name, body, message) => {
    const res = await put(setup(), body);

    expect(res.status).toBe(400);
    expect(res.body.error).toContain(message);
  });

  it("returns 400 for a body that is not an object", async () => {
    const res = await put(setup(), ["Mum"]);

    expect(res.status).toBe(400);
  });

  it("returns 400 without X-User-Id", async () => {
    const res = await request(setup()).put("/api/me").send({ nickname: "Mum", emoji: "🦄" });

    expect(res.status).toBe(400);
  });
});

describe("without a profile service", () => {
  it("does not serve /api/me", async () => {
    const catalog = createMemeCatalog([{ id: "a", caption: "A", file: "works-on-my-machine.svg" }]);
    const app = createApp(createSwipeService(catalog, createInMemorySwipeRepository()));

    const res = await request(app).get("/api/me").set("X-User-Id", "u1");

    expect(res.status).toBe(404);
  });
});
