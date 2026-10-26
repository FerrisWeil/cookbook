import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";

const helloSchema = z.object({
  name: z.string(),
  message: z.string(),
});

const readOnly = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const;

export function createCookbookMcpServer(): McpServer {
  const server = new McpServer(
    {
      name: "cookbook-mcp",
      version: "0.1.0",
      title: "Cookbook",
    },
    {
      instructions:
        "Household cookbook MCP. Foundation tools only: hello. Recipe read/save comes later.",
    },
  );

  server.registerTool(
    "hello",
    {
      title: "Hello",
      description: "Return a greeting so Chef can check that the cookbook MCP is up.",
      inputSchema: z.object({}),
      outputSchema: helloSchema,
      annotations: readOnly,
    },
    async () => {
      const result = {
        name: "cookbook-mcp",
        message: "Cookbook MCP is up.",
      };
      return {
        content: [{ type: "text" as const, text: result.message }],
        structuredContent: result,
      };
    },
  );

  return server;
}

export function createCookbookMcpHandler() {
  return createMcpHandler(() => createCookbookMcpServer());
}
