<?php
$cfg = cfg();
$faq = [
    ['Opia Coffee Co. nerede?', 'Opia Coffee Co., Eskişehir Tepebaşı ilçesi Yenibağlar Mahallesi’nde, Eti Caddesi No:41/C adresindedir. Anadolu Üniversitesi Yunusemre Kampüsü ve Vecihi Hürkuş Havacılık Parkı’na (Hava Müzesi) yakındır.'],
    ['Çalışma saatleri nedir?', 'Her gün 09:00 - 00:00 arasında açığız.'],
    ['Grup ya da etkinlik için yer ayırtabilir miyim?', 'Grup ve etkinlik talepleri için Instagram’dan (@' . $cfg['instagram'] . ') bize yazabilir ya da kafeye uğrayabilirsin.'],
    ['Masadan QR ile sipariş verebilir miyim?', 'Evet. Masandaki QR kodu okuttuğunda menü sipariş modunda açılır; ürün seçeneklerini seçip siparişini bara gönderebilir, garson çağırabilir ya da hesap isteyebilirsin. Ödeme kasada ya da masada yapılır.'],
    ['Menüde alerjen bilgisi var mı?', 'Evet. Menü sayfasında her ürüne dokunarak alerjenleri ve porsiyona göre besin değerlerini görebilirsin.'],
];
$meta = [
    'path' => '/iletisim/',
    'title' => 'İletişim ve Adres | Opia Coffee Co. Yenibağlar Eskişehir',
    'description' => 'Opia Coffee Co. adres, çalışma saatleri ve yol tarifi: Yenibağlar Mah. Eti Cd. No:41/C, Tepebaşı / Eskişehir. Her gün 09:00 - 00:00. QR ile masadan sipariş.',
    'business' => true,
    'body' => 'page-contact',
    'breadcrumb' => [['Ana Sayfa', '/'], ['İletişim', '/iletisim/']],
    'schema' => [['@type' => 'ContactPage', '@id' => url('/iletisim/#contact'), 'url' => url('/iletisim/')], faq_schema($faq)],
];
ob_start(); ?>
<section class="phead">
  <div class="wrap">
    <p class="eyebrow">Opia Coffee Co.</p>
    <h1 class="phead__h">İletişim</h1>
    <p class="lead">Adres, saatler, yol tarifi. Bir şey sormak istersen Instagram’dan yaz ya da kafeye uğra.</p>
  </div>
</section>

<section class="sec sec--tight">
  <div class="wrap contact">
    <div class="contact__info">
      <div class="info">
        <h2 class="info__h"><?= icon('pin') ?> Adres</h2>
        <address><?= e($cfg['address']['hood']) ?><br><?= e($cfg['address']['street']) ?><br><?= e($cfg['address']['district']) ?> / <?= e($cfg['address']['city']) ?> <?= e($cfg['address']['zip']) ?></address>
        <p class="info__btns">
          <a class="btn" href="<?= e(maps_dir_url()) ?>" target="_blank" rel="noopener">Google Haritalar</a>
          <a class="btn btn--line" href="https://yandex.com.tr/harita/?pt=<?= $cfg['geo']['lng'] ?>,<?= $cfg['geo']['lat'] ?>&z=17&l=map" target="_blank" rel="noopener">Yandex Haritalar</a>
          <a class="btn btn--line" href="https://maps.apple.com/?daddr=<?= $cfg['geo']['lat'] ?>,<?= $cfg['geo']['lng'] ?>&dirflg=d" target="_blank" rel="noopener">Apple Haritalar</a>
        </p>
      </div>
      <div class="info">
        <h2 class="info__h"><?= icon('clock') ?> Çalışma saatleri</h2>
        <dl class="hours">
          <div><dt>Pazartesi - Pazar</dt><dd>09:00 - 00:00</dd></div>
        </dl>
        <p class="status" data-open-status>Her gün 09:00 - 00:00</p>
      </div>
      <div class="info">
        <h2 class="info__h"><?= icon('insta') ?> Sosyal medya</h2>
        <p><a class="ulink" href="https://www.instagram.com/<?= e($cfg['instagram']) ?>/" target="_blank" rel="noopener me">@<?= e($cfg['instagram']) ?></a></p>
        <?php if ($cfg['phone']): ?><p><a class="ulink" href="tel:<?= e(preg_replace('/\s+/', '', $cfg['phone'])) ?>"><?= e($cfg['phone']) ?></a></p><?php endif; ?>
        <?php if ($cfg['email']): ?><p><a class="ulink" href="mailto:<?= e($cfg['email']) ?>"><?= e($cfg['email']) ?></a></p><?php endif; ?>
      </div>
    </div>

    <div class="mapbox mapbox--tall" data-map data-lat="<?= $cfg['geo']['lat'] ?>" data-lng="<?= $cfg['geo']['lng'] ?>">
      <div class="mapbox__ph">
        <?= icon('pin') ?>
        <p>Opia Coffee Co.<br><small>Yenibağlar, Tepebaşı / Eskişehir</small></p>
        <button type="button" class="btn btn--line" data-map-load>Haritayı yükle</button>
        <small class="mapbox__n">Harita OpenStreetMap’ten yüklenir.</small>
      </div>
    </div>
  </div>
</section>

<section class="sec sec--tight" aria-labelledby="gel-h">
  <div class="wrap narrow prose">
    <h2 id="gel-h" class="h2">Nasıl <em>gelirsin?</em></h2>
    <p>Opia, Tepebaşı ilçesi Yenibağlar Mahallesi’nde Eti Caddesi üzerinde, No:41/C’dedir. Anadolu Üniversitesi Yunusemre Kampüsü ile Vecihi Hürkuş Havacılık Parkı’nın (Hava Müzesi) bulunduğu hatta olduğumuz için kampüs ve müze tarafından yürüyerek ya da kısa bir yolculukla gelebilirsin.</p>
    <ul>
      <li><strong>Tren Garı’ndan:</strong> Eskişehir Garı yaklaşık bir kilometre uzaklıkta; taksi ya da şehir içi ulaşımla kısa sürede ulaşılır.</li>
      <li><strong>Cassaba Modern’den:</strong> Hoşnudiye tarafından Yenibağlar’a kısa bir yolculuk yeterli.</li>
      <li><strong>Araçla:</strong> Haritadaki “Yol tarifi al” düğmesi seni doğrudan konumumuza yönlendirir.</li>
    </ul>
  </div>
</section>

<section class="sec sec--tight" aria-labelledby="sss-h">
  <div class="wrap narrow">
    <h2 id="sss-h" class="h2">Sık sorulanlar</h2>
    <?= faq_html($faq) ?>
  </div>
</section>
<?php $content = ob_get_clean();
