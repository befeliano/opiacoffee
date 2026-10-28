import type { Metadata } from "next";
import { ReportView } from "@/components/reports/report-view";
import type { ReportData } from "@/lib/api/types";
import { requireCafePerm } from "@/lib/data/cafe";
import { rpc } from "@/lib/data/server";
import { addDays, isIsoDate, businessToday, monthEnd, monthStart, weekStart, zonedParts } from "@/lib/domain/time";

export const metadata: Metadata = { title: "Rapor" };

export default async function ReportPage({ params, searchParams }: PageProps<"/[cafe]/rapor">) {
  const { cafe } = await params;
  const sp = await searchParams;
  const ctx = await requireCafePerm(cafe, "reports");
  const today = businessToday(ctx.cafe.timezone);

  const view = sp.gorunum === "hafta" ? "week" : sp.gorunum === "ay" ? "month" : "day";
  const requested = isIsoDate(sp.tarih) && sp.tarih <= today ? sp.tarih : today;

  const from = view === "week" ? weekStart(requested) : view === "month" ? monthStart(requested) : requested;
  const to = view === "week" ? addDays(from, 6) : view === "month" ? monthEnd(from) : requested;
  // Karşılaştırma: gün → önceki 7 gün (dün ve geçen haftanın aynı günü), hafta → geçen hafta, ay → geçen ay
  const prevFrom = view === "month" ? monthStart(addDays(from, -1)) : addDays(from, -7);
  const prevTo = addDays(from, -1);

  const [current, previous] = await Promise.all([
    rpc<ReportData>("report_range", { p_cafe: ctx.cafe.id, p_from: from, p_to: to }),
    rpc<ReportData>("report_range", { p_cafe: ctx.cafe.id, p_from: prevFrom, p_to: prevTo }),
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
