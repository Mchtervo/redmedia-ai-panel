import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database";
import { insertAiRun } from "@/features/ai/repositories/ai-runs.repository";
import { listRecentMessagesByConversation } from "@/features/conversations/repositories/messages.repository";
import {
  getConversationSalesBrainState,
  saveConversationSalesBrainState,
} from "@/features/conversations/repositories/conversations.repository";
import {
  buildAssistantUserPrompt,
  getTodayIsoInIstanbul,
  SIMPLE_ASSISTANT_FALLBACK_REPLY,
  SIMPLE_ASSISTANT_SYSTEM_PROMPT,
  SIMPLE_ASSISTANT_TASK_TYPE,
  type AssistantHistoryMessage,
} from "@/features/ai/prompts/simple-assistant";
import { listApprovedKnowledgeForReply } from "@/features/knowledge/repositories/knowledge-documents.repository";
import { searchKnowledgeForReply } from "@/features/knowledge/services/rag.service";
import { getConversationSummary } from "@/features/learning/repositories/conversation-summaries.repository";
import { loadCrmMemoryForPrompt } from "@/features/customer-intelligence/services/customer-profile.service";
import { mergeCustomerMemory } from "@/features/customer-intelligence/services/customer-memory.service";
import {
  buildReservationPromptBlock,
  maybeBuildIbanReply,
} from "@/features/reservations/services/ai-reservation-flow.service";
import {
  buildSalesLearningPromptBlock,
  loadSalesLearningContext,
} from "@/features/sales-learning/services/sales-context.service";
import type { SalesLearningContext } from "@/features/sales-learning/types";
import { buildCatalogPromptBlock } from "@/features/ai/services/catalog-prompt.service";
import { composeCompanyBrainPromptBlock } from "@/features/ai/services/company-brain.service";
import { buildVenueQuotePromptBlock } from "@/features/ai/services/venue-quote.service";
import {
  analyzeAndUpdateSalesBrain,
  composeSalesBrainPromptBlock,
  createInitialSalesBrain,
  memoryUpdateFromSalesBrain,
  parseSalesBrainSnapshot,
  reflectAndMaybeRewrite,
  salesBrainToJson,
  type SalesBrainReflectResult,
  type SalesBrainSnapshot,
} from "@/features/ai/services/sales-brain.service";
import {
  critiqueAndMaybeRewrite,
  type ConversationCriticResult,
} from "@/features/ai/services/conversation-critic.service";
import {
  decideConversationStrategy,
  strategyToJson,
  type ConversationStrategy,
} from "@/features/ai/services/conversation-strategist.service";
import {
  applyReplyAbToStrategy,
  ensureReplyAbAssignment,
} from "@/features/ai/services/reply-ab.service";
import {
  decideSalesDecision,
  decisionPackToJson,
  type DecisionPack,
} from "@/features/ai/services/decision-engine.service";
import { generateTemplatedReply } from "@/features/ai/services/templated-reply.service";
import {
  createRoutedChatCompletion,
  getRoutedModel,
  isOpenAiConfigured,
} from "@/lib/ai/openai-client";

function isConversationCriticEnabled(): boolean {
  const flag = process.env.AI_CONVERSATION_CRITIC_ENABLED?.trim().toLowerCase();
  if (flag === "false" || flag === "0" || flag === "off") return false;
  return true;
}

function isConversationStrategistEnabled(): boolean {
  const flag =
    process.env.AI_CONVERSATION_STRATEGIST_ENABLED?.trim().toLowerCase();
  if (flag === "false" || flag === "0" || flag === "off") return false;
  return true;
}

/** Seed zehri / eski pitch — canlıda asla gönderilmez. */
function containsForbiddenLivePricing(reply: string): boolean {
  return /(?<![.\d])(?:12|15)\.?000\b/.test(reply);
}

type TypedSupabaseClient = SupabaseClient<Database>;

const RECENT_MESSAGE_LIMIT = 12;
const KNOWLEDGE_LIMIT = 12;

/**
 * RAG (docs/29): önce müşteri mesajına anlamsal olarak en yakın onaylı
 * knowledge parçaları aranır; indeks yoksa/hata olursa güncellik sıralı
 * onaylı doküman listesine düşülür. Her iki yol da yalnızca
 * approved + aktif + kampanya iddiası olmayan içerik döner.
 */
async function loadKnowledgeForReply(
  supabase: TypedSupabaseClient,
  customerMessage: string
): Promise<{ category: string | null; title: string; content: string }[]> {
  try {
    const ragHits = await searchKnowledgeForReply(
      supabase,
      customerMessage,
      KNOWLEDGE_LIMIT
    );
    if (ragHits.length > 0) {
      return ragHits.map((hit) => ({
        category: hit.category,
        title: hit.title,
        content: hit.content.slice(0, 600),
      }));
    }
  } catch (ragError) {
    console.error(
      "[simple-assistant] RAG arama hatası:",
      ragError instanceof Error ? ragError.message : "bilinmeyen"
    );
  }

  const docs = await listApprovedKnowledgeForReply(supabase, KNOWLEDGE_LIMIT);
  return docs.map((doc) => ({
    category: doc.category,
    title: doc.title,
    content: doc.content.slice(0, 600),
  }));
}

/**
 * Basit anahtar kelime sınıflandırması — RAG/karar katmanı sonraki faz.
 * Eşleşme `tr-TR` küçük harfe çevrilmiş metin üzerinde yapılır (İ/I farkı).
 */
/** Şikâyet / iptal → insan onayı. Paket fiyatı pazarlığı botta kalır (11k/21k + drone). */
const HUMAN_APPROVAL_KEYWORDS = [
  "şikayet",
  "sikayet",
  "memnun değil",
  "iptal",
] as const;

export type GenerateSimpleAssistantReplyParams = {
  customerMessage: string;
  conversationId: string | null;
  contactId: string | null;
  /**
   * Laboratuvar: Instagram/ChatPlace gönderilmez (çağıran göndermez).
   * Geçmiş `historyOverride` ile gelir; DM kill switch atlanır (OpenAI + AI_MASTER gerekir).
   */
  labMode?: boolean;
  historyOverride?: AssistantHistoryMessage[];
  /** Lab roundtrip — önceki Satış Beyni snapshot. */
  salesBrainOverride?: SalesBrainSnapshot | null;
  /** Conversation Critic katmanını atla (yalnızca özel benchmark/smoke). */
  skipConversationCritic?: boolean;
};

export type GenerateSimpleAssistantReplyResult = {
  reply: string;
  aiRunId: string;
  requiresHumanApproval: boolean;
  model: string;
  /** OpenAI üretimi başarısız; cevap fallback ise true. */
  generationFailed?: boolean;
  errorMessage?: string;
  /** Güncel Satış Beyni (lab roundtrip / debug). */
  salesBrain?: SalesBrainSnapshot;
  salesBrainReflect?: SalesBrainReflectResult;
  /** AI Judge — Critic + rewrite sonucu. */
  conversationCritic?: ConversationCriticResult;
  /** LLM öncesi stratejik hamle. */
  conversationStrategy?: ConversationStrategy;
  /** Decision Engine paketi (strategyId + analiz). */
  decisionPack?: DecisionPack;
};

/** Hassas talepte müşteriye giden nötr ara cevap (onaydan ÖNCE). */
export const HUMAN_APPROVAL_HOLD_REPLY =
  "Talebiniz ilgili ekibe iletildi. En kısa sürede dönüş yapacağız.";

/**
 * Canlı Instagram/DM auto-reply.
 * ACİL: varsayılan KAPALI. Açmak için açıkça:
 * AI_REPLY_ENABLED=true veya AI_AUTO_REPLY_ENABLED=true
 * (+ OpenAI + panel AI_DM_ASSISTANT).
 */
export function isAiAutoReplyEnabled(): boolean {
  const flag = (
    process.env.AI_REPLY_ENABLED ??
    process.env.AI_AUTO_REPLY_ENABLED ??
    ""
  )
    .trim()
    .toLowerCase();
  if (flag === "true" || flag === "1" || flag === "on") {
    return isOpenAiConfigured();
  }
  return false;
}

export function requiresHumanApproval(customerMessage: string): boolean {
  const normalized = customerMessage.toLocaleLowerCase("tr-TR");
  return HUMAN_APPROVAL_KEYWORDS.some((keyword) =>
    normalized.includes(keyword)
  );
}

async function loadRecentHistory(
  supabase: TypedSupabaseClient,
  conversationId: string,
  currentMessage: string
): Promise<AssistantHistoryMessage[]> {
  const messages = await listRecentMessagesByConversation(
    supabase,
    conversationId,
    RECENT_MESSAGE_LIMIT
  );

  const history = messages
    .filter((message) => Boolean(message.content?.trim()))
    .map((message) => ({
      senderType: message.sender_type,
      content: message.content!.trim().slice(0, 500),
    }));

  // Geçmişte zaten son müşteri mesajı varsa tekrar ekleme.
  const last = history[history.length - 1];
  if (
    last?.senderType === "customer" &&
    last.content === currentMessage.trim()
  ) {
    return history;
  }

  return history;
}

/**
 * Redmedia satış asistanı: CRM profil + özet + son mesajlar → OpenAI → ai_runs.
 */
export async function generateSimpleAssistantReply(
  supabase: TypedSupabaseClient,
  params: GenerateSimpleAssistantReplyParams
): Promise<GenerateSimpleAssistantReplyResult | null> {
  const labMode = Boolean(params.labMode);

  const { isAiFeatureEnabled } = await import(
    "@/features/settings/services/ai-feature-flags.service"
  );

  if (labMode) {
    // Lab: canlı DM kapalı olsa bile test edilebilir; master + OpenAI gerekir.
    if (!isOpenAiConfigured()) return null;
    const masterOn = await isAiFeatureEnabled(supabase, "AI_MASTER");
    if (!masterOn) return null;
  } else {
    if (!isAiAutoReplyEnabled()) {
      return null;
    }
    const dmEnabled = await isAiFeatureEnabled(supabase, "AI_DM_ASSISTANT");
    if (!dmEnabled) {
      return null;
    }
  }

  const model = getRoutedModel("dm_reply");
  const needsHuman = requiresHumanApproval(params.customerMessage);
  const userContent = params.customerMessage.trim().slice(0, 4000);

  if (!userContent) {
    return null;
  }

  // Hassas talep: nihai satış cevabı ÜRETİLMEZ / GÖNDERİLMEZ.
  // Nötr ara cevap + onay kuyruğu (göndermeden önce kapı).
  if (needsHuman) {
    const aiRun = await insertAiRun(supabase, {
      taskType: SIMPLE_ASSISTANT_TASK_TYPE,
      conversationId: params.conversationId,
      contactId: params.contactId,
      model: "system_human_approval_hold",
      result: {
        input: {
          customerMessage: userContent,
          mode: "human_approval_hold",
          labMode,
        },
        output: { reply: HUMAN_APPROVAL_HOLD_REPLY },
      },
      status: "completed",
      requiresHumanApproval: true,
    });
    return {
      reply: HUMAN_APPROVAL_HOLD_REPLY,
      aiRunId: aiRun.id,
      requiresHumanApproval: true,
      model: "system_human_approval_hold",
    };
  }

  try {
    const conversationId = params.conversationId;
    const historyFromOverride = params.historyOverride;

    const [
      crmProfile,
      recentMessages,
      summaryRow,
      approvedKnowledge,
      reservationDraftBlock,
      ibanReply,
      salesLearningContext,
      catalogBlock,
    ] = await Promise.all([
      loadCrmMemoryForPrompt(supabase, params.contactId),
      historyFromOverride
        ? Promise.resolve(
            historyFromOverride
              .filter((m) => Boolean(m.content?.trim()))
              .map((m) => ({
                senderType: m.senderType,
                content: m.content.trim().slice(0, 500),
              }))
              .slice(-RECENT_MESSAGE_LIMIT)
          )
        : conversationId
          ? loadRecentHistory(supabase, conversationId, userContent)
          : Promise.resolve([] as AssistantHistoryMessage[]),
      conversationId
        ? getConversationSummary(supabase, conversationId)
        : Promise.resolve(null),
      loadKnowledgeForReply(supabase, userContent),
      conversationId && !labMode
        ? buildReservationPromptBlock(supabase, conversationId)
        : Promise.resolve(null),
      conversationId && !labMode
        ? maybeBuildIbanReply(supabase, conversationId, userContent)
        : Promise.resolve(null),
      loadSalesLearningContext(supabase).catch((): SalesLearningContext => ({
        patterns: [],
        personality: [],
        activeMistakes: [],
        bestConversations: [],
      })),
      buildCatalogPromptBlock(supabase).catch(() => "(katalog okunamadı)"),
    ]);

    if (ibanReply) {
      const aiRun = await insertAiRun(supabase, {
        taskType: SIMPLE_ASSISTANT_TASK_TYPE,
        conversationId: params.conversationId,
        contactId: params.contactId,
        model: "system_iban_template",
        result: {
          input: {
            customerMessage: userContent,
            mode: "iban_template",
            labMode,
          },
          output: { reply: ibanReply },
        },
        status: "completed",
        requiresHumanApproval: false,
      });
      return {
        reply: ibanReply,
        aiRunId: aiRun.id,
        requiresHumanApproval: false,
        model: "system_iban_template",
      };
    }

    const salesLearningBlock = buildSalesLearningPromptBlock(
      salesLearningContext,
      userContent
    );
    const companyBrainBlock = composeCompanyBrainPromptBlock({
      catalogBlock,
      salesLearningBlock,
    });

    const historyText = recentMessages
      .map((m) => {
        const role =
          m.senderType === "customer"
            ? "Müşteri"
            : m.senderType === "ai"
              ? "Asistan"
              : m.senderType === "staff"
                ? "Personel"
                : m.senderType;
        return `${role}: ${m.content}`;
      })
      .join("\n");

    const venueQuoteBlock = buildVenueQuotePromptBlock(
      historyText,
      userContent
    );

    const sessionKey =
      params.conversationId ??
      (labMode ? "lab" : params.contactId ?? "session");

    let previousBrain: SalesBrainSnapshot | null =
      params.salesBrainOverride
        ? parseSalesBrainSnapshot(params.salesBrainOverride)
        : null;

    if (!previousBrain && conversationId && !labMode) {
      try {
        const stored = await getConversationSalesBrainState(
          supabase,
          conversationId
        );
        previousBrain = parseSalesBrainSnapshot(stored);
      } catch (brainLoadError) {
        console.error(
          "[simple-assistant] sales brain load:",
          brainLoadError instanceof Error
            ? brainLoadError.message
            : "bilinmeyen"
        );
      }
    }

    if (!previousBrain) {
      previousBrain = createInitialSalesBrain(sessionKey, 0);
    }

    let salesBrain = analyzeAndUpdateSalesBrain({
      customerMessage: userContent,
      historyText,
      previous: previousBrain,
      crmProfile,
      sessionKey,
    });

    // Memory isolation: selamlama/sohbette eski give_price NBA taşınmasın
    const { isNonSalesOpen, isNearDuplicateReply } = await import(
      "@/features/ai/services/message-intent"
    );
    if (isNonSalesOpen(userContent)) {
      salesBrain = {
        ...salesBrain,
        objective: "discover_need",
        nextBestAction: "ask_question",
        mainBlocker: "info",
      };
    }

    const salesBrainBlock = composeSalesBrainPromptBlock(salesBrain);

    const lastAiReply =
      [...recentMessages]
        .reverse()
        .find((m) => m.senderType === "ai")
        ?.content?.trim() ?? null;

    let conversationStrategy: ConversationStrategy | undefined;
    let decisionPack: DecisionPack | undefined;
    let replyAb: { variant: "A" | "B"; experimentKey: string } | null = null;
    if (!labMode && conversationId) {
      try {
        replyAb = await ensureReplyAbAssignment(supabase, conversationId);
      } catch {
        replyAb = null;
      }
    }
    if (isConversationStrategistEnabled()) {
      conversationStrategy = decideConversationStrategy({
        brain: salesBrain,
        customerMessage: userContent,
      });
      if (replyAb) {
        conversationStrategy = applyReplyAbToStrategy(
          conversationStrategy,
          replyAb.variant,
          userContent
        );
      }
      decisionPack = decideSalesDecision({
        brain: salesBrain,
        customerMessage: userContent,
        conversationStrategy,
      });
      conversationStrategy = decisionPack.conversationStrategy;
    }

    let replyText = "";
    let modelUsed = getRoutedModel("dm_reply");
    let emptyContentRetry = false;
    let salesBrainReflect: SalesBrainReflectResult | undefined;
    let conversationCritic: ConversationCriticResult | undefined;
    let templateMeta: Json | null = null;
    let usageTokens: { input: number | null; output: number | null } = {
      input: null,
      output: null,
    };

    // Template Engine yolu — Decision Pack varken serbest GPT yazımı YOK
    if (decisionPack) {
      const templated = await generateTemplatedReply({
        pack: decisionPack,
        customerMessage: userContent,
        dateHint: salesBrain.memory.dateHint,
        lastAiReply,
      });

      if (
        lastAiReply &&
        isNearDuplicateReply(templated.reply, lastAiReply) &&
        decisionPack.strategyId !== "GREETING_ACK_v1"
      ) {
        const aiRun = await insertAiRun(supabase, {
          taskType: SIMPLE_ASSISTANT_TASK_TYPE,
          conversationId: params.conversationId,
          contactId: params.contactId,
          model: "system_duplicate_reply_block",
          result: {
            error: "duplicate_reply_blocked",
            lastAiReply: lastAiReply.slice(0, 300),
            blockedReply: templated.reply.slice(0, 300),
          },
          status: "failed",
          requiresHumanApproval: needsHuman,
        });
        return {
          reply: SIMPLE_ASSISTANT_FALLBACK_REPLY,
          aiRunId: aiRun.id,
          requiresHumanApproval: needsHuman,
          model: "system_duplicate_reply_block",
          generationFailed: true,
          errorMessage: "Aynı cevap tekrar engellendi; gönderilmedi.",
          salesBrain,
          decisionPack,
        };
      }

      if (!templated.validation.ok) {
        // generateTemplatedReply garantör; yine de asla invalid gönderme
        const aiRun = await insertAiRun(supabase, {
          taskType: SIMPLE_ASSISTANT_TASK_TYPE,
          conversationId: params.conversationId,
          contactId: params.contactId,
          model: templated.model ?? modelUsed,
          inputTokens: null,
          outputTokens: null,
          result: {
            error: "template_validation_failed",
            decisionPack: decisionPackToJson(decisionPack) as Json,
            attempts: templated.attempts as unknown as Json,
          },
          status: "failed",
          requiresHumanApproval: needsHuman,
        });
        return {
          reply: SIMPLE_ASSISTANT_FALLBACK_REPLY,
          aiRunId: aiRun.id,
          requiresHumanApproval: needsHuman,
          model: templated.model ?? modelUsed,
          generationFailed: true,
          errorMessage: "Template validator geçmedi; mesaj gönderilmedi.",
          salesBrain,
          decisionPack,
        };
      }

      replyText = templated.reply;
      modelUsed = templated.model ?? `template:${decisionPack.strategyId}`;
      templateMeta = {
        strategyId: decisionPack.strategyId,
        usedFallback: templated.usedFallback,
        usedGptSlots: templated.usedGptSlots,
        attempts: templated.attempts as unknown as Json,
        validationOk: true,
      };

      // Reflect yalnızca memory kapanış kaydı — rewrite YOK (strategy bozulmasın)
      const reflected = await reflectAndMaybeRewrite({
        reply: replyText,
        brain: salesBrain,
        customerMessage: userContent,
        skipRewrite: true,
      });
      salesBrain = reflected.brain;
      salesBrainReflect = reflected.reflect;
    } else {
      // Legacy: strategist kapalıysa eski serbest yazım
      const promptUserContent = buildAssistantUserPrompt({
        customerMessage: userContent,
        crmProfile,
        recentMessages,
        todayIsoDate: getTodayIsoInIstanbul(),
        conversationSummary: summaryRow?.summary ?? null,
        approvedKnowledge,
        reservationDraftBlock,
        salesLearningBlock,
        catalogBlock,
        companyBrainBlock,
        venueQuoteBlock,
        salesBrainBlock,
        decisionEngineBlock: null,
      });

      const chatMessages = [
        { role: "system" as const, content: SIMPLE_ASSISTANT_SYSTEM_PROMPT },
        { role: "user" as const, content: promptUserContent },
      ];

      let { completion, modelUsed: routedModel } =
        await createRoutedChatCompletion("dm_reply", {
          temperature: 0.55,
          max_tokens: 350,
          messages: chatMessages,
        });
      modelUsed = routedModel;
      usageTokens = {
        input: completion.usage?.prompt_tokens ?? null,
        output: completion.usage?.completion_tokens ?? null,
      };
      replyText = completion.choices[0]?.message?.content?.trim() ?? "";

      if (!replyText) {
        emptyContentRetry = true;
        const retry = await createRoutedChatCompletion("dm_reply", {
          temperature: 0.55,
          max_tokens: 900,
          messages: chatMessages,
        });
        completion = retry.completion;
        modelUsed = retry.modelUsed;
        usageTokens = {
          input: completion.usage?.prompt_tokens ?? null,
          output: completion.usage?.completion_tokens ?? null,
        };
        replyText = completion.choices[0]?.message?.content?.trim() ?? "";
      }

      if (!replyText) {
        const aiRun = await insertAiRun(supabase, {
          taskType: SIMPLE_ASSISTANT_TASK_TYPE,
          conversationId: params.conversationId,
          contactId: params.contactId,
          model: modelUsed,
          inputTokens: usageTokens.input,
          outputTokens: usageTokens.output,
          result: {
            error: "empty_model_content",
            errorMessage: "Model metin üretmedi.",
          },
          status: "failed",
          requiresHumanApproval: needsHuman,
        });
        return {
          reply: SIMPLE_ASSISTANT_FALLBACK_REPLY,
          aiRunId: aiRun.id,
          requiresHumanApproval: needsHuman,
          model: modelUsed,
          generationFailed: true,
          errorMessage: "Model boş cevap döndü.",
          salesBrain,
        };
      }

      const reflected = await reflectAndMaybeRewrite({
        reply: replyText,
        brain: salesBrain,
        customerMessage: userContent,
      });
      replyText = reflected.reply;
      salesBrain = reflected.brain;
      salesBrainReflect = reflected.reflect;

      if (
        !params.skipConversationCritic &&
        isConversationCriticEnabled() &&
        !needsHuman
      ) {
        const historyForCritic =
          recentMessages.length > 0
            ? recentMessages
            : (params.historyOverride ?? []);
        const recentTranscript = historyForCritic
          .slice(-8)
          .map(
            (m) =>
              `${m.senderType === "customer" ? "Müşteri" : "Asistan"}: ${m.content}`
          )
          .join("\n");
        conversationCritic = await critiqueAndMaybeRewrite({
          draftReply: replyText,
          customerMessage: userContent,
          brain: salesBrain,
          recentTranscript: recentTranscript || undefined,
        });
        replyText = conversationCritic.finalReply;
      }
    }

    if (conversationId && !labMode) {
      try {
        await saveConversationSalesBrainState(
          supabase,
          conversationId,
          salesBrainToJson(salesBrain) as Json
        );
      } catch (brainSaveError) {
        console.error(
          "[simple-assistant] sales brain save:",
          brainSaveError instanceof Error
            ? brainSaveError.message
            : "bilinmeyen"
        );
      }
    }

    if (params.contactId && !labMode) {
      try {
        await mergeCustomerMemory(
          supabase,
          params.contactId,
          memoryUpdateFromSalesBrain(salesBrain)
        );
      } catch (memError) {
        console.error(
          "[simple-assistant] CRM memory sync:",
          memError instanceof Error ? memError.message : "bilinmeyen"
        );
      }
    }

    if (containsForbiddenLivePricing(replyText)) {
      const aiRun = await insertAiRun(supabase, {
        taskType: SIMPLE_ASSISTANT_TASK_TYPE,
        conversationId: params.conversationId,
        contactId: params.contactId,
        model: modelUsed,
        inputTokens: usageTokens.input,
        outputTokens: usageTokens.output,
        result: {
          error: "forbidden_legacy_pricing",
          blockedReply: replyText.slice(0, 500),
          engine: decisionPack
            ? "redmedia_template_engine_v1"
            : "redmedia_legacy_prompt_v1",
        },
        status: "failed",
        requiresHumanApproval: needsHuman,
      });
      return {
        reply: SIMPLE_ASSISTANT_FALLBACK_REPLY,
        aiRunId: aiRun.id,
        requiresHumanApproval: needsHuman,
        model: modelUsed,
        generationFailed: true,
        errorMessage:
          "Eski paket fiyatı (12/15k) engellendi; mesaj gönderilmedi.",
        salesBrain,
        decisionPack,
      };
    }

    const resultPayload: Json = {
      input: {
        engine: decisionPack
          ? "redmedia_template_engine_v1"
          : "redmedia_legacy_prompt_v1",
        customerMessage: userContent,
        labMode,
        emptyContentRetry,
        salesBrain: salesBrainToJson(salesBrain) as Json,
        decisionPack: decisionPack
          ? (decisionPackToJson(decisionPack) as Json)
          : null,
        template: templateMeta,
        conversationStrategy: conversationStrategy
          ? (strategyToJson(conversationStrategy) as Json)
          : null,
        replyAb: replyAb
          ? { variant: replyAb.variant, experimentKey: replyAb.experimentKey }
          : null,
        salesBrainReflect: salesBrainReflect
          ? {
              pass: salesBrainReflect.pass,
              issues: salesBrainReflect.issues,
              rewritten: salesBrainReflect.rewritten,
            }
          : null,
        conversationCritic: conversationCritic
          ? {
              rewritten: conversationCritic.rewritten,
              model: conversationCritic.model,
              finding: conversationCritic.finding,
              originalReply: conversationCritic.originalReply,
            }
          : null,
        crmProfile: crmProfile
          ? {
              status: crmProfile.status,
              leadScore: crmProfile.leadScore,
              eventType: crmProfile.eventType,
              eventDate: crmProfile.eventDate,
              hasPhone: Boolean(crmProfile.phone?.trim()),
              requestedServices: crmProfile.requestedServices,
            }
          : null,
        recentMessageCount: recentMessages.length,
        approvedKnowledgeCount: approvedKnowledge.length,
        hasConversationSummary: Boolean(summaryRow?.summary),
        hasCatalog: Boolean(catalogBlock && !catalogBlock.startsWith("(")),
        salesLearning: {
          patternCount: salesLearningContext.patterns.length,
          personalityTraitCount: salesLearningContext.personality.length,
          activeMistakeCount: salesLearningContext.activeMistakes.length,
          bestConversationCount:
            salesLearningContext.bestConversations.length,
        },
      },
      output: { reply: replyText },
      requiresHumanApproval: needsHuman,
    };

    const aiRun = await insertAiRun(supabase, {
      taskType: SIMPLE_ASSISTANT_TASK_TYPE,
      conversationId: params.conversationId,
      contactId: params.contactId,
      model: modelUsed,
      inputTokens: usageTokens.input,
      outputTokens: usageTokens.output,
      result: resultPayload,
      status: "completed",
      requiresHumanApproval: needsHuman,
    });

    return {
      reply: replyText,
      aiRunId: aiRun.id,
      requiresHumanApproval: needsHuman,
      model: aiRun.model,
      salesBrain,
      salesBrainReflect,
      conversationCritic,
      conversationStrategy,
      decisionPack,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "openai_error";
    console.error("[simple-assistant] OpenAI hatası:", message);

    const failedResult: Json = {
      input: { customerMessage: userContent, labMode },
      error: "generation_failed",
      errorMessage: message,
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

    // Lab: fallback'i "başarılı cevap" gibi gösterme; gerçek hatayı ilet.
    if (labMode) {
      return {
        reply: SIMPLE_ASSISTANT_FALLBACK_REPLY,
        aiRunId: aiRun.id,
        requiresHumanApproval: needsHuman,
        model,
        generationFailed: true,
        errorMessage: message,
      };
    }

    return {
      reply: SIMPLE_ASSISTANT_FALLBACK_REPLY,
      aiRunId: aiRun.id,
      requiresHumanApproval: needsHuman,
      model,
      generationFailed: true,
      errorMessage: message,
    };
  }
}
