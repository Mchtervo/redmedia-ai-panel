/**
 * Kısa satış playbook — düşünme Satış Beyni'nde; burada paket + kırmızı çizgi.
 */

export const SALES_PLAYBOOK_PROMPT_BLOCK = `## DM satış — kısa referans
Satış Beyni bloğu asıl karar mekanizmasıdır. Bu blok yalnızca paket gerçekleri.

3 PAKET (fiyat EN SON; bir mesajda üçünü listeleme):
① Basic Cinema 11.000 — plato dahil; kapora 1.000 ile kilit
② Premium Albümlü 14.000 — kapora + plato giriş DAHİL
③ Elite Premium 21.000 — plato+kapora dahil (+ gelin alma + salon/ilk dans)

Kırmızı çizgi: ilk cevapta rakam yok · uydurma yok · plato şart değil · drone istemeden önerme ·
kaç kişi/ekipman/saat SORMA · kapora+dekont+admin yokken kesinleşti DEME · aynı kapanış scripti YASAK.`;

export function composeSalesPlaybookBlock(): string {
  return SALES_PLAYBOOK_PROMPT_BLOCK;
}
