"use client";

import { useState, type ReactNode } from "react";
import { niceTicks, Tooltip, useWidth, VIZ } from "./chart-kit";

export interface ScatterPoint {
  key: string;
  x: number;
  y: number;
  label: string;
  tooltip: ReactNode;
  emphasize?: boolean;
}

/** Dörtgen eşik çizgili nokta grafiği (tek seri, tek renk) */
export function ScatterChart({
  points,
  xThreshold,
  yThreshold,
  height = 300,
  formatX,
  formatY,
  quadrantLabels,
  xLabel,
  yLabel,
}: {
  points: ScatterPoint[];
  xThreshold: number;
  yThreshold: number;
  height?: number;
  formatX: (v: number) => string;
  formatY: (v: number) => string;
  quadrantLabels: { tl: string; tr: string; bl: string; br: string };
  xLabel: string;
  yLabel: string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);

  const padL = 52;
  const padR = 12;
  const padT = 14;
  const padB = 40;
  const xMaxRaw = Math.max(xThreshold * 1.5, ...points.map((p) => p.x));
  const yMinRaw = Math.min(0, ...points.map((p) => p.y));
  const yMaxRaw = Math.max(yThreshold * 1.5, ...points.map((p) => p.y));
  const xTicks = niceTicks(xMaxRaw, 4);
  const yTicks = niceTicks(yMaxRaw, 4);
  const xMax = xTicks[xTicks.length - 1];
  const yMax = yTicks[yTicks.length - 1];
  const yMin = yMinRaw < 0 ? -yMax * 0.1 : 0;
  const plotW = Math.max(0, width - padL - padR);
  const plotH = height - padT - padB;
  const sx = (v: number) => padL + (v / xMax) * plotW;
  const sy = (v: number) => padT + plotH - ((v - yMin) / (yMax - yMin)) * plotH;

  const labeled = new Set(points.filter((p) => p.emphasize).map((p) => p.key));

  return (
    <div ref={ref} className="relative w-full select-none" style={{ height }}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label="Menü mühendisliği grafiği">
          {yTicks.map((t) => (
            <g key={`y${t}`}>
              <line x1={padL} x2={width - padR} y1={sy(t)} y2={sy(t)} stroke={t === 0 ? VIZ.axis : VIZ.grid} />
              <text x={padL - 8} y={sy(t)} dy="0.32em" textAnchor="end" fontSize={11} fill={VIZ.muted}>
                {formatY(t)}
              </text>
            </g>
          ))}
          {xTicks.map((t) => (
            <text key={`x${t}`} x={sx(t)} y={padT + plotH + 16} textAnchor="middle" fontSize={11} fill={VIZ.muted}>
              {formatX(t)}
            </text>
          ))}
          <text x={padL + plotW / 2} y={height - 4} textAnchor="middle" fontSize={11} fill={VIZ.muted}>
            {xLabel}
          </text>
          <text transform={`translate(12 ${padT + plotH / 2}) rotate(-90)`} textAnchor="middle" fontSize={11} fill={VIZ.muted}>
            {yLabel}
          </text>

          {/* Eşik çizgileri */}
          <line x1={sx(xThreshold)} x2={sx(xThreshold)} y1={padT} y2={padT + plotH} stroke={VIZ.axis} strokeWidth={1} />
          <line x1={padL} x2={width - padR} y1={sy(yThreshold)} y2={sy(yThreshold)} stroke={VIZ.axis} strokeWidth={1} />

          <text x={padL + 6} y={padT + 12} fontSize={11} fontWeight={600} fill={VIZ.muted}>
            {quadrantLabels.tl}
          </text>
          <text x={width - padR - 6} y={padT + 12} textAnchor="end" fontSize={11} fontWeight={600} fill={VIZ.muted}>
            {quadrantLabels.tr}
          </text>
          <text x={padL + 6} y={padT + plotH - 6} fontSize={11} fontWeight={600} fill={VIZ.muted}>
            {quadrantLabels.bl}
          </text>
          <text x={width - padR - 6} y={padT + plotH - 6} textAnchor="end" fontSize={11} fontWeight={600} fill={VIZ.muted}>
            {quadrantLabels.br}
          </text>

          {points.map((p, i) => (
            <g key={p.key}>
              <circle cx={sx(p.x)} cy={sy(p.y)} r={hover === i ? 6.5 : 5} fill={VIZ.primary} stroke={VIZ.surface} strokeWidth={2} />
              {labeled.has(p.key) && (
                <text x={sx(p.x) + 8} y={sy(p.y)} dy="0.32em" fontSize={11} fill={VIZ.ink}>
                  {p.label}
                </text>
              )}
              <circle
                cx={sx(p.x)}
                cy={sy(p.y)}
                r={13}
                fill="transparent"
                tabIndex={0}
                aria-label={p.label}
                onPointerEnter={() => setHover(i)}
                onPointerLeave={() => setHover(null)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
              />
            </g>
          ))}
        </svg>
      )}
      {hover !== null && points[hover] && (
        <Tooltip x={sx(points[hover].x)} y={sy(points[hover].y) - 6} width={width}>
          {points[hover].tooltip}
        </Tooltip>
      )}
    </div>
  );
}
