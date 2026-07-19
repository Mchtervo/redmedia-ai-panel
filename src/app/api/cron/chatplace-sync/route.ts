import type { ApiResponse } from "@/types/api";
import { createAdminClient } from "@/server/supabase/admin";
import {
  syncChatPlaceConversations,
  type ChatPlaceSyncMode,
} from "@/features/conversations/services/chatplace-sync.service";

export const runtime = "nodejs";
export const maxDuration = 300;

function unauthorized(): Response {
  return Response.json(
    {
      success: false,
      error: { code: "unauthorized", message: "Yetkisiz." },
    } satisfies ApiResponse<null>,
    { status: 401 }
  );
}

/**
 * ChatPlace MCP artımlı senkron cronu (docs/44).
 * Authorization: Bearer CRON_SECRET
 * Opsiyonel: ?mode=backfill (varsayılan incremental)
 */
export async function GET(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return Response.json(
      {
        success: false,
        error: { code: "misconfigured", message: "CRON_SECRET yok." },
      } satisfies ApiResponse<null>,
      { status: 503 }
    );
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return unauthorized();
  }

  const url = new URL(request.url);
  const mode: ChatPlaceSyncMode =
    url.searchParams.get("mode") === "backfill" ? "backfill" : "incremental";

  try {
    const admin = createAdminClient();
    const result = await syncChatPlaceConversations(admin, { mode });
    return Response.json({
      success: true,
      data: result,
    } satisfies ApiResponse<typeof result>);
  } catch {
    return Response.json(
      {
        success: false,
        error: {
          code: "internal_error",
          message: "ChatPlace senkronizasyonu başarısız.",
        },
      } satisfies ApiResponse<null>,
      { status: 500 }
    );
  }
}
