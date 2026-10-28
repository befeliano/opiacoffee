import type { Metadata } from "next";
import { ReportView } from "@/components/reports/report-view";
import type { ReportData } from "@/lib/api/types";
import { requireCafePerm } from "@/lib/data/cafe";
import { firstSaleDate, MAX_RANGE_DAYS } from "@/lib/data/first-sale";
import { rpc } from "@/lib/data/server";
import { addDays, diffDays, isIsoDate, businessToday, monthEnd, monthStart, weekStart, zonedParts } from "@/lib/domain/time";

export const metadata: Metadata = { title: "Rapor" };

export default async function ReportPage({ params, searchParams }: PageProps<"/[cafe]/rapor">) {
  const { cafe } = await params;
  const sp = await searchParams;
  const ctx = await requireCafePerm(cafe, "reports");
  const today = businessToday(ctx.cafe.timezone);

  // Özel aralık: ?gorunum=aralik&bas=…&bit=… (en fazla 400 gün, bitiş en geç bugün)
  const rangeTo = isIsoDate(sp.bit) && sp.bit <= today ? sp.bit : today;
  const rangeFrom = isIsoDate(sp.bas) && sp.bas <= rangeTo && diffDays(sp.bas, rangeTo) < MAX_RANGE_DAYS ? sp.bas : addDays(rangeTo, -6);
  const view =
    sp.gorunum === "hafta" ? "week" : sp.gorunum === "ay" ? "month" : sp.gorunum === "tum" ? "all" : sp.gorunum === "aralik" ? "range" : "day";
  const requested = view === "all" ? today : view === "range" ? rangeTo : isIsoDate(sp.tarih) && sp.tarih <= today ? sp.tarih : today;

  // Tüm zamanlar: ilk satış gününden bugüne
  const from =
    view === "all" ? await firstSaleDate(ctx.cafe.id, today)
    : view === "range" ? rangeFrom
    : view === "week" ? weekStart(requested)
    : view === "month" ? monthStart(requested)
    : requested;
  const to = view === "all" ? today : view === "range" ? rangeTo : view === "week" ? addDays(from, 6) : view === "month" ? monthEnd(from) : requested;
  // Karşılaştırma: gün → önceki 7 gün (dün ve geçen haftanın aynı günü), hafta → geçen hafta,
  // ay → geçen ay, aralık → hemen önceki aynı uzunlukta dönem
  const length = diffDays(from, to) + 1;
  const prevFrom = view === "month" ? monthStart(addDays(from, -1)) : view === "range" ? addDays(from, -length) : addDays(from, -7);
  const prevTo = addDays(from, -1);

  const [current, previous] = await Promise.all([
    rpc<ReportData>("report_range", { p_cafe: ctx.cafe.id, p_from: from, p_to: to }),
    // Tüm zamanlarda karşılaştırılacak önceki dönem yok
    view === "all" ? null : rpc<ReportData>("report_range", { p_cafe: ctx.cafe.id, p_from: prevFrom, p_to: prevTo }),
  ]);

  return (
    <ReportView
      slug={ctx.cafe.slug}
      view={view}
      date={requested}
      from={from}
      to={to}
      prevFrom={prevFrom}
      prevTo={prevTo}
      today={today}
      current={current}
      previous={previous}
      openHour={ctx.cafe.open_hour}
      closeHour={ctx.cafe.close_hour}
      timezone={ctx.cafe.timezone}
      currentHour={zonedParts(new Date(), ctx.cafe.timezone).hour}
    />
  );
}
