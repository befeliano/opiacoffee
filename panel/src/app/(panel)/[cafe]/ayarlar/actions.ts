"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { DEMO_MODE } from "@/config";
import type { CafeContext, FloorData, TeamMember } from "@/lib/api/types";
import type { Permissions } from "@/lib/permissions";
import { generateDemoData } from "@/lib/seed/refresh";
import { ensureAuthUser, rpc, setAuthUserPassword } from "@/lib/data/server";
import { AppError, fail, type ActionResult } from "@/lib/errors";

const id = z.uuid();
const role = z.enum(["owner", "manager", "staff"]);
// Supabase Auth yapılandırmasıyla aynı kural: en az 6 karakter, harf ve rakam
const password = z
  .string()
  .min(6, "Şifre en az 6 karakter olmalı")
  .max(72)
  .refine((v) => /[a-zA-ZçğıöşüÇĞİÖŞÜ]/.test(v) && /\d/.test(v), "Şifre harf ve rakam içermeli");

async function run<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    refresh();
    return { ok: true, data };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { ok: false, error: error.issues[0]?.message ?? "Girilen bilgiler geçersiz.", code: "E_INVALID_INPUT" };
    }
    return fail(error);
  }
}

// Kişiye özel yetkiler (yalnızca rol varsayılanından farklı olanlar gönderilir)
const permissions = z
  .object({
    figures: z.enum(["none", "today", "two_days", "all"]).optional(),
    profit: z.boolean().optional(),
    reports: z.boolean().optional(),
    void: z.boolean().optional(),
    payments: z.boolean().optional(),
    discounts: z.boolean().optional(),
    menu: z.boolean().optional(),
  })
  .strict();

const percent = (max: number) => z.number().min(0).max(max);
const toRate = (p: number) => Math.round(p * 100) / 10000;

/** Kafe ayarları: gönderilmeyen alan değişmez (profil ve çalışma düzeni ayrı kaydedilir) */
export async function updateCafeSettingsAction(
  cafeId: string,
  input: {
    name?: string;
    theme?: string;
    currency?: string;
    language?: "tr" | "en";
    commissionPercent?: number;
    ticketPercent?: number;
    vatPercent?: number;
    openHour?: number;
    closeHour?: number;
    timezone?: string;
    cashCount?: boolean;
  },
) {
  return run(async () => {
    const data = z
      .object({
        name: z.string().trim().min(1, "Kafe adı boş olamaz").max(80).optional(),
        theme: z.enum(["coffee", "forest", "ocean", "berry", "slate", "sunset"]).optional(),
        currency: z.string().regex(/^[A-Z]{3}$/).optional(),
        language: z.enum(["tr", "en"]).optional(),
        commissionPercent: percent(20).optional(),
        vatPercent: percent(50).optional(),
        ticketPercent: percent(30).optional(),
        openHour: z.int().min(0).max(23).optional(),
        closeHour: z.int().min(1).max(24).optional(),
        timezone: z.string().min(1).max(64).optional(),
        cashCount: z.boolean().optional(),
      })
      .refine((v) => v.openHour === undefined || v.closeHour === undefined || v.closeHour > v.openHour, "Kapanış saati açılıştan sonra olmalı")
      .parse(input);
    const settings: Record<string, unknown> = {
      name: data.name,
      theme: data.theme,
      currency: data.currency,
      language: data.language,
      card_commission_rate: data.commissionPercent === undefined ? undefined : toRate(data.commissionPercent),
      vat_rate: data.vatPercent === undefined ? undefined : toRate(data.vatPercent),
      ticket_commission_rate: data.ticketPercent === undefined ? undefined : toRate(data.ticketPercent),
      open_hour: data.openHour,
      close_hour: data.closeHour,
      timezone: data.timezone,
      cash_count: data.cashCount,
    };
    for (const key of Object.keys(settings)) if (settings[key] === undefined) delete settings[key];
    await rpc<void>("cafe_update_settings", { p_cafe: id.parse(cafeId), p_settings: settings });
  });
}

/** Kafe logosu: tarayıcıda küçültülmüş resim (data: URL, en çok ~200 KB); boş = kaldır */
export async function setLogoAction(cafeId: string, logo: string | null) {
  return run(async () => {
    const value = z
      .string()
      .max(200_000, "Logo çok büyük; daha küçük bir resim seç")
      .regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/, "Logo PNG, JPEG ya da WebP olmalı")
      .nullable()
      .parse(logo);
    await rpc<void>("cafe_set_logo", { p_cafe: id.parse(cafeId), p_logo: value });
  });
}

export async function addMemberAction(
  cafeId: string,
  input: { email: string; displayName: string; role: "owner" | "manager" | "staff"; password: string; permissions?: Partial<Permissions> },
) {
  return run(async () => {
    const cafe = id.parse(cafeId);
    const data = z
      .object({
        email: z.string().trim().toLowerCase().email("Geçerli bir e-posta gir").max(254),
        displayName: z.string().trim().max(60),
        role,
        password: z.union([z.literal(""), password]),
        permissions: permissions.optional(),
      })
      .parse(input);

    // Önce sahiplik doğrulanır (sahip değilse E_FORBIDDEN fırlatır)
    await rpc<TeamMember[]>("team_list", { p_cafe: cafe });

    if (data.password) {
      await ensureAuthUser(data.email, data.password);
    }
    try {
      const added = await rpc<{ user_id: string }>("team_add_member", {
        p_cafe: cafe,
        p_email: data.email,
        p_role: data.role,
        p_display_name: data.displayName,
      });
      if (data.role !== "owner" && data.permissions && Object.keys(data.permissions).length > 0) {
        await rpc<void>("team_set_permissions", { p_cafe: cafe, p_user: added.user_id, p_permissions: data.permissions });
      }
      return added;
    } catch (error) {
      if (error instanceof AppError && error.code === "E_USER_NOT_FOUND") {
        throw new AppError("E_USER_NOT_FOUND", "Bu e-postayla hesap yok. Şifre belirleyerek yeni hesap oluşturabilirsin.");
      }
      throw error;
    }
  });
}

export async function updateMemberAction(
  cafeId: string,
  userId: string,
  input: { role: "owner" | "manager" | "staff"; displayName: string; permissions?: Partial<Permissions> },
) {
  return run(async () => {
    const data = z.object({ role, displayName: z.string().trim().max(60), permissions: permissions.optional() }).parse(input);
    const cafe = id.parse(cafeId);
    const user = id.parse(userId);
    await rpc<void>("team_update_member", { p_cafe: cafe, p_user: user, p_role: data.role, p_display_name: data.displayName });
    // Yetkiler: gönderilen nesne kişiye özel değerlerin tamamı (boş = rol varsayılanı)
    if (data.role !== "owner" && data.permissions) {
      await rpc<void>("team_set_permissions", { p_cafe: cafe, p_user: user, p_permissions: data.permissions });
    }
  });
}

export async function removeMemberAction(cafeId: string, userId: string) {
  return run(() => rpc<void>("team_remove_member", { p_cafe: id.parse(cafeId), p_user: id.parse(userId) }));
}

/** Tanıtım için yüklenen örnek satış ve giderleri siler (yalnızca kafe sahibi) */
export async function purgeDemoDataAction(cafeId: string) {
  return run(() => rpc<{ orders: number; expenses: number }>("demo_purge", { p_cafe: id.parse(cafeId) }));
}

/**
 * Test verisini bugüne göre yeniler (yalnızca demo modunda, yalnızca sahip):
 * eski test verisi silinir, son 60 gün + bugün şu ana kadarki satışlar ve
 * şu an dolu masalar yeniden üretilir. Gerçek satışlara dokunulmaz.
 */
export async function refreshDemoDataAction(slug: string) {
  return run(async () => {
    if (!DEMO_MODE) throw new AppError("E_FORBIDDEN");
    const ctx = await rpc<CafeContext>("app_cafe_context", { p_slug: z.string().max(40).parse(slug) });
    // demo_purge yalnızca sahibe açıktır; yetki burada veritabanında doğrulanır
    await rpc<{ orders: number; expenses: number }>("demo_purge", { p_cafe: ctx.cafe.id });
    const floor = await rpc<FloorData>("pos_floor", { p_cafe: ctx.cafe.id });
    return generateDemoData(ctx.cafe, { busyTableIds: floor.tables.filter((t) => t.order).map((t) => t.id) });
  });
}

export async function resetPasswordAction(cafeId: string, userId: string, newPassword: string) {
  return run(async () => {
    const cafe = id.parse(cafeId);
    const user = id.parse(userId);
    const pw = password.parse(newPassword);
    // Sahip yalnızca kendi kafesinin üyelerinin şifresini değiştirebilir
    const members = await rpc<TeamMember[]>("team_list", { p_cafe: cafe });
    if (!members.some((m) => m.user_id === user)) throw new AppError("E_FORBIDDEN");
    await setAuthUserPassword(user, pw);
  });
}
