"use client";

import { memo, useMemo, useRef, useState } from "react";
import { Search, SlidersHorizontal, Star, X } from "lucide-react";
import type { MenuProduct, PosMenu } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { tl } from "@/lib/format";
import type { MenuIndex } from "@/lib/pos/optimistic";

const LONG_PRESS_MS = 450;
const FAVORITES = "favorites";

export function ProductGrid({
  menu,
  index,
  quantities,
  onTap,
  onOptions,
}: {
  menu: PosMenu;
  index: MenuIndex;
  quantities: Map<string, number>;
  onTap: (product: MenuProduct) => void;
  onOptions: (product: MenuProduct) => void;
}) {
  const favorites = useMemo(
    () => menu.products.filter((p) => p.favorite_rank != null).sort((a, b) => (a.favorite_rank ?? 0) - (b.favorite_rank ?? 0)),
    [menu.products],
  );

  // "Favoriler" sekmesi (ürünler kendi kategorilerinde de görünür) en başta
  const categories = useMemo(() => {
    const withProducts = menu.categories.filter((c) => menu.products.some((p) => p.category_id === c.id));
    const uncategorized = menu.products.some((p) => !p.category_id);
    const list = uncategorized ? [...withProducts, { id: "none", name: "Diğer", subtitle: "" }] : withProducts;
    return favorites.length > 0 ? [{ id: FAVORITES, name: "Favoriler", subtitle: "" }, ...list] : list;
  }, [menu, favorites.length]);

  const [category, setCategory] = useState(categories[0]?.id ?? "none");
  const [query, setQuery] = useState("");

  const products = useMemo(() => {
    const q = normalize(query);
    if (q) return menu.products.filter((p) => normalize(p.name).includes(q));
    if (category === FAVORITES) return favorites;
    return menu.products.filter((p) => (category === "none" ? !p.category_id : p.category_id === category));
  }, [menu.products, favorites, category, query]);

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-stone-50/60">
      <div className="border-b border-stone-200/70 bg-white px-3 pb-3 pt-3 sm:px-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-stone-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ürün ara"
            aria-label="Ürün ara"
            className="h-10 w-full rounded-xl border border-stone-200 bg-stone-50 pl-9 pr-9 text-[14px] outline-none focus:border-brand-500 focus:bg-white"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-1.5 top-1/2 grid size-8 -translate-y-1/2 place-items-center text-stone-400"
              aria-label="Aramayı temizle"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
        {!query && (
          // Telefonda yana kayar; tablet/masaüstünde sığmayan kategori alt satıra geçer (hepsi görünür)
          <div
            className="-mx-3 mt-3 flex gap-2 overflow-x-auto px-3 scrollbar-none sm:-mx-4 sm:px-4 md:mx-0 md:flex-wrap md:overflow-visible md:px-0"
            role="tablist"
          >
            {categories.map((c) => (
              <button
                key={c.id}
                type="button"
                role="tab"
                aria-selected={c.id === category}
                onClick={() => setCategory(c.id)}
                className={cn(
                  "h-10 shrink-0 rounded-full px-4 text-[14px] font-semibold transition md:px-3.5",
                  c.id === category ? "bg-brand-600 text-white shadow-card" : "bg-stone-100 text-stone-600 hover:bg-stone-200",
                )}
              >
                {c.id === FAVORITES && <Star className="-ml-0.5 mr-1 inline size-4 -translate-y-px fill-current" />}
                {c.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 sm:p-4">
        {products.length === 0 ? (
          <p className="py-16 text-center text-[14px] text-stone-500">Ürün bulunamadı.</p>
        ) : (
          <div className="grid grid-cols-2 gap-2.5 min-[420px]:grid-cols-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {products.map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                hasOptions={p.group_ids.some((g) => (index.groups.get(g)?.options.length ?? 0) > 0)}
                quantity={quantities.get(p.id) ?? 0}
                onTap={onTap}
                onOptions={onOptions}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const ProductCard = memo(function ProductCard({
  product,
  hasOptions,
  quantity,
  onTap,
  onOptions,
}: {
  product: MenuProduct;
  hasOptions: boolean;
  quantity: number;
  onTap: (product: MenuProduct) => void;
  onOptions: (product: MenuProduct) => void;
}) {
  const [flash, setFlash] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressed = useRef(false);

  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };

  return (
    <div className="relative">
      <button
        type="button"
        key={flash}
        onPointerDown={() => {
          longPressed.current = false;
          if (!hasOptions) return;
          timer.current = setTimeout(() => {
            longPressed.current = true;
            onOptions(product);
          }, LONG_PRESS_MS);
        }}
        onPointerUp={clear}
        onPointerLeave={clear}
        onPointerCancel={clear}
        onContextMenu={(e) => {
          if (hasOptions) e.preventDefault();
        }}
        onClick={() => {
          if (longPressed.current) return;
          setFlash((f) => f + 1);
          onTap(product);
        }}
        className={cn(
          "flex h-[88px] w-full select-none flex-col justify-between rounded-2xl border bg-white p-3 text-left shadow-card transition active:scale-[0.96]",
          quantity > 0 ? "border-brand-300" : "border-stone-200 hover:border-stone-300",
          flash > 0 && "animate-pop",
        )}
      >
        <span className="line-clamp-2 pr-5 text-[14px] font-semibold leading-snug text-stone-900">{product.name}</span>
        <span className="text-[14px] font-bold tabular-nums text-brand-700">{product.is_open_price ? "Fiyat gir" : tl(product.price)}</span>
      </button>

      {hasOptions && (
        <button
          type="button"
          onClick={() => onOptions(product)}
          aria-label={`${product.name} seçenekleri`}
          className="absolute bottom-1.5 right-1.5 grid size-9 place-items-center rounded-xl text-stone-400 hover:bg-stone-100 hover:text-stone-700"
        >
          <SlidersHorizontal className="size-4" />
        </button>
      )}

      {quantity > 0 && (
        <span className="pointer-events-none absolute -right-1.5 -top-1.5 grid h-6 min-w-6 place-items-center rounded-full bg-brand-600 px-1.5 text-[12px] font-bold text-white shadow">
          {quantity}
        </span>
      )}
    </div>
  );
});

function normalize(s: string) {
  return s
    .toLocaleLowerCase("tr")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ı/g, "i")
    .trim();
}
