// Misafir (QR masa) API'si. Ödeme yok; kişisel veri tutulmaz (IP kaydedilmez, kimlik sorulmaz).
//   GET  ?a=table&t=TOKEN            masa, seçenekler, tükenenler
//   GET  ?a=status&t=TOKEN&ids=1,2   siparişlerin durumu
//   GET  ?a=bill&t=TOKEN             masanın ödenmemiş hesabı
//   POST a=order  t, items(JSON), note
//   POST a=call   t, type=garson|hesap
// lang=en eklenirse mesajlar İngilizce döner. İstemci: public/assets/js/menu.js

import { GuestError, guestBill, guestCall, guestOrder, guestStatus, guestTable } from "@/site/guest";

export const dynamic = "force-dynamic";

const HEADERS = { "X-Robots-Tag": "noindex", "Cache-Control": "no-store" };
const out = (status: number, body: Record<string, unknown>) => Response.json(body, { status, headers: HEADERS });

async function handle(lang: "tr" | "en", fn: () => Promise<Record<string, unknown>>) {
  try {
    return out(200, { ok: true, ...(await fn()) });
  } catch (error) {
    if (error instanceof GuestError) {
      const msg = error.message === "table" ? (lang === "en" ? "Table not found." : "Masa bulunamadı.") : error.message;
      return out(error.status, { ok: false, error: msg, ...error.extra });
    }
    console.error("[qr sipariş]", error);
    return out(500, { ok: false, error: lang === "en" ? "Server error, please order from our staff." : "Sunucu hatası, lütfen personele sipariş ver." });
  }
}

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  const lang = q.get("lang") === "en" ? "en" : "tr";
  const token = q.get("t") ?? "";
  switch (q.get("a")) {
    case "table":
      return handle(lang, () => guestTable(token));
    case "status": {
      const ids = (q.get("ids") ?? "").split(",").map(Number).filter((n) => Number.isInteger(n) && n > 0).slice(0, 20);
      return handle(lang, () => guestStatus(token, ids, lang));
    }
    case "bill":
      return handle(lang, () => guestBill(token));
    default:
      return out(400, { ok: false, error: lang === "en" ? "Unknown action." : "Bilinmeyen işlem." });
  }
}

export async function POST(request: Request) {
  // Yalnızca aynı siteden gelen istekler (başka sitelerden sipariş gönderilemesin)
  const origin = request.headers.get("origin");
  const host = (request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "").split(":")[0];
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return out(400, { ok: false, error: "Geçersiz istek." });
  }
  const lang = form.get("lang") === "en" ? "en" : "tr";
  if (origin && new URL(origin).hostname !== host) return out(403, { ok: false, error: lang === "en" ? "Request rejected." : "İstek reddedildi." });
  const token = String(form.get("t") ?? "");
  switch (form.get("a")) {
    case "order": {
      let items: unknown;
      try {
        items = JSON.parse(String(form.get("items") ?? "[]"));
      } catch {
        items = [];
      }
      return handle(lang, async () => ({ order: await guestOrder(token, Array.isArray(items) ? items : [], String(form.get("note") ?? ""), lang) }));
    }
    case "call":
      return handle(lang, () => guestCall(token, String(form.get("type") ?? "garson"), lang));
    default:
      return out(400, { ok: false, error: lang === "en" ? "Unknown action." : "Bilinmeyen işlem." });
  }
}
