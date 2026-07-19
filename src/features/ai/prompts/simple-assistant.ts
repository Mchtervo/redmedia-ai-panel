/**
 * Redmedia Instagram DM satış asistanı prompt'u.
 * Davranış kuralları: `.cursor/rules/04-ai-behavior.mdc`, `docs/AI.md`.
 * Soft satış psikolojisi → Satış Beyni bloğu; burada sert kırmızı çizgiler.
 */

export const SIMPLE_ASSISTANT_SYSTEM_PROMPT = `Sen Redmedia Instagram DM yazıcısın — satış stratejisti DEĞİLSİN.
Kod (Decision Engine) ne yazacağını zaten seçti. Senin işin: o stratejiyi kısa, doğal Türkçe cümlelere dökmek.

Redmedia; Ankara'da düğün / nişan / etkinlik video-fotoğraf.

NASIL YAZ:
- Personel DM gibi: kısa, günlük, samimi. Kurumsal / öğretmen dili YASAK.
- Decision Engine Strategy bloğuna birebir uy. Yeni strateji uydurma. Uzun düşünme / plan yazma.
- En fazla 1 soru (blok izin vermezse 0). Kelime limitine uy.
- Fiyat YALNIZCA katalog + hesaplanmış fiyat bloğundan; yoksa rakam yazma.

YASAK KALIPLAR (GPT kokusu):
"Harika", "Çok normal", "Heyecanınızı paylaşıyoruz", "Birçok çift", "Kararsız kalmanız normal",
"Anlayışla karşılıyorum", "Tabii ki yardımcı olurum", "Çok güzel bir seçim", "Endişelenmeyin".

SERT KIRMIZI ÇİZGİLER:
- Plato şart değil. Kaç kişi / ekipman / çekim saati SORMA.
- Kapora+dekont+admin yokken "kesinleşti" DEME.
- Şikâyet/iptal/indirim → ekibe yönlendir; özel fiyat uydurma.
- Sahte kota / sepet tutarı YASAK.
- Orta sohbette yeniden Merhaba YASAK.
- Admin notlarını müşteriye okuma. Ankara sabit.

PAKET: Basic 11.000 · Premium Albümlü 14.000 · Elite 21.000.
Çıktın yalnızca müşteriye gidecek mesaj metni olsun — madde/analiz yazma.`;

export const SIMPLE_ASSISTANT_TASK_TYPE = "simple_dm_reply" as const;

export const SIMPLE_ASSISTANT_FALLBACK_REPLY =
  "Mesajınızı aldık. Ekibimiz en kısa sürede size dönüş yapacaktır.";

import type { CrmMemorySnapshot } from "@/features/customer-intelligence/types";
import {
  CUSTOMER_PROFILE_STATUS_LABELS,
} from "@/features/customer-intelligence/types";
import {
  lifecyclePromptBlock,
} from "@/features/smart-sales/services/lifecycle.service";
import {
  LIFECYCLE_STAGES,
  type LifecycleStage,
} from "@/features/smart-sales/types";

export type AssistantHistoryMessage = {
  senderType: string;
  content: string;
};

export type AssistantKnowledgeSnippet = {
  category: string | null;
  title: string;
  content: string;
};

export type BuildAssistantUserPromptParams = {
  customerMessage: string;
  /** CRM Memory — ilgili müşteri profili. */
  crmProfile: CrmMemorySnapshot | null;
  recentMessages: AssistantHistoryMessage[];
  /** ISO tarih (YYYY-MM-DD); göreceli tarih netleştirme örneği için. */
  todayIsoDate?: string;
  /** Yapılandırılmış konuşma özeti (ham geçmiş değil). */
  conversationSummary?: string | null;
  /** Yalnızca onaylanmış knowledge kayıtları. */
  approvedKnowledge?: AssistantKnowledgeSnippet[];
  /** Aktif rezervasyon taslağı + müsaitlik/fiyat (DB). */
  reservationDraftBlock?: string | null;
  /** AI Sales Learning Engine: öğrenilmiş kalıplar, kişilik, hatalar, örnekler. */
  salesLearningBlock?: string | null;
  /** Aktif hizmet kataloğu (DB; fiyat burada). */
  catalogBlock?: string | null;
  /** Firma kimliği + katalog + DM satış dili (öncelikli bağlam). */
  companyBrainBlock?: string | null;
  /** Konuşmadan hesaplanmış plato/%20 fiyat (zorunlu rakamlar). */
  venueQuoteBlock?: string | null;
  /** Satış Beyni — state/memory/tek hedef (zorunlu düşünme bağlamı). */
  salesBrainBlock?: string | null;
  /** Conversation Strategist / Decision Engine — LLM öncesi zorunlu hamle. */
  strategistBlock?: string | null;
  /** Decision Engine özeti (opsiyonel; strategistBlock içinde de olabilir). */
  decisionEngineBlock?: string | null;
};

const TURKISH_MONTHS = [
  "Ocak",
  "Şubat",
  "Mart",
  "Nisan",
  "Mayıs",
  "Haziran",
  "Temmuz",
  "Ağustos",
  "Eylül",
  "Ekim",
  "Kasım",
  "Aralık",
] as const;

/** Türkiye (Europe/Istanbul) takvim günü: `YYYY-MM-DD`. */
export function getTodayIsoInIstanbul(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** `YYYY-MM-DD` üzerine gün ekler (takvim günü). */
export function addDaysToIsoDate(isoDate: string, days: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate.trim());
  if (!match) {
    return isoDate;
  }

  const date = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12)
  );
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** `2026-07-18` → `18 Temmuz 2026` */
export function formatTurkishLongDate(isoDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate.trim());
  if (!match) {
    return isoDate;
  }

  const year = match[1];
  const monthIndex = Number(match[2]) - 1;
  const day = String(Number(match[3]));
  const monthName = TURKISH_MONTHS[monthIndex];

  if (!monthName) {
    return isoDate;
  }

  return `${day} ${monthName} ${year}`;
}

/**
 * OpenAI user mesajı: Satış Beyni + CRM + özet + son mesajlar + gelen mesaj.
 */
export function buildAssistantUserPrompt({
  customerMessage,
  crmProfile,
  recentMessages,
  todayIsoDate,
  conversationSummary,
  approvedKnowledge = [],
  reservationDraftBlock,
  salesLearningBlock,
  catalogBlock,
  companyBrainBlock,
  venueQuoteBlock,
  salesBrainBlock,
  strategistBlock,
  decisionEngineBlock,
}: BuildAssistantUserPromptParams): string {
  const today = todayIsoDate?.trim() || getTodayIsoInIstanbul();
  const tomorrowIso = addDaysToIsoDate(today, 1);

  const statusLabel = crmProfile
    ? CUSTOMER_PROFILE_STATUS_LABELS[crmProfile.status]
    : "bilinmiyor";

  const profileLines = crmProfile
    ? [
        `Ad Soyad: ${crmProfile.fullName?.trim() || "bilinmiyor"}`,
        `Instagram: ${crmProfile.username ? `@${crmProfile.username}` : "bilinmiyor"}`,
        `Telefon: ${crmProfile.phone?.trim() || "yok"}${crmProfile.phoneVerified ? " (doğrulandı)" : ""}`,
        `CRM durumu: ${statusLabel}`,
        `Lead skoru: ${crmProfile.leadScore}/100`,
        `Rezervasyon ihtimali: ${crmProfile.bookingProbability ?? "—"}%`,
        `Etkinlik türü: ${crmProfile.eventType ?? "henüz yok"}`,
        `Etkinlik tarihi: ${crmProfile.eventDate ? formatTurkishLongDate(crmProfile.eventDate) : "henüz yok"}`,
        `Mekân: ${crmProfile.venue ?? "henüz yok"}`,
        `Şehir: ${crmProfile.city || "Ankara"}`,
        `İstenen hizmetler: ${crmProfile.requestedServices.length > 0 ? crmProfile.requestedServices.join(", ") : "henüz yok"}`,
        `Bütçe notu: ${crmProfile.budget ?? "yok"}`,
        `İtirazlar: ${crmProfile.objections ?? "yok"}`,
        `Son özet (hafıza): ${crmProfile.memorySummary ?? crmProfile.lastSummary ?? "yok"}`,
        `Müşteri tipi (tahmin): ${crmProfile.customerType ?? "—"} (güven ${crmProfile.customerTypeConfidence ?? "—"})`,
        `Pazarlık eğilimi: ${crmProfile.negotiationTendency ?? "—"}`,
        `Fiyat hassasiyeti: ${crmProfile.priceSensitivity ?? "—"}`,
        `Karar hızı: ${crmProfile.decisionSpeed ?? "—"}`,
        `Reddedilen hizmetler: ${crmProfile.rejectedServices.length ? crmProfile.rejectedServices.join(", ") : "—"}`,
        `Tercih paketleri: ${crmProfile.preferredPackages.length ? crmProfile.preferredPackages.join(", ") : "—"}`,
        `Bütçe aralığı: ${crmProfile.budgetRange ?? crmProfile.budget ?? "—"}`,
        `Önceden fiyat aldı: ${crmProfile.priorQuoteReceived ? "evet" : "hayır"}`,
        `Önceden rezervasyon: ${crmProfile.priorReservation ? "evet" : "hayır"}`,
        `Önceden iptal: ${crmProfile.priorCancellation ? "evet" : "hayır"}`,
        `Kampanya ilgisi: ${crmProfile.interestedCampaigns.length ? crmProfile.interestedCampaigns.join(", ") : "—"}`,
        `Bahsedilen tarihler: ${crmProfile.mentionedDates.length ? crmProfile.mentionedDates.join(", ") : "—"}`,
        `Üslup: ${crmProfile.formality ?? crmProfile.communicationTone ?? "—"} · emoji: ${crmProfile.usesEmoji == null ? "—" : crmProfile.usesEmoji ? "var" : "yok"}`,
        `Çekim tarzı tercihi: ${crmProfile.preferredStyle ?? "—"}`,
        `Sık sorular: ${crmProfile.frequentQuestions.length ? crmProfile.frequentQuestions.join("; ") : "—"}`,
        `AI notları: ${crmProfile.aiNotes ?? "—"}`,
        `Opportunity Score (tahmini): ${crmProfile.opportunityScore}/100`,
        `Etiketler: ${crmProfile.tags.length ? crmProfile.tags.join(", ") : "—"}`,
        `Bugünün tarihi: ${formatTurkishLongDate(today)} (${today})`,
        `Yarın (yalnızca referans): ${formatTurkishLongDate(tomorrowIso)} — "yarın" dendiğinde kesin kabul etme; tam tarih iste`,
      ]
    : [
        "CRM profili henüz yok — ilk temasta selamla; etkinlik varsayma; ne için yazdığını sor.",
        "Şehir: Ankara (sabit)",
        `Bugünün tarihi: ${formatTurkishLongDate(today)} (${today})`,
        `Yarın (yalnızca referans): ${formatTurkishLongDate(tomorrowIso)} — "yarın" dendiğinde kesin kabul etme; tam tarih iste`,
      ];

  const lifecycleBlock = (() => {
    const raw = crmProfile?.lifecycleStage ?? "new_customer";
    const stage = (LIFECYCLE_STAGES as readonly string[]).includes(raw)
      ? (raw as LifecycleStage)
      : "new_customer";
    return lifecyclePromptBlock(stage);
  })();

  const adminNotesBlock = crmProfile?.adminNotes?.trim()
    ? [
        "## Dahili admin notları (MÜŞTERİYE ASLA SÖYLEME / OKUMA / İMA ETME)",
        crmProfile.adminNotes.trim(),
      ].join("\n")
    : "## Dahili admin notları\n(yok)";

  const history =
    recentMessages.length === 0
      ? "(önceki mesaj yok — ilk temas)"
      : recentMessages
          .map((message) => {
            const role =
              message.senderType === "customer"
                ? "Müşteri"
                : message.senderType === "ai"
                  ? "Asistan"
                  : message.senderType === "staff"
                    ? "Personel"
                    : message.senderType;
            return `${role}: ${message.content}`;
          })
          .join("\n");

  const assistantAlreadyPitchedPrice = recentMessages.some(
    (m) =>
      m.senderType === "ai" &&
      /11\.?000|14\.?000|21\.?000|basic\s*cinema|elite\s*premium|premium\s*albüm/i.test(
        m.content
      )
  );
  const noRepeatPriceBlock = assistantAlreadyPitchedPrice
    ? [
        "## DURUM: Paket fiyatı bu konuşmada ZATEN anlatıldı",
        "11.000 / 14.000 / 21.000 paket bloğunu TEKRAR YAZMA.",
        "Kararsızsa: dış çekime özel drone hediye kapanışı (erken spoiler yapıldıysa tekrarlama).",
        "Yoksa: ekstra (sorulursa) / tarih-telefon / yumuşak kapanış.",
        "",
      ].join("\n")
    : "";

  const noRegreetBlock =
    recentMessages.length > 0
      ? [
          "## DURUM: Konuşma DEVAM EDİYOR",
          "ASLA 'Merhaba', 'Merhabalar', 'Selam' ile başlama — doğrudan soruya cevap ver.",
          "",
        ].join("\n")
      : "";

  const knowledgeBlock =
    approvedKnowledge.length === 0
      ? "(onaylı bilgi kaydı yok — fiyat/hizmet uydurma)"
      : approvedKnowledge
          .map((item, index) => {
            const category = item.category?.trim() || "genel";
            return `${index + 1}. [${category}] ${item.title}: ${item.content}`;
          })
          .join("\n");

  return [
    decisionEngineBlock?.trim() ||
      strategistBlock?.trim() ||
      "## DECISION ENGINE\n(yüklenemedi — kısa tut, 1 soru, doğal DM)",
    "",
    salesBrainBlock?.trim()
      ? [
          "## SATIŞ BEYNİ (bağlam — yeniden strateji seçme, sadece tutarlı kal)",
          salesBrainBlock.trim(),
        ].join("\n")
      : "## SATIŞ BEYNİ\n(yüklenemedi)",
    "",
    companyBrainBlock?.trim() ||
      "## Redmedia şirket beyni\n(yüklenemedi — katalog ve öğrenilmiş hafızaya bak)",
    "",
    venueQuoteBlock?.trim() ||
      "## HESAPLANMIŞ FİYAT\n(hesap yok — politika kurallarına uy)",
    "",
    "## Müşteri CRM profili (yalnızca bu müşteri — başka müşteri verisi yok)",
    profileLines.join("\n"),
    "",
    "## Yaşam döngüsü / ton",
    lifecycleBlock,
    "",
    adminNotesBlock,
    "",
    "## Rezervasyon taslağı (veritabanı; fiyat/müsaitlik burada)",
    reservationDraftBlock?.trim() || "(aktif rezervasyon taslağı yok)",
    "",
    "## Konuşma özeti (yapılandırılmış; ham geçmiş değil)",
    conversationSummary?.trim() || crmProfile?.lastSummary?.trim() || "(özet henüz yok)",
    "",
    "## Son mesajlar",
    history,
    "",
    noRegreetBlock,
    noRepeatPriceBlock,
    "## Katalog yedek özet",
    catalogBlock?.trim() || "(aktif hizmet kaydı yok)",
    "",
    "## Onaylı işletme bilgisi (SSS / politika — onaylıysa kullan)",
    knowledgeBlock,
    "",
    "## Ek öğrenilmiş kalıplar",
    salesLearningBlock?.trim() || "(şirket beynine gömülü / ek kalıp yok)",
    "",
    "## Gelen mesaj (cevabın buna doğrudan gelsin)",
    customerMessage.trim(),
  ].join("\n");
}
