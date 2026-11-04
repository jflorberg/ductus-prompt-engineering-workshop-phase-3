import { describe, expect, it, vi } from "vitest";
import { MAX_IMAGE_BYTES } from "../src/memes/service.js";
import { createMemegenSource } from "../src/templates/memegen.js";
import { TemplateSourceError } from "../src/templates/source.js";

const BASE = "https://memegen.test";
const jpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
const image = (bytes: Uint8Array<ArrayBuffer>, contentType = "image/jpeg") =>
  new Response(bytes, { status: 200, headers: { "Content-Type": contentType } });

/** A fake fetch that answers each call with the next response (or throws it if it is an Error). */
function fakeFetch(...responses: (Response | Error)[]) {
  return vi.fn<typeof fetch>(async () => {
    const next = responses.shift();
    if (!next) throw new Error("unexpected request");
    if (next instanceof Error) throw next;
    return next;
  });
}

describe("memegen source: list", () => {
  it("maps the templates and skips entries it cannot use", async () => {
    const fetch = fakeFetch(
      json([
        {
          id: "fine",
          name: "This is Fine",
          lines: 2,
          blank: `${BASE}/images/fine.png`,
          example: { text: ["a", "b"], url: "x" },
          keywords: ["dog", 3],
        },
        { id: "nolines", blank: `${BASE}/images/nolines.png` },
        { name: "no id", lines: 2, blank: "x" },
      ]),
    );

    const templates = await createMemegenSource({ fetch, baseUrl: `${BASE}/` }).list();

    expect(fetch).toHaveBeenCalledWith(`${BASE}/templates/`, expect.any(Object));
    expect(fetch.mock.calls[0][1]?.signal).toBeInstanceOf(AbortSignal);
    expect(templates).toEqual([
      {
        id: "fine",
        name: "This is Fine",
        lines: 2,
        imageUrl: `${BASE}/images/fine.png`,
        keywords: ["dog"],
      },
      {
        id: "nolines",
        name: "nolines",
        lines: 2,
        imageUrl: `${BASE}/images/nolines.png`,
        keywords: [],
      },
    ]);
  });

  it.each([
    ["a non-2xx response", () => fakeFetch(json({ error: "x" }, 500))],
    ["a network error", () => fakeFetch(new TypeError("fetch failed"))],
    ["a timeout", () => fakeFetch(new DOMException("timed out", "TimeoutError"))],
    ["a body that is not a list", () => fakeFetch(json({ templates: [] }))],
    ["invalid JSON", () => fakeFetch(new Response("<html>", { status: 200 }))],
  ])("throws TemplateSourceError for %s", async (_name, makeFetch) => {
    await expect(
      createMemegenSource({ fetch: makeFetch(), baseUrl: BASE }).list(),
    ).rejects.toBeInstanceOf(TemplateSourceError);
  });
});

describe("memegen source: render", () => {
  it("posts the texts, then downloads the image at width 600", async () => {
    const fetch = fakeFetch(json({ url: `${BASE}/images/fine/a/b.jpg` }, 201), image(jpegBytes));

    const result = await createMemegenSource({ fetch, baseUrl: BASE }).render("fine", ["a?", "b"]);

    const [postUrl, postInit] = fetch.mock.calls[0];
    expect(postUrl).toBe(`${BASE}/images`);
    expect(postInit?.method).toBe("POST");
    expect(JSON.parse(String(postInit?.body))).toEqual({
      template_id: "fine",
      text: ["a?", "b"],
      extension: "jpg",
    });
    expect(fetch.mock.calls[1][0]).toBe(`${BASE}/images/fine/a/b.jpg?width=600`);
    expect(fetch.mock.calls[1][1]?.signal).toBeInstanceOf(AbortSignal);
    expect(result).toEqual({ contentType: "image/jpeg", data: Buffer.from(jpegBytes) });
  });

  it("accepts a PNG", async () => {
    const fetch = fakeFetch(json({ url: `${BASE}/i.png` }), image(jpegBytes, "image/png"));

    const result = await createMemegenSource({ fetch, baseUrl: BASE }).render("fine", ["a"]);

    expect(result.contentType).toBe("image/png");
  });

  it.each([
    ["a non-2xx render response", () => fakeFetch(json({ error: "x" }, 404))],
    ["a render response without a url", () => fakeFetch(json({}))],
    ["a network error", () => fakeFetch(new TypeError("fetch failed"))],
    [
      "a timeout on the download",
      () =>
        fakeFetch(json({ url: `${BASE}/i.jpg` }), new DOMException("timed out", "TimeoutError")),
    ],
    [
      "a non-2xx download",
      () => fakeFetch(json({ url: `${BASE}/i.jpg` }), new Response("x", { status: 500 })),
    ],
    [
      "a download that is not PNG or JPEG",
      () => fakeFetch(json({ url: `${BASE}/i.svg` }), image(jpegBytes, "image/svg+xml")),
    ],
    [
      "a download over 1 MB",
      () => fakeFetch(json({ url: `${BASE}/i.jpg` }), image(new Uint8Array(MAX_IMAGE_BYTES + 1))),
    ],
  ])("throws TemplateSourceError for %s", async (_name, makeFetch) => {
    const source = createMemegenSource({ fetch: makeFetch(), baseUrl: BASE });

    await expect(source.render("fine", ["a"])).rejects.toBeInstanceOf(TemplateSourceError);
  });
});
