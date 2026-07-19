/**
 * ChatPlace MCP cevap şekli keşfi (alan adları için, geliştirme amaçlı).
 * Kullanım: npx tsx --env-file=.env.local scripts/chatplace-mcp-probe.ts
 * Kişisel veri minimizasyonu: değerler kısaltılır.
 */
import { ChatPlaceMcpClient } from "../src/server/chatplace/mcp-client";

function sanitize(value: unknown, depth = 0): unknown {
  if (depth > 6) return "…";
  if (Array.isArray(value)) {
    return value.slice(0, 2).map((v) => sanitize(v, depth + 1));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [
        k,
        sanitize(v, depth + 1),
      ])
    );
  }
  if (typeof value === "string" && value.length > 60) {
    return `${value.slice(0, 57)}…`;
  }
  return value;
}

async function main() {
  const client = new ChatPlaceMcpClient({ timeoutMs: 20_000 });

  const chats = await client.callToolJson("chats_list", { limit: 2 });
  console.log("=== chats_list (limit 2) ===");
  console.log(JSON.stringify(sanitize(chats), null, 2));

  const chatsObj = chats as {
    chats?: Array<Record<string, unknown>>;
    items?: Array<Record<string, unknown>>;
    data?: Array<Record<string, unknown>>;
  };
  const list = chatsObj.chats ?? chatsObj.items ?? chatsObj.data ?? [];
  const first = Array.isArray(list) ? list[0] : undefined;
  const chatId =
    first && typeof first === "object"
      ? String(
          (first as Record<string, unknown>).id ??
            (first as Record<string, unknown>).uuid ??
            ""
        )
      : "";

  if (chatId) {
    const detail = await client.callToolJson("chats_get", { chatId });
    console.log("\n=== chats_get ===");
    console.log(JSON.stringify(sanitize(detail), null, 2));

    const messages = await client.callToolJson("chats_messages", {
      chatId,
      page: 1,
      limit: 3,
    });
    console.log("\n=== chats_messages (limit 3) ===");
    console.log(JSON.stringify(sanitize(messages), null, 2));
  } else {
    console.log("\nChat bulunamadı; chats_get/chats_messages atlandı.");
  }

  const bots = await client.callToolJson("bots_list", {});
  console.log("\n=== bots_list ===");
  console.log(JSON.stringify(sanitize(bots), null, 2));
}

main().catch((error) => {
  console.error(
    "Probe hatası:",
    error instanceof Error ? error.message : "bilinmeyen"
  );
  process.exit(1);
});
