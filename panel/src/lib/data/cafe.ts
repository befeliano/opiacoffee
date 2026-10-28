import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import type { CafeContext, Role } from "@/lib/api/types";
import { toAppError } from "@/lib/errors";
import { configureFormat } from "@/lib/format";
import { rpc } from "./server";

const SLUG = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/;
const RANK: Record<Role, number> = { staff: 1, manager: 2, owner: 3 };

export function hasRole(role: Role, min: Role) {
  return RANK[role] >= RANK[min];
}

/**
 * Kafe bağlamı (istek başına bir kez). Oturum yoksa girişe, yetki yoksa 404'e yönlendirir.
 * Oturum ayrıca sorgulanmaz: proxy belirteci zaten doğruladı, veritabanı da her
 * çağrıda kimliği kontrol eder (bir ağ gidiş-dönüşü tasarruf edilir).
 */
export const getCafeContext = cache(async (slug: string): Promise<CafeContext> => {
  if (!SLUG.test(slug)) notFound();
  try {
    const ctx = await rpc<CafeContext>("app_cafe_context", { p_slug: slug });
    configureFormat(ctx.cafe);
    return ctx;
  } catch (error) {
    const appError = toAppError(error);
    if (appError.code === "E_NOT_AUTHENTICATED") redirect("/giris");
    if (appError.code === "E_FORBIDDEN") notFound();
    throw appError;
  }
});

/** Sayfa için yetki şartı (rapor, menü…); yoksa masalara döner. Veritabanı ayrıca denetler. */
export async function requireCafePerm(slug: string, key: "reports" | "menu"): Promise<CafeContext> {
  const ctx = await getCafeContext(slug);
  if (!ctx.permissions[key]) redirect(`/${ctx.cafe.slug}/masalar`);
  return ctx;
}

/** Sayfa için en düşük rol şartı; yetersizse masalara döner */
export async function requireCafeRole(slug: string, min: Role): Promise<CafeContext> {
  const ctx = await getCafeContext(slug);
  if (!hasRole(ctx.role, min)) redirect(`/${ctx.cafe.slug}/masalar`);
  return ctx;
}
