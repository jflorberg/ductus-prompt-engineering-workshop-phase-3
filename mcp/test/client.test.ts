import { describe, expect, it, vi } from "vitest";
import { createMemeTinderClient, MemeTinderError } from "../src/client.js";

const BASE = "http://memes.test:3000";
const fine = { id: "fine", name: "This is Fine", lines: 2, imageUrl: "https://x/fine.png" };

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

function setup(response: Response | Error) {
  const fetchMock = vi.fn<typeof fetch>(async () => {
    if (response instanceof Error) throw response;
    return response;
  });
  const client = createMemeTinderClient({
    fetch: fetchMock,
    baseUrl: `${BASE}/`,
    userId: "agent-test",
  });
  return { fetch: fetchMock, client };
}

describe("Meme-Tinder client", () => {
  it("searches templates with the query and the user id header", async () => {
    const { fetch, client } = setup(json({ templates: [fine] }));

    const templates = await client.searchTemplates("this is fine");

    expect(templates).toEqual([fine]);
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe(`${BASE}/api/templates?q=this+is+fine`);
    expect(new Headers(init?.headers).get("X-User-Id")).toBe("agent-test");
  });

  it("creates a meme and returns its absolute image URL", async () => {
    const created = { id: "upload-1", caption: "a / b", imageUrl: "/api/memes/uploads/upload-1" };
    const { fetch, client } = setup(json(created, 201));

    const meme = await client.createMemeFromTemplate("fine", ["a", "b"]);

    expect(meme).toEqual({ ...created, imageUrl: `${BASE}/api/memes/uploads/upload-1` });
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe(`${BASE}/api/memes/from-template`);
    expect(init?.method).toBe("POST");
    const headers = new Headers(init?.headers);
    expect(headers.get("X-User-Id")).toBe("agent-test");
    expect(headers.get("Content-Type")).toBe("application/json");
    expect(JSON.parse(String(init?.body))).toEqual({ templateId: "fine", texts: ["a", "b"] });
  });

  it("throws the API's error message", async () => {
    const { client } = setup(json({ error: "Unknown template: nope" }, 400));

    await expect(client.createMemeFromTemplate("nope", ["a"])).rejects.toThrow(
      new MemeTinderError("Unknown template: nope"),
    );
  });

  it("throws the status when the error has no JSON body", async () => {
    const { client } = setup(new Response("oops", { status: 500 }));

    await expect(client.searchTemplates("")).rejects.toThrow("HTTP 500");
  });

  it("throws a clear error when the backend is unreachable", async () => {
    const { client } = setup(new TypeError("fetch failed"));

    const error = await client.searchTemplates("").catch((err: unknown) => err);

    expect(error).toBeInstanceOf(MemeTinderError);
    expect((error as Error).message).toMatch(/Could not reach Meme-Tinder/);
  });

  it("throws on a success response that is not JSON", async () => {
    const { client } = setup(new Response("<html>", { status: 200 }));

    await expect(client.searchTemplates("")).rejects.toBeInstanceOf(MemeTinderError);
  });
});
