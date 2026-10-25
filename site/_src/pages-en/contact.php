<?php
$cfg = cfg();
$faq = [
    ['Where is Opia Coffee Co.?', 'Opia Coffee Co. is at Eti Caddesi No:41/C in the Yenibağlar neighbourhood of Tepebaşı, Eskişehir, close to Anadolu University’s Yunusemre Campus and the Vecihi Hürkuş Aviation Park (Aviation Museum).'],
    ['What are your opening hours?', 'We are open every day from 09:00 to 00:00.'],
    ['Can I order from my table?', 'Yes. Scan the QR code on your table and the menu opens in order mode. Choose your options, send your order to the bar, call a waiter or ask for the bill. You pay at the counter or at your table.'],
    ['Do you list allergens?', 'Yes. Tap any item on the menu to see its allergens and nutrition values per serving.'],
    ['Do you speak English?', 'Our menu and QR ordering are available in English. Feel free to ask our staff at the bar too.'],
];
$meta = [
    'path' => '/en/contact/',
    'title' => 'Contact and Directions | Opia Coffee Co. Eskişehir',
    'description' => 'Opia Coffee Co. address, opening hours and directions: Eti Cd. No:41/C, Yenibağlar, Tepebaşı, Eskişehir, Türkiye. Open every day 09:00 - 00:00.',
    'business' => true,
    'body' => 'page-contact',
    'breadcrumb' => [['Home', '/en/'], ['Contact', '/en/contact/']],
    'schema' => [['@type' => 'ContactPage', '@id' => url('/en/contact/#contact'), 'url' => url('/en/contact/')], faq_schema($faq)],
];
ob_start(); ?>
<section class="phead">
  <div class="wrap">
    <p class="eyebrow">Opia Coffee Co.</p>
    <h1 class="phead__h">Contact</h1>
    <p class="lead">Address, opening hours and directions. Questions? Message us on Instagram or drop by the café.</p>
  </div>
</section>

<section class="sec sec--tight">
  <div class="wrap contact">
    <div class="contact__info">
      <div class="info">
        <h2 class="info__h"><?= icon('pin') ?> Address</h2>
        <address><?= e($cfg['address']['hood']) ?><br><?= e($cfg['address']['street']) ?><br><?= e($cfg['address']['district']) ?> / <?= e($cfg['address']['city']) ?> <?= e($cfg['address']['zip']) ?>, Türkiye</address>
        <p class="info__btns">
          <a class="btn" href="<?= e(maps_dir_url()) ?>" target="_blank" rel="noopener">Google Maps</a>
          <a class="btn btn--line" href="https://yandex.com.tr/harita/?pt=<?= $cfg['geo']['lng'] ?>,<?= $cfg['geo']['lat'] ?>&z=17&l=map" target="_blank" rel="noopener">Yandex Maps</a>
          <a class="btn btn--line" href="https://maps.apple.com/?daddr=<?= $cfg['geo']['lat'] ?>,<?= $cfg['geo']['lng'] ?>&dirflg=d" target="_blank" rel="noopener">Apple Maps</a>
        </p>
      </div>
      <div class="info">
        <h2 class="info__h"><?= icon('clock') ?> Opening hours</h2>
        <dl class="hours">
          <div><dt>Monday - Sunday</dt><dd>09:00 - 00:00</dd></div>
        </dl>
        <p class="status" data-open-status>Every day 09:00 - 00:00</p>
      </div>
      <div class="info">
        <h2 class="info__h"><?= icon('insta') ?> Social</h2>
        <p><a class="ulink" href="https://www.instagram.com/<?= e($cfg['instagram']) ?>/" target="_blank" rel="noopener me">@<?= e($cfg['instagram']) ?></a></p>
        <?php if ($cfg['phone']): ?><p><a class="ulink" href="tel:<?= e(preg_replace('/\s+/', '', $cfg['phone'])) ?>"><?= e($cfg['phone']) ?></a></p><?php endif; ?>
        <?php if ($cfg['email']): ?><p><a class="ulink" href="mailto:<?= e($cfg['email']) ?>"><?= e($cfg['email']) ?></a></p><?php endif; ?>
      </div>
    </div>

    <div class="mapbox mapbox--tall" data-map data-lat="<?= $cfg['geo']['lat'] ?>" data-lng="<?= $cfg['geo']['lng'] ?>">
      <div class="mapbox__ph">
        <?= icon('pin') ?>
        <p>Opia Coffee Co.<br><small>Yenibağlar, Tepebaşı / Eskişehir</small></p>
        <button type="button" class="btn btn--line" data-map-load>Load map</button>
        <small class="mapbox__n">The map is loaded from OpenStreetMap.</small>
      </div>
    </div>
  </div>
</section>

<section class="sec sec--tight" aria-labelledby="how-h">
  <div class="wrap narrow prose">
    <h2 id="how-h" class="h2">Getting <em>here</em></h2>
    <p>Opia is at No:41/C on Eti Street (Eti Caddesi) in Yenibağlar, Tepebaşı. We are on the same stretch as Anadolu University’s Yunusemre Campus and the Vecihi Hürkuş Aviation Park, so you can walk over from the campus or the museum.</p>
    <ul>
      <li><strong>From the train station:</strong> Eskişehir Train Station is about one kilometre away; a short taxi or city transport ride.</li>
      <li><strong>From Cassaba Modern:</strong> a short ride from Hoşnudiye to Yenibağlar.</li>
      <li><strong>By car:</strong> the “Get directions” button takes you straight to our location.</li>
    </ul>
  </div>
</section>

<section class="sec sec--tight" aria-labelledby="faq-h">
  <div class="wrap narrow">
    <h2 id="faq-h" class="h2">FAQ</h2>
    <?= faq_html($faq) ?>
  </div>
</section>
<?php $content = ob_get_clean();
