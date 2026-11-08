import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import {
  Client,
  StreamableHTTPClientTransport,
} from "@modelcontextprotocol/client";

import { verifies } from "@cookbook/test";

import { listen } from "../src/http.ts";
import { TEST_TOKEN, testConfig } from "./helpers.ts";

async function connectClient(url: string): Promise<Client> {
  const client = new Client({ name: "cookbook-mcp-test", version: "0.0.0" });
  const transport = new StreamableHTTPClientTransport(new URL(`${url}/mcp`), {
    requestInit: {
      headers: {
        authorization: `Bearer ${TEST_TOKEN}`,
      },
    },
  });
  await client.connect(transport);
  return client;
}

describe("mcp hello over streamable HTTP", () => {
  let baseUrl = "";
  let close: () => Promise<void> = async () => {};

  before(async () => {
    const { server, url } = await listen(testConfig());
    baseUrl = url;
    close = () =>
      new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
  });

  after(async () => {
    await close();
  });

  it("exposes hello, recipe tools, and cooking-session tools", async () => {
    const client = await connectClient(baseUrl);
    try {
      const listed = await client.listTools();
      assert.deepEqual(
        listed.tools.map((tool) => tool.name),
        [
          "hello",
          "read",
          "list",
          "save",
          "session_resume",
          "session_start",
          "session_finish",
          "session_show",
          "session_complete",
          "session_undo",
        ],
      );
      const hello = listed.tools.find((tool) => tool.name === "hello");
      assert.equal(hello?.annotations?.readOnlyHint, true);
      assert.equal(hello?.annotations?.destructiveHint, false);
    } finally {
      await client.close();
    }
  });

  it(
    "calls hello",
    verifies("142", "cf0c8fb4dd16c601", async () => {
    const client = await connectClient(baseUrl);
    try {
      const result = await client.callTool({ name: "hello", arguments: {} });
      assert.equal(result.isError, undefined);
      const structured = result.structuredContent as {
        name: string;
        message: string;
      };
      assert.equal(structured.name, "cookbook-mcp");
      assert.equal(structured.message, "Cookbook MCP is up.");
    } finally {
      await client.close();
    }
    }),
  );
});
