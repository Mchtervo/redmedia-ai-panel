/**
 * Development-only ChatPlace webhook test aracı.
 *
 * Verilen örnek payload dosyasını okur, `CHATPLACE_WEBHOOK_SECRET` ile
 * HMAC-SHA256 imzasını hesaplar ve local webhook endpoint'ine POST eder.
 * Böylece imza doğrulamasını manuel hesaplamaya gerek kalmadan test
 * edebilirsiniz.
 *
 * GÜVENLİK: `NODE_ENV=production` ortamında çalışmayı reddeder.
 *
 * Kullanım:
 *   npm run webhook:send                 # message-text (imzalı)
 *   npm run webhook:send -- message-image
 *   npm run webhook:send -- duplicate
 *   npm run webhook:send -- invalid
 *   npm run webhook:send -- message-text --bad-sign   # geçersiz imza testi
 *   npm run webhook:send -- message-text --no-sign    # imzasız istek testi
 *
 * Ortam değişkenleri:
 *   CHATPLACE_WEBHOOK_SECRET  (zorunlu)
 *   WEBHOOK_URL               (opsiyonel, varsayılan http://localhost:3000/api/chatplace/webhook)
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  CHATPLACE_SIGNATURE_HEADER,
  computeChatPlaceSignature,
} from "@/server/webhooks/chatplace-signature";

const DEFAULT_URL = "http://localhost:3000/api/chatplace/webhook";
const PAYLOAD_DIR = path.join(process.cwd(), "scripts", "chatplace-payloads");

async function main() {
  if (process.env.NODE_ENV === "production") {
    console.error("[send-chatplace-webhook] REDDEDILDI: production ortamında çalıştırılamaz.");
    process.exit(1);
  }

  const secret = process.env.CHATPLACE_WEBHOOK_SECRET;
  if (!secret) {
    console.error(
      "[send-chatplace-webhook] HATA: CHATPLACE_WEBHOOK_SECRET .env.local içinde tanımlı değil."
    );
    process.exit(1);
  }

  const args = process.argv.slice(2);
  const flags = new Set(args.filter((a) => a.startsWith("--")));
  const positional = args.filter((a) => !a.startsWith("--"));
  const payloadName = positional[0] ?? "message-text";

  const filePath = payloadName.endsWith(".json")
    ? path.resolve(payloadName)
    : path.join(PAYLOAD_DIR, `${payloadName}.json`);

  const rawBody = await readFile(filePath, "utf8");
  const url = process.env.WEBHOOK_URL ?? DEFAULT_URL;

  const headers: Record<string, string> = {
    "content-type": "application/json",
  };

  if (!flags.has("--no-sign")) {
    const signature = flags.has("--bad-sign")
      ? "sha256=deadbeef"
      : `sha256=${computeChatPlaceSignature(rawBody, secret)}`;
    headers[CHATPLACE_SIGNATURE_HEADER] = signature;
  }

  console.log(`[send-chatplace-webhook] POST ${url}`);
  console.log(`[send-chatplace-webhook] payload: ${filePath}`);
  console.log(
    `[send-chatplace-webhook] imza: ${
      flags.has("--no-sign")
        ? "(yok)"
        : flags.has("--bad-sign")
          ? "(geçersiz)"
          : "(geçerli)"
    }`
  );

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: rawBody,
  });

  const text = await response.text();
  console.log(`[send-chatplace-webhook] HTTP ${response.status}`);
  console.log(`[send-chatplace-webhook] cevap: ${text}`);
}

main().catch((error) => {
  console.error("[send-chatplace-webhook] HATA:", error);
  process.exit(1);
});
