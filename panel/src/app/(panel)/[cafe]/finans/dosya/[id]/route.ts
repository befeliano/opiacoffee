// Gider faturası (e-arşiv PDF ya da fotoğraf): GET görüntüler, POST yükler (çok parçalı form, "file" alanı).
// Sunucu eylemlerinin gövde sınırı küçük olduğu için yükleme buradan yapılır. Yetkiyi veritabanı denetler (yalnızca sahip).

import { z } from "zod";
import type { CafeContext } from "@/lib/api/types";
import { rpc } from "@/lib/data/server";
import { toAppError } from "@/lib/errors";

const MAX_FILE_BYTES = 3 * 1024 * 1024;
const MIMES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

type Params = { params: Promise<{ cafe: string; id: string }> };

async function cafeId(slug: string) {
  return (await rpc<CafeContext>("app_cafe_context", { p_slug: slug })).cafe.id;
}

const errorResponse = (error: unknown) => {
  const e = toAppError(error);
  const status = e.code === "E_NOT_AUTHENTICATED" ? 401 : e.code === "E_FORBIDDEN" ? 403 : e.code === "E_NOT_FOUND" ? 404 : 400;
  return Response.json({ ok: false, error: e.message }, { status });
};

export async function GET(_request: Request, { params }: Params) {
  try {
    const { cafe, id } = await params;
    const file = await rpc<{ name: string; mime: string; data: string }>("finance_get_file", { p_cafe: await cafeId(cafe), p_id: z.uuid().parse(id) });
    return new Response(Buffer.from(file.data, "base64"), {
      headers: {
        "Content-Type": file.mime,
        "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(file.name)}`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request, { params }: Params) {
  // Yalnızca aynı siteden gelen yüklemeler
  const origin = request.headers.get("origin");
  const host = (request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "").split(":")[0];
  if (origin && new URL(origin).hostname !== host) return Response.json({ ok: false, error: "İstek reddedildi." }, { status: 403 });
  try {
    const { cafe, id } = await params;
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return Response.json({ ok: false, error: "Dosya seçilmedi." }, { status: 400 });
    if (!MIMES.includes(file.type)) return Response.json({ ok: false, error: "Yalnızca PDF, JPG, PNG ya da WEBP yüklenebilir." }, { status: 400 });
    if (file.size > MAX_FILE_BYTES) return Response.json({ ok: false, error: "Dosya en fazla 3 MB olabilir." }, { status: 400 });
    const data = Buffer.from(await file.arrayBuffer()).toString("base64");
    const saved = await rpc<{ name: string; size: number }>("finance_set_file", {
      p_cafe: await cafeId(cafe),
      p_id: z.uuid().parse(id),
      p_name: file.name || "fatura",
      p_mime: file.type,
      p_data: data,
    });
    return Response.json({ ok: true, file: saved });
  } catch (error) {
    return errorResponse(error);
  }
}
