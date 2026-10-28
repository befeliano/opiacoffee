import { blogPostRoute } from "@/site/routes";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  return blogPostRoute(request, decodeURIComponent((await params).slug));
}
