"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/surface";
import type { MenuAdminData } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { CategoriesTab } from "./categories-tab";
import { GroupsTab } from "./groups-tab";
import { IngredientsTab } from "./ingredients-tab";
import { ProductsTab } from "./products-tab";
import { RecalculateSheet } from "./recalculate-sheet";

type Tab = "urunler" | "hammaddeler" | "secenekler" | "kategoriler";

const TAB_LABELS: Record<Tab, string> = {
  urunler: "Ürünler",
  hammaddeler: "Hammaddeler",
  secenekler: "Seçenekler",
  kategoriler: "Kategoriler",
};

export function MenuManager({
  cafeId,
  slug,
  data,
  tab,
  today,
}: {
  cafeId: string;
  slug: string;
  data: MenuAdminData;
  tab: Tab;
  today: string;
}) {
  const [recalcOpen, setRecalcOpen] = useState(false);
  const ingredients = useMemo(() => new Map(data.ingredients.map((i) => [i.id, i])), [data.ingredients]);

  const counts: Record<Tab, number> = {
    urunler: data.products.length,
    hammaddeler: data.ingredients.length,
    secenekler: data.groups.length,
    kategoriler: data.categories.length,
  };

  return (
    <main className="mx-auto max-w-6xl px-4 pb-28 pt-4 sm:px-6 md:pb-10 md:pt-6">
      <PageHeader
        title="Menü ve maliyet"
        description="Ürünler, reçeteler ve alış fiyatları. Değişiklikler anında satış ekranına yansır."
        actions={
          <Button variant="secondary" size="sm" onClick={() => setRecalcOpen(true)}>
            <History className="size-4" /> Geçmiş maliyetleri güncelle
          </Button>
        }
      />

      <nav className="-mx-4 mt-5 flex gap-1 overflow-x-auto border-b border-stone-200 px-4 scrollbar-none sm:mx-0 sm:px-0">
        {(Object.keys(TAB_LABELS) as Tab[]).map((t) => (
          <Link
            key={t}
            href={`/${slug}/menu?sekme=${t}`}
            scroll={false}
            className={cn(
              "relative shrink-0 px-3 pb-3 pt-1 text-[15px] font-semibold transition",
              t === tab ? "text-stone-900" : "text-stone-500 hover:text-stone-800",
            )}
          >
            {TAB_LABELS[t]}
            <span className="ml-1.5 rounded-full bg-stone-100 px-1.5 py-0.5 text-[11px] font-bold text-stone-500">{counts[t]}</span>
            {t === tab && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-brand-500" />}
          </Link>
        ))}
      </nav>

      <div className="mt-5">
        {tab === "urunler" && <ProductsTab cafeId={cafeId} slug={slug} data={data} ingredients={ingredients} />}
        {tab === "hammaddeler" && <IngredientsTab cafeId={cafeId} data={data} />}
        {tab === "secenekler" && <GroupsTab cafeId={cafeId} data={data} ingredients={ingredients} />}
        {tab === "kategoriler" && <CategoriesTab cafeId={cafeId} data={data} />}
      </div>

      <RecalculateSheet cafeId={cafeId} open={recalcOpen} onClose={() => setRecalcOpen(false)} today={today} />
    </main>
  );
}
