import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database";
import { insertAiRun } from "@/features/ai/repositories/ai-runs.repository";
import {
  listBestConversations,
  listTopPatterns,
} from "@/features/sales-learning/repositories/sales-learning.repository";
import { insertPlaybookDraftIfNew } from "@/features/playbooks/repositories/playbooks.repository";
import type { AiPlaybookRow } from "@/features/playbooks/types";
import {
  createRoutedChatCompletion,
  isOpenAiConfigured,
} from "@/lib/ai/openai-client";

type TypedSupabaseClient = SupabaseClient<Database>;

const TASK_TYPE = "playbook_generation" as const;
const MIN_BEST_CONVERSATIONS = 2;
const MIN_PATTERNS = 3;

/**
 * LLM çıktısı şeması — kanıt dışı içerik üretimini sınırlamak için
 * playbook yalnızca verilen kalıp/konuşma verisinden derlenir.
 */
const playbookDraftSchema = z.object({
  title: z.string().min(8).max(120),
  triggerContext: z.string().min(10).max(400),
  steps: z.array(z.string().min(5).max(300)).min(3).max(10),
  decisionRules: z.array(z.string().min(5).max(300)).max(8).default([]),
  expectedOutcome: z.string().max(300).nullable().default(null),
});

const SYSTEM_PROMPT = `Sen Redmedia (Ankara düğün/nişan video-sinematografi) için satış süreci tasarımcısısın.
Görevin: SANA VERİLEN kanıtlanmış satış kalıpları ve kazanan konuşma örneklerinden TEK bir yeniden kullanılabilir satış playbook'u derlemek.

ZORUNLU KURALLAR:
- Yalnızca verilen kalıp ve örneklerdeki yaklaşımları kullan; yeni fiyat, hizmet veya kampanya UYDURMA.
- Adımlar somut ve uygulanabilir olsun (ör. "önce etkinlik türünü ve tarihini sor", "fiyat sorusuna önce yardımcı bilgi ver").
- Telefon numarası isteme adımı varsa, asla ilk mesajlarda olmasın.
- Türkçe yaz.
- SADECE geçerli JSON döndür: {"title","triggerContext","steps":[],"decisionRules":[],"expectedOutcome"}`;

export type GeneratePlaybookResult = {
  playbook: AiPlaybookRow | null;
  created: boolean;
  skipped: boolean;
  reason?: string;
};

function extractJsonObject(raw: string): unknown {
  const trimmed = raw.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)```$/m.exec(trimmed);
  return JSON.parse(fenced?.[1]?.trim() ?? trimmed) as unknown;
}

/**
 * Kazanan kalıplar + best conversation library'den taslak playbook üretir
 * (docs/27: AI auto-generate draft). Yeterli kanıt yoksa üretmez; taslak
 * insan onayından geçmeden asistan bağlamına girmez.
 */
export async function generateSalesPlaybookDraft(
  supabase: TypedSupabaseClient
): Promise<GeneratePlaybookResult> {
  if (!isOpenAiConfigured()) {
    return { playbook: null, created: false, skipped: true, reason: "openai_missing" };
  }

  const [patterns, bestConversations] = await Promise.all([
    listTopPatterns(supabase, { limit: 15 }),
    listBestConversations(supabase, 5),
  ]);

  const positivePatterns = patterns.filter(
    (p) => p.pattern_type !== "failure" && p.pattern_type !== "leave_reason"
  );

  if (
    bestConversations.length < MIN_BEST_CONVERSATIONS ||
    positivePatterns.length < MIN_PATTERNS
  ) {
    return {
      playbook: null,
      created: false,
      skipped: true,
      reason: "insufficient_evidence",
    };
  }

  const evidence = {
    patterns: positivePatterns.map((p) => ({
      type: p.pattern_type,
      text: p.pattern_text,
      successRate: p.success_rate,
      seenCount: p.seen_count,
    })),
    bestConversations: bestConversations.map((b) => ({
      customerIntent: b.customerIntent,
      firstCustomerQuestion: b.firstCustomerQuestion,
      firstReplyGiven: b.firstReplyGiven,
      advancingReply: b.advancingReply,
      summary: b.summary,
    })),
  };

  try {
    const { completion, modelUsed } = await createRoutedChatCompletion(
      "sales_strategy",
      {
        temperature: 0.3,
        max_tokens: 1200,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: `KANIT VERİSİ (yalnızca bunlardan derle):\n${JSON.stringify(evidence)}`,
          },
        ],
      }
    );

    const raw = completion.choices[0]?.message?.content?.trim();
    if (!raw) {
      throw new Error("Boş playbook cevabı");
    }

    const parsed = playbookDraftSchema.safeParse(extractJsonObject(raw));
    if (!parsed.success) {
      throw new Error("Playbook şema doğrulaması başarısız");
    }

    // Güven: kanıt hacmine göre; taslak olduğu için 70 üstüne çıkmaz.
    const confidence = Math.min(
      70,
      30 + positivePatterns.length * 3 + bestConversations.length * 5
    );

    const { playbook, created } = await insertPlaybookDraftIfNew(supabase, {
      category: "sales",
      title: parsed.data.title,
      triggerContext: parsed.data.triggerContext,
      steps: parsed.data.steps,
      decisionRules: parsed.data.decisionRules,
      expectedOutcome: parsed.data.expectedOutcome,
      confidence,
      sourceConversationIds: bestConversations.map((b) => b.conversationId),
      sourceNote: `Kanıt: ${positivePatterns.length} kalıp, ${bestConversations.length} kazanan konuşma.`,
    });

    await insertAiRun(supabase, {
      taskType: TASK_TYPE,
      conversationId: null,
      contactId: null,
      model: modelUsed,
      inputTokens: completion.usage?.prompt_tokens ?? null,
      outputTokens: completion.usage?.completion_tokens ?? null,
      result: {
        playbookId: playbook.id,
        title: playbook.title,
        created,
        evidenceCounts: {
          patterns: positivePatterns.length,
          bestConversations: bestConversations.length,
        },
      } as Json,
      status: "completed",
    });

    return { playbook, created, skipped: false };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "playbook_generation_error";
    console.error("[playbooks] taslak üretim hatası:", message);
    return { playbook: null, created: false, skipped: true, reason: message };
  }
}
