import type { Metadata } from "next";
import { FinanceView } from "@/components/finance/finance-view";
import type { Expense, ReportData } from "@/lib/api/types";
import { requireCafeRole } from "@/lib/data/cafe";
import { firstSaleDate, MAX_RANGE_DAYS } from "@/lib/data/first-sale";
import { rpc } from "@/lib/data/server";
import { addDays, diffDays, isIsoDate, monthEnd, monthStart, businessToday } from "@/lib/domain/time";

export const metadata: Metadata = { title: "Finans" };

export default async function FinancePage({ params, searchParams }: PageProps<"/[cafe]/finans">) {
  const { cafe } = await params;
  const { ay, bas, bit } = await searchParams;
  const ctx = await requireCafeRole(cafe, "owner");
  const today = businessToday(ctx.cafe.timezone);

  // ?ay=tum → ilk satış gününden bugüne · ?bas=…&bit=… → özel aralık (en fazla 400 gün)
  if (ay === "tum" || isIsoDate(bas)) {
    const to = isIsoDate(bit) && bit <= today ? bit : today;
    const from =
      ay === "tum" ? await firstSaleDate(ctx.cafe.id, today)
      : isIsoDate(bas) && bas <= to && diffDays(bas, to) < MAX_RANGE_DAYS ? bas
      : addDays(to, -29);
    const kind = ay === "tum" ? "all" : "range";
    const [expenses, report] = await Promise.all([
      rpc<Expense[]>("finance_expenses", { p_cafe: ctx.cafe.id }),
      rpc<ReportData>("report_range", { p_cafe: ctx.cafe.id, p_from: from, p_to: kind === "all" ? today : to }),
    ]);
    return (
      <FinanceView
        cafeId={ctx.cafe.id}
        slug={ctx.cafe.slug}
        month={monthStart(today)}
        span={{ from, to: kind === "all" ? today : to, kind }}
        today={today}
        expenses={expenses}
        report={report}
        previous={null}
      />
    );
  }

  const requested = typeof ay === "string" && /^\d{4}-\d{2}$/.test(ay) && isIsoDate(`${ay}-01`) ? `${ay}-01` : monthStart(today);
  const month = requested > today ? monthStart(today) : requested;
  const end = monthEnd(month) < today ? monthEnd(month) : today;
  const prevMonth = monthStart(addDays(month, -1));

  const [expenses, report, previous] = await Promise.all([
    rpc<Expense[]>("finance_expenses", { p_cafe: ctx.cafe.id }),
    rpc<ReportData>("report_range", { p_cafe: ctx.cafe.id, p_from: month, p_to: end }),
    rpc<ReportData>("report_range", { p_cafe: ctx.cafe.id, p_from: prevMonth, p_to: monthEnd(prevMonth) }),
  ]);

  return <FinanceView cafeId={ctx.cafe.id} slug={ctx.cafe.slug} month={month} span={null} today={today} expenses={expenses} report={report} previous={previous} />;
}
