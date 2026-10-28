import type { Expense, ExpenseCategory } from "@/lib/api/types";
import { addDays, daysInMonth, diffDays, monthEnd, monthStart } from "./time";

export const EXPENSE_CATEGORIES: Record<ExpenseCategory, string> = {
  kira: "Kira",
  fatura: "Faturalar",
  personel: "Personel / maaş",
  banka: "Banka / kredi",
  vergi: "Vergi / muhasebe",
  ekipman: "Ekipman / bakım",
  pazarlama: "Pazarlama",
  diger: "Diğer",
};

/** Seçilen ayda geçerli giderler (aylık tekrar edenler + o aydaki tek seferlikler) */
export function expensesForMonth(expenses: Expense[], anyDateInMonth: string) {
  const start = monthStart(anyDateInMonth);
  const end = monthEnd(anyDateInMonth);
  const monthly = expenses.filter((e) => e.kind === "monthly" && e.starts_on <= end && (!e.ends_on || e.ends_on >= start));
  const oneTime = expenses.filter((e) => e.kind === "one_time" && e.starts_on >= start && e.starts_on <= end);
  const monthlyTotal = monthly.reduce((s, e) => s + e.amount, 0);
  const oneTimeTotal = oneTime.reduce((s, e) => s + e.amount, 0);
  return { monthly, oneTime, monthlyTotal, oneTimeTotal, total: monthlyTotal + oneTimeTotal };
}

/**
 * Bir tarih aralığına düşen giderler.
 *  - Tam ay (varsayılan, "Tüm zamanlar"): aylık gider kapsanan her ay için bir
 *    kez sayılır (tutar × ay); tek seferlikler o aylardaki kayıtlar.
 *    `days`: kapsanan ayların toplam gün sayısı.
 *  - `prorate` (özel aralık): aylık gider, aralığın o aya düşen gün payı kadar
 *    sayılır (31 günlük ayın 5 günü → 5/31); tek seferlikler yalnızca aralık
 *    içindeki tarihlerde. `days`: aralığın gün sayısı.
 */
export function expensesForRange(expenses: Expense[], from: string, to: string, opts: { prorate?: boolean } = {}) {
  const months: string[] = [];
  for (let m = monthStart(from); m <= to; m = addDays(monthEnd(m), 1)) months.push(m);

  const counts = new Map<string, { expense: Expense; months: number }>();
  const oneTime: Expense[] = [];
  for (const m of months) {
    const pm = expensesForMonth(expenses, m);
    const overlap = diffDays(from > m ? from : m, to < monthEnd(m) ? to : monthEnd(m)) + 1;
    const share = opts.prorate ? overlap / daysInMonth(m) : 1;
    for (const e of pm.monthly) {
      const current = counts.get(e.id);
      if (current) current.months += share;
      else counts.set(e.id, { expense: e, months: share });
    }
    oneTime.push(...(opts.prorate ? pm.oneTime.filter((e) => e.starts_on >= from && e.starts_on <= to) : pm.oneTime));
  }
  const monthly = [...counts.values()].map(({ expense, months: n }) => ({ ...expense, amount: Math.round(expense.amount * n * 100) / 100, months: n }));
  const monthlyTotal = monthly.reduce((s, e) => s + e.amount, 0);
  const oneTimeTotal = oneTime.reduce((s, e) => s + e.amount, 0);
  const days = opts.prorate ? diffDays(from, to) + 1 : months.reduce((s, m) => s + daysInMonth(m), 0);
  return { monthly, oneTime, monthlyTotal, oneTimeTotal, total: monthlyTotal + oneTimeTotal, months: months.length, days };
}
