import { SITE, url } from "@/site/config";

const TEXT = { "Content-Type": "text/plain; charset=utf-8" };

export function GET() {
  // Geçici adreste (SITE_NOINDEX=1) arama motorlarına tamamen kapalı
  if (SITE.noindex) return new Response("User-agent: *\nDisallow: /\n", { headers: TEXT });
  const body = `User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /m/\n\nSitemap: ${url("/sitemap.xml")}\n`;
  return new Response(body, { headers: TEXT });
}
