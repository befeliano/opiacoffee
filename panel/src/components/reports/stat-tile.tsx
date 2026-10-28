import type { ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/cn";
import { pct } from "@/lib/format";

export function StatTile({
  label,
  value,
  sub,
  deltas = [],
  emphasis,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  /** Karşılaştırmalar: artış iyiyse upGood=true */
  deltas?: { value: number | null; label: string; upGood?: boolean }[];
  emphasis?: boolean;
}) {
  return (
    <div className={cn("rounded-2xl border bg-white p-4 shadow-card", emphasis ? "border-brand-200" : "border-stone-200/80")}>
      <p className="text-[13px] font-semibold text-stone-500">{label}</p>
      <p className={cn("mt-1 text-[26px] font-extrabold leading-tight tracking-tight", emphasis && "text-brand-800")}>{value}</p>
      {sub && <p className="mt-0.5 text-[13px] text-stone-500">{sub}</p>}
      {deltas.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
          {deltas.map((d) => (
            <Delta key={d.label} {...d} />
          ))}
        </div>
      )}
    </div>
  );
}

export function Delta({ value, label, upGood = true }: { value: number | null; label: string; upGood?: boolean }) {
  if (value === null) {
    return <span className="text-[12px] text-stone-400">{label}: veri yok</span>;
  }
  const flat = Math.abs(value) < 0.005;
  const good = flat ? null : (value > 0) === upGood;
  const Icon = flat ? Minus : value > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-[12px] font-semibold", good === null ? "text-stone-500" : good ? "text-emerald-700" : "text-red-700")}>
      <Icon className="size-3.5" aria-hidden />
      {flat ? "aynı" : `${value > 0 ? "+" : "−"}${pct(Math.abs(value), 0)}`}
      <span className="font-medium text-stone-500">&nbsp;{label}</span>
    </span>
  );
}
