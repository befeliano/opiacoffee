/** @jsxImportSource @/site/jsx */
// Sayfa içeriği: Personal Data Notice (KVKK) | Opia Coffee Co.
// Metni değiştirmek için bu dosyayı düzenle; başlık ve açıklama aşağıdaki "page" nesnesinde.

import type { StaticPage } from "../static-page";

export const page: StaticPage = {
  "path": "/en/personal-data-notice",
  "lang": "en",
  "title": "Personal Data Notice (KVKK) | Opia Coffee Co.",
  "description": "Opia Coffee Co. notice under Turkish data protection law (KVKK) for the website and QR table ordering: no personal data collected, no online payments.",
  "business": false,
  "breadcrumb": [
    [
      "Home",
      "/en"
    ],
    [
      "Personal Data Notice",
      "/en/personal-data-notice"
    ]
  ],
  "schema": []
};

export default function KvkkEn() {
  return (
    <>
      <section className="phead">
        <div className="wrap">
          <p className="eyebrow">Legal</p>
          <h1 className="phead__h phead__h--sm">Personal Data Notice</h1>
          <p className="lead">Under Article 10 of the Turkish Personal Data Protection Law No. 6698 (KVKK), we explain what is processed on our website and in QR table ordering. In short: we do not collect any personal data that identifies you.</p>
          <p className="legal__date">Last updated: 28 October 2026</p>
        </div>
      </section>
      <section className="sec sec--tight">
        <div className="wrap narrow prose prose--legal">
          <h2>1. Data controller</h2>
          <ul>
            <li><strong>Data controller:</strong> Opia Coffee Co.</li>
            <li><strong>Address:</strong> <span lang="tr">Yenibağlar</span> <span lang="tr">Mah.</span> <span lang="tr">Eti Cd.</span> No:41/C, 26170 <span lang="tr">Tepebaşı</span> / <span lang="tr">Eskişehir</span>, Türkiye</li>
            <li><strong>Website:</strong> https://opiacoffee.com.tr</li>
          </ul>
          <h2>2. No personal data collected</h2>
          <p>There is no account, contact form, newsletter, online payment or location request on our website. We do not ask for your name, phone number, email or card details, and we do not store IP addresses with orders or visits. QR table orders are placed as a guest, without identification.</p>
          <h2>3. What QR table ordering records</h2>
          <p>To pass your order to the bar we record: the table number, the items and options you chose, an optional order note, and the time and status of the order. This does not identify you. Your order note is kept with the order record (the bill); items, quantities, amounts and times are kept for accounting and sales statistics. Please do not write personal details such as your name or phone number in the note.</p>
          <h2>4. Stored in your browser</h2>
          <p>Your basket, your table code and the numbers of your orders are kept only in your own browser (local storage) so we can show your order status; they are not sent to us as personal data and are not used after 12 hours. Your cookie choice is also stored in your browser. Details: <a href="/en/cookie-policy">Cookie Policy</a>.</p>
          <h2>5. Hosting logs</h2>
          <p>Our hosting provider may keep access logs (IP address, date and time, requested page) for technical reasons and as required by Turkish Law No. 5651. We do not use these logs for marketing or profiling; they may only be shared with authorities where security or the law requires.</p>
          <h2>6. Statistics and third parties</h2>
          <p>We currently use no statistics, advertising or tracking tools. If we add one in the future, it will only run with your explicit consent and this notice will be updated.</p>
          <p>If you press “Load map”, the map is loaded from OpenStreetMap servers; nothing external is requested before that. Fonts are served from our own server.</p>
          <h2>7. Legal basis</h2>
          <p>Order details are processed to provide the service you request (KVKK Art. 5/2-c) and under legitimate interest (Art. 5/2-f). Hosting logs fall under legal obligation (Art. 5/2-ç). Statistics cookies are only used with your explicit consent (Art. 5/1).</p>
          <h2>8. Your rights</h2>
          <p>Under Article 11 of the KVKK you have the right to learn whether your personal data is processed, request information, correction or deletion, learn who it is shared with, object and claim compensation. Since we keep no data that identifies you, in most cases there will be no record to share, but we are happy to answer your questions.</p>
          <h2>9. How to apply</h2>
          <p>You can send your request in writing to the address above. Requests are answered free of charge within thirty days. You also have the right to complain to the Turkish Personal Data Protection Authority.</p>
        </div>
      </section>
    </>
  );
}
