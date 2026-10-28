"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { deleteProductAction, saveProductAction } from "@/app/(panel)/[cafe]/menu/actions";
import { Button } from "@/components/ui/button";
import { Field, Input, NumberInput, Select, Toggle } from "@/components/ui/field";
import { ConfirmSheet, Sheet } from "@/components/ui/sheet";
import { Segmented } from "@/components/ui/surface";
import { useToast } from "@/components/ui/toast";
import type { AdminIngredient, AdminProduct, MenuAdminData, ProductTag } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { pct, tl, currencySymbol } from "@/lib/format";
import { costRatioTone, hasUnpricedIngredient, recipeCost } from "@/lib/menu/cost";
import { fromDraft, RecipeEditor, toDraft, type DraftLine } from "./recipe-editor";

export const TAG_LABELS: Record<ProductTag, string> = {
  vegan: "🌱 Vegan",
  milk: "🥛 Süt",
  gluten: "🌾 Gluten",
  nuts: "🥜 Kuruyemiş",
  egg: "🥚 Yumurta",
};

export function ProductEditor({
  cafeId,
  product,
  defaultCategoryId,
  data,
  ingredients,
  onClose,
}: {
  cafeId: string;
  product: AdminProduct | null;
  defaultCategoryId: string | null;
  data: MenuAdminData;
  ingredients: Map<string, AdminIngredient>;
  onClose: () => void;
}) {
  const toast = useToast();
  const [name, setName] = useState(product?.name ?? "");
  const [categoryId, setCategoryId] = useState<string>(product?.category_id ?? defaultCategoryId ?? "");
  const [price, setPrice] = useState<number | null>(product?.price ?? null);
  const [description, setDescription] = useState(product?.description ?? "");
  const [tags, setTags] = useState<ProductTag[]>(product?.tags ?? []);
  const [isActive, setIsActive] = useState(product?.is_active ?? true);
  const [costMode, setCostMode] = useState<"recipe" | "fixed">(product?.cost_mode ?? "recipe");
  const [fixedCost, setFixedCost] = useState<number | null>(product?.fixed_cost ?? null);
  const [lines, setLines] = useState<DraftLine[]>(() => toDraft(product?.recipe ?? []));
  const [groupIds, setGroupIds] = useState<string[]>(product?.group_ids ?? []);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recipe = fromDraft(lines);
  const cost = costMode === "fixed" ? (fixedCost ?? 0) : recipeCost(recipe, ingredients);
  const ratio = price && price > 0 ? cost / price : null;
  const tone = costRatioTone(cost > 0 ? ratio : null);
  const unpriced = costMode === "recipe" && hasUnpricedIngredient(recipe, ingredients);

  const save = async () => {
    setError(null);
    if (!name.trim()) return setError("Ürün adı gerekli.");
    if (price === null || price < 0) return setError("Satış fiyatını gir.");
    setSaving(true);
    const result = await saveProductAction(cafeId, {
      id: product?.id ?? null,
      category_id: categoryId || null,
      name: name.trim(),
      description: description.trim(),
      price,
      cost_mode: costMode,
      fixed_cost: fixedCost ?? 0,
      tags,
      is_active: isActive,
      recipe,
      group_ids: groupIds,
    }).catch(() => null);
    setSaving(false);
    if (!result) return setError("Bağlantı sorunu. Tekrar dene.");
    if (!result.ok) return setError(result.error);
    toast.show(product ? "Ürün güncellendi" : "Ürün eklendi");
    onClose();
  };

  const remove = async () => {
    if (!product) return;
    setSaving(true);
    const result = await deleteProductAction(cafeId, product.id).catch(() => null);
    setSaving(false);
    if (!result || !result.ok) return toast.show(result?.ok === false ? result.error : "Bağlantı sorunu.", "error");
    toast.show("Ürün silindi");
    onClose();
  };

  return (
    <>
      <Sheet
        open
        onClose={onClose}
        title={product ? "Ürünü düzenle" : "Yeni ürün"}
        size="lg"
        footer={
          <div className="flex flex-col gap-2">
            {error && <p className="text-[14px] font-medium text-red-600">{error}</p>}
            <div className="flex gap-2">
              {product && (
                <Button variant="secondary" size="lg" className="text-red-600" onClick={() => setConfirmDelete(true)} aria-label="Ürünü sil">
                  <Trash2 className="size-5" />
                </Button>
              )}
              <Button size="lg" className="flex-1" onClick={save} disabled={saving}>
                {saving ? "Kaydediliyor…" : "Kaydet"}
              </Button>
            </div>
          </div>
        }
      >
        <div className="flex flex-col gap-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Ürün adı" className="sm:col-span-2">
              <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="örn. White Mocha" autoFocus={!product} />
            </Field>
            <Field label="Kategori">
              <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                <option value="">Kategorisiz</option>
                {data.categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Satış fiyatı">
              <NumberInput value={price} onValueChange={setPrice} suffix={currencySymbol()} placeholder="0" />
            </Field>
            <Field label="Açıklama" className="sm:col-span-2" hint="İsteğe bağlı; örn. çeşitler veya menşe">
              <Input value={description} onChange={(e) => setDescription(e.target.value)} maxLength={200} />
            </Field>
          </div>

          <div className="flex flex-wrap gap-2">
            {(Object.keys(TAG_LABELS) as ProductTag[]).map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={tags.includes(t)}
                onClick={() => setTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]))}
                className={cn(
                  "h-9 rounded-full border px-3 text-[13px] font-semibold",
                  tags.includes(t) ? "border-brand-400 bg-brand-50 text-brand-800" : "border-stone-200 text-stone-600",
                )}
              >
                {TAG_LABELS[t]}
              </button>
            ))}
          </div>

          <Toggle checked={isActive} onChange={setIsActive} label="Satışta" description="Kapalı ürünler satış ekranında görünmez" />

          <section className="rounded-2xl border border-stone-200 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-[15px] font-bold">Maliyet</h3>
              <Segmented
                size="sm"
                value={costMode}
                onChange={setCostMode}
                options={[
                  { value: "recipe", label: "Reçeteden hesapla" },
                  { value: "fixed", label: "Sabit maliyet" },
                ]}
              />
            </div>
            <div className="mt-4">
              {costMode === "recipe" ? (
                <>
                  <p className="mb-3 text-[13px] text-stone-500">
                    Kullanılan malzemeleri gram/ml/adet olarak gir. Maliyet, hammaddelerin alış fiyatından otomatik hesaplanır.
                  </p>
                  <RecipeEditor lines={lines} onChange={setLines} ingredients={data.ingredients} />
                </>
              ) : (
                <Field label="Birim maliyet" hint="Hazır alınan ürünlerde (tatlı, sandviç, şişe su) alış fiyatı ya da önceden hesaplanmış maliyet">
                  <NumberInput value={fixedCost} onValueChange={setFixedCost} suffix={currencySymbol()} placeholder="0" decimals={4} />
                </Field>
              )}
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-stone-50 p-3 text-center">
              <Metric label="Maliyet" value={tl(cost, { decimals: "always" })} />
              <Metric label="Brüt kâr" value={price !== null ? tl(price - cost, { decimals: "always" }) : "—"} />
              <Metric
                label="Maliyet oranı"
                value={cost > 0 && ratio !== null ? pct(ratio) : "—"}
                className={cn(tone === "good" && "text-emerald-700", tone === "warn" && "text-amber-700", tone === "bad" && "text-red-700")}
              />
            </div>
            {unpriced && <p className="mt-2 text-[13px] font-medium text-amber-700">Bazı hammaddelerin alış fiyatı girilmemiş; maliyet eksik hesaplanıyor.</p>}
          </section>

          {data.groups.length > 0 && (
            <section>
              <h3 className="text-[15px] font-bold">Seçenek grupları</h3>
              <p className="mb-3 text-[13px] text-stone-500">Satışta sorulacak seçimler (sıcak/buzlu, süt tipi, ekstra shot…)</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {data.groups.map((g) => {
                  const checked = groupIds.includes(g.id);
                  return (
                    <label
                      key={g.id}
                      className={cn(
                        "flex cursor-pointer items-start gap-3 rounded-xl border-2 p-3 transition",
                        checked ? "border-brand-400 bg-brand-50/60" : "border-stone-200",
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => setGroupIds((prev) => (checked ? prev.filter((x) => x !== g.id) : [...prev, g.id]))}
                        className="mt-1 size-4 accent-[#e45c00]"
                      />
                      <span className="min-w-0">
                        <span className="block text-[14px] font-semibold">{g.name}</span>
                        <span className="block truncate text-[12px] text-stone-500">{g.options.map((o) => o.name).join(" · ")}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      </Sheet>

      <ConfirmSheet
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={remove}
        pending={saving}
        danger
        title={`${product?.name ?? "Ürün"} silinsin mi?`}
        description="Geçmiş satışlar raporlarda kalmaya devam eder. Sadece satıştan kaldırmak istiyorsan 'Satışta' anahtarını kapatman yeterli."
        confirmLabel="Sil"
      />
    </>
  );
}

function Metric({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-500">{label}</p>
      <p className={cn("mt-0.5 text-[15px] font-bold tabular-nums", className)}>{value}</p>
    </div>
  );
}
