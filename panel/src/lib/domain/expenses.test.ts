import { describe, expect, it } from "vitest";
import type { Expense } from "@/lib/api/types";
import { expensesForRange } from "./expenses";

const exp = (over: Partial<Expense>): Expense => ({
  id: over.name ?? "x",
  kind: "monthly",
  category: "kira",
  name: "x",
  amount: 0,
  starts_on: "2026-09-01",
  ends_on: null,
  note: "",
  ...over,
});

describe("tüm zamanlar giderleri", () => {
  it("aylık gider kapsanan her ay için bir kez, tek seferlik kendi ayında sayılır", () => {
    const list = [
      exp({ name: "Kira", amount: 30000 }),
      exp({ name: "Fatura", amount: 5000, starts_on: "2026-10-01" }),
      exp({ name: "Eski", amount: 999, starts_on: "2026-01-01", ends_on: "2026-08-31" }),
      exp({ name: "Tamir", kind: "one_time", amount: 2000, starts_on: "2026-09-25" }),
      exp({ name: "Gelecek", kind: "one_time", amount: 700, starts_on: "2026-11-05" }),
    ];
    // 19 Eylül → 13 Ekim: Eylül + Ekim
    const r = expensesForRange(list, "2026-09-19", "2026-10-13");
    expect(r.months).toBe(2);
    expect(r.days).toBe(30 + 31);
    expect(r.monthly.map((e) => [e.name, e.amount, e.months])).toEqual([
      ["Kira", 60000, 2],
      ["Fatura", 5000, 1],
    ]);
    expect(r.oneTime.map((e) => e.name)).toEqual(["Tamir"]);
    expect(r.total).toBe(60000 + 5000 + 2000);
  });

  it("özel aralıkta aylık gider gün payı kadar, tek seferlik yalnızca aralık içindeyse sayılır", () => {
    const list = [
      exp({ name: "Kira", amount: 31000 }),
      exp({ name: "Tamir", kind: "one_time", amount: 2000, starts_on: "2026-10-03" }),
      exp({ name: "Dışarıda", kind: "one_time", amount: 900, starts_on: "2026-10-20" }),
    ];
    // 1–5 Ekim: Ekim 31 gün → kiranın 5/31'i
    const r = expensesForRange(list, "2026-10-01", "2026-10-05", { prorate: true });
    expect(r.days).toBe(5);
    expect(r.monthly[0].amount).toBe(5000);
    expect(r.oneTime.map((e) => e.name)).toEqual(["Tamir"]);
    expect(r.total).toBe(7000);
  });
});
