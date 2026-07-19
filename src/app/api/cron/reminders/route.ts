import type { ApiResponse } from "@/types/api";
import { createAdminClient } from "@/server/supabase/admin";
import { runDueReminders } from "@/features/reminders/services/reminders.service";

export const runtime = "nodejs";

function unauthorized(): Response {
  return Response.json(
    {
      success: false,
      error: { code: "unauthorized", message: "Yetkisiz." },
    } satisfies ApiResponse<null>,
    { status: 401 }
  );
}

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
    const result = await runDueReminders(createAdminClient());
    return Response.json({
      success: true,
      data: result,
    } satisfies ApiResponse<typeof result>);
  } catch {
    return Response.json(
      {
        success: false,
        error: { code: "internal_error", message: "Reminder cron başarısız." },
      } satisfies ApiResponse<null>,
      { status: 500 }
    );
  }
}
