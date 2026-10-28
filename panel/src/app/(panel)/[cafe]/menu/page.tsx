import type { Metadata } from "next";
import { MenuManager } from "@/components/menu/menu-manager";
import type { MenuAdminData } from "@/lib/api/types";
import { requireCafePerm } from "@/lib/data/cafe";
import { rpc } from "@/lib/data/server";
import { businessToday } from "@/lib/domain/time";

export const metadata: Metadata = { title: "Menü ve maliyet" };

const TABS = ["urunler", "hammaddeler", "secenekler", "kategoriler"] as const;
type Tab = (typeof TABS)[number];

export default async function MenuPage({ params, searchParams }: PageProps<"/[cafe]/menu">) {
  const { cafe } = await params;
  const { sekme } = await searchParams;
  const ctx = await requireCafePerm(cafe, "menu");
  const data = await rpc<MenuAdminData>("menu_admin_data", { p_cafe: ctx.cafe.id });
  const tab: Tab = TABS.includes(sekme as Tab) ? (sekme as Tab) : "urunler";

  return <MenuManager cafeId={ctx.cafe.id} slug={ctx.cafe.slug} data={data} tab={tab} today={businessToday(ctx.cafe.timezone)} />;
}
