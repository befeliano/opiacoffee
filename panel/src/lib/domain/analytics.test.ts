import { describe, expect, it } from "vitest";
import type { DailyRow } from "@/lib/api/types";
import { confidenceOf, fitSeries, forecastSeries, productDemand, projectMonth } from "./forecast";
import { engineerMenu } from "./menu-engineering";
import { change, hourlySummary, totalsOf } from "./report";
import { addDays, monthEnd, weekStart, weekdayOf, zonedToUtc, todayIn } from "./time";

const row = (date: string, revenue: number, orders = Math.round(revenue / 250)): DailyRow => ({
  date,
  orders,
  revenue,
  cost: revenue * 0.3,
  commission: revenue * 0.7 * 0.03,
  card: revenue * 0.7,
  cash: revenue * 0.3,
  discount: 0,
  comp_value: 0,
  items: orders * 2,
  table_sessions: orders,
  occupancy_minutes: orders * 45,
  takeaway_orders: 0,
  cancelled: 0,
});

describe("zaman yardımcıları", () => {
  it("haftayı pazartesi başlatır", () => {
    expect(weekdayOf("2026-09-14")).toBe(0); // Pazartesi
    expect(weekdayOf("2026-09-20")).toBe(6); // Pazar
    expect(weekStart("2026-09-17")).toBe("2026-09-14");
    expect(weekStart("2026-09-20")).toBe("2026-09-14");
    expect(weekStart("2026-09-21")).toBe("2026-09-21");
  });

  it("İstanbul saatini UTC'ye çevirir ve günü doğru hesaplar", () => {
    expect(zonedToUtc("2026-09-17", 0, 0, 0, "Europe/Istanbul").toISOString()).toBe("2026-09-16T21:00:00.000Z");
    expect(todayIn("Europe/Istanbul", new Date("2026-09-17T21:30:00Z"))).toBe("2026-09-18");
    expect(monthEnd("2026-02-10")).toBe("2026-02-28");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });
});

describe("rapor metrikleri", () => {
  it("toplamlar ve ortalama sepet", () => {
    const t = totalsOf([row("2026-09-14", 10000, 40), row("2026-09-15", 5000, 20)]);
    expect(t.revenue).toBe(15000);
    expect(t.orders).toBe(60);
    expect(t.avgBasket).toBe(250);
    expect(t.avgOccupancy).toBe(45);
    expect(change(120, 100)).toBeCloseTo(0.2);
    expect(change(5, 0)).toBeNull();
  });

  it("saatleri en yoğun / orta / en sakin olarak etiketler (sipariş olmayan saat dahil)", () => {
    const rows = [
      { date: "2026-09-17", hour: 10, rounds: 2, items: 3, revenue: 500 },
      { date: "2026-09-17", hour: 11, rounds: 5, items: 9, revenue: 1500 },
      { date: "2026-09-17", hour: 12, rounds: 9, items: 20, revenue: 3000 },
      { date: "2026-09-17", hour: 14, rounds: 4, items: 6, revenue: 900 },
    ];
    const s = hourlySummary(rows, 10, 15, 1);
    expect(s.hours.map((h) => h.hour)).toEqual([10, 11, 12, 13, 14]);
    expect(s.busiest?.hour).toBe(12);
    expect(s.calmest?.hour).toBe(13); // hiç sipariş yok
    expect(s.hours.find((h) => h.hour === 12)?.tier).toBe("busy");
    expect(s.hours.find((h) => h.hour === 13)?.tier).toBe("calm");
  });
});

describe("tahmin motoru", () => {
  // Hafta sonu yüksek, hafif artan sentetik seri
  const factors = [0.8, 0.85, 0.9, 0.95, 1.1, 1.4, 1.3];
  const start = "2026-06-01"; // Pazartesi
  const series = Array.from({ length: 70 }, (_, i) => {
    const date = addDays(start, i);
    return { date, value: 12000 * factors[weekdayOf(date)] * (1 + i * 0.002) };
  });

  it("haftalık deseni öğrenir ve yakın gelecekte düşük hata verir", () => {
    const model = fitSeries(series)!;
    expect(model).not.toBeNull();
    expect(model.weekdayIndex[5]).toBeGreaterThan(model.weekdayIndex[0]); // Cumartesi > Pazartesi
    const fc = forecastSeries(model, series[series.length - 1].date, 7);
    const expectedSat = 12000 * 1.4 * (1 + 75 * 0.002);
    const sat = fc.find((p) => weekdayOf(p.date) === 5)!;
    expect(Math.abs(sat.value - expectedSat) / expectedSat).toBeLessThan(0.08);
    expect(sat.low).toBeLessThan(sat.value);
    expect(confidenceOf(model)).toBe("high");
  });

  it("yetersiz veride model kurmaz", () => {
    expect(fitSeries(series.slice(0, 5))).toBeNull();
  });

  it("ay sonu projeksiyonu ve başabaş cirosu", () => {
    const daily = series.map((s) => row(s.date, s.value));
    const model = fitSeries(series.map((s) => ({ ...s })))!;
    const p = projectMonth({
      today: "2026-08-09",
      monthStart: "2026-08-01",
      monthEnd: "2026-08-31",
      daily,
      model,
      costRatio: 0.3,
      commissionRatio: 0.021,
      fixedExpenses: 150000,
    });
    expect(p.projectedRevenue).toBeGreaterThan(p.actualRevenue);
    expect(p.breakEvenRevenue).toBeCloseTo(150000 / 0.679, 0);
    expect(p.remainingDays).toBe(22);
  });

  it("ürün talebini aynı günün geçmişinden tahmin eder", () => {
    const rows = [0, 1, 2, 3].map((w) => ({ d: addDays("2026-09-18", -7 * (w + 1)), p: "cheesecake", q: 10 }));
    const demand = productDemand(rows, "2026-09-18", "2026-09-17");
    expect(demand[0].productId).toBe("cheesecake");
    expect(demand[0].weekdayAvg).toBe(10);
  });
});

describe("menü mühendisliği", () => {
  it("ürünleri popülerlik ve katkı payına göre sınıflar", () => {
    const products = [
      { product_id: "a", name: "Latte", category: "Espresso", qty: 100, revenue: 19000, cost: 5000, comp_qty: 0 },
      { product_id: "b", name: "Espresso", category: "Espresso", qty: 60, revenue: 8400, cost: 2600, comp_qty: 0 },
      { product_id: "c", name: "Cheesecake", category: "Tatlı", qty: 10, revenue: 2300, cost: 950, comp_qty: 0 },
      { product_id: "d", name: "Soda", category: "Diğer", qty: 5, revenue: 450, cost: 75, comp_qty: 0 },
    ];
    const r = engineerMenu({ products, menu: [] });
    const cls = Object.fromEntries(r.items.map((i) => [i.name, i.cls]));
    expect(cls.Latte).toBe("star");
    expect(cls.Espresso).toBe("plowhorse");
    expect(cls.Cheesecake).toBe("puzzle");
    expect(cls.Soda).toBe("dog");
  });
});
