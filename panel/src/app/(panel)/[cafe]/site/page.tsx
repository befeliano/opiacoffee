import type { Metadata } from "next";
import { Globe } from "lucide-react";
import { SiteView, type SiteAdminData, type SiteProductDefaults } from "@/components/site/site-view";
import { EmptyState } from "@/components/ui/surface";
import { requireCafeRole } from "@/lib/data/cafe";
import { rpc } from "@/lib/data/server";
import { dataBackend } from "@/lib/env";
import { SITE } from "@/site/config";
import content from "@/site/content/menu.json";
import { LOCALS } from "@/site/content/locals";
import { POSTS } from "@/site/content/posts";
import { htmlToBlog } from "@/lib/blog-format";
import type { PanelPost, PanelSlot } from "@/components/site/site-content";
import { existsSync } from "node:fs";
import path from "node:path";

/** Dosyadaki varsayılan fotoğraf (public/assets/img/<yer>.webp...) */
function staticImage(slot: string): string {
  for (const ext of ["webp", "jpg", "jpeg", "png"]) {
    if (existsSync(path.join(process.cwd(), "public", "assets", "img", `${slot}.${ext}`))) return `/assets/img/${slot}.${ext}`;
  }
  return "";
}

export const metadata: Metadata = { title: "Web sitesi" };

const norm = (s: string) => s.trim().toLocaleLowerCase("tr-TR").replace(/\s+/g, " ");

export default async function SitePage({ params }: PageProps<"/[cafe]/site">) {
  const { cafe } = await params;
  const ctx = await requireCafeRole(cafe, "owner");
  if (dataBackend() !== "mysql") {
    return <EmptyState icon={<Globe className="size-6" />} title="Web sitesi ekranı yalnızca canlı kurulumda" description="Bu ekran MySQL veritabanıyla (Hostinger) çalışır." />;
  }
  const [data, images, dbPosts] = await Promise.all([
    rpc<SiteAdminData>("site_admin", { p_cafe: ctx.cafe.id }),
    rpc<{ slot: string; ver: number }[]>("site_images_list", { p_cafe: ctx.cafe.id }),
    rpc<(Omit<PanelPost, "source" | "builtIn">)[]>("site_posts_list", { p_cafe: ctx.cafe.id }),
  ]);
  const vers = new Map(images.map((i) => [i.slot, i.ver]));
  const slot = (key: string, label: string, ratio: string): PanelSlot => ({ slot: key, label, ratio, ver: vers.get(key) ?? 0, fallback: staticImage(key) });
  const slots: PanelSlot[] = [
    slot("hero", "Ana sayfa: büyük fotoğraf", "4:5"),
    ...[1, 2, 3, 4, 5, 6].map((n) => slot(`galeri-${n}`, `Ana sayfa: galeri ${n}`, "1:1")),
    slot("hakkimizda-1", "Hakkımızda: üst fotoğraf", "4:5"),
    slot("hakkimizda-2", "Hakkımızda: alt fotoğraf", "4:3"),
    ...LOCALS.map((l) => slot(l.image, `Sayfa: ${l.h1}`, "4:3")),
  ];
  const dbBySlug = new Map(dbPosts.map((p) => [p.slug, p]));
  const posts: PanelPost[] = [
    ...POSTS.map((s): PanelPost => {
      const d = dbBySlug.get(s.slug);
      return d
        ? { ...d, builtIn: true, source: "edited", cover: slot(`blog-${s.slug}`, s.h1, "16:10") }
        : { slug: s.slug, title: s.h1, description: s.description, lead: s.lead, body: htmlToBlog(s.body), published: true, hidden: false, date: s.date, builtIn: true, source: "builtin", cover: slot(`blog-${s.slug}`, s.h1, "16:10") };
    }),
    ...dbPosts.filter((d) => !POSTS.some((s) => s.slug === d.slug)).map((d): PanelPost => ({ ...d, builtIn: false, source: "panel", cover: slot(`blog-${d.slug}`, d.title, "16:10") })),
  ].sort((a, b) => b.date.localeCompare(a.date));
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
      slots={slots}
      posts={posts}
      defaults={defaults}
      allergens={content.allergens.map((a) => ({ id: a.id, name: a.name }))}
    />
  );
}
