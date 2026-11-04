import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";
import { createMemeCatalog } from "../src/memes/catalog.js";
import { createInMemoryImageStore } from "../src/memes/imageStore.js";
import { createMemeService } from "../src/memes/service.js";
import { createInMemorySwipeRepository } from "../src/swipes/repository.js";
import { createSwipeService } from "../src/swipes/service.js";
import { TemplateSourceError, type TemplateSource } from "../src/templates/source.js";
import { createTemplateService } from "../src/templates/service.js";

const jpeg = { contentType: "image/jpeg", data: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2]) };
const fine = {
  id: "fine",
  name: "This is Fine",
  lines: 2,
  imageUrl: "https://memes.test/fine.png",
  keywords: ["dog"],
};
const PROVIDER_DETAIL = "https://memes.test/secret connect ECONNREFUSED";

function setup() {
  const source = {
    list: vi.fn<TemplateSource["list"]>().mockResolvedValue([fine]),
    render: vi.fn<TemplateSource["render"]>().mockResolvedValue(jpeg),
  };
  const catalog = createMemeCatalog([{ id: "a", caption: "A", file: "works-on-my-machine.svg" }]);
  const swipeService = createSwipeService(catalog, createInMemorySwipeRepository());
  const memeService = createMemeService(catalog, createInMemoryImageStore());
  const templateService = createTemplateService(source, memeService);
  const app = createApp(swipeService, { memeService, templateService });
  return { app, source };
}

const fail = (source: ReturnType<typeof setup>["source"]) => {
  source.list.mockRejectedValue(new TemplateSourceError(PROVIDER_DETAIL));
  source.render.mockRejectedValue(new TemplateSourceError(PROVIDER_DETAIL));
};

const expectUnavailable = (res: request.Response) => {
  expect(res.status).toBe(502);
  expect(res.body.error).toMatch(/unavailable/);
  expect(JSON.stringify(res.body)).not.toContain("memes.test");
  expect(JSON.stringify(res.body)).not.toContain("ECONNREFUSED");
};

describe("GET /api/templates", () => {
  it("returns 200 with the matching templates, without keywords", async () => {
    const res = await request(setup().app).get("/api/templates?q=dog").set("X-User-Id", "u1");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      templates: [{ id: "fine", name: "This is Fine", lines: 2, imageUrl: fine.imageUrl }],
    });
  });

  it("returns every template without a query", async () => {
    const res = await request(setup().app).get("/api/templates").set("X-User-Id", "u1");

    expect(res.body.templates).toHaveLength(1);
  });

  it("returns 400 without a user id", async () => {
    const res = await request(setup().app).get("/api/templates");

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/X-User-Id/);
  });

  it("returns 502 without leaking details when the provider fails", async () => {
    const { app, source } = setup();
    fail(source);

    expectUnavailable(await request(app).get("/api/templates").set("X-User-Id", "u1"));
  });
});

describe("GET /api/templates/:id/preview", () => {
  it("returns 200 with the image and its headers, without a user id", async () => {
    const { app, source } = setup();

    const res = await request(app).get("/api/templates/fine/preview?text=top&text=bottom");

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toBe("image/jpeg");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["cache-control"]).toBe("public, max-age=3600");
    expect(Buffer.from(res.body)).toEqual(jpeg.data);
    expect(source.render).toHaveBeenCalledWith("fine", ["top", "bottom"]);
  });

  it("accepts a single text", async () => {
    const { app, source } = setup();

    const res = await request(app).get("/api/templates/fine/preview?text=only");

    expect(res.status).toBe(200);
    expect(source.render).toHaveBeenCalledWith("fine", ["only", ""]);
  });

  it("returns 404 for an unknown template", async () => {
    const res = await request(setup().app).get("/api/templates/nope/preview?text=a");

    expect(res.status).toBe(404);
    expect(res.body.error).toEqual(expect.any(String));
  });

  it.each([
    ["no text", ""],
    ["too many lines", "?text=a&text=b&text=c"],
    ["a line over 100 characters", `?text=${"x".repeat(101)}`],
  ])("returns 400 for %s", async (_name, query) => {
    const res = await request(setup().app).get(`/api/templates/fine/preview${query}`);

    expect(res.status).toBe(400);
    expect(res.body.error).toEqual(expect.any(String));
  });

  it("returns 502 without leaking details when the provider fails", async () => {
    const { app, source } = setup();
    fail(source);

    expectUnavailable(await request(app).get("/api/templates/fine/preview?text=a"));
  });
});

describe("POST /api/memes/from-template", () => {
  const post = (app: ReturnType<typeof setup>["app"], body: object) =>
    request(app).post("/api/memes/from-template").set("X-User-Id", "u1").send(body);

  it("returns 201 with the new meme, first in another user's pile", async () => {
    const { app } = setup();

    const res = await post(app, { templateId: "fine", texts: ["Prod is down", "This is fine"] });
    const next = await request(app).get("/api/memes/next").set("X-User-Id", "u2");

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      id: expect.any(String),
      caption: "Prod is down / This is fine",
      imageUrl: expect.stringContaining(res.body.id),
    });
    expect(next.body.meme).toEqual(res.body);
  });

  it("serves the created meme as an SVG with the rendered image and no caption band", async () => {
    const { app } = setup();
    const { body: meme } = await post(app, { templateId: "fine", texts: ["a", "b"] });

    const image = await request(app).get(meme.imageUrl);

    expect(image.headers["content-type"]).toContain("image/svg+xml");
    expect(image.body.toString()).toContain("data:image/jpeg;base64,");
    expect(image.body.toString()).not.toContain("<text");
  });

  it("returns 400 without a user id", async () => {
    const res = await request(setup().app)
      .post("/api/memes/from-template")
      .send({ templateId: "fine", texts: ["a"] });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/X-User-Id/);
  });

  it.each([
    ["a missing templateId", { texts: ["a"] }, /templateId/],
    ["an unknown templateId", { templateId: "nope", texts: ["a"] }, /template/i],
    ["missing texts", { templateId: "fine" }, /texts/],
    ["blank texts", { templateId: "fine", texts: [" "] }, /line/],
    ["too many texts", { templateId: "fine", texts: ["a", "b", "c"] }, /line/],
  ])("returns 400 for %s", async (_name, body, error) => {
    const res = await post(setup().app, body);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(error);
  });

  it("returns 502 without leaking details when the provider fails", async () => {
    const { app, source } = setup();
    fail(source);

    expectUnavailable(await post(app, { templateId: "fine", texts: ["a"] }));
  });

  it("returns 502 when the provider sends an image we do not accept", async () => {
    const { app, source } = setup();
    source.render.mockResolvedValue({ contentType: "image/jpeg", data: Buffer.from("nope") });

    expectUnavailable(await post(app, { templateId: "fine", texts: ["a"] }));
  });
});

describe("without a template service", () => {
  it("does not register the template routes", async () => {
    const catalog = createMemeCatalog();
    const app = createApp(createSwipeService(catalog, createInMemorySwipeRepository()));

    const res = await request(app).get("/api/templates").set("X-User-Id", "u1");

    expect(res.status).toBe(404);
  });
});
