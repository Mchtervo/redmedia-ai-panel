/**
 * Human Feedback Learning
 * AI cevabı → insan düzeltti → farkı pattern olarak kaydet.
 */

import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import {
  createRoutedChatCompletion,
  isOpenAiConfigured,
} from "@/lib/ai/openai-client";
import { upsertSalesPattern } from "@/features/sales-learning/repositories/sales-learning.repository";
import { maskPii } from "@/features/learning/utils/pii-mask";

type TypedSupabase = SupabaseClient<Database>;

const diffSchema = z.object({
  patternText: z.string().min(8).max(400),
  contextNote: z.string().max(300).optional(),
  categoryHint: z
    .enum([
      "human_feedback",
      "price_explanation",
      "trust_building",
      "objection_response",
      "closing",
      "failure",
    ])
    .default("human_feedback"),
});

function extractJsonObject(raw: string): unknown {
  const trimmed = raw.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("JSON yok");
  return JSON.parse(trimmed.slice(start, end + 1)) as unknown;
}

/**
 * Personel düzeltmesinden öğrenilebilir kalıp çıkar.
 */
export async function learnFromHumanCorrection(
  supabase: TypedSupabase,
  params: {
    conversationId: string | null;
    aiText: string;
    staffText: string;
    customerType?: string | null;
  }
): Promise<{ patternText: string } | null> {
  if (!params.aiText.trim() || !params.staffText.trim()) return null;
  if (params.aiText.trim() === params.staffText.trim()) return null;

  let patternText: string;
  let contextNote: string | null = null;
  let patternType: "human_feedback" | "price_explanation" | "trust_building" | "objection_response" | "closing" | "failure" =
    "human_feedback";

  if (isOpenAiConfigured()) {
    try {
      const { completion } = await createRoutedChatCompletion("extraction", {
        temperature: 0.2,
        max_tokens: 400,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `Sen Human Feedback Learning analistisin.
AI cevabı ile Mücahit/personel düzeltmesi arasındaki farkı tek kalıp cümlesine indir.
JSON: { "patternText": "AI X yaptı, insan Y yaptı — bundan sonra Y yap", "contextNote": "opsiyonel", "categoryHint": "human_feedback|..." }
Fiyat uydurma. Kısa ve eyleme dönük yaz.`,
          },
          {
            role: "user",
            content: [
              `AI: ${maskPii(params.aiText).slice(0, 600)}`,
              `İnsan: ${maskPii(params.staffText).slice(0, 600)}`,
              params.customerType
                ? `Müşteri tipi: ${params.customerType}`
                : "",
            ]
              .filter(Boolean)
              .join("\n"),
          },
        ],
      });
      const raw = completion.choices[0]?.message?.content?.trim() ?? "";
      const parsed = diffSchema.safeParse(extractJsonObject(raw));
      if (parsed.success) {
        patternText = parsed.data.patternText;
        contextNote = parsed.data.contextNote ?? null;
        patternType = parsed.data.categoryHint;
      } else {
        patternText = heuristicDiff(params.aiText, params.staffText);
      }
    } catch {
      patternText = heuristicDiff(params.aiText, params.staffText);
    }
  } else {
    patternText = heuristicDiff(params.aiText, params.staffText);
  }

  if (!params.conversationId) {
    return { patternText };
  }

  await upsertSalesPattern(supabase, {
    patternType,
    patternText,
    contextNote:
      contextNote ??
      "Human Feedback Learning — personel AI cevabını düzeltti",
    conversationId: params.conversationId,
    outcome: "open",
  });

  return { patternText };
}

function heuristicDiff(ai: string, staff: string): string {
  const aiLen = ai.trim().length;
  const staffLen = staff.trim().length;
  if (staffLen < aiLen * 0.6) {
    return "AI cevapları fazla uzun kalıyor; personel daha kısa yazıyor — 3 satırı aşma.";
  }
  if (/fiyat|11\.?000|14\.?000|21\.?000/i.test(ai) && !/fiyat|11\.?000/i.test(staff)) {
    return "AI erken/agresif fiyat vermiş; personel fiyatı erteledi — önce güven veya örnek.";
  }
  return `İnsan düzeltmesi: AI yerine şu üslubu kullan — ${staff.trim().slice(0, 180)}`;
}
