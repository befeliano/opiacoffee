<?php
$m = menu_data();
$al = allergen_names($m);
$season = seasonal_products($m);
$s = $m['settings']['season'];
$cats = $m['categories'];
usort($cats, fn($a, $b) => $a['sort'] <=> $b['sort']);
$all = array_values(array_filter($m['products'], fn($p) => $p['available']));

$meta = [
    'path' => '/menu/',
    'title' => 'Menü | Opia Coffee Co. Yenibağlar Eskişehir',
    'description' => 'Opia Coffee Co. menüsü: espresso bazlı içecekler, filtre kahve, Matcha Bar, sıcak çikolata, kışa özel içecekler ve tatlılar. Alerjen ve kalori bilgili.',
    'menu_js' => true,
    'body' => 'page-menu',
    'breadcrumb' => [['Ana Sayfa', '/'], ['Menü', '/menu/']],
    'schema' => [menu_schema($m)],
];

ob_start(); ?>
<section class="phead">
  <div class="wrap">
    <p class="eyebrow">Opia Coffee Co. / Yenibağlar</p>
    <h1 class="phead__h">Menü</h1>
    <p class="lead">Kahve, matcha, sıcak çikolata ve tatlılar. Bir ürüne dokun; alerjen ve besin değerlerini, porsiyon seçerek gör.</p>
  </div>
</section>

<section class="mtools" aria-label="Menü araçları">
  <div class="wrap mtools__in">
    <label class="search"><span class="sr">Menüde ara</span><?= icon('search') ?>
      <input type="search" id="menu-search" placeholder="Menüde ara" autocomplete="off" enterkeyhint="search">
    </label>
    <nav class="cats" aria-label="Kategoriler">
      <?php if ($season): ?><a href="#mevsim" data-cat="mevsim"><?= e($s['title']) ?></a><?php endif; ?>
      <?php foreach ($cats as $c): if (!array_filter(products_in($m, $c['id']), fn($p) => empty($p['seasonal']))) continue; ?>
      <a href="#<?= e($c['id']) ?>" data-cat="<?= e($c['id']) ?>"><?= e($c['name']) ?></a>
      <?php endforeach; ?>
    </nav>
    <details class="afilter">
      <summary>Alerjen filtresi <span class="afilter__n" data-afilter-n hidden></span></summary>
      <div class="afilter__panel"><p class="afilter__help">Seçtiğin alerjenleri içeren ürünleri gizler.</p>
      <ul class="afilter__list">
        <?php foreach ($m['allergens'] as $a): if (!array_filter($all, fn($p) => in_array($a['id'], $p['allergens'], true))) continue; ?>
        <li><label><input type="checkbox" value="<?= e($a['id']) ?>"><span><?= e($a['name']) ?></span></label></li>
        <?php endforeach; ?>
      </ul>
      <button type="button" class="linkbtn" data-afilter-clear>Filtreyi temizle</button></div>
    </details>
  </div>
</section>

<div class="wrap menu" id="menu-root">
  <?php if ($season): ?>
  <section class="msec msec--season" id="mevsim" data-section aria-labelledby="h-mevsim">
    <header class="msec__head">
      <h2 id="h-mevsim"><?= e($s['title']) ?></h2>
      <p><?= e($s['label']) ?>: <?= e($s['subtitle']) ?></p>
    </header>
    <ul class="rows">
      <?php foreach ($season as $p) echo product_row($p, $al); ?>
    </ul>
  </section>
  <?php endif; ?>

  <?php foreach ($cats as $c): $items = array_values(array_filter(products_in($m, $c['id']), fn($p) => empty($p['seasonal']))); if (!$items) continue; ?>
  <section class="msec" id="<?= e($c['id']) ?>" data-section aria-labelledby="h-<?= e($c['id']) ?>">
    <header class="msec__head">
      <h2 id="h-<?= e($c['id']) ?>"><?= e($c['name']) ?></h2>
      <?php if (!empty($c['note'])): ?><p><?= e($c['note']) ?></p><?php endif; ?>
    </header>
    <ul class="rows">
      <?php foreach ($items as $p) echo product_row($p, $al); ?>
    </ul>
  </section>
  <?php endforeach; ?>

  <p class="menu__empty" id="menu-empty" hidden>Aramana uyan ürün bulunamadı. Filtreyi ya da aramayı temizlemeyi dene.</p>

  <aside class="menu__note">
    <h2>Alerji ve beslenme notu</h2>
    <p>Mutfağımızda gluten, süt, yumurta, yer fıstığı ve sert kabuklu yemişler birlikte kullanılır; çapraz bulaşma olabilir. Kalori ve besin değerleri tahminî olup tarif ve hazırlanışa göre değişebilir. Hassasiyetin varsa sipariş verirken bize söyle. Fiyatlara KDV dahildir.</p>
  </aside>
</div>
<?= menu_embed($all, $al) ?>
<?php $content = ob_get_clean();
