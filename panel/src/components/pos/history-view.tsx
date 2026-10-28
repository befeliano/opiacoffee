"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, Funnel, Gift, RotateCcw, Trash2, X } from "lucide-react";
import { changePaymentMethodAction, reopenOrderAction, voidOrderAction } from "@/app/(panel)/[cafe]/masalar/actions";
import { Button } from "@/components/ui/button";
import { ConfirmSheet } from "@/components/ui/sheet";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui/surface";
import { useToast } from "@/components/ui/toast";
import type { HistoryData, Order, PaymentMethod } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { addDays, formatDateTr, formatMinutes, formatTime, weekdayOf, WEEKDAYS_TR } from "@/lib/domain/time";
import { tl } from "@/lib/format";
import { METHOD_LABEL, METHOD_SWITCH_LABEL, MethodIcon, PAYMENT_METHODS } from "@/lib/pos/payment-methods";
import { usePerms } from "@/components/shell/perms";

const VOID_REASONS = ["Yanlış sipariş girildi", "Yanlış masaya girildi", "Müşteri vazgeçti", "Diğer"];

export function HistoryView({
  cafe,
  data,
  minDate,
  canEditPast,
}: {
  cafe: { id: string; slug: string; timezone: string };
  data: HistoryData;
  /** Gidilebilecek en eski gün (barista: dün); boş = sınırsız */
  minDate: string | null;
  /** Geçmiş günlerin adisyonlarını silme / yeniden açma (yönetici ve sahip) */
  canEditPast: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const perms = usePerms();
  const [orders, setOrders] = useState(data.orders);
  const [open, setOpen] = useState<string | null>(null);
  const [reopen, setReopen] = useState<Order | null>(null);
  const [voiding, setVoiding] = useState<Order | null>(null);
  const [voidReason, setVoidReason] = useState(VOID_REASONS[0]);
  const [busy, setBusy] = useState(false);
  // Kart / nakit / ticket kutusuna dokununca liste o ödeme yöntemine süzülür
  const [method, setMethod] = useState<PaymentMethod | null>(null);

  const paid = orders.filter((o) => o.status === "paid");
  const revenue = paid.reduce((s, o) => s + o.total, 0);
  const card = paid.reduce((s, o) => s + methodAmount(o, "card"), 0);
  const cash = paid.reduce((s, o) => s + methodAmount(o, "cash"), 0);
  const ticket = paid.reduce((s, o) => s + methodAmount(o, "ticket"), 0);
  const isToday = data.date === data.today;
  const canGoBack = !minDate || data.date > minDate;
  const shown = method ? orders.filter((o) => o.payments.some((p) => p.method === method)) : orders;
  const toggleMethod = (m: PaymentMethod) => {
    setMethod((current) => (current === m ? null : m));
    setOpen(null);
  };

  const switchMethod = async (order: Order, paymentId: string, method: PaymentMethod) => {
    setBusy(true);
    const result = await changePaymentMethodAction(cafe.id, paymentId, method).catch(() => null);
    setBusy(false);
    if (!result || !result.ok) return toast.show(result?.ok === false ? result.error : "Bağlantı sorunu.", "error");
    setOrders((prev) => prev.map((o) => (o.id === order.id ? result.data : o)));
    toast.show(`Ödeme yöntemi: ${METHOD_LABEL[method]}`);
  };

  const doVoid = async () => {
    if (!voiding) return;
    setBusy(true);
    const result = await voidOrderAction(cafe.id, voiding.id, voidReason).catch(() => null);
    setBusy(false);
    if (!result || !result.ok) return toast.show(result?.ok === false ? result.error : "Bağlantı sorunu.", "error");
    toast.show(`${voiding.table_name} adisyonu silindi`);
    setOrders((prev) => prev.map((o) => (o.id === voiding.id ? { ...o, status: "cancelled", cancel_reason: voidReason, payments: [] } : o)));
    setVoiding(null);
    router.refresh();
  };

  const doReopen = async () => {
    if (!reopen) return;
    setBusy(true);
    const result = await reopenOrderAction(cafe.id, reopen.id).catch(() => null);
    setBusy(false);
    if (!result || !result.ok) return toast.show(result?.ok === false ? result.error : "Bağlantı sorunu.", "error");
    toast.show(`${reopen.table_name} adisyonu yeniden açıldı`);
    router.push(`/${cafe.slug}/masalar/${result.data.table.id}`);
  };

  return (
    <main className="mx-auto max-w-4xl px-4 pb-28 pt-4 sm:px-6 md:pb-10 md:pt-6">
      <PageHeader
        title="Geçmiş adisyonlar"
        description={`${formatDateTr(data.date)}, ${WEEKDAYS_TR[weekdayOf(data.date)]}${isToday ? " · bugün" : ""}`}
        actions={
          <div className="flex items-center gap-1">
            {canGoBack && (
              <Link prefetch={false} href={`/${cafe.slug}/gecmis?tarih=${addDays(data.date, -1)}`} className="grid size-10 place-items-center rounded-xl border border-stone-200 bg-white hover:bg-stone-50" aria-label="Önceki gün">
                <ChevronLeft className="size-5" />
              </Link>
            )}
            <input
              type="date"
              value={data.date}
              min={minDate ?? undefined}
              max={data.today}
              onChange={(e) => {
                const value = e.target.value;
                if (value && (!minDate || value >= minDate)) router.push(`/${cafe.slug}/gecmis?tarih=${value}`);
              }}
              className="h-10 rounded-xl border border-stone-200 bg-white px-3 text-[14px] font-medium"
              aria-label="Tarih seç"
            />
            {!isToday && (
              <Link prefetch={false} href={`/${cafe.slug}/gecmis?tarih=${addDays(data.date, 1)}`} className="grid size-10 place-items-center rounded-xl border border-stone-200 bg-white hover:bg-stone-50" aria-label="Sonraki gün">
                <ChevronRight className="size-5" />
              </Link>
            )}
          </div>
        }
      />

      <div className={cn("mt-5 grid grid-cols-2 gap-3", ticket > 0 ? "sm:grid-cols-5" : "sm:grid-cols-4")}>
        <Summary label="Adisyon" value={String(paid.length)} />
        <Summary label="Ciro" value={tl(revenue, { decimals: "never" })} strong />
        <Summary label="Kart" value={tl(card, { decimals: "never" })} active={method === "card"} onClick={() => toggleMethod("card")} />
        <Summary label="Nakit" value={tl(cash, { decimals: "never" })} active={method === "cash"} onClick={() => toggleMethod("cash")} />
        {ticket > 0 && (
          <Summary label="Ticket" lang="en" value={tl(ticket, { decimals: "never" })} active={method === "ticket"} onClick={() => toggleMethod("ticket")} />
        )}
      </div>

      {method && (
        <div className="mt-3 flex items-center gap-2 rounded-xl bg-stone-900 px-3.5 py-2 text-[14px] text-white">
          <MethodIcon method={method} className="size-4 shrink-0" />
          <span className="min-w-0 flex-1 truncate">
            <b>{METHOD_LABEL[method]}</b> ile ödenenler · {shown.length} adisyon
          </span>
          <button type="button" onClick={() => setMethod(null)} className="flex h-8 items-center gap-1 rounded-lg px-2 font-semibold text-stone-300 hover:bg-white/10 hover:text-white">
            <X className="size-4" /> Tümü
          </button>
        </div>
      )}

      <Card className={cn("overflow-hidden", method ? "mt-3" : "mt-5")}>
        {shown.length === 0 ? (
          method ? (
            <EmptyState title={`Bu gün ${METHOD_LABEL[method].toLocaleLowerCase("tr")} ödeme yok`} description="Filtreyi kaldırıp tüm adisyonlara dönebilirsin." />
          ) : (
            <EmptyState title="Bu gün kapanan adisyon yok" description="Ödemesi alınan adisyonlar burada listelenir." />
          )
        ) : (
          <ul className="divide-y divide-stone-100">
            {shown.map((order) => {
              const expanded = open === order.id;
              const minutes = order.closed_at ? (Date.parse(order.closed_at) - Date.parse(order.opened_at)) / 60000 : 0;
              // Filtrede, karışık ödemeli adisyonun yalnızca o yönteme düşen kısmı
              const part = method ? methodAmount(order, method) : null;
              const mixed = part !== null && Math.abs(part - order.total) >= 0.01;
              return (
                <li key={order.id}>
                  <button
                    type="button"
                    onClick={() => setOpen(expanded ? null : order.id)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-stone-50 sm:px-5"
                    aria-expanded={expanded}
                  >
                    <span className="w-12 shrink-0 text-[14px] font-semibold tabular-nums text-stone-500">
                      {order.closed_at ? formatTime(order.closed_at, cafe.timezone) : "—"}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-[15px] font-bold">{order.table_name}</span>
                        {order.status === "cancelled" && <Badge tone="red">İptal</Badge>}
                        {order.comp_total > 0 && (
                          <Badge tone="green">
                            <Gift className="size-3" /> İkram
                          </Badge>
                        )}
                      </span>
                      <span className="block truncate text-[13px] text-stone-500">
                        {order.items_count} ürün · {formatMinutes(minutes)}
                        {order.status === "cancelled" && order.cancel_reason ? ` · ${order.cancel_reason}` : ""}
                      </span>
                    </span>
                    <span className="flex items-center gap-1 text-stone-400">
                      {PAYMENT_METHODS.filter((m) => order.payments.some((p) => p.method === m)).map((m) => (
                        <MethodIcon key={m} method={m} className="size-4" />
                      ))}
                    </span>
                    <span className="flex w-20 flex-col items-end">
                      <span className={cn("text-[15px] font-extrabold tabular-nums", order.status === "cancelled" && "text-stone-400 line-through")}>
                        {tl(part ?? order.total, { decimals: "never" })}
                      </span>
                      {mixed && <span className="text-[11px] font-semibold tabular-nums text-stone-400">/ {tl(order.total, { decimals: "never" })}</span>}
                    </span>
                    <ChevronDown className={cn("size-4 shrink-0 text-stone-400 transition", expanded && "rotate-180")} />
                  </button>

                  {expanded && (
                    <div className="animate-fade-in border-t border-stone-100 bg-stone-50/70 px-4 py-3 sm:px-5">
                      <ul className="flex flex-col gap-1 text-[14px]">
                        {order.items.map((item) => (
                          <li key={item.id} className="flex justify-between gap-3">
                            <span className="min-w-0">
                              <span className="font-medium">
                                {item.quantity} × {item.name}
                              </span>
                              {item.options_label && <span className="text-stone-500"> · {item.options_label}</span>}
                              {item.is_comp && <span className="font-semibold text-emerald-700"> · ikram</span>}
                            </span>
                            <span className={cn("shrink-0 tabular-nums", item.is_comp && "text-stone-400 line-through")}>
                              {tl(item.quantity * (item.unit_price - (item.unit_discount ?? 0)))}
                            </span>
                          </li>
                        ))}
                      </ul>
                      {order.discount > 0 && (
                        <p className="mt-2 flex justify-between text-[14px] text-stone-600">
                          <span>İndirim</span>
                          <span className="tabular-nums">−{tl(order.discount)}</span>
                        </p>
                      )}

                      {order.payments.length > 0 && (
                        <div className="mt-3 flex flex-col gap-2">
                          {order.payments.map((p) => (
                            <div key={p.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2">
                              <MethodIcon method={p.method} className="size-4 text-stone-500" />
                              <span className="text-[14px] font-semibold">{METHOD_LABEL[p.method]}</span>
                              <span className="text-[14px] tabular-nums">{tl(p.amount)}</span>
                              {p.commission > 0 && <span className="text-[12px] text-stone-500">komisyon {tl(p.commission)}</span>}
                              <span className="ml-auto flex gap-1">
                                {perms.payments && PAYMENT_METHODS.filter((m) => m !== p.method).map((m) => (
                                  <Button key={m} size="sm" variant="ghost" disabled={busy} onClick={() => switchMethod(order, p.id, m)}>
                                    {METHOD_SWITCH_LABEL[m]}
                                  </Button>
                                ))}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      {order.status === "paid" && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {order.table_id && (isToday || canEditPast) && perms.payments && (
                            <Button size="sm" variant="secondary" onClick={() => setReopen(order)}>
                              <RotateCcw className="size-4" /> Yeniden aç
                            </Button>
                          )}
                          {(isToday || canEditPast) && perms.void && (
                            <Button size="sm" variant="secondary" className="text-red-600" onClick={() => setVoiding(order)}>
                              <Trash2 className="size-4" /> Adisyonu sil
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <ConfirmSheet
        open={!!reopen}
        onClose={() => setReopen(null)}
        onConfirm={doReopen}
        pending={busy}
        title="Adisyon yeniden açılsın mı?"
        description="Alınan ödemeler silinir ve adisyon masada açık hale gelir. Düzeltmeden sonra ödemeyi yeniden almalısın."
        confirmLabel="Yeniden aç"
      />

      <ConfirmSheet
        open={!!voiding}
        onClose={() => setVoiding(null)}
        onConfirm={doVoid}
        pending={busy}
        danger
        title="Adisyon silinsin mi?"
        description="Yanlış alınan adisyon iptal edilir, ödemeleri silinir. Ciroya yazılmaz; raporlarda iptal olarak görünür."
        confirmLabel="Sil"
      >
        <div className="mt-4 flex flex-wrap gap-2">
          {VOID_REASONS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setVoidReason(r)}
              className={cn(
                "h-10 rounded-full border px-4 text-[14px] font-semibold",
                voidReason === r ? "border-stone-900 bg-stone-900 text-white" : "border-stone-200 text-stone-600",
              )}
            >
              {r}
            </button>
          ))}
        </div>
      </ConfirmSheet>
    </main>
  );
}

function methodAmount(order: Order, method: PaymentMethod) {
  return order.payments.filter((p) => p.method === method).reduce((s, p) => s + p.amount, 0);
}

function Summary({
  label,
  value,
  strong,
  lang,
  active,
  onClick,
}: {
  label: string;
  value: string;
  strong?: boolean;
  lang?: string;
  /** Dokunulabilir kutu: listeyi bu ödeme yöntemine süzer */
  active?: boolean;
  onClick?: () => void;
}) {
  const className = cn(
    "rounded-2xl border px-4 py-3 text-left",
    active ? "border-stone-900 bg-stone-900 text-white" : strong ? "border-brand-200 bg-brand-50" : "border-stone-200 bg-white",
    onClick && !active && "transition hover:border-stone-300 hover:bg-stone-50 active:scale-[0.98]",
  );
  const content = (
    <>
      <p lang={lang} className={cn("flex items-center justify-between text-[12px] font-semibold uppercase tracking-wide", active ? "text-stone-300" : "text-stone-500")}>
        {label}
        {onClick && <Funnel className={cn("size-3.5", active ? "text-white" : "text-stone-300")} aria-hidden />}
      </p>
      <p className={cn("mt-0.5 text-[20px] font-extrabold tabular-nums", strong && "text-brand-800")}>{value}</p>
    </>
  );
  if (!onClick) return <div className={className}>{content}</div>;
  return (
    <button type="button" onClick={onClick} aria-pressed={active} title={active ? "Filtreyi kaldır" : `Yalnızca ${label.toLocaleLowerCase("tr")} ödemeleri göster`} className={className}>
      {content}
    </button>
  );
}
