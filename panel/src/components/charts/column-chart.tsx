"use client";

import { useState, type ReactNode } from "react";
import { compactNumber, niceTicks, Tooltip, useWidth, VIZ } from "./chart-kit";

export interface Column {
  key: string;
  label: string;
  value: number;
  color?: string;
  /** Karşılaştırma değeri (ör. geçen hafta) — ince gri işaret olarak çizilir */
  compare?: number | null;
  tooltip?: ReactNode;
}

/**
 * Dikey sütun grafiği: ≤24px ince sütunlar, 4px yuvarlak uç, tek taban çizgisi,
 * saç teli ızgara, sütun başına imleç ipucu.
 */
export function ColumnChart({
  data,
  height = 220,
  format = compactNumber,
  highlightKey,
  labelEvery,
}: {
  data: Column[];
  height?: number;
  format?: (v: number) => string;
  highlightKey?: string | null;
  labelEvery?: number;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);

  const max = Math.max(1, ...data.map((d) => Math.max(d.value, d.compare ?? 0)));
  const ticks = niceTicks(max);
  const top = ticks[ticks.length - 1];
  const padL = 44;
  const padB = 26;
  const padT = 8;
  const plotW = Math.max(0, width - padL - 4);
  const plotH = height - padB - padT;
  const band = data.length ? plotW / data.length : 0;
  const barW = Math.max(3, Math.min(24, band * 0.62));
  const y = (v: number) => padT + plotH - (v / top) * plotH;
  const every = labelEvery ?? Math.max(1, Math.ceil(data.length / Math.max(1, Math.floor(plotW / 44))));

  return (
    <div ref={ref} className="relative w-full select-none" style={{ height }}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label="Sütun grafiği">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={padL} x2={width - 4} y1={y(t)} y2={y(t)} stroke={t === 0 ? VIZ.axis : VIZ.grid} strokeWidth={1} />
              <text x={padL - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill={VIZ.muted}>
                {format(t)}
              </text>
            </g>
          ))}
          {data.map((d, i) => {
            const cx = padL + band * i + band / 2;
            const h = Math.max(0, (d.value / top) * plotH);
            const r = Math.min(4, barW / 2, h);
            const x0 = cx - barW / 2;
            const yTop = padT + plotH - h;
            const faded = highlightKey && highlightKey !== d.key;
            const path =
              h <= 0
                ? ""
                : `M${x0},${padT + plotH} V${yTop + r} Q${x0},${yTop} ${x0 + r},${yTop} H${x0 + barW - r} Q${x0 + barW},${yTop} ${x0 + barW},${yTop + r} V${padT + plotH} Z`;
            return (
              <g key={d.key} opacity={faded ? 0.45 : hover !== null && hover !== i ? 0.75 : 1}>
                {path && <path d={path} fill={d.color ?? VIZ.primary} />}
                {d.compare != null && d.compare > 0 && (
                  <line x1={cx - barW / 2 - 3} x2={cx + barW / 2 + 3} y1={y(d.compare)} y2={y(d.compare)} stroke={VIZ.ink} strokeWidth={2} strokeLinecap="round" opacity={0.55} />
                )}
                {i % every === 0 && (
                  <text x={cx} y={height - 8} textAnchor="middle" fontSize={11} fill={VIZ.muted}>
                    {d.label}
                  </text>
                )}
                <rect
                  x={padL + band * i}
                  y={padT}
                  width={band}
                  height={plotH + padB}
                  fill="transparent"
                  tabIndex={0}
                  aria-label={`${d.label}: ${format(d.value)}`}
                  onPointerEnter={() => setHover(i)}
                  onPointerLeave={() => setHover(null)}
                  onFocus={() => setHover(i)}
                  onBlur={() => setHover(null)}
                />
              </g>
            );
          })}
        </svg>
      )}
      {hover !== null && data[hover] && (
        <Tooltip x={padL + band * hover + band / 2} y={y(Math.max(data[hover].value, data[hover].compare ?? 0))} width={width}>
          {data[hover].tooltip ?? (
            <>
              <p className="text-[14px] font-bold">{format(data[hover].value)}</p>
              <p className="text-stone-300">{data[hover].label}</p>
            </>
          )}
        </Tooltip>
      )}
    </div>
  );
}
