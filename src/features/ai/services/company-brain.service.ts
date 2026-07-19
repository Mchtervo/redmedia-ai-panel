import { composeSalesPlaybookBlock } from "@/features/ai/services/sales-playbook.service";
import { composeFirmTrustFactsBlock } from "@/features/ai/services/firm-trust-facts";

const FIRM_IDENTITY = `Redmedia (Ankara): düğün, nişan, kız isteme — sinematik video + fotoğraf.

PAKETLER (fiyatı sonda; Satış Beyni tek hedefe göre anlat):
- Basic Cinema = 11.000 TL (plato dahil; kapora 1.000 ile tarih kilit) — foto + tüm kareler + sinematik klip.
- Premium Albümlü = 14.000 TL (kapora + plato giriş DAHİL) — +1 büyük +2 aile albümü +22 retouch +40 albüm seçeneği.
- Elite Premium = 21.000 TL (plato+kapora dahil) — Premium + gelin alma + salon/ilk dans.

PLATO ŞART DEĞİL:
- Bahçe / yeşillik / park / ev de olur; Basic aynı 11.000.
- "Plato dahil" = anlaşmalı platoda giriş bize ait. "Plato şart / kiralama" DEME.

ANLAŞMALI PLATO (giriş bize ait; isterlerse IG):
- Başka: https://www.instagram.com/baskafotografplatosu/
- Anka: https://www.instagram.com/ankaplato/
- No25: https://www.instagram.com/no25plato/

Erken varsayım YASAK. Sepet tutarı deme. Orta sohbette tekrar merhaba deme.
Özel fiyatı ekibe DEME. Sayı/ödül uydurma YASAK.`;

export function composeCompanyBrainPromptBlock(params: {
  catalogBlock: string | null | undefined;
  salesLearningBlock: string | null | undefined;
}): string {
  const parts = [
    "## Redmedia şirket beyni (her cevapta uy)",
    FIRM_IDENTITY,
    "",
    composeSalesPlaybookBlock(),
    "",
    composeFirmTrustFactsBlock(),
    "",
    "### Katalog (yedek birim fiyat)",
    params.catalogBlock?.trim() || "(katalog boş)",
  ];

  if (params.salesLearningBlock?.trim()) {
    parts.push(
      "",
      "### DM satış dili",
      params.salesLearningBlock.trim()
    );
  }

  parts.push(
    "",
    "Satış Beyni state/memory'ye uy. Rezervasyon > sıkıştırma."
  );

  return parts.join("\n");
}
