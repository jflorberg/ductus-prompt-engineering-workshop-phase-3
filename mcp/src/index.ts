#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createMemeTinderClient } from "./client.js";
import { createServer } from "./server.js";

// stdout is the MCP protocol channel: never write to it directly. Logs go to stderr.
const baseUrl = process.env.MEME_TINDER_URL ?? "http://localhost:3000";
const userId = process.env.MEME_TINDER_USER_ID ?? "agent-claude";

const server = createServer(createMemeTinderClient({ baseUrl, userId }));

server
  .connect(new StdioServerTransport())
  .then(() => console.error(`Meme-Tinder MCP server ready (API: ${baseUrl}, user: ${userId})`))
  .catch((err: unknown) => {
    console.error("Meme-Tinder MCP server failed to start:", err);
    process.exit(1);
  });
