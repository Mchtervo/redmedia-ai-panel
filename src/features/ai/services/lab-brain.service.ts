/**
 * Laboratuvar "beyin paneli": cevap sonrası kural kontrolü + model öz-eleştiri.
 */
import { z } from "zod";
import {
  createRoutedChatCompletion,
  isOpenAiConfigured,
} from "@/lib/ai/openai-client";

export type LabBrainRuleCheck = {
  rule: string;
  pass: boolean;
  note: string;
};

export type LabSalesSelfEval = {
  /** Hunide müşteri aşaması */
  customerStage: string;
  /** 0–100 rezervasyon olasılığı tahmini */
  reservationProbabilityPct: number;
  /** Kaybetme riski / sebebi */
  lossRiskReason: string;
  /** Bu cevabı neden böyle yazdık */
  whyThisReply: string;
  /** Daha yüksek ihtimal alternatif (yoksa null) */
  betterAlternative: string | null;
  /** Baskı kontrolü */
  pressureNote: string;
};

export type LabSalesBrainView = {
  state: string;
  persona: string;
  emotion: string;
  decisionPct: number;
  trust: number;
  interest: number;
  scores: {
    trust: number;
    purchaseIntent: number;
    priceSensitivity: number;
    urgency: number;
  };
  customerType: string;
  customerTypeConfidence: number;
  customerTypeLocked: boolean;
  objective: string;
  nextBestAction: string;
  mainBlocker: string;
  singleGoal: string;
  style: string;
  memoryJson: string;
  reflectPass: boolean | null;
  reflectRewritten: boolean | null;
  reflectIssues: string[];
  /** Conversation Critic (AI Judge) — üretim zincirinden. */
  criticRewritten: boolean | null;
  criticFeeling: string | null;
  criticNotes: string[];
  criticOverallPass: boolean | null;
  multiJudgeAverage: number | null;
  strategistMove: string | null;
  strategistDirective: string | null;
  /** Decision Engine */
  strategyId: string | null;
  analysisPersona: string | null;
  analysisStage: string | null;
  analysisLeadTemp: number | null;
  analysisRisk: string | null;
};

export type LabBrainTrace = {
  /** Tur numarası (UI için) */
  turnLabel?: string;
  customerMessage?: string;
  replyPreview?: string;
  thinking: string;
  errors: string[];
  goodPoints: string[];
  improvements: string[];
  details: string[];
  ruleChecks: LabBrainRuleCheck[];
  salesSelfEval: LabSalesSelfEval | null;
  /** Satış Beyni snapshot (state machine + memory). */
  salesBrain: LabSalesBrainView | null;
  generatedAt: string;
};

const critiqueSchema = z.object({
  thinking: z.string().max(800).default(""),
  errors: z.array(z.string().max(300)).max(8).default([]),
  goodPoints: z.array(z.string().max(300)).max(8).default([]),
  improvements: z.array(z.string().max(300)).max(8).default([]),
  details: z.array(z.string().max(300)).max(10).default([]),
  customerStage: z.string().max(120).default(""),
  reservationProbabilityPct: z.number().min(0).max(100).default(0),
  lossRiskReason: z.string().max(300).default(""),
  whyThisReply: z.string().max(400).default(""),
  betterAlternative: z.string().max(500).nullable().default(null),
  pressureNote: z.string().max(200).default(""),
});

function extractJsonObject(raw: string): unknown {
  const trimmed = raw.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start < 0 || end <= start) {
    throw new Error("JSON yok");
  }
  return JSON.parse(trimmed.slice(start, end + 1)) as unknown;
}

/** Deterministik kırmızı çizgi kontrolleri (LLM beklemeden). */
export function runDeterministicLabChecks(
  customerMessage: string,
  historyText: string,
  reply: string
): LabBrainRuleCheck[] {
  const r = reply.toLocaleLowerCase("tr-TR");
  const full = `${historyText}\n${customerMessage}\n${reply}`.toLocaleLowerCase(
    "tr-TR"
  );
  const checks: LabBrainRuleCheck[] = [];

  const saysSepet = /sepet\s*tutarı|sepet\s*tutari/.test(r);
  checks.push({
    rule: "Sepet tutarı deme",
    pass: !saysSepet,
    note: saysSepet
      ? "Cevapta 'sepet tutarı' geçiyor — yasak."
      : "Sepet tutarı ifadesi yok.",
  });

  // Orta sohbette tekrar merhaba / selam
  const hasPriorTurns =
    historyText.trim().length > 0 &&
    (/(müşteri|customer|asistan|ai)\s*:/i.test(historyText) ||
      historyText.trim().length > 40);
  const replyStart = reply.trim().slice(0, 80).toLocaleLowerCase("tr-TR");
  const reGreets =
    /^(merhaba|merhabalar|selam|selamlar|iyi\s*günler|iyi\s*akşamlar|günaydın)/.test(
      replyStart
    ) ||
    /^(merhaba|merhabalar|selam)[\s!,.]/.test(replyStart);
  if (hasPriorTurns && reGreets) {
    checks.push({
      rule: "Orta sohbette tekrar merhaba",
      pass: false,
      note: "Konuşma devam ederken yeniden merhaba/selam demiş — yasak.",
    });
  }

  const inventsEntrance =
    /giriş\s*(ücreti|ucreti)?\s*\d[\d.\s]*0{2,3}/i.test(reply) &&
    !/bize ait|ödemiyorsunuz|odemiyorsunuz/.test(r);
  checks.push({
    rule: "Anlaşmasız plato giriş tutarı uydurma",
    pass: !inventsEntrance,
    note: inventsEntrance
      ? "Sayısal plato giriş ücreti uydurulmuş olabilir."
      : "Uydurma giriş ücreti tespit edilmedi.",
  });

  const reveals3000 =
    /3\.?000/.test(reply) &&
    /ekled|yansı|yansi|giriş.*paket|paket.*giriş/i.test(reply);
  checks.push({
    rule: "Gizli +3.000'i söylememe",
    pass: !reveals3000,
    note: reveals3000
      ? "3.000 TL ekleme/yansıtma müşteriye sızmış olabilir."
      : "Gizli 3.000 ifşa edilmemiş görünüyor.",
  });

  const mentionsKapora =
    /kapora/.test(r) ||
    /(?<!\d)(?:1\.000|1000)\s*tl/.test(r) ||
    (/14\.?000/.test(reply) && /dahil/.test(r));
  const priceTalk = /\d[\d.]*\s*tl|fiyat|ücret|ucret/.test(r);
  checks.push({
    rule: "Fiyat konuşurken kapora (paket içinde)",
    pass: !priceTalk || mentionsKapora,
    note: priceTalk && !mentionsKapora
      ? "Fiyat var ama kapora / 'kapora dahil' geçmiyor."
      : "Kapora kuralı OK veya fiyat yok.",
  });

  const partnerPlato = /başka\s*plato|anka\s*plato|no\s*25|no25/.test(full);
  const entranceOurs = /giriş\s*ücreti\s*bize\s*ait|ödemiyorsunuz|odemiyorsunuz/.test(
    r
  );
  if (partnerPlato && /plato/.test(r)) {
    checks.push({
      rule: "Anlaşmalı platoda giriş bizden",
      pass: entranceOurs,
      note: entranceOurs
        ? "Giriş bize ait mesajı var."
        : "Anlaşmalı plato konuşuluyor; giriş bizden denmemiş olabilir.",
    });
  }

  const onlyOneServiceAsk =
    /sadece\s*(foto|klip)|yalnız\s*(foto|klip)/i.test(customerMessage) ||
    (/fotoğraf|fotograf/.test(customerMessage.toLocaleLowerCase("tr-TR")) &&
      !/klip|video|albüm|album|drone/.test(
        customerMessage.toLocaleLowerCase("tr-TR")
      ));
  const applies20 = /%20|yüzde\s*20|yuzde\s*20|erken rezervasyon/.test(r);
  if (onlyOneServiceAsk && applies20) {
    checks.push({
      rule: "Tek hizmette %20 yok",
      pass: false,
      note: "Tek hizmet gibi duruyor ama %20/erken rezervasyon uygulanmış.",
    });
  }

  const pitchesDroneGiftEarly =
    /drone/.test(r) &&
    /hediye/.test(r) &&
    !/(bakarız|bakariz|düşün|kararsız|kararsiz|pahalı|pahali)/i.test(
      `${customerMessage} ${historyText}`.toLocaleLowerCase("tr-TR")
    );
  if (pitchesDroneGiftEarly) {
    checks.push({
      rule: "Drone hediye erken spoiler yok",
      pass: false,
      note: "Drone hediye erken verilmiş; yalnız kararsızlıkta ve dış çekimde olmalı.",
    });
  }

  const droneGiftOnNonOutdoor =
    /drone/.test(r) &&
    /hediye/.test(r) &&
    /gelin\s*alma|kuaför|kuafor/.test(r) &&
    !/dış\s*çekim|dis\s*cekim|plato|yeşillik|yesillik/.test(r);
  if (droneGiftOnNonOutdoor) {
    checks.push({
      rule: "Drone hediye yalnız dış çekim",
      pass: false,
      note: "Drone hediye gelin alma/kuaför bağlamında — yasak.",
    });
  }

  // Eski liste: 12/15k veya yalnız 10k. 14.000 = Premium Albümlü (geçerli).
  const hasCurrentPackage = /11\.?000|14\.?000|21\.?000/.test(reply);
  const hasOldPackage =
    /(?<![.\d])(?:12|15)\.?000\b/.test(reply) ||
    (/(?<![.\d])10\.?000\b/.test(reply) && !hasCurrentPackage);
  if (hasOldPackage && /paket|toplam|oluyor|fiyat|tl/.test(r) && !hasCurrentPackage) {
    checks.push({
      rule: "Basic 11.000 / Premium 14.000 / Elite 21.000",
      pass: false,
      note: "Eski paket fiyatı; 11.000 / 14.000 / 21.000 olmalı.",
    });
  }

  const reasksKnownWedding =
    /\bdüğün\b|\bdugun\b/.test(historyText.toLocaleLowerCase("tr-TR")) &&
    !/alaka|yanlış|yanlis/.test(historyText.toLocaleLowerCase("tr-TR")) &&
    /(düğün\s*mü|dugun\s*mu|nişan\s*mı|nisan\s*mi)/i.test(reply);
  if (reasksKnownWedding) {
    checks.push({
      rule: "Bilinen etkinliği tekrar sorma",
      pass: false,
      note: "Geçmişte düğün var ama cevap tekrar etkinlik soruyor.",
    });
  }

  const customerComplainsAssumption =
    /ne\s*alaka|nerden\s*çık|nereden\s*çık|kız\s*istemene\s*alaka/i.test(
      customerMessage
    );
  const stillPushesEventMenu =
    /(kız\s*isteme|düğün\s*mü|nişan\s*mı).{0,40}(mi|mü|mı|mu)/i.test(reply);
  if (customerComplainsAssumption && stillPushesEventMenu) {
    checks.push({
      rule: "Erken varsayım sonrası menü dayatma",
      pass: false,
      note: "Müşteri varsayıma kızmış; etkinlik menüsü tekrar dayatılmış.",
    });
  }

  const customerOutdoorOnly =
    /dış\s*çekim|dis\s*cekim/.test(
      `${historyText}\n${customerMessage}`.toLocaleLowerCase("tr-TR")
    ) &&
    !/\bdüğün\b|\bdugun\b|\bnişan\b|kız\s*isteme|albüm|album|gelin\s*alma/.test(
      customerMessage.toLocaleLowerCase("tr-TR") +
        " " +
        historyText
          .split("\n")
          .filter((l) => /müşteri|customer/i.test(l))
          .join(" ")
          .toLocaleLowerCase("tr-TR")
    );
  const assumesWeddingOrGelin =
    /\bdüğün\b|\bdugun\b|gelin\s*alma|hayırlı\s*olsun/.test(r);
  if (customerOutdoorOnly && assumesWeddingOrGelin) {
    checks.push({
      rule: "Dış çekimde düğün/gelin varsayma",
      pass: false,
      note: "Müşteri dış çekim odaklı; cevap düğün veya gelin alma varsaymış.",
    });
  }

  const cust = customerMessage.toLocaleLowerCase("tr-TR");
  const generalPriceAsk =
    /paket|fiyat|tarif|ne\s*kadar/.test(cust) &&
    !/dış\s*çekim|dis\s*cekim|\bdüğün\b|\bdugun\b|\bnişan\b|kız\s*isteme|plato|albüm|album|gelin/.test(
      cust
    );
  const assumesOutdoor =
    /dış\s*çekim\s*için|dis\s*cekim\s*icin|dış\s*çekimde|dis\s*cekimde/.test(r);
  if (generalPriceAsk && assumesOutdoor) {
    checks.push({
      rule: "Genel soruda dış çekim varsayma",
      pass: false,
      note: "Müşteri genel paket/fiyat sormuş; cevap 'dış çekim için' diye varsaymış.",
    });
  }

  const escalatesPackageBargain =
    /ekibe\s*ileteyim|ekibe\s*iletelim|özel\s*fiyat\s*taleb|ozel\s*fiyat\s*taleb/.test(
      r
    ) &&
    /(10\.?000|indirim|düşür|dusur|pazarlık|pazarlik)/.test(
      `${cust}\n${r}`
    );
  if (escalatesPackageBargain) {
    checks.push({
      rule: "Paket pazarlığını ekibe taşıma",
      pass: false,
      note: "Paket fiyatında 'özel fiyatı ekibe ileteyim' demiş — yasak; 11k/21k'da kal + drone kapanış.",
    });
  }

  const saysPlatoMandatory =
    /plato\s*(şart|zorunlu|mecbur)|platosuz\s*olmaz|plato\s*olmadan\s*olmaz|plato\s*lazım/.test(
      r
    ) && !/plato\s*şart\s*değil|plato\s*şart\s*degil|plato\s*zorunlu\s*değil/.test(r);
  if (saysPlatoMandatory) {
    checks.push({
      rule: "Plato şart değil",
      pass: false,
      note: "Plato şart/zorunlu demiş — doğru: plato şart değil; bahçe/yeşillik/ev olur.",
    });
  }

  const isFirstTurn =
    !historyText.trim() ||
    !/(^|\n)\s*(asistan|ai)\s*:/i.test(historyText);
  const dumpsPriceFirstTurn =
    isFirstTurn && /11\.?000|14\.?000|21\.?000/.test(reply);
  if (dumpsPriceFirstTurn) {
    checks.push({
      rule: "Önce samimiyet sonra fiyat",
      pass: false,
      note: "İlk cevapta 11.000/14.000/21.000 yazılmış — önce ilgi + paket içeriği sorulmalı.",
    });
  }

  const priceIdx = reply.search(/11\.?000|14\.?000|21\.?000/);
  const detailIdx = reply.search(
    /poz\s*sınır|tüm\s*kare|retouch|albüm\s*seçen|2\s*saat|omuz|kuaför|kuafor|sinematik/i
  );
  if (
    !isFirstTurn &&
    priceIdx >= 0 &&
    detailIdx >= 0 &&
    priceIdx < detailIdx
  ) {
    checks.push({
      rule: "Fiyat en sonda",
      pass: false,
      note: "Detay/ekstra varken fiyat öne alınmış — önce içerik+fırsat, rakam sonda.",
    });
  }

  const customerAskedDrone = /drone|dron/.test(
    `${historyText}\n${customerMessage}`.toLocaleLowerCase("tr-TR")
  );
  const pushesDroneUnasked =
    !customerAskedDrone &&
    !/bakarız|düşünelim|pahalı|kararsız|başka\s*yere/.test(
      `${historyText}\n${customerMessage}`.toLocaleLowerCase("tr-TR")
    ) &&
    /drone|dron/.test(r) &&
    /(4\.?000|hediye|ekleyebilir|öner|ister\s*seniz)/.test(r);
  if (pushesDroneUnasked) {
    checks.push({
      rule: "Drone istemeden önerme",
      pass: false,
      note: "Müşteri drone demeden önerilmiş — drone yalnız isterlerse (ücretli) veya kararsız kapanışta.",
    });
  }

  const questionMarks = (reply.match(/\?/g) ?? []).length;
  const miQuestions = (
    reply.match(/\b(mi|mı|mu|mü)\b/gi) ?? []
  ).length;
  if (questionMarks >= 3 || miQuestions >= 3) {
    checks.push({
      rule: "Üst üste soru",
      pass: false,
      note: "Bir mesajda çok fazla soru — en fazla 1 soru; önce tepki/değer.",
    });
  }

  const softClose =
    /bakarız|bakariz|teşekkür|tesekkur|sonra\s*yazar|düşünelim|dusunelim/.test(
      cust
    );
  const weakClose =
    softClose &&
    /(rica\s*ederim|görüşürüz|gorusuruz|iyi\s*günler|iyi\s*gunler|kolay\s*gelsin)/i.test(
      reply
    ) &&
    !/(örnek|ornek|instagram|yazayım|yazayim|not\s*al|ön\s*kontrol|on\s*kontrol|içinize|icinize|tarihi\s*(birlikte\s*)?(ön\s*)?kontrol|karar\s*şart|karar\s*sart|dönüş|donus|takip|sin\s*en\s*seçenek|sin\s*en\s*secenek)/i.test(
      reply
    );
  if (weakClose) {
    checks.push({
      rule: "Zayıf kapanış",
      pass: false,
      note: "'bakarız/teşekkür' sonrası düz veda — soft CTA (varyasyonlu) olmalı.",
    });
  }

  const spouseScriptClose =
    /eşinizle\s+(bugün|bugun|hafta\s*sonu)|bugün\s*mü\s*hafta\s*sonu|bugun\s*mu\s*hafta\s*sonu|hafta\s*sonu\s*mu\??\s*$/i.test(
      reply
    );
  if (spouseScriptClose) {
    checks.push({
      rule: "Tekrarlayan kapanış scripti",
      pass: false,
      note: "'Eşinizle bugün mü / hafta sonu mu?' scripti yasak — her kapanış yeni olmalı.",
    });
  }

  const lineCount = reply
    .split(/\n/)
    .map((l) => l.trim())
    .filter(Boolean).length;
  const longParagraph =
    reply.replace(/\s+/g, " ").trim().length > 280 || lineCount > 5;
  if (longParagraph) {
    checks.push({
      rule: "DM mesaj uzunluğu",
      pass: false,
      note: "Instagram DM için fazla uzun — hedef ~3 satır / kısa paragraf.",
    });
  }

  const factHits = [
    /22\s*(retouch|profesyonel|düzenlen)/i.test(reply),
    /albüm|album/i.test(reply),
    /(3\s*gün|3\s*gun|foto.*3)/i.test(reply),
    /(7\s*gün|7\s*gun|klip.*7)/i.test(reply),
    /drone/i.test(reply),
    /yedek\s*ekipman/i.test(reply),
    /omuz/i.test(reply),
    /kuaför|kuafor/i.test(reply),
  ].filter(Boolean).length;
  if (factHits >= 4) {
    checks.push({
      rule: "Cognitive load / bilgi dump",
      pass: false,
      note: "Bir mesajda çok fazla bilgi — tek amaç + tek bilgi kuralı.",
    });
  }

  const inventsSocialProof =
    /(yüzlerce|binlerce|en\s*çok\s*tercih|\d+\s*ödül|birinci\s*seçild|1\.\s*seçild)/i.test(
      reply
    ) ||
    (/(düğün\.com|dugun\.com)/i.test(reply) &&
      !/(3\.|üçüncü|ucuncu)/i.test(reply));
  if (inventsSocialProof) {
    checks.push({
      rule: "Uydurma sosyal kanıt",
      pass: false,
      note: "Onaysız abartı (yüzlerce/1. sıra vb.) — doğrulanmış: 7 yıl, Düğün.com Ankara 3., IG.",
    });
  }

  return checks;
}

/** Geriye dönük test / oturum birikimi için — LLM hata satırlarını ele. */
export function filterSpuriousCritiqueItems(
  items: string[],
  ruleChecks: LabBrainRuleCheck[]
): string[] {
  const anyFail = ruleChecks.some((c) => !c.pass);
  if (!anyFail) {
    return items.filter((item) => !/hata:|iyileştir:|iyilestir:/i.test(item));
  }
  return items.filter((item) => {
    const t = item.toLocaleLowerCase("tr-TR");
    if (/yardımcı olabilirim/.test(t)) return false;
    if (
      /kapora/.test(t) &&
      /(gereksiz|tekrar|yok|eksik|verilmedi|verilmemiş|verilmemis|geçmiyor)/.test(t)
    ) {
      const k = ruleChecks.find((c) => c.rule.includes("kapora"));
      if (!k || k.pass) return false;
    }
    if (/sepet/.test(t)) {
      const s = ruleChecks.find((c) => c.rule.includes("Sepet"));
      if (!s || s.pass) return false;
    }
    if (/eski paket|basic 11/.test(t)) {
      const l = ruleChecks.find((c) => c.rule.includes("11.000"));
      if (!l || l.pass) return false;
    }
    return true;
  });
}

const CRITIQUE_SYSTEM = `Sen Redmedia lab satış gözlemcisisin.
errors ve improvements DİZİLERİNİ BOŞ BIRAK (hataları kural motoru yazar).
Her tur sonrası satış öz-değerlendirmesi ZORUNLU.

JSON alanları:
{
  "thinking":"2-3 cümle iç muhakeme",
  "errors":[],
  "goodPoints":["DOĞRU: …"],
  "improvements":[],
  "details":["DETAY: …"],
  "customerStage":"Merak|Güven|İhtiyaç|Değer|Fiyat|İtiraz|Taahhüt|Kapora|Erteleme|Kayıp riski",
  "reservationProbabilityPct":0-100,
  "lossRiskReason":"kaybetme sebebi veya düşük risk notu",
  "whyThisReply":"bu cevap neden böyle",
  "betterAlternative":"daha yüksek rezervasyon ihtimali alternatif veya null",
  "pressureNote":"baskı yok / hafif / fazla baskı — rezervasyon > sıkıştırma"
}
İlke: Müşteri hazır değilse baskı kurmak rezervasyonu düşürür; güven+takip daha iyi olabilir.
Kapora söylemek iyidir. 11.000 / 14.000 (Premium Albümlü) / 21.000 kampanyalı fiyattır.
Kısa DM, tek amaç, aynı kapanış scriptini tekrarlama.`;

/**
 * Cevap sonrası beyin izi: kural check + LLM öz-eleştiri + satış öz-değerlendirme.
 */
export async function buildLabBrainTrace(params: {
  customerMessage: string;
  history: { senderType: string; content: string }[];
  reply: string;
  salesBrain?: LabSalesBrainView | null;
}): Promise<LabBrainTrace> {
  const historyText = params.history
    .map((m) => `${m.senderType}: ${m.content}`)
    .join("\n");

  const ruleChecks = runDeterministicLabChecks(
    params.customerMessage,
    historyText,
    params.reply
  );

  const failedRules = ruleChecks.filter((c) => !c.pass);
  let thinking =
    "Kural motoru cevabı taradı; model öz-eleştirisi bekleniyor…";
  let errors = failedRules.map((c) => `HATA: ${c.rule} — ${c.note}`);
  let goodPoints = ruleChecks
    .filter((c) => c.pass)
    .map((c) => `DOĞRU: ${c.rule}`);
  let improvements: string[] = failedRules.map(
    (c) => `İYİLEŞTİR: ${c.rule} kuralına uy — ${c.note}`
  );
  let details = ruleChecks.map(
    (c) => `DETAY: ${c.pass ? "geçti" : "kaldı"} · ${c.rule}: ${c.note}`
  );
  let salesSelfEval: LabSalesSelfEval | null = null;

  if (isOpenAiConfigured()) {
    try {
      const { completion } = await createRoutedChatCompletion("extraction", {
        temperature: 0.2,
        max_tokens: 1400,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: CRITIQUE_SYSTEM },
          {
            role: "user",
            content: [
              "## Geçmiş",
              historyText || "(yok)",
              "",
              "## Son müşteri",
              params.customerMessage,
              "",
              "## Asistan cevabı",
              params.reply,
              "",
              "## Deterministik uyarılar",
              failedRules.map((c) => `- ${c.note}`).join("\n") || "(yok)",
              "",
              "Satış öz-değerlendirmesini (aşama, %, kayıp riski, neden, alternatif, baskı) doldur.",
            ].join("\n"),
          },
        ],
      });

      const raw = completion.choices[0]?.message?.content?.trim() ?? "";
      if (raw) {
        const parsed = critiqueSchema.safeParse(extractJsonObject(raw));
        if (parsed.success) {
          thinking = parsed.data.thinking || thinking;
          goodPoints = [
            ...new Set([
              ...goodPoints,
              ...parsed.data.goodPoints.filter(Boolean),
            ]),
          ].slice(0, 12);
          details = [
            ...new Set([
              ...details,
              ...parsed.data.details.filter(Boolean).slice(0, 6),
            ]),
          ].slice(0, 14);
          if (failedRules.length === 0) {
            improvements = [];
          }
          salesSelfEval = {
            customerStage:
              parsed.data.customerStage.trim() || "Belirsiz",
            reservationProbabilityPct: Math.round(
              parsed.data.reservationProbabilityPct
            ),
            lossRiskReason:
              parsed.data.lossRiskReason.trim() || "Belirgin risk yok",
            whyThisReply:
              parsed.data.whyThisReply.trim() || thinking.slice(0, 200),
            betterAlternative: parsed.data.betterAlternative?.trim() || null,
            pressureNote:
              parsed.data.pressureNote.trim() || "Değerlendirilmedi",
          };
        }
      }
    } catch {
      details.push("DETAY: Model öz-eleştirisi alınamadı; yalnızca kural motoru.");
    }
  }

  return {
    customerMessage: params.customerMessage.slice(0, 200),
    replyPreview: params.reply.slice(0, 220),
    thinking,
    errors,
    goodPoints,
    improvements,
    details,
    ruleChecks,
    salesSelfEval,
    salesBrain: params.salesBrain ?? null,
    generatedAt: new Date().toISOString(),
  };
}

/** Ekran görüntüsü / yapıştırma için düz metin özet. */
export function formatLabBrainTraceForCopy(
  traces: LabBrainTrace[],
  latest: LabBrainTrace | null
): string {
  const lines: string[] = ["=== REDMEDIA LAB BEYİN RAPORU ===", ""];
  const focus = latest ?? traces[traces.length - 1];
  if (!focus) return lines.join("\n") + "\n(Henüz analiz yok)\n";

  lines.push(`Zaman: ${focus.generatedAt}`);
  if (focus.customerMessage) lines.push(`Müşteri: ${focus.customerMessage}`);
  if (focus.replyPreview) lines.push(`Asistan: ${focus.replyPreview}`);
  lines.push("");
  if (focus.salesBrain) {
    const b = focus.salesBrain;
    lines.push("--- SATIŞ BEYNİ ---");
    lines.push(
      `State: ${b.state} · Tip: ${b.customerType}${b.customerTypeLocked ? " (kilitli)" : ""} · Emotion: ${b.emotion} · Style: ${b.style}`
    );
    lines.push(
      `Skorlar G/N/F/A: ${b.scores.trust}/${b.scores.purchaseIntent}/${b.scores.priceSensitivity}/${b.scores.urgency}`
    );
    lines.push(
      `Objective: ${b.objective} · NBA: ${b.nextBestAction} · Engel: ${b.mainBlocker}`
    );
    lines.push(`Tek hedef: ${b.singleGoal}`);
    lines.push(`Memory: ${b.memoryJson}`);
    if (b.reflectPass != null) {
      lines.push(
        `Reflection: ${b.reflectPass ? "geçti" : "fail"}${b.reflectRewritten ? " · rewrite yapıldı" : ""}`
      );
      if (b.reflectIssues.length) {
        b.reflectIssues.forEach((i) => lines.push(`  - ${i}`));
      }
    }
    if (b.strategyId) {
      lines.push(
        `Decision Engine: ${b.strategyId} · Persona ${b.analysisPersona ?? "—"} · Stage ${b.analysisStage ?? "—"} · Sıcaklık ${b.analysisLeadTemp ?? "—"} · Risk ${b.analysisRisk ?? "—"}`
      );
    } else if (b.strategistMove) {
      lines.push(`Strategist: ${b.strategistMove} — ${b.strategistDirective ?? ""}`);
    }
    if (b.criticOverallPass != null || b.criticRewritten != null) {
      lines.push(
        `AI Judge: ${b.criticOverallPass == null ? "—" : b.criticOverallPass ? "geçti" : "zayıf"}${b.criticRewritten ? " · rewrite" : ""}${b.multiJudgeAverage != null ? ` · ort ${b.multiJudgeAverage}` : ""}`
      );
      if (b.criticFeeling) lines.push(`  His: ${b.criticFeeling}`);
      b.criticNotes.forEach((n) => lines.push(`  - ${n}`));
    }
    lines.push("");
  }
  lines.push("--- NE DÜŞÜNDÜ ---");
  lines.push(focus.thinking || "(yok)");
  lines.push("");
  if (focus.salesSelfEval) {
    const e = focus.salesSelfEval;
    lines.push("--- SATIŞ ÖZ-DEĞERLENDİRME ---");
    lines.push(`Aşama: ${e.customerStage}`);
    lines.push(`Rezervasyon olasılığı: %${e.reservationProbabilityPct}`);
    lines.push(`Kaybetme riski: ${e.lossRiskReason}`);
    lines.push(`Neden bu cevap: ${e.whyThisReply}`);
    lines.push(
      `Daha iyi alternatif: ${e.betterAlternative ?? "(yok / mevcut iyi)"}`
    );
    lines.push(`Baskı: ${e.pressureNote}`);
    lines.push("");
  }
  lines.push(`--- HATALAR (${focus.errors.length}) ---`);
  if (focus.errors.length === 0) lines.push("(yok)");
  else focus.errors.forEach((e, i) => lines.push(`${i + 1}. ${e}`));
  lines.push("");
  lines.push(`--- DOĞRULAR (${focus.goodPoints.length}) ---`);
  if (focus.goodPoints.length === 0) lines.push("(yok)");
  else focus.goodPoints.forEach((e, i) => lines.push(`${i + 1}. ${e}`));
  lines.push("");
  lines.push(`--- İYİLEŞTİRMELER (${focus.improvements.length}) ---`);
  if (focus.improvements.length === 0) lines.push("(yok)");
  else focus.improvements.forEach((e, i) => lines.push(`${i + 1}. ${e}`));
  lines.push("");
  lines.push(`--- DETAYLAR (${focus.details.length}) ---`);
  if (focus.details.length === 0) lines.push("(yok)");
  else focus.details.forEach((e, i) => lines.push(`${i + 1}. ${e}`));
  lines.push("");
  lines.push("--- KURAL MOTORU ---");
  focus.ruleChecks.forEach((c) => {
    lines.push(`${c.pass ? "GEÇTİ" : "HATA"} | ${c.rule} | ${c.note}`);
  });

  if (traces.length > 1) {
    lines.push("");
    lines.push(`=== OTURUM ÖZETİ (${traces.length} tur) ===`);
    const allErrors = [...new Set(traces.flatMap((t) => t.errors))];
    const allGoods = [...new Set(traces.flatMap((t) => t.goodPoints))];
    const allImp = [...new Set(traces.flatMap((t) => t.improvements))];
    lines.push(`Toplam benzersiz hata: ${allErrors.length}`);
    allErrors.forEach((e, i) => lines.push(`H${i + 1}. ${e}`));
    lines.push(`Toplam benzersiz doğru: ${allGoods.length}`);
    allGoods.forEach((e, i) => lines.push(`D${i + 1}. ${e}`));
    lines.push(`Toplam benzersiz iyileştirme: ${allImp.length}`);
    allImp.forEach((e, i) => lines.push(`I${i + 1}. ${e}`));
  }

  return lines.join("\n");
}
