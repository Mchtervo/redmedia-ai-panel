/**
 * ChatPlace MCP istemcisi (salt sunucu tarafı — docs/44_CHATPLACE_MCP_INTEGRATION.md).
 *
 * MCP Streamable HTTP taşıması üzerinden JSON-RPC 2.0 konuşur:
 *   initialize → notifications/initialized → tools/list → tools/call
 *
 * Güvenlik kuralları:
 * - CHATPLACE_API_KEY yalnızca burada okunur; asla loglanmaz, asla istemciye
 *   gönderilmez (bkz. .cursor/rules/02-security.mdc).
 * - Authorization header'ı hata mesajlarına/loglara yazılmaz.
 * - Bu istemci YALNIZCA okuma amaçlı senkronizasyonda kullanılır; yazma
 *   (mesaj gönderme, kayıt değiştirme) bilinçli olarak dışarıda bırakıldı.
 */

const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 2;
const RETRY_BASE_DELAY_MS = 750;
const PROTOCOL_VERSION = "2025-06-18";

export function isChatPlaceMcpConfigured(): boolean {
  return Boolean(
    process.env.CHATPLACE_API_KEY?.trim() &&
      process.env.CHATPLACE_MCP_URL?.trim()
  );
}

function getMcpUrl(): string {
  const url = process.env.CHATPLACE_MCP_URL?.trim();
  if (!url) throw new Error("CHATPLACE_MCP_URL tanımlı değil.");
  return url;
}

function getApiKey(): string {
  const key = process.env.CHATPLACE_API_KEY?.trim();
  if (!key) throw new Error("CHATPLACE_API_KEY tanımlı değil.");
  return key;
}

type JsonRpcResponse = {
  jsonrpc: "2.0";
  id?: number | string | null;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
};

export type McpToolDescriptor = {
  name: string;
  description?: string;
  inputSchema?: unknown;
};

export type McpToolCallContent =
  | { type: "text"; text: string }
  | { type: string; [key: string]: unknown };

export type McpToolCallResult = {
  content: McpToolCallContent[];
  structuredContent?: unknown;
  isError?: boolean;
};

/** Hata mesajlarını normalize eder; header/secret asla dahil edilmez. */
export class ChatPlaceMcpError extends Error {
  readonly code:
    | "not_configured"
    | "http_error"
    | "rpc_error"
    | "timeout"
    | "parse_error"
    | "tool_error";
  readonly status?: number;

  constructor(
    code: ChatPlaceMcpError["code"],
    message: string,
    status?: number
  ) {
    super(message);
    this.name = "ChatPlaceMcpError";
    this.code = code;
    this.status = status;
  }
}

/**
 * SSE (text/event-stream) gövdesinden JSON-RPC cevabını çıkarır.
 * Streamable HTTP sunucuları tek isteğe SSE ile de cevap verebilir.
 */
function parseSseBody(body: string): JsonRpcResponse | null {
  for (const rawLine of body.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line.startsWith("data:")) continue;
    const payload = line.slice(5).trim();
    if (!payload || payload === "[DONE]") continue;
    try {
      const parsed: unknown = JSON.parse(payload);
      if (
        typeof parsed === "object" &&
        parsed !== null &&
        "jsonrpc" in parsed &&
        ("result" in parsed || "error" in parsed)
      ) {
        return parsed as JsonRpcResponse;
      }
    } catch {
      // sonraki data satırını dene
    }
  }
  return null;
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || status === 502 || status === 503 || status === 504;
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export class ChatPlaceMcpClient {
  private sessionId: string | null = null;
  private initialized = false;
  private nextId = 1;
  private readonly timeoutMs: number;

  constructor(options?: { timeoutMs?: number }) {
    this.timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  /**
   * Tek JSON-RPC isteği: timeout + 429/5xx için üstel geri çekilmeli retry.
   * 202 (Accepted) bildirimler için normaldir ve gövdesizdir.
   */
  private async rpc(
    method: string,
    params?: Record<string, unknown>,
    options?: { notification?: boolean }
  ): Promise<JsonRpcResponse | null> {
    const isNotification = options?.notification === true;
    const request: Record<string, unknown> = {
      jsonrpc: "2.0",
      method,
      ...(params ? { params } : {}),
      ...(isNotification ? {} : { id: this.nextId++ }),
    };

    let lastError: ChatPlaceMcpError | null = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      if (attempt > 0) {
        await sleep(RETRY_BASE_DELAY_MS * 2 ** (attempt - 1));
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);

      let response: Response;
      try {
        response = await fetch(getMcpUrl(), {
          method: "POST",
          headers: {
            // Authorization değeri hiçbir hata/log çıktısına yazılmaz.
            Authorization: `Bearer ${getApiKey()}`,
            "Content-Type": "application/json",
            Accept: "application/json, text/event-stream",
            "MCP-Protocol-Version": PROTOCOL_VERSION,
            ...(this.sessionId ? { "Mcp-Session-Id": this.sessionId } : {}),
          },
          body: JSON.stringify(request),
          signal: controller.signal,
          cache: "no-store",
        });
      } catch (error) {
        clearTimeout(timer);
        const aborted =
          error instanceof Error && error.name === "AbortError";
        lastError = new ChatPlaceMcpError(
          aborted ? "timeout" : "http_error",
          aborted
            ? `MCP isteği ${this.timeoutMs}ms içinde tamamlanamadı (${method}).`
            : `MCP bağlantı hatası (${method}).`
        );
        continue;
      }
      clearTimeout(timer);

      const newSession = response.headers.get("mcp-session-id");
      if (newSession) this.sessionId = newSession;

      if (!response.ok) {
        // Gövde okunur ama içeriği loglanmaz (hassas veri riski).
        await response.text().catch(() => "");
        const err = new ChatPlaceMcpError(
          "http_error",
          `MCP HTTP ${response.status} (${method}).`,
          response.status
        );
        if (isRetryableStatus(response.status) && attempt < MAX_RETRIES) {
          lastError = err;
          continue;
        }
        throw err;
      }

      if (isNotification || response.status === 202) {
        await response.text().catch(() => "");
        return null;
      }

      const contentType = response.headers.get("content-type") ?? "";
      const bodyText = await response.text();

      let parsed: JsonRpcResponse | null = null;
      if (contentType.includes("text/event-stream")) {
        parsed = parseSseBody(bodyText);
      } else {
        try {
          parsed = JSON.parse(bodyText) as JsonRpcResponse;
        } catch {
          parsed = null;
        }
      }

      if (!parsed) {
        throw new ChatPlaceMcpError(
          "parse_error",
          `MCP cevabı ayrıştırılamadı (${method}).`
        );
      }

      if (parsed.error) {
        throw new ChatPlaceMcpError(
          "rpc_error",
          `MCP hata ${parsed.error.code}: ${parsed.error.message} (${method}).`
        );
      }

      return parsed;
    }

    throw (
      lastError ??
      new ChatPlaceMcpError("http_error", `MCP isteği başarısız (${method}).`)
    );
  }

  /** initialize + initialized bildirimi (bir kez). */
  async connect(): Promise<void> {
    if (this.initialized) return;
    await this.rpc("initialize", {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: "redmedia-ai-panel", version: "1.0.0" },
    });
    await this.rpc("notifications/initialized", undefined, {
      notification: true,
    });
    this.initialized = true;
  }

  /** Sunucunun sunduğu tüm araçları listeler (cursor sayfalamalı). */
  async listTools(): Promise<McpToolDescriptor[]> {
    await this.connect();
    const tools: McpToolDescriptor[] = [];
    let cursor: string | undefined;

    do {
      const response = await this.rpc(
        "tools/list",
        cursor ? { cursor } : {}
      );
      const result = (response?.result ?? {}) as {
        tools?: McpToolDescriptor[];
        nextCursor?: string;
      };
      tools.push(...(result.tools ?? []));
      cursor = result.nextCursor || undefined;
    } while (cursor);

    return tools;
  }

  /** Tek araç çağrısı. Araç hatası isError=true ile döner. */
  async callTool(
    name: string,
    args: Record<string, unknown> = {}
  ): Promise<McpToolCallResult> {
    await this.connect();
    const response = await this.rpc("tools/call", { name, arguments: args });
    const result = (response?.result ?? {}) as McpToolCallResult;
    if (result.isError) {
      const text = result.content
        ?.map((c) => ("text" in c && typeof c.text === "string" ? c.text : ""))
        .join(" ")
        .slice(0, 300);
      throw new ChatPlaceMcpError(
        "tool_error",
        `MCP aracı hata döndü (${name}): ${text || "detay yok"}`
      );
    }
    return result;
  }

  /**
   * Araç cevabındaki ilk text içeriğini JSON olarak ayrıştırır.
   * structuredContent varsa onu tercih eder.
   */
  async callToolJson<T = unknown>(
    name: string,
    args: Record<string, unknown> = {}
  ): Promise<T> {
    const result = await this.callTool(name, args);
    if (result.structuredContent !== undefined) {
      return result.structuredContent as T;
    }
    for (const item of result.content ?? []) {
      if (item.type === "text" && typeof item.text === "string") {
        try {
          return JSON.parse(item.text) as T;
        } catch {
          return item.text as T;
        }
      }
    }
    throw new ChatPlaceMcpError(
      "parse_error",
      `MCP aracı içerik döndürmedi (${name}).`
    );
  }
}
