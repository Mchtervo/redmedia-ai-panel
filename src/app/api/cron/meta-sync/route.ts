import type { ApiResponse } from "@/types/api";
import { createAdminClient } from "@/server/supabase/admin";
import { runManualMetaSync } from "@/features/marketing/services/meta-connection.service";
import { testAllMetaConnections } from "@/features/marketing/services/meta-connection.service";

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
 * Günlük otomatik Meta senkronu.
 * Authorization: Bearer CRON_SECRET
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

  try {
    const admin = createAdminClient();
    const health = await testAllMetaConnections(admin);
    const sync = await runManualMetaSync(admin, "full");
    let igsidSync: unknown = null;
    try {
      const { syncMetaIgsidsFromConversations } = await import(
        "@/features/marketing/services/meta/meta-igsid-sync.service"
      );
      igsidSync = await syncMetaIgsidsFromConversations(admin, {
        maxConversations: 12,
      });
    } catch {
      igsidSync = { ok: false, note: "IGSID senkronu atlandı" };
    }
    const data = { health, sync, igsidSync };
    return Response.json({
      success: true,
      data,
    } satisfies ApiResponse<typeof data>);
  } catch {
    return Response.json(
      {
        success: false,
        error: {
          code: "internal_error",
          message: "Meta günlük sync başarısız.",
        },
      } satisfies ApiResponse<null>,
      { status: 500 }
    );
  }
}
