import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { MemeTinderClient } from "./client.js";

const MAX_TEXT_LENGTH = 100;

const text = (value: string) => ({ content: [{ type: "text" as const, text: value }] });
const toolError = (err: unknown) => ({
  ...text(err instanceof Error ? err.message : "Unknown error"),
  isError: true,
});

/** An MCP server with the Meme-Tinder tools. Every tool is a thin call to the client. */
export function createServer(client: MemeTinderClient): McpServer {
  const server = new McpServer({ name: "meme-tinder", version: "0.1.0" });

  server.registerTool(
    "search_templates",
    {
      title: "Search meme templates",
      description:
        "Search Meme-Tinder's meme templates (for example 'this is fine', 'drake', 'distracted'). " +
        "Call this first, before create_meme, to find the template id. Each result has its id, " +
        "name and number of text lines; pass exactly that many texts (or fewer) to create_meme. " +
        "An empty query lists popular templates.",
      inputSchema: { query: z.string().describe("Words to search for in template names") },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ query }) => {
      try {
        const templates = await client.searchTemplates(query);
        if (templates.length === 0) return text(`No templates match "${query}". Try other words.`);
        return text(
          templates.map((t) => `- id: ${t.id} | name: ${t.name} | lines: ${t.lines}`).join("\n"),
        );
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.registerTool(
    "create_meme",
    {
      title: "Create a meme",
      description:
        "Create a meme from a template and post it to Meme-Tinder, where it goes first in every " +
        "user's pile. Use a templateId from search_templates. texts go top to bottom, one per " +
        `template line (at most the template's lines count). Keep each one short and punchy, ` +
        `at most ${MAX_TEXT_LENGTH} characters. Returns the caption and the image URL.`,
      inputSchema: {
        templateId: z
          .string()
          .describe("The template id from search_templates, for example 'fine'"),
        texts: z
          .array(z.string().max(MAX_TEXT_LENGTH))
          .min(1)
          .describe("The text for each line, top to bottom"),
      },
      annotations: { readOnlyHint: false, openWorldHint: true },
    },
    async ({ templateId, texts }) => {
      try {
        const meme = await client.createMemeFromTemplate(templateId, texts);
        return text(`Posted "${meme.caption}" to Meme-Tinder.\nImage: ${meme.imageUrl}`);
      } catch (err) {
        return toolError(err);
      }
    },
  );

  return server;
}
