import type { Metadata } from "next";
import { ZReportView } from "@/components/reports/z-report-view";
import type { ZReport } from "@/lib/api/types";
import { requireCafeRole } from "@/lib/data/cafe";
import { rpc } from "@/lib/data/server";
import { businessToday, isIsoDate } from "@/lib/domain/time";

export const metadata: Metadata = { title: "Z raporu" };

export default async function ZReportPage({ params, searchParams }: PageProps<"/[cafe]/z-raporu">) {
  const { cafe } = await params;
  const sp = await searchParams;
  const ctx = await requireCafeRole(cafe, "owner");
  const today = businessToday(ctx.cafe.timezone);
  const date = isIsoDate(sp.tarih) && sp.tarih <= today ? sp.tarih : today;

  const report = await rpc<ZReport>("report_z", { p_cafe: ctx.cafe.id, p_date: date });

  return <ZReportView slug={ctx.cafe.slug} date={date} today={today} report={report} />;
}
