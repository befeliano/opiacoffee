"use client";

import { useState } from "react";
import { recalculateCostsAction } from "@/app/(panel)/[cafe]/menu/actions";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { addDays, monthStart } from "@/lib/domain/time";
import { num } from "@/lib/format";

/**
 * Maliyetler sonradan girildiğinde, geçmiş satışların maliyetini güncel
 * reçetelerle yeniden hesaplar (raporlardaki kâr rakamları düzelir).
 */
export function RecalculateSheet({ cafeId, open, onClose, today }: { cafeId: string; open: boolean; onClose: () => void; today: string }) {
  const toast = useToast();
  const [from, setFrom] = useState(monthStart(today));
  const [to, setTo] = useState(today);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    const result = await recalculateCostsAction(cafeId, from, to).catch(() => null);
    setBusy(false);
    if (!result || !result.ok) return toast.show(result?.ok === false ? result.error : "Bağlantı sorunu.", "error");
    toast.show(`${num(result.data.updated, 0)} satış satırının maliyeti güncellendi`);
    onClose();
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Geçmiş maliyetleri güncelle"
      description="Satış anında kaydedilen maliyetler, güncel reçete ve alış fiyatlarıyla yeniden hesaplanır."
      size="sm"
      footer={
        <Button size="lg" className="w-full" onClick={run} disabled={busy || !from || !to || from > to}>
          {busy ? "Hesaplanıyor…" : "Yeniden hesapla"}
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="rounded-xl bg-amber-50 px-3 py-2.5 text-[13px] text-amber-900">
          Maliyetleri ilk kez girdiysen ya da fiyatlar yanlıştıysa kullan. Fiyat artışlarından sonra kullanma; eski satışlar eski maliyetle kalmalı.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Başlangıç">
            <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="h-11 rounded-xl border border-stone-200 px-3 text-[15px]" />
          </Field>
          <Field label="Bitiş">
            <input type="date" value={to} min={from} max={today} onChange={(e) => setTo(e.target.value)} className="h-11 rounded-xl border border-stone-200 px-3 text-[15px]" />
          </Field>
        </div>
        <div className="flex flex-wrap gap-2">
          {[
            { label: "Bu ay", from: monthStart(today) },
            { label: "Son 30 gün", from: addDays(today, -29) },
            { label: "Son 90 gün", from: addDays(today, -89) },
          ].map((p) => (
            <button key={p.label} type="button" onClick={() => { setFrom(p.from); setTo(today); }} className="h-9 rounded-lg bg-stone-100 px-3 text-[13px] font-semibold text-stone-700">
              {p.label}
            </button>
          ))}
        </div>
      </div>
    </Sheet>
  );
}
