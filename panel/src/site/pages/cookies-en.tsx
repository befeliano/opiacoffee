/** @jsxImportSource @/site/jsx */
// Sayfa içeriği: Cookie Policy | Opia Coffee Co.
// Metni değiştirmek için bu dosyayı düzenle; başlık ve açıklama aşağıdaki "page" nesnesinde.

import type { StaticPage } from "../static-page";

export const page: StaticPage = {
  "path": "/en/cookie-policy",
  "lang": "en",
  "title": "Cookie Policy | Opia Coffee Co.",
  "description": "Opia Coffee Co. cookie policy: we only use the cookies and browser storage the site needs to work. No advertising or tracking cookies.",
  "business": false,
  "breadcrumb": [
    [
      "Home",
      "/en"
    ],
    [
      "Cookie Policy",
      "/en/cookie-policy"
    ]
  ],
  "schema": []
};

export default function CookiesEn() {
  return (
    <>
      <section className="phead">
        <div className="wrap">
          <p className="eyebrow">Legal</p>
          <h1 className="phead__h phead__h--sm">Cookie Policy</h1>
          <p className="lead">We only use the cookies and browser storage this site needs to work. There are no advertising or tracking cookies.</p>
          <p className="legal__date">Last updated: 23 October 2026</p>
        </div>
      </section>
      <section className="sec sec--tight">
        <div className="wrap narrow prose prose--legal">
          <h2>What is a cookie?</h2>
          <p>Cookies are small text files saved on your device when you visit a website. Browser storage (localStorage, sessionStorage) can be used for the same purpose; this policy covers all of them.</p>
          <h2>What we use</h2>
          <div className="tablewrap">
            <table className="ctable">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Purpose</th>
                  <th>Duration</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><code>opia_consent</code></td>
                  <td>Essential (cookie and local storage)</td>
                  <td>Remembers your cookie choice.</td>
                  <td>12 months</td>
                </tr>
                <tr>
                  <td><code>opia_table</code>, <code>opia_cart_*</code></td>
                  <td>Essential (session storage)</td>
                  <td>Your table code and basket for QR ordering. Deleted when you close the tab.</td>
                  <td>Session</td>
                </tr>
                <tr>
                  <td><code>opia_orders_*</code></td>
                  <td>Essential (local storage)</td>
                  <td>The numbers of your orders, to show their status.</td>
                  <td>12 hours</td>
                </tr>
                <tr>
                  <td><code>PHPSESSID</code></td>
                  <td>Essential</td>
                  <td>Staff admin panel session only. Not set for visitors.</td>
                  <td>Session</td>
                </tr>
                <tr>
                  <td>OpenStreetMap</td>
                  <td>Third party</td>
                  <td>The map only loads if you press “Load map”.</td>
                  <td>Set by the provider</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p>We currently use no statistics, advertising or tracking cookies. If we add any in the future, they will only run with your explicit consent.</p>
          <h2>Consent</h2>
          <p>Essential cookies and storage are needed for the site and QR ordering to work. Statistics and third-party content only run with your consent; declining does not affect your use of the site.</p>
          <h2>Manage your choice</h2>
          <ul>
            <li>Use the <button type="button" className="linkbtn" data-consent-open>Cookie Settings</button> link at the bottom of any page to change your choice.</li>
            <li>You can delete or block cookies and site data in your browser settings.</li>
          </ul>
          <h2>More information</h2>
          <p><a href="/en/personal-data-notice">Personal Data Notice</a> and <a href="/en/privacy-policy">Privacy Policy</a>.</p>
        </div>
      </section>
    </>
  );
}
