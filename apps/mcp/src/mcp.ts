import {
  MESSAGES,
  type Recipe,
  type RecipeListItem,
} from "@cookbook/shared";
import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";

import type { CookbookApi } from "./api.js";

const OFFERED_TOOLS = new Set(["hello", "read", "list", "save"]);

const helloSchema = z.object({
  name: z.string(),
  message: z.string(),
});

const readInput = z.object({
  id: z.string().optional(),
  fields: z.array(z.string()).optional(),
});

const saveInput = z.object({
  id: z.string().optional(),
  title: z.unknown().optional(),
  steps: z.unknown().optional(),
  servings: z.unknown().optional(),
  actor: z.unknown().optional(),
  favorite: z.unknown().optional(),
  rating: z.unknown().optional(),
  ingredients: z.unknown().optional(),
  nutrition: z.unknown().optional(),
});

const readOnly = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const;

const mutating = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: false,
} as const;

function toolError(message: string) {
  return {
    content: [{ type: "text" as const, text: message }],
    isError: true as const,
  };
}

function toolOk(data: unknown, text: string) {
  return {
    content: [{ type: "text" as const, text }],
    structuredContent: data as Record<string, unknown>,
  };
}

function interceptUnknownTools(server: McpServer): void {
  const proto = server.server;
  const setRequestHandler = proto.setRequestHandler.bind(proto);
  proto.setRequestHandler = ((method: string, ...rest: unknown[]) => {
    if (method !== "tools/call") {
      return (setRequestHandler as (method: string, ...args: unknown[]) => void)(
        method,
        ...rest,
      );
    }
    const handler = (rest.length >= 2 ? rest[1] : rest[0]) as (
      request: { params: { name: string } },
      ctx: unknown,
    ) => Promise<unknown>;
    const wrapped = async (
      request: { params: { name: string } },
      ctx: unknown,
    ) => {
      if (!OFFERED_TOOLS.has(request.params.name)) {
        return toolError(MESSAGES.notAvailable);
      }
      return handler(request, ctx);
    };
    if (rest.length >= 2) {
      return (setRequestHandler as (method: string, ...args: unknown[]) => void)(
        method,
        rest[0],
        wrapped,
      );
    }
    return (setRequestHandler as (method: string, ...args: unknown[]) => void)(
      method,
      wrapped,
    );
  }) as typeof proto.setRequestHandler;
}

export function createCookbookMcpServer(api: CookbookApi): McpServer {
  const server = new McpServer(
    {
      name: "cookbook-mcp",
      version: "0.1.0",
      title: "Cookbook",
    },
    {
      instructions:
        "Household cookbook MCP. Tools: read, list, save, and hello.",
    },
  );

  interceptUnknownTools(server);

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

  server.registerTool(
    "read",
    {
      title: "Read recipe",
      description: "Return one visible recipe. Id is required. Optional fields limits the result.",
      inputSchema: readInput,
      annotations: readOnly,
    },
    async ({ id, fields }) => {
      const recipeId = id?.trim();
      if (!recipeId) {
        return toolError(MESSAGES.idRequired);
      }
      const result = await api.read(recipeId, fields);
      if (!result.ok) {
        return toolError(result.message);
      }
      return toolOk(result.value, "Recipe.");
    },
  );

  server.registerTool(
    "list",
    {
      title: "List recipes",
      description: "Return visible recipes as id and title.",
      inputSchema: z.object({}),
      annotations: readOnly,
    },
    async () => {
      const result = await api.list();
      if (!result.ok) {
        return toolError(result.message);
      }
      const body: { recipes: RecipeListItem[] } = { recipes: result.value };
      return toolOk(body, "Recipe list.");
    },
  );

  server.registerTool(
    "save",
    {
      title: "Save recipe",
      description:
        "Create or update a recipe. Required: title, steps, servings, and actor.",
      inputSchema: saveInput,
      annotations: mutating,
    },
    async (input) => {
      const result = await api.save(input as Record<string, unknown>);
      if (!result.ok) {
        return toolError(result.message);
      }
      const recipe: Recipe = result.value;
      return toolOk(recipe, "Saved.");
    },
  );

  return server;
}

export function createCookbookMcpHandler(api: CookbookApi) {
  return createMcpHandler(() => createCookbookMcpServer(api));
}
