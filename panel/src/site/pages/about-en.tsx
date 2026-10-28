/** @jsxImportSource @/site/jsx */
// Sayfa içeriği: About | Opia Coffee Co. Eskişehir
// Metni değiştirmek için bu dosyayı düzenle; başlık ve açıklama aşağıdaki "page" nesnesinde.

import type { StaticPage } from "../static-page";
import { Icon } from "../ui";

export const page: StaticPage = {
  "path": "/en/about",
  "lang": "en",
  "title": "About | Opia Coffee Co. Eskişehir",
  "description": "Opia Coffee Co. is a specialty coffee shop in Yenibağlar, Tepebaşı, Eskişehir, open since 2019: espresso drinks, filter coffee, a matcha bar and daily desserts.",
  "business": false,
  "breadcrumb": [
    [
      "Home",
      "/en"
    ],
    [
      "About",
      "/en/about"
    ]
  ],
  "schema": [
    {
      "@type": "AboutPage",
      "@id": "https://opiacoffee.com.tr/en/about#about",
      "url": "https://opiacoffee.com.tr/en/about",
      "about": {
        "@id": "https://opiacoffee.com.tr#cafe"
      }
    }
  ]
};

export default function AboutEn() {
  return (
    <>
      <section className="phead">
        <div className="wrap">
          <p className="eyebrow">Opia Coffee Co.</p>
          <h1 className="phead__h">About</h1>
          <p className="lead">A coffee shop in <span lang="tr">Yenibağlar</span>. Short, simple and honest: good beans, careful brewing and a warm table.</p>
        </div>
      </section>
      <section className="sec sec--tight">
        <div className="wrap split">
          <figure className="split__fig"><img src="/assets/img/placeholders/hakkimizda-1.svg" alt="Inside Opia Coffee Co. in Yenibağlar, Eskişehir" width="1000" height="1250" loading="lazy" decoding="async" /></figure>
          <div className="prose">
            <h2 className="h2">A cup, <em>a pause.</em></h2>
            <p>Opia Coffee Co. has been on Eti Street in the <span lang="tr">Yenibağlar</span> neighbourhood of <span lang="tr">Tepebaşı</span>, <span lang="tr">Eskişehir</span> since 2019. Our motto is “Awaken the senses”, and the idea is simple: a cup you can drink at your own pace, away from the rush of the city.</p>
            <p>Next to the espresso classics our bar serves filter coffee, Red Eye and Black Eye, Turkish coffee and a dedicated Matcha Bar. Whether you love coffee or are just getting to know it, you should find something for yourself.</p>
            <p>Our counter has different desserts every day: cheesecake, tiramisu, brownie, tarts and more. Part of the menu changes with the seasons; in winter we serve Golden Latte, Cafe Miel, Chai Tea Latte and salep.</p>
          </div>
        </div>
      </section>
      <section className="sec sec--ink">
        <div className="wrap">
          <p className="label label--inv">How we see coffee</p>
          <ol className="values">
            <li><span className="values__n">01</span><h3>Specialty beans</h3><p>We work with carefully selected, freshly roasted beans. Ask about the filter coffee of the day and we will tell you its story.</p></li>
            <li><span className="values__n">02</span><h3>Careful brewing</h3><p>Water, grind, time and temperature are measured for every cup. We aim for a consistent cup, not a show.</p></li>
            <li><span className="values__n">03</span><h3>Transparency</h3><p>Every item on our menu lists its allergens and nutrition values. You have the right to know what you drink.</p></li>
            <li><span className="values__n">04</span><h3>No rush</h3><p>Open every day from 09:00 until midnight. For a coffee between classes, after a walk or late in the evening.</p></li>
          </ol>
        </div>
      </section>
      <section className="sec">
        <div className="wrap split split--rev">
          <figure className="split__fig split__fig--wide"><img src="/assets/img/placeholders/hakkimizda-2.svg" alt="Making coffee at the Opia Coffee Co. bar" width="1200" height="900" loading="lazy" decoding="async" /></figure>
          <div className="prose">
            <h2 className="h2">Where are we? <em><span lang="tr">Yenibağlar</span>.</em></h2>
            <p>We are right next to Anadolu University’s <span lang="tr">Yunusemre</span> Campus and the <span lang="tr">Vecihi Hürkuş</span> Aviation Park (the Aviation Museum). The city centre, <span lang="tr">Eskişehir</span> Train Station and Cassaba Modern are a short ride away.</p>
            <p><strong>Address:</strong> <span lang="tr">Yenibağlar</span> <span lang="tr">Mah.</span> <span lang="tr">Eti Cd.</span> No:41/C, <span lang="tr">Tepebaşı</span> / <span lang="tr">Eskişehir</span><br /><strong>Hours:</strong> Every day 09:00 - 00:00</p>
            <div className="visit__cta"><a className="btn" href="/en/menu">See the menu <Icon name="arrow" /></a> <a className="btn btn--line" href="/en/contact">Contact</a></div>
          </div>
        </div>
      </section>
    </>
  );
}
