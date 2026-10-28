"use client";

import { useMemo, useState } from "react";
import { Banknote, Check, CreditCard, Divide, Minus, Percent, Plus, Tag, Ticket, Undo2 } from "lucide-react";
import { NumberInput } from "@/components/ui/field";
import { Sheet } from "@/components/ui/sheet";
import type { Order, OrderItem, PaymentMethod } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { pct, tl, currencySymbol } from "@/lib/format";
import { METHOD_LABEL, MethodIcon } from "@/lib/pos/payment-methods";
import { usePerms } from "@/components/shell/perms";

export type PayRequest =
  | { kind: "items"; lines: { itemId: string; quantity: number }[] }
  | { kind: "amount"; amount: number | null };

const round2 = (n: number) => Math.round(n * 100) / 100;
const SPLIT_OPTIONS = [2, 3, 4, 5, 6];

/** Satırın kaç payı ödenmedi (bölünmemiş satırda pay = adet) */
function openParts(item: OrderItem) {
  const split = item.split_parts ?? 1;
  return item.quantity * split - (item.paid_parts ?? item.paid_quantity ?? 0);
}

/** Bir payın tutarı */
function partPrice(item: OrderItem) {
  return (item.unit_price - item.unit_discount) / (item.split_parts ?? 1);
}

function payable(item: OrderItem) {
  return !item.id.startsWith("tmp-") && !item.is_comp && item.unit_price - item.unit_discount > 0 && openParts(item) > 0;
}

/** "¼", "2/3" gibi pay gösterimi */
function fraction(parts: number, split: number) {
  if (split === 1) return String(parts);
  const glyph: Record<string, string> = { "1/2": "½", "1/3": "⅓", "2/3": "⅔", "1/4": "¼", "3/4": "¾", "1/5": "⅕", "1/6": "⅙" };
  return glyph[`${parts}/${split}`] ?? `${parts}/${split}`;
}

/**
 * Ödeme: varsayılan olarak ödenmemiş tüm ürünler seçilidir; tek dokunuşla
 * hepsi ödenir. Ürünlerden bazıları seçilerek parça parça (biri kart, biri
 * nakit) ödenebilir. İstenirse tutar girerek de bölünebilir.
 */
export function PaymentSheet({
  order,
  tableName,
  commissionRate,
  ticketCommissionRate,
  busy,
  onClose,
  onPay,
  onDeletePayment,
  onDiscount,
  onEditItem,
  onSplit,
}: {
  order: Order;
  tableName: string;
  commissionRate: number;
  ticketCommissionRate: number;
  busy: boolean;
  onClose: () => void;
  onPay: (method: PaymentMethod, request: PayRequest) => void;
  onDeletePayment: (paymentId: string) => void;
  onDiscount: () => void;
  onEditItem: (item: OrderItem) => void;
  /** Satırı N kişiye böl (1 = bölmeyi kaldır) */
  onSplit: (item: OrderItem, parts: number) => void;
}) {
  const perms = usePerms();
  const lines = useMemo(() => order.items.filter(payable), [order.items]);
  const settled = useMemo(() => order.items.filter((i) => !payable(i) && !i.id.startsWith("tmp-")), [order.items]);

  // Seçim: satır → pay sayısı. Ödeme/bölme sonrası sıfırlanır (üst bileşen key verir).
  const [selection, setSelection] = useState<Map<string, number>>(() => new Map(lines.map((i) => [i.id, openParts(i)])));
  const [splitting, setSplitting] = useState<string | null>(null);
  const [mode, setMode] = useState<"items" | "amount">(() => (lines.length > 0 ? "items" : "amount"));
  const [amount, setAmount] = useState<number | null>(null);

  const remaining = order.remaining;
  const selectedTotal = round2(lines.reduce((s, i) => s + (selection.get(i.id) ?? 0) * partPrice(i), 0));
  const selectedCount = lines.reduce((s, i) => s + (selection.get(i.id) ?? 0), 0);
  const allSelected = lines.every((i) => (selection.get(i.id) ?? 0) === openParts(i));
  // Seçilenlerin dökümü: "Americano 190 ₺ + Brownie ¼ 67,50 ₺"
  const breakdown = lines
    .filter((i) => (selection.get(i.id) ?? 0) > 0)
    .map((i) => {
      const parts = selection.get(i.id)!;
      const split = i.split_parts ?? 1;
      // Bölünmüş kalemin tam adetleri seçildiyse pay yerine adet yaz
      const whole = parts % split === 0 ? parts / split : null;
      const label =
        split > 1 && whole === null ? `${i.name} ${fraction(parts, split)}` : (whole ?? parts) > 1 ? `${whole ?? parts}× ${i.name}` : i.name;
      return `${label} ${tl(round2(parts * partPrice(i)))}`;
    });
  // Adisyon indirimi ya da tutarla alınmış ödeme varsa kalanı aşmaz
  const itemsAmount = Math.min(selectedTotal, remaining);

  const payAmount = mode === "items" ? itemsAmount : (amount ?? 0);
  const amountValid = mode === "amount" ? amount !== null && amount > 0 && amount <= remaining + 0.001 : selectedCount > 0 && itemsAmount > 0;
  const closeOnly = remaining === 0 && order.items_count > 0;

  const setQty = (item: OrderItem, qty: number) =>
    setSelection((prev) => {
      const next = new Map(prev);
      next.set(item.id, Math.max(0, Math.min(openParts(item), qty)));
      return next;
    });

  const selectAll = (on: boolean) => setSelection(new Map(lines.map((i) => [i.id, on ? openParts(i) : 0])));

  const pay = (method: PaymentMethod) => {
    if (closeOnly) return onPay(method, { kind: "amount", amount: null });
    if (!amountValid) return;
    if (mode === "amount") {
      onPay(method, { kind: "amount", amount: round2(amount ?? 0) });
      setAmount(null);
      return;
    }
    const request: PayRequest = {
      kind: "items",
      lines: lines.filter((i) => (selection.get(i.id) ?? 0) > 0).map((i) => ({ itemId: i.id, quantity: selection.get(i.id)! })),
    };
    onPay(method, request);
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title={`${tableName} · Ödeme`}
      size="lg"
      footer={
        <div className="flex flex-col gap-2">
          {!closeOnly && mode === "items" && breakdown.length > 0 && (!allSelected || lines.some((i) => (i.split_parts ?? 1) > 1)) && (
            <p className="text-[12px] leading-snug text-stone-500">{breakdown.join(" + ")}</p>
          )}
          {!closeOnly && (
            <p className="flex items-baseline justify-between text-[14px]">
              <span className="font-semibold text-stone-500">
                {mode === "items" ? (allSelected ? "Hepsi seçili" : `${selectedCount} ürün seçili`) : "Girilen tutar"}
              </span>
              <span className="text-[26px] font-extrabold leading-none tabular-nums">{tl(payAmount)}</span>
            </p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <PayButton
              label="Nakit"
              sub={closeOnly ? "Tamamı ikram" : "Komisyon yok"}
              icon={<Banknote className="size-6" />}
              disabled={busy || (!closeOnly && !amountValid)}
              onClick={() => pay("cash")}
            />
            <PayButton
              label="Kart"
              sub={closeOnly ? "Tamamı ikram" : `Komisyon ${pct(commissionRate)} · ${tl(round2(payAmount * commissionRate))}`}
              icon={<CreditCard className="size-6" />}
              disabled={busy || (!closeOnly && !amountValid)}
              onClick={() => pay("card")}
              primary
            />
          </div>
          <button
            type="button"
            disabled={busy || (!closeOnly && !amountValid)}
            onClick={() => pay("ticket")}
            className="flex h-10 items-center justify-center gap-2 rounded-xl border border-stone-200 bg-white text-[14px] font-semibold text-stone-700 transition hover:bg-stone-50 active:scale-[0.99] disabled:opacity-50"
          >
            <Ticket className="size-4" /> Ticket ile öde
            {!closeOnly && ticketCommissionRate > 0 && (
              <span className="text-[12px] font-medium text-stone-400">
                · komisyon {pct(ticketCommissionRate)} · {tl(round2(payAmount * ticketCommissionRate))}
              </span>
            )}
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-end justify-between rounded-2xl bg-stone-900 px-5 py-4 text-white">
          <div>
            <p className="text-[13px] font-medium text-stone-400">{order.paid > 0 ? "Kalan" : "Hesap"}</p>
            <p className="mt-1 text-[34px] font-extrabold leading-none tabular-nums">{tl(remaining)}</p>
          </div>
          <dl className="grid grid-cols-[auto_auto] gap-x-3 gap-y-0.5 text-right text-[12px] text-stone-300">
            <dt>Ara toplam</dt>
            <dd className="tabular-nums">{tl(order.subtotal)}</dd>
            {order.discount > 0 && (
              <>
                <dt>İndirim</dt>
                <dd className="tabular-nums">−{tl(order.discount)}</dd>
              </>
            )}
            {order.paid > 0 && (
              <>
                <dt>Alınan</dt>
                <dd className="tabular-nums">−{tl(order.paid)}</dd>
              </>
            )}
          </dl>
        </div>

        {order.payments.length > 0 && (
          <ul className="flex flex-col gap-2">
            {order.payments.map((p) => (
              <li key={p.id} className="flex items-center gap-3 rounded-xl border border-stone-200 px-3 py-2">
                <MethodIcon method={p.method} className="size-5 text-stone-500" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-semibold">{METHOD_LABEL[p.method]}</span>
                  {p.lines && <span className="block truncate text-[12px] text-stone-500">{p.lines}</span>}
                </span>
                <span className="text-[14px] font-bold tabular-nums">{tl(p.amount)}</span>
                {perms.payments && <button
                  type="button"
                  disabled={busy}
                  onClick={() => onDeletePayment(p.id)}
                  className="grid size-9 place-items-center rounded-lg text-stone-400 hover:bg-stone-100 hover:text-red-600"
                  aria-label="Ödemeyi geri al"
                >
                  <Undo2 className="size-4" />
                </button>}
              </li>
            ))}
          </ul>
        )}

        {!closeOnly && (
          <div className="flex rounded-xl bg-stone-100 p-1">
            <ModeButton active={mode === "items"} onClick={() => setMode("items")}>
              Ürün seçerek
            </ModeButton>
            <ModeButton active={mode === "amount"} onClick={() => setMode("amount")}>
              Tutar girerek
            </ModeButton>
          </div>
        )}

        {mode === "items" && !closeOnly && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <p className="text-[13px] font-semibold text-stone-500">Ödenecek ürünlere dokun</p>
              <button type="button" onClick={() => selectAll(!allSelected)} className="text-[13px] font-bold text-brand-700">
                {allSelected ? "Seçimi temizle" : "Tümünü seç"}
              </button>
            </div>
            <ul className="flex flex-col gap-2">
              {lines.map((item) => {
                const open = openParts(item);
                const split = item.split_parts ?? 1;
                const paidParts = item.paid_parts ?? item.paid_quantity ?? 0;
                const qty = selection.get(item.id) ?? 0;
                const net = partPrice(item);
                return (
                  <li
                    key={item.id}
                    className={cn(
                      "flex flex-col gap-2 rounded-xl border-2 p-2 transition",
                      qty > 0 ? "border-brand-500 bg-brand-50/60" : "border-stone-200 bg-white",
                    )}
                  >
                    <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setQty(item, qty > 0 ? 0 : open)}
                      className="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-1 py-1 text-left"
                      aria-pressed={qty > 0}
                    >
                      <span
                        className={cn(
                          "grid size-6 shrink-0 place-items-center rounded-md border-2",
                          qty > 0 ? "border-brand-600 bg-brand-600 text-white" : "border-stone-300",
                        )}
                      >
                        {qty > 0 && <Check className="size-4" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-semibold">
                          {split === 1 && open > 1 ? `${open}× ` : ""}
                          {item.name}
                          {split > 1 && <span className="ml-1.5 text-[12px] font-bold text-brand-700">{split} kişiye bölündü</span>}
                        </span>
                        <span className="block truncate text-[12px] text-stone-500">
                          {[
                            item.options_label,
                            item.note && `“${item.note}”`,
                            paidParts > 0 && (split > 1 ? `${fraction(paidParts, split)} ödendi` : `${paidParts} adedi ödendi`),
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block text-[14px] font-bold tabular-nums">
                          {split > 1 && <span className="mr-1 text-[12px] font-semibold text-stone-500">{fraction(1, split)}</span>}
                          {tl(round2(net))}
                        </span>
                        {item.unit_discount > 0 && split === 1 && <span className="block text-[11px] text-stone-400 line-through tabular-nums">{tl(item.unit_price)}</span>}
                      </span>
                    </button>
                    {open > 1 && (
                      <div className="flex shrink-0 items-center rounded-lg border border-stone-200 bg-white">
                        <button type="button" onClick={() => setQty(item, qty - 1)} className="grid size-9 place-items-center text-stone-600" aria-label="Azalt">
                          <Minus className="size-4" />
                        </button>
                        <span className="min-w-6 px-0.5 text-center text-[14px] font-bold tabular-nums">{split > 1 ? fraction(qty, split) : qty}</span>
                        <button type="button" onClick={() => setQty(item, qty + 1)} className="grid size-9 place-items-center text-brand-700" aria-label="Artır">
                          <Plus className="size-4" />
                        </button>
                      </div>
                    )}
                    {paidParts === 0 && (
                      <>
                        <button
                          type="button"
                          onClick={() => setSplitting(splitting === item.id ? null : item.id)}
                          aria-expanded={splitting === item.id}
                          className={cn(
                            "flex h-9 shrink-0 items-center gap-1 rounded-lg px-2 text-[13px] font-bold",
                            split > 1 || splitting === item.id ? "bg-brand-100 text-brand-800" : "text-stone-600 hover:bg-stone-100",
                          )}
                          title="Kişilere böl"
                        >
                          <Divide className="size-4" /> Böl
                        </button>
                        {perms.discounts && <button
                          type="button"
                          onClick={() => onEditItem(item)}
                          className="grid size-9 shrink-0 place-items-center rounded-lg text-stone-500 hover:bg-stone-100"
                          aria-label={`${item.name} fiyat ve indirim`}
                          title="Fiyat / indirim"
                        >
                          <Tag className="size-4" />
                        </button>}
                      </>
                    )}
                    </div>
                    {splitting === item.id && paidParts === 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 pl-1">
                        <span className="mr-1 text-[12px] font-semibold text-stone-500">Kaç kişiye?</span>
                        {SPLIT_OPTIONS.map((n) => (
                          <button
                            key={n}
                            type="button"
                            disabled={busy}
                            onClick={() => {
                              setSplitting(null);
                              onSplit(item, n);
                            }}
                            className={cn(
                              "h-9 min-w-9 rounded-lg px-2.5 text-[14px] font-bold",
                              split === n ? "bg-brand-600 text-white" : "bg-white text-stone-700 ring-1 ring-stone-200",
                            )}
                          >
                            {n}
                          </button>
                        ))}
                        {split > 1 && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => {
                              setSplitting(null);
                              onSplit(item, 1);
                            }}
                            className="h-9 rounded-lg px-2.5 text-[13px] font-semibold text-stone-600 ring-1 ring-stone-200"
                          >
                            Bölme
                          </button>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
            {settled.length > 0 && (
              <p className="px-1 text-[12px] text-stone-400">
                Ödenen / ikram: {settled.map((i) => `${i.quantity}× ${i.name}`).join(", ")}
              </p>
            )}
            {selectedTotal > remaining + 0.001 && remaining > 0 && (
              <p className="px-1 text-[12px] text-stone-500">Hesap indirimi nedeniyle en fazla kalan tutar ({tl(remaining)}) alınır.</p>
            )}
          </div>
        )}

        {mode === "amount" && !closeOnly && (
          <div className="flex flex-col gap-2 rounded-2xl border border-stone-200 p-3">
            <NumberInput value={amount} onValueChange={setAmount} suffix={currencySymbol()} placeholder="Tutar" inputClassName="h-14 text-[22px] font-bold" autoFocus />
            <div className="flex flex-wrap gap-2">
              {[2, 3, 4].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setAmount(Math.ceil((remaining / n) * 100) / 100)}
                  className="h-9 rounded-lg bg-stone-100 px-3 text-[13px] font-semibold text-stone-700"
                >
                  1/{n} · {tl(Math.ceil((remaining / n) * 100) / 100)}
                </button>
              ))}
              <button type="button" onClick={() => setAmount(remaining)} className="h-9 rounded-lg bg-stone-100 px-3 text-[13px] font-semibold text-stone-700">
                Tamamı
              </button>
            </div>
            {amount !== null && amount > remaining && <p className="text-[13px] font-medium text-red-600">Tutar kalan hesaptan fazla olamaz.</p>}
          </div>
        )}

        {!closeOnly && perms.discounts && (
          <button
            type="button"
            onClick={onDiscount}
            className="flex h-10 items-center gap-1.5 self-start rounded-full border border-stone-200 px-4 text-[13px] font-semibold text-stone-600"
          >
            <Percent className="size-4" /> Tüm hesaba indirim
          </button>
        )}
      </div>
    </Sheet>
  );
}

function ModeButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "h-10 flex-1 rounded-lg text-[14px] font-semibold transition",
        active ? "bg-white text-stone-900 shadow-card" : "text-stone-500",
      )}
    >
      {children}
    </button>
  );
}

function PayButton({
  label,
  sub,
  icon,
  onClick,
  disabled,
  primary,
}: {
  label: string;
  sub: string;
  icon: React.ReactNode;
  onClick: () => void;
  disabled: boolean;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex h-20 flex-col items-center justify-center gap-0.5 rounded-2xl text-center transition active:scale-[0.97] disabled:opacity-50",
        primary ? "bg-brand-600 text-white hover:bg-brand-700" : "bg-stone-900 text-white hover:bg-stone-800",
      )}
    >
      <span className="flex items-center gap-2 text-[18px] font-extrabold">
        {icon}
        {label}
      </span>
      <span className="px-2 text-[11px] font-medium opacity-80">{sub}</span>
    </button>
  );
}
