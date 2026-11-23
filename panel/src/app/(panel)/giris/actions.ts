"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { DEMO_MODE } from "@/config";
import { changeOwnPassword, signIn, signOut } from "@/lib/data/server";
import { DEMO_LOGINS, TEAM } from "@/lib/seed/team";
import { toAppError } from "@/lib/errors";

export interface LoginState {
  error?: string;
  email?: string;
}

const schema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(128),
  next: z.string().max(512).optional(),
});

/** Yalnızca uygulama içi göreli yollara yönlendir (açık yönlendirme koruması) */
function safeNext(next: string | undefined) {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/";
  if (next.startsWith("/giris")) return "/";
  return next;
}

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = schema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next") || undefined,
  });
  const email = String(formData.get("email") ?? "").slice(0, 254);
  if (!parsed.success) return { error: "E-posta ve şifreyi kontrol et.", email };

  const h = await headers();
  const clientKey = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";

  try {
    await signIn(parsed.data.email, parsed.data.password, clientKey);
  } catch (error) {
    return { error: toAppError(error).message, email };
  }
  redirect(safeNext(parsed.data.next));
}

/** Demo modunda hazır hesaplardan biriyle giriş (yalnızca DEMO_LOGINS listesindekiler) */
export async function demoLoginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  if (!DEMO_MODE) return { error: "Demo girişi kapalı." };
  const key = String(formData.get("account") ?? "");
  const member = DEMO_LOGINS.some((d) => d.key === key) ? TEAM.find((m) => m.key === key) : undefined;
  if (!member) return { error: "Demo hesabı bulunamadı." };
  const next = String(formData.get("next") ?? "") || undefined;

  const h = await headers();
  const clientKey = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
  try {
    await signIn(member.email, member.password, clientKey);
  } catch (error) {
    return { error: toAppError(error).message };
  }
  redirect(safeNext(next));
}

export async function logoutAction() {
  await signOut();
  redirect("/giris");
}

const newPassword = z
  .string()
  .min(6)
  .max(72)
  .refine((v) => /[a-zA-ZçğıöşüÇĞİÖŞÜ]/.test(v) && /\d/.test(v));

/** Hesap menüsünden: kendi şifreni değiştir */
export async function changeOwnPasswordAction(current: string, next: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = newPassword.safeParse(next);
  if (!parsed.success) return { ok: false, error: "Yeni şifre en az 6 karakter olmalı, harf ve rakam içermeli." };
  if (typeof current !== "string" || !current || current.length > 128) return { ok: false, error: "Mevcut şifreni yaz." };
  const h = await headers();
  const clientKey = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
  try {
    await changeOwnPassword(current, parsed.data, clientKey);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: toAppError(error).message };
  }
}
