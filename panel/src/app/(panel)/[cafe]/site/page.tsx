import type { Metadata } from "next";
import { Globe } from "lucide-react";
import { SiteView, type SiteAdminData, type SiteProductDefaults } from "@/components/site/site-view";
import { EmptyState } from "@/components/ui/surface";
import { requireCafeRole } from "@/lib/data/cafe";
import { rpc } from "@/lib/data/server";
import { dataBackend } from "@/lib/env";
import { SITE } from "@/site/config";
import content from "@/site/content/menu.json";

export const metadata: Metadata = { title: "Web sitesi" };

const norm = (s: string) => s.trim().toLocaleLowerCase("tr-TR").replace(/\s+/g, " ");

export default async function SitePage({ params }: PageProps<"/[cafe]/site">) {
  const { cafe } = await params;
  const ctx = await requireCafeRole(cafe, "owner");
  if (dataBackend() !== "mysql") {
    return <EmptyState icon={<Globe className="size-6" />} title="Web sitesi ekranı yalnızca canlı kurulumda" description="Bu ekran MySQL veritabanıyla (Hostinger) çalışır." />;
  }
  const data = await rpc<SiteAdminData>("site_admin", { p_cafe: ctx.cafe.id });
  // Menü dosyasındaki (src/site/content/menu.json) bilgiler: panelde değiştirilmediyse sitede bunlar görünür
  const byName = new Map(content.products.map((p) => [norm(p.name), p]));
  const defaults: Record<string, SiteProductDefaults> = {};
  for (const p of data.products) {
    const c = byName.get(norm(p.name));
    defaults[p.id] = {
      name_en: c?.name_en ?? "",
      description_en: c?.description_en ?? "",
      allergens: c?.allergens ?? [],
      allergen_unknown: c ? c.allergenUnknown : true,
      featured: c?.featured ?? false,
      seasonal: c?.seasonal ?? false,
      image: c?.image ? `/uploads/${c.image}` : "",
    };
  }
  return (
    <SiteView
      cafeId={ctx.cafe.id}
      slug={ctx.cafe.slug}
      siteUrl={SITE.url}
      data={data}
      defaults={defaults}
      allergens={content.allergens.map((a) => ({ id: a.id, name: a.name }))}
    />
  );
}
