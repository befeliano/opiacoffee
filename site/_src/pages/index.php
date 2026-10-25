<?php
$cfg = cfg();
$m = menu_data();
$al = allergen_names($m);
$season = seasonal_products($m);
$s = $m['settings']['season'];

$meta = [
    'path' => '/',
    'title' => 'Opia Coffee Co. | Yenibağlar, Eskişehir’de Nitelikli Kahve',
    'description' => 'Opia Coffee Co.: Yenibağlar, Eskişehir’de nitelikli kahve, filtre, espresso, matcha ve günlük tatlılar. Her gün 09:00 - 00:00, Anadolu Üniversitesi yakını.',
    'business' => true,
    'menu_js' => true,
    'body' => 'home',
    'schema' => [],
];

ob_start(); ?>
<section class="hero">
  <div class="wrap hero__grid">
    <div class="hero__txt">
      <p class="eyebrow"><span class="dot" aria-hidden="true"></span><span data-open-status>Her gün 09:00 - 00:00</span><span class="sep" aria-hidden="true">/</span><span class="eyebrow__loc">Yenibağlar, Eskişehir</span></p>
      <h1 class="hero__h"><span class="sr">Opia Coffee Co.: </span>Nitelikli kahve,<br><em>Bağlar’da.</em></h1>
      <p class="lead">Tepebaşı’nın sakin bir köşesinde, her fincanı özenle hazırlanan bir kahve dükkânı. Filtre kahve, espresso bazlı içecekler, matcha ve vitrinden günlük tatlılar. 2019’dan beri Yenibağlar’dayız.</p>
      <div class="hero__cta">
        <a class="btn" href="/menu/">Menüyü keşfet <?= icon('arrow') ?></a>
        <a class="btn btn--line" href="<?= e(maps_dir_url()) ?>" target="_blank" rel="noopener"><?= icon('pin') ?> Yol tarifi</a>
      </div>
    </div>
    <figure class="hero__fig">
      <?= img('hero', 'Opia Coffee Co. Yenibağlar Eskişehir, barda filtre kahve', ['w' => 1000, 'h' => 1250, 'eager' => true, 'label' => 'hero / 1000×1250 (dikey)']) ?>
      <figcaption><span><?= e($cfg['address']['street']) ?></span><span>Yenibağlar</span></figcaption>
    </figure>
  </div>
</section>

<div class="marquee" aria-hidden="true">
  <div class="marquee__t">
    <?php for ($i = 0; $i < 2; $i++): ?>
    <span>Nitelikli Kahve</span><i></i><span>Filtre</span><i></i><span>Espresso</span><i></i><span>Matcha Bar</span><i></i><span>Günlük Tatlılar</span><i></i><span>Awaken the senses</span><i></i><span>09:00 - 00:00</span><i></i><span>Yenibağlar / Eskişehir</span><i></i>
    <?php endfor; ?>
  </div>
</div>

<?php if ($season): ?>
<section class="sec" id="mevsim" aria-labelledby="mevsim-h">
  <div class="wrap">
    <header class="sec__head">
      <p class="label"><?= icon('leaf') ?> <?= e($s['label']) ?></p>
      <h2 id="mevsim-h" class="h2"><?= e($s['title']) ?></h2>
      <p class="sec__sub"><?= e($s['subtitle']) ?></p>
    </header>
    <ul class="cards">
      <?php foreach ($season as $p) echo product_card($p, $al); ?>
    </ul>
    <p class="sec__more"><a class="ulink" href="/menu/">Tüm menüyü gör <?= icon('arrow') ?></a></p>
  </div>
</section>
<?= menu_embed($season, $al) ?>
<?php endif; ?>

<section class="sec sec--ink statement">
  <div class="wrap">
    <p class="label label--inv">Opia Coffee Co.</p>
    <p class="statement__t"><em>Awaken the senses.</em> 2019’dan beri Yenibağlar’da, Eti Caddesi’nde: ders arası, yürüyüş sonrası ya da gece yarısına doğru uğranacak bir kahve durağı.</p>
    <a class="btn btn--inv" href="/hakkimizda/">Hikâyemiz <?= icon('arrow') ?></a>
  </div>
</section>

<section class="sec" aria-labelledby="ziyaret-h">
  <div class="wrap visit">
    <div class="visit__info">
      <p class="label"><?= icon('pin') ?> Bizi bul</p>
      <h2 id="ziyaret-h" class="h2">Yenibağlar, <em>Eti Caddesi</em></h2>
      <address class="visit__addr"><?= e($cfg['address']['hood']) ?> <?= e($cfg['address']['street']) ?><br><?= e($cfg['address']['district']) ?> / <?= e($cfg['address']['city']) ?></address>
      <dl class="hours">
        <div><dt>Pazartesi - Pazar</dt><dd>09:00 - 00:00</dd></div>
      </dl>
      <div class="visit__cta">
        <a class="btn" href="<?= e(maps_dir_url()) ?>" target="_blank" rel="noopener"><?= icon('pin') ?> Yol tarifi al</a>
        <a class="btn btn--line" href="/iletisim/">İletişim</a>
      </div>
    </div>
    <div class="mapbox" data-map data-lat="<?= $cfg['geo']['lat'] ?>" data-lng="<?= $cfg['geo']['lng'] ?>">
      <div class="mapbox__ph">
        <?= icon('pin') ?>
        <p>Opia Coffee Co.<br><small>Yenibağlar, Tepebaşı / Eskişehir</small></p>
        <button type="button" class="btn btn--line" data-map-load>Haritayı yükle</button>
        <small class="mapbox__n">Harita OpenStreetMap’ten yüklenir.</small>
      </div>
    </div>
  </div>
</section>

<section class="sec sec--tint" aria-labelledby="cevre-h">
  <div class="wrap">
    <header class="sec__head">
      <p class="label"><?= icon('pin') ?> Çevrede</p>
      <h2 id="cevre-h" class="h2">Şehrin <em>kalbinde</em> bir mola</h2>
      <p class="sec__sub">Yenibağlar’daki konumumuz, Eskişehir’de gezilecek ve görülecek birçok noktaya yakın.</p>
    </header>
    <ul class="near">
      <li><a href="/anadolu-universitesi-yakini-kafe/"><?= icon('school') ?><span><b>Anadolu Üniversitesi</b><small>Yunusemre Kampüsü yakını</small></span><?= icon('arrow-ur') ?></a></li>
      <li><a href="/hava-muzesi-yakini-kafe/"><?= icon('plane') ?><span><b>Hava Müzesi</b><small>Vecihi Hürkuş Havacılık Parkı</small></span><?= icon('arrow-ur') ?></a></li>
      <li><a href="/casaba-modern-yakini-kafe/"><?= icon('bag') ?><span><b>Cassaba Modern</b><small>Hoşnudiye, alışveriş molası</small></span><?= icon('arrow-ur') ?></a></li>
      <li><a href="/eskisehir-tren-gari-yakini-kafe/"><?= icon('train') ?><span><b>Eskişehir Tren Garı</b><small>Tren öncesi / sonrası kahve</small></span><?= icon('arrow-ur') ?></a></li>
      <li><a href="/yenibaglar-kafe/"><?= icon('cup') ?><span><b>Yenibağlar</b><small>Mahalle kafesi</small></span><?= icon('arrow-ur') ?></a></li>
      <li><a href="/tepebasi-kafe/"><?= icon('sun') ?><span><b>Tepebaşı</b><small>Eskişehir’in modern yüzü</small></span><?= icon('arrow-ur') ?></a></li>
    </ul>
  </div>
</section>

<?php $posts = require __DIR__ . '/../posts.php'; usort($posts, fn($a, $b) => strcmp($b['date'], $a['date'])); ?>
<section class="sec" aria-labelledby="blog-h">
  <div class="wrap">
    <header class="sec__head sec__head--row">
      <div><p class="label">Blog</p><h2 id="blog-h" class="h2">Kahve <em>rehberi</em></h2></div>
      <a class="btn btn--line" href="/blog/">Tüm yazılar <?= icon('arrow') ?></a>
    </header>
    <ul class="posts posts--3"><?php foreach (array_slice($posts, 0, 3) as $p) echo post_card($p); ?></ul>
  </div>
</section>

<section class="sec sec--tint" aria-labelledby="galeri-h">
  <div class="wrap">
    <header class="sec__head sec__head--row">
      <div>
        <p class="label"><?= icon('insta') ?> Instagram</p>
        <h2 id="galeri-h" class="h2">@<?= e($cfg['instagram']) ?></h2>
      </div>
      <a class="btn btn--line" href="https://www.instagram.com/<?= e($cfg['instagram']) ?>/" target="_blank" rel="noopener me">Takip et <?= icon('arrow-ur') ?></a>
    </header>
    <div class="gal">
      <?php foreach ([1 => 'Opia Coffee Co. tatlı vitrini', 2 => 'Opia Coffee Co. iç mekân', 3 => 'Filtre kahve demleme', 4 => 'Kahve çekirdekleri', 5 => 'Espresso barı', 6 => 'Opia Coffee Co. Yenibağlar dış cephe'] as $n => $alt): ?>
      <a class="gal__i gal__i--<?= $n ?>" href="https://www.instagram.com/<?= e($cfg['instagram']) ?>/" target="_blank" rel="noopener me" aria-label="Instagram: <?= e($alt) ?>">
        <?= img("galeri-$n", $alt . ', Eskişehir Yenibağlar', ['w' => 800, 'h' => 800, 'label' => "galeri-$n / 800×800"]) ?>
      </a>
      <?php endforeach; ?>
    </div>
  </div>
</section>
<?php $content = ob_get_clean();
