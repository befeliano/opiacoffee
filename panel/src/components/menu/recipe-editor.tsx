"use client";

import { Plus, Trash2 } from "lucide-react";
import { NumberInput, Select } from "@/components/ui/field";
import type { AdminIngredient, RecipeLine } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { tl, unitLabel } from "@/lib/format";
import { ingredientUnitCost } from "@/lib/menu/cost";

export interface DraftLine {
  key: string;
  ingredient_id: string;
  quantity: number | null;
}

export function toDraft(lines: RecipeLine[]): DraftLine[] {
  return lines.map((l, i) => ({ key: `l${i}-${l.ingredient_id}`, ingredient_id: l.ingredient_id, quantity: l.quantity }));
}

export function fromDraft(lines: DraftLine[]): RecipeLine[] {
  const seen = new Set<string>();
  const out: RecipeLine[] = [];
  for (const l of lines) {
    if (!l.ingredient_id || !l.quantity || seen.has(l.ingredient_id)) continue;
    seen.add(l.ingredient_id);
    out.push({ ingredient_id: l.ingredient_id, quantity: l.quantity });
  }
  return out;
}

export function RecipeEditor({
  lines,
  onChange,
  ingredients,
  allowNegative = false,
}: {
  lines: DraftLine[];
  onChange: (lines: DraftLine[]) => void;
  ingredients: AdminIngredient[];
  allowNegative?: boolean;
}) {
  const byId = new Map(ingredients.map((i) => [i.id, i]));
  const used = new Set(lines.map((l) => l.ingredient_id));

  const update = (key: string, patch: Partial<DraftLine>) => onChange(lines.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  if (ingredients.length === 0) {
    return (
      <p className="rounded-xl bg-amber-50 px-3 py-3 text-[14px] text-amber-900">
        Önce <strong>Hammaddeler</strong> sekmesinden kullanılan malzemeleri (çekirdek, süt, şurup…) alış fiyatlarıyla ekle.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {lines.length === 0 && <p className="text-[13px] text-stone-500">Reçetede henüz malzeme yok.</p>}
      {lines.map((line) => {
        const ing = byId.get(line.ingredient_id);
        const cost = ing && line.quantity ? line.quantity * ingredientUnitCost(ing) : 0;
        const unpriced = ing && ing.package_price === 0;
        return (
          <div key={line.key} className="grid grid-cols-[1fr_auto] items-start gap-2 rounded-xl border border-stone-200 p-2 sm:grid-cols-[1fr_130px_90px_auto] sm:items-center">
            <Select
              value={line.ingredient_id}
              onChange={(e) => update(line.key, { ingredient_id: e.target.value })}
              className="col-span-1 h-10"
              aria-label="Hammadde"
            >
              <option value="">Hammadde seç</option>
              {ingredients.map((i) => (
                <option key={i.id} value={i.id} disabled={i.id !== line.ingredient_id && used.has(i.id)}>
                  {i.name}
                </option>
              ))}
            </Select>
            <button
              type="button"
              onClick={() => onChange(lines.filter((l) => l.key !== line.key))}
              className="grid size-10 place-items-center rounded-lg text-stone-400 hover:bg-red-50 hover:text-red-600 sm:order-last"
              aria-label="Satırı sil"
            >
              <Trash2 className="size-4" />
            </button>
            <NumberInput
              value={line.quantity}
              onValueChange={(v) => update(line.key, { quantity: v })}
              suffix={ing ? unitLabel(ing.unit) : ""}
              decimals={3}
              allowNegative={allowNegative}
              inputClassName="h-10"
              aria-label="Miktar"
              placeholder="Miktar"
            />
            <span className={cn("text-right text-[14px] font-semibold tabular-nums", unpriced ? "text-amber-600" : "text-stone-700")}>
              {unpriced ? "fiyat yok" : tl(cost, { decimals: "always" })}
            </span>
          </div>
        );
      })}
      <button
        type="button"
        onClick={() => onChange([...lines, { key: `n${Date.now()}`, ingredient_id: "", quantity: null }])}
        className="flex h-11 items-center justify-center gap-2 rounded-xl border border-dashed border-stone-300 text-[14px] font-semibold text-stone-600 hover:border-brand-400 hover:text-brand-700"
      >
        <Plus className="size-4" /> Malzeme ekle
      </button>
    </div>
  );
}
