<?php
require_once __DIR__ . '/../legal_lib.php';
$meta = [
    'path' => '/cerez-politikasi/',
    'title' => 'Çerez Politikası | Opia Coffee Co.',
    'description' => 'Opia Coffee Co. çerez politikası: yalnızca sitenin çalışması için gereken çerez ve tarayıcı depolaması kullanılır; reklam ya da izleme çerezi yok.',
    'body' => 'page-legal',
    'breadcrumb' => [['Ana Sayfa', '/'], ['Çerez Politikası', '/cerez-politikasi/']],
    'priority' => '0.3',
];
ob_start();
echo legal_open('Çerez Politikası', 'Sitemizde yalnızca çalışması için gerekli çerez ve tarayıcı depolaması kullanılır. Reklam ya da izleme çerezi yoktur.');
?>
<h2>Çerez nedir?</h2>
<p>Çerezler, bir siteyi ziyaret ettiğinde cihazına kaydedilen küçük metin dosyalarıdır. Aynı amaçla tarayıcının yerel depolaması (localStorage, sessionStorage) da kullanılabilir; bu politika hepsini kapsar.</p>

<h2>Kullandıklarımız</h2>
<div class="tablewrap">
<table class="ctable">
  <thead><tr><th>Ad</th><th>Tür</th><th>Amaç</th><th>Süre</th></tr></thead>
  <tbody>
    <tr><td><code>opia_consent</code></td><td>Zorunlu (çerez ve yerel depolama)</td><td>Çerez tercihini hatırlar.</td><td>12 ay</td></tr>
    <tr><td><code>opia_table</code>, <code>opia_cart_*</code></td><td>Zorunlu (oturum depolaması)</td><td>QR siparişte masa kodun ve sepetin. Sekmeyi kapatınca silinir.</td><td>Oturum</td></tr>
    <tr><td><code>opia_orders_*</code></td><td>Zorunlu (yerel depolama)</td><td>Verdiğin siparişlerin numarası; durumunu gösterebilmek için.</td><td>12 saat</td></tr>
    <tr><td><code>PHPSESSID</code></td><td>Zorunlu</td><td>Yalnızca personelin yönetim paneli oturumu. Ziyaretçilere atanmaz.</td><td>Oturum</td></tr>
    <?php if (analytics_on()): ?><tr><td><code>_ga</code>, <code>_ga_*</code></td><td>İstatistik</td><td>Anonim ziyaret istatistiği. Yalnızca onay verirsen yüklenir.</td><td>En fazla 2 yıl</td></tr><?php endif; ?>
    <tr><td>OpenStreetMap</td><td>Üçüncü taraf</td><td>Yalnızca “Haritayı yükle” düğmesine basarsan harita yüklenir.</td><td>Sağlayıcıya bağlı</td></tr>
  </tbody>
</table>
</div>
<?php if (!analytics_on()): ?><p>Şu an sitemizde istatistik, reklam ya da izleme çerezi kullanılmamaktadır. İleride kullanılırsa yalnızca açık onayınla etkinleşir.</p><?php endif; ?>

<h2>Onay ve hukuki dayanak</h2>
<p>Zorunlu çerezler ve depolama, sitenin ve QR siparişin çalışması için gereklidir. İstatistik ve üçüncü taraf içerikler yalnızca onayınla etkinleşir; reddetmen sitenin kullanımını etkilemez.</p>

<h2>Tercihlerini yönet</h2>
<ul>
  <li>Sayfanın altındaki <button type="button" class="linkbtn" data-consent-open>Çerez Tercihleri</button> bağlantısından seçimini değiştirebilirsin.</li>
  <li>Tarayıcı ayarlarından çerezleri ve site verilerini silebilir ya da engelleyebilirsin.</li>
</ul>

<h2>Daha fazla bilgi</h2>
<p><a href="/kvkk-aydinlatma-metni/">KVKK Aydınlatma Metni</a> ve <a href="/gizlilik-politikasi/">Gizlilik Politikası</a>.</p>
<?php
echo legal_close();
$content = ob_get_clean();
