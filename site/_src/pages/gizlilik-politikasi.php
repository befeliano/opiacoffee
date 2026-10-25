<?php
require_once __DIR__ . '/../legal_lib.php';
$meta = [
    'path' => '/gizlilik-politikasi/',
    'title' => 'Gizlilik Politikası | Opia Coffee Co.',
    'description' => 'Opia Coffee Co. gizlilik politikası: üyelik, form ve online ödeme yok; kişisel veri toplamıyoruz. QR siparişte yalnızca masa ve ürün bilgisi işlenir.',
    'body' => 'page-legal',
    'breadcrumb' => [['Ana Sayfa', '/'], ['Gizlilik Politikası', '/gizlilik-politikasi/']],
    'priority' => '0.3',
];
ob_start();
echo legal_open('Gizlilik Politikası', 'Kısa ve net: seni tanımlayan veri toplamıyoruz, ödeme almıyoruz, kimseyle veri paylaşmıyoruz.');
?>
<h2>Kapsam</h2>
<p>Bu politika, <?= e(cfg('url')) ?> adresindeki Opia Coffee Co. internet sitesi ve masalardaki QR kodlarla kullanılan sipariş sistemi için geçerlidir. Yasal ayrıntılar <a href="/kvkk-aydinlatma-metni/">KVKK Aydınlatma Metni</a>’nde yer alır.</p>
<?= controller_block() ?>

<h2>Neleri toplamıyoruz?</h2>
<ul>
  <li>Ad, soyad, telefon, e-posta ya da adres istemiyoruz.</li>
  <li>Üyelik, giriş ya da iletişim formu yok.</li>
  <li>Online ödeme yok; kart bilgisi hiçbir şekilde sitemize girilmez. Ödeme kafede, kasada ya da masada yapılır.</li>
  <li>Konum, kamera ya da rehber izni istemiyoruz.</li>
  <li>IP adresini sipariş kayıtlarıyla birlikte saklamıyoruz.</li>
</ul>

<h2>QR siparişte ne kaydedilir?</h2>
<p>Yalnızca siparişin hazırlanması için gerekenler: masa numarası, ürünler, seçenekler (süt tercihi, sıcak/soğuk gibi), varsa notun, saat ve sipariş durumu. Notlar gün sonunda silinir. Kalan bilgiler (ürün, adet, tutar, saat) seni tanımlamaz ve yalnızca satış istatistiği için kullanılır.</p>

<h2>Tarayıcında tutulanlar</h2>
<p>Sepetin ve sipariş numaraların, sayfayı yenilediğinde kaybolmasın ve siparişinin durumunu görebilesin diye yalnızca senin tarayıcında saklanır. Tarayıcı verilerini silerek bunları istediğin an kaldırabilirsin.</p>

<h2>Üçüncü taraflar</h2>
<ul>
  <li><strong>Barındırma sağlayıcısı:</strong> teknik ve yasal zorunluluk nedeniyle erişim kayıtları tutabilir.</li>
  <li><strong>OpenStreetMap:</strong> yalnızca “Haritayı yükle” düğmesine basarsan harita yüklenir.</li>
  <li><strong>Google Haritalar / Instagram:</strong> bağlantılara tıkladığında ilgili platformun kendi politikası geçerlidir.</li>
  <?php if (analytics_on()): ?><li><strong>İstatistik:</strong> yalnızca onay verirsen anonim ziyaret istatistiği ölçülür.</li><?php endif; ?>
</ul>
<p>Hiçbir veriyi satmıyor, reklam amacıyla kullanmıyor ya da başka şirketlerle paylaşmıyoruz.</p>

<h2>Güvenlik</h2>
<p>Sipariş sistemi yalnızca masalardaki kodlarla çalışır; yönetim paneline yalnızca yetkili personel şifreyle girer. Yönetim paneline yapılan hatalı giriş denemeleri, deneme saldırılarını önlemek için IP adresinin şifrelenmiş özeti olarak 15 dakika tutulur ve sonra silinir.</p>

<h2>Çocuklar</h2>
<p>Sitemiz çocuklardan bilerek herhangi bir bilgi toplamaz.</p>

<h2>Değişiklikler</h2>
<p>Bu politikayı gerektiğinde güncelleriz; güncel sürüm her zaman bu sayfadadır.</p>
<?php
echo legal_close();
$content = ob_get_clean();
