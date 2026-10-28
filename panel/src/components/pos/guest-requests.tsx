"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BellRing, QrCode, Receipt } from "lucide-react";
import { guestRequestsAction, guestUpdateAction } from "@/app/(panel)/[cafe]/masalar/guest-actions";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { tl } from "@/lib/format";

// Masadaki QR koddan gelen istekler: sipariş (kalemler adisyona zaten eklenmiştir),
// garson çağrısı ve hesap isteği. 5 saniyede bir yenilenir; yeni istek gelince kısa bir ses çalar.

export interface GuestRequest {
  id: number;
  table_id: string | null;
  table_name: string;
  kind: "order" | "garson" | "hesap";
  summary: string;
  note: string;
  total: number;
  status: "yeni" | "hazirlaniyor";
  created_at: string;
}

function beep() {
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AC();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
  } catch {
    // ses çalınamazsa görsel bildirim yeterli
  }
}

const minutesAgo = (iso: string) => Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));

export function GuestRequests({ cafeId, slug, initial, onChange }: { cafeId: string; slug: string; initial: GuestRequest[]; onChange?: () => void }) {
  const [items, setItems] = useState(initial);
  const [busy, setBusy] = useState<number | null>(null);
  const seen = useRef(new Set(initial.map((r) => r.id)));
  const toast = useToast();

  const apply = useCallback(
    (next: GuestRequest[]) => {
      const fresh = next.filter((r) => !seen.current.has(r.id));
      for (const r of next) seen.current.add(r.id);
      if (fresh.length) {
        beep();
        // Yeni QR siparişi adisyona eklendi; salon toplamları yenilensin
        if (fresh.some((r) => r.kind === "order")) onChange?.();
      }
      setItems(next);
    },
    [onChange],
  );

  useEffect(() => {
    const tick = async () => {
      if (document.visibilityState !== "visible") return;
      const res = await guestRequestsAction(cafeId);
      if (res.ok) apply(res.data);
    };
    const timer = setInterval(tick, 5000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [cafeId, apply]);

  async function update(r: GuestRequest, status: "hazirlaniyor" | "teslim") {
    setBusy(r.id);
    const res = await guestUpdateAction(cafeId, r.id, status);
    setBusy(null);
    if (res.ok) apply(res.data);
    else toast.show(res.error, "error");
  }

  if (!items.length) return null;

  return (
    <section aria-label="QR istekleri" className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((r) => {
        const Icon = r.kind === "order" ? QrCode : r.kind === "hesap" ? Receipt : BellRing;
        const title = r.kind === "order" ? "QR sipariş" : r.kind === "hesap" ? "Hesap istiyor" : "Garson çağırıyor";
        return (
          <article
            key={r.id}
            className={cn(
              "flex flex-col gap-2 rounded-2xl border p-3 shadow-card",
              r.status === "yeni" ? "border-brand-600 bg-brand-50" : "border-stone-200 bg-white",
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <a href={r.table_id ? `/${slug}/masalar/${r.table_id}` : undefined} className="flex items-center gap-2 font-extrabold">
                <Icon className="size-5" aria-hidden />
                <span>{r.table_name}</span>
                <span className="text-sm font-semibold text-stone-600">{title}</span>
              </a>
              <span className="text-xs font-semibold text-stone-500">{minutesAgo(r.created_at)} dk</span>
            </div>
            {r.kind === "order" && (
              <>
                <p className="text-[15px] leading-snug">{r.summary}</p>
                {r.note && <p className="rounded-lg bg-amber-50 px-2 py-1 text-sm text-amber-900">Not: {r.note}</p>}
                <p className="text-sm font-bold">{tl(r.total)}</p>
              </>
            )}
            <div className="flex gap-2">
              {r.kind === "order" && r.status === "yeni" ? (
                <Button size="sm" disabled={busy === r.id} onClick={() => update(r, "hazirlaniyor")}>Hazırlanıyor</Button>
              ) : null}
              <Button size="sm" variant={r.kind === "order" && r.status === "yeni" ? "secondary" : "primary"} disabled={busy === r.id} onClick={() => update(r, "teslim")}>
                {r.kind === "order" ? "Teslim edildi" : "Tamam"}
              </Button>
            </div>
          </article>
        );
      })}
    </section>
  );
}
