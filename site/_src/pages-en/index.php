<?php
$cfg = cfg();
$m = menu_data();
$al = allergen_names($m);
$season = seasonal_products($m);
$s = $m['settings']['season'];

$meta = [
    'path' => '/en/',
    'title' => 'Opia Coffee Co. | Specialty Coffee in Eskişehir, Turkey',
    'description' => 'Opia Coffee Co. in Yenibağlar, Eskişehir: specialty coffee, espresso drinks, matcha and daily desserts. Open daily 09:00 - 00:00, near Anadolu University.',
    'business' => true,
    'menu_js' => true,
    'body' => 'home',
];

ob_start(); ?>
<section class="hero">
  <div class="wrap hero__grid">
    <div class="hero__txt">
      <p class="eyebrow"><span class="dot" aria-hidden="true"></span><span data-open-status>Every day 09:00 - 00:00</span><span class="sep" aria-hidden="true">/</span><span class="eyebrow__loc">Yenibağlar, Eskişehir</span></p>
      <h1 class="hero__h"><span class="sr">Opia Coffee Co.: </span>Specialty coffee,<br><em>in Bağlar.</em></h1>
      <p class="lead">A coffee shop on a quiet corner of Tepebaşı where every cup is made with care. Filter coffee, espresso drinks, matcha and daily desserts from our counter. In Yenibağlar since 2019.</p>
      <div class="hero__cta">
        <a class="btn" href="/en/menu/">See the menu <?= icon('arrow') ?></a>
        <a class="btn btn--line" href="<?= e(maps_dir_url()) ?>" target="_blank" rel="noopener"><?= icon('pin') ?> Directions</a>
      </div>
    </div>
    <figure class="hero__fig">
      <?= img('hero', 'Opia Coffee Co. in Yenibağlar, Eskişehir: filter coffee at the bar', ['w' => 1000, 'h' => 1250, 'eager' => true, 'label' => 'hero / 1000×1250']) ?>
      <figcaption><span><?= e($cfg['address']['street']) ?></span><span>Yenibağlar</span></figcaption>
    </figure>
  </div>
</section>

<div class="marquee" aria-hidden="true">
  <div class="marquee__t">
    <?php for ($i = 0; $i < 2; $i++): ?>
    <span>Specialty Coffee</span><i></i><span>Filter</span><i></i><span>Espresso</span><i></i><span>Matcha Bar</span><i></i><span>Daily Desserts</span><i></i><span>Awaken the senses</span><i></i><span>09:00 - 00:00</span><i></i><span>Yenibağlar / Eskişehir</span><i></i>
    <?php endfor; ?>
  </div>
</div>

<?php if ($season): ?>
<section class="sec" id="mevsim" aria-labelledby="season-h">
  <div class="wrap">
    <header class="sec__head">
      <p class="label"><?= icon('leaf') ?> <?= e(season_txt($s, 'label')) ?></p>
      <h2 id="season-h" class="h2"><?= e(season_txt($s, 'title')) ?></h2>
      <p class="sec__sub"><?= e(season_txt($s, 'subtitle')) ?></p>
    </header>
    <ul class="cards">
      <?php foreach ($season as $p) echo product_card($p, $al); ?>
    </ul>
    <p class="sec__more"><a class="ulink" href="/en/menu/">See the full menu <?= icon('arrow') ?></a></p>
  </div>
</section>
<?= menu_embed($season, $al) ?>
<?php endif; ?>

<section class="sec sec--ink statement">
  <div class="wrap">
    <p class="label label--inv">Opia Coffee Co.</p>
    <p class="statement__t"><em>Awaken the senses.</em> On Eti Street in Yenibağlar since 2019: a coffee stop between classes, after a walk or late into the evening.</p>
    <a class="btn btn--inv" href="/en/about/">Our story <?= icon('arrow') ?></a>
  </div>
</section>

<section class="sec" aria-labelledby="visit-h">
  <div class="wrap visit">
    <div class="visit__info">
      <p class="label"><?= icon('pin') ?> Find us</p>
      <h2 id="visit-h" class="h2">Yenibağlar, <em>Eti Street</em></h2>
      <address class="visit__addr"><?= e($cfg['address']['hood']) ?> <?= e($cfg['address']['street']) ?><br><?= e($cfg['address']['district']) ?> / <?= e($cfg['address']['city']) ?>, Türkiye</address>
      <dl class="hours">
        <div><dt>Monday - Sunday</dt><dd>09:00 - 00:00</dd></div>
      </dl>
      <div class="visit__cta">
        <a class="btn" href="<?= e(maps_dir_url()) ?>" target="_blank" rel="noopener"><?= icon('pin') ?> Get directions</a>
        <a class="btn btn--line" href="/en/contact/">Contact</a>
      </div>
    </div>
    <div class="mapbox" data-map data-lat="<?= $cfg['geo']['lat'] ?>" data-lng="<?= $cfg['geo']['lng'] ?>">
      <div class="mapbox__ph">
        <?= icon('pin') ?>
        <p>Opia Coffee Co.<br><small>Yenibağlar, Tepebaşı / Eskişehir</small></p>
        <button type="button" class="btn btn--line" data-map-load>Load map</button>
        <small class="mapbox__n">The map is loaded from OpenStreetMap.</small>
      </div>
    </div>
  </div>
</section>

<section class="sec sec--tint" aria-labelledby="near-h">
  <div class="wrap">
    <header class="sec__head">
      <p class="label"><?= icon('pin') ?> Nearby</p>
      <h2 id="near-h" class="h2">A break in the <em>heart</em> of the city</h2>
      <p class="sec__sub">Our spot in Yenibağlar is close to several places worth seeing in Eskişehir.</p>
    </header>
    <ul class="near near--info">
      <li><div><?= icon('school') ?><span><b>Anadolu University</b><small>Close to Yunusemre Campus</small></span></div></li>
      <li><div><?= icon('plane') ?><span><b>Aviation Museum</b><small>Vecihi Hürkuş Aviation Park</small></span></div></li>
      <li><div><?= icon('bag') ?><span><b>Cassaba Modern</b><small>Shopping centre in Hoşnudiye</small></span></div></li>
      <li><div><?= icon('train') ?><span><b>Eskişehir Train Station</b><small>About 1 km as the crow flies</small></span></div></li>
      <li><div><?= icon('cup') ?><span><b>Yenibağlar</b><small>Our neighbourhood</small></span></div></li>
      <li><div><?= icon('sun') ?><span><b>Tepebaşı</b><small>The modern side of Eskişehir</small></span></div></li>
    </ul>
  </div>
</section>

<section class="sec" aria-labelledby="gal-h">
  <div class="wrap">
    <header class="sec__head sec__head--row">
      <div>
        <p class="label"><?= icon('insta') ?> Instagram</p>
        <h2 id="gal-h" class="h2">@<?= e($cfg['instagram']) ?></h2>
      </div>
      <a class="btn btn--line" href="https://www.instagram.com/<?= e($cfg['instagram']) ?>/" target="_blank" rel="noopener me">Follow <?= icon('arrow-ur') ?></a>
    </header>
    <div class="gal">
      <?php foreach ([1 => 'Opia Coffee Co. dessert counter', 2 => 'Opia Coffee Co. interior', 3 => 'Brewing filter coffee', 4 => 'Coffee beans', 5 => 'Espresso bar', 6 => 'Opia Coffee Co. storefront in Yenibağlar'] as $n => $alt): ?>
      <a class="gal__i" href="https://www.instagram.com/<?= e($cfg['instagram']) ?>/" target="_blank" rel="noopener me" aria-label="Instagram: <?= e($alt) ?>">
        <?= img("galeri-$n", $alt . ', Eskişehir', ['w' => 800, 'h' => 800, 'label' => "galeri-$n / 800×800"]) ?>
      </a>
      <?php endforeach; ?>
    </div>
  </div>
</section>
<?php $content = ob_get_clean();
