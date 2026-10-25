<?php
require_once __DIR__ . '/../legal_lib.php';
$meta = [
    'path' => '/kullanim-kosullari/',
    'title' => 'Kullanım Koşulları | Opia Coffee Co.',
    'description' => 'Opia Coffee Co. internet sitesi ve QR masa siparişi kullanım koşulları: menü ve fiyat bilgileri, sipariş ve ödeme, fikri mülkiyet ve uygulanacak hukuk.',
    'body' => 'page-legal',
    'breadcrumb' => [['Ana Sayfa', '/'], ['Kullanım Koşulları', '/kullanim-kosullari/']],
    'priority' => '0.3',
];
ob_start();
echo legal_open('Kullanım Koşulları', 'Siteyi ve QR masa siparişini kullanarak aşağıdaki koşulları kabul etmiş sayılırsın.');
?>
<h2>1. Genel</h2>
<p>Bu site <?= e(cfg('legal_entity')) ?> tarafından işletilir. Koşulları gerektiğinde güncelleyebiliriz; güncel sürüm bu sayfadadır.</p>

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
<p>Sitedeki logo, marka, metin, fotoğraf ve tasarım unsurları <?= e(cfg('legal_entity')) ?>’a aittir; izinsiz çoğaltılamaz ve ticari amaçla kullanılamaz.</p>

<h2>5. Dış bağlantılar</h2>
<p>Instagram, Google Haritalar ya da OpenStreetMap gibi dış sitelerin içeriğinden ve politikalarından sorumlu değiliz.</p>

<h2>6. Sorumluluk</h2>
<p>Site “olduğu gibi” sunulur; kesintisiz çalışacağını garanti etmeyiz. QR sistemi çalışmadığında siparişini personelimize verebilirsin.</p>

<h2>7. Kişisel veriler</h2>
<p>Kişisel veri toplamıyoruz. Ayrıntılar: <a href="/kvkk-aydinlatma-metni/">KVKK Aydınlatma Metni</a>, <a href="/gizlilik-politikasi/">Gizlilik Politikası</a>, <a href="/cerez-politikasi/">Çerez Politikası</a>.</p>

<h2>8. Uygulanacak hukuk</h2>
<p>Uyuşmazlıklarda Türk hukuku uygulanır; Eskişehir Mahkemeleri ve İcra Daireleri yetkilidir. 6502 sayılı Tüketicinin Korunması Hakkında Kanun kapsamındaki hakların saklıdır.</p>
<?php
echo legal_close();
$content = ob_get_clean();
