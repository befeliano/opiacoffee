/** @jsxImportSource @/site/jsx */
// Sayfa içeriği: Kullanım Koşulları | Opia Coffee Co.
// Metni değiştirmek için bu dosyayı düzenle; başlık ve açıklama aşağıdaki "page" nesnesinde.

import type { StaticPage } from "../static-page";

export const page: StaticPage = {
  "path": "/kullanim-kosullari",
  "lang": "tr",
  "title": "Kullanım Koşulları | Opia Coffee Co.",
  "description": "Opia Coffee Co. internet sitesi ve QR masa siparişi kullanım koşulları: menü ve fiyat bilgileri, sipariş ve ödeme, fikri mülkiyet ve uygulanacak hukuk.",
  "business": false,
  "breadcrumb": [
    [
      "Ana Sayfa",
      "/"
    ],
    [
      "Kullanım Koşulları",
      "/kullanim-kosullari"
    ]
  ],
  "schema": []
};

export default function TermsTr() {
  return (
    <>
      <section className="phead">
        <div className="wrap">
          <p className="eyebrow">Yasal</p>
          <h1 className="phead__h phead__h--sm">Kullanım Koşulları</h1>
          <p className="lead">Siteyi ve QR masa siparişini kullanarak aşağıdaki koşulları kabul etmiş sayılırsın.</p>
          <p className="legal__date">Son güncelleme: 23 Ekim 2026</p>
        </div>
      </section>
      <section className="sec sec--tight">
        <div className="wrap narrow prose prose--legal">
          <h2>1. Genel</h2>
          <p>Bu site <span lang="en">Opia</span> Coffee Co. tarafından işletilir. Koşulları gerektiğinde güncelleyebiliriz; güncel sürüm bu sayfadadır.</p>
          <h2>2. Menü, fiyat ve besin bilgileri</h2>
          <p>Menü, fiyat, çalışma saati, kalori, besin değeri ve alerjen bilgileri bilgilendirme amaçlıdır ve haber verilmeksizin değişebilir. Besin değerleri tahminîdir. Mutfağımızda gluten, süt, yumurta, yer fıstığı ve sert kabuklu yemişler birlikte kullanıldığından çapraz bulaşma riski vardır; alerjin varsa sipariş öncesi personele danış. Fiyatlar Türk lirası cinsindendir ve KDV dahildir.</p>
          <h2>3. QR masa siparişi</h2>
          <ul>
            <li>QR sipariş, kafede oturduğun masadan sipariş vermen içindir; masa dışında ya da başkası adına kullanılmamalıdır.</li>
            <li>Sitede ödeme alınmaz. Sipariş bedeli kafede, kasada ya da masada ödenir.</li>
            <li>Sipariş, bar onayladığında hazırlanır. Ürün tükenmişse ya da hazırlanamıyorsa personel seni bilgilendirir ve sipariş iptal edilebilir.</li>
            <li>Kötüye kullanım (sahte ya da tekrar eden siparişler) fark edilirse masanın QR siparişi kapatılabilir.</li>
          </ul>
          <h2>4. Fikri mülkiyet</h2>
          <p>Sitedeki logo, marka, metin, fotoğraf ve tasarım unsurları <span lang="en">Opia</span> Coffee Co.’a aittir; izinsiz çoğaltılamaz ve ticari amaçla kullanılamaz.</p>
          <h2>5. Dış bağlantılar</h2>
          <p><span lang="en">Instagram</span>, Google Haritalar ya da OpenStreetMap gibi dış sitelerin içeriğinden ve politikalarından sorumlu değiliz.</p>
          <h2>6. Sorumluluk</h2>
          <p>Site “olduğu gibi” sunulur; kesintisiz çalışacağını garanti etmeyiz. QR sistemi çalışmadığında siparişini personelimize verebilirsin.</p>
          <h2>7. Kişisel veriler</h2>
          <p>Kişisel veri toplamıyoruz. Ayrıntılar: <a href="/kvkk-aydinlatma-metni">KVKK Aydınlatma Metni</a>, <a href="/gizlilik-politikasi">Gizlilik Politikası</a>, <a href="/cerez-politikasi">Çerez Politikası</a>.</p>
          <h2>8. Uygulanacak hukuk</h2>
          <p>Uyuşmazlıklarda Türk hukuku uygulanır; Eskişehir Mahkemeleri ve İcra Daireleri yetkilidir. 6502 sayılı Tüketicinin Korunması Hakkında Kanun kapsamındaki hakların saklıdır.</p>
        </div>
      </section>
    </>
  );
}
