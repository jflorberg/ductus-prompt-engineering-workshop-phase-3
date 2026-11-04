import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { describe, expect, it, vi } from "vitest";
import { MemeTinderError, type MemeTinderClient } from "../src/client.js";
import { createServer } from "../src/server.js";

const fine = { id: "fine", name: "This is Fine", lines: 2, imageUrl: "https://x/fine.png" };
const created = {
  id: "upload-1",
  caption: "Vibecoding / This is fine",
  imageUrl: "http://localhost:3000/api/memes/uploads/upload-1",
};

async function setup() {
  const fake = {
    searchTemplates: vi.fn<MemeTinderClient["searchTemplates"]>().mockResolvedValue([fine]),
    createMemeFromTemplate: vi
      .fn<MemeTinderClient["createMemeFromTemplate"]>()
      .mockResolvedValue(created),
  };
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await createServer(fake).connect(serverTransport);
  const mcp = new Client({ name: "test", version: "0.0.0" });
  await mcp.connect(clientTransport);
  return { fake, mcp };
}

/** The text content of a tool result. */
const textOf = (result: Awaited<ReturnType<Client["callTool"]>>) =>
  (result.content as { type: string; text: string }[]).map((c) => c.text).join("\n");

describe("MCP server", () => {
  it("lists both tools, telling the model to search first and how to write texts", async () => {
    const { mcp } = await setup();

    const { tools } = await mcp.listTools();

    expect(tools.map((t) => t.name).sort()).toEqual(["create_meme", "search_templates"]);
    const search = tools.find((t) => t.name === "search_templates");
    const create = tools.find((t) => t.name === "create_meme");
    expect(search?.description).toMatch(/first/);
    expect(search?.description).toMatch(/lines/);
    expect(create?.description).toMatch(/top to bottom/);
    expect(create?.description).toMatch(/100 characters/);
    expect(create?.inputSchema.required).toEqual(["templateId", "texts"]);
  });

  it("search_templates returns id, name and lines as text", async () => {
    const { fake, mcp } = await setup();

    const result = await mcp.callTool({ name: "search_templates", arguments: { query: "fine" } });

    expect(fake.searchTemplates).toHaveBeenCalledWith("fine");
    expect(result.isError).toBeFalsy();
    expect(textOf(result)).toBe("- id: fine | name: This is Fine | lines: 2");
  });

  it("search_templates says when nothing matches", async () => {
    const { fake, mcp } = await setup();
    fake.searchTemplates.mockResolvedValue([]);

    const result = await mcp.callTool({ name: "search_templates", arguments: { query: "zzz" } });

    expect(textOf(result)).toMatch(/No templates match "zzz"/);
  });

  it("create_meme returns the caption and the full image URL", async () => {
    const { fake, mcp } = await setup();

    const result = await mcp.callTool({
      name: "create_meme",
      arguments: { templateId: "fine", texts: ["Vibecoding", "This is fine"] },
    });

    expect(fake.createMemeFromTemplate).toHaveBeenCalledWith("fine", [
      "Vibecoding",
      "This is fine",
    ]);
    expect(result.isError).toBeFalsy();
    expect(textOf(result)).toContain(created.caption);
    expect(textOf(result)).toContain(created.imageUrl);
  });

  it.each([
    ["search_templates", { query: "x" }, "searchTemplates"],
    ["create_meme", { templateId: "nope", texts: ["a"] }, "createMemeFromTemplate"],
  ] as const)("%s returns API errors as tool errors", async (name, args, method) => {
    const { fake, mcp } = await setup();
    fake[method].mockRejectedValue(new MemeTinderError("Unknown template: nope"));

    const result = await mcp.callTool({ name, arguments: args });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toBe("Unknown template: nope");
  });
});
