import type { NextRequest } from "next/server";
import ExcelJS from "exceljs";
import type { ZReport } from "@/lib/api/types";
import { requireCafeRole } from "@/lib/data/cafe";
import { rpc } from "@/lib/data/server";
import { businessToday, formatTime, isIsoDate } from "@/lib/domain/time";
import { APP_NAME } from "@/config";
import { currencySymbol } from "@/lib/format";

// Günlük Z raporunu muhasebe için Excel (.xlsx) olarak verir. Yalnızca sahip;
// yetki ayrıca veritabanındaki report_z fonksiyonunda da denetlenir.

// Para biçimi kafenin para biriminden (getCafeContext → configureFormat)
const moneyFmt = () => `#,##0.00 "${currencySymbol()}"`;
const PAYMENT_LABEL = { cash: "Nakit", card: "Kart", ticket: "Ticket" } as const;

export async function GET(request: NextRequest, ctx: RouteContext<"/[cafe]/z-raporu/excel">) {
  const { cafe } = await ctx.params;
  const context = await requireCafeRole(cafe, "owner");
  const today = businessToday(context.cafe.timezone);
  const requested = request.nextUrl.searchParams.get("tarih");
  const date = isIsoDate(requested) && requested <= today ? requested : today;

  const z = await rpc<ZReport>("report_z", { p_cafe: context.cafe.id, p_date: date });
  const buffer = await buildWorkbook(z);

  const fileName = `z-raporu-${context.cafe.slug}-${date}.xlsx`;
  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

async function buildWorkbook(z: ZReport): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = APP_NAME;
  wb.created = new Date();
  const tz = z.cafe.timezone;
  const vatPct = Math.round(z.vat_rate * 100);

  // --- Özet ---------------------------------------------------------------
  const summary = wb.addWorksheet("Özet");
  summary.columns = [{ width: 38 }, { width: 18 }];
  const title = summary.addRow([`${z.cafe.name} · Z raporu`]);
  title.font = { bold: true, size: 14 };
  summary.addRow([`Tarih: ${z.date}`]);
  summary.addRow([`Fiyatlar KDV dahildir (%${vatPct}). KDV her ödeme için ayrı hesaplanmıştır.`]).font = { italic: true, color: { argb: "FF78716C" } };
  summary.addRow([]);

  const money = (label: string, value: number, bold = false) => {
    const row = summary.addRow([label, value]);
    row.getCell(2).numFmt = moneyFmt();
    if (bold) row.font = { bold: true };
    return row;
  };
  const count = (label: string, value: number) => summary.addRow([label, value]);

  section(summary, "Satış");
  count("Adisyon sayısı", z.sales.orders);
  count("Satılan ürün adedi", z.sales.items);
  if (z.sales.guests > 0) count("Müşteri (girilen kişi sayısı)", z.sales.guests);
  count("İptal edilen adisyon", z.sales.cancelled);
  money("Brüt satış (indirim öncesi)", z.sales.gross);
  money("İndirim", z.sales.discount);
  money("İkram (menü fiyatıyla)", z.sales.comp);
  money("Ciro (KDV dahil)", z.summary.revenue, true);

  section(summary, "Ödemeler");
  money(`Nakit (${z.payments.cash_count} ödeme)`, z.payments.cash);
  money(`Kart (${z.payments.card_count} ödeme)`, z.payments.card);
  if (z.payments.ticket_count > 0) money(`Ticket (${z.payments.ticket_count} ödeme)`, z.payments.ticket);
  money("Toplam tahsilat", z.payments.total, true);
  money(`KDV nakit (%${vatPct})`, z.payments.vat_cash);
  money(`KDV kart (%${vatPct})`, z.payments.vat_card);
  if (z.payments.ticket_count > 0) money(`KDV ticket (%${vatPct})`, z.payments.vat_ticket);
  money("KDV toplam", z.payments.vat, true);

  section(summary, "Gelir tablosu");
  money("Ciro (KDV dahil)", z.summary.revenue);
  money("− KDV", z.summary.vat);
  money("= KDV hariç ciro", z.summary.revenue_ex_vat, true);
  money("− Ürün maliyeti", z.summary.cost);
  money("− Kart / ticket komisyonu", z.summary.commission);
  money("= Brüt kâr", z.summary.gross_profit, true);
  money("− Giderler (günlük pay)", z.summary.expenses);
  money("= Net kâr", z.summary.net_profit, true);

  if (z.days.length > 0) {
    section(summary, "Kasa");
    for (const d of z.days) {
      summary.addRow([`Açılış ${formatTime(d.opened_at, tz)}${d.opened_by ? ` · ${d.opened_by}` : ""}`, d.opening_cash ?? "girilmedi"]).getCell(2).numFmt = moneyFmt();
      if (d.closed_at) {
        summary.addRow([`Kapanış ${formatTime(d.closed_at, tz)}${d.closed_by ? ` · ${d.closed_by}` : ""}`]);
        if (d.expected_cash != null) money("Beklenen nakit", d.expected_cash);
        if (d.counted_cash != null) money("Sayılan nakit", d.counted_cash);
        else summary.addRow(["Sayılan nakit", "girilmedi"]);
        if (d.cash_difference != null) money("Kasa farkı", d.cash_difference, true);
        if (d.pos_total != null) {
          money("POS kart toplamı", d.pos_total);
          money("Sistemdeki kart", d.card_expected ?? 0);
          money("POS farkı", d.card_difference ?? 0, true);
        }
        if (d.note) summary.addRow([`Not: ${d.note}`]);
      }
    }
  }

  // --- Ürünler ------------------------------------------------------------
  const products = wb.addWorksheet("Ürünler");
  products.columns = [
    { header: "Ürün", key: "name", width: 32 },
    { header: "Kategori", key: "category", width: 20 },
    { header: "Adet", key: "qty", width: 8 },
    { header: "İkram adedi", key: "comp", width: 12 },
    { header: "Tutar (KDV dahil)", key: "revenue", width: 18, style: { numFmt: moneyFmt() } },
    { header: "Maliyet", key: "cost", width: 14, style: { numFmt: moneyFmt() } },
  ];
  for (const p of z.products) {
    products.addRow({ name: p.name, category: p.category, qty: p.qty, comp: p.comp_qty ?? 0, revenue: p.revenue ?? 0, cost: p.cost });
  }
  const productTotal = products.addRow({
    name: "Toplam",
    qty: z.products.reduce((s, p) => s + p.qty, 0),
    revenue: z.products.reduce((s, p) => s + (p.revenue ?? 0), 0),
    cost: z.products.reduce((s, p) => s + p.cost, 0),
  });
  productTotal.font = { bold: true };
  header(products);

  // --- Kategoriler --------------------------------------------------------
  const categories = wb.addWorksheet("Kategoriler");
  categories.columns = [
    { header: "Kategori", key: "name", width: 24 },
    { header: "Adet", key: "qty", width: 8 },
    { header: "Tutar (KDV dahil)", key: "revenue", width: 18, style: { numFmt: moneyFmt() } },
  ];
  for (const c of z.categories) categories.addRow({ name: c.name ?? "Diğer", qty: c.qty, revenue: c.revenue });
  header(categories);

  // --- Ödemeler (her biri ayrı KDV) --------------------------------------
  const payments = wb.addWorksheet("Ödemeler");
  payments.columns = [
    { header: "Saat", key: "at", width: 8 },
    { header: "Masa", key: "table", width: 14 },
    { header: "Yöntem", key: "method", width: 10 },
    { header: "Tutar (KDV dahil)", key: "amount", width: 18, style: { numFmt: moneyFmt() } },
    { header: `KDV (%${vatPct})`, key: "vat", width: 14, style: { numFmt: moneyFmt() } },
    { header: "KDV hariç", key: "net", width: 14, style: { numFmt: moneyFmt() } },
    { header: "Komisyon", key: "commission", width: 16, style: { numFmt: moneyFmt() } },
  ];
  for (const p of z.payment_list) {
    payments.addRow({
      at: formatTime(p.at, tz),
      table: p.table,
      method: PAYMENT_LABEL[p.method],
      amount: p.amount,
      vat: p.vat,
      net: Math.round((p.amount - p.vat) * 100) / 100,
      commission: p.commission,
    });
  }
  const paymentTotal = payments.addRow({
    at: "Toplam",
    amount: z.payments.total,
    vat: z.payments.vat,
    net: Math.round((z.payments.total - z.payments.vat) * 100) / 100,
    commission: z.payments.commission,
  });
  paymentTotal.font = { bold: true };
  header(payments);

  // --- Giderler -----------------------------------------------------------
  const expenses = wb.addWorksheet("Giderler");
  expenses.columns = [
    { header: "Gider", key: "name", width: 30 },
    { header: "Tür", key: "kind", width: 14 },
    { header: "Aylık tutar", key: "monthly", width: 14, style: { numFmt: moneyFmt() } },
    { header: "Bugüne düşen", key: "amount", width: 14, style: { numFmt: moneyFmt() } },
  ];
  for (const e of z.expenses) {
    expenses.addRow({ name: e.name, kind: e.kind === "monthly" ? "Aylık sabit" : "Tek seferlik", monthly: e.monthly_amount ?? undefined, amount: e.amount });
  }
  expenses.addRow({ name: "Toplam", amount: z.summary.expenses }).font = { bold: true };
  header(expenses);

  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}

function section(sheet: ExcelJS.Worksheet, label: string) {
  sheet.addRow([]);
  const row = sheet.addRow([label]);
  row.font = { bold: true, color: { argb: "FFFFFFFF" } };
  row.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF44403C" } };
  row.getCell(2).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF44403C" } };
}

function header(sheet: ExcelJS.Worksheet) {
  const row = sheet.getRow(1);
  row.font = { bold: true };
  row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF5F5F4" } };
  sheet.views = [{ state: "frozen", ySplit: 1 }];
}
