/** @jsxImportSource @/site/jsx */
// Sayfa içeriği: Contact and Directions | Opia Coffee Co. Eskişehir
// Metni değiştirmek için bu dosyayı düzenle; başlık ve açıklama aşağıdaki "page" nesnesinde.

import type { StaticPage } from "../static-page";
import { Icon } from "../ui";

export const page: StaticPage = {
  "path": "/en/contact",
  "lang": "en",
  "title": "Contact and Directions | Opia Coffee Co. Eskişehir",
  "description": "Opia Coffee Co. address, opening hours and directions: Eti Cd. No:41/C, Yenibağlar, Tepebaşı, Eskişehir, Türkiye. Open every day 09:00 - 00:00.",
  "business": true,
  "breadcrumb": [
    [
      "Home",
      "/en"
    ],
    [
      "Contact",
      "/en/contact"
    ]
  ],
  "schema": [
    {
      "@type": "ContactPage",
      "@id": "https://opiacoffee.com.tr/en/contact#contact",
      "url": "https://opiacoffee.com.tr/en/contact"
    },
    {
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "Where is Opia Coffee Co.?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Opia Coffee Co. is at Eti Caddesi No:41/C in the Yenibağlar neighbourhood of Tepebaşı, Eskişehir, close to Anadolu University’s Yunusemre Campus and the Vecihi Hürkuş Aviation Park (Aviation Museum)."
          }
        },
        {
          "@type": "Question",
          "name": "What are your opening hours?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "We are open every day from 09:00 to 00:00."
          }
        },
        {
          "@type": "Question",
          "name": "Can I order from my table?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Yes. Scan the QR code on your table and the menu opens in order mode. Choose your options, send your order to the bar, call a waiter or ask for the bill. You pay at the counter or at your table."
          }
        },
        {
          "@type": "Question",
          "name": "Do you list allergens?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Yes. Tap any item on the menu to see its allergens and nutrition values per serving."
          }
        },
        {
          "@type": "Question",
          "name": "Do you speak English?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Our menu and QR ordering are available in English. Feel free to ask our staff at the bar too."
          }
        }
      ]
    }
  ]
};

export default function ContactEn() {
  return (
    <>
      <section className="phead">
        <div className="wrap">
          <p className="eyebrow">Opia Coffee Co.</p>
          <h1 className="phead__h">Contact</h1>
          <p className="lead">Address, opening hours and directions. Questions? Message us on Instagram or drop by the café.</p>
        </div>
      </section>
      <section className="sec sec--tight">
        <div className="wrap contact">
          <div className="contact__info">
            <div className="info">
              <h2 className="info__h"><Icon name="pin" /> Address</h2>
              <address><span lang="tr">Yenibağlar</span> <span lang="tr">Mah.</span><br /><span lang="tr">Eti Cd.</span> No:41/C<br /><span lang="tr">Tepebaşı</span> / <span lang="tr">Eskişehir</span> 26170, Türkiye</address>
              <p className="info__btns"><a className="btn" href="https://www.google.com/maps/dir/?api=1&amp;destination=39.78545388329,30.50237731156" target="_blank" rel="noopener">Google Maps</a> <a className="btn btn--line" href="https://yandex.com.tr/harita/?pt=30.50237731156,39.78545388329&z=17&l=map" target="_blank" rel="noopener">Yandex Maps</a> <a className="btn btn--line" href="https://maps.apple.com/?daddr=39.78545388329,30.50237731156&dirflg=d" target="_blank" rel="noopener">Apple Maps</a></p>
            </div>
            <div className="info">
              <h2 className="info__h"><Icon name="clock" /> Opening hours</h2>
              <dl className="hours">
                <div>
                  <dt>Monday - Sunday</dt>
                  <dd>09:00 - 00:00</dd>
                </div>
              </dl>
              <p className="status" data-open-status>Every day 09:00 - 00:00</p>
            </div>
            <div className="info">
              <h2 className="info__h"><Icon name="insta" /> Social</h2>
              <p><a className="ulink" href="https://www.instagram.com/opiacoffeeco/" target="_blank" rel="noopener me">@opiacoffeeco</a></p>
            </div>
          </div>
          <div className="mapbox mapbox--tall" data-map data-lat="39.78545388329" data-lng="30.50237731156">
            <div className="mapbox__ph"><Icon name="pin" /><p>Opia Coffee Co.<br /><small><span lang="tr">Yenibağlar</span>, <span lang="tr">Tepebaşı</span> / <span lang="tr">Eskişehir</span></small></p><button type="button" className="btn btn--line" data-map-load>Load map</button><small className="mapbox__n">The map is loaded from OpenStreetMap.</small></div>
          </div>
        </div>
      </section>
      <section className="sec sec--tight" aria-labelledby="how-h">
        <div className="wrap narrow prose">
          <h2 id="how-h" className="h2">Getting <em>here</em></h2>
          <p>Opia is at No:41/C on Eti Street (<span lang="tr">Eti Caddesi</span>) in <span lang="tr">Yenibağlar</span>, <span lang="tr">Tepebaşı</span>. We are on the same stretch as Anadolu University’s <span lang="tr">Yunusemre</span> Campus and the <span lang="tr">Vecihi Hürkuş</span> Aviation Park, so you can walk over from the campus or the museum.</p>
          <ul>
            <li><strong>From the train station:</strong> <span lang="tr">Eskişehir</span> Train Station is about one kilometre away; a short taxi or city transport ride.</li>
            <li><strong>From Cassaba Modern:</strong> a short ride from <span lang="tr">Hoşnudiye</span> to <span lang="tr">Yenibağlar</span>.</li>
            <li><strong>By car:</strong> the “Get directions” button takes you straight to our location.</li>
          </ul>
        </div>
      </section>
      <section className="sec sec--tight" aria-labelledby="faq-h">
        <div className="wrap narrow">
          <h2 id="faq-h" className="h2">FAQ</h2>
          <div className="faq">
            <details>
              <summary>Where is Opia Coffee Co.?</summary>
              <p>Opia Coffee Co. is at <span lang="tr">Eti Caddesi</span> No:41/C in the <span lang="tr">Yenibağlar</span> neighbourhood of <span lang="tr">Tepebaşı</span>, <span lang="tr">Eskişehir</span>, close to Anadolu University’s <span lang="tr">Yunusemre</span> Campus and the <span lang="tr">Vecihi Hürkuş</span> Aviation Park (Aviation Museum).</p>
            </details>
            <details>
              <summary>What are your opening hours?</summary>
              <p>We are open every day from 09:00 to 00:00.</p>
            </details>
            <details>
              <summary>Can I order from my table?</summary>
              <p>Yes. Scan the QR code on your table and the menu opens in order mode. Choose your options, send your order to the bar, call a waiter or ask for the bill. You pay at the counter or at your table.</p>
            </details>
            <details>
              <summary>Do you list allergens?</summary>
              <p>Yes. Tap any item on the menu to see its allergens and nutrition values per serving.</p>
            </details>
            <details>
              <summary>Do you speak English?</summary>
              <p>Our menu and QR ordering are available in English. Feel free to ask our staff at the bar too.</p>
            </details>
          </div>
        </div>
      </section>
    </>
  );
}
