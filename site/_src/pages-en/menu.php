<?php
$m = menu_data();
$al = allergen_names($m);
$season = seasonal_products($m);
$s = $m['settings']['season'];
$cats = $m['categories'];
usort($cats, fn($a, $b) => $a['sort'] <=> $b['sort']);
$all = array_values(array_filter($m['products'], fn($p) => $p['available']));

$meta = [
    'path' => '/en/menu/',
    'title' => 'Menu | Opia Coffee Co. Eskişehir',
    'description' => 'Opia Coffee Co. menu: espresso drinks, filter coffee, Matcha Bar, hot chocolate, winter specials and desserts, with allergens and calories.',
    'menu_js' => true,
    'body' => 'page-menu',
    'breadcrumb' => [['Home', '/en/'], ['Menu', '/en/menu/']],
    'schema' => [menu_schema($m)],
];

ob_start(); ?>
<section class="phead">
  <div class="wrap">
    <p class="eyebrow">Opia Coffee Co. / Yenibağlar</p>
    <h1 class="phead__h">Menu</h1>
    <p class="lead">Coffee, matcha, hot chocolate and desserts. Tap an item to see allergens and nutrition for each serving.</p>
  </div>
</section>

<section class="mtools" aria-label="Menu tools">
  <div class="wrap mtools__in">
    <label class="search"><span class="sr">Search the menu</span><?= icon('search') ?>
      <input type="search" id="menu-search" placeholder="Search the menu" autocomplete="off" enterkeyhint="search">
    </label>
    <nav class="cats" aria-label="Categories">
      <?php if ($season): ?><a href="#mevsim" data-cat="mevsim"><?= e(season_txt($s, 'title')) ?></a><?php endif; ?>
      <?php foreach ($cats as $c): if (!array_filter(products_in($m, $c['id']), fn($p) => empty($p['seasonal']))) continue; ?>
      <a href="#<?= e($c['id']) ?>" data-cat="<?= e($c['id']) ?>"><?= e(cn($c)) ?></a>
      <?php endforeach; ?>
    </nav>
    <details class="afilter">
      <summary>Allergen filter <span class="afilter__n" data-afilter-n hidden></span></summary>
      <div class="afilter__panel"><p class="afilter__help">Hides items that contain the allergens you select.</p>
      <ul class="afilter__list">
        <?php foreach ($m['allergens'] as $a): if (!array_filter($all, fn($p) => in_array($a['id'], $p['allergens'], true))) continue; ?>
        <li><label><input type="checkbox" value="<?= e($a['id']) ?>"><span><?= e($a['name_en'] ?? $a['name']) ?></span></label></li>
        <?php endforeach; ?>
      </ul>
      <button type="button" class="linkbtn" data-afilter-clear>Clear filter</button></div>
    </details>
  </div>
</section>

<div class="wrap menu" id="menu-root">
  <?php if ($season): ?>
  <section class="msec msec--season" id="mevsim" data-section aria-labelledby="h-mevsim">
    <header class="msec__head">
      <h2 id="h-mevsim"><?= e(season_txt($s, 'title')) ?></h2>
      <p><?= e(season_txt($s, 'label')) ?>: <?= e(season_txt($s, 'subtitle')) ?></p>
    </header>
    <ul class="rows">
      <?php foreach ($season as $p) echo product_row($p, $al); ?>
    </ul>
  </section>
  <?php endif; ?>

  <?php foreach ($cats as $c): $items = array_values(array_filter(products_in($m, $c['id']), fn($p) => empty($p['seasonal']))); if (!$items) continue; ?>
  <section class="msec" id="<?= e($c['id']) ?>" data-section aria-labelledby="h-<?= e($c['id']) ?>">
    <header class="msec__head">
      <h2 id="h-<?= e($c['id']) ?>"><?= e(cn($c)) ?></h2>
      <?php if (cnote($c)): ?><p><?= e(cnote($c)) ?></p><?php endif; ?>
    </header>
    <ul class="rows">
      <?php foreach ($items as $p) echo product_row($p, $al); ?>
    </ul>
  </section>
  <?php endforeach; ?>

  <p class="menu__empty" id="menu-empty" hidden>No items match your search. Try clearing the filter or the search.</p>

  <aside class="menu__note">
    <h2>Allergy and nutrition note</h2>
    <p>Gluten, milk, egg, peanuts and tree nuts are all used in our kitchen, so cross-contamination is possible. Calories and nutrition values are estimates and may vary with the recipe and preparation. Please tell us about any allergy when you order. Prices are in Turkish lira and include VAT.</p>
  </aside>
</div>
<?= menu_embed($all, $al) ?>
<?php $content = ob_get_clean();
