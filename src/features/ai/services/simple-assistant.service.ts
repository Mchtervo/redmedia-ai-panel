import OpenAI from "openai";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database";
import { insertAiRun } from "@/features/ai/repositories/ai-runs.repository";
import {
  SIMPLE_ASSISTANT_FALLBACK_REPLY,
  SIMPLE_ASSISTANT_SYSTEM_PROMPT,
  SIMPLE_ASSISTANT_TASK_TYPE,
} from "@/features/ai/prompts/simple-assistant";

type TypedSupabaseClient = SupabaseClient<Database>;

const DEFAULT_MODEL = "gpt-4o-mini";

/**
 * Basit anahtar kelime sınıflandırması — RAG/karar katmanı sonraki faz.
 * Eşleşme `tr-TR` küçük harfe çevrilmiş metin üzerinde yapılır (İ/I farkı).
 */
const HUMAN_APPROVAL_KEYWORDS = [
  "şikayet",
  "sikayet",
  "memnun değil",
  "indirim",
  "iskonto",
  "iptal",
  "özel fiyat",
  "ozel fiyat",
  "pazarlık",
  "pazarlik",
] as const;

export type GenerateSimpleAssistantReplyParams = {
  customerMessage: string;
  conversationId: string;
  contactId: string | null;
};

export type GenerateSimpleAssistantReplyResult = {
  reply: string;
  aiRunId: string;
  requiresHumanApproval: boolean;
  model: string;
};

export function isAiAutoReplyEnabled(): boolean {
  const flag = process.env.AI_AUTO_REPLY_ENABLED?.trim().toLowerCase();
  if (flag === "false" || flag === "0" || flag === "off") {
    return false;
  }
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

export function requiresHumanApproval(customerMessage: string): boolean {
  const normalized = customerMessage.toLocaleLowerCase("tr-TR");
  return HUMAN_APPROVAL_KEYWORDS.some((keyword) =>
    normalized.includes(keyword)
  );
}

function getModel(): string {
  return process.env.OPENAI_MODEL?.trim() || DEFAULT_MODEL;
}

/**
 * Basit DM asistanı: tek mesaj + system prompt → OpenAI → ai_runs log.
 * Hafıza / RAG yok (bkz. docs/AI.md).
 */
export async function generateSimpleAssistantReply(
  supabase: TypedSupabaseClient,
  params: GenerateSimpleAssistantReplyParams
): Promise<GenerateSimpleAssistantReplyResult | null> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey || !isAiAutoReplyEnabled()) {
    return null;
  }

  const model = getModel();
  const needsHuman = requiresHumanApproval(params.customerMessage);
  const userContent = params.customerMessage.trim().slice(0, 4000);

  if (!userContent) {
    return null;
  }

  try {
    const client = new OpenAI({ apiKey });
    const completion = await client.chat.completions.create({
      model,
      temperature: 0.4,
      max_tokens: 400,
      messages: [
        { role: "system", content: SIMPLE_ASSISTANT_SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ],
    });

    const replyText =
      completion.choices[0]?.message?.content?.trim() ||
      SIMPLE_ASSISTANT_FALLBACK_REPLY;

    const resultPayload: Json = {
      input: { customerMessage: userContent },
      output: { reply: replyText },
      requiresHumanApproval: needsHuman,
    };

    const aiRun = await insertAiRun(supabase, {
      taskType: SIMPLE_ASSISTANT_TASK_TYPE,
      conversationId: params.conversationId,
      contactId: params.contactId,
      model: completion.model || model,
      inputTokens: completion.usage?.prompt_tokens ?? null,
      outputTokens: completion.usage?.completion_tokens ?? null,
      result: resultPayload,
      status: "completed",
      requiresHumanApproval: needsHuman,
    });

    return {
      reply: replyText,
      aiRunId: aiRun.id,
      requiresHumanApproval: needsHuman,
      model: aiRun.model,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "openai_error";
    console.error("[simple-assistant] OpenAI hatası:", message);

    const failedResult: Json = {
      input: { customerMessage: userContent },
      error: "generation_failed",
    };

    const aiRun = await insertAiRun(supabase, {
      taskType: SIMPLE_ASSISTANT_TASK_TYPE,
      conversationId: params.conversationId,
      contactId: params.contactId,
      model,
      result: failedResult,
      status: "failed",
      requiresHumanApproval: needsHuman,
    });

    return {
      reply: SIMPLE_ASSISTANT_FALLBACK_REPLY,
      aiRunId: aiRun.id,
      requiresHumanApproval: needsHuman,
      model,
    };
  }
}
