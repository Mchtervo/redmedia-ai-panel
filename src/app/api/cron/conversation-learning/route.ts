import type { ApiResponse } from "@/types/api";
import { createAdminClient } from "@/server/supabase/admin";
import { runConversationLearningBatch } from "@/features/learning/services/learning-automation.service";
import { backfillKnowledgeIndex } from "@/features/knowledge/services/rag.service";

export const runtime = "nodejs";

type CronResult = {
  scanned: number;
  analyzed: number;
  knowledgeProposed: number;
  skipped: number;
  failed: number;
  runId: string;
  ragIndexedDocuments: number;
};

function unauthorized(): Response {
  const body: ApiResponse<null> = {
    success: false,
    error: { code: "unauthorized", message: "Yetkisiz." },
  };
  return Response.json(body, { status: 401 });
}

/**
 * Vercel Cron / harici scheduler: kapalı veya 24s idle konuşmaları öğrenir.
 * Header: Authorization: Bearer <CRON_SECRET>
 */
export async function GET(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    const body: ApiResponse<null> = {
      success: false,
      error: {
        code: "misconfigured",
        message: "CRON_SECRET tanımlı değil.",
      },
    };
    return Response.json(body, { status: 503 });
  }

  const auth = request.headers.get("authorization")?.trim() ?? "";
  const expected = `Bearer ${secret}`;
  if (auth !== expected) {
    return unauthorized();
  }

  try {
    const supabase = createAdminClient();
    const { isAiFeatureEnabled } = await import(
      "@/features/settings/services/ai-feature-flags.service"
    );

    if (!(await isAiFeatureEnabled(supabase, "AI_LEARNING"))) {
      const body: ApiResponse<CronResult & { skippedByFlag: true }> = {
        success: true,
        data: {
          scanned: 0,
          analyzed: 0,
          knowledgeProposed: 0,
          skipped: 0,
          failed: 0,
          runId: "skipped_by_flag",
          ragIndexedDocuments: 0,
          skippedByFlag: true,
        },
      };
      return Response.json(body);
    }

    const result = await runConversationLearningBatch(supabase, {
      triggerSource: "cron",
      limit: 25,
    });

    // RAG backfill (docs/29): chunk'ı olmayan onaylı dokümanlar indekslenir.
    // Hata öğrenme koşusunu bozmaz.
    let ragIndexedDocuments = 0;
    try {
      const ragResult = await backfillKnowledgeIndex(supabase, 10);
      ragIndexedDocuments = ragResult.indexedDocuments;
    } catch (ragError) {
      console.error(
        "[cron/conversation-learning] RAG backfill hatası:",
        ragError instanceof Error ? ragError.message : "bilinmeyen"
      );
    }

    const body: ApiResponse<CronResult> = {
      success: true,
      data: {
        runId: result.runId,
        scanned: result.scanned,
        analyzed: result.analyzed,
        knowledgeProposed: result.knowledgeProposed,
        skipped: result.skipped,
        failed: result.failed,
        ragIndexedDocuments,
      },
    };
    return Response.json(body);
  } catch (error) {
    const message = error instanceof Error ? error.message : "cron_failed";
    console.error("[cron/conversation-learning]", message);
    const body: ApiResponse<null> = {
      success: false,
      error: { code: "internal_error", message: "Öğrenme koşusu başarısız." },
    };
    return Response.json(body, { status: 500 });
  }
}
