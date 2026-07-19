/**
 * ChatPlace MCP bağlantı ve araç keşif raporu.
 * Kullanım: npx tsx --env-file=.env.local scripts/chatplace-mcp-report.ts
 *
 * GÜVENLİK: API anahtarı veya Authorization header'ı asla yazdırılmaz.
 */
import {
  ChatPlaceMcpClient,
  isChatPlaceMcpConfigured,
} from "../src/server/chatplace/mcp-client";

async function main() {
  console.log("=== ChatPlace MCP Raporu ===");
  console.log(
    `CHATPLACE_MCP_URL: ${process.env.CHATPLACE_MCP_URL?.trim() || "(eksik)"}`
  );
  console.log(
    `CHATPLACE_API_KEY: ${
      process.env.CHATPLACE_API_KEY?.trim() ? "tanımlı" : "(eksik)"
    }`
  );

  if (!isChatPlaceMcpConfigured()) {
    console.error("Yapılandırma eksik; çıkılıyor.");
    process.exit(1);
  }

  const client = new ChatPlaceMcpClient({ timeoutMs: 20_000 });

  try {
    await client.connect();
    console.log("initialize: OK");
  } catch (error) {
    console.error(
      "initialize BAŞARISIZ:",
      error instanceof Error ? error.message : "bilinmeyen"
    );
    process.exit(1);
  }

  const tools = await client.listTools();
  console.log(`\nAraç sayısı: ${tools.length}`);
  for (const tool of tools) {
    const schema = JSON.stringify(tool.inputSchema ?? {});
    console.log(`\n--- ${tool.name}`);
    console.log(`    ${tool.description ?? "(açıklama yok)"}`);
    console.log(`    schema: ${schema.slice(0, 800)}`);
  }
}

main().catch((error) => {
  console.error(
    "Rapor hatası:",
    error instanceof Error ? error.message : "bilinmeyen"
  );
  process.exit(1);
});
