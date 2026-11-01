import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import {
  Client,
  StreamableHTTPClientTransport,
} from "@modelcontextprotocol/client";

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

  it("exposes only the hello tool", async () => {
    const client = await connectClient(baseUrl);
    try {
      const listed = await client.listTools();
      assert.deepEqual(
        listed.tools.map((tool) => tool.name),
        ["hello"],
      );
      assert.equal(listed.tools[0]?.annotations?.readOnlyHint, true);
      assert.equal(listed.tools[0]?.annotations?.destructiveHint, false);
    } finally {
      await client.close();
    }
  });

  it("req:6.4.2 calls hello", async () => {
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
  });
});
