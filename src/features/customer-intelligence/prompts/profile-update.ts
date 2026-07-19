export const PROFILE_UPDATE_SYSTEM_PROMPT = `Sen Redmedia CRM bellek asistanısın.
Müşteri mesajından yalnızca net bilgi çıkar; JSON döndür.
Uydurma. Göreceli tarih (yarın, haftaya) için eventDate null bırak.
eventDate varsa YYYY-MM-DD.
status: new | interested | hot | booked | lost
Şehir varsayılan Ankara; müşteri başka şehir demedikçe city güncelleme.
requestedServices kısa Türkçe etiketler (drone, albüm, sinematik klip...).
Fiyat rakamını budget alanına serbest metin olarak yazabilirsin; doğrulanmış fiyat sanma.`;

export function buildProfileUpdateUserPrompt(params: {
  customerMessage: string;
  currentProfileJson: string;
  todayIsoDate: string;
}): string {
  return [
    `Bugün: ${params.todayIsoDate}`,
    "",
    "## Mevcut CRM profili",
    params.currentProfileJson,
    "",
    "## Yeni müşteri mesajı",
    params.customerMessage,
    "",
    "Yalnızca değişen alanları içeren JSON döndür (profileDeltaSchema).",
  ].join("\n");
}
