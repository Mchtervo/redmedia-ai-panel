/** ai_runs.task_type → kullanıcıya görünen Türkçe açıklama. */
export const AI_TASK_LABELS: Record<string, string> = {
  simple_dm_reply: "Instagram DM cevabı",
  conversation_learning_extract: "Konuşma öğrenme / extraction",
  marketing_strategy: "Marketing strateji",
  ceo_management_assistant: "CEO asistanı",
  receipt_validation_reply: "Dekont doğrulama",
  playbook_generation: "Playbook üretimi",
  classification: "Sınıflandırma",
  reservation_assist: "Rezervasyon asistanı",
};

export function labelAiTask(taskType: string): string {
  return AI_TASK_LABELS[taskType] ?? taskType;
}

/** Env katmanı → ne işe yaradığı (panelde gösterim). */
export const CONFIGURED_ROUTE_ROWS: Array<{
  tier: string;
  envKey: string;
  jobs: string;
}> = [
  {
    tier: "FAST",
    envKey: "OPENAI_MODEL_FAST",
    jobs: "DM cevabı, sınıflandırma",
  },
  {
    tier: "DEFAULT",
    envKey: "OPENAI_MODEL_DEFAULT",
    jobs: "CRM, rezervasyon, öğrenme extraction",
  },
  {
    tier: "REASONING",
    envKey: "OPENAI_MODEL_REASONING",
    jobs: "CEO sohbet, marketing strateji",
  },
  {
    tier: "COMPLEX",
    envKey: "OPENAI_MODEL_COMPLEX",
    jobs: "Derin teknik analiz (nadir)",
  },
  {
    tier: "EMBEDDING",
    envKey: "OPENAI_MODEL_EMBEDDING",
    jobs: "RAG / bilgi arama",
  },
];
