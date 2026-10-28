/** @jsxImportSource @/site/jsx */
// Sayfa içeriği: Privacy Policy | Opia Coffee Co.
// Metni değiştirmek için bu dosyayı düzenle; başlık ve açıklama aşağıdaki "page" nesnesinde.

import type { StaticPage } from "../static-page";

export const page: StaticPage = {
  "path": "/en/privacy-policy",
  "lang": "en",
  "title": "Privacy Policy | Opia Coffee Co.",
  "description": "Opia Coffee Co. privacy policy: no accounts, no forms and no online payments; we collect no personal data. QR orders only record table and items.",
  "business": false,
  "breadcrumb": [
    [
      "Home",
      "/en"
    ],
    [
      "Privacy Policy",
      "/en/privacy-policy"
    ]
  ],
  "schema": []
};

export default function PrivacyEn() {
  return (
    <>
      <section className="phead">
        <div className="wrap">
          <p className="eyebrow">Legal</p>
          <h1 className="phead__h phead__h--sm">Privacy Policy</h1>
          <p className="lead">Short and clear: we do not collect data that identifies you, we take no payments online and we share no data with anyone.</p>
          <p className="legal__date">Last updated: 28 October 2026</p>
        </div>
      </section>
      <section className="sec sec--tight">
        <div className="wrap narrow prose prose--legal">
          <h2>Scope</h2>
          <p>This policy covers the Opia Coffee Co. website at https://opiacoffee.com.tr and the ordering system used through the QR codes on our tables. Legal details are in our <a href="/en/personal-data-notice">Personal Data Notice</a>.</p>
          <ul>
            <li><strong>Data controller:</strong> Opia Coffee Co.</li>
            <li><strong>Address:</strong> <span lang="tr">Yenibağlar</span> <span lang="tr">Mah.</span> <span lang="tr">Eti Cd.</span> No:41/C, 26170 <span lang="tr">Tepebaşı</span> / <span lang="tr">Eskişehir</span>, Türkiye</li>
            <li><strong>Website:</strong> https://opiacoffee.com.tr</li>
          </ul>
          <h2>What we do not collect</h2>
          <ul>
            <li>We do not ask for your name, phone number, email or address.</li>
            <li>There is no account, login or contact form.</li>
            <li>There is no online payment; card details are never entered on our site. You pay at the café, at the counter or at your table.</li>
            <li>We do not request location, camera or contacts access.</li>
            <li>We do not store IP addresses with order records.</li>
          </ul>
          <h2>What a QR order records</h2>
          <p>Only what is needed to prepare your order: table number, items, options (milk choice, hot or iced and so on), your optional note, the time and the order status. The note is kept with the order record. None of this identifies you; it is used for accounting and sales statistics.</p>
          <h2>Stored in your browser</h2>
          <p>Your basket and order numbers are stored only in your own browser so they survive a page refresh and you can see your order status. You can remove them at any time by clearing your browser data.</p>
          <h2>Third parties</h2>
          <ul>
            <li><strong>Hosting provider:</strong> may keep access logs for technical and legal reasons.</li>
            <li><strong>OpenStreetMap:</strong> the map only loads if you press “Load map”.</li>
            <li><strong>Google Maps / Instagram:</strong> when you follow these links, their own policies apply.</li>
          </ul>
          <p>We do not sell data, use it for advertising or share it with other companies.</p>
          <h2>Security</h2>
          <p>The ordering system only works with the codes on our tables; only authorised staff can sign in to the admin panel with a password. Failed admin sign-in attempts are only counted in server memory for up to 10 minutes to block password guessing; they are never stored permanently.</p>
          <h2>Children</h2>
          <p>Our website does not knowingly collect any information from children.</p>
          <h2>Changes</h2>
          <p>We may update this policy when needed; the current version is always on this page.</p>
        </div>
      </section>
    </>
  );
}
