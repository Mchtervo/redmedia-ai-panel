import { getTodayIsoInIstanbul } from "@/features/ai/prompts/simple-assistant";

const ISTANBUL = "Europe/Istanbul";

/** `YYYY-MM-DD` → Istanbul gün başlangıcı (UTC Date). */
export function istanbulDayStart(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00+03:00`);
}

export function istanbulDayEnd(isoDate: string): Date {
  return new Date(`${isoDate}T23:59:59.999+03:00`);
}

export function addDaysIso(isoDate: string, days: number): string {
  const d = istanbulDayStart(isoDate);
  d.setUTCDate(d.getUTCDate() + days);
  return getTodayIsoInIstanbul(d);
}

/** Bu haftanın Pazartesi–Pazar (Istanbul) aralığı. */
export function getWeekRangeIstanbul(todayIso = getTodayIsoInIstanbul()): {
  start: string;
  end: string;
  days: string[];
} {
  const startDate = istanbulDayStart(todayIso);
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: ISTANBUL,
    weekday: "short",
  }).format(startDate);
  const map: Record<string, number> = {
    Mon: 0,
    Tue: 1,
    Wed: 2,
    Thu: 3,
    Fri: 4,
    Sat: 5,
    Sun: 6,
  };
  const offset = map[weekday] ?? 0;
  const monday = addDaysIso(todayIso, -offset);
  const days: string[] = [];
  for (let i = 0; i < 7; i += 1) {
    days.push(addDaysIso(monday, i));
  }
  return { start: days[0]!, end: days[6]!, days };
}

export function getMonthRangeIstanbul(todayIso = getTodayIsoInIstanbul()): {
  start: string;
  end: string;
} {
  const [y, m] = todayIso.split("-").map(Number);
  const start = `${y}-${String(m).padStart(2, "0")}-01`;
  const nextMonth =
    m === 12
      ? `${y + 1}-01-01`
      : `${y}-${String(m + 1).padStart(2, "0")}-01`;
  const end = addDaysIso(nextMonth, -1);
  return { start, end };
}

export function formatTry(amount: number): string {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0,
  }).format(amount);
}
