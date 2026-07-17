import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/server/supabase/admin";
import { verifyChatPlaceWebhookAuth } from "@/server/webhooks/chatplace-auth";
import { CHATPLACE_SIGNATURE_HEADER } from "@/server/webhooks/chatplace-signature";
import { CHATPLACE_TOKEN_HEADER } from "@/server/webhooks/chatplace-token";
import { checkRateLimit } from "@/server/rate-limit/in-memory-rate-limiter";
import { processChatPlaceWebhook } from "@/features/conversations/services/chatplace-webhook.service";
import { apiError, apiSuccess } from "@/types/api";

// İmza/token doğrulaması node:crypto kullandığı için Node.js runtime gereklidir.
export const runtime = "nodejs";

const RATE_LIMIT = 60;
const RATE_WINDOW_MS = 60_000;

function clientKey(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip =
    forwarded?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  return `chatplace-webhook:${ip}`;
}

export async function POST(request: NextRequest) {
  // 1. Rate limiting (best-effort; bkz. server/rate-limit).
  const rate = checkRateLimit(clientKey(request), RATE_LIMIT, RATE_WINDOW_MS);
  if (!rate.allowed) {
    return NextResponse.json(
      apiError("rate_limited", "Çok fazla istek. Lütfen sonra tekrar deneyin."),
      { status: 429 }
    );
  }

  // 2. İmza için HAM gövde okunur (parse edilmeden önce).
  const rawBody = await request.text();

  // 3. Kimlik doğrulama: geçerli HMAC **veya** geçerli statik token.
  //    İkisi de geçersizse istek işlenmeden reddedilir (fail-closed).
  const signatureVerified = verifyChatPlaceWebhookAuth({
    rawBody,
    signatureHeader: request.headers.get(CHATPLACE_SIGNATURE_HEADER),
    tokenHeader: request.headers.get(CHATPLACE_TOKEN_HEADER),
    webhookSecret: process.env.CHATPLACE_WEBHOOK_SECRET,
    webhookToken: process.env.CHATPLACE_WEBHOOK_TOKEN,
  });

  if (!signatureVerified) {
    return NextResponse.json(
      apiError("unauthorized", "Webhook kimlik doğrulaması başarısız."),
      { status: 401 }
    );
  }

  // 4. JSON gövde ayrıştırma.
  let payload: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(rawBody);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      throw new Error("Gövde bir JSON nesnesi değil.");
    }
    payload = parsed as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      apiError("invalid_json", "Geçersiz JSON gövdesi."),
      { status: 400 }
    );
  }

  // 5. İşleme (kayıt → doğrula → ingest → durum). Service role yalnızca
  //    sunucu tarafında (bu Route Handler) kullanılır.
  try {
    const supabase = createAdminClient();
    const result = await processChatPlaceWebhook(supabase, {
      payload,
      signatureVerified,
    });

    if (result.outcome === "invalid") {
      return NextResponse.json(
        apiError("invalid_payload", result.reason),
        { status: 400 }
      );
    }

    if (result.outcome === "error") {
      return NextResponse.json(
        apiError("processing_error", "Webhook işlenemedi."),
        { status: 500 }
      );
    }

    // processed | duplicate | ignored → 200 (ChatPlace tekrar denemesin).
    return NextResponse.json(
      apiSuccess({
        outcome: result.outcome,
        webhookEventId: result.webhookEventId,
      }),
      { status: 200 }
    );
  } catch (error) {
    // Hata detayı istemciye sızdırılmaz; yalnızca kısa özet sunucu
    // konsoluna yazılır (bkz. .cursor/rules/02-security.mdc).
    console.error(
      "[chatplace-webhook] beklenmeyen hata:",
      error instanceof Error ? error.message : "bilinmeyen"
    );
    return NextResponse.json(
      apiError("internal_error", "Beklenmeyen bir hata oluştu."),
      { status: 500 }
    );
  }
}
