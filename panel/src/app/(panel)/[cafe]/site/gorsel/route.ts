// Web sitesi ekranından görsel yükleme (çok parçalı form: "file", "tur" = urun | magaza, "id").
// Görsel tarayıcıda küçültülüp WEBP'ye çevrilerek gelir. Yetkiyi veritabanı denetler (yalnızca sahip).

import { z } from "zod";
import type { CafeContext } from "@/lib/api/types";
import { rpc } from "@/lib/data/server";
import { toAppError } from "@/lib/errors";
import { clearSiteExtrasCache } from "@/site/site-data";

const MAX_BYTES = 1.5 * 1024 * 1024;
const MIMES = ["image/webp", "image/jpeg", "image/png"];

export async function POST(request: Request, { params }: { params: Promise<{ cafe: string }> }) {
  const origin = request.headers.get("origin");
  const host = (request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "").split(":")[0];
  if (origin && new URL(origin).hostname !== host) return Response.json({ ok: false, error: "İstek reddedildi." }, { status: 403 });
  try {
    const { cafe } = await params;
    const form = await request.formData();
    const file = form.get("file");
    const kind = z.enum(["urun", "magaza"]).parse(form.get("tur"));
    const target = z.uuid().parse(form.get("id"));
    if (!(file instanceof File)) return Response.json({ ok: false, error: "Görsel seçilmedi." }, { status: 400 });
    if (!MIMES.includes(file.type)) return Response.json({ ok: false, error: "Yalnızca JPG, PNG ya da WEBP yüklenebilir." }, { status: 400 });
    if (file.size > MAX_BYTES) return Response.json({ ok: false, error: "Görsel çok büyük (en fazla 1,5 MB)." }, { status: 400 });
    const cafeId = (await rpc<CafeContext>("app_cafe_context", { p_slug: cafe })).cafe.id;
    const data = Buffer.from(await file.arrayBuffer()).toString("base64");
    const ver =
      kind === "urun"
        ? await rpc<number>("site_product_image", { p_cafe: cafeId, p_product: target, p_mime: file.type, p_data: data })
        : await rpc<number>("shop_image", { p_cafe: cafeId, p_id: target, p_mime: file.type, p_data: data });
    clearSiteExtrasCache();
    return Response.json({ ok: true, ver });
  } catch (error) {
    const e = toAppError(error);
    const status = e.code === "E_NOT_AUTHENTICATED" ? 401 : e.code === "E_FORBIDDEN" ? 403 : 400;
    return Response.json({ ok: false, error: e.message }, { status });
  }
}
