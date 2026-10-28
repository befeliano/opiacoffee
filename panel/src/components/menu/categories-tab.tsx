"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from "lucide-react";
import { deleteCategoryAction, reorderAction, saveCategoryAction } from "@/app/(panel)/[cafe]/menu/actions";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { ConfirmSheet, Sheet } from "@/components/ui/sheet";
import { Card, EmptyState } from "@/components/ui/surface";
import { useToast } from "@/components/ui/toast";
import type { MenuAdminData } from "@/lib/api/types";

type Category = MenuAdminData["categories"][number];

export function CategoriesTab({ cafeId, data }: { cafeId: string; data: MenuAdminData }) {
  const toast = useToast();
  const [editing, setEditing] = useState<Category | "new" | null>(null);
  const [deleting, setDeleting] = useState<Category | null>(null);
  const [busy, setBusy] = useState(false);

  const move = async (index: number, dir: -1 | 1) => {
    const ids = data.categories.map((c) => c.id);
    const target = index + dir;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    setBusy(true);
    const result = await reorderAction(cafeId, "categories", ids).catch(() => null);
    setBusy(false);
    if (!result || !result.ok) toast.show(result?.ok === false ? result.error : "Bağlantı sorunu.", "error");
  };

  const remove = async () => {
    if (!deleting) return;
    setBusy(true);
    const result = await deleteCategoryAction(cafeId, deleting.id).catch(() => null);
    setBusy(false);
    setDeleting(null);
    if (!result || !result.ok) return toast.show(result?.ok === false ? result.error : "Bağlantı sorunu.", "error");
    toast.show("Kategori silindi");
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[14px] text-stone-500">Satış ekranındaki sekmelerin sırası buradaki sırayla aynıdır.</p>
        <Button onClick={() => setEditing("new")}>
          <Plus className="size-5" /> Kategori ekle
        </Button>
      </div>
      <Card className="overflow-hidden">
        {data.categories.length === 0 ? (
          <EmptyState title="Kategori yok" />
        ) : (
          <ul className="divide-y divide-stone-100">
            {data.categories.map((c, i) => {
              const count = data.products.filter((p) => p.category_id === c.id).length;
              return (
                <li key={c.id} className="flex items-center gap-2 px-3 py-2.5 sm:px-4">
                  <div className="flex flex-col">
                    <button type="button" disabled={busy || i === 0} onClick={() => move(i, -1)} className="grid size-8 place-items-center rounded-lg text-stone-500 hover:bg-stone-100 disabled:opacity-30" aria-label="Yukarı taşı">
                      <ArrowUp className="size-4" />
                    </button>
                    <button type="button" disabled={busy || i === data.categories.length - 1} onClick={() => move(i, 1)} className="grid size-8 place-items-center rounded-lg text-stone-500 hover:bg-stone-100 disabled:opacity-30" aria-label="Aşağı taşı">
                      <ArrowDown className="size-4" />
                    </button>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-semibold">{c.name}</p>
                    <p className="text-[13px] text-stone-500">
                      {count} ürün{c.subtitle ? ` · ${c.subtitle}` : ""}
                    </p>
                  </div>
                  <button type="button" onClick={() => setEditing(c)} className="grid size-10 place-items-center rounded-lg text-stone-500 hover:bg-stone-100" aria-label="Düzenle">
                    <Pencil className="size-4" />
                  </button>
                  <button type="button" onClick={() => setDeleting(c)} className="grid size-10 place-items-center rounded-lg text-stone-400 hover:bg-red-50 hover:text-red-600" aria-label="Sil">
                    <Trash2 className="size-4" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {editing && <CategoryEditor cafeId={cafeId} category={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}

      <ConfirmSheet
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={remove}
        pending={busy}
        danger
        title={`${deleting?.name} silinsin mi?`}
        description="Kategorideki ürünler silinmez, 'Kategorisiz' olarak kalır."
        confirmLabel="Sil"
      />
    </div>
  );
}

function CategoryEditor({ cafeId, category, onClose }: { cafeId: string; category: Category | null; onClose: () => void }) {
  const toast = useToast();
  const [name, setName] = useState(category?.name ?? "");
  const [subtitle, setSubtitle] = useState(category?.subtitle ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (!name.trim()) return setError("Kategori adı gerekli.");
    setSaving(true);
    const result = await saveCategoryAction(cafeId, { id: category?.id ?? null, name: name.trim(), subtitle: subtitle.trim() }).catch(() => null);
    setSaving(false);
    if (!result) return setError("Bağlantı sorunu.");
    if (!result.ok) return setError(result.error);
    toast.show(category ? "Kategori güncellendi" : "Kategori eklendi");
    onClose();
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title={category ? "Kategoriyi düzenle" : "Yeni kategori"}
      size="sm"
      footer={
        <div className="flex flex-col gap-2">
          {error && <p className="text-[14px] font-medium text-red-600">{error}</p>}
          <Button size="lg" className="w-full" onClick={save} disabled={saving}>
            {saving ? "Kaydediliyor…" : "Kaydet"}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Kategori adı">
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="örn. Espresso Bar" autoFocus />
        </Field>
        <Field label="Alt başlık" hint="İsteğe bağlı, örn. Hot / Ice">
          <Input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} maxLength={60} />
        </Field>
      </div>
    </Sheet>
  );
}
