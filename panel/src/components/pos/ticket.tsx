"use client";

import { memo } from "react";
import { CheckCircle2, Gift, Minus, Plus, StickyNote } from "lucide-react";
import type { Order, OrderItem } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { formatTime } from "@/lib/domain/time";
import { tl } from "@/lib/format";
import { groupRounds } from "@/lib/pos/optimistic";

export function Ticket({
  order,
  timezone,
  onDelta,
  onEdit,
}: {
  order: Order | null;
  timezone: string;
  onDelta: (item: OrderItem, delta: number) => void;
  onEdit: (item: OrderItem) => void;
}) {
  if (!order || order.items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
        <div className="grid size-14 place-items-center rounded-2xl bg-brand-50 text-2xl">☕</div>
        <p className="mt-3 text-[15px] font-semibold text-stone-800">Adisyon boş</p>
        <p className="mt-1 text-[13px] text-stone-500">Menüden ürüne dokununca buraya eklenir.</p>
      </div>
    );
  }

  const rounds = groupRounds(order.items);

  return (
    <div className="pb-2">
      {order.note && (
        <p className="mx-4 mt-3 flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-[13px] text-amber-900">
          <StickyNote className="mt-0.5 size-4 shrink-0" />
          {order.note}
        </p>
      )}
      {rounds.map((round, ri) => (
        <section key={round.at + ri}>
          {rounds.length > 1 && (
            <p className="sticky top-0 z-10 bg-white/95 px-5 pb-1 pt-3 text-[11px] font-bold uppercase tracking-wider text-stone-400 backdrop-blur">
              {ri + 1}. sipariş · {formatTime(round.at, timezone)}
            </p>
          )}
          <ul className="divide-y divide-stone-100">
            {round.items.map((item) => (
              <TicketLine key={item.id} item={item} onDelta={onDelta} onEdit={onEdit} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

const TicketLine = memo(function TicketLine({
  item,
  onDelta,
  onEdit,
}: {
  item: OrderItem;
  onDelta: (item: OrderItem, delta: number) => void;
  onEdit: (item: OrderItem) => void;
}) {
  const temp = item.id.startsWith("tmp-");
  const net = item.unit_price - (item.unit_discount ?? 0);
  const split = item.split_parts ?? 1;
  const paidParts = item.paid_parts ?? item.paid_quantity ?? 0;
  // Ödenmiş paylar kaç adete denk geliyor (yukarı yuvarlanır: o adet azaltılamaz)
  const lockedQty = Math.ceil(paidParts / split);
  return (
    <li className={cn("flex items-center gap-2 px-3 py-2.5 sm:px-4", temp && "opacity-70")}>
      <button type="button" onClick={() => onEdit(item)} className="min-w-0 flex-1 rounded-lg px-1.5 py-1 text-left hover:bg-stone-50">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-[15px] font-semibold text-stone-900">{item.name}</span>
          {item.is_comp && (
            <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[11px] font-bold text-emerald-700">
              <Gift className="size-3" /> İkram
            </span>
          )}
          {split > 1 && (
            <span className="shrink-0 rounded-full bg-brand-50 px-1.5 py-0.5 text-[11px] font-bold text-brand-700">{split} kişiye bölündü</span>
          )}
          {paidParts > 0 && (
            <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-sky-50 px-1.5 py-0.5 text-[11px] font-bold text-sky-700">
              <CheckCircle2 className="size-3" />
              {paidParts === item.quantity * split ? "Ödendi" : split > 1 ? `${paidParts}/${item.quantity * split} pay ödendi` : `${paidParts} ödendi`}
            </span>
          )}
        </span>
        {(item.options_label || item.note) && (
          <span className="mt-0.5 block truncate text-[12px] text-stone-500">
            {[item.options_label, item.note && `“${item.note}”`].filter(Boolean).join(" · ")}
          </span>
        )}
        <span className={cn("mt-0.5 block text-[13px] font-semibold tabular-nums", item.is_comp ? "text-stone-400 line-through" : "text-stone-600")}>
          {item.quantity > 1 ? `${item.quantity} × ${tl(net)} = ` : ""}
          {tl(item.quantity * net)}
          {!item.is_comp && item.unit_discount > 0 && (
            <span className="ml-1.5 font-medium text-stone-400 line-through">{tl(item.quantity * item.unit_price)}</span>
          )}
          {!item.is_comp && item.unit_discount === 0 && item.unit_price !== item.list_price && item.list_price > 0 && (
            <span className="ml-1.5 text-[11px] font-medium text-stone-400">menü {tl(item.list_price)}</span>
          )}
        </span>
      </button>
      <div className="flex shrink-0 items-center rounded-xl border border-stone-200 bg-white">
        <button
          type="button"
          disabled={temp || item.quantity <= lockedQty}
          onClick={() => onDelta(item, -1)}
          className="grid size-10 place-items-center rounded-l-xl text-stone-600 hover:bg-stone-50 active:bg-stone-100 disabled:opacity-30"
          aria-label={`${item.name} azalt`}
        >
          <Minus className="size-4" />
        </button>
        <span className="w-7 text-center text-[15px] font-bold tabular-nums">{item.quantity}</span>
        <button
          type="button"
          disabled={temp}
          onClick={() => onDelta(item, 1)}
          className="grid size-10 place-items-center rounded-r-xl text-brand-700 hover:bg-brand-50 active:bg-brand-100"
          aria-label={`${item.name} artır`}
        >
          <Plus className="size-4" />
        </button>
      </div>
    </li>
  );
});
