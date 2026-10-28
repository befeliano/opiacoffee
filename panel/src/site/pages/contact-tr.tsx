/** @jsxImportSource @/site/jsx */
// Sayfa içeriği: İletişim ve Adres | Opia Coffee Co. Yenibağlar Eskişehir
// Metni değiştirmek için bu dosyayı düzenle; başlık ve açıklama aşağıdaki "page" nesnesinde.

import type { StaticPage } from "../static-page";
import { Icon } from "../ui";

export const page: StaticPage = {
  "path": "/iletisim",
  "lang": "tr",
  "title": "İletişim ve Adres | Opia Coffee Co. Yenibağlar Eskişehir",
  "description": "Opia Coffee Co. adres, çalışma saatleri ve yol tarifi: Yenibağlar Mah. Eti Cd. No:41/C, Tepebaşı / Eskişehir. Her gün 09:00 - 00:00. QR ile masadan sipariş.",
  "business": true,
  "breadcrumb": [
    [
      "Ana Sayfa",
      "/"
    ],
    [
      "İletişim",
      "/iletisim"
    ]
  ],
  "schema": [
    {
      "@type": "ContactPage",
      "@id": "https://opiacoffee.com.tr/iletisim#contact",
      "url": "https://opiacoffee.com.tr/iletisim"
    },
    {
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "Opia Coffee Co. nerede?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Opia Coffee Co., Eskişehir Tepebaşı ilçesi Yenibağlar Mahallesi’nde, Eti Caddesi No:41/C adresindedir. Anadolu Üniversitesi Yunusemre Kampüsü ve Vecihi Hürkuş Havacılık Parkı’na (Hava Müzesi) yakındır."
          }
        },
        {
          "@type": "Question",
          "name": "Çalışma saatleri nedir?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Her gün 09:00 - 00:00 arasında açığız."
          }
        },
        {
          "@type": "Question",
          "name": "Grup ya da etkinlik için yer ayırtabilir miyim?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Grup ve etkinlik talepleri için Instagram’dan (@opiacoffeeco) bize yazabilir ya da kafeye uğrayabilirsin."
          }
        },
        {
          "@type": "Question",
          "name": "Masadan QR ile sipariş verebilir miyim?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Evet. Masandaki QR kodu okuttuğunda menü sipariş modunda açılır; ürün seçeneklerini seçip siparişini bara gönderebilir, garson çağırabilir ya da hesap isteyebilirsin. Ödeme kasada ya da masada yapılır."
          }
        },
        {
          "@type": "Question",
          "name": "Menüde alerjen bilgisi var mı?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Evet. Menü sayfasında her ürüne dokunarak alerjenleri ve porsiyona göre besin değerlerini görebilirsin."
          }
        }
      ]
    }
  ]
};

export default function ContactTr() {
  return (
    <>
      <section className="phead">
        <div className="wrap">
          <p className="eyebrow"><span lang="en">Opia</span> Coffee Co.</p>
          <h1 className="phead__h">İletişim</h1>
          <p className="lead">Adres, saatler, yol tarifi. Bir şey sormak istersen <span lang="en">Instagram</span>’dan yaz ya da kafeye uğra.</p>
        </div>
      </section>
      <section className="sec sec--tight">
        <div className="wrap contact">
          <div className="contact__info">
            <div className="info">
              <h2 className="info__h"><Icon name="pin" /> Adres</h2>
              <address>Yenibağlar Mah.<br />Eti Cd. No:41/C<br />Tepebaşı / Eskişehir 26170</address>
              <p className="info__btns"><a className="btn" href="https://www.google.com/maps/dir/?api=1&amp;destination=39.78545388329,30.50237731156" target="_blank" rel="noopener">Google Haritalar</a> <a className="btn btn--line" href="https://yandex.com.tr/harita/?pt=30.50237731156,39.78545388329&z=17&l=map" target="_blank" rel="noopener">Yandex Haritalar</a> <a className="btn btn--line" href="https://maps.apple.com/?daddr=39.78545388329,30.50237731156&dirflg=d" target="_blank" rel="noopener">Apple Haritalar</a></p>
            </div>
            <div className="info">
              <h2 className="info__h"><Icon name="clock" /> Çalışma saatleri</h2>
              <dl className="hours">
                <div>
                  <dt>Pazartesi - Pazar</dt>
                  <dd>09:00 - 00:00</dd>
                </div>
              </dl>
              <p className="status" data-open-status>Her gün 09:00 - 00:00</p>
            </div>
            <div className="info">
              <h2 className="info__h"><Icon name="insta" /> Sosyal medya</h2>
              <p><a className="ulink" href="https://www.instagram.com/opiacoffeeco/" target="_blank" rel="noopener me">@<span lang="en">opiacoffeeco</span></a></p>
            </div>
          </div>
          <div className="mapbox mapbox--tall" data-map data-lat="39.78545388329" data-lng="30.50237731156">
            <div className="mapbox__ph"><Icon name="pin" /><p><span lang="en">Opia</span> Coffee Co.<br /><small>Yenibağlar, Tepebaşı / Eskişehir</small></p><button type="button" className="btn btn--line" data-map-load>Haritayı yükle</button><small className="mapbox__n">Harita OpenStreetMap’ten yüklenir.</small></div>
          </div>
        </div>
      </section>
      <section className="sec sec--tight" aria-labelledby="gel-h">
        <div className="wrap narrow prose">
          <h2 id="gel-h" className="h2">Nasıl <em>gelirsin?</em></h2>
          <p><span lang="en">Opia</span>, Tepebaşı ilçesi Yenibağlar Mahallesi’nde Eti Caddesi üzerinde, No:41/C’dedir. Anadolu Üniversitesi Yunusemre Kampüsü ile Vecihi Hürkuş Havacılık Parkı’nın (Hava Müzesi) bulunduğu hatta olduğumuz için kampüs ve müze tarafından yürüyerek ya da kısa bir yolculukla gelebilirsin.</p>
          <ul>
            <li><strong>Tren Garı’ndan:</strong> Eskişehir Garı yaklaşık bir kilometre uzaklıkta; taksi ya da şehir içi ulaşımla kısa sürede ulaşılır.</li>
            <li><strong>Cassaba Modern’den:</strong> Hoşnudiye tarafından Yenibağlar’a kısa bir yolculuk yeterli.</li>
            <li><strong>Araçla:</strong> Haritadaki “Yol tarifi al” düğmesi seni doğrudan konumumuza yönlendirir.</li>
          </ul>
        </div>
      </section>
      <section className="sec sec--tight" aria-labelledby="sss-h">
        <div className="wrap narrow">
          <h2 id="sss-h" className="h2">Sık sorulanlar</h2>
          <div className="faq">
            <details>
              <summary><span lang="en">Opia</span> Coffee Co. nerede?</summary>
              <p><span lang="en">Opia</span> Coffee Co., Eskişehir Tepebaşı ilçesi Yenibağlar Mahallesi’nde, Eti Caddesi No:41/C adresindedir. Anadolu Üniversitesi Yunusemre Kampüsü ve Vecihi Hürkuş Havacılık Parkı’na (Hava Müzesi) yakındır.</p>
            </details>
            <details>
              <summary>Çalışma saatleri nedir?</summary>
              <p>Her gün 09:00 - 00:00 arasında açığız.</p>
            </details>
            <details>
              <summary>Grup ya da etkinlik için yer ayırtabilir miyim?</summary>
              <p>Grup ve etkinlik talepleri için <span lang="en">Instagram</span>’dan (@<span lang="en">opiacoffeeco</span>) bize yazabilir ya da kafeye uğrayabilirsin.</p>
            </details>
            <details>
              <summary>Masadan QR ile sipariş verebilir miyim?</summary>
              <p>Evet. Masandaki QR kodu okuttuğunda menü sipariş modunda açılır; ürün seçeneklerini seçip siparişini bara gönderebilir, garson çağırabilir ya da hesap isteyebilirsin. Ödeme kasada ya da masada yapılır.</p>
            </details>
            <details>
              <summary>Menüde alerjen bilgisi var mı?</summary>
              <p>Evet. Menü sayfasında her ürüne dokunarak alerjenleri ve porsiyona göre besin değerlerini görebilirsin.</p>
            </details>
          </div>
        </div>
      </section>
    </>
  );
}
