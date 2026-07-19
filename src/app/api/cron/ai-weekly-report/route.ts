import type { ApiResponse } from "@/types/api";
import { createAdminClient } from "@/server/supabase/admin";
import { generateAiWeeklyReport } from "@/features/sales-learning/services/weekly-report.service";
import { generateSalesPlaybookDraft } from "@/features/playbooks/services/playbook-generator.service";
import {
  formatSelfLearningReportText,
  generateSelfLearningWeeklyReport,
} from "@/features/ai/services/self-learning-report.service";

export const runtime = "nodejs";

type CronResult = {
  reportId: string;
  weekStart: string;
  weekEnd: string;
  created: boolean;
  dataSufficiency: string;
  playbookDraft: {
    created: boolean;
    skipped: boolean;
    reason?: string;
  };
  selfLearning: {
    lostConversationCount: number;
    biggestProblem: string;
    narrativePreview: string;
  };
};

function unauthorized(): Response {
  const body: ApiResponse<null> = {
    success: false,
    error: { code: "unauthorized", message: "Yetkisiz." },
  };
  return Response.json(body, { status: 401 });
}

/**
 * Haftalık AI öz değerlendirme raporu (Quality Control).
 * Haftada bir (Pazartesi) çağrılması önerilir; geçen haftayı raporlar.
 * Header: Authorization: Bearer <CRON_SECRET>
 */
export async function GET(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    const body: ApiResponse<null> = {
      success: false,
      error: { code: "misconfigured", message: "CRON_SECRET tanımlı değil." },
    };
    return Response.json(body, { status: 503 });
  }

  const auth = request.headers.get("authorization")?.trim() ?? "";
  if (auth !== `Bearer ${secret}`) {
    return unauthorized();
  }

  try {
    const supabase = createAdminClient();
    const result = await generateAiWeeklyReport(supabase);

    // Haftalık playbook review (docs/08): yeterli kanıt varsa taslak üret.
    const playbookResult = await generateSalesPlaybookDraft(supabase);

    // Self Learning — kayıp konuşma özeti (Cursor/Claude/insan için)
    const selfLearning = await generateSelfLearningWeeklyReport(supabase, {
      weekStart: result.report.week_start,
    });
    console.info(
      "[cron/ai-weekly-report] self-learning\n",
      formatSelfLearningReportText(selfLearning)
    );

    const body: ApiResponse<CronResult> = {
      success: true,
      data: {
        reportId: result.report.id,
        weekStart: result.report.week_start,
        weekEnd: result.report.week_end,
        created: result.created,
        dataSufficiency: result.report.data_sufficiency,
        playbookDraft: {
          created: playbookResult.created,
          skipped: playbookResult.skipped,
          reason: playbookResult.reason,
        },
        selfLearning: {
          lostConversationCount: selfLearning.lostConversationCount,
          biggestProblem: selfLearning.biggestProblem,
          narrativePreview: selfLearning.narrative.slice(0, 400),
        },
      },
    };
    return Response.json(body);
  } catch (error) {
    const message = error instanceof Error ? error.message : "cron_failed";
    console.error("[cron/ai-weekly-report]", message);
    const body: ApiResponse<null> = {
      success: false,
      error: {
        code: "internal_error",
        message: "Haftalık AI raporu oluşturulamadı.",
      },
    };
    return Response.json(body, { status: 500 });
  }
}
