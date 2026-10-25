<?php
/**
 * Opia statik site derleyicisi.
 *   php _src/build.php          -> tüm sayfaları, sitemap.xml, robots.txt ve manifest'i üretir
 * Yönetim paneli menüyü her kaydettiğinde de opia_build() çağırır (menü SEO için statik HTML'e işlenir).
 */
require_once __DIR__ . '/lib.php';
require_once __DIR__ . '/blog.php';

function render_page(array $meta, string $content): string {
    ob_start();
    require __DIR__ . '/layout.php';
    return lang_wrap(ob_get_clean());
}

function render_local(array $d, array $all): array {
    $m = menu_data();
    $al = allergen_names($m);
    $featured = array_slice(array_values(array_filter($m['products'], fn($p) => $p['available'] && $p['featured'])), 0, 3);
    $path = '/' . $d['slug'] . '/';
    $meta = [
        'path' => $path, 'title' => $d['title'], 'description' => $d['description'],
        'body' => 'page-local', 'menu_js' => true, 'business' => true,
        'breadcrumb' => [['Ana Sayfa', '/'], [$d['h1'], $path]],
        'schema' => [faq_schema($d['faq'])],
        'priority' => '0.7',
    ];
    ob_start(); ?>
<section class="phead phead--local">
  <div class="wrap phead__grid">
    <div>
      <nav class="crumbs" aria-label="Sayfa yolu"><a href="/">Ana Sayfa</a><span aria-hidden="true">/</span><span><?= e($d['h1']) ?></span></nav>
      <p class="eyebrow"><?= icon($d['icon']) ?> Opia Coffee Co. / Yenibağlar, Eskişehir</p>
      <h1 class="phead__h phead__h--sm"><?= e($d['h1']) ?></h1>
      <p class="lead"><?= e($d['lead']) ?></p>
      <div class="hero__cta">
        <a class="btn" href="/menu/">Menüyü gör <?= icon('arrow') ?></a>
        <a class="btn btn--line" href="<?= e(maps_dir_url()) ?>" target="_blank" rel="noopener"><?= icon('pin') ?> Yol tarifi</a>
      </div>
    </div>
    <figure class="phead__fig"><?= img($d['image'], $d['h1'] . ', Opia Coffee Co. Eskişehir', ['w' => 1200, 'h' => 900, 'eager' => true, 'label' => $d['image'] . ' / 1200×900']) ?></figure>
  </div>
</section>

<section class="sec sec--tight">
  <div class="wrap narrow prose">
    <?php foreach ($d['sections'] as [$h, $html]): ?>
    <h2><?= e($h) ?></h2>
    <?= $html ?>
    <?php endforeach; ?>
  </div>
</section>

<?php if ($featured): ?>
<section class="sec sec--tint sec--tight" aria-labelledby="oner-h">
  <div class="wrap">
    <header class="sec__head"><p class="label">Menüden</p><h2 id="oner-h" class="h2">Sevilenler</h2></header>
    <ul class="cards cards--3"><?php foreach ($featured as $p) echo product_card($p, $al); ?></ul>
    <p class="sec__more"><a class="ulink" href="/menu/">Tüm menüyü gör <?= icon('arrow') ?></a></p>
  </div>
</section>
<?= menu_embed($featured, $al) ?>
<?php endif; ?>

<section class="sec sec--tight" aria-labelledby="sss-h">
  <div class="wrap narrow">
    <h2 id="sss-h" class="h2">Sık sorulanlar</h2>
    <?= faq_html($d['faq']) ?>
  </div>
</section>

<section class="sec sec--ink sec--tight">
  <div class="wrap">
    <p class="label label--inv">Diğer yerel rehberler</p>
    <ul class="related">
      <?php foreach ($all as $o): if ($o['slug'] === $d['slug']) continue; ?>
      <li><a href="/<?= e($o['slug']) ?>/"><?= e($o['h1']) ?> <?= icon('arrow-ur') ?></a></li>
      <?php endforeach; ?>
    </ul>
  </div>
</section>
<?php return [$meta, ob_get_clean()];
}

function write_file(string $rel, string $data): void {
    $f = OPIA_ROOT . '/' . ltrim($rel, '/');
    @mkdir(dirname($f), 0775, true);
    if (!is_file($f) || file_get_contents($f) !== $data) file_put_contents($f, $data);
}

function opia_build(): array {
    $pages = [];   // path => [meta, content]
    $report = [];

    $files = array_merge(array_map(fn($f) => ['tr', $f], glob(__DIR__ . '/pages/*.php')), array_map(fn($f) => ['en', $f], glob(__DIR__ . '/pages-en/*.php') ?: []));
    foreach ($files as [$lng, $file]) {
        lang($lng);
        $meta = null; $content = '';
        (function () use ($file, &$meta, &$content) { require $file; })();
        if (!$meta) continue;
        $meta['src'] ??= [$file];
        $meta['lang'] = $lng;
        $pages[$meta['path']] = [$meta, $content];
    }
    lang('tr');
    $locals = require __DIR__ . '/locals.php';
    foreach ($locals as $d) {
        [$meta, $content] = render_local($d, $locals);
        $meta['src'] = [__DIR__ . '/locals.php', OPIA_ROOT . '/data/menu.json'];
        $pages[$meta['path']] = [$meta, $content];
    }
    $posts = require __DIR__ . '/posts.php';
    usort($posts, fn($a, $b) => strcmp($b['date'], $a['date']));
    [$meta, $content] = render_blog_index($posts);
    $pages['/blog/'] = [$meta, $content];
    foreach ($posts as $p) {
        [$meta, $content] = render_post($p, $posts);
        $pages[$meta['path']] = [$meta, $content];
    }

    $sitemap = [];
    foreach ($pages as $path => [$meta, $content]) {
        lang($meta['lang'] ?? 'tr');
        $html = render_page($meta, $content);
        $out = $path === '/' ? 'index.html' : trim($path, '/') . '/index.html';
        write_file($out, $html);
        $report[] = $out;
        // lastmod: sayfanın kendi kaynak dosyaları (+ menüye bağlı sayfalarda menu.json); blog yazısında güncelleme tarihi
        $deps = $meta['src'] ?? [];
        if (!empty($meta['menu_js']) && empty($meta['lastmod'])) $deps[] = OPIA_ROOT . '/data/menu.json';
        $srcMtime = $meta['lastmod'] ?? max(array_map(fn($f) => is_file($f) ? filemtime($f) : 0, $deps ?: [__DIR__ . '/layout.php']));
        $sitemap[] = [
            'loc' => url($path),
            'lastmod' => date('c', $srcMtime),
            'changefreq' => $meta['changefreq'] ?? ($path === '/' || $path === '/menu/' ? 'weekly' : 'monthly'),
            'priority' => $meta['priority'] ?? ($path === '/' ? '1.0' : (in_array($path, ['/menu/', '/iletisim/'], true) ? '0.9' : '0.8')),
            'img' => $path === '/' ? img_src('hero', '', 1000, 1250)['real'] : false,
        ];
    }

    // 404
    lang('tr');
    $meta404 =['path' => '/404.html', 'title' => 'Sayfa bulunamadı | Opia Coffee Co.', 'description' => 'Aradığın sayfa bulunamadı. Opia Coffee Co. ana sayfasına ya da menüye dönebilir, Yenibağlar’daki kahve dükkânımızı keşfedebilirsin.',
        'robots' => 'noindex, follow', 'body' => 'page-404'];
    ob_start(); ?>
<section class="phead"><div class="wrap">
  <p class="eyebrow">404</p>
  <h1 class="phead__h">Sayfa <em>bulunamadı</em></h1>
  <p class="lead">Aradığın sayfa taşınmış ya da hiç var olmamış olabilir. Bir fincan kahveyle yeniden başlayalım.</p>
  <div class="hero__cta"><a class="btn" href="/">Ana sayfa</a><a class="btn btn--line" href="/menu/">Menü</a></div>
</div></section>
<?php write_file('404.html', render_page($meta404, ob_get_clean()));

    // sitemap.xml
    $x = '<?xml version="1.0" encoding="UTF-8"?>' . "\n"
       . '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">' . "\n";
    foreach ($sitemap as $s) {
        $x .= "  <url>\n    <loc>" . e($s['loc']) . "</loc>\n    <lastmod>{$s['lastmod']}</lastmod>\n    <changefreq>{$s['changefreq']}</changefreq>\n    <priority>{$s['priority']}</priority>\n";
        if ($s['img']) $x .= "    <image:image><image:loc>" . e(url(img_src('hero')['src'])) . "</image:loc></image:image>\n";
        $x .= "  </url>\n";
    }
    write_file('sitemap.xml', $x . "</urlset>\n");

    write_file('robots.txt', "User-agent: *\nAllow: /\nDisallow: /admin/\nDisallow: /api/\nDisallow: /_src/\nDisallow: /_private/\nDisallow: /masa/\nDisallow: /m/\n\nSitemap: " . url('/sitemap.xml') . "\n");

    write_file('manifest.webmanifest', json_encode([
        'name' => cfg('name'), 'short_name' => 'Opia', 'description' => cfg('tagline'),
        'start_url' => '/', 'scope' => '/', 'display' => 'standalone', 'lang' => 'tr',
        'background_color' => '#ffffff', 'theme_color' => cfg('theme_color'),
        'icons' => [['src' => '/assets/img/logo-opia.png', 'sizes' => '225x225', 'type' => 'image/png', 'purpose' => 'any']],
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT));

    return $report;
}

if (PHP_SAPI === 'cli' && realpath($_SERVER['SCRIPT_FILENAME'] ?? '') === __FILE__) {
    $r = opia_build();
    echo count($r) . " sayfa üretildi:\n  " . implode("\n  ", $r) . "\n";
}
