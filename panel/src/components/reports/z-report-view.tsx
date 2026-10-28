"use client";

import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, FileSpreadsheet, Printer } from "lucide-react";
import type { ZReport } from "@/lib/api/types";
import { Card, CardHeader, EmptyState } from "@/components/ui/surface";
import { cn } from "@/lib/cn";
import { addDays, formatDateTr, formatTime, WEEKDAYS_TR, weekdayOf } from "@/lib/domain/time";
import { tl } from "@/lib/format";

/** Günlük Z raporu: muhasebeye gidecek özet + Excel indirme. Yalnızca sahip. */
export function ZReportView({ slug, date, today, report }: { slug: string; date: string; today: string; report: ZReport }) {
  const router = useRouter();
  const tz = report.cafe.timezone;
  const s = report.summary;
  const p = report.payments;
  const go = (d: string) => router.push(`/${slug}/z-raporu?tarih=${d}`, { scroll: false });
  const hasSales = report.sales.orders > 0;

  return (
    <main className="mx-auto max-w-5xl px-4 pb-28 pt-4 sm:px-6 md:pb-10 md:pt-6 print:max-w-none print:p-0">
      <div className="flex flex-wrap items-center gap-3 print:hidden">
        <h1 className="mr-auto text-2xl font-extrabold tracking-tight sm:text-[28px]">Z raporu</h1>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => go(addDays(date, -1))} className="grid size-10 place-items-center rounded-xl border border-stone-200 bg-white hover:bg-stone-50" aria-label="Önceki gün">
            <ChevronLeft className="size-5" />
          </button>
          <input
            type="date"
            value={date}
            max={today}
            onChange={(e) => e.target.value && go(e.target.value)}
            className="h-10 rounded-xl border border-stone-200 bg-white px-3 text-[14px] font-medium"
            aria-label="Tarih"
          />
          <button
            type="button"
            disabled={date >= today}
            onClick={() => go(addDays(date, 1))}
            className="grid size-10 place-items-center rounded-xl border border-stone-200 bg-white hover:bg-stone-50 disabled:opacity-40"
            aria-label="Sonraki gün"
          >
            <ChevronRight className="size-5" />
          </button>
        </div>
        <a
          href={`/${slug}/z-raporu/excel?tarih=${date}`}
          className="flex h-10 items-center gap-2 rounded-xl bg-emerald-600 px-4 text-[14px] font-bold text-white hover:bg-emerald-700"
          download
        >
          <FileSpreadsheet className="size-4" /> Excel indir
        </a>
        <button
          type="button"
          onClick={() => window.print()}
          className="hidden h-10 items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 text-[14px] font-semibold text-stone-700 hover:bg-stone-50 sm:flex"
        >
          <Printer className="size-4" /> Yazdır
        </button>
      </div>

      <p className="mt-1 text-[14px] text-stone-500">
        {report.cafe.name} · {formatDateTr(date)}, {WEEKDAYS_TR[weekdayOf(date)]} · fiyatlar KDV dahil (%{Math.round(report.vat_rate * 100)})
      </p>

      {!hasSales && report.sales.cancelled === 0 ? (
        <Card className="mt-5">
          <EmptyState title="Bu gün satış yok" description="Kapanan adisyon olduğunda Z raporu burada oluşur." />
        </Card>
      ) : (
        <>
          {/* Özet */}
          <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Tile label="Ciro (KDV dahil)" value={tl(s.revenue)} strong />
            <Tile label={`KDV (%${Math.round(report.vat_rate * 100)})`} value={tl(s.vat)} />
            <Tile label="KDV hariç ciro" value={tl(s.revenue_ex_vat)} />
            <Tile label="Net kâr" value={tl(s.net_profit)} tone={s.net_profit >= 0 ? "good" : "bad"} strong />
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader title="Gelir tablosu" description="Giderler: aylık sabit giderlerin günlük payı + bugünkü tek seferlik giderler" />
              <dl className="px-4 pb-4 pt-2 text-[14px] sm:px-5">
                <Line label="Ciro (KDV dahil)" value={tl(s.revenue)} />
                <Line label="− KDV" value={tl(s.vat)} />
                <Line label="= KDV hariç ciro" value={tl(s.revenue_ex_vat)} bold />
                <Line label="− Ürün maliyeti" value={tl(s.cost)} />
                <Line label="− Kart / ticket komisyonu" value={tl(s.commission)} />
                <Line label="= Brüt kâr" value={tl(s.gross_profit)} bold />
                <Line label="− Giderler (günlük pay)" value={tl(s.expenses)} />
                <Line label="= Net kâr" value={tl(s.net_profit)} bold tone={s.net_profit >= 0 ? "good" : "bad"} />
              </dl>
            </Card>

            <Card>
              <CardHeader title="Ödemeler" description="KDV her ödeme için ayrı hesaplanır" />
              <div className="overflow-x-auto px-4 pb-4 pt-2 sm:px-5">
                <table className="w-full text-[14px] tabular-nums">
                  <thead>
                    <tr className="text-left text-[12px] font-semibold uppercase tracking-wide text-stone-400">
                      <th className="py-1.5">Yöntem</th>
                      <th className="py-1.5 text-right">Adet</th>
                      <th className="py-1.5 text-right">Tutar</th>
                      <th className="py-1.5 text-right">KDV</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    <tr>
                      <td className="py-2 font-semibold">Nakit</td>
                      <td className="py-2 text-right">{p.cash_count}</td>
                      <td className="py-2 text-right">{tl(p.cash)}</td>
                      <td className="py-2 text-right">{tl(p.vat_cash)}</td>
                    </tr>
                    <tr>
                      <td className="py-2 font-semibold">Kart</td>
                      <td className="py-2 text-right">{p.card_count}</td>
                      <td className="py-2 text-right">{tl(p.card)}</td>
                      <td className="py-2 text-right">{tl(p.vat_card)}</td>
                    </tr>
                    {p.ticket_count > 0 && (
                      <tr>
                        <td className="py-2 font-semibold">Ticket</td>
                        <td className="py-2 text-right">{p.ticket_count}</td>
                        <td className="py-2 text-right">{tl(p.ticket)}</td>
                        <td className="py-2 text-right">{tl(p.vat_ticket)}</td>
                      </tr>
                    )}
                    <tr className="font-bold">
                      <td className="py-2">Toplam</td>
                      <td className="py-2 text-right">{p.cash_count + p.card_count + p.ticket_count}</td>
                      <td className="py-2 text-right">{tl(p.total)}</td>
                      <td className="py-2 text-right">{tl(p.vat)}</td>
                    </tr>
                  </tbody>
                </table>
                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-[13px] text-stone-600">
                  <dt>Adisyon</dt>
                  <dd className="text-right font-semibold tabular-nums">{report.sales.orders}</dd>
                  <dt>Satılan ürün</dt>
                  <dd className="text-right font-semibold tabular-nums">{report.sales.items}</dd>
                  {report.sales.guests > 0 && (
                    <>
                      <dt>Müşteri (girilen)</dt>
                      <dd className="text-right font-semibold tabular-nums">{report.sales.guests} kişi</dd>
                    </>
                  )}
                  <dt>İndirim</dt>
                  <dd className="text-right font-semibold tabular-nums">{tl(report.sales.discount)}</dd>
                  <dt>İkram (menü fiyatıyla)</dt>
                  <dd className="text-right font-semibold tabular-nums">{tl(report.sales.comp)}</dd>
                  <dt>İptal edilen adisyon</dt>
                  <dd className="text-right font-semibold tabular-nums">{report.sales.cancelled}</dd>
                </dl>
              </div>
            </Card>
          </div>

          {report.days.length > 0 && (
            <Card className="mt-4">
              <CardHeader title="Kasa" description="Açılış ve kapanış sayımı" />
              <ul className="divide-y divide-stone-100 px-4 pb-3 pt-1 sm:px-5">
                {report.days.map((d) => {
                  const diff = d.cash_difference;
                  const ok = diff !== null && Math.abs(diff) < 0.01;
                  return (
                    <li key={d.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5 text-[14px]">
                      <span className="font-semibold">
                        {formatTime(d.opened_at, tz)} – {d.closed_at ? formatTime(d.closed_at, tz) : "açık"}
                      </span>
                      <span className="text-stone-500">Açılış {d.opening_cash != null ? tl(d.opening_cash) : "girilmedi"}</span>
                      {d.closed_at && (
                        <>
                          {d.expected_cash != null && <span className="text-stone-500">Beklenen {tl(d.expected_cash)}</span>}
                          <span className="text-stone-500">Sayılan {d.counted_cash != null ? tl(d.counted_cash) : "girilmedi"}</span>
                          {diff !== null && (
                            <span
                              className={cn(
                                "ml-auto inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-bold",
                                ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700",
                              )}
                            >
                              {ok ? <CheckCircle2 className="size-3.5" /> : <AlertTriangle className="size-3.5" />}
                              {ok ? "Tuttu" : `${diff > 0 ? "+" : ""}${tl(diff)}`}
                            </span>
                          )}
                        </>
                      )}
                      {d.closed_at && d.pos_total != null && (
                        <span className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 text-stone-500">
                          <span>POS {tl(d.pos_total)}</span>
                          <span>Sistemdeki kart {tl(d.card_expected ?? 0)}</span>
                          <DiffPill diff={d.card_difference} label="POS" />
                        </span>
                      )}
                      {d.note && <span className="w-full text-[13px] text-stone-500">“{d.note}”</span>}
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}

          <Card className="mt-4">
            <CardHeader title="Satılan ürünler" description={`${report.products.length} çeşit · ${report.sales.items} adet`} />
            <div className="overflow-x-auto px-4 pb-4 pt-2 sm:px-5">
              <table className="w-full min-w-[440px] text-[14px] tabular-nums">
                <thead>
                  <tr className="text-left text-[12px] font-semibold uppercase tracking-wide text-stone-400">
                    <th className="py-1.5">Ürün</th>
                    <th className="py-1.5 text-right">Adet</th>
                    <th className="py-1.5 text-right">Tutar</th>
                    <th className="py-1.5 text-right">Maliyet</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {report.products.map((row) => (
                    <tr key={`${row.category}|${row.name}`}>
                      <td className="py-2">
                        <span className="font-semibold">{row.name}</span>
                        {row.category && <span className="ml-1.5 text-[12px] text-stone-400">{row.category}</span>}
                        {row.comp_qty ? <span className="ml-1.5 text-[12px] text-emerald-700">{row.comp_qty} ikram</span> : null}
                      </td>
                      <td className="py-2 text-right">{row.qty}</td>
                      <td className="py-2 text-right">{tl(row.revenue ?? 0)}</td>
                      <td className="py-2 text-right text-stone-500">{tl(row.cost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {report.expenses.length > 0 && (
            <Card className="mt-4">
              <CardHeader title="Giderler" description="Aylık giderler günlere bölünür" />
              <ul className="divide-y divide-stone-100 px-4 pb-3 pt-1 text-[14px] sm:px-5">
                {report.expenses.map((e, i) => (
                  <li key={i} className="flex items-center justify-between gap-3 py-2">
                    <span>
                      <span className="font-semibold">{e.name}</span>
                      <span className="ml-1.5 text-[12px] text-stone-400">
                        {e.kind === "monthly" ? `aylık ${tl(e.monthly_amount ?? 0)}` : "tek seferlik"}
                      </span>
                    </span>
                    <span className="font-semibold tabular-nums">{tl(e.amount)}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </>
      )}
    </main>
  );
}

function DiffPill({ diff, label }: { diff: number | null; label: string }) {
  if (diff === null) return null;
  const ok = Math.abs(diff) < 0.01;
  return (
    <span
      className={cn(
        "ml-auto inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-bold",
        ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700",
      )}
    >
      {ok ? <CheckCircle2 className="size-3.5" /> : <AlertTriangle className="size-3.5" />}
      {ok ? `${label} tuttu` : `${label} ${diff > 0 ? "+" : ""}${tl(diff)}`}
    </span>
  );
}

function Tile({ label, value, strong, tone }: { label: string; value: string; strong?: boolean; tone?: "good" | "bad" }) {
  return (
    <div className={cn("rounded-2xl border px-4 py-3", strong ? "border-stone-200 bg-white shadow-card" : "border-stone-200/70 bg-white")}>
      <p className="text-[12px] font-semibold uppercase tracking-wide text-stone-500">{label}</p>
      <p
        className={cn(
          "mt-1 text-[20px] font-extrabold tabular-nums sm:text-[22px]",
          tone === "good" && "text-emerald-700",
          tone === "bad" && "text-red-700",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function Line({ label, value, bold, tone }: { label: string; value: string; bold?: boolean; tone?: "good" | "bad" }) {
  return (
    <div className={cn("flex justify-between gap-3 py-1", bold && "border-t border-stone-100 pt-2 font-bold")}>
      <dt className={cn(!bold && "text-stone-600")}>{label}</dt>
      <dd className={cn("tabular-nums", tone === "good" && "text-emerald-700", tone === "bad" && "text-red-700")}>{value}</dd>
    </div>
  );
}
