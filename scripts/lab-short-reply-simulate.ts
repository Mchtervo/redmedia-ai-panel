/**
 * Canlı Tamam/Yarın simülasyonu — Instagram gönderimi YOK.
 * npx tsx scripts/lab-short-reply-simulate.ts
 */
import { createInitialSalesBrain } from "@/features/ai/services/sales-brain.service";
import { decideConversationStrategy } from "@/features/ai/services/conversation-strategist.service";
import { decideSalesDecision } from "@/features/ai/services/decision-engine.service";
import {
  composeDeterministicFallback,
  getTemplateForDecision,
} from "@/features/ai/services/reply-template.engine";
import { validateTemplatedReply } from "@/features/ai/services/reply-validator.service";
import { resolveShortReplyContext } from "@/features/ai/services/short-reply-context.service";
import { getRoutedModel } from "@/lib/ai/openai-client";

function simulate(params: {
  label: string;
  customerMessage: string;
  lastAiReply: string;
  oldStrategyId: string;
}) {
  const brain = createInitialSalesBrain("lab-sim", 3);
  brain.nextBestAction = "show_reference"; // eski canlı NBA tuzağı
  brain.objective = "build_trust";
  brain.state = "value";

  const shortReply = resolveShortReplyContext({
    customerMessage: params.customerMessage,
    lastAiReply: params.lastAiReply,
  });
  if (shortReply.kind === "date_answer" && shortReply.resolvedValue) {
    brain.memory.dateHint = shortReply.resolvedValue;
  }

  const conversationStrategy = decideConversationStrategy({
    brain,
    customerMessage: params.customerMessage,
    shortReply,
  });
  const pack = decideSalesDecision({
    brain,
    customerMessage: params.customerMessage,
    conversationStrategy,
    shortReply,
    lastAiReply: params.lastAiReply,
  });
  const template = getTemplateForDecision(pack, {
    customerMessage: params.customerMessage,
    shortReply,
    dateHint: brain.memory.dateHint,
    lastAiReply: params.lastAiReply,
  });
  const reply = composeDeterministicFallback(template);
  const validation = validateTemplatedReply({
    reply,
    template,
    pack: {
      ...pack,
      requireCta: template.requireCta,
      requireSocialProof: template.requireReference,
      allowPrice: template.allowPrice,
      maxQuestions: template.requireQuestion ? 1 : 0,
      maxWords: template.maxWords,
    },
    customerMessage: params.customerMessage,
    shortReply,
    dateHint: brain.memory.dateHint,
  });

  console.log("\n==========", params.label, "==========");
  console.log(
    JSON.stringify(
      {
        previousContext: params.lastAiReply,
        inbound: params.customerMessage,
        oldStrategyId: params.oldStrategyId,
        shortReplyResolution: {
          kind: shortReply.kind,
          answeredTopic: shortReply.answeredTopic,
          resolvedValue: shortReply.resolvedValue,
          rationale: shortReply.rationale,
        },
        newStrategyId: pack.strategyId,
        templateId: template.strategyId,
        dateHint: brain.memory.dateHint,
        validator: validation,
        finalReply: reply,
        routedModel: getRoutedModel("dm_reply"),
      },
      null,
      2
    )
  );
}

function main(): void {
  console.log("MODEL", getRoutedModel("dm_reply"));
  console.log("(Template defaults — GPT slot yok; Lab/read-only)");

  simulate({
    label: "Canlı-sim: Tamam",
    customerMessage: "Tamam",
    lastAiReply:
      "Merhaba, hoş geldiniz. Dış çekim mi yoksa düğün günü çekimi mi düşünüyorsunuz?",
    oldStrategyId: "INFO_ONE_QUESTION_v2",
  });

  simulate({
    label: "Canlı-sim: Yarın (tarih sorusu sonrası)",
    customerMessage: "Yarın",
    lastAiReply: "Anladım. Düğün tarihiniz net mi? Yazın, ona göre devam edelim.",
    oldStrategyId: "SHOW_EXAMPLE_v1",
  });
}

main();
