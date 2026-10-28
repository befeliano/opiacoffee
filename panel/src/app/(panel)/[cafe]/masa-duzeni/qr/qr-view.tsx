"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowLeft, Printer, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import QR from "@/lib/qr";
import { resetQrAction, setQrOrderingAction } from "./actions";

// Her masanın QR kodu: misafir okutunca /m/<kod> adresinden menü sipariş modunda açılır.
// "Yazdır" yalnızca kartları basar; kod yenilenirse eski basılı kod artık çalışmaz.

export interface QrData {
  ordering: boolean;
  tables: { id: string; name: string; token: string; is_active: boolean; is_takeaway: boolean }[];
}

export function QrView({ cafeId, slug, cafeName, siteUrl, data: initial }: { cafeId: string; slug: string; cafeName: string; siteUrl: string; data: QrData }) {
  const [data, setData] = useState(initial);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const tables = data.tables.filter((t) => !t.is_takeaway);
  const svgs = useMemo(() => new Map(tables.map((t) => [t.id, QR.svg(`${siteUrl}/m/${t.token}`, 2)])), [tables, siteUrl]);

  async function run(fn: () => Promise<{ ok: true; data: QrData } | { ok: false; error: string }>, done: string) {
    setBusy(true);
    const res = await fn();
    setBusy(false);
    if (res.ok) {
      setData(res.data);
      toast.show(done);
    } else toast.show(res.error, "error");
  }

  return (
    <main className="mx-auto max-w-6xl px-4 pb-28 pt-4 sm:px-6 md:pb-10 md:pt-6">
      <style>{`@media print { body * { visibility: hidden } .qr-print, .qr-print * { visibility: visible } .qr-print { position: absolute; inset: 0 } .qr-noprint { display: none } }`}</style>
      <div className="qr-noprint flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href={`/${slug}/masa-duzeni`} className="mb-1 inline-flex items-center gap-1 text-sm font-semibold text-stone-600">
            <ArrowLeft className="size-4" aria-hidden /> Masa düzeni
          </Link>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-[28px]">Masa QR kodları</h1>
          <p className="mt-1 max-w-2xl text-sm text-stone-600">
            Misafir kodu okutunca menü sipariş modunda açılır; siparişi masanın adisyonuna düşer ve Masalar ekranında bildirim çıkar. Ödeme kasada ya da masada alınır.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant={data.ordering ? "secondary" : "primary"}
            disabled={busy}
            onClick={() => run(() => setQrOrderingAction(cafeId, !data.ordering), data.ordering ? "QR sipariş kapatıldı" : "QR sipariş açıldı")}
          >
            {data.ordering ? "QR siparişi kapat" : "QR siparişi aç"}
          </Button>
          <Button onClick={() => window.print()}>
            <Printer className="size-4" aria-hidden /> Yazdır
          </Button>
        </div>
      </div>
      {!data.ordering && (
        <p className="qr-noprint mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">QR sipariş kapalı: kodlar şu an yalnızca menüyü açar.</p>
      )}

      <ul className="qr-print mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {tables.map((t) => (
          <li key={t.id} className="flex flex-col items-center gap-2 rounded-2xl border border-stone-200 bg-white p-3 text-center break-inside-avoid">
            <span lang="en" className="text-xs font-bold uppercase tracking-[0.18em] text-stone-500">{cafeName}</span>
            <div className="w-full max-w-[180px]" dangerouslySetInnerHTML={{ __html: svgs.get(t.id) ?? "" }} />
            <span className="text-lg font-extrabold">{t.name}</span>
            <span className="text-xs text-stone-500">Okut, menüden sipariş ver</span>
            {!t.is_active && <span className="qr-noprint text-xs font-semibold text-red-600">Masa kullanıma kapalı</span>}
            <button
              type="button"
              className="qr-noprint inline-flex items-center gap-1 text-xs font-semibold text-stone-500 hover:text-stone-800"
              disabled={busy}
              onClick={() => {
                if (confirm(`${t.name} için yeni kod üretilsin mi? Basılı eski kod çalışmaz.`)) run(() => resetQrAction(cafeId, t.id), "Kod yenilendi");
              }}
            >
              <RefreshCw className="size-3.5" aria-hidden /> Kodu yenile
            </button>
          </li>
        ))}
      </ul>
    </main>
  );
}
