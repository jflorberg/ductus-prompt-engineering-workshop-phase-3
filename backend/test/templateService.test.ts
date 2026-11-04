import { describe, expect, it, vi } from "vitest";
import { createMemeCatalog } from "../src/memes/catalog.js";
import { createInMemoryImageStore } from "../src/memes/imageStore.js";
import { createMemeService } from "../src/memes/service.js";
import {
  TemplateSourceError,
  type Template,
  type TemplateSource,
} from "../src/templates/source.js";
import {
  createTemplateService,
  InvalidTemplateTextError,
  TEMPLATE_CACHE_MS,
  UnknownTemplateError,
} from "../src/templates/service.js";

const jpeg = { contentType: "image/jpeg", data: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2]) };

const fine: Template = {
  id: "fine",
  name: "This is Fine",
  lines: 2,
  imageUrl: "https://memes.test/fine.png",
  keywords: ["dog", "fire"],
};
const drake: Template = {
  id: "drake",
  name: "Drakeposting",
  lines: 2,
  imageUrl: "https://memes.test/drake.png",
};
const one: Template = {
  id: "one",
  name: "One Line",
  lines: 1,
  imageUrl: "https://memes.test/1.png",
};

function setup(templates: Template[] = [fine, drake, one]) {
  const source = {
    list: vi.fn<TemplateSource["list"]>().mockResolvedValue(templates),
    render: vi.fn<TemplateSource["render"]>().mockResolvedValue(jpeg),
  };
  let time = new Date("2026-01-01T00:00:00Z").getTime();
  const clock = {
    now: () => new Date(time),
    advance: (ms: number) => {
      time += ms;
    },
  };
  const catalog = createMemeCatalog([{ id: "seed", caption: "Seed", file: "seed.svg" }]);
  const memeService = createMemeService(catalog, createInMemoryImageStore());
  const service = createTemplateService(source, memeService, { now: clock.now });
  return { source, clock, catalog, memeService, service };
}

describe("template service: search", () => {
  it.each([
    ["the id", "FINE", ["fine"]],
    ["the name", "drakepost", ["drake"]],
    ["a keyword", "Dog", ["fine"]],
    ["nothing", "zzz", []],
  ])("matches %s case-insensitively", async (_name, query, ids) => {
    const result = await setup().service.search(query);

    expect(result.map((t) => t.id)).toEqual(ids);
  });

  it("returns the first templates in provider order for an empty query", async () => {
    const result = await setup().service.search("  ");

    expect(result.map((t) => t.id)).toEqual(["fine", "drake", "one"]);
  });

  it("returns at most 24 templates", async () => {
    const many = Array.from({ length: 30 }, (_, i) => ({ ...one, id: `t${i}` }));

    const result = await setup(many).service.search("");

    expect(result).toHaveLength(24);
    expect(result[0].id).toBe("t0");
  });

  it("lists the templates once and refreshes them after 24 hours", async () => {
    const { source, clock, service } = setup();

    await service.search("fine");
    clock.advance(TEMPLATE_CACHE_MS - 1);
    await service.search("drake");
    await service.preview("fine", ["a"]);
    expect(source.list).toHaveBeenCalledTimes(1);

    clock.advance(1);
    await service.search("fine");
    expect(source.list).toHaveBeenCalledTimes(2);
  });

  it("does not cache a failure and rethrows it", async () => {
    const { source, service } = setup();
    source.list.mockRejectedValueOnce(new TemplateSourceError("down"));

    await expect(service.search("")).rejects.toBeInstanceOf(TemplateSourceError);
    expect((await service.search("")).length).toBe(3);
    expect(source.list).toHaveBeenCalledTimes(2);
  });
});

describe("template service: preview", () => {
  it("renders the trimmed texts padded to the template's lines and stores nothing", async () => {
    const { source, catalog, service } = setup();

    const image = await service.preview("fine", ["  top  "]);

    expect(image).toEqual(jpeg);
    expect(source.render).toHaveBeenCalledWith("fine", ["top", ""]);
    expect(catalog.list().map((m) => m.id)).toEqual(["seed"]);
  });

  it("throws UnknownTemplateError for an unknown template", async () => {
    await expect(setup().service.preview("nope", ["a"])).rejects.toBeInstanceOf(
      UnknownTemplateError,
    );
  });

  it.each([
    ["texts that are not an array", "top"],
    ["texts that are not strings", ["a", 2]],
    ["more texts than lines", ["a", "b", "c"]],
    ["a text over 100 characters", ["x".repeat(101)]],
    ["only blank texts", ["  ", ""]],
    ["no texts", []],
    ["a joined caption over 140 characters", ["x".repeat(80), "y".repeat(80)]],
  ])("throws InvalidTemplateTextError for %s", async (_name, texts) => {
    const { source, service } = setup();

    await expect(service.preview("fine", texts)).rejects.toBeInstanceOf(InvalidTemplateTextError);
    expect(source.render).not.toHaveBeenCalled();
  });

  it("accepts a text of exactly 100 characters", async () => {
    await expect(setup().service.preview("fine", ["x".repeat(100)])).resolves.toEqual(jpeg);
  });

  it("passes provider failures through", async () => {
    const { source, service } = setup();
    source.render.mockRejectedValueOnce(new TemplateSourceError("down"));

    await expect(service.preview("fine", ["a"])).rejects.toBeInstanceOf(TemplateSourceError);
  });
});

describe("template service: createMeme", () => {
  it("posts the rendered image with the non-empty texts joined as the caption", async () => {
    const { memeService, service } = setup();

    const meme = await service.createMeme("fine", [" This is fine ", ""]);
    const both = await service.createMeme("fine", ["Prod is down", "This is fine"]);

    expect(meme.caption).toBe("This is fine");
    expect(both).toEqual({
      id: expect.stringMatching(/^upload-/),
      caption: "Prod is down / This is fine",
      imageUrl: `/api/memes/uploads/${both.id}`,
    });
    const svg = memeService.getImage(both.id)?.data.toString() ?? "";
    expect(svg).toContain(`data:image/jpeg;base64,${jpeg.data.toString("base64")}`);
    expect(svg).not.toContain("<text");
  });

  it("puts the meme first in the catalog", async () => {
    const { catalog, service } = setup();

    const meme = await service.createMeme("fine", ["a", "b"]);

    expect(catalog.list()[0]).toEqual(meme);
  });

  it("validates like preview and stores nothing on failure", async () => {
    const { source, catalog, service } = setup();
    source.render.mockRejectedValueOnce(new TemplateSourceError("down"));

    await expect(service.createMeme("nope", ["a"])).rejects.toBeInstanceOf(UnknownTemplateError);
    await expect(service.createMeme("one", ["a", "b"])).rejects.toBeInstanceOf(
      InvalidTemplateTextError,
    );
    await expect(service.createMeme("fine", ["a"])).rejects.toBeInstanceOf(TemplateSourceError);
    expect(catalog.list().map((m) => m.id)).toEqual(["seed"]);
  });
});
