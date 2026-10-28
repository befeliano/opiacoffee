"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, ChevronRight, Minus, MoreVertical, Plus, ReceiptText, Users } from "lucide-react";
import {
  addItemAction,
  changeQuantityAction,
  deletePaymentAction,
  loadTableAction,
  moveOrderAction,
  payAction,
  payItemsAction,
  priceItemAction,
  removeItemAction,
  setGuestsAction,
  splitItemAction,
  updateItemAction,
  updateOrderAction,
  voidOrderAction,
} from "@/app/(panel)/[cafe]/masalar/actions";
import { Button, Spinner } from "@/components/ui/button";
import { ConfirmSheet, Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import type { FloorData, MenuProduct, OrderItem, PaymentMethod, PayResult, PosMenu, TableOrderData } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { formatMinutes } from "@/lib/domain/time";
import type { ActionResult } from "@/lib/errors";
import { tl } from "@/lib/format";
import { METHOD_LABEL } from "@/lib/pos/payment-methods";
import { applyPending, defaultOptionIds, indexMenu, linePrice, needsChoice, sortIds } from "@/lib/pos/optimistic";
import {
  enqueueTableOp,
  isIdle,
  publishOptimistic,
  seedTable,
  setTableOrder,
  setTableServer,
  tablePendingCount,
  useTableEntry,
  whenIdle,
} from "@/lib/pos/table-store";
import { minutesSince, useLiveUpdates, useServerNow, type LiveConfig } from "./live";
import { JokerSheet, OptionSheet } from "./option-sheet";
import { OrderMetaSheet, MoveSheet } from "./order-sheets";
import { PaymentSheet, type PayRequest } from "./payment-sheet";
import { ProductGrid } from "./product-grid";
import { Ticket } from "./ticket";
import { usePerms } from "@/components/shell/perms";

type SheetState =
  | null
  | { kind: "add"; product: MenuProduct }
  | { kind: "joker"; product: MenuProduct }
  | { kind: "edit"; item: OrderItem; back?: "pay" }
  | { kind: "pay" }
  | { kind: "actions" }
  | { kind: "move" }
  | { kind: "meta" }
  | { kind: "cancel" };

export function OrderScreen({
  cafe,
  menu,
  initial,
  floor,
  live,
}: {
  cafe: { id: string; slug: string; commissionRate: number; ticketCommissionRate: number; timezone: string };
  menu: PosMenu;
  initial: TableOrderData;
  floor: FloorData;
  live: LiveConfig;
}) {
  const router = useRouter();
  const toast = useToast();
  const perms = usePerms();
  const index = useMemo(() => indexMenu(menu), [menu]);
  const tableId = initial.table.id;

  // Paylaşılan bellek: masadan çıkıp girince son hâl anında görünür,
  // bekleyen kayıtlar kaybolmaz
  const [hadPending] = useState(() => {
    const had = tablePendingCount(tableId) > 0;
    seedTable(initial);
    return had;
  });
  const entry = useTableEntry(tableId);
  const server = entry?.server ?? initial;
  const pending = useMemo(() => entry?.pending ?? [], [entry]);

  const [sheet, setSheet] = useState<SheetState>(null);
  const [ticketOpen, setTicketOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const now = useServerNow(server.now);

  const table = server.table;
  const order = useMemo(() => applyPending(server.order, pending, index, table), [server.order, pending, index, table]);

  useEffect(() => {
    publishOptimistic(tableId, order);
  }, [tableId, order]);

  const enqueue = useCallback(
    (input: Parameters<typeof enqueueTableOp>[1], run: () => Promise<ActionResult<TableOrderData>>) =>
      enqueueTableOp(tableId, input, run, (message) => toast.show(message, "error")),
    [tableId, toast],
  );

  const reload = useCallback(async () => {
    if (!isIdle()) return;
    const result = await loadTableAction(cafe.id, tableId);
    if (result.ok && isIdle()) setTableServer(result.data);
  }, [cafe.id, tableId]);

  useLiveUpdates(cafe.id, live, reload);

  // Önceki ziyaretten kalan kayıtlar bitince sunucudaki son hâli çek
  useEffect(() => {
    if (hadPending) void whenIdle().then(reload);
  }, [hadPending, reload]);

  // Sayfadan ayrılırken bekleyen kayıtlar varsa uyar
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!isIdle()) e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  const addProduct = useCallback(
    (product: MenuProduct, optionIds: string[], quantity: number, note: string, price: number | null = null) => {
      enqueue({ kind: "add", productId: product.id, optionIds, quantity, note, price }, () =>
        addItemAction(cafe.id, tableId, product.id, optionIds, quantity, note, price),
      );
    },
    [enqueue, cafe.id, tableId],
  );

  const onProductTap = useCallback(
    (product: MenuProduct) => {
      if (product.is_open_price) {
        setSheet({ kind: "joker", product });
        return;
      }
      if (needsChoice(index, product)) {
        setSheet({ kind: "add", product });
        return;
      }
      addProduct(product, defaultOptionIds(index, product), 1, "");
    },
    [index, addProduct],
  );

  const onDelta = useCallback(
    (item: OrderItem, delta: number) => {
      if (item.id.startsWith("tmp-")) return;
      enqueue({ kind: "delta", itemId: item.id, delta }, () => changeQuantityAction(cafe.id, item.id, delta));
    },
    [enqueue, cafe.id],
  );

  const quantities = useMemo(() => {
    const map = new Map<string, number>();
    for (const i of order?.items ?? []) if (i.product_id) map.set(i.product_id, (map.get(i.product_id) ?? 0) + i.quantity);
    return map;
  }, [order]);

  const saving = pending.length > 0;
  const minutes = order ? minutesSince(order.opened_at, now) : 0;

  const changeGuests = useCallback(
    (guests: number | null) => {
      const orderId = server.order?.id;
      if (!orderId) return;
      enqueue({ kind: "guests", guests }, () => setGuestsAction(cafe.id, orderId, guests));
    },
    [enqueue, cafe.id, server.order?.id],
  );

  const openPay = () => {
    setTicketOpen(false);
    setSheet({ kind: "pay" });
  };

  const handlePay = async (method: PaymentMethod, request: PayRequest) => {
    if (!server.order) return;
    await whenIdle();
    const orderId = server.order.id;
    setBusy(true);
    const result: ActionResult<PayResult> | null = await (
      request.kind === "items"
        ? payItemsAction(cafe.id, orderId, method, request.lines)
        : payAction(cafe.id, orderId, method, request.amount)
    ).catch(() => null);
    setBusy(false);
    if (!result) return toast.show("Bağlantı sorunu, ödeme kaydedilemedi.", "error");
    if (!result.ok) return toast.show(result.error, "error");
    if (result.data.closed) {
      setTableOrder(tableId, null);
      toast.show(`Ödeme alındı · ${table.name} kapandı`);
      setSheet(null);
      router.push(`/${cafe.slug}/masalar`);
      return;
    }
    setTableOrder(tableId, result.data.order);
    const taken = result.data.order.payments.at(-1)?.amount ?? 0;
    toast.show(`${tl(taken)} alındı · ${METHOD_LABEL[method]}`);
  };

  const runSimple = async (fn: () => Promise<ActionResult<TableOrderData>>, success?: string) => {
    await whenIdle();
    setBusy(true);
    const result = await fn().catch(() => null);
    setBusy(false);
    if (!result) {
      toast.show("Bağlantı sorunu. Tekrar dene.", "error");
      return false;
    }
    if (!result.ok) {
      toast.show(result.error, "error");
      return false;
    }
    setTableServer(result.data);
    if (success) toast.show(success);
    return true;
  };

  const ticket = (
    <Ticket
      order={order}
      timezone={cafe.timezone}
      onDelta={onDelta}
      onEdit={(item) => {
        if (item.id.startsWith("tmp-")) return;
        setTicketOpen(false);
        setSheet({ kind: "edit", item });
      }}
    />
  );

  return (
    <div className="flex h-dvh flex-col md:flex-row">
      {/* Menü */}
      <section className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-2 border-b border-stone-200/80 bg-white px-2 pt-safe sm:px-4">
          <div className="flex h-16 w-full items-center gap-2">
            <Link
              href={`/${cafe.slug}/masalar`}
              className="grid size-11 shrink-0 place-items-center rounded-xl text-stone-700 hover:bg-stone-100"
              aria-label="Masalara dön"
            >
              <ArrowLeft className="size-6" />
            </Link>
            <div className="min-w-0 flex-1">
              <h1 className="flex items-center gap-2 truncate text-[20px] font-extrabold leading-tight">
                {table.name}
                {saving && <Spinner className="size-3.5 text-brand-500" />}
              </h1>
              <p className="truncate text-[13px] text-stone-500">
                {order ? `Açılış ${formatMinutes(minutes)} önce` : table.is_takeaway ? "Paket / ayakta" : "Boş masa"}
                {table.area_name ? ` · ${table.area_name}` : ""}
              </p>
            </div>
            {server.order && (
              <button
                type="button"
                onClick={() => setSheet({ kind: "actions" })}
                className="grid size-11 place-items-center rounded-xl text-stone-600 hover:bg-stone-100"
                aria-label="Adisyon işlemleri"
              >
                <MoreVertical className="size-5" />
              </button>
            )}
          </div>
        </header>

        <ProductGrid menu={menu} index={index} quantities={quantities} onTap={onProductTap} onOptions={(p) => setSheet({ kind: "add", product: p })} />

        {/* Mobil alt çubuk */}
        <div className="border-t border-stone-200 bg-white px-3 pt-2.5 pb-safe md:hidden">
          <div className="flex gap-2 pb-2.5">
            <button
              type="button"
              onClick={() => setTicketOpen(true)}
              className="flex h-14 min-w-0 flex-1 items-center gap-3 rounded-2xl border border-stone-200 bg-stone-50 px-3 text-left"
            >
              <span className="relative grid size-9 place-items-center rounded-xl bg-white text-stone-700 shadow-card">
                <ReceiptText className="size-5" />
                {order && order.items_count > 0 && (
                  <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-brand-600 px-1 text-[11px] font-bold text-white">
                    {order.items_count}
                  </span>
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[12px] font-medium text-stone-500">Adisyon</span>
                <span className="block text-[17px] font-extrabold tabular-nums">{tl(order?.remaining ?? 0)}</span>
              </span>
              <ChevronRight className="size-5 text-stone-400" />
            </button>
            <Button size="xl" className="h-14 px-5" disabled={!server.order || saving} onClick={openPay}>
              Ödeme al
            </Button>
          </div>
        </div>
      </section>

      {/* Masaüstü/tablet adisyon paneli */}
      <aside className="hidden w-[320px] shrink-0 flex-col border-l border-stone-200 bg-white md:flex lg:w-[340px] 2xl:w-[380px]">
        <div className="flex h-16 items-center justify-between border-b border-stone-100 px-5">
          <p className="text-[16px] font-bold">Adisyon</p>
          {order && <p className="text-[13px] text-stone-500">{order.items_count} ürün</p>}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{ticket}</div>
        <TicketFooter order={order} saving={saving} onPay={openPay} canPay={!!server.order} onGuests={server.order ? changeGuests : undefined} />
      </aside>

      {/* Mobil adisyon */}
      <Sheet
        open={ticketOpen}
        onClose={() => setTicketOpen(false)}
        title={`${table.name} · Adisyon`}
        description={order ? `${order.items_count} ürün · ${formatMinutes(minutes)}` : undefined}
        size="lg"
        footer={<TicketFooter order={order} saving={saving} onPay={openPay} canPay={!!server.order} onGuests={server.order ? changeGuests : undefined} compact />}
      >
        <div className="-mx-5 -my-4">{ticket}</div>
      </Sheet>

      {sheet?.kind === "add" && (
        <OptionSheet
          mode="add"
          product={sheet.product}
          index={index}
          onClose={() => setSheet(null)}
          onSubmit={({ optionIds, quantity, note }) => {
            addProduct(sheet.product, optionIds, quantity, note);
            setSheet(null);
          }}
        />
      )}

      {sheet?.kind === "joker" && (
        <JokerSheet
          product={sheet.product}
          onClose={() => setSheet(null)}
          onSubmit={({ price, note, quantity }) => {
            addProduct(sheet.product, [], quantity, note, price);
            setSheet(null);
          }}
        />
      )}

      {sheet?.kind === "edit" && (
        <OptionSheet
          mode="edit"
          item={sheet.item}
          product={sheet.item.product_id ? index.products.get(sheet.item.product_id) : undefined}
          index={index}
          onClose={() => setSheet(sheet.back === "pay" ? { kind: "pay" } : null)}
          onRemove={() => {
            const item = sheet.item;
            enqueue({ kind: "remove", itemId: item.id }, () => removeItemAction(cafe.id, item.id));
            setSheet(null);
          }}
          onSubmit={({ optionIds, quantity, note, isComp, unitPrice, unitDiscount }) => {
            const item = sheet.item;
            const ids = sortIds(optionIds);
            const optionsChanged = ids.join() !== sortIds(item.option_ids).join();
            if (optionsChanged || quantity !== item.quantity || note !== item.note || isComp !== item.is_comp) {
              enqueue({ kind: "update", itemId: item.id, optionIds: ids, quantity, note, isComp }, () =>
                updateItemAction(cafe.id, item.id, ids, quantity, note, isComp),
              );
            }
            // Seçenek değişince sunucu menü fiyatına döner; farklı fiyat/indirim varsa yeniden uygula
            const basePrice = optionsChanged && item.product_id ? linePrice(index, item.product_id, ids, item.list_price) : item.unit_price;
            const baseDiscount = optionsChanged ? Math.min(item.unit_discount, basePrice) : item.unit_discount;
            if (!isComp && item.paid_quantity === 0 && (unitPrice !== basePrice || unitDiscount !== baseDiscount)) {
              enqueue({ kind: "price", itemId: item.id, unitPrice, unitDiscount }, () =>
                priceItemAction(cafe.id, item.id, unitPrice, unitDiscount),
              );
            }
            setSheet(sheet.back === "pay" ? { kind: "pay" } : null);
          }}
        />
      )}

      {sheet?.kind === "pay" && order && (
        <PaymentSheet
          key={payKey(order)}
          order={order}
          tableName={table.name}
          commissionRate={cafe.commissionRate}
          ticketCommissionRate={cafe.ticketCommissionRate}
          busy={busy || saving}
          onClose={() => setSheet(null)}
          onPay={handlePay}
          onDeletePayment={(paymentId) => runSimple(() => deletePaymentAction(cafe.id, paymentId), "Ödeme geri alındı")}
          onDiscount={() => setSheet({ kind: "meta" })}
          onEditItem={(item) => setSheet({ kind: "edit", item, back: "pay" })}
          onSplit={(item, parts) => void runSimple(() => splitItemAction(cafe.id, item.id, parts), parts > 1 ? `${item.name} ${parts} kişiye bölündü` : "Bölme kaldırıldı")}
        />
      )}

      <Sheet open={sheet?.kind === "actions"} onClose={() => setSheet(null)} title={`${table.name} · İşlemler`} size="sm">
        <div className="flex flex-col gap-2">
          <ActionRow label="Masa değiştir / birleştir" onClick={() => setSheet({ kind: "move" })} />
          <ActionRow label={perms.discounts ? "Not ve indirim" : "Adisyon notu"} onClick={() => setSheet({ kind: "meta" })} />
          {perms.void && <ActionRow label="Adisyonu iptal et" danger onClick={() => setSheet({ kind: "cancel" })} />}
        </div>
      </Sheet>

      {sheet?.kind === "move" && server.order && (
        <MoveSheet
          floor={floor}
          currentTableId={table.id}
          busy={busy}
          onClose={() => setSheet(null)}
          onSelect={async (target) => {
            await whenIdle();
            setBusy(true);
            const result = await moveOrderAction(cafe.id, server.order!.id, target.id).catch(() => null);
            setBusy(false);
            if (!result || !result.ok) return toast.show(result?.ok === false ? result.error : "Bağlantı sorunu.", "error");
            toast.show(target.order ? `${target.name} ile birleştirildi` : `${target.name} masasına taşındı`);
            router.replace(`/${cafe.slug}/masalar/${target.id}`);
          }}
        />
      )}

      {sheet?.kind === "meta" && server.order && order && (
        <OrderMetaSheet
          order={order}
          busy={busy}
          onClose={() => setSheet(null)}
          onSave={async (note, discount) => {
            const ok = await runSimple(() => updateOrderAction(cafe.id, server.order!.id, note, discount), "Adisyon güncellendi");
            if (ok) setSheet(null);
          }}
        />
      )}

      {sheet?.kind === "cancel" && server.order && (
        <CancelSheet
          busy={busy}
          hasPayments={(order?.payments.length ?? 0) > 0}
          onClose={() => setSheet(null)}
          onConfirm={async (reason) => {
            await whenIdle();
            setBusy(true);
            const result = await voidOrderAction(cafe.id, server.order!.id, reason).catch(() => null);
            setBusy(false);
            if (!result || !result.ok) return toast.show(result?.ok === false ? result.error : "Bağlantı sorunu.", "error");
            setTableOrder(tableId, null);
            toast.show(`${table.name} adisyonu iptal edildi`);
            router.push(`/${cafe.slug}/masalar`);
          }}
        />
      )}
    </div>
  );
}

/** Ödeme ekranının seçimini, satırlar değişince sıfırlamak için */
function payKey(order: NonNullable<ReturnType<typeof applyPending>>) {
  return [order.paid, ...order.items.map((i) => `${i.id}:${i.quantity}:${i.paid_parts}:${i.split_parts}:${i.unit_price}:${i.unit_discount}:${i.is_comp}`)].join("|");
}

function TicketFooter({
  order,
  saving,
  onPay,
  canPay,
  compact,
  onGuests,
}: {
  order: ReturnType<typeof applyPending>;
  saving: boolean;
  onPay: () => void;
  canPay: boolean;
  compact?: boolean;
  /** Masadaki kişi sayısı (isteğe bağlı; müşteri analizi için) */
  onGuests?: (guests: number | null) => void;
}) {
  const guests = order?.guests ?? null;
  return (
    <div className={cn("bg-white", !compact && "border-t border-stone-200 px-5 py-4")}>
      {order && onGuests && (
        <div className="mb-3 flex items-center justify-between gap-3 rounded-xl bg-stone-50 px-3 py-1.5">
          <span className="flex items-center gap-2 text-[14px] font-semibold text-stone-600">
            <Users className="size-4" /> Kişi sayısı
          </span>
          <div className="flex items-center">
            <button
              type="button"
              onClick={() => onGuests(guests && guests > 1 ? guests - 1 : null)}
              disabled={!guests}
              className="grid size-9 place-items-center rounded-lg text-stone-600 hover:bg-white disabled:opacity-30"
              aria-label="Kişi azalt"
            >
              <Minus className="size-4" />
            </button>
            <span className="w-8 text-center text-[16px] font-bold tabular-nums">{guests ?? "–"}</span>
            <button
              type="button"
              onClick={() => onGuests(Math.min(99, (guests ?? 0) + 1))}
              className="grid size-9 place-items-center rounded-lg text-brand-700 hover:bg-white"
              aria-label="Kişi artır"
            >
              <Plus className="size-4" />
            </button>
          </div>
        </div>
      )}
      {order && (order.comp_total > 0 || order.discount > 0 || order.paid > 0) && (
        <dl className="mb-3 flex flex-col gap-1 text-[14px]">
          <Row label="Ara toplam" value={tl(order.subtotal)} />
          {order.comp_total > 0 && <Row label="İkram" value={tl(order.comp_total)} muted />}
          {order.discount > 0 && <Row label="İndirim" value={`−${tl(order.discount)}`} />}
          {order.paid > 0 && <Row label="Alınan ödeme" value={`−${tl(order.paid)}`} />}
        </dl>
      )}
      <div className="flex items-end justify-between">
        <span className="text-[14px] font-semibold text-stone-500">{order && order.paid > 0 ? "Kalan" : "Toplam"}</span>
        <span className="text-[28px] font-extrabold leading-none tabular-nums">{tl(order?.remaining ?? 0)}</span>
      </div>
      <Button size="xl" className="mt-3 w-full" onClick={onPay} disabled={!canPay || saving}>
        {saving ? (
          <>
            <Spinner /> Kaydediliyor…
          </>
        ) : (
          "Ödeme al"
        )}
      </Button>
    </div>
  );
}

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex justify-between">
      <dt className="text-stone-500">{label}</dt>
      <dd className={cn("font-semibold tabular-nums", muted && "text-stone-400 line-through")}>{value}</dd>
    </div>
  );
}

function ActionRow({ label, onClick, danger }: { label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-14 items-center justify-between rounded-xl border px-4 text-[15px] font-semibold",
        danger ? "border-red-200 text-red-700 hover:bg-red-50" : "border-stone-200 text-stone-800 hover:bg-stone-50",
      )}
    >
      {label}
      <ChevronRight className="size-5 opacity-50" />
    </button>
  );
}

const CANCEL_REASONS = ["Müşteri vazgeçti", "Yanlış masaya açıldı", "Müşteri ödemeden ayrıldı", "Diğer"];

function CancelSheet({
  busy,
  hasPayments,
  onClose,
  onConfirm,
}: {
  busy: boolean;
  hasPayments: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState(CANCEL_REASONS[0]);
  return (
    <ConfirmSheet
      open
      onClose={onClose}
      onConfirm={() => onConfirm(reason)}
      title="Adisyon iptal edilsin mi?"
      confirmLabel="İptal et"
      danger
      pending={busy}
      description={
        hasPayments
          ? "Bu adisyonda alınmış ödeme var; iptal edilince ödemeler de silinir. Ciroya yazılmaz, raporlarda iptal olarak görünür."
          : "İptal edilen adisyon ciroya yazılmaz ama raporlarda iptal olarak görünür."
      }
    >
      <div className="mt-4 flex flex-wrap gap-2">
        {CANCEL_REASONS.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setReason(r)}
            className={cn(
              "h-10 rounded-full border px-4 text-[14px] font-semibold",
              reason === r ? "border-stone-900 bg-stone-900 text-white" : "border-stone-200 text-stone-600",
            )}
          >
            {r}
          </button>
        ))}
      </div>
    </ConfirmSheet>
  );
}
