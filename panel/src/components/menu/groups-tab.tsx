"use client";

import { useState } from "react";
import { ChevronDown, Plus, Trash2 } from "lucide-react";
import { deleteGroupAction, saveGroupAction } from "@/app/(panel)/[cafe]/menu/actions";
import { Button } from "@/components/ui/button";
import { Field, Input, NumberInput, Toggle } from "@/components/ui/field";
import { ConfirmSheet, Sheet } from "@/components/ui/sheet";
import { Badge, Card, EmptyState, Segmented } from "@/components/ui/surface";
import { useToast } from "@/components/ui/toast";
import type { AdminGroup, AdminIngredient, MenuAdminData } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { tl, currencySymbol } from "@/lib/format";
import { recipeCost } from "@/lib/menu/cost";
import { fromDraft, RecipeEditor, toDraft, type DraftLine } from "./recipe-editor";

export function GroupsTab({ cafeId, data, ingredients }: { cafeId: string; data: MenuAdminData; ingredients: Map<string, AdminIngredient> }) {
  const [editing, setEditing] = useState<AdminGroup | "new" | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-[14px] text-stone-500">
          Satışta sorulan seçimler. Fiyat farkı hesaba, maliyet farkı rapora eklenir. Örn. <em>Yulaf sütü +{tl(40)}</em>, <em>Ekstra shot +{tl(40)}</em>.
        </p>
        <Button onClick={() => setEditing("new")}>
          <Plus className="size-5" /> Grup ekle
        </Button>
      </div>

      {data.groups.length === 0 ? (
        <Card>
          <EmptyState title="Seçenek grubu yok" description="Sıcak/buzlu, süt tipi gibi seçimler için grup oluştur." />
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {data.groups.map((g) => (
            <Card key={g.id} className="overflow-hidden">
              <button type="button" onClick={() => setEditing(g)} className="w-full p-4 text-left hover:bg-stone-50/60 sm:p-5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-[16px] font-bold">{g.name}</h3>
                    <p className="text-[13px] text-stone-500">
                      {g.selection === "single" ? "Tek seçim" : "Çoklu seçim"} · {g.product_count} üründe
                    </p>
                  </div>
                  {g.is_required && <Badge tone="brand">Zorunlu</Badge>}
                </div>
                <ul className="mt-3 flex flex-col gap-1.5">
                  {g.options.map((o) => (
                    <li key={o.id} className={cn("flex items-center justify-between text-[14px]", !o.is_active && "text-stone-400 line-through")}>
                      <span className="flex items-center gap-1.5">
                        {o.name}
                        {o.is_default && <span className="text-[11px] font-bold uppercase text-stone-400">varsayılan</span>}
                      </span>
                      <span className="tabular-nums text-stone-600">
                        {o.price_delta !== 0 ? `${o.price_delta > 0 ? "+" : "−"}${tl(Math.abs(o.price_delta))}` : "—"}
                        <span className="ml-2 text-[12px] text-stone-400">maliyet {signed(o.unit_cost)}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </button>
            </Card>
          ))}
        </div>
      )}

      {editing && (
        <GroupEditor cafeId={cafeId} group={editing === "new" ? null : editing} data={data} ingredients={ingredients} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}

function signed(n: number) {
  if (Math.abs(n) < 0.005) return tl(0);
  return `${n > 0 ? "+" : "−"}${tl(Math.abs(n), { decimals: "always" })}`;
}

interface DraftOption {
  key: string;
  id: string | null;
  name: string;
  price_delta: number | null;
  cost_mode: "recipe" | "fixed";
  fixed_cost: number | null;
  is_default: boolean;
  is_active: boolean;
  lines: DraftLine[];
}

function GroupEditor({
  cafeId,
  group,
  data,
  ingredients,
  onClose,
}: {
  cafeId: string;
  group: AdminGroup | null;
  data: MenuAdminData;
  ingredients: Map<string, AdminIngredient>;
  onClose: () => void;
}) {
  const toast = useToast();
  const [name, setName] = useState(group?.name ?? "");
  const [selection, setSelection] = useState<"single" | "multi">(group?.selection ?? "single");
  const [required, setRequired] = useState(group?.is_required ?? false);
  const [options, setOptions] = useState<DraftOption[]>(() =>
    (group?.options ?? []).map((o, i) => ({
      key: `o${i}`,
      id: o.id,
      name: o.name,
      price_delta: o.price_delta,
      cost_mode: o.cost_mode,
      fixed_cost: o.fixed_cost,
      is_default: o.is_default,
      is_active: o.is_active,
      lines: toDraft(o.recipe),
    })),
  );
  const [expanded, setExpanded] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const patch = (key: string, value: Partial<DraftOption>) => setOptions((prev) => prev.map((o) => (o.key === key ? { ...o, ...value } : o)));

  const setDefault = (key: string) =>
    setOptions((prev) =>
      prev.map((o) => (selection === "single" ? { ...o, is_default: o.key === key ? !o.is_default : false } : o.key === key ? { ...o, is_default: !o.is_default } : o)),
    );

  const save = async () => {
    setError(null);
    if (!name.trim()) return setError("Grup adı gerekli.");
    const cleaned = options.filter((o) => o.name.trim());
    if (cleaned.length === 0) return setError("En az bir seçenek ekle.");
    setSaving(true);
    const result = await saveGroupAction(cafeId, {
      id: group?.id ?? null,
      name: name.trim(),
      selection,
      is_required: required,
      options: cleaned.map((o) => ({
        id: o.id,
        name: o.name.trim(),
        price_delta: o.price_delta ?? 0,
        cost_mode: o.cost_mode,
        fixed_cost: o.fixed_cost ?? 0,
        is_default: o.is_default,
        is_active: o.is_active,
        recipe: fromDraft(o.lines),
      })),
    }).catch(() => null);
    setSaving(false);
    if (!result) return setError("Bağlantı sorunu. Tekrar dene.");
    if (!result.ok) return setError(result.error);
    toast.show(group ? "Seçenek grubu güncellendi" : "Seçenek grubu eklendi");
    onClose();
  };

  const remove = async () => {
    if (!group) return;
    setSaving(true);
    const result = await deleteGroupAction(cafeId, group.id).catch(() => null);
    setSaving(false);
    if (!result || !result.ok) return setError(result?.ok === false ? result.error : "Bağlantı sorunu.");
    toast.show("Seçenek grubu silindi");
    onClose();
  };

  return (
    <>
      <Sheet
        open
        onClose={onClose}
        title={group ? "Seçenek grubunu düzenle" : "Yeni seçenek grubu"}
        size="lg"
        footer={
          <div className="flex flex-col gap-2">
            {error && <p className="text-[14px] font-medium text-red-600">{error}</p>}
            <div className="flex gap-2">
              {group && (
                <Button variant="secondary" size="lg" className="text-red-600" onClick={() => setConfirmDelete(true)} aria-label="Grubu sil">
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
          <Field label="Grup adı">
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="örn. Süt" autoFocus={!group} />
          </Field>
          <div className="flex flex-wrap items-center gap-4">
            <Segmented
              value={selection}
              onChange={(v) => {
                setSelection(v);
                if (v === "single") {
                  setOptions((prev) => {
                    const firstDefault = prev.find((o) => o.is_default)?.key;
                    return prev.map((o) => ({ ...o, is_default: o.key === firstDefault }));
                  });
                }
              }}
              options={[
                { value: "single", label: "Tek seçim" },
                { value: "multi", label: "Çoklu seçim" },
              ]}
            />
          </div>
          <Toggle
            checked={required}
            onChange={setRequired}
            label="Seçim zorunlu"
            description="Varsayılan seçenek yoksa ürün eklenirken her seferinde sorulur"
          />

          <div className="flex flex-col gap-2">
            <p className="text-[14px] font-bold">Seçenekler</p>
            {options.map((o) => {
              const open = expanded === o.key;
              const cost = o.cost_mode === "fixed" ? (o.fixed_cost ?? 0) : recipeCost(fromDraft(o.lines), ingredients);
              return (
                <div key={o.key} className={cn("rounded-xl border", o.is_active ? "border-stone-200" : "border-dashed border-stone-300 bg-stone-50")}>
                  <div className="grid grid-cols-[1fr_110px_auto] items-center gap-2 p-2">
                    <Input value={o.name} onChange={(e) => patch(o.key, { name: e.target.value })} placeholder="Seçenek adı" className="h-10" maxLength={40} />
                    <NumberInput value={o.price_delta} onValueChange={(v) => patch(o.key, { price_delta: v })} suffix={currencySymbol()} allowNegative inputClassName="h-10" aria-label="Fiyat farkı" placeholder="+0" />
                    <button
                      type="button"
                      onClick={() => setExpanded(open ? null : o.key)}
                      className="grid size-10 place-items-center rounded-lg text-stone-500 hover:bg-stone-100"
                      aria-label="Ayrıntılar"
                      aria-expanded={open}
                    >
                      <ChevronDown className={cn("size-5 transition", open && "rotate-180")} />
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 px-3 pb-2 text-[13px]">
                    <button
                      type="button"
                      onClick={() => setDefault(o.key)}
                      className={cn("rounded-full px-2.5 py-1 font-semibold", o.is_default ? "bg-stone-900 text-white" : "bg-stone-100 text-stone-600")}
                    >
                      {o.is_default ? "Varsayılan ✓" : "Varsayılan yap"}
                    </button>
                    <span className="text-stone-500">Maliyet farkı: {signed(cost)}</span>
                  </div>
                  {open && (
                    <div className="flex flex-col gap-3 border-t border-stone-100 p-3">
                      <Segmented
                        size="sm"
                        value={o.cost_mode}
                        onChange={(v) => patch(o.key, { cost_mode: v })}
                        options={[
                          { value: "fixed", label: "Sabit tutar" },
                          { value: "recipe", label: "Reçete" },
                        ]}
                      />
                      {o.cost_mode === "fixed" ? (
                        <Field label="Maliyet farkı" hint="Negatif olabilir (örn. malzemeyi azaltan seçenekler)">
                          <NumberInput value={o.fixed_cost} onValueChange={(v) => patch(o.key, { fixed_cost: v })} suffix={currencySymbol()} allowNegative decimals={4} />
                        </Field>
                      ) : (
                        <>
                          <p className="text-[12px] text-stone-500">Eklenen malzemeyi pozitif, çıkanı negatif gir. Örn. vegan süt: +170 ml yulaf sütü, −170 ml tam yağlı süt.</p>
                          <RecipeEditor lines={o.lines} onChange={(lines) => patch(o.key, { lines })} ingredients={data.ingredients} allowNegative />
                        </>
                      )}
                      <div className="flex items-center justify-between">
                        <Toggle checked={o.is_active} onChange={(v) => patch(o.key, { is_active: v })} label="Aktif" />
                        <button
                          type="button"
                          onClick={() => setOptions((prev) => prev.filter((x) => x.key !== o.key))}
                          className="flex items-center gap-1 text-[13px] font-semibold text-red-600"
                        >
                          <Trash2 className="size-4" /> Seçeneği kaldır
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            <button
              type="button"
              onClick={() => {
                const key = `n${Date.now()}`;
                setOptions((prev) => [
                  ...prev,
                  { key, id: null, name: "", price_delta: null, cost_mode: "fixed", fixed_cost: null, is_default: false, is_active: true, lines: [] },
                ]);
              }}
              className="flex h-11 items-center justify-center gap-2 rounded-xl border border-dashed border-stone-300 text-[14px] font-semibold text-stone-600 hover:border-brand-400 hover:text-brand-700"
            >
              <Plus className="size-4" /> Seçenek ekle
            </button>
          </div>
        </div>
      </Sheet>
      <ConfirmSheet
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={remove}
        pending={saving}
        danger
        title={`${group?.name} grubu silinsin mi?`}
        description="Grup tüm ürünlerden kaldırılır. Geçmiş satışlardaki seçenek adları raporlarda korunur."
        confirmLabel="Sil"
      />
    </>
  );
}
