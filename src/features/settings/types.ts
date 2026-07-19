/**
 * AI evren anahtarları (docs/47).
 * AI_MASTER kapalıysa diğer tüm bayraklar fiilen kapalı sayılır.
 */
export const AI_FLAG_KEYS = [
  "AI_MASTER",
  "AI_DM_ASSISTANT",
  "AI_LEARNING",
  "AI_BRAIN",
  "AI_FOLLOW_UP",
  "AI_RESERVATION",
  "AI_MARKETING",
  "AI_CEO",
] as const;

export type AiFlagKey = (typeof AI_FLAG_KEYS)[number];

export type AiFeatureFlags = Record<AiFlagKey, boolean>;

export const DEFAULT_AI_FEATURE_FLAGS: AiFeatureFlags = {
  AI_MASTER: true,
  AI_DM_ASSISTANT: true,
  AI_LEARNING: true,
  AI_BRAIN: true,
  AI_FOLLOW_UP: true,
  AI_RESERVATION: false,
  AI_MARKETING: true,
  AI_CEO: true,
};

export const AI_FLAG_LABELS: Record<
  AiFlagKey,
  { title: string; description: string }
> = {
  AI_MASTER: {
    title: "Tüm AI (acil durdurma)",
    description:
      "Kapalıyken hiçbir AI üretimi, öğrenme veya otomatik gönderim çalışmaz.",
  },
  AI_DM_ASSISTANT: {
    title: "DM satış asistanı",
    description:
      "Instagram/ChatPlace gelen mesajlara otomatik AI cevabı üretir.",
  },
  AI_LEARNING: {
    title: "Konuşma / satış öğrenme",
    description:
      "Saatlik öğrenme cron'u ve konuşma analizleri çalışır.",
  },
  AI_BRAIN: {
    title: "AI Brain önerileri",
    description:
      "Yeni bilgi adayı ve Brain önerisi üretimi (onay kuyruğu).",
  },
  AI_FOLLOW_UP: {
    title: "Otomatik takip (follow-up)",
    description:
      "Vadesi gelen follow-up görevlerini kuyruğa alır ve bildirir.",
  },
  AI_RESERVATION: {
    title: "Otomatik rezervasyon kaydı",
    description:
      "Yeterli bilgi + güven ile AI rezervasyon oluşturabilir (varsayılan kapalı).",
  },
  AI_MARKETING: {
    title: "Pazarlama / reklam AI",
    description:
      "Strateji ve kreatif öneri üretimi (bütçe otomatik değişmez).",
  },
  AI_CEO: {
    title: "CEO Intelligence AI",
    description: "CEO asistanı ve AI destekli yönetim yorumları.",
  },
};
