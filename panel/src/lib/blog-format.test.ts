import { describe, expect, it } from "vitest";
import { POSTS } from "@/site/content/posts";
import { blogSlug, blogToHtml, htmlToBlog } from "./blog-format";

describe("blog biçimi", () => {
  it("başlık, madde, kalın ve bağlantıyı çevirir", () => {
    const html = blogToHtml("## Başlık\n\nBir **kalın** söz ve [menü](/menu).\n\n- bir\n- iki");
    expect(html).toBe('<h2>Başlık</h2>\n<p>Bir <strong>kalın</strong> söz ve <a href="/menu">menü</a>.</p>\n<ul><li>bir</li><li>iki</li></ul>');
  });

  it("zararlı içeriği etiket olarak çalıştırmaz", () => {
    const html = blogToHtml('<script>alert(1)</script>\n\n[x](javascript:alert(1)) <img src=x onerror=alert(1)>');
    expect(html).not.toMatch(/<script|<img|href="javascript/);
    expect(html).toContain("&lt;script&gt;");
  });

  it("hazır yazılar HTML → basit biçim → HTML dönüşünde aynı kalır", () => {
    const norm = (s: string) => s.replace(/\s+/g, " ").replace(/> </g, "><").trim();
    for (const p of POSTS) {
      expect(norm(blogToHtml(htmlToBlog(p.body)))).toBe(norm(p.body.replace(/ rel="noopener"/g, "")));
    }
  });

  it("Türkçe başlıktan adres üretir", () => {
    expect(blogSlug("Soğuk Demleme Nedir? İçimi Nasıl?")).toBe("soguk-demleme-nedir-icimi-nasil");
  });
});
