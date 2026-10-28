import "server-only";
// QR masa siparişi (misafir). Ödeme yok, kimlik sorulmaz, IP kaydedilmez.
// Sipariş kalemleri masanın adisyonuna eklenir (fiyat ve seçenekler adisyon kurallarıyla sunucuda hesaplanır);
// guest_requests tablosu bar ekranındaki bildirim ve misafirin telefonundaki sipariş durumu içindir.

import type { Pool } from "mysql2/promise";
import { withTx, type Ctx, type Row } from "@/lib/data/mysql/db";
import { bit, cents, cleanText, fromCents, idsJson, left, newId, orderTotals, resolveLine, touchOrder } from "@/lib/data/mysql/helpers";
import { SITE } from "./config";
import { GROUP_NAMES, getSiteMenu } from "./menu-data";

export class GuestError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly extra: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

const OPTION_EN: Record<string, string> = {
  "normal süt": "Regular milk",
  "laktozsuz süt": "Lactose-free milk",
  "bitkisel süt (vegan)": "Plant-based milk (vegan)",
  "bitkisel süt": "Plant-based milk",
  sıcak: "Hot",
  soğuk: "Iced",
  "+1 shot": "+1 shot",
  "+2 shot": "+2 shots",
  "ekstra shot": "Extra shot",
  "çikolata sos": "Chocolate sauce",
  dondurma: "Ice cream",
};
const norm = (s: string) => s.trim().toLocaleLowerCase("tr-TR");
const en = (name: string) => OPTION_EN[norm(name)] ?? name;

export const STATUS_LABEL: Record<string, [string, string]> = {
  yeni: ["Alındı", "Received"],
  hazirlaniyor: ["Hazırlanıyor", "Preparing"],
  teslim: ["Teslim edildi", "Served"],
  iptal: ["İptal", "Cancelled"],
};



async function getPool(): Promise<Pool> {
  const { getMysql } = await import("@/lib/data/mysql/server");
  return (await getMysql()).pool;
}

async function tableByToken(ctx: Ctx, token: string, lock = false) {
  if (!/^[A-Za-z0-9_-]{8,32}$/.test(token)) return null;
  return ctx.one(
    `SELECT t.id, t.name, t.is_active, t.cafe_id, c.qr_ordering, c.open_hour, c.close_hour, c.timezone, c.cash_count
     FROM dining_tables t JOIN cafes c ON c.id = t.cafe_id
     WHERE t.qr_token = ? AND c.slug = ?${lock ? " FOR UPDATE" : ""}`,
    [token, SITE.cafeSlug],
  );
}

function isOpenNow(t: Row, now: Date) {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: t.timezone, hour: "2-digit", hourCycle: "h23" }).format(now));
  return hour >= t.open_hour && hour < t.close_hour;
}

/** Seçenek gruplarının ürün penceresindeki biçimi (assets/js/menu.js okur) */
async function orderOptions(ctx: Ctx, cafe: string) {
  const rows = await ctx.all(
    `SELECT g.name AS group_name, o.id, o.name, o.price_delta, o.is_default
     FROM options o JOIN option_groups g ON g.id = o.group_id
     WHERE o.cafe_id = ? AND o.is_active = 1 ORDER BY g.sort_order, o.sort_order`,
    [cafe],
  );
  const of = (group: string) => rows.filter((r) => norm(r.group_name) === group);
  const shot = of(GROUP_NAMES.shot)[0];
  return {
    milk: of(GROUP_NAMES.milk).map((o) => ({
      id: bit(o.is_default) ? "normal" : o.id,
      label: o.name,
      label_en: en(o.name),
      price: Number(o.price_delta),
    })),
    shot: { label: "Ekstra shot", label_en: "Extra shot", price: shot ? Number(shot.price_delta) : 0, max: shot ? 1 : 0 },
    temp: of(GROUP_NAMES.temp).map((o) => ({ id: bit(o.is_default) ? "sicak" : o.id, label: o.name, label_en: en(o.name) })),
    dessert: of(GROUP_NAMES.dessert).map((o) => ({ id: o.id, label: o.name, label_en: en(o.name), price: Number(o.price_delta) })),
  };
}

const tx = <T>(fn: (ctx: Ctx) => Promise<T>) => getPool().then((pool) => withTx(pool, null, "anon", fn));

export function guestTable(token: string) {
  return tx(async (ctx) => {
    const t = await tableByToken(ctx, token);
    if (!t) throw new GuestError(404, "table", { ordering: false });
    const menu = await getSiteMenu();
    return {
      ordering: bit(t.qr_ordering) && bit(t.is_active),
      open: isOpenNow(t, ctx.now),
      table: { name: t.name },
      hours: { open: `${String(t.open_hour).padStart(2, "0")}:00`, close: "00:00" },
      options: await orderOptions(ctx, t.cafe_id),
      soldout: menu.products.filter((p) => p.soldout).map((p) => p.id),
    };
  });
}

/** Sepet satırı: { id: site ürün kimliği, qty, sel: { milk, shot, temp, addons } } */
interface CartLine {
  id?: unknown;
  qty?: unknown;
  sel?: { milk?: unknown; shot?: unknown; temp?: unknown; addons?: unknown };
}

export function guestOrder(token: string, items: CartLine[], rawNote: string, lang: "tr" | "en") {
  const T = (tr: string, e: string) => (lang === "en" ? e : tr);
  return tx(async (ctx) => {
    const t = await tableByToken(ctx, token, true);
    if (!t) throw new GuestError(404, T("Masa bulunamadı.", "Table not found."), { ordering: false });
    if (!bit(t.qr_ordering) || !bit(t.is_active)) {
      throw new GuestError(403, T("Bu masada QR sipariş şu an kapalı. Siparişini personele verebilirsin.", "QR ordering is off for this table right now. Please order from our staff."), { ordering: false });
    }
    if (!isOpenNow(t, ctx.now)) {
      throw new GuestError(403, T(`Şu an kapalıyız. Sipariş saatleri: ${t.open_hour}:00 - 00:00.`, `We are closed right now. Ordering hours: ${t.open_hour}:00 - 00:00.`));
    }
    if (bit(t.cash_count) && !(await ctx.val("SELECT 1 FROM cafe_days WHERE cafe_id = ? AND closed_at IS NULL LIMIT 1", [t.cafe_id]))) {
      throw new GuestError(403, T("Kafe henüz açılmadı. Siparişini personele verebilirsin.", "We have not opened yet. Please order from our staff."));
    }
    const recent = Number(
      await ctx.val("SELECT COUNT(*) FROM guest_requests WHERE table_id = ? AND kind = 'order' AND created_at > ?", [t.id, new Date(ctx.now.getTime() - 600_000)]),
    );
    if (recent >= 10) throw new GuestError(429, T("Kısa sürede çok fazla sipariş gönderildi. Lütfen personelimize seslen.", "Too many orders in a short time. Please ask our staff."));
    if (!Array.isArray(items) || !items.length) throw new GuestError(422, T("Sepetin boş.", "Your basket is empty."));
    if (items.length > 30) throw new GuestError(422, T("Tek seferde en fazla 30 kalem sipariş verilebilir.", "You can order up to 30 lines at once."));

    const menu = await getSiteMenu();
    const options = await ctx.all(
      `SELECT o.id, o.is_default, g.name AS group_name FROM options o JOIN option_groups g ON g.id = o.group_id WHERE o.cafe_id = ? AND o.is_active = 1`,
      [t.cafe_id],
    );
    const inGroup = (id: unknown, group: string) => options.find((o) => o.id === id && norm(o.group_name) === group)?.id as string | undefined;
    const defaultOf = (group: string) => options.find((o) => bit(o.is_default) && norm(o.group_name) === group)?.id as string | undefined;
    const shotOption = options.find((o) => norm(o.group_name) === GROUP_NAMES.shot)?.id as string | undefined;

    const lines: { productId: string; qty: number; optionIds: string[]; name: string }[] = [];
    for (const it of items) {
      const p = menu.products.find((x) => x.id === it?.id);
      const invalid = T("Sepetteki bir ürün artık sunulmuyor. Sepeti kontrol edip tekrar dene.", "An item in your basket is no longer available. Please check your basket.");
      if (!p || !p.dbId || !p.orderable) throw new GuestError(422, invalid);
      const active = await ctx.val("SELECT is_active FROM products WHERE id = ? AND cafe_id = ?", [p.dbId, t.cafe_id]);
      if (active === null) throw new GuestError(422, invalid);
      if (!bit(active)) throw new GuestError(409, T(`${p.name} şu an tükendi. Sepetten çıkarıp tekrar dene.`, `${p.name} is sold out right now. Please remove it and try again.`), { soldout: p.id });
      const qty = Number(it.qty);
      if (!Number.isInteger(qty) || qty < 1 || qty > 20) throw new GuestError(422, T("Geçersiz adet.", "Invalid quantity."));

      const sel = it.sel ?? {};
      const ids: string[] = [];
      const bad = () => new GuestError(422, T("Geçersiz ürün seçeneği.", "Invalid option."));
      if (p.options.milk) {
        const m = sel.milk === undefined || sel.milk === "normal" ? defaultOf(GROUP_NAMES.milk) : inGroup(sel.milk, GROUP_NAMES.milk);
        if (!m && sel.milk !== undefined && sel.milk !== "normal") throw bad();
        if (m) ids.push(m);
      }
      if (p.options.temp) {
        const v = sel.temp === undefined || sel.temp === "sicak" ? defaultOf(GROUP_NAMES.temp) : inGroup(sel.temp, GROUP_NAMES.temp);
        if (!v && sel.temp !== undefined && sel.temp !== "sicak") throw bad();
        if (v) ids.push(v);
      }
      if (p.options.shot && Number(sel.shot) > 0) {
        if (Number(sel.shot) !== 1 || !shotOption) throw bad();
        ids.push(shotOption);
      }
      if (p.options.dessert && Array.isArray(sel.addons)) {
        for (const a of new Set(sel.addons)) {
          const v = inGroup(a, GROUP_NAMES.dessert);
          if (!v) throw bad();
          ids.push(v);
        }
      }
      lines.push({ productId: p.dbId, qty, optionIds: ids, name: p.name });
    }

    // Masanın açık adisyonu (yoksa açılır)
    let order = await ctx.val<string>("SELECT id FROM orders WHERE table_id = ? AND status = 'open'", [t.id]);
    if (!order) {
      order = newId();
      await ctx.run(
        "INSERT INTO orders (id, cafe_id, table_id, table_name, is_takeaway, opened_at, updated_at) VALUES (?, ?, ?, ?, 0, ?, ?)",
        [order, t.cafe_id, t.id, t.name, ctx.now, ctx.now],
      );
    }

    let total = 0;
    const summary: string[] = [];
    for (const l of lines) {
      let line;
      try {
        line = await resolveLine(ctx, t.cafe_id, l.productId, l.optionIds);
      } catch {
        throw new GuestError(422, T("Geçersiz ürün seçeneği.", "Invalid option."));
      }
      await ctx.run(
        `INSERT INTO order_items (id, cafe_id, order_id, product_id, product_name, category_name, option_ids, options_label,
           quantity, unit_price, list_price, unit_cost, note, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'QR', ?)`,
        [newId(), t.cafe_id, order, line.product_id, line.product_name, line.category_name, idsJson(line.option_ids),
          line.options_label, l.qty, line.unit_price, line.unit_price, line.unit_cost, ctx.now],
      );
      total += l.qty * cents(line.unit_price);
      summary.push(`${l.qty}× ${line.product_name}${line.options_label ? ` (${line.options_label})` : ""}`);
    }

    const note = cleanText(rawNote, 300);
    if (note) {
      await ctx.run("UPDATE orders SET note = ? WHERE id = ?", [
        left([(await ctx.val<string>("SELECT note FROM orders WHERE id = ?", [order])) ?? "", `QR: ${note}`].filter(Boolean).join(" · "), 200),
        order,
      ]);
    }
    await touchOrder(ctx, order);

    const res = await ctx.run(
      "INSERT INTO guest_requests (cafe_id, table_id, table_name, kind, summary, note, total, created_at, updated_at) VALUES (?, ?, ?, 'order', ?, ?, ?, ?, ?)",
      [t.cafe_id, t.id, t.name, left(summary.join(", "), 600), note, fromCents(total), ctx.now, ctx.now],
    );
    const [tr, e] = STATUS_LABEL.yeni;
    return { id: res.insertId, total: fromCents(total), status: "yeni", label: lang === "en" ? e : tr };
  });
}

export function guestCall(token: string, type: string, lang: "tr" | "en") {
  const T = (tr: string, e: string) => (lang === "en" ? e : tr);
  return tx(async (ctx) => {
    const t = await tableByToken(ctx, token, true);
    if (!t) throw new GuestError(404, T("Masa bulunamadı.", "Table not found."), { ordering: false });
    if (!bit(t.qr_ordering) || !bit(t.is_active)) {
      throw new GuestError(403, T("Bu masada QR sipariş şu an kapalı. Siparişini personele verebilirsin.", "QR ordering is off for this table right now. Please order from our staff."), { ordering: false });
    }
    if (type !== "garson" && type !== "hesap") throw new GuestError(422, T("Geçersiz istek.", "Invalid request."));
    const open = await ctx.val("SELECT id FROM guest_requests WHERE table_id = ? AND kind = ? AND status = 'yeni' LIMIT 1", [t.id, type]);
    if (!open) {
      await ctx.run(
        "INSERT INTO guest_requests (cafe_id, table_id, table_name, kind, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
        [t.cafe_id, t.id, t.name, type, ctx.now, ctx.now],
      );
    }
    return {
      message: type === "hesap" ? T("Hesabın için personelimiz geliyor.", "Our staff is coming with your bill.") : T("Garsonumuz masana geliyor.", "A waiter is on the way to your table."),
    };
  });
}

export function guestStatus(token: string, ids: number[], lang: "tr" | "en") {
  return tx(async (ctx) => {
    const t = await tableByToken(ctx, token);
    if (!t) throw new GuestError(404, "table", { ordering: false });
    if (!ids.length) return { orders: [] };
    const rows = await ctx.all(
      `SELECT id, status, total, created_at FROM guest_requests WHERE table_id = ? AND kind = 'order' AND id IN (${ids.map(() => "?").join(",")})`,
      [t.id, ...ids],
    );
    return {
      orders: rows.map((r) => ({
        id: Number(r.id),
        status: r.status,
        total: Number(r.total),
        label: (STATUS_LABEL[r.status] ?? [r.status, r.status])[lang === "en" ? 1 : 0],
      })),
    };
  });
}

export function guestBill(token: string) {
  return tx(async (ctx) => {
    const t = await tableByToken(ctx, token);
    if (!t) throw new GuestError(404, "table", { ordering: false });
    const order = await ctx.val<string>("SELECT id FROM orders WHERE table_id = ? AND status = 'open'", [t.id]);
    if (!order) return { total: 0, orders: 0 };
    const tot = await orderTotals(ctx, order);
    return { total: tot.remaining, orders: 1 };
  });
}
