/** @jsxImportSource @/site/jsx */
// Mağaza: kahve çekirdekleri. Satış henüz kapalı (ödeme altyapısı bağlanınca açılacak); ürünler panelden yönetilir.

import { money, type Lang } from "../config";
import type { ShopItem } from "../site-data";
import { Icon, Lw } from "../ui";

const TXT = {
  tr: {
    eyebrow: "Opia Coffee Co. / Mağaza",
    h1: "Çekirdekler",
    soon: "Yakında satışta",
    soonNote: "Online satış yakında açılıyor. O zamana kadar çekirdeklerimizi barda sorabilir, fincanda deneyebilirsin.",
    notes: "Tadım notları",
    empty: "Şu an listelenen ürün yok.",
  },
  en: {
    eyebrow: "Opia Coffee Co. / Shop",
    h1: "Coffee beans",
    soon: "Coming soon",
    soonNote: "Online orders open soon. Until then, ask about our beans at the bar or try them in a cup.",
    notes: "Tasting notes",
    empty: "No products listed right now.",
  },
};

export default function ShopPage({ lang, items, intro }: { lang: Lang; items: ShopItem[]; intro: string }) {
  const x = TXT[lang];
  const en = lang === "en";
  const L = (s: string) => <Lw lang={lang}>{s}</Lw>;
  return (
    <>
      <section className="phead">
        <div className="wrap">
          <p className="eyebrow">{L(x.eyebrow)}</p>
          <h1 className="phead__h phead__h--sm">{x.h1}</h1>
          {intro && <p className="lead">{intro}</p>}
        </div>
      </section>

      <section className="sec shop">
        <div className="wrap">
          {items.length === 0 ? (
            <p className="lead">{x.empty}</p>
          ) : (
            <ul className="shop__grid">
              {items.map((i) => {
                const name = (en && i.name_en) || i.name;
                const notes = (en && i.notes_en) || i.notes;
                const desc = (en && i.description_en) || i.description;
                return (
                  <li key={i.id} className="shop__card">
                    <div className="shop__img">
                      {i.image ? (
                        <img src={i.image} alt={`${name}, Opia Coffee Co.`} loading="lazy" decoding="async" />
                      ) : (
                        <span className="noimg" aria-hidden="true"><Icon name="cup" /></span>
                      )}
                    </div>
                    <div className="shop__body">
                      {i.origin && <p className="shop__origin">{i.origin}</p>}
                      {/* Türkçe sayfada yabancı adlar (İngilizcesi aynı olan) büyük harfte İ olmasın */}
                      <h2 className="shop__name" lang={en || i.name_en === i.name ? "en" : "tr"}>{name}</h2>
                      {notes && (
                        <p className="shop__notes">
                          <span className="sr">{x.notes}: </span>
                          {notes}
                        </p>
                      )}
                      {desc && <p className="shop__desc">{desc}</p>}
                      <div className="shop__foot">
                        <span className="shop__meta">
                          {i.weight}
                          {i.weight && i.price !== null && " · "}
                          {i.price !== null && money(i.price)}
                        </span>
                        <button type="button" className="btn shop__soon" disabled>{x.soon}</button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="shop__note">{x.soonNote}</p>
        </div>
      </section>
    </>
  );
}
