import { z } from "zod";
import { CUSTOMER_PROFILE_STATUS_VALUES } from "@/features/customer-intelligence/types";

export const profileDeltaSchema = z.object({
  eventType: z.string().max(80).nullable().optional(),
  eventDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  venue: z.string().max(200).nullable().optional(),
  city: z.string().max(80).nullable().optional(),
  budget: z.string().max(120).nullable().optional(),
  phone: z.string().max(40).nullable().optional(),
  phoneVerified: z.boolean().optional(),
  requestedServices: z.array(z.string().max(80)).max(20).optional(),
  objections: z.string().max(1000).nullable().optional(),
  lastSummary: z.string().max(800).nullable().optional(),
  leadScore: z.number().int().min(0).max(100).optional(),
  status: z.enum(CUSTOMER_PROFILE_STATUS_VALUES).optional(),
  bookingProbability: z.number().int().min(0).max(100).nullable().optional(),
  tags: z.array(z.string().max(40)).max(20).optional(),
  notes: z.string().max(1000).nullable().optional(),
});

export type ProfileDelta = z.infer<typeof profileDeltaSchema>;

const EVENT_TYPE_PATTERNS: Array<{ pattern: RegExp; value: string }> = [
  { pattern: /\bni[sş]an/i, value: "nişan" },
  { pattern: /\bd[uü][gğ][uü]n/i, value: "düğün" },
  { pattern: /\bk[iı]na/i, value: "kına" },
  { pattern: /\bs[oö]z(?!\w)/i, value: "söz" },
  { pattern: /\bafter\s*party\b/i, value: "after party" },
];

const SERVICE_PATTERNS: Array<{ pattern: RegExp; value: string }> = [
  { pattern: /\bdrone\b/i, value: "drone" },
  { pattern: /\balb[uü]m\b/i, value: "albüm" },
  { pattern: /\bsinematik\b/i, value: "sinematik klip" },
  { pattern: /\bklip\b/i, value: "sinematik klip" },
  { pattern: /\bfoto(?:ğraf|graf)?\b/i, value: "fotoğraf" },
  { pattern: /\bvideo\b/i, value: "video" },
];

const TURKISH_MONTHS: Record<string, number> = {
  ocak: 1,
  şubat: 2,
  subat: 2,
  mart: 3,
  nisan: 4,
  mayıs: 5,
  mayis: 5,
  haziran: 6,
  temmuz: 7,
  ağustos: 8,
  agustos: 8,
  eylül: 9,
  eylul: 9,
  ekim: 10,
  kasım: 11,
  kasim: 11,
  aralık: 12,
  aralik: 12,
};

const PHONE_CAPTURE =
  /(?:\+90[\s.-]?)?(0?5\d{2}[\s.-]?\d{3}[\s.-]?\d{2}[\s.-]?\d{2})/;

/**
 * Mesajdan deterministik alan çıkarımı (OpenAI yokken veya ön-filtre).
 */
export function extractProfileDeltaHeuristics(
  message: string,
  todayIsoDate: string
): ProfileDelta {
  const delta: ProfileDelta = {};
  const text = message.trim();
  if (!text) {
    return delta;
  }

  for (const { pattern, value } of EVENT_TYPE_PATTERNS) {
    if (pattern.test(text)) {
      delta.eventType = value;
      break;
    }
  }

  const services: string[] = [];
  for (const { pattern, value } of SERVICE_PATTERNS) {
    if (pattern.test(text) && !services.includes(value)) {
      services.push(value);
    }
  }
  if (services.length > 0) {
    delta.requestedServices = services;
  }

  const phoneMatch = PHONE_CAPTURE.exec(text.replace(/\s+/g, " "));
  if (phoneMatch?.[1]) {
    const digits = phoneMatch[1].replace(/\D/g, "");
    const normalized =
      digits.length === 10 && digits.startsWith("5")
        ? `0${digits}`
        : digits.length === 11
          ? digits
          : phoneMatch[1].trim();
    delta.phone = normalized;
    delta.phoneVerified = true;
  }

  const parsedDate = parseTurkishDateMention(text, todayIsoDate);
  if (parsedDate) {
    delta.eventDate = parsedDate;
  }

  return delta;
}

/**
 * "15 Ağustos", "15 Ağustos 2026", "15.08.2026" → YYYY-MM-DD
 * Göreceli "yarın" gibi ifadeler burada kesin tarihe çevrilmez.
 */
export function parseTurkishDateMention(
  text: string,
  todayIsoDate: string
): string | null {
  const relative = /\b(yarın|yarin|haftaya|gelecek hafta|önümüzdeki ay|onumuzdeki ay|cumartesi|pazar)\b/i;
  if (relative.test(text)) {
    return null;
  }

  const numeric = /(\d{1,2})[./](\d{1,2})[./](\d{4})/.exec(text);
  if (numeric) {
    const day = Number(numeric[1]);
    const month = Number(numeric[2]);
    const year = Number(numeric[3]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }

  const longForm =
    /(\d{1,2})\s+(ocak|şubat|subat|mart|nisan|mayıs|mayis|haziran|temmuz|ağustos|agustos|eylül|eylul|ekim|kasım|kasim|aralık|aralik)(?:\s+(\d{4}))?/i.exec(
      text
    );

  if (!longForm) {
    return null;
  }

  const day = Number(longForm[1]);
  const monthName = longForm[2].toLocaleLowerCase("tr-TR");
  const month = TURKISH_MONTHS[monthName];
  if (!month || day < 1 || day > 31) {
    return null;
  }

  const year = longForm[3]
    ? Number(longForm[3])
    : Number(todayIsoDate.slice(0, 4));

  // Ay bugünden önceyse ve yıl yoksa gelecek yıl varsay.
  if (!longForm[3]) {
    const todayMonth = Number(todayIsoDate.slice(5, 7));
    const todayDay = Number(todayIsoDate.slice(8, 10));
    if (month < todayMonth || (month === todayMonth && day < todayDay)) {
      return `${year + 1}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function mergeRequestedServices(
  current: string[],
  incoming?: string[]
): string[] {
  if (!incoming || incoming.length === 0) {
    return current;
  }

  const merged = [...current];
  for (const service of incoming) {
    const normalized = service.trim().toLocaleLowerCase("tr-TR");
    if (!normalized) {
      continue;
    }
    const exists = merged.some(
      (item) => item.toLocaleLowerCase("tr-TR") === normalized
    );
    if (!exists) {
      merged.push(service.trim());
    }
  }
  return merged;
}

/**
 * Null/undefined alanlar mevcut değeri silmez; yalnızca dolu delta uygulanır.
 */
export function mergeProfileDelta<T extends Record<string, unknown>>(
  current: T,
  delta: ProfileDelta
): Partial<T> & {
  requested_services?: string[];
  phone_verified?: boolean;
} {
  const patch: Record<string, unknown> = {};

  if (delta.eventType) {
    patch.event_type = delta.eventType;
  }
  if (delta.eventDate) {
    patch.event_date = delta.eventDate;
  }
  if (delta.venue) {
    patch.venue = delta.venue;
  }
  if (delta.city) {
    patch.city = delta.city;
  }
  if (delta.budget) {
    patch.budget = delta.budget;
  }
  if (delta.phone) {
    patch.phone = delta.phone;
  }
  if (delta.phoneVerified !== undefined) {
    patch.phone_verified = delta.phoneVerified;
  }
  if (delta.objections) {
    patch.objections = delta.objections;
  }
  if (delta.lastSummary) {
    patch.last_summary = delta.lastSummary;
  }
  if (delta.leadScore !== undefined) {
    patch.lead_score = delta.leadScore;
  }
  if (delta.status) {
    patch.status = delta.status;
  }
  if (delta.bookingProbability !== undefined) {
    patch.booking_probability = delta.bookingProbability;
  }
  if (delta.notes) {
    patch.notes = delta.notes;
  }
  if (delta.tags && delta.tags.length > 0) {
    patch.tags = delta.tags;
  }
  if (delta.requestedServices && delta.requestedServices.length > 0) {
    const currentServices = Array.isArray(current.requested_services)
      ? (current.requested_services as string[])
      : [];
    patch.requested_services = mergeRequestedServices(
      currentServices,
      delta.requestedServices
    );
  }

  return patch as Partial<T> & {
    requested_services?: string[];
    phone_verified?: boolean;
  };
}
