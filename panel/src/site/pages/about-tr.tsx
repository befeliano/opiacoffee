/** @jsxImportSource @/site/jsx */
// Sayfa içeriği: Hakkımızda | Opia Coffee Co. Yenibağlar Eskişehir
// Metni değiştirmek için bu dosyayı düzenle; başlık ve açıklama aşağıdaki "page" nesnesinde.

import type { StaticPage } from "../static-page";
import { Icon } from "../ui";

export const page: StaticPage = {
  "path": "/hakkimizda",
  "lang": "tr",
  "title": "Hakkımızda | Opia Coffee Co. Yenibağlar Eskişehir",
  "description": "Opia Coffee Co., Eskişehir Tepebaşı Yenibağlar’da nitelikli kahve, filtre demleme ve günlük tatlılar sunan bir kahve dükkânı. Hikâyemiz ve kahveye bakışımız.",
  "business": false,
  "breadcrumb": [
    [
      "Ana Sayfa",
      "/"
    ],
    [
      "Hakkımızda",
      "/hakkimizda"
    ]
  ],
  "schema": [
    {
      "@type": "AboutPage",
      "@id": "https://opiacoffee.com.tr/hakkimizda#about",
      "url": "https://opiacoffee.com.tr/hakkimizda",
      "about": {
        "@id": "https://opiacoffee.com.tr#cafe"
      }
    }
  ]
};

export default function AboutTr() {
  return (
    <>
      <section className="phead">
        <div className="wrap">
          <p className="eyebrow"><span lang="en">Opia</span> Coffee Co.</p>
          <h1 className="phead__h">Hakkımızda</h1>
          <p className="lead">Yenibağlar’da bir kahve dükkânı. Kısa, sade ve dürüst: iyi çekirdek, doğru demleme, sıcak bir masa.</p>
        </div>
      </section>
      <section className="sec sec--tight">
        <div className="wrap split">
          <figure className="split__fig"><img src="/assets/img/placeholders/hakkimizda-1.svg" alt="Opia Coffee Co. Yenibağlar Eskişehir iç mekân" width="1000" height="1250" loading="lazy" decoding="async" /></figure>
          <div className="prose">
            <h2 className="h2">Bir kahve, <em>bir mola.</em></h2>
            <p><span lang="en">Opia</span> Coffee Co., 2019’dan beri Eskişehir’in Tepebaşı ilçesinde, Yenibağlar Mahallesi’nde Eti Caddesi üzerinde yer alan bir kahve dükkânı. Marka sloganımız “<span lang="en">Awaken the senses</span>”. Fikrimiz basit: şehrin hızında kaybolmadan, kendi hızında içilen bir fincan sunmak.</p>
            <p>Barımızda espresso bazlı klasiklerin yanında filtre kahve, <span lang="en">Red Eye</span> ve <span lang="en">Black Eye</span>, Türk Kahvesi ve ayrı bir <span lang="en">Matcha Bar</span> var. Kahveyi seven de, kahveyle arası yeni düzelen de kendine bir şey bulabilsin istiyoruz.</p>
            <p>Vitrinimizde her gün farklı tatlılar olur: cheesecake, tiramisu, brownie, tart ve daha fazlası. Mevsim değiştikçe menünün bir bölümü de değişir; kışın Golden Latte, Cafe <span lang="en">Miel</span>, <span lang="en">Chai</span> Tea Latte ve salep gelir.</p>
          </div>
        </div>
      </section>
      <section className="sec sec--ink">
        <div className="wrap">
          <p className="label label--inv">Kahveye bakışımız</p>
          <ol className="values">
            <li><span className="values__n">01</span><h3>Nitelikli çekirdek</h3><p>Özenle seçilmiş, taze kavrulmuş çekirdeklerle çalışırız. Günün filtre çekirdeği hakkında sorarsan hikâyesini anlatırız.</p></li>
            <li><span className="values__n">02</span><h3>Doğru demleme</h3><p>Su, öğütme, süre, sıcaklık. Her fincan ölçülür ve tadılır. Amacımız gösterişli değil, tutarlı bir fincan.</p></li>
            <li><span className="values__n">03</span><h3>Şeffaflık</h3><p>Menümüzdeki her üründe alerjen ve besin değerlerini açıkça paylaşırız. Ne içtiğini bilmek hakkındır.</p></li>
            <li><span className="values__n">04</span><h3>Acelesiz masa</h3><p>Her gün sabah 09:00’dan gece yarısına kadar açığız. Ders arasında, yürüyüş sonrası ya da gece geç bir kahve için.</p></li>
          </ol>
        </div>
      </section>
      <section className="sec">
        <div className="wrap split split--rev">
          <figure className="split__fig split__fig--wide"><img src="/assets/img/placeholders/hakkimizda-2.svg" alt="Opia Coffee Co. barda kahve hazırlığı" width="1200" height="900" loading="lazy" decoding="async" /></figure>
          <div className="prose">
            <h2 className="h2">Neredeyiz? <em>Yenibağlar.</em></h2>
            <p>Anadolu Üniversitesi Yunusemre Kampüsü’nün ve Vecihi Hürkuş Havacılık Parkı’nın (Hava Müzesi) bulunduğu hattın hemen yanındayız. Şehir merkezine, Eskişehir Garı’na ve Cassaba Modern’e kısa bir yolculukla ulaşabilirsin.</p>
            <p><strong>Adres:</strong> Yenibağlar Mah. Eti Cd. No:41/C, Tepebaşı / Eskişehir<br /><strong>Saatler:</strong> Her gün 09:00 - 00:00</p>
            <div className="visit__cta"><a className="btn" href="/menu">Menüye bak <Icon name="arrow" /></a> <a className="btn btn--line" href="/iletisim">İletişim</a></div>
          </div>
        </div>
      </section>
    </>
  );
}
