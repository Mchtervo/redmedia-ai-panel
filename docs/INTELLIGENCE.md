# AI Intelligence

Yeni dış API yok. Kanıtı olmayan bilgi kesin gibi yazılmaz. Veri uydurulmaz.

## Zorunlu alanlar (`IntelligenceBrief`)

| Alan | Açıklama |
|------|----------|
| Başlık (`title`) | Kısa başlık |
| Özet (`summary`) | Tek cümle durum |
| Neden oldu? (`why`) | |
| Sonra ne olacak? (`whatNext`) | |
| Ben şimdi ne yapmalıyım? (`doNow`) | |
| Confidence % (`confidence`) | 0–100 |
| Evidence (`evidence`) | Gerçek metrikler; yoksa «Yeterli veri bulunamadı.» |
| Priority | Critical / High / Medium / Low |

## Confidence

| Band | Anlam | Güven |
|------|--------|-------|
| `exact` | Exact/manual attribution veya doğrudan sayılan operasyon verisi | Yüksek (~75–95) |
| `probable` | Olası kaynak / skor sinyali | Orta (~40–65) |
| `insufficient` | Yetersiz veri | Düşük (~10–35) |

Kanıt listesi boşsa band otomatik `insufficient` olur; metin «Yeterli veri bulunamadı.»

## Tek bileşen

`IntelligenceBriefCard` / `IntelligenceBriefList` — Dashboard, CRM, Attribution, Marketing.

## Modül

`src/features/intelligence/`
