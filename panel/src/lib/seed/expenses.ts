// Test verisi: finans ve başabaş ekranları dolu görünsün diye örnek giderler.
// Hepsi is_demo olarak işaretlenir; Ayarlar › Test verisi'nden silinir.

export interface DemoExpense {
  kind: "monthly" | "one_time";
  category: string;
  name: string;
  amount: number;
  starts_on: string;
  ends_on: string | null;
  note: string;
}

const ymd = (d: Date, day: number) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

export function demoExpenses(now = new Date()): DemoExpense[] {
  const start = new Date(now);
  start.setMonth(start.getMonth() - 3);
  const startsOn = ymd(start, 1);
  const monthly: Omit<DemoExpense, "starts_on" | "ends_on" | "note">[] = [
    { kind: "monthly", category: "kira", name: "Dükkân kirası", amount: 40000 },
    { kind: "monthly", category: "fatura", name: "Elektrik, su, internet", amount: 13000 },
    { kind: "monthly", category: "personel", name: "Barista maaşları", amount: 85000 },
    { kind: "monthly", category: "banka", name: "Kredi taksiti", amount: 9000 },
    { kind: "monthly", category: "vergi", name: "Muhasebe ve vergi", amount: 5000 },
  ];
  return [
    ...monthly.map((e) => ({ ...e, starts_on: startsOn, ends_on: null, note: "Test verisi" })),
    { kind: "one_time", category: "ekipman", name: "Değirmen bakımı", amount: 8500, starts_on: ymd(now, 5), ends_on: null, note: "Test verisi" },
  ];
}
