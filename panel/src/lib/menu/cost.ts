import type { AdminIngredient, RecipeLine } from "@/lib/api/types";

export function ingredientUnitCost(i: Pick<AdminIngredient, "package_price" | "package_size">) {
  return i.package_size > 0 ? i.package_price / i.package_size : 0;
}

export function recipeCost(lines: RecipeLine[], ingredients: Map<string, AdminIngredient>) {
  return lines.reduce((sum, line) => {
    const ing = ingredients.get(line.ingredient_id);
    return ing ? sum + line.quantity * ingredientUnitCost(ing) : sum;
  }, 0);
}

/** Reçetede fiyatı girilmemiş hammadde var mı? */
export function hasUnpricedIngredient(lines: RecipeLine[], ingredients: Map<string, AdminIngredient>) {
  return lines.some((l) => (ingredients.get(l.ingredient_id)?.package_price ?? 0) === 0);
}

/** Maliyet oranı rengi: ≤%30 iyi, ≤%40 dikkat, üstü yüksek */
export function costRatioTone(ratio: number | null): "good" | "warn" | "bad" | "none" {
  if (ratio === null || !Number.isFinite(ratio)) return "none";
  if (ratio <= 0.3) return "good";
  if (ratio <= 0.4) return "warn";
  return "bad";
}
