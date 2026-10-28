"use client";

import { useState } from "react";
import { WEEKDAYS_SHORT_TR, WEEKDAYS_TR } from "@/lib/domain/time";
import { num } from "@/lib/format";
import { VIZ } from "./chart-kit";

/** Haftanın günü × saat ısı haritası (tek renk tonu, açıktan koyuya) */
export function Heatmap({ matrix, hours, unit = "sipariş" }: { matrix: Map<number, number>[]; hours: number[]; unit?: string }) {
  const [hover, setHover] = useState<{ w: number; h: number } | null>(null);
  const max = Math.max(0, ...matrix.flatMap((m) => [...m.values()]));
  const colorFor = (v: number) => {
    if (v <= 0 || max <= 0) return VIZ.heatZero;
    const i = Math.min(VIZ.heat.length - 1, Math.floor((v / max) * VIZ.heat.length));
    return VIZ.heat[i];
  };

  return (
    <div>
      <div className="overflow-x-auto">
        <div className="inline-grid min-w-full gap-[2px]" style={{ gridTemplateColumns: `36px repeat(${hours.length}, minmax(22px, 1fr))` }}>
          <span />
          {hours.map((h) => (
            <span key={h} className="pb-1 text-center text-[10px] font-medium text-stone-500">
              {String(h).padStart(2, "0")}
            </span>
          ))}
          {matrix.map((row, w) => (
            <div key={w} className="contents">
              <span className="flex items-center text-[11px] font-semibold text-stone-500">{WEEKDAYS_SHORT_TR[w]}</span>
              {hours.map((h) => {
                const v = row.get(h) ?? 0;
                const active = hover?.w === w && hover?.h === h;
                return (
                  <button
                    key={h}
                    type="button"
                    onPointerEnter={() => setHover({ w, h })}
                    onFocus={() => setHover({ w, h })}
                    onPointerLeave={() => setHover(null)}
                    aria-label={`${WEEKDAYS_TR[w]} ${h}:00 — ortalama ${num(v, 1)} ${unit}`}
                    className="h-7 rounded-[4px] outline-offset-1"
                    style={{ background: colorFor(v), boxShadow: active ? `inset 0 0 0 2px ${VIZ.ink}` : undefined }}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[12px] text-stone-500">
        <span aria-live="polite" className="min-h-[18px] font-medium text-stone-700">
          {hover
            ? `${WEEKDAYS_TR[hover.w]} ${String(hover.h).padStart(2, "0")}:00 · ortalama ${num(matrix[hover.w].get(hover.h) ?? 0, 1)} ${unit}`
            : "Hücrenin üzerine gel ya da dokun"}
        </span>
        <span className="flex items-center gap-1.5">
          Az
          {VIZ.heat.map((c) => (
            <span key={c} className="h-2.5 w-4 rounded-[2px]" style={{ background: c }} />
          ))}
          Çok
        </span>
      </div>
    </div>
  );
}
