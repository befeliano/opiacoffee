// Kişiye özel yetkiler. Asıl kontrol veritabanındadır (private.require_perm,
// private.can, private.figures_scope — migration 04); buradaki tanımlar
// arayüzde gereksiz düğmeleri gizlemek ve sahip sihirbazı içindir.

import type { Role } from "@/lib/api/types";

/** Ciroyu ve geçmiş günleri ne kadar görebilir */
export type FiguresScope = "none" | "today" | "two_days" | "all";

export interface Permissions {
  figures: FiguresScope;
  /** Kâr ve maliyet */
  profit: boolean;
  /** Rapor, ürün satışları, analiz */
  reports: boolean;
  /** Adisyon silme / iptal */
  void: boolean;
  /** Ödeme yöntemi değiştirme, ödemeyi geri alma, adisyonu yeniden açma */
  payments: boolean;
  /** İndirim, ikram, satır fiyatı */
  discounts: boolean;
  /** Menü, maliyet ve masa düzeni */
  menu: boolean;
}

export type PermissionKey = keyof Permissions;

const FULL: Permissions = { figures: "all", profit: true, reports: true, void: true, payments: true, discounts: true, menu: true };

/** Rolün varsayılanları (veritabanındaki private.perm_defaults ile aynı) */
export const ROLE_DEFAULTS: Record<Role, Permissions> = {
  owner: FULL,
  manager: FULL,
  staff: { figures: "two_days", profit: false, reports: false, void: true, payments: true, discounts: true, menu: false },
};

export function effectivePermissions(role: Role, custom: Partial<Permissions> | null | undefined): Permissions {
  if (role === "owner") return FULL;
  return { ...ROLE_DEFAULTS[role], ...(custom ?? {}) };
}

/** Kişiye özel kısım: rol varsayılanından farklı olan değerler */
export function customPart(role: Role, perms: Permissions): Partial<Permissions> {
  const defaults = ROLE_DEFAULTS[role];
  const out: Partial<Permissions> = {};
  for (const key of Object.keys(perms) as PermissionKey[]) {
    if (perms[key] !== defaults[key]) (out as Record<string, unknown>)[key] = perms[key];
  }
  return out;
}

/** "Barista ekle" sihirbazının soruları */
export const FIGURES_CHOICES: { value: FiguresScope; label: string; hint: string }[] = [
  { value: "none", label: "Hiç görmesin", hint: "Ciro ve günün özeti gizli; yalnızca bugünün adisyonları" },
  { value: "today", label: "Yalnızca bugünü", hint: "Bugünün cirosu ve adisyonları" },
  { value: "two_days", label: "Bugün ve dün", hint: "Son 2 günün cirosu ve adisyonları" },
  { value: "all", label: "Tüm zamanlar", hint: "Geçmişteki bütün günler" },
];

export const YES_NO_QUESTIONS: { key: Exclude<PermissionKey, "figures">; question: string; hint: string }[] = [
  { key: "profit", question: "Kâr ve maliyeti görsün mü?", hint: "Günün kârı, raporlarda maliyet ve marj" },
  { key: "reports", question: "Raporlara girebilsin mi?", hint: "Raporlar, ürün satışları, analiz ve tahmin" },
  { key: "void", question: "Adisyon silebilsin / iptal edebilsin mi?", hint: "Yanlış açılan ya da vazgeçilen adisyonlar" },
  { key: "payments", question: "Ödeme yöntemini değiştirebilsin mi?", hint: "Nakit ↔ kart düzeltme, ödemeyi geri alma" },
  { key: "discounts", question: "İndirim ve ikram yapabilsin mi?", hint: "Ürüne ya da hesaba indirim, ikram, farklı fiyat" },
  { key: "menu", question: "Menüyü düzenleyebilsin mi?", hint: "Ürün, fiyat, reçete, maliyet ve masa düzeni" },
];

export function figuresLabel(scope: FiguresScope): string {
  return FIGURES_CHOICES.find((c) => c.value === scope)?.label ?? scope;
}
