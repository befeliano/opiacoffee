"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Plus, Search, Star } from "lucide-react";
import { reorderFavoritesAction, setFavoriteAction, setProductActiveAction } from "@/app/(panel)/[cafe]/menu/actions";
import { Button } from "@/components/ui/button";
import { SortableList } from "@/components/ui/sortable-list";
import { Badge, Card, CardHeader, EmptyState } from "@/components/ui/surface";
import { useToast } from "@/components/ui/toast";
import type { AdminIngredient, AdminProduct, MenuAdminData } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { pct, tl } from "@/lib/format";
import { costRatioTone, hasUnpricedIngredient } from "@/lib/menu/cost";
import { ProductEditor } from "./product-editor";

export function ProductsTab({
  cafeId,
  data,
  ingredients,
}: {
  cafeId: string;
  slug: string;
  data: MenuAdminData;
  ingredients: Map<string, AdminIngredient>;
}) {
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [onlyMissing, setOnlyMissing] = useState(false);
  const [editing, setEditing] = useState<{ product: AdminProduct | null; categoryId: string | null } | null>(null);

  const missingCost = (p: AdminProduct) =>
    p.unit_cost === 0 || (p.cost_mode === "recipe" && (p.recipe.length === 0 || hasUnpricedIngredient(p.recipe, ingredients)));

  const missingCount = data.products.filter(missingCost).length;
  const priced = data.products.filter((p) => !missingCost(p) && p.price > 0);
  const avgRatio = priced.length ? priced.reduce((s, p) => s + p.unit_cost / p.price, 0) / priced.length : null;

  const groups = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("tr");
    const match = (p: AdminProduct) => (!q || p.name.toLocaleLowerCase("tr").includes(q)) && (!onlyMissing || missingCost(p));
    const sections = data.categories.map((c) => ({ id: c.id as string | null, name: c.name, products: data.products.filter((p) => p.category_id === c.id && match(p)) }));
    const orphan = data.products.filter((p) => !p.category_id && match(p));
    if (orphan.length) sections.push({ id: null, name: "Kategorisiz", products: orphan });
    return sections.filter((s) => s.products.length > 0 || (!q && !onlyMissing));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, query, onlyMissing, ingredients]);

  const favorites = useMemo(
    () => data.products.filter((p) => p.favorite_rank != null).sort((a, b) => (a.favorite_rank ?? 0) - (b.favorite_rank ?? 0)),
    [data.products],
  );

  const toggleFavorite = async (p: AdminProduct) => {
    const next = p.favorite_rank == null;
    const result = await setFavoriteAction(cafeId, p.id, next).catch(() => null);
    if (!result || !result.ok) return toast.show(result?.ok === false ? result.error : "Bağlantı sorunu.", "error");
    toast.show(next ? `${p.name} favorilere eklendi` : `${p.name} favorilerden çıkarıldı`);
  };

  const reorderFavorites = async (ids: string[]) => {
    const result = await reorderFavoritesAction(cafeId, ids).catch(() => null);
    if (!result || !result.ok) return toast.show(result?.ok === false ? result.error : "Bağlantı sorunu.", "error");
    toast.show("Favori sırası kaydedildi");
  };

  const toggleActive = async (p: AdminProduct) => {
    const result = await setProductActiveAction(cafeId, p.id, !p.is_active).catch(() => null);
    if (!result || !result.ok) return toast.show(result?.ok === false ? result.error : "Bağlantı sorunu.", "error");
    toast.show(p.is_active ? `${p.name} satıştan kaldırıldı` : `${p.name} satışa açıldı`);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-stone-200 bg-white px-4 py-3">
          <p className="text-[12px] font-semibold uppercase tracking-wide text-stone-500">Ürün</p>
          <p className="text-[20px] font-extrabold">{data.products.length}</p>
        </div>
        <div className="rounded-2xl border border-stone-200 bg-white px-4 py-3">
          <p className="text-[12px] font-semibold uppercase tracking-wide text-stone-500">Ort. maliyet oranı</p>
          <p className="text-[20px] font-extrabold">{avgRatio === null ? "—" : pct(avgRatio)}</p>
        </div>
        <button
          type="button"
          onClick={() => setOnlyMissing((v) => !v)}
          className={cn(
            "col-span-2 flex items-center gap-3 rounded-2xl border px-4 py-3 text-left sm:col-span-1",
            missingCount > 0 ? "border-amber-200 bg-amber-50" : "border-stone-200 bg-white",
            onlyMissing && "ring-2 ring-amber-400",
          )}
        >
          <AlertTriangle className={cn("size-6 shrink-0", missingCount > 0 ? "text-amber-600" : "text-stone-300")} />
          <span>
            <span className="block text-[12px] font-semibold uppercase tracking-wide text-stone-500">Maliyeti eksik</span>
            <span className="block text-[20px] font-extrabold">{missingCount}</span>
          </span>
          <span className="ml-auto text-[12px] font-semibold text-amber-800">{onlyMissing ? "Tümünü göster" : missingCount > 0 ? "Listele" : ""}</span>
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-52 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-stone-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ürün ara"
            className="h-11 w-full rounded-xl border border-stone-200 bg-white pl-9 pr-3 text-[15px] outline-none focus:border-brand-500"
          />
        </div>
        <Button onClick={() => setEditing({ product: null, categoryId: data.categories[0]?.id ?? null })}>
          <Plus className="size-5" /> Ürün ekle
        </Button>
      </div>

      {data.products.length === 0 && (
        <Card>
          <EmptyState title="Menüde ürün yok" description="İlk ürünü ekleyerek başla." />
        </Card>
      )}

      {favorites.length > 0 && !query && !onlyMissing && (
        <Card>
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                <Star className="size-4 fill-amber-400 text-amber-400" /> Favoriler
              </span>
            }
            description="Satış ekranında ilk sekme. Ürünün yanındaki yıldızla ekle/çıkar, tutamaçtan sürükleyerek sırala."
          />
          <div className="px-4 pb-4 pt-3 sm:px-5">
            <SortableList
              items={favorites}
              getKey={(p) => p.id}
              onReorder={reorderFavorites}
              renderItem={(p) => (
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate text-[14px] font-semibold">{p.name}</span>
                  <span className="shrink-0 text-[13px] font-bold tabular-nums text-stone-500">{tl(p.price)}</span>
                </span>
              )}
            />
          </div>
        </Card>
      )}

      {groups.map((section) => (
        <Card key={section.id ?? "none"} className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-stone-100 px-4 py-3 sm:px-5">
            <h3 className="text-[15px] font-bold">{section.name}</h3>
            <button
              type="button"
              onClick={() => setEditing({ product: null, categoryId: section.id })}
              className="flex items-center gap-1 text-[13px] font-semibold text-brand-700 hover:text-brand-800"
            >
              <Plus className="size-4" /> Ekle
            </button>
          </div>
          {section.products.length === 0 ? (
            <p className="px-5 py-4 text-[14px] text-stone-500">Bu kategoride ürün yok.</p>
          ) : (
            <ul className="divide-y divide-stone-100">
              {section.products.map((p) => {
                const missing = missingCost(p);
                const ratio = p.price > 0 ? p.unit_cost / p.price : null;
                const tone = missing ? "none" : costRatioTone(ratio);
                return (
                  <li key={p.id} className="flex items-center gap-3 px-4 py-2.5 sm:px-5">
                    <button type="button" onClick={() => setEditing({ product: p, categoryId: p.category_id })} className="min-w-0 flex-1 text-left">
                      <span className="flex items-center gap-2">
                        <span className={cn("truncate text-[15px] font-semibold", !p.is_active && "text-stone-400")}>{p.name}</span>
                        {!p.is_active && <Badge>Satış dışı</Badge>}
                        {p.cost_mode === "fixed" && <Badge tone="neutral">Sabit</Badge>}
                      </span>
                      <span className="mt-0.5 block text-[13px] text-stone-500">
                        {missing ? (
                          <span className="font-medium text-amber-700">
                            {p.cost_mode === "recipe" && p.recipe.length === 0 ? "Reçete girilmemiş" : p.unit_cost === 0 ? "Maliyet girilmemiş" : "Hammadde fiyatı eksik"}
                          </span>
                        ) : (
                          <>Maliyet {tl(p.unit_cost, { decimals: "always" })}</>
                        )}
                        {p.group_ids.length > 0 && <> · {p.group_ids.length} seçenek grubu</>}
                      </span>
                    </button>
                    <span className="hidden w-20 text-right text-[13px] font-bold tabular-nums sm:block">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5",
                          tone === "good" && "bg-emerald-50 text-emerald-700",
                          tone === "warn" && "bg-amber-50 text-amber-700",
                          tone === "bad" && "bg-red-50 text-red-700",
                          tone === "none" && "text-stone-300",
                        )}
                      >
                        {tone === "none" ? "—" : pct(ratio)}
                      </span>
                    </span>
                    <span className="w-20 text-right text-[15px] font-bold tabular-nums">{tl(p.price)}</span>
                    <button
                      type="button"
                      aria-pressed={p.favorite_rank != null}
                      aria-label={p.favorite_rank != null ? "Favorilerden çıkar" : "Favorilere ekle"}
                      title={p.favorite_rank != null ? "Favorilerden çıkar" : "Favorilere ekle"}
                      onClick={() => toggleFavorite(p)}
                      className="grid size-9 shrink-0 place-items-center rounded-lg hover:bg-stone-100"
                    >
                      <Star className={cn("size-5", p.favorite_rank != null ? "fill-amber-400 text-amber-400" : "text-stone-300")} />
                    </button>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={p.is_active}
                      aria-label={p.is_active ? "Satıştan kaldır" : "Satışa aç"}
                      onClick={() => toggleActive(p)}
                      className={cn("relative h-6 w-10 shrink-0 rounded-full transition", p.is_active ? "bg-brand-600" : "bg-stone-300")}
                    >
                      <span className={cn("absolute top-0.5 size-5 rounded-full bg-white shadow transition-all", p.is_active ? "left-[18px]" : "left-0.5")} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      ))}

      {editing && (
        <ProductEditor
          cafeId={cafeId}
          product={editing.product}
          defaultCategoryId={editing.categoryId}
          data={data}
          ingredients={ingredients}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
