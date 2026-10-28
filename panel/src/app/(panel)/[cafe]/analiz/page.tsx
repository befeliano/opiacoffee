import type { Metadata } from "next";
import { InsightsView } from "@/components/reports/insights-view";
import type { DailyRow, Expense, HourlyRow, ProductDailyRow, ReportData } from "@/lib/api/types";
import { hasRole, requireCafePerm } from "@/lib/data/cafe";
import { rpc } from "@/lib/data/server";
import { addDays, businessToday } from "@/lib/domain/time";

export const metadata: Metadata = { title: "Analiz ve tahmin" };

const HISTORY_DAYS = 84;

export default async function InsightsPage({ params }: PageProps<"/[cafe]/analiz">) {
  const { cafe } = await params;
  const ctx = await requireCafePerm(cafe, "reports");
  const today = businessToday(ctx.cafe.timezone);
  const isOwner = hasRole(ctx.role, "owner");

  const [history, last30, productDaily, expenses] = await Promise.all([
    rpc<{ daily: DailyRow[]; hourly: HourlyRow[] }>("report_series", {
      p_cafe: ctx.cafe.id,
      p_from: addDays(today, -(HISTORY_DAYS - 1)),
      p_to: today,
    }),
    rpc<ReportData>("report_range", { p_cafe: ctx.cafe.id, p_from: addDays(today, -29), p_to: today }),
    rpc<ProductDailyRow[]>("report_product_daily", { p_cafe: ctx.cafe.id, p_from: addDays(today, -55), p_to: today }),
    isOwner ? rpc<Expense[]>("finance_expenses", { p_cafe: ctx.cafe.id }) : Promise.resolve(null),
  ]);

  return (
    <InsightsView
      slug={ctx.cafe.slug}
      today={today}
      historyFrom={addDays(today, -(HISTORY_DAYS - 1))}
      history={history}
      last30={last30}
      productDaily={productDaily}
      expenses={expenses}
      openHour={ctx.cafe.open_hour}
      closeHour={ctx.cafe.close_hour}
    />
  );
}
