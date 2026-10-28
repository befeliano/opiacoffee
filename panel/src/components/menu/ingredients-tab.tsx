"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Plus, Search, Trash2 } from "lucide-react";
import { deleteIngredientAction, saveIngredientAction } from "@/app/(panel)/[cafe]/menu/actions";
import { Button } from "@/components/ui/button";
import { Field, Input, NumberInput } from "@/components/ui/field";
import { ConfirmSheet, Sheet } from "@/components/ui/sheet";
import { Badge, Card, EmptyState, Segmented } from "@/components/ui/surface";
import { useToast } from "@/components/ui/toast";
import type { AdminIngredient, MenuAdminData, StockUnit } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { num, tl, unitCostLabel, currencySymbol } from "@/lib/format";

const PACKAGE_PRESETS: Record<StockUnit, { label: string; size: number }[]> = {
  g: [
    { label: "1 kg", size: 1000 },
    { label: "500 g", size: 500 },
    { label: "250 g", size: 250 },
    { label: "100 g", size: 100 },
  ],
  ml: [
    { label: "1 L", size: 1000 },
    { label: "750 ml", size: 750 },
    { label: "700 ml", size: 700 },
    { label: "500 ml", size: 500 },
  ],
  adet: [
    { label: "1 adet", size: 1 },
    { label: "12'li", size: 12 },
    { label: "24'lü", size: 24 },
    { label: "50'li", size: 50 },
  ],
};

export function IngredientsTab({ cafeId, data }: { cafeId: string; data: MenuAdminData }) {
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<AdminIngredient | "new" | null>(null);

  const list = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("tr");
    return data.ingredients.filter((i) => !q || i.name.toLocaleLowerCase("tr").includes(q));
  }, [data.ingredients, query]);

  const unpriced = data.ingredients.filter((i) => i.package_price === 0).length;

  return (
    <div className="flex flex-col gap-4">
      {unpriced > 0 && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-[14px] text-amber-900">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-600" />
          <p>
            <strong>{unpriced} hammaddenin</strong> alış fiyatı girilmemiş. Fiyatları girdiğinde tüm reçeteli ürünlerin maliyeti otomatik güncellenir.
          </p>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-52 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-stone-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Hammadde ara"
            className="h-11 w-full rounded-xl border border-stone-200 bg-white pl-9 pr-3 text-[15px] outline-none focus:border-brand-500"
          />
        </div>
        <Button onClick={() => setEditing("new")}>
          <Plus className="size-5" /> Hammadde ekle
        </Button>
      </div>

      <Card className="overflow-hidden">
        {list.length === 0 ? (
          <EmptyState title="Hammadde yok" description="Çekirdek, süt, şurup gibi malzemeleri alış fiyatlarıyla ekle." />
        ) : (
          <ul className="divide-y divide-stone-100">
            {list.map((i) => (
              <li key={i.id}>
                <button type="button" onClick={() => setEditing(i)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-stone-50 sm:px-5">
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-[15px] font-semibold">{i.name}</span>
                      {i.usage_count > 0 && <Badge>{i.usage_count} reçete</Badge>}
                    </span>
                    <span className="mt-0.5 block text-[13px] text-stone-500">
                      {i.package_price > 0 ? (
                        <>
                          {packageLabel(i.package_size, i.unit)} = {tl(i.package_price)}
                        </>
                      ) : (
                        <span className="font-medium text-amber-700">Alış fiyatı girilmemiş</span>
                      )}
                    </span>
                  </span>
                  <span className={cn("text-right text-[14px] font-bold tabular-nums", i.package_price === 0 && "text-stone-300")}>
                    {i.package_price > 0 ? unitCostLabel(i.unit_cost, i.unit) : "—"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {editing && <IngredientEditor cafeId={cafeId} ingredient={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function packageLabel(size: number, unit: StockUnit) {
  if (unit === "g" && size >= 1000) return `${num(size / 1000, 2)} kg`;
  if (unit === "ml" && size >= 1000) return `${num(size / 1000, 2)} L`;
  return `${num(size, 2)} ${unit}`;
}

function IngredientEditor({ cafeId, ingredient, onClose }: { cafeId: string; ingredient: AdminIngredient | null; onClose: () => void }) {
  const toast = useToast();
  const [name, setName] = useState(ingredient?.name ?? "");
  const [unit, setUnit] = useState<StockUnit>(ingredient?.unit ?? "g");
  const [size, setSize] = useState<number | null>(ingredient?.package_size ?? 1000);
  const [price, setPrice] = useState<number | null>(ingredient?.package_price || null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const unitCost = size && price ? price / size : 0;

  const save = async () => {
    setError(null);
    if (!name.trim()) return setError("Hammadde adı gerekli.");
    if (!size || size <= 0) return setError("Paket miktarını gir.");
    setSaving(true);
    const result = await saveIngredientAction(cafeId, {
      id: ingredient?.id ?? null,
      name: name.trim(),
      unit,
      package_size: size,
      package_price: price ?? 0,
    }).catch(() => null);
    setSaving(false);
    if (!result) return setError("Bağlantı sorunu. Tekrar dene.");
    if (!result.ok) return setError(result.error);
    toast.show(ingredient ? "Hammadde güncellendi" : "Hammadde eklendi");
    onClose();
  };

  const remove = async () => {
    if (!ingredient) return;
    setSaving(true);
    const result = await deleteIngredientAction(cafeId, ingredient.id).catch(() => null);
    setSaving(false);
    setConfirmDelete(false);
    if (!result || !result.ok) return setError(result?.ok === false ? result.error : "Bağlantı sorunu.");
    toast.show("Hammadde silindi");
    onClose();
  };

  return (
    <>
      <Sheet
        open
        onClose={onClose}
        title={ingredient ? "Hammaddeyi düzenle" : "Yeni hammadde"}
        size="md"
        footer={
          <div className="flex flex-col gap-2">
            {error && <p className="text-[14px] font-medium text-red-600">{error}</p>}
            <div className="flex gap-2">
              {ingredient && (
                <Button variant="secondary" size="lg" className="text-red-600" onClick={() => setConfirmDelete(true)} aria-label="Sil">
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
        <div className="flex flex-col gap-4">
          <Field label="Hammadde adı">
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="örn. Beyaz çikolata sosu" autoFocus={!ingredient} />
          </Field>
          <Field label="Reçetede kullanılan birim">
            <Segmented
              value={unit}
              onChange={(u) => {
                setUnit(u);
                setSize(PACKAGE_PRESETS[u][0].size);
              }}
              options={[
                { value: "g", label: "Gram" },
                { value: "ml", label: "Mililitre" },
                { value: "adet", label: "Adet" },
              ]}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Alış paketi">
              <NumberInput value={size} onValueChange={setSize} suffix={unit} decimals={3} />
            </Field>
            <Field label="Paket fiyatı">
              <NumberInput value={price} onValueChange={setPrice} suffix={currencySymbol()} placeholder="0" />
            </Field>
          </div>
          <div className="flex flex-wrap gap-2">
            {PACKAGE_PRESETS[unit].map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => setSize(p.size)}
                className={cn(
                  "h-9 rounded-lg px-3 text-[13px] font-semibold",
                  size === p.size ? "bg-stone-900 text-white" : "bg-stone-100 text-stone-700",
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="rounded-xl bg-brand-50 px-4 py-3 text-[14px] text-brand-900">
            {unitCost > 0 ? (
              <>
                Birim maliyet: <strong className="tabular-nums">{tl(unitCost, { decimals: "always" })}</strong> / {unit}
                {unit !== "adet" && (
                  <span className="text-brand-800"> · örn. 18 {unit} = {tl(unitCost * 18, { decimals: "always" })}</span>
                )}
              </>
            ) : (
              "Paket fiyatını girince birim maliyet hesaplanır."
            )}
          </div>
        </div>
      </Sheet>
      <ConfirmSheet
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={remove}
        pending={saving}
        danger
        title={`${ingredient?.name} silinsin mi?`}
        description={ingredient?.usage_count ? `Bu hammadde ${ingredient.usage_count} reçetede kullanılıyor. Silmeden önce reçetelerden çıkarmalısın.` : undefined}
        confirmLabel="Sil"
      />
    </>
  );
}
