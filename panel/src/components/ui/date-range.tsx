"use client";

import { useState } from "react";
import { Check } from "lucide-react";

/**
 * İki tarihli aralık seçici: "başlangıç – bitiş" + Uygula.
 * Bitiş bugünü geçemez; başlangıç bitişten sonra olamaz.
 */
export function DateRangePicker({
  from,
  to,
  max,
  onApply,
}: {
  from: string;
  to: string;
  /** Seçilebilecek son gün (bugün) */
  max: string;
  onApply: (from: string, to: string) => void;
}) {
  const [a, setA] = useState(from);
  const [b, setB] = useState(to);
  const valid = !!a && !!b && a <= b && b <= max;
  const changed = a !== from || b !== to;
  const input = "h-10 rounded-xl border border-stone-200 bg-white px-2.5 text-[14px] font-medium";

  return (
    <form
      className="flex flex-wrap items-center gap-1.5"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) onApply(a, b);
      }}
    >
      <input type="date" value={a} max={b || max} onChange={(e) => setA(e.target.value)} className={input} aria-label="Başlangıç" />
      <span className="text-stone-400">–</span>
      <input type="date" value={b} min={a} max={max} onChange={(e) => setB(e.target.value)} className={input} aria-label="Bitiş" />
      <button
        type="submit"
        disabled={!valid || !changed}
        className="flex h-10 items-center gap-1 rounded-xl bg-brand-600 px-3 text-[14px] font-semibold text-white hover:bg-brand-700 disabled:bg-stone-200 disabled:text-stone-500"
      >
        <Check className="size-4" /> Uygula
      </button>
    </form>
  );
}
