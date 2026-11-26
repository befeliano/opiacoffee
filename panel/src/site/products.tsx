/** @jsxImportSource @/site/jsx */
// Ürün satırı, ürün kartı ve modal verisi (PHP sürümündeki product_row/product_card/menu_embed)

import { money, url, type Lang } from "./config";
import { t } from "./i18n";
import { allergenNames, cn, productImg, pd, pn, pnote, productsIn, ptags, servingLabel, type SiteMenu, type SiteProduct } from "./menu-data";
import { Icon, Lw, langWrapHtml } from "./ui";
import { esc } from "./jsx/jsx-runtime";

function ProductImg({ p, lang }: { p: SiteProduct; lang: Lang }) {
  if (p.image) {
    return <img src={productImg(p.image)} alt={`${pn(p, lang)}, Opia Coffee Co. Eskişehir`} loading="lazy" decoding="async" />;
  }
  return (
    <span className="noimg" aria-hidden="true">
      <Icon name="cup" />
    </span>
  );
}

/** Ürün adı: büyük harfe çevrilirken doğru i/İ için dil etiketi */
function PName({ p, lang }: { p: SiteProduct; lang: Lang }) {
  const name = pn(p, lang);
  if (lang === "en") return p.lang === "tr" && !p.name_en ? <span lang="tr">{name}</span> : <>{name}</>;
  // Türkçe adın içindeki İngilizce sözcükler (Brownie, San Sebastian) de lang="en" ile sarılır
  return p.lang === "en" ? <span lang="en">{name}</span> : <Lw lang="tr">{name}</Lw>;
}

export function priceLabel(p: SiteProduct) {
  const prices = p.nutrition.servings.map((s) => s.price).filter((x): x is number => !!x);
  if (prices.length > 1 && Math.min(...prices) < Math.max(...prices)) return `${money(Math.min(...prices))} - ${money(Math.max(...prices))}`;
  return money(p.price);
}

/** Menü satırı (Fleabag düzeni): fotoğraf varsa küçük kare, ad ve kısa açıklama, noktalı çizgi, fiyat */
export function ProductRow({ p, lang }: { p: SiteProduct; lang: Lang }) {
  const note = pnote(p, lang);
  const desc = pd(p, lang);
  return (
    <li className={`row${p.soldout ? " is-soldout" : ""}${p.image ? " has-img" : ""}`}>
      <button type="button" className="prod" data-id={p.id} aria-haspopup="dialog">
        {p.image && (
          <span className="prod__thumb">
            <ProductImg p={p} lang={lang} />
          </span>
        )}
        <span className="prod__txt">
          <span className="prod__name">
            <PName p={p} lang={lang} />
            {p.seasonal && <span className="badge">{t(lang, "seasonal")}</span>}
            {p.soldout && <span className="badge badge--out">{t(lang, "soldout")}</span>}
          </span>
          {desc && <span className="prod__desc">{desc}</span>}
        </span>
        <span className="prod__dots" aria-hidden="true"></span>
        <span className="prod__price">
          {priceLabel(p)}
          {note && <small>{note}</small>}
        </span>
      </button>
    </li>
  );
}

export function ProductCard({ p, lang }: { p: SiteProduct; lang: Lang }) {
  const tag = p.soldout ? t(lang, "soldout") : (ptags(p, lang)[0] ?? t(lang, "seasonal"));
  return (
    <li className={`card${p.soldout ? " is-soldout" : ""}`} data-allergens={p.allergens.join(" ")}>
      <button type="button" className="prod prod--card" data-id={p.id} aria-haspopup="dialog">
        <span className="card__img">
          <ProductImg p={p} lang={lang} />
        </span>
        <span className="card__body">
          <span className="card__tag">{tag}</span>
          <span className="card__name">
            <PName p={p} lang={lang} />
          </span>
          <span className="card__desc">{pd(p, lang)}</span>
          <span className="card__price">{priceLabel(p)}</span>
        </span>
      </button>
    </li>
  );
}

/** Modal için sayfaya gömülen ürün verisi (assets/js/menu.js okur) */
export function MenuEmbed({ products, menu, lang }: { products: SiteProduct[]; menu: SiteMenu; lang: Lang }) {
  const al = allergenNames(menu, lang);
  const data = Object.fromEntries(
    products.map((p) => [
      p.id,
      {
        id: p.id,
        name: pn(p, lang),
        // Başlıkta büyük harf: Türkçe addaki İngilizce sözcükler lang="en" ile sarılı
        nameHtml: p.lang === "en" || lang === "en" ? "" : langWrapHtml(esc(pn(p, lang)), "tr"),
        lang: lang === "en" ? (!p.name_en && p.lang === "tr" ? "tr" : "en") : p.lang,
        description: pd(p, lang),
        price: p.price,
        priceNote: pnote(p, lang),
        image: p.image,
        tags: ptags(p, lang),
        seasonal: p.seasonal,
        soldout: p.soldout,
        allergens: p.allergens.map((a) => al[a] ?? a),
        allergenUnknown: p.allergenUnknown && !p.allergens.length,
        nutrition: { ...p.nutrition, servings: p.nutrition.servings.map((s) => ({ ...s, label: servingLabel(s.label, lang) })) },
        options: p.options,
        orderable: p.orderable,
      },
    ]),
  );
  const json = JSON.stringify(data).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
  return <script type="application/json" id="menu-data" dangerouslySetInnerHTML={{ __html: json }} />;
}

export function menuSchema(m: SiteMenu, lang: Lang) {
  const sections = [];
  for (const c of [...m.categories].sort((a, b) => a.sort - b.sort)) {
    const items = productsIn(m, c.id).map((p) => {
      const item: Record<string, unknown> = {
        "@type": "MenuItem",
        name: pn(p, lang),
        description: pd(p, lang),
        offers: {
          "@type": "Offer",
          price: String(p.price),
          priceCurrency: "TRY",
          availability: p.soldout ? "https://schema.org/SoldOut" : "https://schema.org/InStock",
        },
      };
      if (p.image) item.image = url(productImg(p.image));
      const s = p.nutrition.servings[0];
      if (p.nutrition.per100?.kcal && p.nutrition.basis && s) {
        item.nutrition = {
          "@type": "NutritionInformation",
          servingSize: servingLabel(s.label, lang),
          calories: `${Math.round((p.nutrition.per100.kcal * s.amount) / 100)} kcal`,
        };
      }
      return item;
    });
    if (items.length) sections.push({ "@type": "MenuSection", name: cn(c, lang), hasMenuItem: items });
  }
  const en = lang === "en";
  return { "@type": "Menu", name: en ? "Opia Coffee Co. Menu" : "Opia Coffee Co. Menü", inLanguage: en ? "en" : "tr", hasMenuSection: sections };
}
