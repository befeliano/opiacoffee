/** @jsxImportSource @/site/jsx */
// Sayfa içeriği: Terms of Use | Opia Coffee Co.
// Metni değiştirmek için bu dosyayı düzenle; başlık ve açıklama aşağıdaki "page" nesnesinde.

import type { StaticPage } from "../static-page";

export const page: StaticPage = {
  "path": "/en/terms",
  "lang": "en",
  "title": "Terms of Use | Opia Coffee Co.",
  "description": "Terms of use for the Opia Coffee Co. website and QR table ordering: menu and price information, ordering and payment, intellectual property and governing law.",
  "business": false,
  "breadcrumb": [
    [
      "Home",
      "/en"
    ],
    [
      "Terms of Use",
      "/en/terms"
    ]
  ],
  "schema": []
};

export default function TermsEn() {
  return (
    <>
      <section className="phead">
        <div className="wrap">
          <p className="eyebrow">Legal</p>
          <h1 className="phead__h phead__h--sm">Terms of Use</h1>
          <p className="lead">By using this website and QR table ordering, you accept the terms below.</p>
          <p className="legal__date">Last updated: 23 October 2026</p>
        </div>
      </section>
      <section className="sec sec--tight">
        <div className="wrap narrow prose prose--legal">
          <h2>1. General</h2>
          <p>This website is operated by Opia Coffee Co.. We may update these terms when needed; the current version is on this page. The Turkish version prevails in case of any difference.</p>
          <h2>2. Menu, prices and nutrition</h2>
          <p>Menu, prices, opening hours, calories, nutrition values and allergens are for information and may change without notice. Nutrition values are estimates. Gluten, milk, egg, peanuts and tree nuts are all used in our kitchen, so cross-contamination is possible; if you have an allergy, please ask our staff before ordering. Prices are in Turkish lira and include VAT.</p>
          <h2>3. QR table ordering</h2>
          <ul>
            <li>QR ordering is for ordering from the table you are sitting at in the café; please do not use it from elsewhere or on behalf of others.</li>
            <li>No payment is taken on the site. You pay at the café, at the counter or at your table.</li>
            <li>Orders are prepared once the bar accepts them. If an item is sold out or cannot be prepared, our staff will let you know and the order may be cancelled.</li>
            <li>If misuse (fake or repeated orders) is noticed, QR ordering for that table may be switched off.</li>
          </ul>
          <h2>4. Intellectual property</h2>
          <p>The logo, brand, texts, photos and design on this site belong to Opia Coffee Co. and may not be copied or used commercially without permission.</p>
          <h2>5. External links</h2>
          <p>We are not responsible for the content or policies of external sites such as Instagram, Google Maps or OpenStreetMap.</p>
          <h2>6. Liability</h2>
          <p>The site is provided “as is”; we do not guarantee uninterrupted operation. If the QR system does not work, you can always order from our staff.</p>
          <h2>7. Personal data</h2>
          <p>We collect no personal data. Details: <a href="/en/personal-data-notice">Personal Data Notice</a>, <a href="/en/privacy-policy">Privacy Policy</a>, <a href="/en/cookie-policy">Cookie Policy</a>.</p>
          <h2>8. Governing law</h2>
          <p>Turkish law applies; the courts and enforcement offices of <span lang="tr">Eskişehir</span> have jurisdiction. Your rights under Turkish Consumer Protection Law No. 6502 are reserved.</p>
        </div>
      </section>
    </>
  );
}
