/**
 * GPT yalnızca template slot'larını JSON olarak doldurur.
 * Serbest DM yazmaz.
 */

import { z } from "zod";
import {
  createRoutedChatCompletion,
  isOpenAiConfigured,
} from "@/lib/ai/openai-client";
import type { DecisionPack } from "@/features/ai/services/decision-engine.service";
import {
  listSlotsToFill,
  type ReplySlotId,
  type ReplySlotValues,
  type ReplyTemplate,
} from "@/features/ai/services/reply-template.engine";

const slotsSchema = z.object({
  hook: z.string().max(120).optional(),
  empathy: z.string().max(120).optional(),
  value: z.string().max(160).optional(),
  proof: z.string().max(160).optional(),
  price_line: z.string().max(160).optional(),
  question: z.string().max(140).optional(),
  cta: z.string().max(140).optional(),
});

function extractJsonObject(raw: string): unknown {
  const trimmed = raw.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("JSON yok");
  return JSON.parse(trimmed.slice(start, end + 1)) as unknown;
}

/**
 * Slot doldur. Başarısızsa boş obje (defaults kullanılacak).
 */
export async function fillReplySlots(params: {
  template: ReplyTemplate;
  pack: DecisionPack;
  customerMessage: string;
  dateHint?: string | null;
}): Promise<{ slots: ReplySlotValues; model: string | null; usedGpt: boolean }> {
  const needed = listSlotsToFill(params.template);
  if (!isOpenAiConfigured() || needed.length === 0) {
    return { slots: {}, model: null, usedGpt: false };
  }

  const defaultsHint = needed
    .map((s) => `${s}: ${params.template.defaults[s] ?? ""}`)
    .join("\n");

  try {
    const { completion, modelUsed } = await createRoutedChatCompletion(
      "dm_reply",
      {
        temperature: 0.25,
        max_tokens: 280,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "JSON slot doldur. Serbest mesaj yazma. Anahtarlar dışında alan ekleme. Kısa Türkçe. Fiyat uydurma.",
          },
          {
            role: "user",
            content: [
              `strategyId: ${params.pack.strategyId}`,
              `allowPrice: ${params.template.allowPrice}`,
              `requireQuestion: ${params.template.requireQuestion}`,
              `requireCta: ${params.template.requireCta}`,
              `requireReference: ${params.template.requireReference}`,
              `slots: ${needed.join(", ")}`,
              params.dateHint ? `dateHint: ${params.dateHint}` : "",
              `customerMessage: ${params.customerMessage.slice(0, 400)}`,
              "default_hints:",
              defaultsHint,
              'JSON örn: {"hook":"...","question":"...?","cta":"..."}',
            ]
              .filter(Boolean)
              .join("\n"),
          },
        ],
      }
    );

    const raw = completion.choices[0]?.message?.content?.trim() ?? "";
    const parsed = slotsSchema.safeParse(extractJsonObject(raw));
    if (!parsed.success) {
      return { slots: {}, model: modelUsed, usedGpt: false };
    }

    const slots: ReplySlotValues = {};
    for (const id of needed) {
      const v = parsed.data[id as keyof typeof parsed.data];
      if (typeof v === "string" && v.trim()) {
        slots[id as ReplySlotId] = v.trim();
      }
    }

    // Soru slotu tek ? ile bitsin
    if (slots.question) {
      let q = slots.question.replace(/\?+/g, "?").trim();
      if (params.template.requireQuestion && !q.includes("?")) {
        q = `${q}?`;
      }
      if (!params.template.requireQuestion) {
        q = q.replace(/\?/g, "").trim();
      }
      slots.question = q;
    }

    if (!params.template.allowPrice && slots.price_line) {
      delete slots.price_line;
    }

    return { slots, model: modelUsed, usedGpt: true };
  } catch {
    return { slots: {}, model: null, usedGpt: false };
  }
}
