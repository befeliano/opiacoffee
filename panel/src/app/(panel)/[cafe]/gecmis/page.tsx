import type { Metadata } from "next";
import { HistoryView } from "@/components/pos/history-view";
import type { HistoryData } from "@/lib/api/types";
import { getCafeContext, hasRole } from "@/lib/data/cafe";
import { rpc } from "@/lib/data/server";
import { addDays, isIsoDate, businessToday } from "@/lib/domain/time";

export const metadata: Metadata = { title: "Geçmiş adisyonlar" };

export default async function HistoryPage({ params, searchParams }: PageProps<"/[cafe]/gecmis">) {
  const { cafe } = await params;
  const { tarih } = await searchParams;
  const ctx = await getCafeContext(cafe);
  const today = businessToday(ctx.cafe.timezone);
  const isManager = hasRole(ctx.role, "manager");
  // Görülebilecek günler kişinin ciro kapsamına göre (veritabanı da denetler)
  const scope = ctx.permissions.figures;
  const minDate = scope === "all" ? null : scope === "two_days" ? addDays(today, -1) : today;
  const date = isIsoDate(tarih) && tarih <= today && (!minDate || tarih >= minDate) ? tarih : today;

  const data = await rpc<HistoryData>("pos_history", { p_cafe: ctx.cafe.id, p_date: date });

  return (
    <HistoryView
      key={date}
      cafe={{ id: ctx.cafe.id, slug: ctx.cafe.slug, timezone: ctx.cafe.timezone }}
      data={data}
      minDate={minDate}
      canEditPast={isManager}
    />
  );
}
