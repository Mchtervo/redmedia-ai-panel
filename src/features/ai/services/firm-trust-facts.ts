/**
 * Doğrulanabilir güven unsurları — işletmeden onaylı (2026-07).
 * Burada olmayan sayı/ödül/sıralama UYDURMA.
 *
 * Kaynaklar: işletme beyanı + https://redmediadugun.com/paket-olustur
 */

export type FirmTrustFacts = {
  experienceLine: string | null;
  portfolioUrl: string | null;
  deliveryLine: string | null;
  backupGearLine: string | null;
  contractProcessLine: string | null;
  referencesLine: string | null;
  /** Klip süreleri — doğrulanmış */
  clipDurationLine: string | null;
};

/** İşletmeden gelen doğrulanmış sabitler. */
export const FIRM_TRUST_FACTS: FirmTrustFacts = {
  experienceLine: "7 yıldır Ankara'da düğün fotoğraf ve sinematik video üretiyoruz.",
  portfolioUrl:
    "Instagram @redmedia.co · https://www.instagram.com/redmedia.co/ · Paket: https://redmediadugun.com/paket-olustur",
  deliveryLine:
    "Fotoğrafların doğal halleri 3 gün içinde; montajlı klip 7 gün içinde; albüm teslimi yaklaşık 1 ay içinde.",
  backupGearLine: "Çekimlerde yedek ekipman bulunduruyoruz.",
  contractProcessLine:
    "Ayrı yazılı sözleşme yapmıyoruz; kapora dekontu yeterli. Akış: IBAN'a kapora → dekont ekran görüntüsü → inceleme → admin onayı ile tarih kesinleşir (AI kendi başına kesinleştirmez).",
  referencesLine:
    "Geçen sezon Düğün.com'da Ankara'da 3. seçildik. Çiftlerden sık gelen geri bildirim: beklediklerinden daha doğal ve eğlenceli, verimli çekim. Tekil müşteri yorumu uydurma; IG/galeri örnek paylaş.",
  clipDurationLine:
    "Klip süreleri (doğrulanmış): dış çekim 1–2 dk · gelin alma 1–2 dk · salon giriş/ilk dans 1–2 dk · kuaför/hazırlık 1–2 dk · omuz kamera: etkinlik süresi boyunca (baştan sona).",
};

export function composeFirmTrustFactsBlock(
  facts: FirmTrustFacts = FIRM_TRUST_FACTS
): string {
  const lines: string[] = [
    "## Güven unsurları (doğrulanmış — bunları uygun yerde kullan; dışına çıkma)",
  ];

  if (facts.experienceLine) lines.push(`- Deneyim: ${facts.experienceLine}`);
  if (facts.portfolioUrl) lines.push(`- Portföy: ${facts.portfolioUrl}`);
  if (facts.deliveryLine) lines.push(`- Teslim: ${facts.deliveryLine}`);
  if (facts.backupGearLine) lines.push(`- Ekipman: ${facts.backupGearLine}`);
  if (facts.contractProcessLine) lines.push(`- Süreç: ${facts.contractProcessLine}`);
  if (facts.referencesLine) lines.push(`- Referans: ${facts.referencesLine}`);
  if (facts.clipDurationLine) lines.push(`- Klip: ${facts.clipDurationLine}`);

  lines.push(
    "- Anlaşmalı plato (Başka/Anka/No25): giriş ücreti bize ait.",
    "- YASAK: yüzlerce/binlerce çift, düğün.com 1., uydurma yorum, bu listede olmayan ödül."
  );

  return lines.join("\n");
}
