"use client";

import { useState, type ReactNode } from "react";
import { compactNumber, niceTicks, Tooltip, useWidth, VIZ } from "./chart-kit";

export interface LineSeries {
  id: string;
  label: string;
  color: string;
  /** x dizisiyle aynı uzunlukta; null = veri yok */
  values: (number | null)[];
  dashed?: boolean;
  /** Belirsizlik bandı (tahmin) */
  band?: ({ low: number; high: number } | null)[];
  area?: boolean;
}

/**
 * Çizgi grafiği: 2px çizgiler, dikey imleç çizgisi en yakın noktaya yapışır,
 * ipucu o noktadaki tüm serileri listeler.
 */
export function LineChart({
  labels,
  series,
  height = 240,
  format = compactNumber,
  tooltipTitle,
  labelEvery,
}: {
  labels: string[];
  series: LineSeries[];
  height?: number;
  format?: (v: number) => string;
  tooltipTitle?: (index: number) => ReactNode;
  labelEvery?: number;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);

  const allValues = series.flatMap((s) => [...s.values, ...(s.band ?? []).map((b) => b?.high ?? null)]).filter((v): v is number => v !== null);
  const ticks = niceTicks(Math.max(1, ...allValues));
  const top = ticks[ticks.length - 1];
  const padL = 44;
  const padR = 8;
  const padB = 26;
  const padT = 10;
  const plotW = Math.max(0, width - padL - padR);
  const plotH = height - padB - padT;
  const n = labels.length;
  const x = (i: number) => padL + (n <= 1 ? plotW / 2 : (plotW * i) / (n - 1));
  const y = (v: number) => padT + plotH - (v / top) * plotH;
  const every = labelEvery ?? Math.max(1, Math.ceil(n / Math.max(1, Math.floor(plotW / 56))));

  const pathOf = (values: (number | null)[]) => {
    let d = "";
    let pen = false;
    values.forEach((v, i) => {
      if (v === null) {
        pen = false;
        return;
      }
      d += `${pen ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)} `;
      pen = true;
    });
    return d;
  };

  const bandPath = (band: ({ low: number; high: number } | null)[]) => {
    const idx = band.map((b, i) => (b ? i : -1)).filter((i) => i >= 0);
    if (idx.length < 2) return "";
    const upper = idx.map((i, k) => `${k ? "L" : "M"}${x(i).toFixed(1)},${y(band[i]!.high).toFixed(1)}`).join(" ");
    const lower = [...idx].reverse().map((i) => `L${x(i).toFixed(1)},${y(band[i]!.low).toFixed(1)}`).join(" ");
    return `${upper} ${lower} Z`;
  };

  const onMove = (clientX: number, rectLeft: number) => {
    if (n === 0 || plotW <= 0) return;
    const rel = clientX - rectLeft - padL;
    const i = Math.round((rel / plotW) * (n - 1));
    setHover(Math.min(n - 1, Math.max(0, i)));
  };

  return (
    <div
      ref={ref}
      className="relative w-full touch-pan-y select-none"
      style={{ height }}
      onPointerMove={(e) => onMove(e.clientX, e.currentTarget.getBoundingClientRect().left)}
      onPointerLeave={() => setHover(null)}
    >
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label="Çizgi grafiği">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={padL} x2={width - padR} y1={y(t)} y2={y(t)} stroke={t === 0 ? VIZ.axis : VIZ.grid} strokeWidth={1} />
              <text x={padL - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill={VIZ.muted}>
                {format(t)}
              </text>
            </g>
          ))}
          {labels.map((l, i) =>
            i % every === 0 ? (
              <text key={i} x={x(i)} y={height - 8} textAnchor="middle" fontSize={11} fill={VIZ.muted}>
                {l}
              </text>
            ) : null,
          )}
          {series.map((s) =>
            s.band ? <path key={`${s.id}-band`} d={bandPath(s.band)} fill={s.color} opacity={0.12} /> : null,
          )}
          {series.map((s) =>
            s.area ? (
              <path
                key={`${s.id}-area`}
                d={`${pathOf(s.values)} L${x(s.values.length - 1)},${y(0)} L${x(s.values.findIndex((v) => v !== null))},${y(0)} Z`}
                fill={s.color}
                opacity={0.1}
              />
            ) : null,
          )}
          {series.map((s) => (
            <path
              key={s.id}
              d={pathOf(s.values)}
              fill="none"
              stroke={s.color}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              strokeDasharray={s.dashed ? "5 4" : undefined}
            />
          ))}
          {hover !== null && (
            <g>
              <line x1={x(hover)} x2={x(hover)} y1={padT} y2={padT + plotH} stroke={VIZ.axis} strokeWidth={1} />
              {series.map((s) => {
                const v = s.values[hover];
                return v === null || v === undefined ? null : (
                  <circle key={s.id} cx={x(hover)} cy={y(v)} r={4.5} fill={s.color} stroke={VIZ.surface} strokeWidth={2} />
                );
              })}
            </g>
          )}
        </svg>
      )}
      {hover !== null && (
        <Tooltip x={x(hover)} y={padT + 6} width={width}>
          <p className="mb-1 font-semibold text-stone-300">{tooltipTitle ? tooltipTitle(hover) : labels[hover]}</p>
          {series.map((s) => {
            const v = s.values[hover];
            if (v === null || v === undefined) return null;
            return (
              <p key={s.id} className="flex items-center gap-2 whitespace-nowrap">
                <svg width="12" height="6" aria-hidden>
                  <line x1="0" y1="3" x2="12" y2="3" stroke={s.color} strokeWidth="2" strokeDasharray={s.dashed ? "3 2" : undefined} />
                </svg>
                <span className="text-[13px] font-bold">{format(v)}</span>
                <span className="text-stone-400">{s.label}</span>
              </p>
            );
          })}
        </Tooltip>
      )}
    </div>
  );
}
