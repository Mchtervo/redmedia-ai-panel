/**
 * Paket fiyatları + ekstra + drone kapanış stratejisi (prompt enjeksiyonu).
 */

export type DetectedEventType =
  | "wedding"
  | "engagement"
  | "kız_isteme"
  | "other"
  | "unknown";

export type DetectedVenueKind =
  | "home"
  | "outdoor_green"
  | "partner_plato"
  | "other_plato"
  | "salon"
  | "unknown";

export type ExtraKey =
  | "drone"
  | "shoulder"
  | "hair"
  | "bride_pickup"
  | "first_dance"
  | "albums";

/** Basic Cinema — plato dahil; kapora 1.000 ile tarih kilit. */
export const BASIC_CINEMA_PACKAGE_TRY = 11000;

/** Premium Albümlü — kapora + plato giriş DAHİL. */
export const PREMIUM_ALBUM_PACKAGE_TRY = 14000;

/** Elite Premium — plato + kapora dahil (+ gelin/salon/ilk dans). */
export const ELITE_PREMIUM_PACKAGE_TRY = 21000;

/** İçerik referansı — müşteriye TEK mesajda hepsini kusma. */
export const BASIC_CINEMA_INCLUDES = [
  "Fotoğraf çekimi — poz sınırı yok",
  "Çekilen tüm kareler teslim",
  "Sinematik dış çekim klibi ~1–2 dk",
] as const;

export const PREMIUM_ALBUM_INCLUDES = [
  "Fotoğraf çekimi — poz sınırı yok",
  "Çekilen tüm kareler teslim",
  "Sinematik klip çekimi",
  "1 büyük albüm",
  "2 aile albümü",
  "22 profesyonel düzenlenmiş fotoğraf",
  "40 farklı premium albüm seçeneği",
  "Kapora + plato giriş ücreti DAHİL",
] as const;

export const ELITE_PREMIUM_INCLUDES = [
  "Premium Albümlü kapsam + gelin alma + salon giriş/ilk dans",
  "22 retouch · albümler · sinematik klipler",
  "Plato + kapora dahil",
] as const;

/** Drone hariç — sorulunca / ihtiyaç olunca (bilgi dump değil). */
export const UPSSELL_EXTRAS_EXCEPT_DRONE = [
  "Omuz kamerası — 6.500 TL",
  "Kuaför & hazırlık klip — 5.000 TL",
  "Gelin alma — 5.000 TL (Elite'te dahil)",
  "Salon/ilk dans — 5.000 TL (Elite'te dahil)",
] as const;

/** Paket üstüne normal fiyat (Elite'te gelin/salon/ilk dans DAHİL — ekstra sayma). */
export const EXTRA_PRICES_TRY: Record<
  ExtraKey,
  { label: string; price: number }
> = {
  drone: { label: "Drone çekimi", price: 4000 },
  shoulder: { label: "Omuz kamerası", price: 6500 },
  hair: { label: "Kuaför hazırlık video çekimi", price: 5000 },
  bride_pickup: { label: "Gelin alma çekimi", price: 5000 },
  first_dance: { label: "İlk dans / salon giriş klibi", price: 5000 },
  albums: {
    label: "Albüm seti — Premium Albümlü 14.000'e yükselt",
    price: 3000,
  },
};

export const PARTNER_PLATO_NAMES = [
  "Başka Plato",
  "Anka Plato",
  "No25",
] as const;

/** Anlaşmalı plato Instagram — müşteri isterse / sunulabilir. */
export const PARTNER_PLATO_INSTAGRAM: Record<
  (typeof PARTNER_PLATO_NAMES)[number],
  string
> = {
  "Başka Plato": "https://www.instagram.com/baskafotografplatosu/",
  "Anka Plato": "https://www.instagram.com/ankaplato/",
  No25: "https://www.instagram.com/no25plato/",
};

export const KAPORA_TRY = 1000;
export const DRONE_LIST_TRY = 4000;

export type ConversationFacts = {
  eventType: DetectedEventType;
  venueKind: DetectedVenueKind;
  partnerPlatoName: (typeof PARTNER_PLATO_NAMES)[number] | null;
  prefersElite: boolean;
  prefersPremiumAlbum: boolean;
  prefersBasic: boolean;
  refusedAlbum: boolean;
  requestedExtras: ExtraKey[];
  researchingOnly: boolean;
  hesitating: boolean;
  mentionedPhotoOrClip: boolean;
  /** Dış çekim bağlamı (plato/yeşillik) — drone hediye yalnızca burada. */
  outdoorShootContext: boolean;
  /** Yalnız dış çekim / paket sorusu — düğün+gelin alma varsayma. */
  outdoorOnlyInquiry: boolean;
};

function normalize(text: string): string {
  return text.toLocaleLowerCase("tr-TR");
}

/**
 * Şikâyet / "ne alaka" cümlelerindeki etkinlik adlarını sil —
 * "kız istemene alaka" → kız_isteme sanılmasın.
 */
function stripNegatedEventMentions(t: string): string {
  return t
    .replace(
      /kız\s*isteme[^\n.]{0,50}(alaka|değil|degil|yok|yanlış|yanlis|nereden|nerden)/gi,
      " "
    )
    .replace(
      /(alaka|değil|degil|yok|yanlış|yanlis|nereden|nerden)[^\n.]{0,50}kız\s*isteme/gi,
      " "
    )
    .replace(
      /(düğün|dugun|nişan|nisan)[^\n.]{0,40}(alaka|mü\b|mu\b|mı\b|mi\b)\b/gi,
      " "
    )
    .replace(
      /\b(düğün|dugun|nişan|nisan|kız\s*isteme)\s*(mü|mu|mı|mi)\b/gi,
      " "
    );
}

function detectEventType(t: string): DetectedEventType {
  const cleaned = stripNegatedEventMentions(t);
  // Olumlu niyet: "için / istiyoruz / olacak / var"
  if (
    /\bdüğün\b|\bdugun\b/.test(cleaned) &&
    !/\bdüğün\s*(mü|mu)\b/.test(t)
  ) {
    return "wedding";
  }
  if (/\bnişan\b|\bnisan\b/.test(cleaned)) return "engagement";
  if (
    /kız\s*isteme|kiz\s*isteme/.test(cleaned) &&
    /(için|istiyor|olacak|yapaca|çekim|cekim)/.test(cleaned)
  ) {
    return "kız_isteme";
  }
  // Tek başına "kız isteme" kelimesi (şikâyet değilse) — yalnız olumlu kalıp
  if (
    /(?:^|[.!\s])kız\s*istememiz|(?:^|[.!\s])kız\s*isteme\s+için|(?:^|[.!\s])kız\s*isteme\s+çekim/.test(
      cleaned
    )
  ) {
    return "kız_isteme";
  }
  return "unknown";
}

export function detectConversationFacts(fullText: string): ConversationFacts {
  const t = normalize(fullText);

  const eventType = detectEventType(t);
  let venueKind: DetectedVenueKind = "unknown";
  let partnerPlatoName: ConversationFacts["partnerPlatoName"] = null;

  if (/başka\s*plato|baska\s*plato/.test(t)) {
    venueKind = "partner_plato";
    partnerPlatoName = "Başka Plato";
  } else if (/anka\s*plato/.test(t)) {
    venueKind = "partner_plato";
    partnerPlatoName = "Anka Plato";
  } else if (/\bno\s*25\b|\bno25\b/.test(t)) {
    venueKind = "partner_plato";
    partnerPlatoName = "No25";
  } else if (/\bplato\b/.test(t)) {
    venueKind = "other_plato";
  } else if (/\bev\b|evde|ev\s*nişan|ev\s*nisan/.test(t)) {
    venueKind = "home";
  } else if (/yeşillik|yesillik|açık\s*alan|acik\s*alan|park\b/.test(t)) {
    venueKind = "outdoor_green";
  } else if (/\bsalon\b/.test(t)) {
    venueKind = "salon";
  }

  const refusedAlbum =
    /albüm\s*istemi|album\s*istemi|albüm\s*yok|album\s*yok|albümsüz|albumsuz|albüm\s*istemiyorum|album\s*istemiyorum/.test(
      t
    );

  const wantsAlbum =
    !refusedAlbum && /albüm|album|retouch|düzenlenmiş|duzenlenmis/.test(t);
  const wantsEliteDay =
    /elite|gelin\s*alma|ilk\s*dans|salon\s*giriş|salon\s*giris|tam\s*paket/.test(
      t
    );

  const outdoorShootContext =
    venueKind === "partner_plato" ||
    venueKind === "other_plato" ||
    venueKind === "outdoor_green" ||
    /dış\s*çekim|dis\s*cekim/.test(t);

  /** Dış çekim sorusu; düğün/albüm/gelin istenmemiş → Basic odaklı. */
  const outdoorOnlyInquiry =
    outdoorShootContext &&
    eventType === "unknown" &&
    !wantsAlbum &&
    !wantsEliteDay &&
    !refusedAlbum;

  const prefersElite = !refusedAlbum && wantsEliteDay;
  const prefersPremiumAlbum = !refusedAlbum && wantsAlbum && !wantsEliteDay;

  const prefersBasic =
    refusedAlbum ||
    outdoorOnlyInquiry ||
    /basic|basit|sadece\s*(foto|klip|video)|yalnız\s*(foto|klip)|sadece\s*dış|yalnız\s*dış/.test(
      t
    );

  const mentionedPhotoOrClip =
    /fotoğraf|fotograf|foto\b|klip|video|çekim|cekim|paket|albüm|album|fiyat|tarif|ücret|ucret|ne\s*kadar|dış\s*çekim|dis\s*cekim/.test(
      t
    );

  const requestedExtras: ExtraKey[] = [];
  if (/\bdrone\b|dron\b/.test(t)) requestedExtras.push("drone");
  if (/omuz/.test(t)) requestedExtras.push("shoulder");
  if (/kuaför|kuafor|hazırlık\s*video|hazirlik\s*video/.test(t))
    requestedExtras.push("hair");
  if (/gelin\s*alma/.test(t) && !prefersElite)
    requestedExtras.push("bride_pickup");
  if (/ilk\s*dans|salon\s*giriş|salon\s*giris/.test(t) && !prefersElite)
    requestedExtras.push("first_dance");
  if (wantsAlbum && !prefersElite && !prefersPremiumAlbum)
    requestedExtras.push("albums");

  const researchingOnly =
    /araştırıyorum|arastiriyorum|sadece\s*fiyat|henüz\s*rezerv|henuz\s*rezerv/.test(
      t
    );

  const hesitating =
    /düşün|dusunun|bakarız|bakariz|kaçacak|kacacak|pahalı|pahali|başka\s*yere|baska\s*yere|emin\s*değil|emin\s*degil|kararsız|kararsiz|sonra\s*yazar|iddia/.test(
      t
    );

  return {
    eventType,
    venueKind,
    partnerPlatoName,
    prefersElite,
    prefersPremiumAlbum,
    prefersBasic,
    refusedAlbum,
    requestedExtras,
    researchingOnly,
    hesitating,
    mentionedPhotoOrClip,
    outdoorShootContext,
    outdoorOnlyInquiry,
  };
}

export type PackageQuote = {
  facts: ConversationFacts;
  recommended:
    | "basic_cinema"
    | "premium_album"
    | "elite_premium"
    | "both"
    | "ask_first";
  basicPrice: number;
  premiumAlbumPrice: number;
  elitePrice: number;
  extrasTotal: number;
  payableHint: number | null;
  entranceNote: string | null;
  kaporaNote: string;
  droneStrategyNote: string;
  lines: string[];
};

export function calculatePackageQuote(facts: ConversationFacts): PackageQuote {
  const lines: string[] = [];

  let entranceNote: string | null = null;
  if (facts.venueKind === "partner_plato") {
    const name = facts.partnerPlatoName ?? "anlaşmalı plato";
    const ig =
      facts.partnerPlatoName != null
        ? PARTNER_PLATO_INSTAGRAM[facts.partnerPlatoName]
        : null;
    entranceNote = ig
      ? `${name}: giriş ücreti pakete dahil / bize ait. Instagram: ${ig}`
      : `${name}: giriş ücreti pakete dahil / bize ait.`;
  } else if (facts.venueKind === "other_plato") {
    entranceNote =
      "Anlaşmasız plato: girişi çift öder; tutar uydurma. Paket fiyatları aynı.";
  }

  const kaporaNote = [
    `Premium Albümlü 14.000: kapora + plato giriş DAHİL.`,
    `Elite Premium 21.000: plato + kapora dahil.`,
    `Basic Cinema 11.000: plato dahil; kapora ${KAPORA_TRY.toLocaleString("tr-TR")} TL ile tarih kilitlenir (Basic toplamına üstüne ekleme, süreç içinde alınır).`,
  ].join(" ");

  const droneStrategyNote = [
    "DRONE: Proaktif önerme. Yalnız müşteri DIŞ ÇEKİMDE drone isterse ücretli söyle: 4.000 TL.",
    "Pakette otomatik hediye yok. KAPANIS istisnası: kararsız + DIŞ ÇEKİM → hediye edilebilir (gelin/kuaför/salon hariç).",
    "Öv + zam: erken rezervasyon %20 / zam öncesi. Uydurma '3 tarih' yok.",
  ].join(" ");

  const ready =
    (facts.eventType !== "unknown" && facts.venueKind !== "unknown") ||
    facts.outdoorOnlyInquiry ||
    (facts.mentionedPhotoOrClip && facts.venueKind !== "unknown");

  if (!ready && !facts.mentionedPhotoOrClip) {
    return {
      facts,
      recommended: "ask_first",
      basicPrice: BASIC_CINEMA_PACKAGE_TRY,
      premiumAlbumPrice: PREMIUM_ALBUM_PACKAGE_TRY,
      elitePrice: ELITE_PREMIUM_PACKAGE_TRY,
      extrasTotal: 0,
      payableHint: null,
      entranceNote,
      kaporaNote,
      droneStrategyNote,
      lines: [
        "Önce ne istediğini sor (dış çekim/fiyat); etkinlik varsayma.",
      ],
    };
  }

  let recommended: PackageQuote["recommended"] = "both";
  if (facts.refusedAlbum || facts.prefersBasic || facts.outdoorOnlyInquiry) {
    recommended = "basic_cinema";
  } else if (facts.prefersElite) {
    recommended = "elite_premium";
  } else if (facts.prefersPremiumAlbum) {
    recommended = "premium_album";
  }

  lines.push(
    `Basic Cinema: ${BASIC_CINEMA_PACKAGE_TRY.toLocaleString("tr-TR")} TL (plato dahil; kapora ${KAPORA_TRY.toLocaleString("tr-TR")} TL ile tarih kilit)`
  );
  for (const item of BASIC_CINEMA_INCLUDES) {
    lines.push(`  · ${item}`);
  }

  if (recommended === "basic_cinema" || facts.outdoorOnlyInquiry) {
    lines.push(
      "Premium Albümlü (14.000) / Elite (21.000) yalnız müşteri albüm veya gelin alma isterse — ilk cevapta dayatma YASAK.",
      "Düğün varsayma. Yalnız dış çekim odaklı konuş."
    );
  } else if (recommended === "premium_album") {
    lines.push(
      `Premium Albümlü Paket: ${PREMIUM_ALBUM_PACKAGE_TRY.toLocaleString("tr-TR")} TL (kapora + plato giriş DAHİL)`
    );
    for (const item of PREMIUM_ALBUM_INCLUDES) {
      lines.push(`  · ${item}`);
    }
    lines.push(
      "Elite (21.000) yalnız gelin alma / salon / ilk dans isterse anlat."
    );
  } else {
    lines.push(
      `Premium Albümlü: ${PREMIUM_ALBUM_PACKAGE_TRY.toLocaleString("tr-TR")} TL (kapora + plato DAHİL)`
    );
    for (const item of PREMIUM_ALBUM_INCLUDES) {
      lines.push(`  · ${item}`);
    }
    lines.push(
      `Elite Premium: ${ELITE_PREMIUM_PACKAGE_TRY.toLocaleString("tr-TR")} TL (plato + kapora dahil)`
    );
    for (const item of ELITE_PREMIUM_INCLUDES) {
      lines.push(`  · ${item}`);
    }
  }
  let extrasTotal = 0;
  const eliteExtras = new Set<ExtraKey>([
    "bride_pickup",
    "first_dance",
    "albums",
  ]);
  const premiumAlbumExtras = new Set<ExtraKey>(["albums"]);
  for (const key of facts.requestedExtras) {
    if (recommended === "elite_premium" && eliteExtras.has(key)) continue;
    if (recommended === "premium_album" && premiumAlbumExtras.has(key))
      continue;
    const extra = EXTRA_PRICES_TRY[key];
    if (key === "drone" && !facts.hesitating) {
      extrasTotal += extra.price;
      lines.push(
        `Ekstra ${extra.label}: +${extra.price.toLocaleString("tr-TR")} TL (pakette hediye YOK)`
      );
    } else if (key === "drone" && facts.hesitating && facts.outdoorShootContext) {
      lines.push(
        "Drone: kapanış hediyesi adayı (yalnız dış çekim) — şimdilik fiyat söyleme, ikna turunda hediye et"
      );
    } else {
      extrasTotal += extra.price;
      lines.push(
        `Ekstra ${extra.label}: +${extra.price.toLocaleString("tr-TR")} TL`
      );
    }
  }

  const base =
    recommended === "basic_cinema"
      ? BASIC_CINEMA_PACKAGE_TRY
      : recommended === "premium_album"
        ? PREMIUM_ALBUM_PACKAGE_TRY
        : recommended === "elite_premium"
          ? ELITE_PREMIUM_PACKAGE_TRY
          : null;

  return {
    facts,
    recommended,
    basicPrice: BASIC_CINEMA_PACKAGE_TRY,
    premiumAlbumPrice: PREMIUM_ALBUM_PACKAGE_TRY,
    elitePrice: ELITE_PREMIUM_PACKAGE_TRY,
    extrasTotal,
    payableHint: base != null ? base + extrasTotal : null,
    entranceNote,
    kaporaNote,
    droneStrategyNote,
    lines,
  };
}

function formatTry(n: number): string {
  return `${n.toLocaleString("tr-TR")} TL`;
}

/** Yumuşak ikna — sıkmadan. */
export const CLOSING_PSYCHOLOGY_BLOCK = `## Danışman hunisi (soru-cevap robotu olma)
1) Mesajda EN FAZLA 1 soru; önce tepki/duygu/değer. ~3 satır. Tek amaç.
2) Plato şart değil. İlk cevapta rakam YASAK.
3) Değer+duygu → müşteri tipine göre 1–2 paket → FİYAT EN SON (üçünü birden kusma).
4) Kapora: Basic'te "Sadece 1.000 ile tarihi kilitleyebiliyoruz"; Premium/Elite'te kapora pakete DAHİL.
5) "bakarız/teşekkürler" → soft CTA. "Eşinizle bugün mü / hafta sonu mu?" SCRİPTİ YASAK — her kapanış YENİ.
6) FOMO: sezon/takvim dili OK; "3 tarih" / sahte rezervasyon YASAK. Drone istemeden önerme.`;

export const PACKAGE_DETAIL_PITCH_BLOCK = `## DETAY + SATIŞ SIRASI (fiyat EN SON)
0) Kısa özet + duygu. Mesajda tek soru + tek bilgi. Cognitive dump YASAK.
A) Choice (rakam yok): müşteri tipine göre 1–2 seçenek — Basic / Premium Albümlü / Elite.
B) BASIC: foto + tüm kareler + sinematik klip (~1–2 dk)
C) PREMIUM ALBÜMLÜ: Basic + 1 büyük + 2 aile albümü + 22 retouch + 40 albüm seçeneği
D) ELITE: Premium + gelin alma + salon/ilk dans
E) Kanıt (bir madde): 7 yıl Ankara · Düğün.com Ankara 3. · IG @redmedia.co — sayı UYDURMA.
F) FİYAT SONDA:
- Basic 11.000 · Premium Albümlü 14.000 (kapora+plato DAHİL) · Elite 21.000 (plato+kapora dahil)
G) DRONE: istemeden yok; isterse 4.000; kararsız dış çekimde hediye istisnası.`;
function extractCustomerTextForFacts(
  historyText: string,
  customerMessage: string
): string {
  const lines = historyText.split("\n").map((l) => l.trim()).filter(Boolean);
  const hasRoles = lines.some((l) =>
    /^(müşteri|asistan|personel|customer|ai|staff)\s*:/i.test(l)
  );
  if (hasRoles) {
    const customerLines = lines
      .filter((l) => /^(müşteri|customer)\s*:/i.test(l))
      .map((l) => l.replace(/^(müşteri|customer)\s*:/i, "").trim());
    return [...customerLines, customerMessage].join("\n");
  }
  // Rol yoksa yalnızca son müşteri mesajı + negasyon korumalı birleşik metin
  return `${historyText}\n${customerMessage}`;
}

/**
 * Yalnız müşteri mesajlarından çıkarım — asistanın "kız isteme mi?" sorusu
 * etkinlik varsayımı üretmesin.
 */
function isDiscoveryTurn(historyText: string): boolean {
  return (
    !historyText.trim() ||
    !/(^|\n)\s*(asistan|ai)\s*:/i.test(historyText)
  );
}

export function buildVenueQuotePromptBlock(
  historyText: string,
  customerMessage: string
): string {
  const facts = detectConversationFacts(
    extractCustomerTextForFacts(historyText, customerMessage)
  );
  const quote = calculatePackageQuote(facts);
  const discovery = isDiscoveryTurn(historyText);

  const known: string[] = [];
  if (facts.eventType === "wedding") known.push("Etkinlik: DÜĞÜN (tekrar sorma)");
  if (facts.eventType === "engagement")
    known.push("Etkinlik: NİŞAN (tekrar sorma)");
  if (facts.eventType === "kız_isteme")
    known.push("Etkinlik: KIZ İSTEME (tekrar sorma)");
  if (facts.venueKind === "partner_plato") {
    known.push(
      `Mekân: ${facts.partnerPlatoName ?? "anlaşmalı plato"} (giriş pakete dahil)`
    );
  } else if (facts.venueKind === "other_plato") {
    known.push("Mekân: plato (anlaşmasız — giriş çiftte)");
  } else if (facts.venueKind === "home") known.push("Mekân: EV");
  else if (facts.venueKind === "outdoor_green")
    known.push("Mekân: yeşillik/bahçe — plato şart değil");
  if (facts.refusedAlbum) known.push("Albüm istemiyor → Basic Cinema ağırlık");
  if (facts.prefersPremiumAlbum)
    known.push("Albüm istiyor → Premium Albümlü 14.000 (kapora+plato DAHİL)");
  if (facts.prefersElite)
    known.push("Gelin/salon/ilk dans → Elite Premium 21.000");
  if (facts.outdoorOnlyInquiry)
    known.push(
      "Yalnız dış çekim sorusu → Basic yönünde düşün; düğün/gelin alma VARSAYMA"
    );
  if (facts.hesitating)
    known.push("Kararsız/kaçış sinyali → drone kapanış (yalnız dış çekim)");
  if (facts.researchingOnly)
    known.push("Araştırıyor → detay+fırsat anlat, fiyatı sonda bırak; sıkma");

  const parts: string[] = [
    discovery
      ? "## KEŞİF TURU (şu an — RAKAM YAZMA)"
      : "## HESAPLANMIŞ FİYAT (istek net — bu rakamları kullan)",
    known.length
      ? `Bilinenler:\n${known.map((k) => `- ${k}`).join("\n")}`
      : "Bilinenler: etkinlik/mekân henüz net değil.",
    "",
    CLOSING_PSYCHOLOGY_BLOCK,
  ];

  if (discovery) {
    parts.push(
      "",
      "⛔ İLK CEVAPTA 11.000 / 14.000 / 21.000 / kapora / TL rakamı YAZMA — yasak.",
      "Yap: samimi tepki + duygu/değer ipucu + TEK soru (~3 satır; üst üste soru YASAK).",
      "Örnek: 'Dış çekim çok güzel duruyor; anı niteliğinde kareler çıkıyor. Albüm de düşünüyor musunuz?'",
      "Sonraki: tur tur teşhis → 1–2 seçenek → değer → fiyat → YENİ soft CTA (aynı kapanış scripti YASAK).",
      "YASAK: Düğün/gelin varsaymak. YASAK: Erken drone. YASAK: Sepet. YASAK: Sahte yorum/sayı. YASAK: Bilgi dump.",
      "",
      "(Dahili — bu turda söyleme: Basic 11.000 · Premium Albümlü 14.000 · Elite 21.000)"
    );
    return parts.join("\n");
  }

  parts.push("", PACKAGE_DETAIL_PITCH_BLOCK);

  const generalPackageAsk =
    facts.eventType === "unknown" &&
    !facts.outdoorOnlyInquiry &&
    facts.mentionedPhotoOrClip;

  if (generalPackageAsk) {
    parts.push(
      "",
      "⚠️ GENEL SORU — 'dış çekim için' diye kilitleme. Gelin alma dayatma YASAK (fırsat olarak Elite'te anlatılabilir)."
    );
  } else if (facts.outdoorOnlyInquiry || facts.eventType === "unknown") {
    parts.push(
      "",
      "⚠️ DÜĞÜN VARSAYMA YASAK. Basic içeriğini detaylı anlat → ekstra fırsatlar (drone hariç) → fiyat EN SON."
    );
  }

  if (quote.recommended === "ask_first") {
    parts.push(
      "",
      "Şu an: etkinlik/mekân eksik. Varsayma. Açık sor: ne için yazdınız / tarif mi yoksa başka mı?",
      "Eski 12.000 / 15.000 / 'drone hediye paket' anlatma. Premium Albümlü = 14.000 (kapora+plato dahil)."
    );
    return parts.join("\n");
  }

  parts.push(
    "",
    "PAKET DETAYI (müşteriye TUR TUR anlat — tek mesajda hepsini kusma; rakam henüz yok):",
    `ÖNERİLEN: ${quote.recommended}`
  );
  if (
    quote.recommended === "basic_cinema" ||
    facts.outdoorOnlyInquiry ||
    facts.refusedAlbum
  ) {
    parts.push("Basic Cinema içeriği (bu turda 1–2 madde):");
    for (const item of BASIC_CINEMA_INCLUDES) parts.push(`  · ${item}`);
    parts.push(
      "Albüm isterlerse Premium Albümlü (14.000) anlat; gelin/salon isterse Elite."
    );
  } else if (quote.recommended === "premium_album") {
    parts.push("Premium Albümlü içeriği (bu turda 1–2 madde — dump YASAK):");
    for (const item of PREMIUM_ALBUM_INCLUDES) parts.push(`  · ${item}`);
    parts.push(
      "Gelin alma / salon isterlerse Elite'e geçiş; sade foto+klip isterlerse Basic."
    );
  } else if (quote.recommended === "elite_premium") {
    parts.push("Elite Premium içeriği (özet — dump YASAK):");
    for (const item of ELITE_PREMIUM_INCLUDES) parts.push(`  · ${item}`);
    parts.push(
      "Daha sade: Premium Albümlü 14.000 veya Basic 11.000 — müşteri tipine göre 1 seçenek."
    );
  } else {
    parts.push("Premium Albümlü (özet):");
    for (const item of PREMIUM_ALBUM_INCLUDES.slice(0, 4))
      parts.push(`  · ${item}`);
    parts.push("Elite özeti: Premium + gelin alma + salon/ilk dans.");
    parts.push("Basic: foto+klip odaklı daha sade paket.");
  }

  parts.push(
    "",
    "EK HİZMET (drone HARİÇ — yalnız ilgiliyse 1 madde öner; dump YASAK):",
    ...UPSSELL_EXTRAS_EXCEPT_DRONE.map((x) => `  · ${x}`),
    "",
    quote.droneStrategyNote,
    quote.entranceNote ||
      "Plato: Anlaşmalı (Başka/Anka/No25) giriş bize ait; diğerlerinde çift öder, tutar uydurma.",
    "PLATO INSTAGRAM (isterlerse):",
    ...PARTNER_PLATO_NAMES.map(
      (n) => `  · ${n}: ${PARTNER_PLATO_INSTAGRAM[n]}`
    ),
    "",
    "⛔ FİYAT / KAPORA — YALNIZ MESAJIN EN SONUNDA (bir mesajda üç fiyat listeleme):",
    `  · Basic Cinema: ${formatTry(quote.basicPrice)} (plato dahil; kapora 1.000 ile kilit)`,
    quote.recommended === "premium_album" ||
      quote.recommended === "elite_premium" ||
      quote.recommended === "both"
      ? `  · Premium Albümlü: ${formatTry(quote.premiumAlbumPrice)} (kapora + plato giriş DAHİL)`
      : "  · Premium Albümlü: albüm isterse 14.000 (kapora + plato DAHİL)",
    quote.recommended === "elite_premium" || quote.recommended === "both"
      ? `  · Elite Premium: ${formatTry(quote.elitePrice)} (plato + kapora dahil)`
      : "  · Elite: gelin/salon isterse 21.000 (plato+kapora dahil)",
    `  · ${quote.kaporaNote}`,
    "Mesajı rakamla başlatma. Önce kısa değer, sonra fiyat. ~3 satır.",
    "YASAK: Düğün varsaymak. YASAK: İstemeden drone. YASAK: Bilgi dump. YASAK: Aynı kapanış scripti."
  );

  return parts.join("\n");
}

/** Eski test uyumu. */
export function calculateVenueQuote(facts: ConversationFacts) {
  const q = calculatePackageQuote(facts);
  const payable =
    q.payableHint ??
    (facts.prefersBasic
      ? BASIC_CINEMA_PACKAGE_TRY
      : facts.prefersElite
        ? ELITE_PREMIUM_PACKAGE_TRY
        : facts.prefersPremiumAlbum
          ? PREMIUM_ALBUM_PACKAGE_TRY
          : BASIC_CINEMA_PACKAGE_TRY);
  return {
    facts,
    serviceListTotal: payable,
    afterMultiDiscount: payable,
    multiDiscountApplied: false,
    platoMarkupApplied: facts.venueKind === "partner_plato",
    payable,
    normalde: payable,
    kapora: KAPORA_TRY,
    entranceNote: q.entranceNote,
    readyForFullPolicy: q.recommended !== "ask_first",
    lines: q.lines,
  };
}
