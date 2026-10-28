/** @jsxImportSource @/site/jsx */
// Sayfa içeriği: Çerez Politikası | Opia Coffee Co.
// Metni değiştirmek için bu dosyayı düzenle; başlık ve açıklama aşağıdaki "page" nesnesinde.

import type { StaticPage } from "../static-page";

export const page: StaticPage = {
  "path": "/cerez-politikasi",
  "lang": "tr",
  "title": "Çerez Politikası | Opia Coffee Co.",
  "description": "Opia Coffee Co. çerez politikası: yalnızca sitenin çalışması için gereken çerez ve tarayıcı depolaması kullanılır; reklam ya da izleme çerezi yok.",
  "business": false,
  "breadcrumb": [
    [
      "Ana Sayfa",
      "/"
    ],
    [
      "Çerez Politikası",
      "/cerez-politikasi"
    ]
  ],
  "schema": []
};

export default function CookiesTr() {
  return (
    <>
      <section className="phead">
        <div className="wrap">
          <p className="eyebrow">Yasal</p>
          <h1 className="phead__h phead__h--sm">Çerez Politikası</h1>
          <p className="lead">Sitemizde yalnızca çalışması için gerekli çerez ve tarayıcı depolaması kullanılır. Reklam ya da izleme çerezi yoktur.</p>
          <p className="legal__date">Son güncelleme: 23 Ekim 2026</p>
        </div>
      </section>
      <section className="sec sec--tight">
        <div className="wrap narrow prose prose--legal">
          <h2>Çerez nedir?</h2>
          <p>Çerezler, bir siteyi ziyaret ettiğinde cihazına kaydedilen küçük metin dosyalarıdır. Aynı amaçla tarayıcının yerel depolaması (localStorage, sessionStorage) da kullanılabilir; bu politika hepsini kapsar.</p>
          <h2>Kullandıklarımız</h2>
          <div className="tablewrap">
            <table className="ctable">
              <thead>
                <tr>
                  <th>Ad</th>
                  <th>Tür</th>
                  <th>Amaç</th>
                  <th>Süre</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><code>opia_consent</code></td>
                  <td>Zorunlu (çerez ve yerel depolama)</td>
                  <td>Çerez tercihini hatırlar.</td>
                  <td>12 ay</td>
                </tr>
                <tr>
                  <td><code>opia_table</code>, <code>opia_cart_*</code></td>
                  <td>Zorunlu (oturum depolaması)</td>
                  <td>QR siparişte masa kodun ve sepetin. Sekmeyi kapatınca silinir.</td>
                  <td>Oturum</td>
                </tr>
                <tr>
                  <td><code>opia_orders_*</code></td>
                  <td>Zorunlu (yerel depolama)</td>
                  <td>Verdiğin siparişlerin numarası; durumunu gösterebilmek için.</td>
                  <td>12 saat</td>
                </tr>
                <tr>
                  <td><code>PHPSESSID</code></td>
                  <td>Zorunlu</td>
                  <td>Yalnızca personelin yönetim paneli oturumu. Ziyaretçilere atanmaz.</td>
                  <td>Oturum</td>
                </tr>
                <tr>
                  <td>OpenStreetMap</td>
                  <td>Üçüncü taraf</td>
                  <td>Yalnızca “Haritayı yükle” düğmesine basarsan harita yüklenir.</td>
                  <td>Sağlayıcıya bağlı</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p>Şu an sitemizde istatistik, reklam ya da izleme çerezi kullanılmamaktadır. İleride kullanılırsa yalnızca açık onayınla etkinleşir.</p>
          <h2>Onay ve hukuki dayanak</h2>
          <p>Zorunlu çerezler ve depolama, sitenin ve QR siparişin çalışması için gereklidir. İstatistik ve üçüncü taraf içerikler yalnızca onayınla etkinleşir; reddetmen sitenin kullanımını etkilemez.</p>
          <h2>Tercihlerini yönet</h2>
          <ul>
            <li>Sayfanın altındaki <button type="button" className="linkbtn" data-consent-open>Çerez Tercihleri</button> bağlantısından seçimini değiştirebilirsin.</li>
            <li>Tarayıcı ayarlarından çerezleri ve site verilerini silebilir ya da engelleyebilirsin.</li>
          </ul>
          <h2>Daha fazla bilgi</h2>
          <p><a href="/kvkk-aydinlatma-metni">KVKK Aydınlatma Metni</a> ve <a href="/gizlilik-politikasi">Gizlilik Politikası</a>.</p>
        </div>
      </section>
    </>
  );
}
