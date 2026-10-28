"use client";

import { useSyncExternalStore } from "react";
import { Eye, EyeOff } from "lucide-react";
import type { FloorData } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { pct, tl } from "@/lib/format";

const STORAGE_KEY = "ad_money_hidden";

// Gizleme tercihi cihazda saklanır (küçük harici depo — React önerdiği yöntem)
const listeners = new Set<() => void>();
let cached: boolean | null = null;

function readHidden() {
  if (cached === null) {
    try {
      cached = localStorage.getItem(STORAGE_KEY) === "1";
    } catch {
      cached = false;
    }
  }
  return cached;
}

function setHiddenValue(next: boolean) {
  cached = next;
  try {
    localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
  } catch {
    // gizli sekmede depolama kapalı olabilir
  }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Günün rakamları — anlık. Toplam ciro = ödenen + açık hesaplar.
 * Ciro kapsamı "hiç" olana günün özeti gelmez; kâr yalnızca yetkisi olana.
 * Göz düğmesiyle gizlenir (tercih cihazda saklanır, müşteri yanında rahat olsun).
 */
export function TodayStats({
  today,
  open,
  occupied,
  total,
}: {
  today: FloorData["today"];
  /** Açık adisyonlar: toplam, alınan kısmi ödemeler, kalan */
  open: { total: number; paid: number; remaining: number };
  occupied: number;
  total: number;
}) {
  const hidden = useSyncExternalStore(subscribe, readHidden, () => false);
  const toggle = () => setHiddenValue(!hidden);

  const money = (value: number) => (hidden ? "••••" : tl(value, { decimals: "never" }));

  return (
    <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap sm:items-stretch">
      <Stat label="Dolu masa" value={`${occupied}/${total}`} />
      {today && <Stat label="Toplam ciro" value={money(today.revenue + open.total)} strong />}
      {today && <Stat label="Ödenen" value={money(today.revenue + open.paid)} />}
      <Stat label="Açık hesap" value={money(open.remaining)} highlight={open.remaining > 0} />
      {today && (
        <>
          {today.profit != null && (
            <Stat
              label="Kâr"
              value={money(today.profit)}
              tone={today.profit >= 0 ? "good" : "bad"}
              sub={!hidden && today.revenue > 0 ? pct(today.profit / today.revenue, 0) : undefined}
            />
          )}
          <button
            type="button"
            onClick={toggle}
            aria-pressed={hidden}
            aria-label={hidden ? "Tutarları göster" : "Tutarları gizle"}
            title={hidden ? "Tutarları göster" : "Tutarları gizle"}
            className="grid min-h-12 place-items-center rounded-2xl border border-stone-200 bg-white text-stone-500 transition hover:text-stone-800 sm:w-11 sm:shrink-0"
          >
            {hidden ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
          </button>
        </>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  highlight,
  muted,
  strong,
  tone,
  sub,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  muted?: boolean;
  strong?: boolean;
  tone?: "good" | "bad";
  sub?: string;
}) {
  return (
    <div
      className={cn(
        "min-w-0 rounded-2xl border px-3 py-2 sm:shrink-0 sm:px-3.5",
        highlight ? "border-brand-200 bg-brand-50" : strong ? "border-stone-300 bg-white shadow-card" : "border-stone-200 bg-white",
      )}
    >
      <p className="truncate whitespace-nowrap text-[10.5px] font-semibold uppercase tracking-wide text-stone-500 sm:text-[11px]">{label}</p>
      <p
        className={cn(
          "truncate whitespace-nowrap text-[15px] font-extrabold tabular-nums sm:text-[17px]",
          highlight && "text-brand-800",
          muted && "text-stone-500",
          tone === "good" && "text-emerald-700",
          tone === "bad" && "text-red-700",
        )}
      >
        {value}
        {sub && <span className="ml-1 text-[12px] font-semibold text-stone-400">{sub}</span>}
      </p>
    </div>
  );
}
