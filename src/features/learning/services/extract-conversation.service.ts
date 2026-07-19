import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database";
import { listMessagesByConversation } from "@/features/conversations/repositories/messages.repository";
import { getConversationById } from "@/features/conversations/repositories/conversations.repository";
import { insertAiRun } from "@/features/ai/repositories/ai-runs.repository";
import { upsertConversationAnalysis } from "@/features/learning/repositories/conversation-analyses.repository";
import { upsertConversationSummaryFromLearning } from "@/features/learning/repositories/conversation-summaries.repository";
import { insertPendingKnowledgeDocument } from "@/features/knowledge/repositories/knowledge-documents.repository";
import {
  buildExtractionUserPrompt,
  CONVERSATION_EXTRACTION_SYSTEM_PROMPT,
} from "@/features/learning/prompts/conversation-extraction";
import {
  conversationExtractionSchema,
  type ConversationExtraction,
  type KnowledgeProposal,
} from "@/features/learning/validators/extraction-schema";
import { maskPii, maskPiiDeep } from "@/features/learning/utils/pii-mask";
import {
  ingestSalesLearningSignals,
  shouldMarkBestConversation,
} from "@/features/sales-learning/services/sales-learning-ingest.service";
import {
  createRoutedChatCompletion,
  isOpenAiConfigured,
} from "@/lib/ai/openai-client";

type TypedSupabaseClient = SupabaseClient<Database>;

const EXTRACTION_TASK_TYPE = "conversation_learning_extract" as const;
const MAX_TRANSCRIPT_CHARS = 12000;

export type AnalyzeConversationResult = {
  analysisId: string;
  knowledgeProposed: number;
  skipped: boolean;
  reason?: string;
};

function buildMaskedTranscript(
  messages: Awaited<ReturnType<typeof listMessagesByConversation>>,
  crmNotes: string[] = []
): string {
  const lines = messages
    .filter((message) => Boolean(message.content?.trim()))
    .map((message) => {
      const role =
        message.sender_type === "customer"
          ? "Müşteri"
          : message.sender_type === "staff"
            ? "Personel"
            : message.sender_type === "ai"
              ? "Asistan"
              : "Sistem";
      const direction = message.direction === "inbound" ? "gelen" : "giden";
      return `[${message.created_at}] (${direction}) ${role}: ${maskPii(message.content!.trim())}`;
    });

  let transcript = lines.join("\n");
  if (transcript.length > MAX_TRANSCRIPT_CHARS) {
    transcript = transcript.slice(transcript.length - MAX_TRANSCRIPT_CHARS);
  }

  if (crmNotes.length > 0) {
    const notesBlock = crmNotes
      .slice(0, 10)
      .map((note) => `- ${maskPii(note.trim()).slice(0, 400)}`)
      .join("\n");
    transcript = `${transcript}\n\n## CRM notları (dahili; müşteri görmez)\n${notesBlock}`;
  }

  return transcript;
}

/** Conversation Memory: CRM notları da analiz kapsamına girer. */
async function loadCrmNotesForContact(
  supabase: TypedSupabaseClient,
  contactId: string | null
): Promise<string[]> {
  if (!contactId) return [];
  const { data, error } = await supabase
    .from("customer_admin_notes")
    .select("body")
    .eq("contact_id", contactId)
    .order("created_at", { ascending: false })
    .limit(10);
  if (error) {
    // Not okunamazsa analiz mesajlarla devam eder.
    return [];
  }
  return (data ?? [])
    .map((row) => row.body?.trim())
    .filter((body): body is string => Boolean(body));
}

function extractJsonObject(raw: string): unknown {
  const trimmed = raw.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)```$/m.exec(trimmed);
  const candidate = fenced?.[1]?.trim() ?? trimmed;
  return JSON.parse(candidate) as unknown;
}

async function callOpenAiExtraction(
  transcript: string
): Promise<{
  extraction: ConversationExtraction;
  model: string;
  usage: { prompt_tokens?: number; completion_tokens?: number } | undefined;
}> {
  if (!isOpenAiConfigured()) {
    throw new Error("OPENAI_API_KEY tanımlı değil.");
  }

  const userPrompt = buildExtractionUserPrompt(transcript);
  const messages = [
    { role: "system" as const, content: CONVERSATION_EXTRACTION_SYSTEM_PROMPT },
    { role: "user" as const, content: userPrompt },
  ];

  // GPT-5 reasoning boş JSON bırakabiliyor; token bol + 1 retry.
  let { completion, modelUsed } = await createRoutedChatCompletion(
    "extraction",
    {
      temperature: 0.2,
      max_tokens: 3500,
      response_format: { type: "json_object" },
      messages,
    }
  );

  let raw = completion.choices[0]?.message?.content?.trim() ?? "";
  if (!raw) {
    const retry = await createRoutedChatCompletion("extraction", {
      temperature: 0.2,
      max_tokens: 4500,
      response_format: { type: "json_object" },
      messages: [
        ...messages,
        {
          role: "user",
          content:
            "Önceki cevap boştu. Yalnızca geçerli tek bir JSON nesnesi döndür; markdown yok.",
        },
      ],
    });
    completion = retry.completion;
    modelUsed = retry.modelUsed;
    raw = completion.choices[0]?.message?.content?.trim() ?? "";
  }

  if (!raw) {
    throw new Error("Boş extraction cevabı");
  }

  let json: unknown;
  try {
    json = extractJsonObject(raw);
  } catch {
    throw new Error("Extraction JSON parse başarısız");
  }

  let parsed = conversationExtractionSchema.safeParse(json);
  if (!parsed.success) {
    const retry = await createRoutedChatCompletion("extraction", {
      temperature: 0.2,
      max_tokens: 4500,
      response_format: { type: "json_object" },
      messages: [
        ...messages,
        {
          role: "user",
          content: `Şema hatası: ${parsed.error.issues
            .slice(0, 6)
            .map((i) => `${i.path.join(".")}: ${i.message}`)
            .join("; ")}. Düzeltilmiş tam JSON ver.`,
        },
      ],
    });
    const retryRaw = retry.completion.choices[0]?.message?.content?.trim();
    if (!retryRaw) {
      throw new Error("Extraction şema doğrulaması başarısız");
    }
    parsed = conversationExtractionSchema.safeParse(
      extractJsonObject(retryRaw)
    );
    if (!parsed.success) {
      console.error(
        "[conversation-learning] şema:",
        parsed.error.issues.slice(0, 8)
      );
      throw new Error("Extraction şema doğrulaması başarısız");
    }
    completion = retry.completion;
    modelUsed = retry.modelUsed;
  }

  return {
    extraction: maskPiiDeep(parsed.data),
    model: modelUsed,
    usage: completion.usage,
  };
}

function shouldProposeKnowledge(proposal: KnowledgeProposal): boolean {
  if (proposal.staffAnswerUnreliable) {
    return false;
  }
  // Fiyat ve kampanya iddiaları asla otomatik onaylanmaz; pending olarak
  // önerilebilir ama isPricingSensitive / isCampaignClaim true kalır.
  return true;
}

async function upsertLeadProfileFromExtraction(
  supabase: TypedSupabaseClient,
  contactId: string,
  extraction: ConversationExtraction
): Promise<void> {
  const { data: existing, error: findError } = await supabase
    .from("lead_profiles")
    .select("id")
    .eq("contact_id", contactId)
    .maybeSingle();

  if (findError) {
    throw findError;
  }

  const payload = {
    contact_id: contactId,
    service_type: extraction.eventType,
    location: extraction.venueType,
    phone_collected: extraction.phoneCollected,
    lead_score: extraction.leadScore,
    lead_temperature: extraction.leadTemperature,
  };

  if (existing) {
    const { error } = await supabase
      .from("lead_profiles")
      .update(payload)
      .eq("id", existing.id);
    if (error) {
      throw error;
    }
    return;
  }

  const { error } = await supabase.from("lead_profiles").insert(payload);
  if (error) {
    throw error;
  }
}

/**
 * Tek konuşmayı analiz eder: özet + satış skoru + pending knowledge önerileri.
 * Aynı konuşmayı tekrar analiz eder (upsert); knowledge yalnızca yeni önerilerden eklenir.
 */
export async function analyzeConversationForLearning(
  supabase: TypedSupabaseClient,
  conversationId: string,
  options?: { force?: boolean }
): Promise<AnalyzeConversationResult> {
  const conversation = await getConversationById(supabase, conversationId);
  if (!conversation) {
    return {
      analysisId: "",
      knowledgeProposed: 0,
      skipped: true,
      reason: "conversation_not_found",
    };
  }

  const messages = await listMessagesByConversation(supabase, conversationId);
  if (messages.length < 2) {
    return {
      analysisId: "",
      knowledgeProposed: 0,
      skipped: true,
      reason: "too_few_messages",
    };
  }

  if (
    !options?.force &&
    conversation.last_learned_at &&
    conversation.last_message_at &&
    conversation.last_learned_at >= conversation.last_message_at
  ) {
    return {
      analysisId: "",
      knowledgeProposed: 0,
      skipped: true,
      reason: "already_up_to_date",
    };
  }

  const crmNotes = await loadCrmNotesForContact(
    supabase,
    conversation.contact_id
  );
  const transcript = buildMaskedTranscript(messages, crmNotes);
  if (!transcript.trim()) {
    return {
      analysisId: "",
      knowledgeProposed: 0,
      skipped: true,
      reason: "empty_transcript",
    };
  }

  const { extraction, model, usage } = await callOpenAiExtraction(transcript);

  const markedBest = shouldMarkBestConversation(extraction);

  const analysis = await upsertConversationAnalysis(supabase, {
    conversationId,
    customerIntent: extraction.customerIntent,
    eventType: extraction.eventType,
    eventDateText: extraction.eventDateText,
    venueType: extraction.venueType,
    requestedServices: extraction.requestedServices,
    budgetOrPriceQuestion: extraction.budgetOrPriceQuestion,
    objections: extraction.objections,
    phoneCollected: extraction.phoneCollected,
    saleOutcome: extraction.saleOutcome,
    advancingReply: extraction.advancingReply,
    losingReply: extraction.losingReply,
    frequentQuestion: extraction.frequentQuestion,
    recommendedAnswer: extraction.recommendedAnswer,
    leadScore: extraction.leadScore,
    saleProbability: extraction.saleProbability,
    leadTemperature: extraction.leadTemperature,
    lossReason: extraction.lossReason,
    nextAction: extraction.nextAction,
    messageCount: messages.length,
    lastMessageAtSnapshot: conversation.last_message_at,
    extraction: extraction as unknown as Json,
    learningStatus: "completed",
    scoreSalesQuality: extraction.scores?.salesQuality ?? null,
    scoreEmpathy: extraction.scores?.empathy ?? null,
    scoreSpeed: extraction.scores?.speed ?? null,
    scorePersuasion: extraction.scores?.persuasion ?? null,
    scoreClosing: extraction.scores?.closing ?? null,
    scoreNotes: extraction.scores?.gaps ?? null,
    firstCustomerQuestion: extraction.firstCustomerQuestion,
    firstReplyGiven: extraction.firstReplyGiven,
    dropOffPoint: extraction.dropOffPoint,
    reservationCreated: extraction.reservationCreated,
    depositReceived: extraction.depositReceived,
    isBestConversation: markedBest,
  });

  // AI Sales Learning Engine: kalıp / kişilik / hata sinyallerini kalıcı
  // hafızaya işle (başarısız olursa learning akışını bozmasın).
  let salesLearning = {
    patternsUpserted: 0,
    traitsUpserted: 0,
    mistakesUpserted: 0,
    markedBest,
  };
  try {
    salesLearning = await ingestSalesLearningSignals(
      supabase,
      conversationId,
      extraction
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    console.error("[sales-learning] ingest hatası:", message);
  }

  await upsertConversationSummaryFromLearning(supabase, {
    conversationId,
    summary: extraction.summary,
    customerNeeds: extraction.customerNeeds,
    objections: extraction.objections,
    budget: extraction.budgetOrPriceQuestion,
    nextAction: extraction.nextAction,
    leadScore: extraction.leadScore,
    saleProbability: extraction.saleProbability,
    customerIntent: extraction.customerIntent,
    leadTemperature: extraction.leadTemperature,
    lossReason: extraction.lossReason,
    saleOutcome: extraction.saleOutcome,
  });

  await upsertLeadProfileFromExtraction(
    supabase,
    conversation.contact_id,
    extraction
  );

  let knowledgeProposed = 0;
  for (const proposal of extraction.knowledgeProposals) {
    if (!shouldProposeKnowledge(proposal)) {
      continue;
    }

    const maskedContent = maskPii(proposal.content);
    const maskedTitle = maskPii(proposal.title);

    // Global dedupe: aynı başlık başka konuşmadan da geldiyse tekrar ekleme
    const { data: exactDup } = await supabase
      .from("knowledge_documents")
      .select("id")
      .eq("title", maskedTitle)
      .in("review_status", ["pending_review", "approved"])
      .limit(1)
      .maybeSingle();

    if (exactDup) {
      continue;
    }

    await insertPendingKnowledgeDocument(supabase, {
      title: maskedTitle,
      category: proposal.category,
      content: maskedContent,
      faqQuestion: proposal.faqQuestion
        ? maskPii(proposal.faqQuestion)
        : null,
      suggestedAnswer: proposal.suggestedAnswer
        ? maskPii(proposal.suggestedAnswer)
        : null,
      exampleGoodReply: proposal.exampleGoodReply
        ? maskPii(proposal.exampleGoodReply)
        : extraction.advancingReply
          ? maskPii(extraction.advancingReply)
          : null,
      exampleBadReply: proposal.exampleBadReply
        ? maskPii(proposal.exampleBadReply)
        : extraction.losingReply
          ? maskPii(extraction.losingReply)
          : null,
      isPricingSensitive: proposal.isPricingSensitive,
      isCampaignClaim: proposal.isCampaignClaim,
      sourceConversationId: conversationId,
      sourceAnalysisId: analysis.id,
      sourceType: "conversation_learning",
    });

    try {
      const { insertKnowledgeCandidate } = await import(
        "@/features/ai-brain/services/ai-brain.service"
      );
      await insertKnowledgeCandidate(supabase, {
        title: maskedTitle,
        category: proposal.category,
        proposedRule: maskedContent,
        evidenceSummary: extraction.summary
          ? maskPii(extraction.summary).slice(0, 500)
          : null,
        sourceConversationIds: [conversationId],
        confidenceScore: Math.min(
          0.95,
          (extraction.saleProbability ?? 50) / 100
        ),
        expectedImpact: proposal.isPricingSensitive
          ? "Fiyat/politika — admin onayı şart"
          : "Satış dili / SSS",
      });
    } catch {
      // AI Brain adayı opsiyonel; learning akışını bozma
    }

    knowledgeProposed += 1;
  }

  if (conversation.contact_id) {
    try {
      const {
        mergeCustomerMemory,
        memoryUpdateFromAnalysis,
      } = await import(
        "@/features/customer-intelligence/services/customer-memory.service"
      );
      const services = extraction.requestedServices
        ? extraction.requestedServices
            .split(/[,;|/]/)
            .map((s: string) => s.trim())
            .filter(Boolean)
        : [];
      await mergeCustomerMemory(
        supabase,
        conversation.contact_id,
        memoryUpdateFromAnalysis({
          summary: extraction.summary,
          objections: extraction.objections,
          budget_note: extraction.budgetOrPriceQuestion,
          sale_probability: extraction.saleProbability,
          services_mentioned: services,
          metadata: {
            negotiation_tendency: /pazarl[iı]k|indirim/i.test(
              `${extraction.customerIntent ?? ""} ${extraction.objections ?? ""}`
            )
              ? "yüksek"
              : null,
            prior_quote_received: Boolean(extraction.budgetOrPriceQuestion),
            customer_type:
              extraction.leadTemperature === "hot"
                ? "yüksek satın alma ihtimali"
                : extraction.leadTemperature === "cold"
                  ? "düşük satın alma ihtimali"
                  : null,
            customer_type_confidence: 0.55,
          },
        })
      );
    } catch {
      // hafıza güncellemesi opsiyonel
    }
  }

  const { error: touchError } = await supabase
    .from("conversations")
    .update({ last_learned_at: new Date().toISOString() })
    .eq("id", conversationId);

  if (touchError) {
    throw touchError;
  }

  await insertAiRun(supabase, {
    taskType: EXTRACTION_TASK_TYPE,
    conversationId,
    contactId: conversation.contact_id,
    model,
    inputTokens: usage?.prompt_tokens ?? null,
    outputTokens: usage?.completion_tokens ?? null,
    result: {
      analysisId: analysis.id,
      knowledgeProposed,
      saleOutcome: extraction.saleOutcome,
      leadScore: extraction.leadScore,
      salesQualityScore: extraction.scores?.salesQuality ?? null,
      salesPatternsUpserted: salesLearning.patternsUpserted,
      personalityTraitsUpserted: salesLearning.traitsUpserted,
      aiMistakesUpserted: salesLearning.mistakesUpserted,
      markedBestConversation: salesLearning.markedBest,
    },
    status: "completed",
    requiresHumanApproval: false,
  });

  return {
    analysisId: analysis.id,
    knowledgeProposed,
    skipped: false,
  };
}
