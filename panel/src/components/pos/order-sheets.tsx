"use client";

import { useState } from "react";
import { ArrowRightLeft, Merge } from "lucide-react";
import { Button, Spinner } from "@/components/ui/button";
import { Field, NumberInput } from "@/components/ui/field";
import { Sheet } from "@/components/ui/sheet";
import type { FloorData, FloorTable, Order } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { tl, currencySymbol } from "@/lib/format";
import { usePerms } from "@/components/shell/perms";

export function MoveSheet({
  floor,
  currentTableId,
  busy,
  onClose,
  onSelect,
}: {
  /** Pencere açılınca yüklenir (yüklenirken boş) */
  floor: FloorData | null;
  currentTableId: string;
  busy: boolean;
  onClose: () => void;
  onSelect: (table: FloorTable) => void;
}) {
  const [target, setTarget] = useState<FloorTable | null>(null);
  const tables = floor ? floor.tables.filter((t) => t.id !== currentTableId) : [];

  return (
    <Sheet
      open
      onClose={onClose}
      title="Masa değiştir"
      description="Boş masaya taşı ya da dolu masayla birleştir"
      size="lg"
      footer={
        <Button size="xl" className="w-full" disabled={!target || busy} onClick={() => target && onSelect(target)}>
          {target ? (target.order ? `${target.name} ile birleştir` : `${target.name} masasına taşı`) : "Masa seç"}
        </Button>
      }
    >
      {!floor && (
        <div className="grid h-32 place-items-center text-stone-400">
          <Spinner />
        </div>
      )}
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {tables.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTarget(t)}
            className={cn(
              "flex aspect-[4/3] flex-col items-start justify-between rounded-xl border-2 p-2.5 text-left transition",
              target?.id === t.id ? "border-brand-500 bg-brand-50" : t.order ? "border-stone-200 bg-stone-100" : "border-stone-200 bg-white",
            )}
          >
            <span className="text-[17px] font-extrabold">{t.name}</span>
            <span className="flex items-center gap-1 text-[12px] font-medium text-stone-500">
              {t.order ? (
                <>
                  <Merge className="size-3.5" /> {tl(t.order.total, { decimals: "never" })}
                </>
              ) : (
                <>
                  <ArrowRightLeft className="size-3.5" /> Boş
                </>
              )}
            </span>
          </button>
        ))}
      </div>
    </Sheet>
  );
}

export function OrderMetaSheet({
  order,
  busy,
  onClose,
  onSave,
}: {
  order: Order;
  busy: boolean;
  onClose: () => void;
  onSave: (note: string, discount: number) => void;
}) {
  const perms = usePerms();
  const [note, setNote] = useState(order.note);
  const [discount, setDiscount] = useState<number | null>(order.extra_discount || null);
  const value = discount ?? 0;
  const lineDiscount = Math.max(0, order.discount - order.extra_discount);
  const max = Math.max(0, order.subtotal - lineDiscount);
  const invalid = value < 0 || value > max;

  return (
    <Sheet
      open
      onClose={onClose}
      title={perms.discounts ? "Not ve indirim" : "Adisyon notu"}
      size="sm"
      footer={
        <Button size="xl" className="w-full" disabled={busy || invalid} onClick={() => onSave(note.trim(), value)}>
          Kaydet
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Adisyon notu" hint="Mutfak/bar için görünür not">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, 200))}
            placeholder="örn. doğum günü masası"
            className="h-11 rounded-xl border border-stone-200 px-3 text-[15px] outline-none focus:border-brand-500"
          />
        </Field>
        {perms.discounts && (
        <>
        <Field
          label="Tüm hesaba indirim"
          error={invalid ? "İndirim hesaptan büyük olamaz." : null}
          hint={lineDiscount > 0 ? `Ürün indirimleri (${tl(lineDiscount)}) ayrıca uygulanır` : `Tek ürüne indirim için ürüne dokun`}
        >
          <NumberInput value={discount} onValueChange={setDiscount} suffix={currencySymbol()} placeholder="0" />
        </Field>
        <div className="flex flex-wrap gap-2">
          {[0.05, 0.1, 0.15, 0.2].map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setDiscount(Math.round(max * r))}
              className="h-9 rounded-lg bg-stone-100 px-3 text-[13px] font-semibold text-stone-700"
            >
              %{r * 100}
            </button>
          ))}
          <button type="button" onClick={() => setDiscount(null)} className="h-9 rounded-lg bg-stone-100 px-3 text-[13px] font-semibold text-stone-700">
            Kaldır
          </button>
        </div>
        </>
        )}
      </div>
    </Sheet>
  );
}
