import { localRoute } from "@/site/routes";

export const dynamic = "force-dynamic";

// Yerel SEO sayfaları (/eskisehir-nitelikli-kahve gibi) ve bulunamayan her yol (404)
export async function GET(request: Request, { params }: { params: Promise<{ yol: string[] }> }) {
  return localRoute(request, (await params).yol.map(decodeURIComponent));
}
