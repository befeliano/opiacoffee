import "server-only";
// Sitedeki blog yazıları: hazır yazılar (content/posts.ts) + panelde yazılanlar (Web sitesi › Blog).
// Panelde aynı adresle kaydedilen yazı hazır yazının yerine geçer; "Yayında" kapalıysa sitede görünmez.

import { blogToHtml } from "@/lib/blog-format";
import { POSTS, type Post } from "./content/posts";
import { getSiteExtras } from "./site-data";

export async function getPosts(): Promise<Post[]> {
  const { posts } = await getSiteExtras();
  const db = new Map(posts.map((p) => [p.slug, p]));
  const list: Post[] = [];
  for (const s of POSTS) {
    const d = db.get(s.slug);
    if (!d) list.push(s);
    else if (d.published && !d.hidden) {
      list.push({
        ...s,
        h1: d.title,
        title: d.title.length <= 60 ? d.title : s.title,
        description: d.description || s.description,
        lead: d.lead,
        body: blogToHtml(d.body),
        updated: d.updated,
      });
    }
    db.delete(s.slug);
  }
  for (const d of db.values()) {
    if (!d.published || d.hidden) continue;
    list.push({
      slug: d.slug,
      title: d.title.slice(0, 60),
      description: d.description,
      h1: d.title,
      date: d.date,
      updated: d.updated,
      lead: d.lead,
      section: "Blog",
      keywords: [],
      products: [],
      body: blogToHtml(d.body),
      faq: [],
    });
  }
  return list.sort((a, b) => b.date.localeCompare(a.date));
}
