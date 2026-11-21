import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { getOrCreateBusinessSettings } from "@/features/settings/repositories/business-settings.repository";
import { listRecentMessagesByConversation } from "@/features/conversations/repositories/messages.repository";

type TypedSupabaseClient = SupabaseClient<Database>;

/**
 * Numara toplama DM akışı (reklam → DM → numara → sesli asistan arar).
 *
 * Serbest AI yazımı YOK: sabit, işletme sahibinin onayladığı metinler.
 *  - İlk mesaj  → tebrik + kampanya aciliyeti + numara isteği
 *  - Numara gelince → teşekkür + siteye çift olarak aktarılır (arama sırası)
 *  - Numarasız devam → kısa hatırlatma (iki dönüşümlü metin)
 *
 * Ayar business_settings.settings.dmLeadCapture:
 *   { acik: boolean, herkes?: boolean, testKullanicilar?: string[], siteApiKey?: string }
 * herkes=false iken YALNIZ testKullanicilar'a cevap verilir (DM_AUTO_REPLY_HARD_OFF açık kalsa da).
 */
export type DmLeadCaptureConfig = {
  acik: boolean;
  herkes: boolean;
  testKullanicilar: string[];
  siteApiKey: string | null;
};

export const ARAMA_HATTI = "0312 963 23 47";
const SITE_COUPLES_URL = "https://redmediadugun.com/api/ai/couples";

export const DM_ACILIS =
  "Merhabalar, öncelikle hayırlı olsun! 💍\n\n" +
  "2027 kampanyamız 31 Aralık'ta sona eriyor ve çoğu tarihte son 3-4 yerimiz kaldı; kampanya bitince fiyatlara %40 zam geliyor.\n\n" +
  `İletişim numaranızı yazarsanız hemen ${ARAMA_HATTI} numaralı hattımızdan sizi arayıp paketler, kampanya ve fiyatlandırma hakkında detaylı bilgi verelim. 📞\n\n` +
  "(Numaranız yalnızca sizi aramak için kullanılır.)";

const DM_HATIRLATMA = [
  "Detayları ve size özel fiyatı telefonda 2-3 dakikada anlatabiliriz 😊 " +
    `Numaranızı buraya yazmanız yeterli, ${ARAMA_HATTI} numaralı hattımızdan hemen arayalım. ` +
    "Kampanya 31 Aralık'ta bitiyor, tarihiniz dolmadan yerinizi ayırtalım.",
  "Çoğu tarihte son 3-4 yerimiz kaldığı için hızlı ilerlemek istiyoruz 🙏 " +
    `Telefon numaranızı yazarsanız ${ARAMA_HATTI}'ten sizi arayıp tüm paketleri anlatalım.`,
];

export function dmTesekkur(saat = new Date()): string {
  const h = Number(new Intl.DateTimeFormat("tr-TR", { hour: "numeric", hour12: false, timeZone: "Europe/Istanbul" }).format(saat));
  const ne = h >= 9 && h < 20 ? "birazdan" : "yarın sabah";
  return `Teşekkür ederiz! 🙏 ${ne[0].toUpperCase()}${ne.slice(1)} ${ARAMA_HATTI} numaralı hattımızdan sizi arayacağız. Görüşmek üzere 💍`;
}

/** Türk cep numarası → 05XXXXXXXXX; yoksa null. */
export function telefonBul(metin: string): string | null {
  // Ayraçlı yazımlar ("0532 111 22 33", "+90 (532) 111-22-33"); önündeki tarih rakamlarına yapışmaz
  const m = metin.match(/(?<!\d)(?:\+?\s*90[\s.-]*)?\(?0?\s*(5\d{2})\)?[\s.-]*(\d{3})[\s.-]*(\d{2})[\s.-]*(\d{2})(?!\d)/);
  return m ? `0${m[1]}${m[2]}${m[3]}${m[4]}` : null;
}

function kullaniciAdi(u: string | null | undefined): string {
  return (u ?? "").trim().replace(/^@/, "").toLocaleLowerCase("tr-TR");
}

export async function readDmLeadCaptureConfig(supabase: TypedSupabaseClient): Promise<DmLeadCaptureConfig> {
  const row = await getOrCreateBusinessSettings(supabase);
  const s = (row.settings ?? {}) as Record<string, unknown>;
  const c = (s.dmLeadCapture ?? {}) as Record<string, unknown>;
  return {
    acik: c.acik === true,
    herkes: c.herkes === true,
    testKullanicilar: Array.isArray(c.testKullanicilar) ? c.testKullanicilar.map((x) => kullaniciAdi(String(x))).filter(Boolean) : [],
    siteApiKey: typeof c.siteApiKey === "string" && c.siteApiKey.length >= 24 ? c.siteApiKey : null,
  };
}

export function dmLeadCaptureIzinli(cfg: DmLeadCaptureConfig, username: string | null | undefined): boolean {
  if (!cfg.acik) return false;
  if (cfg.herkes) return true;
  const u = kullaniciAdi(username);
  return Boolean(u) && cfg.testKullanicilar.includes(u);
}

async function siteyeAktar(
  cfg: DmLeadCaptureConfig,
  p: { telefon: string; ad: string | null; username: string | null; mesaj: string }
): Promise<boolean> {
  if (!cfg.siteApiKey) return false;
  try {
    const r = await fetch(SITE_COUPLES_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${cfg.siteApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        source: "meta_form",
        sourceRef: "instagram_dm",
        name: p.ad || (p.username ? `@${p.username}` : "Instagram DM"),
        phone: p.telefon,
        note: `Instagram DM'den numara bıraktı${p.username ? ` (@${p.username})` : ""}. Mesaj: ${p.mesaj.slice(0, 300)}`,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    return r.ok;
  } catch (e) {
    console.error("[dm-lead-capture] siteye aktarılamadı:", e instanceof Error ? e.message : "bilinmeyen");
    return false;
  }
}

export type DmLeadCaptureResult = { reply: string; telefon: string | null; siteyeAktarildi: boolean };

/**
 * İzinli kullanıcı için sabit metinli cevap. İzin yoksa null (eski akış/kapalı devam eder).
 */
export async function dmLeadCaptureReply(
  supabase: TypedSupabaseClient,
  p: { customerMessage: string; conversationId: string | null; username: string | null; fullName: string | null }
): Promise<DmLeadCaptureResult | null> {
  const cfg = await readDmLeadCaptureConfig(supabase);
  if (!dmLeadCaptureIzinli(cfg, p.username)) return null;

  const telefon = telefonBul(p.customerMessage);
  if (telefon) {
    const ok = await siteyeAktar(cfg, { telefon, ad: p.fullName, username: kullaniciAdi(p.username) || null, mesaj: p.customerMessage });
    return { reply: dmTesekkur(), telefon, siteyeAktarildi: ok };
  }

  const gecmis = p.conversationId ? await listRecentMessagesByConversation(supabase, p.conversationId, 20).catch(() => []) : [];
  const aiSayisi = gecmis.filter((m) => m.sender_type === "ai").length;
  if (aiSayisi === 0) return { reply: DM_ACILIS, telefon: null, siteyeAktarildi: false };
  return { reply: DM_HATIRLATMA[(aiSayisi - 1) % DM_HATIRLATMA.length], telefon: null, siteyeAktarildi: false };
}
