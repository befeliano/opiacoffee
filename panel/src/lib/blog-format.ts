// Blog yazılarının panelde yazıldığı basit biçim ve HTML'e çevirisi.
//   ## Ara başlık        ### Küçük başlık
//   - madde              (boş satır paragrafları ayırır)
//   **kalın**            [bağlantı metni](https://... ya da /menu)
// HTML'e çevirirken her metin kaçışlanır; yalnızca bu etiketler üretilir (h2, h3, p, ul, li, strong, a).

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Yalnızca sitenin kendi yolları ve http(s) bağlantıları */
function safeHref(href: string): string | null {
  const h = href.trim();
  if (/^\/(?!\/)[\w\-./#?=&%]*$/.test(h)) return h;
  if (/^https?:\/\/[^\s"'<>]+$/i.test(h)) return h;
  return null;
}

function inline(text: string): string {
  let out = "";
  const re = /\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g;
  let last = 0;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    out += esc(text.slice(last, m.index));
    if (m[1] !== undefined) out += `<strong>${esc(m[1])}</strong>`;
    else {
      const href = safeHref(m[3]);
      out += href ? `<a href="${esc(href)}"${href.startsWith("/") ? "" : ' rel="noopener"'}>${esc(m[2])}</a>` : esc(m[0]);
    }
    last = m.index + m[0].length;
  }
  return out + esc(text.slice(last));
}

export function blogToHtml(text: string): string {
  const html: string[] = [];
  let para: string[] = [];
  let list: string[] = [];
  const flushPara = () => {
    if (para.length) html.push(`<p>${inline(para.join(" "))}</p>`);
    para = [];
  };
  const flushList = () => {
    if (list.length) html.push(`<ul>${list.map((li) => `<li>${inline(li)}</li>`).join("")}</ul>`);
    list = [];
  };
  for (const raw of text.replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.trim();
    if (!line) {
      flushPara();
      flushList();
    } else if (line.startsWith("### ")) {
      flushPara();
      flushList();
      html.push(`<h3>${inline(line.slice(4))}</h3>`);
    } else if (line.startsWith("## ")) {
      flushPara();
      flushList();
      html.push(`<h2>${inline(line.slice(3))}</h2>`);
    } else if (/^[-*] /.test(line)) {
      flushPara();
      list.push(line.slice(2));
    } else {
      flushList();
      para.push(line);
    }
  }
  flushPara();
  flushList();
  return html.join("\n");
}

/** Hazır yazıların HTML'ini panelde düzenlenecek basit biçime çevirir */
export function htmlToBlog(html: string): string {
  const text = (s: string) =>
    s
      .replace(/<strong>([\s\S]*?)<\/strong>/g, "**$1**")
      .replace(/<a [^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g, "[$2]($1)")
      .replace(/<[^>]+>/g, "")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, " ")
      .trim();
  const blocks: string[] = [];
  const re = /<(h2|h3|p|ul)>([\s\S]*?)<\/\1>/g;
  for (let m = re.exec(html); m; m = re.exec(html)) {
    if (m[1] === "h2") blocks.push(`## ${text(m[2])}`);
    else if (m[1] === "h3") blocks.push(`### ${text(m[2])}`);
    else if (m[1] === "p") blocks.push(text(m[2]));
    else blocks.push([...m[2].matchAll(/<li>([\s\S]*?)<\/li>/g)].map((li) => `- ${text(li[1])}`).join("\n"));
  }
  return blocks.join("\n\n");
}

/** Türkçe başlıktan adres: "Soğuk Demleme Nedir?" → "soguk-demleme-nedir" */
export function blogSlug(title: string): string {
  return title
    .trim()
    .toLocaleLowerCase("tr-TR")
    .replace(/[çğıöşü]/g, (c) => ({ ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u" })[c] ?? c)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80)
    .replace(/-$/, "");
}
