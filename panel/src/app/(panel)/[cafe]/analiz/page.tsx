import type { Metadata } from "next";
import { InsightsView } from "@/components/reports/insights-view";
import type { DailyRow, Expense, HourlyRow, ProductDailyRow, ReportData } from "@/lib/api/types";
import { hasRole, requireCafePerm } from "@/lib/data/cafe";
import { firstSaleDate } from "@/lib/data/first-sale";
import { rpc } from "@/lib/data/server";
import { addDays, businessToday } from "@/lib/domain/time";

export const metadata: Metadata = { title: "Analiz ve tahmin" };

const HISTORY_DAYS = 84;

export default async function InsightsPage({ params, searchParams }: PageProps<"/[cafe]/analiz">) {
  const { cafe } = await params;
  const { donem } = await searchParams;
  const ctx = await requireCafePerm(cafe, "reports");
  const today = businessToday(ctx.cafe.timezone);
  const isOwner = hasRole(ctx.role, "owner");

  // Tüm zamanlar: menü mühendisliği, gün deseni ve yoğunluk haritası ilk satış gününden başlar
  const allFrom = donem === "tum" ? await firstSaleDate(ctx.cafe.id, today) : null;
  const defaultFrom = addDays(today, -(HISTORY_DAYS - 1));
  const historyFrom = allFrom && allFrom < defaultFrom ? allFrom : defaultFrom;

  const [history, windowReport, productDaily, expenses] = await Promise.all([
    rpc<{ daily: DailyRow[]; hourly: HourlyRow[] }>("report_series", { p_cafe: ctx.cafe.id, p_from: historyFrom, p_to: today }),
    rpc<ReportData>("report_range", { p_cafe: ctx.cafe.id, p_from: allFrom ?? addDays(today, -29), p_to: today }),
    rpc<ProductDailyRow[]>("report_product_daily", { p_cafe: ctx.cafe.id, p_from: addDays(today, -55), p_to: today }),
    isOwner ? rpc<Expense[]>("finance_expenses", { p_cafe: ctx.cafe.id }) : Promise.resolve(null),
  ]);

  return (
    <InsightsView
      slug={ctx.cafe.slug}
      today={today}
      allFrom={allFrom}
      historyFrom={historyFrom}
      history={history}
      last30={windowReport}
      productDaily={productDaily}
      expenses={expenses}
      openHour={ctx.cafe.open_hour}
      closeHour={ctx.cafe.close_hour}
    />
  );
}
