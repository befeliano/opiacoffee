import { url } from "@/site/config";

export function GET() {
  const body = `User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /m/\n\nSitemap: ${url("/sitemap.xml")}\n`;
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
