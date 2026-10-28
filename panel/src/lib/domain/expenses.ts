import type { Expense, ExpenseCategory } from "@/lib/api/types";
import { monthEnd, monthStart } from "./time";

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
