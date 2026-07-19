/**
 * Gerçek DM otomatik etiketleme (heuristic — LLM zorunlu değil).
 */

export type RealDmTag =
  | "reservation"
  | "deposit"
  | "customer_lost"
  | "ongoing"
  | "price_objection"
  | "trust_issue"
  | "ask_spouse"
  | "competitor"
  | "no_reply"
  | "misunderstanding"
  | "too_long_reply"
  | "oversell_pressure";

export type RealDmTagResult = {
  tags: RealDmTag[];
  primaryLossReason: string | null;
  statusLabel: string;
  packageLean: "basic" | "premium_album" | "elite" | null;
  customerTypeGuess: string | null;
};

export function tagRealDmConversation(params: {
  messages: { sender_type: string; content: string | null; created_at: string }[];
  hasReservation: boolean;
  hasDeposit: boolean;
  conversationStatus: string;
}): RealDmTagResult {
  const tags = new Set<RealDmTag>();
  const joined = params.messages.map((m) => m.content ?? "").join("\n");
  const customerText = params.messages
    .filter((m) => m.sender_type === "customer")
    .map((m) => m.content ?? "")
    .join("\n");
  const outbound = params.messages.filter(
    (m) => m.sender_type === "staff" || m.sender_type === "ai"
  );

  if (params.hasReservation) tags.add("reservation");
  if (params.hasDeposit) tags.add("deposit");

  if (/pahalı|bütçe|indirim|çok yüksek|düşer misiniz|ucuza/i.test(customerText)) {
    tags.add("price_objection");
  }
  if (/güven|emin değil|korkuyorum|sahte|dolandır|inanmıyorum/i.test(customerText)) {
    tags.add("trust_issue");
  }
  if (/eşime|eşimle|nişanlıma|partnerime|soracağım|danışacağım/i.test(customerText)) {
    tags.add("ask_spouse");
  }
  if (/başka\s*yer|rakip|daha\s*ucuz|öteki\s*firma|şurada\s*\d/i.test(customerText)) {
    tags.add("competitor");
  }
  if (/anlamadım|demek\s*istediğim|yanlış\s*anla|kastettiğim/i.test(joined)) {
    tags.add("misunderstanding");
  }

  const longOutbound = outbound.filter((m) => (m.content ?? "").length > 320);
  if (longOutbound.length >= 2) tags.add("too_long_reply");

  if (
    /hemen|son\s*kontenjan|kaçırma|bugün\s*karar|acil\s*kapora|mutlaka\s*al/i.test(
      outbound.map((m) => m.content ?? "").join("\n")
    )
  ) {
    tags.add("oversell_pressure");
  }

  const lastCustomer = [...params.messages]
    .reverse()
    .find((m) => m.sender_type === "customer");
  const lastOutbound = [...params.messages]
    .reverse()
    .find((m) => m.sender_type === "staff" || m.sender_type === "ai");

  if (
    lastOutbound &&
    lastCustomer &&
    new Date(lastOutbound.created_at) > new Date(lastCustomer.created_at) &&
    !params.hasReservation
  ) {
    // Son mesaj bizden — müşteri cevap vermedi olabilir
    const hours =
      (Date.now() - new Date(lastOutbound.created_at).getTime()) / 3600000;
    if (hours > 48) tags.add("no_reply");
  }

  if (params.hasReservation) {
    // won
  } else if (
    params.conversationStatus === "closed" ||
    tags.has("no_reply") ||
    tags.has("price_objection") ||
    tags.has("competitor")
  ) {
    if (!tags.has("reservation")) tags.add("customer_lost");
  } else {
    tags.add("ongoing");
  }

  let packageLean: RealDmTagResult["packageLean"] = null;
  if (/21\.?000|elite/i.test(joined)) packageLean = "elite";
  else if (/14\.?000|premium\s*albüm|premium\s*album/i.test(joined))
    packageLean = "premium_album";
  else if (/11\.?000|basic/i.test(joined)) packageLean = "basic";

  let customerTypeGuess: string | null = null;
  if (tags.has("price_objection") || tags.has("competitor"))
    customerTypeGuess = "price_focused";
  else if (tags.has("ask_spouse")) customerTypeGuess = "spouse_decider";
  else if (/kalite|örnek|referans|portföy/i.test(customerText))
    customerTypeGuess = "quality_focused";
  else if (/bilgi|paket\s*neler|ne\s*var/i.test(customerText))
    customerTypeGuess = "info_gatherer";

  let primaryLossReason: string | null = null;
  if (tags.has("customer_lost")) {
    if (tags.has("price_objection")) primaryLossReason = "price";
    else if (tags.has("trust_issue")) primaryLossReason = "trust";
    else if (tags.has("competitor")) primaryLossReason = "competitor";
    else if (tags.has("too_long_reply")) primaryLossReason = "too_long";
    else if (tags.has("oversell_pressure")) primaryLossReason = "oversell";
    else if (tags.has("misunderstanding")) primaryLossReason = "misunderstood";
    else if (tags.has("no_reply")) primaryLossReason = "no_reply";
    else if (tags.has("ask_spouse")) primaryLossReason = "ask_spouse";
    else primaryLossReason = "unknown";
  }

  const statusLabel = tags.has("reservation")
    ? "Rezervasyon"
    : tags.has("deposit")
      ? "Kapora"
      : tags.has("ongoing")
        ? "Devam ediyor"
        : tags.has("customer_lost")
          ? "Kayıp"
          : "Bilinmiyor";

  return {
    tags: [...tags],
    primaryLossReason,
    statusLabel,
    packageLean,
    customerTypeGuess,
  };
}

/** Ortalama cevap süresi (msn → sn): müşteri → ilk outbound. */
export function computeAvgReplySeconds(
  messages: { sender_type: string; created_at: string }[]
): number | null {
  const deltas: number[] = [];
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i]!;
    if (m.sender_type !== "customer") continue;
    const next = messages
      .slice(i + 1)
      .find((x) => x.sender_type === "staff" || x.sender_type === "ai");
    if (!next) continue;
    const d =
      new Date(next.created_at).getTime() - new Date(m.created_at).getTime();
    if (d > 0 && d < 7 * 24 * 3600000) deltas.push(d / 1000);
  }
  if (deltas.length === 0) return null;
  return Math.round(deltas.reduce((a, b) => a + b, 0) / deltas.length);
}
