import type { Metadata } from "next";
import { ProductsView } from "@/components/reports/products-view";
import type { ProductsReport } from "@/lib/api/types";
import { requireCafePerm } from "@/lib/data/cafe";
import { rpc } from "@/lib/data/server";
import { addDays, monthStart, businessToday, weekStart } from "@/lib/domain/time";

export const metadata: Metadata = { title: "Ürün satışları" };

export const PERIODS = ["bugun", "hafta", "ay", "90gun", "tum"] as const;
export type Period = (typeof PERIODS)[number];

export default async function ProductsPage({ params, searchParams }: PageProps<"/[cafe]/urunler">) {
  const { cafe } = await params;
  const { donem } = await searchParams;
  const ctx = await requireCafePerm(cafe, "reports");
  const today = businessToday(ctx.cafe.timezone);
  const period: Period = PERIODS.includes(donem as Period) ? (donem as Period) : "bugun";

  const from =
    period === "bugun" ? today
    : period === "hafta" ? weekStart(today)
    : period === "ay" ? monthStart(today)
    : period === "90gun" ? addDays(today, -89)
    : "2020-01-01";

  const report = await rpc<ProductsReport>("report_products", { p_cafe: ctx.cafe.id, p_from: from, p_to: today });

  return <ProductsView slug={ctx.cafe.slug} period={period} today={today} report={report} />;
}
