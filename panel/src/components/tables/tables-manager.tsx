"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, Layers, Pencil, Plus, ShoppingBag, Trash2, Wand2 } from "lucide-react";
import {
  bulkCreateTablesAction,
  deleteAreaAction,
  deleteTableAction,
  reorderTablesAction,
  saveAreaAction,
  saveTableAction,
} from "@/app/(panel)/[cafe]/masa-duzeni/actions";
import { Button } from "@/components/ui/button";
import { Field, Input, NumberInput, Select, Toggle } from "@/components/ui/field";
import { ConfirmSheet, Sheet } from "@/components/ui/sheet";
import { SortableList } from "@/components/ui/sortable-list";
import { Badge, Card, CardHeader, PageHeader } from "@/components/ui/surface";
import { useToast } from "@/components/ui/toast";
import type { TablesAdminData } from "@/lib/api/types";
import { cn } from "@/lib/cn";

type Table = TablesAdminData["tables"][number];
type Area = TablesAdminData["areas"][number];

export function TablesManager({ cafeId, data }: { cafeId: string; data: TablesAdminData }) {
  const toast = useToast();
  const [editTable, setEditTable] = useState<Table | "new" | null>(null);
  const [editArea, setEditArea] = useState<Area | "new" | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const sections = [
    ...data.areas.map((a) => ({ area: a as Area | null, tables: data.tables.filter((t) => t.area_id === a.id) })),
    { area: null, tables: data.tables.filter((t) => !t.area_id) },
  ].filter((s) => s.area || s.tables.length > 0);

  const moveTable = async (table: Table, dir: -1 | 1) => {
    const ids = data.tables.map((t) => t.id);
    const siblings = data.tables.filter((t) => t.area_id === table.area_id);
    const pos = siblings.findIndex((t) => t.id === table.id);
    const swap = siblings[pos + dir];
    if (!swap) return;
    const a = ids.indexOf(table.id);
    const b = ids.indexOf(swap.id);
    [ids[a], ids[b]] = [ids[b], ids[a]];
    setBusy(true);
    const result = await reorderTablesAction(cafeId, "tables", ids).catch(() => null);
    setBusy(false);
    if (!result || !result.ok) toast.show(result?.ok === false ? result.error : "Bağlantı sorunu.", "error");
  };

  const reorderAreas = async (ids: string[]) => {
    setBusy(true);
    const result = await reorderTablesAction(cafeId, "areas", ids).catch(() => null);
    setBusy(false);
    if (!result || !result.ok) return toast.show(result?.ok === false ? result.error : "Bağlantı sorunu.", "error");
    toast.show("Alan sırası kaydedildi");
  };

  return (
    <main className="mx-auto max-w-6xl px-4 pb-28 pt-4 sm:px-6 md:pb-10 md:pt-6">
      <PageHeader
        title="Masa düzeni"
        description={`${data.tables.filter((t) => !t.is_takeaway).length} masa · ${data.areas.length} alan. Masa adlarını (B5, Z7…) istediğin gibi değiştirebilirsin.`}
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => setEditArea("new")}>
              <Layers className="size-4" /> Alan ekle
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setBulkOpen(true)}>
              <Wand2 className="size-4" /> Toplu ekle
            </Button>
            <Button size="sm" onClick={() => setEditTable("new")}>
              <Plus className="size-4" /> Masa ekle
            </Button>
          </>
        }
      />

      {data.areas.length > 1 && (
        <Card className="mt-6">
          <CardHeader title="Alan sırası" description="Masalar ekranındaki sekmeler (Tümü, Salon, Bahçe…) bu sırayla görünür. Tutamaçtan sürükle." />
          <div className="px-4 pb-4 pt-3 sm:px-5">
            <SortableList
              items={data.areas}
              getKey={(a) => a.id}
              disabled={busy}
              onReorder={reorderAreas}
              renderItem={(a) => (
                <span className="flex items-center justify-between gap-2 text-[15px] font-semibold">
                  {a.name}
                  <span className="text-[12px] font-medium text-stone-400">{data.tables.filter((t) => t.area_id === a.id).length} masa</span>
                </span>
              )}
            />
          </div>
        </Card>
      )}

      <div className="mt-6 flex flex-col gap-4">
        {sections.map((section) => (
          <Card key={section.area?.id ?? "none"} className="p-4 sm:p-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <h2 className="text-[16px] font-bold">{section.area?.name ?? "Alansız"}</h2>
                <Badge>{section.tables.length}</Badge>
              </div>
              {section.area && (
                <button
                  type="button"
                  onClick={() => setEditArea(section.area)}
                  className="flex items-center gap-1 rounded-lg px-2 py-1 text-[13px] font-semibold text-stone-600 hover:bg-stone-100"
                >
                  <Pencil className="size-3.5" /> Düzenle
                </button>
              )}
            </div>
            {section.tables.length === 0 ? (
              <p className="text-[14px] text-stone-500">Bu alanda masa yok.</p>
            ) : (
              <div className="grid grid-cols-3 gap-2 min-[480px]:grid-cols-4 sm:grid-cols-6 lg:grid-cols-8">
                {section.tables.map((t, i) => (
                  <div
                    key={t.id}
                    className={cn(
                      "group relative flex aspect-square flex-col rounded-xl border p-2",
                      t.is_active ? "border-stone-200 bg-white" : "border-dashed border-stone-300 bg-stone-50 text-stone-400",
                    )}
                  >
                    <button type="button" onClick={() => setEditTable(t)} className="flex flex-1 flex-col items-start text-left">
                      <span className="flex items-center gap-1 text-[18px] font-extrabold">
                        {t.is_takeaway && <ShoppingBag className="size-4 text-brand-600" />}
                        {t.name}
                      </span>
                      <span className="mt-auto text-[11px] font-medium text-stone-500">
                        {!t.is_active ? "Kapalı" : t.has_open_order ? "Açık adisyon" : t.is_takeaway ? "Gel-al" : ""}
                      </span>
                    </button>
                    <div className="absolute bottom-1 right-1 flex opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
                      <button type="button" disabled={busy || i === 0} onClick={() => moveTable(t, -1)} className="grid size-7 place-items-center rounded-md text-stone-400 hover:bg-stone-100 disabled:opacity-20" aria-label="Öne al">
                        <ArrowLeft className="size-3.5" />
                      </button>
                      <button type="button" disabled={busy || i === section.tables.length - 1} onClick={() => moveTable(t, 1)} className="grid size-7 place-items-center rounded-md text-stone-400 hover:bg-stone-100 disabled:opacity-20" aria-label="Sona al">
                        <ArrowRight className="size-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        ))}
      </div>

      {editTable && <TableEditor cafeId={cafeId} table={editTable === "new" ? null : editTable} areas={data.areas} onClose={() => setEditTable(null)} />}
      {editArea && <AreaEditor cafeId={cafeId} area={editArea === "new" ? null : editArea} onClose={() => setEditArea(null)} />}
      {bulkOpen && <BulkSheet cafeId={cafeId} areas={data.areas} onClose={() => setBulkOpen(false)} />}
    </main>
  );
}

function TableEditor({ cafeId, table, areas, onClose }: { cafeId: string; table: Table | null; areas: Area[]; onClose: () => void }) {
  const toast = useToast();
  const [name, setName] = useState(table?.name ?? "");
  const [areaId, setAreaId] = useState(table?.area_id ?? areas[0]?.id ?? "");
  const [takeaway, setTakeaway] = useState(table?.is_takeaway ?? false);
  const [active, setActive] = useState(table?.is_active ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const save = async () => {
    if (!name.trim()) return setError("Masa adı gerekli.");
    setSaving(true);
    const result = await saveTableAction(cafeId, {
      id: table?.id ?? null,
      name: name.trim(),
      area_id: areaId || null,
      is_takeaway: takeaway,
      is_active: active,
    }).catch(() => null);
    setSaving(false);
    if (!result) return setError("Bağlantı sorunu.");
    if (!result.ok) return setError(result.code === "E_DUPLICATE" ? "Bu adla bir masa zaten var." : result.error);
    toast.show(table ? "Masa güncellendi" : "Masa eklendi");
    onClose();
  };

  const remove = async () => {
    if (!table) return;
    setSaving(true);
    const result = await deleteTableAction(cafeId, table.id).catch(() => null);
    setSaving(false);
    setConfirmDelete(false);
    if (!result || !result.ok) return setError(result?.ok === false ? result.error : "Bağlantı sorunu.");
    toast.show("Masa silindi");
    onClose();
  };

  return (
    <>
      <Sheet
        open
        onClose={onClose}
        title={table ? `${table.name} masası` : "Yeni masa"}
        size="sm"
        footer={
          <div className="flex flex-col gap-2">
            {error && <p className="text-[14px] font-medium text-red-600">{error}</p>}
            <div className="flex gap-2">
              {table && (
                <Button variant="secondary" size="lg" className="text-red-600" onClick={() => setConfirmDelete(true)} aria-label="Masayı sil">
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
          <Field label="Masa adı" hint="Kısa tutmak salon ekranında okumayı kolaylaştırır (B5, Z7, Bahçe 3…)">
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={24} placeholder="örn. B5" autoFocus={!table} />
          </Field>
          <Field label="Alan">
            <Select value={areaId} onChange={(e) => setAreaId(e.target.value)}>
              <option value="">Alansız</option>
              {areas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </Field>
          <Toggle checked={takeaway} onChange={setTakeaway} label="Gel-al / paket" description="İşgal süresi raporlarına dahil edilmez" />
          <Toggle
            checked={active}
            onChange={setActive}
            label="Kullanımda"
            description={table?.has_open_order ? "Açık adisyon varken kapatılamaz" : "Kapalı masalar salon ekranında görünmez"}
            disabled={table?.has_open_order}
          />
        </div>
      </Sheet>
      <ConfirmSheet
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={remove}
        pending={saving}
        danger
        title={`${table?.name} silinsin mi?`}
        description="Geçmiş adisyonlar raporlarda masa adıyla kalır. Geçici olarak kullanmayacaksan 'Kullanımda' anahtarını kapatman yeterli."
        confirmLabel="Sil"
      />
    </>
  );
}

function AreaEditor({ cafeId, area, onClose }: { cafeId: string; area: Area | null; onClose: () => void }) {
  const toast = useToast();
  const [name, setName] = useState(area?.name ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const save = async () => {
    if (!name.trim()) return setError("Alan adı gerekli.");
    setSaving(true);
    const result = await saveAreaAction(cafeId, { id: area?.id ?? null, name: name.trim() }).catch(() => null);
    setSaving(false);
    if (!result) return setError("Bağlantı sorunu.");
    if (!result.ok) return setError(result.code === "E_DUPLICATE" ? "Bu adla bir alan zaten var." : result.error);
    toast.show(area ? "Alan güncellendi" : "Alan eklendi");
    onClose();
  };

  const remove = async () => {
    if (!area) return;
    setSaving(true);
    const result = await deleteAreaAction(cafeId, area.id).catch(() => null);
    setSaving(false);
    setConfirmDelete(false);
    if (!result || !result.ok) return setError(result?.ok === false ? result.error : "Bağlantı sorunu.");
    toast.show("Alan silindi");
    onClose();
  };

  return (
    <>
      <Sheet
        open
        onClose={onClose}
        title={area ? "Alanı düzenle" : "Yeni alan"}
        description="Örn. İç salon, Bahçe, Teras"
        size="sm"
        footer={
          <div className="flex flex-col gap-2">
            {error && <p className="text-[14px] font-medium text-red-600">{error}</p>}
            <div className="flex gap-2">
              {area && (
                <Button variant="secondary" size="lg" className="text-red-600" onClick={() => setConfirmDelete(true)} aria-label="Alanı sil">
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
        <Field label="Alan adı">
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} autoFocus />
        </Field>
      </Sheet>
      <ConfirmSheet
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={remove}
        pending={saving}
        danger
        title={`${area?.name} silinsin mi?`}
        description="Alandaki masalar silinmez, alansız olarak kalır."
        confirmLabel="Sil"
      />
    </>
  );
}

function BulkSheet({ cafeId, areas, onClose }: { cafeId: string; areas: Area[]; onClose: () => void }) {
  const toast = useToast();
  const [areaId, setAreaId] = useState(areas[0]?.id ?? "");
  const [prefix, setPrefix] = useState("B");
  const [from, setFrom] = useState<number | null>(1);
  const [to, setTo] = useState<number | null>(10);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const count = from !== null && to !== null && to >= from ? to - from + 1 : 0;
  const valid = count > 0 && count <= 100 && Number.isInteger(from) && Number.isInteger(to);
  const preview = valid ? (count <= 4 ? Array.from({ length: count }, (_, i) => `${prefix}${(from ?? 0) + i}`).join(", ") : `${prefix}${from}, ${prefix}${(from ?? 0) + 1} … ${prefix}${to}`) : "";

  const run = async () => {
    if (!valid) return setError("Geçerli bir aralık gir (en fazla 100 masa).");
    setSaving(true);
    const result = await bulkCreateTablesAction(cafeId, { areaId: areaId || null, prefix: prefix.trim(), from: from!, to: to! }).catch(() => null);
    setSaving(false);
    if (!result) return setError("Bağlantı sorunu.");
    if (!result.ok) return setError(result.error);
    toast.show(`${result.data.created} masa eklendi${result.data.created < count ? " (var olanlar atlandı)" : ""}`);
    onClose();
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title="Toplu masa ekle"
      size="sm"
      footer={
        <div className="flex flex-col gap-2">
          {error && <p className="text-[14px] font-medium text-red-600">{error}</p>}
          <Button size="lg" className="w-full" onClick={run} disabled={saving || !valid}>
            {saving ? "Ekleniyor…" : valid ? `${count} masa ekle` : "Masa ekle"}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Alan">
          <Select value={areaId} onChange={(e) => setAreaId(e.target.value)}>
            <option value="">Alansız</option>
            {areas.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Önek">
            <Input value={prefix} onChange={(e) => setPrefix(e.target.value.slice(0, 12))} placeholder="B" />
          </Field>
          <Field label="İlk no">
            <NumberInput value={from} onValueChange={setFrom} decimals={0} />
          </Field>
          <Field label="Son no">
            <NumberInput value={to} onValueChange={setTo} decimals={0} />
          </Field>
        </div>
        {preview && <p className="rounded-xl bg-brand-50 px-3 py-2.5 text-[14px] text-brand-900">Oluşacak: {preview}</p>}
      </div>
    </Sheet>
  );
}
