"use client";

import { useRef, useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp, GripVertical } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Sürükle-bırak ile sıralanan liste. Tutamaçtan (⋮⋮) basılı tutup sürükle;
 * dokunmatik ekranda da çalışır. Oklar klavye/erişilebilirlik içindir.
 * Bırakınca yeni sıra onReorder ile bildirilir.
 */
export function SortableList<T>({
  items,
  getKey,
  renderItem,
  onReorder,
  disabled,
  className,
}: {
  items: T[];
  getKey: (item: T) => string;
  renderItem: (item: T) => ReactNode;
  onReorder: (keys: string[]) => void;
  disabled?: boolean;
  className?: string;
}) {
  const keysOf = (list: T[]) => list.map(getKey).join("|");
  const [order, setOrder] = useState<T[]>(items);
  const [source, setSource] = useState(keysOf(items));
  const [dragging, setDragging] = useState<string | null>(null);
  const rowRefs = useRef(new Map<string, HTMLLIElement>());
  const startOrder = useRef("");

  // Dışarıdan yeni liste gelince (kayıt sonrası) yerel sırayı yenile
  if (keysOf(items) !== source && !dragging) {
    setSource(keysOf(items));
    setOrder(items);
  }

  const commit = (next: T[]) => {
    if (keysOf(next) !== startOrder.current) onReorder(next.map(getKey));
  };

  const move = (from: number, to: number) => {
    if (to < 0 || to >= order.length || from === to) return;
    const next = [...order];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    startOrder.current = keysOf(order);
    setOrder(next);
    commit(next);
  };

  const onPointerDown = (event: React.PointerEvent, key: string) => {
    if (disabled) return;
    event.preventDefault();
    (event.target as HTMLElement).setPointerCapture(event.pointerId);
    startOrder.current = keysOf(order);
    setDragging(key);
  };

  const onPointerMove = (event: React.PointerEvent) => {
    if (!dragging) return;
    const y = event.clientY;
    setOrder((prev) => {
      const from = prev.findIndex((i) => getKey(i) === dragging);
      if (from < 0) return prev;
      // Parmağın altındaki satırın ortasını geçince yer değiştir
      for (let to = 0; to < prev.length; to++) {
        if (to === from) continue;
        const el = rowRefs.current.get(getKey(prev[to]));
        if (!el) continue;
        const r = el.getBoundingClientRect();
        const mid = r.top + r.height / 2;
        if ((to < from && y < mid) || (to > from && y > mid)) {
          const next = [...prev];
          const [item] = next.splice(from, 1);
          next.splice(to, 0, item);
          return next;
        }
      }
      return prev;
    });
  };

  const onPointerUp = () => {
    if (!dragging) return;
    setDragging(null);
    commit(order);
  };

  return (
    <ul className={cn("flex flex-col gap-2", className)}>
      {order.map((item, index) => {
        const key = getKey(item);
        return (
          <li
            key={key}
            ref={(el) => {
              if (el) rowRefs.current.set(key, el);
              else rowRefs.current.delete(key);
            }}
            className={cn(
              "flex items-center gap-2 rounded-xl border bg-white px-2 py-1.5 transition-shadow",
              dragging === key ? "z-10 border-brand-400 shadow-float" : "border-stone-200",
            )}
          >
            <button
              type="button"
              aria-label="Sürükleyerek sırala"
              disabled={disabled}
              onPointerDown={(e) => onPointerDown(e, key)}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              className="grid size-9 shrink-0 cursor-grab touch-none place-items-center rounded-lg text-stone-400 hover:bg-stone-100 active:cursor-grabbing disabled:opacity-40"
            >
              <GripVertical className="size-5" />
            </button>
            <div className="min-w-0 flex-1">{renderItem(item)}</div>
            <div className="flex shrink-0">
              <button
                type="button"
                aria-label="Yukarı taşı"
                disabled={disabled || index === 0}
                onClick={() => move(index, index - 1)}
                className="grid size-8 place-items-center rounded-lg text-stone-500 hover:bg-stone-100 disabled:opacity-30"
              >
                <ChevronUp className="size-4" />
              </button>
              <button
                type="button"
                aria-label="Aşağı taşı"
                disabled={disabled || index === order.length - 1}
                onClick={() => move(index, index + 1)}
                className="grid size-8 place-items-center rounded-lg text-stone-500 hover:bg-stone-100 disabled:opacity-30"
              >
                <ChevronDown className="size-4" />
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
