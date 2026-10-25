<?php
require_once __DIR__ . '/../legal_lib.php';
$meta = [
    'path' => '/kvkk-aydinlatma-metni/',
    'title' => 'KVKK Aydınlatma Metni | Opia Coffee Co.',
    'description' => 'Opia Coffee Co. internet sitesi ve QR masa siparişi için 6698 sayılı KVKK kapsamında aydınlatma metni: kişisel veri toplamıyoruz, ödeme almıyoruz.',
    'body' => 'page-legal',
    'breadcrumb' => [['Ana Sayfa', '/'], ['KVKK Aydınlatma Metni', '/kvkk-aydinlatma-metni/']],
    'priority' => '0.3',
];
ob_start();
echo legal_open('KVKK Aydınlatma Metni', '6698 sayılı Kişisel Verilerin Korunması Kanunu’nun 10. maddesi uyarınca sitemizde ve QR masa siparişinde hangi verilerin işlendiğini açıklıyoruz. Kısaca: seni tanımlayan hiçbir kişisel veri toplamıyoruz.');
?>
<h2>1. Veri sorumlusu</h2>
<?= controller_block() ?>

<h2>2. Topladığımız kişisel veri yok</h2>
<p>Sitemizde üyelik, iletişim formu, bülten, online ödeme ya da konum isteği yoktur. Adını, telefonunu, e-postanı ya da kart bilgini istemiyoruz; IP adresini siparişlerle ya da ziyaretlerle birlikte kaydetmiyoruz. QR masa siparişi kimlik sorulmadan, misafir olarak verilir.</p>

<h2>3. QR masa siparişinde tutulan bilgiler</h2>
<p>Siparişini bara iletebilmek için şu bilgiler kaydedilir: masa numarası, seçtiğin ürünler ve seçenekleri, varsa sipariş notu, siparişin saati ve durumu. Bu bilgiler seni tanımlamaz. Sipariş notları gün sonunda silinir; ürün, adet, tutar ve saat bilgileri satış istatistiği için saklanır. Sipariş notuna ad, telefon gibi kişisel bilgi yazmamanı rica ederiz.</p>

<h2>4. Tarayıcında saklananlar</h2>
<p>Sepetin, masa kodun ve verdiğin siparişlerin numarası, siparişinin durumunu gösterebilmek için yalnızca kendi tarayıcında (yerel depolama) tutulur; bize iletilmez ve en fazla 12 saat sonra kullanılmaz. Çerez tercihin de tarayıcında saklanır. Ayrıntılar: <a href="/cerez-politikasi/">Çerez Politikası</a>.</p>

<h2>5. Barındırma kayıtları</h2>
<p>Siteyi barındıran hizmet sağlayıcı, teknik zorunluluk ve 5651 sayılı Kanun gereği erişim kayıtları (IP adresi, tarih ve saat, istenen sayfa) tutabilir. Bu kayıtları pazarlama ya da profil oluşturma amacıyla kullanmıyoruz; yalnızca güvenlik ve yasal yükümlülük gerektirdiğinde ilgili mercilerle paylaşılabilir.</p>

<h2>6. İstatistik ve üçüncü taraflar</h2>
<?php if (analytics_on()): ?>
<p>Onay vermen hâlinde sayfa ziyaretleri anonim istatistik olarak ölçülür (Google Analytics). Onay vermezsen hiçbir istatistik betiği yüklenmez.</p>
<?php else: ?>
<p>Sitemizde şu an hiçbir istatistik, reklam ya da izleme aracı kullanılmamaktadır. İleride kullanılırsa yalnızca açık onayınla etkinleşir ve bu metin güncellenir.</p>
<?php endif; ?>
<p>“Haritayı yükle” düğmesine basarsan harita OpenStreetMap sunucularından yüklenir; düğmeye basmadan hiçbir dış istek yapılmaz. Yazı tipleri kendi sunucumuzdan yüklenir.</p>

<h2>7. Hukuki sebep</h2>
<p>Siparişe ilişkin bilgiler, talep ettiğin hizmetin yerine getirilmesi (Kanun md. 5/2-c) ve meşru menfaat (md. 5/2-f) kapsamında işlenir. Barındırma kayıtları hukuki yükümlülük (md. 5/2-ç) kapsamındadır. İstatistik çerezleri yalnızca açık rızanla (md. 5/1) kullanılır.</p>

<h2>8. Haklarınız</h2>
<p>Kanun’un 11. maddesi uyarınca kişisel verilerinin işlenip işlenmediğini öğrenme, bilgi talep etme, düzeltme, silme, aktarıldığı kişileri bilme, itiraz etme ve zararın giderilmesini isteme haklarına sahipsin. Seni tanımlayan bir veri tutmadığımız için çoğu durumda paylaşacak bir kayıt bulunmaz; yine de sorularını yanıtlarız.</p>

<h2>9. Başvuru</h2>
<p>Taleplerini yazılı olarak yukarıdaki adrese iletebilir<?= cfg('email') ? ' ya da ' . e(cfg('email')) . ' adresine e-posta gönderebilir' : '' ?>sin. Talepler en geç otuz gün içinde ücretsiz olarak yanıtlanır. Kişisel Verileri Koruma Kurulu’na şikâyet hakkın saklıdır.</p>
<?php
echo legal_close();
$content = ob_get_clean();
