// Panelden seçilen site renkleri ve köşeleri (Web sitesi › Görünüm). main.css'ten sonra yüklenir.

import { themeCss } from "@/lib/site-settings";
import { getSiteExtras } from "@/site/site-data";

export const dynamic = "force-dynamic";

export async function GET() {
  const { settings } = await getSiteExtras();
  return new Response(themeCss(settings.theme), {
    headers: { "Content-Type": "text/css; charset=utf-8", "Cache-Control": "public, max-age=60" },
  });
}
