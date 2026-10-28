import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { VIZ } from "./chart-kit";

/**
 * Yatay çubuk listesi: uzun adlar için okunaklı, değerler doğrudan etiketli
 * (ipucuna gerek bırakmaz). Tek seri → tek renk.
 */
export function BarList({
  items,
  color = VIZ.primary,
  emptyText = "Veri yok",
}: {
  items: { key: string; label: ReactNode; value: number; display: ReactNode; sub?: ReactNode }[];
  color?: string;
  emptyText?: string;
}) {
  const max = Math.max(0, ...items.map((i) => i.value));
  if (items.length === 0) return <p className="py-6 text-center text-[14px] text-stone-500">{emptyText}</p>;
  return (
    <ul className="flex flex-col gap-2.5">
      {items.map((item) => (
        <li key={item.key}>
          <div className="flex items-baseline justify-between gap-3 text-[14px]">
            <span className="min-w-0 truncate font-medium text-stone-800">{item.label}</span>
            <span className="shrink-0 font-semibold tabular-nums text-stone-900">{item.display}</span>
          </div>
          <div className="mt-1 flex items-center gap-2">
            <div className="h-2 flex-1 rounded-full bg-stone-100">
              <div className={cn("h-2 rounded-full")} style={{ width: `${max > 0 ? Math.max(2, (item.value / max) * 100) : 0}%`, background: color }} />
            </div>
            {item.sub && <span className="shrink-0 text-[12px] text-stone-500">{item.sub}</span>}
          </div>
        </li>
      ))}
    </ul>
  );
}
