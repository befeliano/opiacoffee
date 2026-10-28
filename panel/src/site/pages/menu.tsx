/** @jsxImportSource @/site/jsx */
// Menü sayfası (Türkçe ve İngilizce). Ürünler ve fiyatlar adisyondan, besin değerleri içerik dosyasından.

import type { Lang } from "../config";
import { cn, cnote, productsIn, seasonTxt, seasonal, type SiteMenu } from "../menu-data";
import { MenuEmbed, ProductRow } from "../products";
import { Icon, Lw } from "../ui";

const TXT = {
  tr: {
    eyebrow: "Opia Coffee Co. / Yenibağlar",
    h1: "Menü",
    lead: "Kahve, matcha, sıcak çikolata ve tatlılar. Bir ürüne dokun; alerjen ve besin değerlerini, porsiyon seçerek gör.",
    tools: "Menü araçları",
    search: "Menüde ara",
    cats: "Kategoriler",
    filter: "Alerjen filtresi",
    filterHelp: "Seçtiğin alerjenleri içeren ürünleri gizler.",
    clear: "Filtreyi temizle",
    empty: "Aramana uyan ürün bulunamadı. Filtreyi ya da aramayı temizlemeyi dene.",
    noteH: "Alerji ve beslenme notu",
    note: "Mutfağımızda gluten, süt, yumurta, yer fıstığı ve sert kabuklu yemişler birlikte kullanılır; çapraz bulaşma olabilir. Kalori ve besin değerleri tahminî olup tarif ve hazırlanışa göre değişebilir. Hassasiyetin varsa sipariş verirken bize söyle. Fiyatlara KDV dahildir.",
  },
  en: {
    eyebrow: "Opia Coffee Co. / Yenibağlar",
    h1: "Menu",
    lead: "Coffee, matcha, hot chocolate and desserts. Tap an item to see allergens and nutrition for each serving.",
    tools: "Menu tools",
    search: "Search the menu",
    cats: "Categories",
    filter: "Allergen filter",
    filterHelp: "Hides items that contain the allergens you select.",
    clear: "Clear filter",
    empty: "No items match your search. Try clearing the filter or the search.",
    noteH: "Allergy and nutrition note",
    note: "Gluten, milk, egg, peanuts and tree nuts are all used in our kitchen, so cross-contamination is possible. Calories and nutrition values are estimates and may vary with the recipe and preparation. Please tell us about any allergy when you order. Prices are in Turkish lira and include VAT.",
  },
};

export default function MenuPage({ lang, menu }: { lang: Lang; menu: SiteMenu }) {
  const x = TXT[lang];
  const L = (s: string) => <Lw lang={lang}>{s}</Lw>;
  const season = seasonal(menu);
  const cats = [...menu.categories].sort((a, b) => a.sort - b.sort);
  const regular = (id: string) => productsIn(menu, id).filter((p) => !p.seasonal);
  const allergens = menu.allergens.filter((al) => menu.products.some((p) => p.allergens.includes(al.id)));

  return (
    <>
      <section className="phead">
        <div className="wrap">
          <p className="eyebrow">{L(x.eyebrow)}</p>
          <h1 className="phead__h">{x.h1}</h1>
          <p className="lead">{x.lead}</p>
        </div>
      </section>

      <section className="mtools" aria-label={x.tools}>
        <div className="wrap mtools__in">
          <label className="search">
            <span className="sr">{x.search}</span>
            <Icon name="search" />
            <input type="search" id="menu-search" placeholder={x.search} autoComplete="off" enterKeyHint="search" />
          </label>
          <nav className="cats" aria-label={x.cats}>
            {season.length > 0 && <a href="#mevsim" data-cat="mevsim">{L(seasonTxt(menu, "title", lang))}</a>}
            {cats.filter((c) => regular(c.id).length).map((c) => (
              <a key={c.id} href={`#${c.id}`} data-cat={c.id}>{L(cn(c, lang))}</a>
            ))}
          </nav>
          <details className="afilter">
            <summary>{x.filter} <span className="afilter__n" data-afilter-n hidden></span></summary>
            <div className="afilter__panel">
              <p className="afilter__help">{x.filterHelp}</p>
              <ul className="afilter__list">
                {allergens.map((al) => (
                  <li key={al.id}><label><input type="checkbox" value={al.id} /><span>{lang === "en" ? al.name_en : al.name}</span></label></li>
                ))}
              </ul>
              <button type="button" className="linkbtn" data-afilter-clear>{x.clear}</button>
            </div>
          </details>
        </div>
      </section>

      <div className="wrap menu" id="menu-root">
        {season.length > 0 && (
          <section className="msec msec--season" id="mevsim" data-section aria-labelledby="h-mevsim">
            <header className="msec__head">
              <h2 id="h-mevsim">{L(seasonTxt(menu, "title", lang))}</h2>
              <p>{L(`${seasonTxt(menu, "label", lang)}: ${seasonTxt(menu, "subtitle", lang)}`)}</p>
            </header>
            <ul className="rows">{season.map((p) => <ProductRow key={p.id} p={p} lang={lang} />)}</ul>
          </section>
        )}

        {cats.map((c) => {
          const items = regular(c.id);
          if (!items.length) return null;
          const note = cnote(c, lang);
          return (
            <section key={c.id} className="msec" id={c.id} data-section aria-labelledby={`h-${c.id}`}>
              <header className="msec__head">
                <h2 id={`h-${c.id}`}>{L(cn(c, lang))}</h2>
                {note && <p>{L(note)}</p>}
              </header>
              <ul className="rows">{items.map((p) => <ProductRow key={p.id} p={p} lang={lang} />)}</ul>
            </section>
          );
        })}

        <p className="menu__empty" id="menu-empty" hidden>{x.empty}</p>

        <aside className="menu__note">
          <h2>{x.noteH}</h2>
          <p>{x.note}</p>
        </aside>
      </div>
      <MenuEmbed products={menu.products} menu={menu} lang={lang} />
    </>
  );
}
