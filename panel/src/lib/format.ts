// Sayı ve para biçimlendirme. Para birimi ve dil kafenin ayarından gelir:
// sunucuda getCafeContext, tarayıcıda <FormatConfig> configureFormat çağırır.
// (Her kurulum tek kafe olduğu için modül düzeyinde tutulması yeterlidir.)

export const CURRENCIES: { code: string; symbol: string; label: string }[] = [
  { code: "TRY", symbol: "₺", label: "Türk lirası (₺)" },
  { code: "EUR", symbol: "€", label: "Euro (€)" },
  { code: "USD", symbol: "$", label: "ABD doları ($)" },
  { code: "GBP", symbol: "£", label: "İngiliz sterlini (£)" },
];

export type Language = "tr" | "en";

let config = { currency: "TRY", symbol: "₺", language: "tr" as Language, locale: "tr-TR" };
let whole = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 });
let two = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
let upTo2 = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 2 });
let upTo1 = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 1 });

/** Kafenin para birimini ve dilini uygular (aynıysa bir şey yapmaz) */
export function configureFormat(opts: { currency?: string | null; language?: string | null }) {
  const currency = opts.currency && /^[A-Z]{3}$/.test(opts.currency) ? opts.currency : "TRY";
  const language: Language = opts.language === "en" ? "en" : "tr";
  if (currency === config.currency && language === config.language) return;
  const locale = language === "en" ? "en-GB" : "tr-TR";
  const symbol = CURRENCIES.find((c) => c.code === currency)?.symbol ?? currency;
  if (locale !== config.locale) {
    whole = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
    two = new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    upTo2 = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });
    upTo1 = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  }
  config = { currency, symbol, language, locale };
}

/** Geçerli para birimi, simge, dil ve yerel ayar */
export function formatSettings() {
  return config;
}

/** Para birimi simgesi (giriş kutularının sonundaki ek için) */
export function currencySymbol(): string {
  return config.symbol;
}

/** İngilizcede $ / £ / € başa yazılır ($12.50); Türkçede ve TL'de sona (12,50 ₺) */
function withSymbol(text: string): string {
  if (config.language === "en" && config.currency !== "TRY") {
    return text.startsWith("-") ? `-${config.symbol}${text.slice(1)}` : `${config.symbol}${text}`;
  }
  return `${text} ${config.symbol}`;
}

/** Para: 190 → "190 ₺", 17.1 → "17,10 ₺", 1234.5 → "1.234,50 ₺" (adı tarihsel) */
export function tl(value: number | null | undefined, opts: { decimals?: "auto" | "always" | "never" } = {}): string {
  const n = Number(value ?? 0);
  const mode = opts.decimals ?? "auto";
  const rounded = Math.round(n * 100) / 100;
  if (mode === "never") return withSymbol(whole.format(Math.round(rounded)));
  if (mode === "always") return withSymbol(two.format(rounded));
  return withSymbol(Number.isInteger(rounded) ? whole.format(rounded) : two.format(rounded));
}

export const money = tl;

/** Büyük tutarları kısaltır: 12.450 → "12,5 B ₺" */
export function tlCompact(value: number): string {
  const n = Math.abs(value);
  const [thousand, million] = config.language === "en" ? ["K", "M"] : [" B", " Mn"];
  if (n >= 1_000_000) return withSymbol(`${upTo1.format(value / 1_000_000)}${million}`);
  if (n >= 10_000) return withSymbol(`${upTo1.format(value / 1_000)}${thousand}`);
  return tl(value, { decimals: "never" });
}

export function num(value: number | null | undefined, maxDecimals = 2): string {
  const n = Number(value ?? 0);
  if (maxDecimals === 0) return whole.format(n);
  if (maxDecimals === 1) return upTo1.format(n);
  return upTo2.format(n);
}

/** 0.034 → "%3,4" (İngilizcede "3.4%") */
export function pct(ratio: number | null | undefined, decimals = 1): string {
  if (ratio === null || ratio === undefined || !Number.isFinite(ratio)) return "—";
  const f = new Intl.NumberFormat(config.locale, { maximumFractionDigits: decimals, minimumFractionDigits: 0 });
  return config.language === "en" ? `${f.format(ratio * 100)}%` : `%${f.format(ratio * 100)}`;
}

/** Kullanıcı girişini sayıya çevirir: "1.234,5" · "1234.5" · "12,5" */
export function parseDecimal(input: string | number | null | undefined): number | null {
  if (input === null || input === undefined) return null;
  if (typeof input === "number") return Number.isFinite(input) ? input : null;
  let s = input.trim().replace(/\s|₺|TL|[$€£]/gi, "");
  if (!s) return null;
  if (config.language === "en" && s.includes(",") && (s.includes(".") || !/,\d{1,2}$/.test(s))) {
    // İngilizcede virgül binlik ayracıdır: "1,234.5" · "1,234"
    s = s.replace(/,/g, "");
  } else if (s.includes(",")) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else if ((s.match(/\./g) ?? []).length > 1) {
    s = s.replace(/\./g, "");
  }
  if (!/^-?\d*(\.\d*)?$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Sayı girdisi için değer gösterimi: 12.5 → "12,5" */
export function decimalInput(value: number | null | undefined, maxDecimals = 2): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "";
  return new Intl.NumberFormat(config.locale, { maximumFractionDigits: maxDecimals, useGrouping: false }).format(value);
}

export function unitLabel(unit: "g" | "ml" | "adet"): string {
  return unit === "adet" ? "adet" : unit;
}

/** Hammadde birim maliyeti: gram/ml için 1 kg / 1 L karşılığıyla birlikte */
export function unitCostLabel(unitCost: number, unit: "g" | "ml" | "adet"): string {
  if (unit === "adet") return `${tl(unitCost, { decimals: "always" })} / adet`;
  const perK = unitCost * 1000;
  return `${tl(perK, { decimals: "auto" })} / ${unit === "g" ? "kg" : "L"}`;
}

/** Büyük harfle yazılan özel adlar için dil (Türkçe harf yoksa "en": "Opia" → "OPIA", "OPİA" değil) */
export const nameLang = (name: string) => (/[çğıöşüÇĞİÖŞÜ]/.test(name) ? "tr" : "en");
