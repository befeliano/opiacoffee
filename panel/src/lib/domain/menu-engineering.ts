// Menü mühendisliği (Kasavana & Smith): popülerlik × birim katkı payı

import type { ProductRow, ReportData } from "@/lib/api/types";

export type MenuClass = "star" | "plowhorse" | "puzzle" | "dog";

export const MENU_CLASS: Record<MenuClass, { label: string; advice: string }> = {
  star: { label: "Yıldız", advice: "Çok satıyor ve kârlı. Menüde öne çıkar, kaliteyi ve fiyatı koru." },
  plowhorse: { label: "İş atı", advice: "Çok satıyor ama kârı düşük. Fiyatı hafifçe artırmayı ya da reçete maliyetini düşürmeyi dene." },
  puzzle: { label: "Bilmece", advice: "Kârlı ama az satıyor. Görünürlüğünü artır, baristalar önersin." },
  dog: { label: "Zayıf", advice: "Az satıyor, kârı da düşük. Yenilemeyi ya da menüden çıkarmayı düşün." },
};

export interface EngineeredItem {
  productId: string | null;
  name: string;
  category: string;
  qty: number;
  share: number;
  unitMargin: number;
  totalMargin: number;
  cls: MenuClass;
}

export function engineerMenu(report: Pick<ReportData, "products" | "menu">) {
  const menuById = new Map(report.menu.map((m) => [m.product_id, m]));
  // Maliyeti bilinmeyen ürünler katkı payını çarpıtır; analiz dışı bırakılır
  const known: ProductRow[] = [];
  const unknownCost: ProductRow[] = [];
  for (const p of report.products) {
    if (p.qty <= 0) continue;
    if (p.cost <= 0) unknownCost.push(p);
    else known.push(p);
  }

  const totalQty = known.reduce((s, p) => s + p.qty, 0);
  if (known.length < 3 || totalQty === 0) {
    return { items: [] as EngineeredItem[], unknownCost, popularityThreshold: 0, avgMargin: 0 };
  }

  const popularityThreshold = (1 / known.length) * 0.7;
  const withMargin = known.map((p) => {
    const soldQty = p.qty - p.comp_qty;
    const current = p.product_id ? menuById.get(p.product_id) : undefined;
    const unitMargin = soldQty > 0 ? (p.revenue - p.cost) / p.qty : current ? current.price - current.unit_cost : 0;
    return { p, unitMargin };
  });
  const avgMargin = withMargin.reduce((s, x) => s + x.unitMargin * x.p.qty, 0) / totalQty;

  const items: EngineeredItem[] = withMargin.map(({ p, unitMargin }) => {
    const share = p.qty / totalQty;
    const popular = share >= popularityThreshold;
    const profitable = unitMargin >= avgMargin;
    const cls: MenuClass = popular ? (profitable ? "star" : "plowhorse") : profitable ? "puzzle" : "dog";
    return {
      productId: p.product_id,
      name: p.name,
      category: p.category,
      qty: p.qty,
      share,
      unitMargin,
      totalMargin: unitMargin * p.qty,
      cls,
    };
  });

  return { items: items.sort((a, b) => b.totalMargin - a.totalMargin), unknownCost, popularityThreshold, avgMargin };
}
