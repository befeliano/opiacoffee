// QR giriş noktası: /m/TOKEN. Masa geçerli ve QR sipariş açıksa menü sipariş modunda, değilse düz menü açılır.

import { guestTable } from "@/site/guest";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let to = "/menu";
  try {
    const t = await guestTable(token);
    if (t.ordering) to = `/menu?t=${encodeURIComponent(token)}`;
  } catch {
    // geçersiz kod: düz menü
  }
  return new Response(null, {
    status: 302,
    headers: { Location: to, "X-Robots-Tag": "noindex, nofollow", "Cache-Control": "no-store" },
  });
}
