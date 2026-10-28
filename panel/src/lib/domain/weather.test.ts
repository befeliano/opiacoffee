import { describe, expect, it } from "vitest";
import type { DailyRow } from "@/lib/api/types";
import { backtest } from "./forecast";
import { addDays, weekdayOf } from "./time";
import { classifyDay, rainyDayFavorites, weatherImpact, type WeatherDay } from "./weather";

const wd = (date: string, over: Partial<WeatherDay> = {}): WeatherDay => ({
  date, code: 1, tmax: 20, tmin: 10, precip: 0, precipProb: 0, wind: 10, cloud: 20, ...over,
});

const row = (date: string, revenue: number): DailyRow => ({
  date, orders: Math.round(revenue / 200), revenue, cost: 0, commission: 0, card: 0, cash: 0, discount: 0, comp_value: 0,
  items: 0, table_sessions: 0, occupancy_minutes: 0, takeaway_orders: 0, cancelled: 0,
});

describe("hava sınıflandırması", () => {
  it("yağış, rüzgâr ve bulutluluğa göre ayırır", () => {
    expect(classifyDay(wd("d"))).toBe("sunny");
    expect(classifyDay(wd("d", { code: 3, cloud: 90 }))).toBe("cloudy");
    expect(classifyDay(wd("d", { code: 61, precip: 2 }))).toBe("rainy");
    expect(classifyDay(wd("d", { code: 63, precip: 14 }))).toBe("heavy");
    expect(classifyDay(wd("d", { code: 3, wind: 45 }))).toBe("windy");
    expect(classifyDay(wd("d", { code: 73, precip: 3 }))).toBe("snow");
  });
});

describe("havanın ciroya etkisi", () => {
  it("haftanın günü etkisini ayıklar; yağmurlu günlerdeki düşüşü bulur", () => {
    // 6 hafta: hafta sonu 2 kat ciro; her hafta çarşamba yağmurlu ve %40 düşük
    const days: DailyRow[] = [];
    const weather = new Map<string, WeatherDay>();
    let date = "2026-08-31"; // pazartesi
    for (let i = 0; i < 42; i++) {
      const w = weekdayOf(date);
      const rainy = w === 2;
      days.push(row(date, (w >= 5 ? 20000 : 10000) * (rainy ? 0.6 : 1)));
      weather.set(date, rainy ? wd(date, { code: 63, precip: 5 }) : wd(date));
      date = addDays(date, 1);
    }
    const impact = weatherImpact(days, weather);
    const rainy = impact.find((r) => r.cls === "rainy")!;
    const sunny = impact.find((r) => r.cls === "sunny")!;
    expect(rainy.days).toBe(6);
    // Çarşamba ortalaması zaten yağmurlu günlerden oluştuğu için oran 1 çıkar;
    // hafta sonu etkisi ise güneşli günleri bozmamalı
    expect(sunny.revenueRatio).toBeCloseTo(1, 5);
    expect(rainy.factor).toBeGreaterThan(0.5);
  });

  it("aynı gün içinde yağmurlu ve güneşli haftalar varsa farkı gösterir", () => {
    const days: DailyRow[] = [];
    const weather = new Map<string, WeatherDay>();
    let date = "2026-08-31";
    for (let i = 0; i < 56; i++) {
      const week = Math.floor(i / 7);
      const rainy = week % 2 === 1; // her iki haftadan biri yağmurlu
      days.push(row(date, rainy ? 7000 : 10000));
      weather.set(date, rainy ? wd(date, { code: 61, precip: 3 }) : wd(date));
      date = addDays(date, 1);
    }
    const impact = weatherImpact(days, weather);
    const rainy = impact.find((r) => r.cls === "rainy")!;
    expect(rainy.revenueRatio).toBeLessThan(0.9);
    expect(rainy.factor).toBeLessThan(1);
    expect(rainy.factor).toBeGreaterThan(rainy.revenueRatio); // az veride 1'e doğru küçültülür
  });

  it("yağışlı günlerde payı artan ürünü bulur", () => {
    const weather = new Map([["a", wd("a", { code: 63, precip: 6 })], ["b", wd("b")]]);
    const rows = [
      { d: "a", p: "choc", q: 10 }, { d: "a", p: "latte", q: 10 },
      { d: "b", p: "choc", q: 2 }, { d: "b", p: "latte", q: 18 },
    ];
    const fav = rainyDayFavorites(rows, weather, new Map([["choc", "Sıcak Çikolata"], ["latte", "Latte"]]));
    expect(fav.items[0].name).toBe("Sıcak Çikolata");
    expect(fav.items[0].lift).toBeCloseTo(5, 5);
  });
});

describe("tahminin geriye dönük testi", () => {
  it("düzenli seride sapma düşük, aralık kapsaması yüksek", () => {
    const series = Array.from({ length: 60 }, (_, i) => {
      const date = addDays("2026-08-01", i);
      return { date, value: (weekdayOf(date) >= 5 ? 20000 : 12000) * (1 + ((i * 37) % 7 - 3) / 100) };
    });
    const r = backtest(series, 28);
    expect(r.points.length).toBe(28);
    expect(r.mape!).toBeLessThan(0.1);
    expect(r.coverage!).toBeGreaterThan(0.7);
  });
});
