/** @jsxImportSource @/site/jsx */
// Sayfa içeriği: Gizlilik Politikası | Opia Coffee Co.
// Metni değiştirmek için bu dosyayı düzenle; başlık ve açıklama aşağıdaki "page" nesnesinde.

import type { StaticPage } from "../static-page";

export const page: StaticPage = {
  "path": "/gizlilik-politikasi",
  "lang": "tr",
  "title": "Gizlilik Politikası | Opia Coffee Co.",
  "description": "Opia Coffee Co. gizlilik politikası: üyelik, form ve online ödeme yok; kişisel veri toplamıyoruz. QR siparişte yalnızca masa ve ürün bilgisi işlenir.",
  "business": false,
  "breadcrumb": [
    [
      "Ana Sayfa",
      "/"
    ],
    [
      "Gizlilik Politikası",
      "/gizlilik-politikasi"
    ]
  ],
  "schema": []
};

export default function PrivacyTr() {
  return (
    <>
      <section className="phead">
        <div className="wrap">
          <p className="eyebrow">Yasal</p>
          <h1 className="phead__h phead__h--sm">Gizlilik Politikası</h1>
          <p className="lead">Kısa ve net: seni tanımlayan veri toplamıyoruz, ödeme almıyoruz, kimseyle veri paylaşmıyoruz.</p>
          <p className="legal__date">Son güncelleme: 28 Ekim 2026</p>
        </div>
      </section>
      <section className="sec sec--tight">
        <div className="wrap narrow prose prose--legal">
          <h2>Kapsam</h2>
          <p>Bu politika, https://opiacoffee.com.tr adresindeki <span lang="en">Opia</span> Coffee Co. internet sitesi ve masalardaki QR kodlarla kullanılan sipariş sistemi için geçerlidir. Yasal ayrıntılar <a href="/kvkk-aydinlatma-metni">KVKK Aydınlatma Metni</a>’nde yer alır.</p>
          <ul>
            <li><strong>Veri sorumlusu:</strong> <span lang="en">Opia</span> Coffee Co.</li>
            <li><strong>Adres:</strong> Yenibağlar Mah. Eti Cd. No:41/C, 26170 Tepebaşı / Eskişehir</li>
            <li><strong>Web sitesi:</strong> https://opiacoffee.com.tr</li>
          </ul>
          <h2>Neleri toplamıyoruz?</h2>
          <ul>
            <li>Ad, soyad, telefon, e-posta ya da adres istemiyoruz.</li>
            <li>Üyelik, giriş ya da iletişim formu yok.</li>
            <li>Online ödeme yok; kart bilgisi hiçbir şekilde sitemize girilmez. Ödeme kafede, kasada ya da masada yapılır.</li>
            <li>Konum, kamera ya da rehber izni istemiyoruz.</li>
            <li>IP adresini sipariş kayıtlarıyla birlikte saklamıyoruz.</li>
          </ul>
          <h2>QR siparişte ne kaydedilir?</h2>
          <p>Yalnızca siparişin hazırlanması için gerekenler: masa numarası, ürünler, seçenekler (süt tercihi, sıcak/soğuk gibi), varsa notun, saat ve sipariş durumu. Not, sipariş kaydıyla birlikte saklanır. Bu bilgilerin hiçbiri seni tanımlamaz; muhasebe ve satış istatistiği için kullanılır.</p>
          <h2>Tarayıcında tutulanlar</h2>
          <p>Sepetin ve sipariş numaraların, sayfayı yenilediğinde kaybolmasın ve siparişinin durumunu görebilesin diye yalnızca senin tarayıcında saklanır. Tarayıcı verilerini silerek bunları istediğin an kaldırabilirsin.</p>
          <h2>Üçüncü taraflar</h2>
          <ul>
            <li><strong>Barındırma sağlayıcısı:</strong> teknik ve yasal zorunluluk nedeniyle erişim kayıtları tutabilir.</li>
            <li><strong>OpenStreetMap:</strong> yalnızca “Haritayı yükle” düğmesine basarsan harita yüklenir.</li>
            <li><strong>Google Haritalar / <span lang="en">Instagram</span>:</strong> bağlantılara tıkladığında ilgili platformun kendi politikası geçerlidir.</li>
          </ul>
          <p>Hiçbir veriyi satmıyor, reklam amacıyla kullanmıyor ya da başka şirketlerle paylaşmıyoruz.</p>
          <h2>Güvenlik</h2>
          <p>Sipariş sistemi yalnızca masalardaki kodlarla çalışır; yönetim paneline yalnızca yetkili personel şifreyle girer. Yönetim paneline yapılan hatalı giriş denemeleri, deneme saldırılarını önlemek için yalnızca sunucu belleğinde en fazla 10 dakika sayılır; kalıcı olarak kaydedilmez.</p>
          <h2>Çocuklar</h2>
          <p>Sitemiz çocuklardan bilerek herhangi bir bilgi toplamaz.</p>
          <h2>Değişiklikler</h2>
          <p>Bu politikayı gerektiğinde güncelleriz; güncel sürüm her zaman bu sayfadadır.</p>
        </div>
      </section>
    </>
  );
}
