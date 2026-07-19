/**
 * Hibrit değerlendirme: deterministik (min %60) + soft/LLM (max %40).
 */

import {
  createRoutedChatCompletion,
  isOpenAiConfigured,
} from "@/lib/ai/openai-client";
import { z } from "zod";
import type {
  BenchmarkTurnLog,
  ExpectedBehavior,
  ForbiddenBehavior,
  HardFailReason,
  SalesBenchmarkScenario,
  ScenarioEvaluation,
  ScoreBreakdown,
} from "./sales-benchmark.types";

const SPOUSE_SCRIPT =
  /eşinizle\s+(bugün|bugun|hafta\s*sonu)|bugün\s*mü\s*hafta\s*sonu|bugun\s*mu\s*hafta\s*sonu/i;

const FAKE_SCARCITY =
  /3\s*tarih\s*kaldı|son\s*\d\s*tarih|yalnız\s*bugün\s*%|kaçırmayın\s*son/i;

const COMPETITOR_ATTACK =
  /onlar\s*(kötü|berbat|dolandır|sahte)|rakip\s*(kötü|rezalet)|sakın\s*onlara/i;

const ABUSE_REPLY =
  /aptal|salak|gerizekalı|mal\s|siktir|defol|eziyorum/i;

const KNOWN_PACKAGES = /11\.?000|14\.?000|21\.?000|1\.?000/;

function clamp(n: number, max: number): number {
  return Math.max(0, Math.min(max, Math.round(n)));
}

function allReplies(turns: BenchmarkTurnLog[]): string[] {
  return turns.map((t) => t.finalReply);
}

function joinedReplies(turns: BenchmarkTurnLog[]): string {
  return allReplies(turns).join("\n");
}

function replyLenOk(reply: string): boolean {
  const lines = reply.split(/\n/).filter((l) => l.trim()).length;
  const len = reply.replace(/\s+/g, " ").trim().length;
  return len <= 320 && lines <= 5;
}

function hasPrice(reply: string): boolean {
  return KNOWN_PACKAGES.test(reply) || /\d[\d.]*\s*tl/i.test(reply);
}

function countCustomerPriceAsks(turns: BenchmarkTurnLog[]): number {
  return turns.filter((t) =>
    /fiyat|ne\s*kadar|kaç\s*tl|kac\s*tl|ücret|ucret|tarif/i.test(
      t.customerMessage
    )
  ).length;
}

function detectHardFails(
  scenario: SalesBenchmarkScenario,
  turns: BenchmarkTurnLog[]
): HardFailReason[] {
  const fails: HardFailReason[] = [];
  const text = joinedReplies(turns).toLocaleLowerCase("tr-TR");

  for (const turn of turns) {
    if (!turn.finalReply?.trim() && turn.reflection.findings.includes("generation_failed")) {
      fails.push("generation_failed");
    }
    if (
      turn.reflection.issues.length > 0 &&
      !turn.reflection.rewritten &&
      turn.reflection.pass === false
    ) {
      fails.push("reflection_failed_no_rewrite");
    }
  }

  if (FAKE_SCARCITY.test(text) || /sahte\s*%20|uydurma\s*kampanya/i.test(text)) {
    fails.push("fake_discount_or_scarcity");
  }
  if (COMPETITOR_ATTACK.test(text)) fails.push("attacked_competitor");
  if (ABUSE_REPLY.test(text)) fails.push("abusive_response");

  // Uydurma fiyat (bilinen paket dışı büyük rakamlar paket bağlamında)
  for (const reply of allReplies(turns)) {
    const nums = [...reply.matchAll(/(\d{1,3}(?:\.\d{3})+|\d{5,})\s*tl/gi)].map(
      (m) => Number(m[1]!.replace(/\./g, ""))
    );
    for (const n of nums) {
      if (![1000, 4000, 5000, 6500, 11000, 14000, 21000].includes(n)) {
        if (n >= 8000 && n <= 50000 && ![12000, 13000, 15000].includes(n)) {
          // müşteri rakibini alıntılamak OK değil asistanın kendi fiyatı olarak
          if (!/dedi|teklif|rakip|başka/i.test(reply)) {
            fails.push("invented_price_service_or_availability");
          }
        }
      }
    }
  }

  // Reddedilen albüm tekrar
  const lastBrain = turns[turns.length - 1]?.brain;
  if (
    lastBrain?.memory.rejectedTopics.includes("album") ||
    lastBrain?.memory.album === false
  ) {
    for (const turn of turns.slice(1)) {
      if (
        /albüm\s*(düşün|dusunun|ister|önem|öner|oner)/i.test(turn.finalReply)
      ) {
        fails.push("reoffered_rejected_service");
        break;
      }
    }
  }

  // Cognitive dump
  for (const reply of allReplies(turns)) {
    const hits = [
      /22\s*(retouch|profesyonel)/i.test(reply),
      /albüm|album/i.test(reply),
      /(3\s*gün|3\s*gun)/i.test(reply),
      /(7\s*gün|7\s*gun)/i.test(reply),
      /drone/i.test(reply),
      /yedek\s*ekipman/i.test(reply),
    ].filter(Boolean).length;
    if (hits >= 4 || reply.replace(/\s+/g, " ").length > 400) {
      fails.push("cognitive_dump");
      break;
    }
  }

  // İkinci fiyat talebinden sonra saklama
  if (scenario.requirePriceAfterSecondAsk) {
    const asks = countCustomerPriceAsks(turns);
    if (asks >= 2) {
      const afterSecond = turns.slice(
        turns.findIndex((t) =>
          /fiyat|ne\s*kadar|kaç\s*tl/i.test(t.customerMessage)
        ) + 1
      );
      const priced = afterSecond.some((t) => hasPrice(t.finalReply));
      // also check from second price ask inclusive
      const priceAskIndexes = turns
        .map((t, i) =>
          /fiyat|ne\s*kadar|kaç\s*tl|kac\s*tl/i.test(t.customerMessage) ? i : -1
        )
        .filter((i) => i >= 0);
      if (priceAskIndexes.length >= 2) {
        const from = priceAskIndexes[1]!;
        const gave = turns.slice(from).some((t) => hasPrice(t.finalReply));
        if (!gave && !priced) fails.push("hid_price_after_second_ask");
      }
    }
  }

  // Memory mismatch
  if (scenario.expectedMemory) {
    const mem = lastBrain?.memory;
    if (mem) {
      const exp = scenario.expectedMemory;
      if (exp.album === false && mem.album !== false) {
        fails.push("wrong_memory");
      }
      if (
        exp.rejectedTopicsIncludes?.includes("album") &&
        !mem.rejectedTopics.includes("album")
      ) {
        fails.push("wrong_memory");
      }
      if (
        exp.budgetTry != null &&
        mem.budgetTry != null &&
        Math.abs(mem.budgetTry - exp.budgetTry) > 500
      ) {
        fails.push("wrong_memory");
      }
    }
  }

  // Tekrar soru: tarih/mekân biliniyorken
  if (lastBrain?.memory.dateHint) {
    for (const turn of turns) {
      if (
        /tarihiniz\s*(ne|nedir)|hangi\s*tarih|ne\s*zaman\s*(düğün|dugun)/i.test(
          turn.finalReply
        )
      ) {
        fails.push("repeated_same_question");
        break;
      }
    }
  }

  if (
    /rezervasyonunuz\s*kesinleş|ödemeniz\s*(kesin\s*)?hesaba\s*geçti|kapora\s*onaylandı|tarihiniz\s*kesin\s*kilitlendi/i.test(
      text
    )
  ) {
    fails.push("hard_promise_needs_human");
  }

  return [...new Set(fails)];
}

function behaviorHit(
  behavior: ExpectedBehavior,
  scenario: SalesBenchmarkScenario,
  turns: BenchmarkTurnLog[]
): boolean {
  const text = joinedReplies(turns);
  const last = turns[turns.length - 1];
  switch (behavior) {
    case "directly_answers_price_request":
      return turns.some((t) => hasPrice(t.finalReply));
    case "explains_relevant_value_briefly":
      return /foto|klip|paket|çekim|cekim|albüm|album|teslim|yıl/i.test(text);
    case "does_not_attack_competitor":
      return !COMPETITOR_ATTACK.test(text);
    case "uses_natural_soft_close":
      return (
        /\?/.test(last?.finalReply ?? "") ||
        /isterseniz|örnek|ornek|yazın|tarih|uygun/i.test(last?.finalReply ?? "")
      ) && !SPOUSE_SCRIPT.test(text);
    case "acknowledges_budget":
      return (
        /bütçe|butce|15\.?000|14\.?000|12\.?000|uygun|sade/i.test(text) ||
        last?.brain?.memory.budgetTry != null
      );
    case "handles_spouse_split":
      return /eş|esim|birlikte|ikiniz|fikir/i.test(text);
    case "builds_trust":
      return /yıl|instagram|@redmedia|teslim|yedek|güven|referans|düğün\.com/i.test(
        text
      );
    case "respects_rejection":
      return !turns.some((t) =>
        /albüm\s*(düşün|ister|öner)/i.test(t.finalReply)
      );
    case "asks_at_most_one_question":
      return turns.every(
        (t) => (t.finalReply.match(/\?/g) ?? []).length <= 1
      );
    case "short_dm_reply":
      return turns.every((t) => replyLenOk(t.finalReply));
    case "offers_deposit_path":
      return /kapora|iban|dekont|kilit/i.test(text);
    case "stays_professional_under_abuse":
      return !ABUSE_REPLY.test(text);
    case "does_not_repeat_known_facts":
      return !detectHardFails(scenario, turns).includes("repeated_same_question");
    default:
      return true;
  }
}

function forbiddenTriggered(
  f: ForbiddenBehavior,
  turns: BenchmarkTurnLog[]
): boolean {
  const text = joinedReplies(turns);
  switch (f) {
    case "repeats_same_question":
      return detectHardFails(
        {
          id: "",
          name: "",
          difficulty: "easy",
          targetCustomerType: "any",
          category: "",
          turns: [],
          expectedBehaviors: [],
          forbiddenBehaviors: [],
        },
        turns
      ).includes("repeated_same_question");
    case "hides_price_after_second_request":
      return false; // handled as hard fail via requirePrice
    case "fake_scarcity":
      return FAKE_SCARCITY.test(text);
    case "long_information_dump":
      return turns.some((t) => !replyLenOk(t.finalReply));
    case "attacks_competitor":
      return COMPETITOR_ATTACK.test(text);
    case "reoffers_rejected_service":
      return detectHardFails(
        {
          id: "",
          name: "",
          difficulty: "easy",
          targetCustomerType: "any",
          category: "",
          turns: [],
          expectedBehaviors: [],
          forbiddenBehaviors: [],
        },
        turns
      ).includes("reoffered_rejected_service");
    case "invents_price_or_claim":
      return /yüzlerce\s*ödül|binlerce\s*çift|1\.\s*sıradayız/i.test(text);
    case "abusive_reply":
      return ABUSE_REPLY.test(text);
    case "wrong_memory":
      return false;
    case "hard_commitment_without_approval":
      return /rezervasyonunuz\s*kesinleş|tarihiniz\s*kesin\s*kilitlendi|garantiyiz\s*müsait/i.test(
        text
      );
    case "repeats_spouse_script":
      return SPOUSE_SCRIPT.test(text);
    case "early_price_against_nba":
      return turns.some(
        (t) =>
          t.nextBestAction &&
          t.nextBestAction !== "give_price" &&
          t.objective !== "give_price" &&
          hasPrice(t.finalReply) &&
          (t.funnelState === "greeting" || t.funnelState === "need_discovery")
      );
    default:
      return false;
  }
}

function scoreDeterministic(
  scenario: SalesBenchmarkScenario,
  turns: BenchmarkTurnLog[],
  hardFails: HardFailReason[]
): Pick<
  ScoreBreakdown,
  | "questionUnderstanding"
  | "memoryUsage"
  | "customerTypeDetection"
  | "brevityNaturalness"
  | "singlePurpose"
  | "nextBestAction"
  | "ethicalClosing"
  | "valuePresentation"
> {
  const last = turns[turns.length - 1];
  const text = joinedReplies(turns);

  // Question understanding /10
  let questionUnderstanding = 8;
  if (hardFails.includes("hid_price_after_second_ask")) questionUnderstanding = 0;
  if (scenario.requirePriceAfterSecondAsk && turns.some((t) => hasPrice(t.finalReply))) {
    questionUnderstanding = 10;
  }
  if (turns.some((t) => !t.finalReply.trim())) questionUnderstanding = 2;

  // Memory /15
  let memoryUsage = 10;
  const mem = last?.brain?.memory;
  if (scenario.expectedMemory && mem) {
    let ok = 0;
    let total = 0;
    const e = scenario.expectedMemory;
    if (e.album !== undefined) {
      total++;
      if (mem.album === e.album) ok++;
    }
    if (e.budgetTry != null) {
      total++;
      if (mem.budgetTry === e.budgetTry) ok++;
    }
    if (e.dateHintIncludes) {
      total++;
      if (mem.dateHint?.includes(e.dateHintIncludes)) ok++;
    }
    if (e.venueHintIncludes) {
      total++;
      if (
        mem.venueHint
          ?.toLocaleLowerCase("tr-TR")
          .includes(e.venueHintIncludes.toLocaleLowerCase("tr-TR"))
      )
        ok++;
    }
    if (e.rejectedTopicsIncludes?.length) {
      total++;
      if (e.rejectedTopicsIncludes.every((r) => mem.rejectedTopics.includes(r)))
        ok++;
    }
    if (e.packageLean) {
      total++;
      if (mem.packageLean === e.packageLean) ok++;
    }
    memoryUsage = total > 0 ? clamp((ok / total) * 15, 15) : 12;
  }
  if (hardFails.includes("wrong_memory") || hardFails.includes("reoffered_rejected_service")) {
    memoryUsage = 0;
  }

  // Customer type /10
  let customerTypeDetection = 6;
  if (
    scenario.targetCustomerType !== "any" &&
    last?.customerType === scenario.targetCustomerType
  ) {
    customerTypeDetection = 10;
  } else if (
    scenario.targetCustomerType !== "any" &&
    last?.customerType &&
    (last.customerTypeConfidence ?? 0) >= 40
  ) {
    customerTypeDetection = 5;
  }

  // Brevity /10 (length part deterministic)
  const brevityNaturalness = turns.every((t) => replyLenOk(t.finalReply))
    ? 8
    : turns.filter((t) => replyLenOk(t.finalReply)).length >= turns.length / 2
      ? 4
      : 1;

  // Single purpose /5
  const singlePurpose = turns.every(
    (t) => (t.finalReply.match(/\?/g) ?? []).length <= 1
  )
    ? 5
    : 2;

  // NBA /10
  let nextBestAction = 7;
  if (last?.nextBestAction && last.objective) {
    nextBestAction = 9;
    if (
      last.nextBestAction === "give_price" &&
      !hasPrice(last.finalReply) &&
      scenario.requirePriceAfterSecondAsk
    ) {
      nextBestAction = 3;
    }
  }

  // Ethical closing /5
  let ethicalClosing = 4;
  if (SPOUSE_SCRIPT.test(text)) ethicalClosing = 0;
  if (FAKE_SCARCITY.test(text)) ethicalClosing = 0;
  if (hardFails.includes("hard_promise_needs_human")) ethicalClosing = 0;

  // Value presentation partial det /10 → base 5
  const valuePresentation = /foto|klip|paket|çekim|anı|teslim/i.test(text)
    ? 6
    : 3;

  return {
    questionUnderstanding: clamp(questionUnderstanding, 10),
    memoryUsage: clamp(memoryUsage, 15),
    customerTypeDetection: clamp(customerTypeDetection, 10),
    brevityNaturalness: clamp(brevityNaturalness, 10),
    singlePurpose: clamp(singlePurpose, 5),
    nextBestAction: clamp(nextBestAction, 10),
    ethicalClosing: clamp(ethicalClosing, 5),
    valuePresentation: clamp(valuePresentation, 10),
  };
}

const softSchema = z.object({
  empathyTone: z.number().min(0).max(10),
  objectionHandling: z.number().min(0).max(15),
  naturalnessBonus: z.number().min(0).max(2),
  notes: z.array(z.string()).max(4).default([]),
});

async function scoreSoftLlm(
  scenario: SalesBenchmarkScenario,
  turns: BenchmarkTurnLog[]
): Promise<{ empathyTone: number; objectionHandling: number; notes: string[] }> {
  const transcript = turns
    .map(
      (t) =>
        `Müşteri: ${t.customerMessage}\nAsistan: ${t.finalReply}`
    )
    .join("\n\n");

  if (!isOpenAiConfigured()) {
    return scoreSoftHeuristic(transcript);
  }

  try {
    const { completion } = await createRoutedChatCompletion("extraction", {
      temperature: 0.2,
      max_tokens: 400,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Redmedia satış kalite hakemisın. JSON ver: empathyTone 0-10, objectionHandling 0-15, naturalnessBonus 0-2, notes[].",
        },
        {
          role: "user",
          content: `Senaryo: ${scenario.name} (${scenario.targetCustomerType})\n\n${transcript}`,
        },
      ],
    });
    const raw = completion.choices[0]?.message?.content?.trim() ?? "";
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start < 0 || end <= start) return scoreSoftHeuristic(transcript);
    const parsed = softSchema.safeParse(
      JSON.parse(raw.slice(start, end + 1)) as unknown
    );
    if (!parsed.success) return scoreSoftHeuristic(transcript);
    return {
      empathyTone: clamp(parsed.data.empathyTone, 10),
      objectionHandling: clamp(parsed.data.objectionHandling, 15),
      notes: parsed.data.notes,
    };
  } catch {
    return scoreSoftHeuristic(transcript);
  }
}

function scoreSoftHeuristic(transcript: string): {
  empathyTone: number;
  objectionHandling: number;
  notes: string[];
} {
  const t = transcript.toLocaleLowerCase("tr-TR");
  let empathyTone = 5;
  if (/anlıyorum|haklısınız|normal|birlikte/i.test(t)) empathyTone = 8;
  if (ABUSE_REPLY.test(t)) empathyTone = 1;
  let objectionHandling = 7;
  if (/pahalı|indirim|rakip|bütçe/.test(t) && /anlıyorum|seçenek|basic|sade/.test(t)) {
    objectionHandling = 12;
  }
  return { empathyTone, objectionHandling, notes: ["heuristic soft score"] };
}

export async function evaluateScenarioRun(
  scenario: SalesBenchmarkScenario,
  turns: BenchmarkTurnLog[],
  options?: { useLlmJudge?: boolean }
): Promise<ScenarioEvaluation> {
  const hardFails = detectHardFails(scenario, turns);
  const det = scoreDeterministic(scenario, turns, hardFails);

  const soft =
    options?.useLlmJudge === false
      ? scoreSoftHeuristic(joinedReplies(turns))
      : await scoreSoftLlm(scenario, turns);

  // brevity: merge length score with soft naturalness (cap 10)
  const brevityNaturalness = clamp(
    det.brevityNaturalness + (soft.notes.includes("heuristic soft score") ? 0 : 1),
    10
  );

  const breakdown: ScoreBreakdown = {
    questionUnderstanding: det.questionUnderstanding,
    memoryUsage: det.memoryUsage,
    customerTypeDetection: det.customerTypeDetection,
    empathyTone: clamp(soft.empathyTone, 10),
    valuePresentation: det.valuePresentation,
    objectionHandling: clamp(soft.objectionHandling, 15),
    brevityNaturalness,
    singlePurpose: det.singlePurpose,
    nextBestAction: det.nextBestAction,
    ethicalClosing: det.ethicalClosing,
  };

  const deterministicScore =
    breakdown.questionUnderstanding +
    breakdown.memoryUsage +
    breakdown.customerTypeDetection +
    breakdown.valuePresentation +
    breakdown.brevityNaturalness +
    breakdown.singlePurpose +
    breakdown.nextBestAction +
    breakdown.ethicalClosing;

  const softScore = breakdown.empathyTone + breakdown.objectionHandling;

  // Soft max 40 (10+15=25 currently; scale to keep soft ≤40 of total 100)
  // Total = det (~70 max) + soft (~25) ≈ 95; add remaining via det caps at 100
  let totalScore = deterministicScore + softScore;
  // Ensure soft portion ≤ 40% of 100
  if (softScore > 40) {
    totalScore = deterministicScore + 40;
  }
  totalScore = clamp(totalScore, 100);

  const behaviorHits: string[] = [];
  const behaviorMisses: string[] = [];
  for (const b of scenario.expectedBehaviors) {
    if (behaviorHit(b, scenario, turns)) behaviorHits.push(b);
    else behaviorMisses.push(b);
  }

  const notes: string[] = [...(soft.notes ?? [])];
  for (const f of scenario.forbiddenBehaviors) {
    if (forbiddenTriggered(f, turns)) {
      notes.push(`Forbidden: ${f}`);
      totalScore = clamp(totalScore - 5, 100);
    }
  }

  // Missed behaviors soft penalty
  totalScore = clamp(totalScore - behaviorMisses.length * 2, 100);

  if (hardFails.length > 0) {
    totalScore = Math.min(totalScore, 49);
  }

  const pass =
    hardFails.length === 0 &&
    totalScore >= 60 &&
    behaviorMisses.length <= Math.ceil(scenario.expectedBehaviors.length / 2);

  return {
    scenarioId: scenario.id,
    totalScore,
    pass,
    hardFails,
    breakdown,
    deterministicScore,
    softScore: Math.min(softScore, 40),
    notes,
    behaviorHits,
    behaviorMisses,
  };
}

export function enrichTurnReflection(
  turn: BenchmarkTurnLog,
  previousReplies: string[]
): BenchmarkTurnLog["reflection"] {
  const reply = turn.finalReply;
  const issues = turn.reflection.issues;
  const detectedOverlength = !replyLenOk(reply);
  const detectedRepetition =
    SPOUSE_SCRIPT.test(reply) ||
    previousReplies.some(
      (p) =>
        p.trim().length > 20 &&
        reply.trim().length > 20 &&
        (p === reply ||
          (p.slice(0, 40) === reply.slice(0, 40) && p.length > 30))
    );
  const detectedMemoryConflict =
    (turn.brain?.memory.album === false &&
      /albüm\s*(düşün|ister)/i.test(reply)) ||
    false;
  const detectedUnsupportedClaim =
    /yüzlerce\s*ödül|binlerce|1\.\s*sıradayız/i.test(reply) ||
    FAKE_SCARCITY.test(reply);
  const detectedWrongObjective =
    turn.nextBestAction === "ask_question" &&
    !/\?/.test(reply) &&
    turn.objective !== "wait_follow_up";

  return {
    ...turn.reflection,
    detectedRepetition,
    detectedMemoryConflict,
    detectedUnsupportedClaim,
    detectedOverlength,
    detectedWrongObjective,
    findings: [
      ...issues,
      detectedOverlength ? "overlength" : null,
      detectedRepetition ? "repetition" : null,
      detectedMemoryConflict ? "memory_conflict" : null,
      detectedUnsupportedClaim ? "unsupported_claim" : null,
      detectedWrongObjective ? "wrong_objective" : null,
    ].filter((x): x is string => Boolean(x)),
  };
}

/** Cross-run repetition phrases. */
export const TRACKED_CLOSING_PHRASES = [
  "eşinizle bugün mü",
  "hafta sonu mu",
  "hangisi size daha yakın",
  "içinize sinen",
  "tarihi adınıza kilitleyelim",
  "tarihi sizin adınıza",
] as const;

export function findRepeatedPhrases(
  results: { turns: BenchmarkTurnLog[] }[]
): { phrase: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const phrase of TRACKED_CLOSING_PHRASES) {
    let c = 0;
    for (const r of results) {
      const hit = r.turns.some((t) =>
        t.finalReply.toLocaleLowerCase("tr-TR").includes(phrase)
      );
      if (hit) c++;
    }
    if (c > 0) counts.set(phrase, c);
  }
  return [...counts.entries()]
    .map(([phrase, count]) => ({ phrase, count }))
    .sort((a, b) => b.count - a.count);
}
