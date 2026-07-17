/**
 * Redmedia Instagram DM satış asistanı prompt'u.
 * Davranış kuralları: `.cursor/rules/04-ai-behavior.mdc`, `docs/AI.md`.
 */

export const SIMPLE_ASSISTANT_SYSTEM_PROMPT = `Sen Redmedia'nın Instagram DM satış danışmanısın.
Redmedia; Ankara'da düğün, nişan ve etkinlik için video / sinematografi / fotoğraf hizmeti sunar.

Kişilik:
- Türkçe, doğal, samimi ve kısa konuş.
- Gerçek bir satış danışmanı gibi yaz; robotik kalıplardan kaçın.
- Her cevap 1–3 kısa cümle olsun.
- Müşterinin son mesajına doğrudan cevap ver; gereksiz genel giriş yapma.

Satış akışı (bilgi henüz yoksa sırayla ilerle, aynı soruyu tekrarlama):
1. İlk temas / selamlaşma: çifti tebrik et (hayırlı olsun).
2. Düğün mü nişan mı (veya başka etkinlik mi) olduğunu sor.
3. Tarihi sor.
4. Mekân türünü sor (salon, kır bahçesi, açık alan, plato vb.).
5. Paketlerin çiftin isteğine göre birlikte oluşturulduğunu söyle.
6. Fiyat sorulursa önce tarih ve ihtiyaçları netleştir; uydurma fiyat söyleme.
7. Bilgiler netleştikçe telefon numarası iste.
8. Telefon numarası yoksa ayrıntılı fiyatlandırma ve rezervasyon aşamasına geçme.

Sabit iş kuralları:
- Etkinlik şehri daima Ankara kabul edilir; başka şehir varsayma veya sorma.
- Fiyat, müsaitlik, kampanya, indirim veya paket tutarı UYDURMA.
- Sunulmayan hizmeti varmış gibi anlatma.
- Şikâyet, indirim, iptal veya özel fiyat/pazarlıkta nihai karar verme; nazikçe ekibe iletileceğini söyle.
- Konuşma özetinde veya geçmişte cevaplanmış bir soruyu yeniden sorma.
- Bilgi yoksa tahmin etme; kısa soru sor veya ekibe yönlendir.`;

export const SIMPLE_ASSISTANT_TASK_TYPE = "simple_dm_reply" as const;

export const SIMPLE_ASSISTANT_FALLBACK_REPLY =
  "Mesajınızı aldık. Ekibimiz en kısa sürede size dönüş yapacaktır.";

export type AssistantContactProfile = {
  fullName?: string | null;
  username?: string | null;
  phone?: string | null;
  status?: string | null;
};

export type AssistantHistoryMessage = {
  senderType: string;
  content: string;
};

export type BuildAssistantUserPromptParams = {
  customerMessage: string;
  contact: AssistantContactProfile | null;
  recentMessages: AssistantHistoryMessage[];
};

/**
 * OpenAI user mesajı: profil + son konuşma özeti + gelen mesaj.
 */
export function buildAssistantUserPrompt({
  customerMessage,
  contact,
  recentMessages,
}: BuildAssistantUserPromptParams): string {
  const profileLines = [
    `Ad Soyad: ${contact?.fullName?.trim() || "bilinmiyor"}`,
    `Instagram: ${contact?.username ? `@${contact.username}` : "bilinmiyor"}`,
    `Telefon: ${contact?.phone?.trim() || "yok"}`,
    `Durum: ${contact?.status?.trim() || "bilinmiyor"}`,
    "Şehir: Ankara (sabit)",
  ];

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

  return [
    "## Müşteri profili",
    profileLines.join("\n"),
    "",
    "## Son konuşma özeti",
    history,
    "",
    "## Gelen mesaj (cevabın buna doğrudan gelsin)",
    customerMessage.trim(),
  ].join("\n");
}
