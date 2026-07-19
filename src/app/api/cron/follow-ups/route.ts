import type { ApiResponse } from "@/types/api";
import { createAdminClient } from "@/server/supabase/admin";
import { runDueFollowUps } from "@/features/follow-ups/services/follow-ups.service";
import { runDueSatisfactionTasks } from "@/features/smart-sales/services/follow-up-cadence.service";

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
    const admin = createAdminClient();
    const [followUps, satisfaction] = await Promise.all([
      runDueFollowUps(admin),
      runDueSatisfactionTasks(admin),
    ]);
    const result = { followUps, satisfaction };
    return Response.json({
      success: true,
      data: result,
    } satisfies ApiResponse<typeof result>);
  } catch {
    return Response.json(
      {
        success: false,
        error: { code: "internal_error", message: "Follow-up cron başarısız." },
      } satisfies ApiResponse<null>,
      { status: 500 }
    );
  }
}
