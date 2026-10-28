"use server";

import { z } from "zod";
import type { DayCloseResult, DayStatus, Order, PaymentMethod, PayResult, TableOrderData } from "@/lib/api/types";
import { rpc } from "@/lib/data/server";
import { fail, type ActionResult } from "@/lib/errors";

// POS sunucu eylemleri. Her girdi doğrulanır; yetki ve fiyat hesabı
// veritabanı fonksiyonlarında yapılır.

const id = z.uuid();
const ids = z.array(z.uuid()).max(20);
const note = z.string().max(120).default("");
const money = z.number().min(0).max(99_999);
const methodSchema = z.enum(["cash", "card", "ticket"]);

async function run<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (error) {
    return fail(error);
  }
}

export async function loadTableAction(cafeId: string, tableId: string): Promise<ActionResult<TableOrderData>> {
  return run(async () => {
    const input = z.object({ cafeId: id, tableId: id }).parse({ cafeId, tableId });
    return rpc<TableOrderData>("pos_table_order", { p_cafe: input.cafeId, p_table: input.tableId });
  });
}

export async function addItemAction(
  cafeId: string,
  tableId: string,
  productId: string,
  optionIds: string[],
  quantity: number,
  itemNote = "",
  price: number | null = null,
): Promise<ActionResult<TableOrderData>> {
  return run(async () => {
    const input = z
      .object({ cafeId: id, tableId: id, productId: id, optionIds: ids, quantity: z.int().min(1).max(99), note, price: money.nullable() })
      .parse({ cafeId, tableId, productId, optionIds, quantity, note: itemNote, price });
    return rpc<TableOrderData>("pos_add_item", {
      p_cafe: input.cafeId,
      p_table: input.tableId,
      p_product: input.productId,
      p_option_ids: input.optionIds,
      p_quantity: input.quantity,
      p_note: input.note,
      p_price: input.price,
    });
  });
}

export async function changeQuantityAction(cafeId: string, itemId: string, delta: number): Promise<ActionResult<TableOrderData>> {
  return run(async () => {
    const input = z.object({ cafeId: id, itemId: id, delta: z.int().min(-99).max(99) }).parse({ cafeId, itemId, delta });
    return rpc<TableOrderData>("pos_change_quantity", { p_cafe: input.cafeId, p_item: input.itemId, p_delta: input.delta });
  });
}

export async function updateItemAction(
  cafeId: string,
  itemId: string,
  optionIds: string[],
  quantity: number,
  itemNote: string,
  isComp: boolean,
): Promise<ActionResult<TableOrderData>> {
  return run(async () => {
    const input = z
      .object({ cafeId: id, itemId: id, optionIds: ids, quantity: z.int().min(1).max(999), note, isComp: z.boolean() })
      .parse({ cafeId, itemId, optionIds, quantity, note: itemNote, isComp });
    return rpc<TableOrderData>("pos_update_item", {
      p_cafe: input.cafeId,
      p_item: input.itemId,
      p_option_ids: input.optionIds,
      p_quantity: input.quantity,
      p_note: input.note,
      p_is_comp: input.isComp,
    });
  });
}

export async function removeItemAction(cafeId: string, itemId: string): Promise<ActionResult<TableOrderData>> {
  return run(async () => {
    const input = z.object({ cafeId: id, itemId: id }).parse({ cafeId, itemId });
    return rpc<TableOrderData>("pos_remove_item", { p_cafe: input.cafeId, p_item: input.itemId });
  });
}

export async function updateOrderAction(
  cafeId: string,
  orderId: string,
  orderNote: string,
  discount: number,
): Promise<ActionResult<TableOrderData>> {
  return run(async () => {
    const input = z
      .object({ cafeId: id, orderId: id, note: z.string().max(200), discount: z.number().min(0).max(1_000_000) })
      .parse({ cafeId, orderId, note: orderNote, discount });
    return rpc<TableOrderData>("pos_update_order", {
      p_cafe: input.cafeId,
      p_order: input.orderId,
      p_note: input.note,
      p_discount: input.discount,
    });
  });
}

export async function payAction(
  cafeId: string,
  orderId: string,
  method: PaymentMethod,
  amount: number | null,
): Promise<ActionResult<PayResult>> {
  return run(async () => {
    const input = z
      .object({
        cafeId: id,
        orderId: id,
        method: methodSchema,
        amount: z.number().positive().max(1_000_000).nullable(),
      })
      .parse({ cafeId, orderId, method, amount });
    return rpc<PayResult>("pos_pay", {
      p_cafe: input.cafeId,
      p_order: input.orderId,
      p_method: input.method,
      p_amount: input.amount,
    });
  });
}

export async function deletePaymentAction(cafeId: string, paymentId: string): Promise<ActionResult<TableOrderData>> {
  return run(async () => {
    const input = z.object({ cafeId: id, paymentId: id }).parse({ cafeId, paymentId });
    return rpc<TableOrderData>("pos_delete_payment", { p_cafe: input.cafeId, p_payment: input.paymentId });
  });
}

export async function cancelOrderAction(cafeId: string, orderId: string, reason: string): Promise<ActionResult<{ ok: boolean }>> {
  return run(async () => {
    const input = z.object({ cafeId: id, orderId: id, reason: z.string().max(200) }).parse({ cafeId, orderId, reason });
    return rpc<{ ok: boolean }>("pos_cancel_order", { p_cafe: input.cafeId, p_order: input.orderId, p_reason: input.reason });
  });
}

export async function moveOrderAction(cafeId: string, orderId: string, targetTableId: string): Promise<ActionResult<TableOrderData>> {
  return run(async () => {
    const input = z.object({ cafeId: id, orderId: id, targetTableId: id }).parse({ cafeId, orderId, targetTableId });
    return rpc<TableOrderData>("pos_move_order", {
      p_cafe: input.cafeId,
      p_order: input.orderId,
      p_target_table: input.targetTableId,
    });
  });
}

export async function changePaymentMethodAction(
  cafeId: string,
  paymentId: string,
  method: PaymentMethod,
): Promise<ActionResult<Order>> {
  return run(async () => {
    const input = z.object({ cafeId: id, paymentId: id, method: methodSchema }).parse({ cafeId, paymentId, method });
    return rpc<Order>("pos_change_payment_method", { p_cafe: input.cafeId, p_payment: input.paymentId, p_method: input.method });
  });
}

export async function reopenOrderAction(cafeId: string, orderId: string): Promise<ActionResult<TableOrderData>> {
  return run(async () => {
    const input = z.object({ cafeId: id, orderId: id }).parse({ cafeId, orderId });
    return rpc<TableOrderData>("pos_reopen_order", { p_cafe: input.cafeId, p_order: input.orderId });
  });
}

/** Satırın birim fiyatını (menü dışı / fazla fiyat) ve birim indirimini ayarlar */
export async function priceItemAction(
  cafeId: string,
  itemId: string,
  unitPrice: number,
  unitDiscount: number,
): Promise<ActionResult<TableOrderData>> {
  return run(async () => {
    const input = z
      .object({ cafeId: id, itemId: id, unitPrice: money, unitDiscount: money })
      .parse({ cafeId, itemId, unitPrice, unitDiscount });
    return rpc<TableOrderData>("pos_price_item", {
      p_cafe: input.cafeId,
      p_item: input.itemId,
      p_unit_price: input.unitPrice,
      p_unit_discount: input.unitDiscount,
    });
  });
}

/** Seçilen ürünlerin ödemesini alır */
export async function payItemsAction(
  cafeId: string,
  orderId: string,
  method: PaymentMethod,
  lines: { itemId: string; quantity: number }[],
): Promise<ActionResult<PayResult>> {
  return run(async () => {
    const input = z
      .object({
        cafeId: id,
        orderId: id,
        method: methodSchema,
        lines: z.array(z.object({ itemId: id, quantity: z.int().min(1).max(999) })).min(1).max(200),
      })
      .parse({ cafeId, orderId, method, lines });
    return rpc<PayResult>("pos_pay_items", {
      p_cafe: input.cafeId,
      p_order: input.orderId,
      p_method: input.method,
      p_lines: input.lines.map((l) => ({ item_id: l.itemId, quantity: l.quantity })),
    });
  });
}

// ---------------------------------------------------------------------
// İş günü: aç / kapat (yalnızca Ayarlar › "Açılış/kapanışta kasa sayımı" açıksa)
// ---------------------------------------------------------------------
export async function dayStatusAction(cafeId: string): Promise<ActionResult<DayStatus>> {
  return run(async () => rpc<DayStatus>("day_status", { p_cafe: id.parse(cafeId) }));
}

const cashCount = z.number().min(0).max(9_999_999).nullable();

/** Açılış nakdi boş (null) = pas geçildi */
export async function dayOpenAction(cafeId: string, openingCash: number | null): Promise<ActionResult<DayStatus>> {
  return run(async () => {
    const input = z.object({ cafeId: id, cash: cashCount }).parse({ cafeId, cash: openingCash });
    return rpc<DayStatus>("day_open", { p_cafe: input.cafeId, p_opening_cash: input.cash });
  });
}

/** Sayılan nakit ve POS toplamı isteğe bağlı (null = pas geçildi) */
export async function dayCloseAction(
  cafeId: string,
  countedCash: number | null,
  posTotal: number | null,
  closeNote: string,
): Promise<ActionResult<DayCloseResult>> {
  return run(async () => {
    const input = z
      .object({ cafeId: id, cash: cashCount, pos: cashCount, note: z.string().max(200) })
      .parse({ cafeId, cash: countedCash, pos: posTotal, note: closeNote });
    return rpc<DayCloseResult>("day_close", {
      p_cafe: input.cafeId,
      p_counted_cash: input.cash,
      p_note: input.note,
      p_pos_total: input.pos,
    });
  });
}

/** Yanlış alınan adisyonu ödemeleriyle birlikte iptal eder (personel: yalnızca bugün) */
export async function voidOrderAction(cafeId: string, orderId: string, reason: string): Promise<ActionResult<{ ok: boolean }>> {
  return run(async () => {
    const input = z.object({ cafeId: id, orderId: id, reason: z.string().max(200) }).parse({ cafeId, orderId, reason });
    return rpc<{ ok: boolean }>("pos_void_order", { p_cafe: input.cafeId, p_order: input.orderId, p_reason: input.reason });
  });
}

/** Satırı N kişiye böler (1 = bölmeyi kaldır); her pay ayrı ödenebilir */
export async function splitItemAction(cafeId: string, itemId: string, parts: number): Promise<ActionResult<TableOrderData>> {
  return run(async () => {
    const input = z.object({ cafeId: id, itemId: id, parts: z.int().min(1).max(20) }).parse({ cafeId, itemId, parts });
    return rpc<TableOrderData>("pos_split_item", { p_cafe: input.cafeId, p_item: input.itemId, p_parts: input.parts });
  });
}

/** Masadaki kişi sayısı (boş = bilinmiyor) */
export async function setGuestsAction(cafeId: string, orderId: string, guests: number | null): Promise<ActionResult<TableOrderData>> {
  return run(async () => {
    const input = z.object({ cafeId: id, orderId: id, guests: z.int().min(1).max(99).nullable() }).parse({ cafeId, orderId, guests });
    return rpc<TableOrderData>("pos_set_guests", { p_cafe: input.cafeId, p_order: input.orderId, p_guests: input.guests });
  });
}
