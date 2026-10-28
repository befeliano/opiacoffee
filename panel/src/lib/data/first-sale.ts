import "server-only";
import type { DailyRow } from "@/lib/api/types";
import { addDays } from "@/lib/domain/time";
import { rpc } from "./server";

/** Rapor fonksiyonları en fazla bu kadar günlük aralık kabul eder */
export const MAX_RANGE_DAYS = 400;

/**
 * "Tüm zamanlar" için başlangıç: ilk satışın yapıldığı iş günü (son 400 gün
 * içinde). Hiç satış yoksa bugün.
 */
export async function firstSaleDate(cafeId: string, today: string): Promise<string> {
  const series = await rpc<{ daily: DailyRow[] }>("report_series", {
    p_cafe: cafeId,
    p_from: addDays(today, -MAX_RANGE_DAYS),
    p_to: today,
  });
  const first = series.daily
    .filter((d) => d.orders > 0)
    .map((d) => d.date)
    .sort()[0];
  return first ?? today;
}
