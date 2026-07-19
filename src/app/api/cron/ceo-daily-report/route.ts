import type { ApiResponse } from "@/types/api";
import { createAdminClient } from "@/server/supabase/admin";
import { generateCeoDailyReport } from "@/features/ceo-intelligence/services/daily-report.service";
import { buildCeoDashboard } from "@/features/ceo-intelligence/services/dashboard.service";

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
    const report = await generateCeoDailyReport(admin);
    // Brief'i de taze tut
    await buildCeoDashboard(admin);
    return Response.json({
      success: true,
      data: report,
    } satisfies ApiResponse<typeof report>);
  } catch {
    return Response.json(
      {
        success: false,
        error: {
          code: "internal_error",
          message: "CEO günlük rapor cron başarısız.",
        },
      } satisfies ApiResponse<null>,
      { status: 500 }
    );
  }
}
