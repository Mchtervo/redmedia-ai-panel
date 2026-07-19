/**
 * Adversarial müşteri — LLM müşteri rolünde (sabit mesaj yok).
 */

import { z } from "zod";
import {
  createRoutedChatCompletion,
  isOpenAiConfigured,
} from "@/lib/ai/openai-client";
import type {
  AdversarialCustomerVariant,
  AdversarialScenarioSeed,
  AdversarialTurnLog,
} from "./adversarial-sales-benchmark.types";

const customerTurnSchema = z.object({
  message: z.string().max(500),
  endConversation: z.boolean().default(false),
  mood: z.string().max(80).optional(),
});

function extractJsonObject(raw: string): unknown {
  const trimmed = raw.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("JSON yok");
  return JSON.parse(trimmed.slice(start, end + 1)) as unknown;
}

const CUSTOMER_SYSTEM = `Sen Instagram DM'de düğün videosu/fotoğrafı soran GERÇEK bir müşterisin (Redmedia ile konuşuyorsun).
Kurallar:
- Gerçek insan gibi konuş: yazım hatası, kısaltma, emoji, dağınıklık olabilir.
- Fikir değiştirebilir, çelişebilir, aynı soruyu tekrar sorabilirsin.
- Bir anda fiyat sorup sonra düğün anlatabilirsin; kaybolup geri gelebilirsin.
- Bazen sinirlen, bazen yanlış anla, bazen alakasız yaz.
- ASLA asistan gibi davranma. Satış yapma. Paket uydurma.
- Kısa mesaj yaz (1-3 satır). Türkçe.

JSON dön:
{ "message": "...", "endConversation": false, "mood": "opsiyonel" }

endConversation=true yalnızca gerçekten konuşmayı bitirmek istiyorsan (vazgeçtim / teşekkürler kapanış).`;

export async function generateAdversarialCustomerMessage(params: {
  seed: AdversarialScenarioSeed;
  variant: AdversarialCustomerVariant;
  turnsSoFar: AdversarialTurnLog[];
  turnIndex: number;
}): Promise<{ message: string; endConversation: boolean }> {
  if (params.turnIndex === 0) {
    // İlk tur: openingHint'i hafif bozarak başla (LLM yoksa fallback)
    if (!isOpenAiConfigured()) {
      return { message: params.seed.openingHint, endConversation: false };
    }
  }

  if (!isOpenAiConfigured()) {
    return {
      message: params.turnIndex === 0 ? params.seed.openingHint : "peki",
      endConversation: params.turnIndex >= params.seed.maxTurns - 1,
    };
  }

  const transcript = params.turnsSoFar
    .map(
      (t) =>
        `Müşteri: ${t.customerMessage}\nAsistan: ${t.assistantReply}`
    )
    .join("\n\n");

  try {
    const { completion } = await createRoutedChatCompletion("extraction", {
      temperature: 0.95,
      max_tokens: 220,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: CUSTOMER_SYSTEM },
        {
          role: "user",
          content: [
            `## Senaryo`,
            params.seed.customerBrief,
            `Açılış ipucu: ${params.seed.openingHint}`,
            "",
            `## Senin kişiliğin`,
            params.variant.personaPrompt,
            "",
            `## Tur: ${params.turnIndex + 1} / ${params.seed.maxTurns}`,
            transcript
              ? `## Konuşma so far\n${transcript}`
              : "## Konuşma so far\n(henüz yok — sen başla)",
            "",
            params.turnIndex === 0
              ? "İlk mesajını yaz. openingHint'i birebir kopyalama; boz, kişileştir."
              : "Asistanın son cevabına gerçek müşteri gibi cevap ver.",
          ].join("\n"),
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content?.trim() ?? "";
    const parsed = customerTurnSchema.safeParse(extractJsonObject(raw));
    if (!parsed.success || !parsed.data.message.trim()) {
      return {
        message:
          params.turnIndex === 0 ? params.seed.openingHint : "anlamadım tekrar yazar mısın",
        endConversation: false,
      };
    }
    return {
      message: parsed.data.message.trim(),
      endConversation: parsed.data.endConversation,
    };
  } catch (error) {
    console.error(
      "[adversarial-customer]",
      error instanceof Error ? error.message : "bilinmeyen"
    );
    return {
      message:
        params.turnIndex === 0 ? params.seed.openingHint : "hm tamam",
      endConversation: false,
    };
  }
}
