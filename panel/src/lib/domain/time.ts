// Saat dilimi ve tarih yardımcıları. Tarihler "YYYY-MM-DD" biçiminde
// (kafenin yerel takvim günü) taşınır; saat dilimi dönüşümleri Intl ile yapılır.

export const DEFAULT_TZ = "Europe/Istanbul";

const dtfCache = new Map<string, Intl.DateTimeFormat>();
function partsFormatter(tz: string) {
  let f = dtfCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      weekday: "short",
    });
    dtfCache.set(tz, f);
  }
  return f;
}

export interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  /** 0 = Pazartesi … 6 = Pazar */
  weekday: number;
}

const WEEKDAY_INDEX: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };

export function zonedParts(date: Date | number | string, tz: string = DEFAULT_TZ): ZonedParts {
  const d = date instanceof Date ? date : new Date(date);
  const p: Record<string, string> = {};
  for (const part of partsFormatter(tz).formatToParts(d)) p[part.type] = part.value;
  return {
    year: Number(p.year),
    month: Number(p.month),
    day: Number(p.day),
    hour: Number(p.hour),
    minute: Number(p.minute),
    second: Number(p.second),
    weekday: WEEKDAY_INDEX[p.weekday] ?? 0,
  };
}

/** Yerel saat (tz) → UTC Date */
export function zonedToUtc(
  isoDate: string,
  hour = 0,
  minute = 0,
  second = 0,
  tz: string = DEFAULT_TZ,
): Date {
  const [y, m, d] = isoDate.split("-").map(Number);
  const guess = Date.UTC(y, m - 1, d, hour, minute, second);
  const offset = offsetMinutes(guess, tz);
  let utc = guess - offset * 60_000;
  // Yaz saati geçişlerinde ikinci düzeltme
  const offset2 = offsetMinutes(utc, tz);
  if (offset2 !== offset) utc = guess - offset2 * 60_000;
  return new Date(utc);
}

function offsetMinutes(utcMs: number, tz: string) {
  const p = zonedParts(utcMs, tz);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUtc - Math.floor(utcMs / 1000) * 1000) / 60_000);
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Kafenin yerel takvimine göre bugünün tarihi (YYYY-MM-DD) */
export function todayIn(tz: string = DEFAULT_TZ, now: Date = new Date()): string {
  const p = zonedParts(now, tz);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/** Gün sınırı: 05:00'ten önceki satışlar önceki güne yazılır (gece kapanışları için) */
export const DAY_CUTOFF_HOURS = 5;

/** Kafenin iş günü (YYYY-MM-DD); gece 00:00–05:00 arası önceki gün sayılır */
export function businessToday(tz: string = DEFAULT_TZ, now: Date = new Date()): string {
  return todayIn(tz, new Date(now.getTime() - DAY_CUTOFF_HOURS * 3_600_000));
}

export function toIsoDate(date: Date | number | string, tz: string = DEFAULT_TZ): string {
  const p = zonedParts(date, tz);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

export function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** Takvim günü aritmetiği (saat diliminden bağımsız) */
export function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

export function diffDays(from: string, to: string): number {
  const [y1, m1, d1] = from.split("-").map(Number);
  const [y2, m2, d2] = to.split("-").map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000);
}

/** 0 = Pazartesi … 6 = Pazar */
export function weekdayOf(isoDate: string): number {
  const [y, m, d] = isoDate.split("-").map(Number);
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}

/** Haftanın pazartesisi (hafta pazartesi 00:00'da başlar, pazar 24:00'te biter) */
export function weekStart(isoDate: string): string {
  return addDays(isoDate, -weekdayOf(isoDate));
}

export function monthStart(isoDate: string): string {
  return `${isoDate.slice(0, 7)}-01`;
}

export function monthEnd(isoDate: string): string {
  const [y, m] = isoDate.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m, 0));
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

export function daysInMonth(isoDate: string): number {
  return Number(monthEnd(isoDate).slice(8, 10));
}

export function eachDay(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

export const WEEKDAYS_TR = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"];
export const WEEKDAYS_SHORT_TR = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];
export const MONTHS_TR = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];

/** 17 Eylül 2026 */
export function formatDateTr(isoDate: string, opts: { year?: boolean } = {}): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  return `${d} ${MONTHS_TR[m - 1]}${opts.year === false ? "" : ` ${y}`}`;
}

/** 17 Eyl */
export function formatDateShortTr(isoDate: string): string {
  const [, m, d] = isoDate.split("-").map(Number);
  return `${d} ${MONTHS_TR[m - 1].slice(0, 3)}`;
}

/** 14:05 (kafenin saat diliminde) */
export function formatTime(date: Date | string | number, tz: string = DEFAULT_TZ): string {
  const p = zonedParts(date, tz);
  return `${pad(p.hour)}:${pad(p.minute)}`;
}

/** 95 → "1 sa 35 dk" */
export function formatMinutes(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} dk`;
  if (m === 0) return `${h} sa`;
  return `${h} sa ${m} dk`;
}

export function hourLabel(hour: number): string {
  return `${pad(hour % 24)}:00`;
}

export function hourRangeLabel(hour: number): string {
  return `${pad(hour % 24)}:00–${pad((hour + 1) % 24)}:00`;
}
