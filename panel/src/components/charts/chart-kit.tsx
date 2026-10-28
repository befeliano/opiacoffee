"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Table2, BarChart3 } from "lucide-react";
import { cn } from "@/lib/cn";

// Renkler CSS değişkenlerinden gelir; kafe teması (turuncu / bordo) otomatik uygulanır.
export const VIZ = {
  primary: "var(--chart-primary)",
  second: "var(--chart-second)",
  context: "var(--chart-context)",
  grid: "var(--chart-grid)",
  axis: "var(--chart-axis)",
  muted: "var(--chart-muted)",
  ink: "var(--chart-ink)",
  surface: "var(--chart-surface)",
  tiers: {
    calm: "var(--chart-tier-calm)",
    medium: "var(--chart-tier-medium)",
    busy: "var(--chart-tier-busy)",
  },
  heat: [
    "var(--chart-heat-1)",
    "var(--chart-heat-2)",
    "var(--chart-heat-3)",
    "var(--chart-heat-4)",
    "var(--chart-heat-5)",
    "var(--chart-heat-6)",
  ],
  heatZero: "var(--chart-heat-0)",
} as const;

/** Kapsayıcının piksel genişliğini izler (SVG'yi gerçek pikselde çizmek için) */
export function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => setWidth(Math.floor(entries[0].contentRect.width)));
    ro.observe(el);
    setWidth(Math.floor(el.getBoundingClientRect().width));
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

/** 0'dan başlayan okunaklı eksen değerleri */
export function niceTicks(max: number, count = 4): number[] {
  if (!Number.isFinite(max) || max <= 0) return [0, 1];
  const raw = max / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag;
  const top = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = 0; v <= top + step / 2; v += step) ticks.push(Math.round(v * 1000) / 1000);
  return ticks;
}

const compactFmt = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 1 });
export function compactNumber(v: number) {
  const a = Math.abs(v);
  if (a >= 1_000_000) return `${compactFmt.format(v / 1_000_000)} Mn`;
  if (a >= 1_000) return `${compactFmt.format(v / 1_000)} B`;
  return compactFmt.format(v);
}

export function ChartCard({
  title,
  description,
  action,
  table,
  children,
  className,
  footer,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  /** Grafiğin erişilebilir tablo karşılığı */
  table?: { columns: string[]; rows: (string | number)[][] };
  children: ReactNode;
  className?: string;
  footer?: ReactNode;
}) {
  const [showTable, setShowTable] = useState(false);
  return (
    <figure className={cn("rounded-2xl border border-stone-200/80 bg-white shadow-card", className)}>
      <figcaption className="flex items-start justify-between gap-3 px-4 pt-4 sm:px-5">
        <div className="min-w-0">
          <h3 className="text-[15px] font-bold text-stone-900">{title}</h3>
          {description && <p className="mt-0.5 text-[13px] text-stone-500">{description}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {action}
          {table && (
            <button
              type="button"
              onClick={() => setShowTable((v) => !v)}
              className="grid size-8 place-items-center rounded-lg text-stone-500 hover:bg-stone-100"
              aria-label={showTable ? "Grafik görünümü" : "Tablo görünümü"}
              title={showTable ? "Grafik görünümü" : "Tablo görünümü"}
            >
              {showTable ? <BarChart3 className="size-4" /> : <Table2 className="size-4" />}
            </button>
          )}
        </div>
      </figcaption>
      <div className="px-4 pb-4 pt-3 sm:px-5">
        {showTable && table ? (
          <div className="max-h-80 overflow-auto">
            <table className="w-full text-left text-[13px]">
              <thead className="sticky top-0 bg-white text-stone-500">
                <tr>
                  {table.columns.map((c, i) => (
                    <th key={c} className={cn("border-b border-stone-200 py-2 font-semibold", i > 0 && "text-right")}>
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.rows.map((r, ri) => (
                  <tr key={ri} className="border-b border-stone-100">
                    {r.map((cell, ci) => (
                      <td key={ci} className={cn("py-1.5", ci > 0 && "text-right tabular-nums")}>
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          children
        )}
      </div>
      {footer}
    </figure>
  );
}

/** Grafik üzerindeki imleç ipucu kutusu (kapsayıcıya göre konumlanır) */
export function Tooltip({ x, y, width, children }: { x: number; y: number; width: number; children: ReactNode }) {
  const left = Math.min(Math.max(x, 80), Math.max(width - 80, 80));
  return (
    <div
      role="status"
      className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-xl bg-stone-900 px-3 py-2 text-[12px] text-white shadow-float"
      style={{ left, top: Math.max(y - 10, 0) }}
    >
      {children}
    </div>
  );
}

export function LegendItem({ color, label, line, dashed }: { color: string; label: string; line?: boolean; dashed?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-stone-600">
      {line ? (
        <svg width="16" height="8" aria-hidden>
          <line x1="0" y1="4" x2="16" y2="4" stroke={color} strokeWidth="2" strokeDasharray={dashed ? "4 3" : undefined} strokeLinecap="round" />
        </svg>
      ) : (
        <span className="size-2.5 rounded-[3px]" style={{ background: color }} />
      )}
      {label}
    </span>
  );
}
