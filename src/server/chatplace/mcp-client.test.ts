import { afterEach, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import {
  ChatPlaceMcpClient,
  ChatPlaceMcpError,
  isChatPlaceMcpConfigured,
} from "./mcp-client";

const originalFetch = globalThis.fetch;

type RecordedRequest = {
  url: string;
  headers: Record<string, string>;
  body: Record<string, unknown>;
};

function jsonResponse(payload: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });
}

function rpcResult(result: unknown): unknown {
  return { jsonrpc: "2.0", id: 1, result };
}

/** initialize + initialized bildirimi için standart iki cevap. */
function handshakeResponses(): Response[] {
  return [
    jsonResponse(rpcResult({ protocolVersion: "2025-06-18" })),
    new Response(null, { status: 202 }),
  ];
}

function mockFetch(responses: Response[]): RecordedRequest[] {
  const recorded: RecordedRequest[] = [];
  let index = 0;
  globalThis.fetch = (async (
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> => {
    const headers = Object.fromEntries(
      Object.entries((init?.headers ?? {}) as Record<string, string>)
    );
    recorded.push({
      url: String(input),
      headers,
      body: JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>,
    });
    const response = responses[Math.min(index, responses.length - 1)];
    index++;
    return response.clone();
  }) as typeof fetch;
  return recorded;
}

beforeEach(() => {
  process.env.CHATPLACE_API_KEY = "test-api-key-not-real";
  process.env.CHATPLACE_MCP_URL = "https://mcp.example.test/mcp";
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  delete process.env.CHATPLACE_API_KEY;
  delete process.env.CHATPLACE_MCP_URL;
});

test("yapılandırma kontrolü: iki değişken de gerekli", () => {
  assert.equal(isChatPlaceMcpConfigured(), true);
  delete process.env.CHATPLACE_MCP_URL;
  assert.equal(isChatPlaceMcpConfigured(), false);
});

test("Authorization header'ı Bearer + API key ile kurulur", async () => {
  const recorded = mockFetch(handshakeResponses());
  const client = new ChatPlaceMcpClient();
  await client.connect();

  assert.ok(recorded.length >= 1);
  assert.equal(
    recorded[0].headers.Authorization,
    "Bearer test-api-key-not-real"
  );
  assert.equal(recorded[0].headers["Content-Type"], "application/json");
});

test("hata mesajları API anahtarını asla içermez", async () => {
  mockFetch([new Response("boom", { status: 500 })]);
  const client = new ChatPlaceMcpClient();

  await assert.rejects(
    () => client.connect(),
    (error: unknown) => {
      assert.ok(error instanceof ChatPlaceMcpError);
      assert.ok(!error.message.includes("test-api-key-not-real"));
      assert.ok(!error.message.toLowerCase().includes("authorization"));
      return true;
    }
  );
});

test("tools/list cursor sayfalamasını takip eder", async () => {
  const recorded = mockFetch([
    ...handshakeResponses(),
    jsonResponse(
      rpcResult({ tools: [{ name: "a" }], nextCursor: "cursor-2" })
    ),
    jsonResponse(rpcResult({ tools: [{ name: "b" }] })),
  ]);
  const client = new ChatPlaceMcpClient();
  const tools = await client.listTools();

  assert.deepEqual(
    tools.map((t) => t.name),
    ["a", "b"]
  );
  const listCalls = recorded.filter((r) => r.body.method === "tools/list");
  assert.equal(listCalls.length, 2);
  assert.deepEqual(listCalls[1].body.params, { cursor: "cursor-2" });
});

test("429 rate limit cevabında yeniden dener ve başarır", async () => {
  const recorded = mockFetch([
    new Response("slow down", { status: 429 }),
    ...handshakeResponses(),
  ]);
  const client = new ChatPlaceMcpClient();
  await client.connect();
  // 1 başarısız + 1 başarılı initialize + 1 bildirim
  assert.equal(
    recorded.filter((r) => r.body.method === "initialize").length,
    2
  );
});

test("400 gibi kalıcı hatada yeniden denemez", async () => {
  const recorded = mockFetch([new Response("bad", { status: 400 })]);
  const client = new ChatPlaceMcpClient();
  await assert.rejects(() => client.connect(), ChatPlaceMcpError);
  assert.equal(recorded.length, 1);
});

test("bozuk (JSON olmayan) MCP cevabı parse_error üretir", async () => {
  mockFetch([
    ...handshakeResponses(),
    new Response("<<not json>>", {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
  ]);
  const client = new ChatPlaceMcpClient();
  await assert.rejects(
    () => client.callTool("chats_list"),
    (error: unknown) =>
      error instanceof ChatPlaceMcpError && error.code === "parse_error"
  );
});

test("araç isError=true dönerse tool_error fırlatılır", async () => {
  mockFetch([
    ...handshakeResponses(),
    jsonResponse(
      rpcResult({
        isError: true,
        content: [{ type: "text", text: "tool yok" }],
      })
    ),
  ]);
  const client = new ChatPlaceMcpClient();
  await assert.rejects(
    () => client.callTool("nonexistent_tool"),
    (error: unknown) =>
      error instanceof ChatPlaceMcpError && error.code === "tool_error"
  );
});

test("SSE (text/event-stream) cevabı ayrıştırılır", async () => {
  mockFetch([
    new Response(
      `event: message\ndata: ${JSON.stringify(rpcResult({ ok: true }))}\n\n`,
      {
        status: 200,
        headers: { "content-type": "text/event-stream" },
      }
    ),
    new Response(null, { status: 202 }),
  ]);
  const client = new ChatPlaceMcpClient();
  await client.connect();
});

test("callToolJson structuredContent'i tercih eder", async () => {
  mockFetch([
    ...handshakeResponses(),
    jsonResponse(
      rpcResult({
        content: [{ type: "text", text: '{"from":"text"}' }],
        structuredContent: { from: "structured" },
      })
    ),
  ]);
  const client = new ChatPlaceMcpClient();
  const data = await client.callToolJson<{ from: string }>("chats_list");
  assert.equal(data.from, "structured");
});

test("boş sonuç listesi sorunsuz döner", async () => {
  mockFetch([
    ...handshakeResponses(),
    jsonResponse(
      rpcResult({
        content: [{ type: "text", text: '{"items":[],"hasNextItems":false}' }],
      })
    ),
  ]);
  const client = new ChatPlaceMcpClient();
  const data = await client.callToolJson<{ items: unknown[] }>("chats_list");
  assert.deepEqual(data.items, []);
});
