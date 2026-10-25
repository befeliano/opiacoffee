<?php
// Blog sayfaları: /blog/ ve /blog/<slug>/ (veri: posts.php)

function post_minutes(array $p): int {
    return max(2, (int)ceil(str_word_count(strip_tags($p['body']), 0, 'çğıöşüÇĞİÖŞÜâÂ’') / 200));
}

function post_date(string $d): string {
    static $ay = ['', 'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
    [$y, $m, $g] = array_map('intval', explode('-', $d));
    return $g . ' ' . $ay[$m] . ' ' . $y;
}

function post_card(array $p): string {
    return '<li class="pcard"><a href="/blog/' . e($p['slug']) . '/">'
        . '<span class="pcard__img">' . img('blog-' . $p['slug'], $p['h1'], ['w' => 1200, 'h' => 750, 'label' => 'blog-' . $p['slug'] . ' / 1200×750']) . '</span>'
        . '<span class="pcard__meta">' . e($p['section']) . ' / ' . post_minutes($p) . ' dk</span>'
        . '<span class="pcard__t">' . e($p['h1']) . '</span>'
        . '<span class="pcard__d">' . e($p['description']) . '</span></a></li>';
}

function post_schema(array $p): array {
    $u = url('/blog/' . $p['slug'] . '/');
    $img = img_src('blog-' . $p['slug'], '', 1200, 750);
    return [
        '@type' => 'BlogPosting', '@id' => $u . '#post', 'mainEntityOfPage' => $u, 'url' => $u,
        'headline' => $p['h1'], 'description' => $p['description'], 'inLanguage' => 'tr-TR',
        'datePublished' => $p['date'] . 'T09:00:00+03:00', 'dateModified' => $p['updated'] . 'T09:00:00+03:00',
        'image' => [$img['real'] ? url($img['src']) : url('/assets/img/og-image.png')],
        'author' => ['@type' => 'Organization', 'name' => cfg('name'), 'url' => url('/')],
        'publisher' => ['@type' => 'Organization', 'name' => cfg('name'), 'logo' => ['@type' => 'ImageObject', 'url' => url('/assets/img/logo-opia.png')]],
        'articleSection' => $p['section'], 'keywords' => implode(', ', $p['keywords']),
        'wordCount' => str_word_count(strip_tags($p['body']), 0, 'çğıöşüÇĞİÖŞÜâÂ’'),
        'about' => ['@id' => url('/#cafe')],
    ];
}

function render_blog_index(array $posts): array {
    $meta = [
        'path' => '/blog/',
        'title' => 'Blog: Kahve Rehberi ve Eskişehir | Opia Coffee Co.',
        'description' => 'Opia Coffee Co. blogu: flat white ve latte farkı, nitelikli kahve, matcha, salep ve Eskişehir Yenibağlar üzerine kısa ve faydalı yazılar.',
        'body' => 'page-blog', 'changefreq' => 'weekly', 'priority' => '0.7',
        'breadcrumb' => [['Ana Sayfa', '/'], ['Blog', '/blog/']],
        'schema' => [[
            '@type' => 'Blog', '@id' => url('/blog/#blog'), 'url' => url('/blog/'), 'name' => 'Opia Coffee Co. Blog', 'inLanguage' => 'tr-TR',
            'publisher' => ['@id' => url('/#cafe')],
            'blogPost' => array_map(fn($p) => ['@type' => 'BlogPosting', 'headline' => $p['h1'], 'url' => url('/blog/' . $p['slug'] . '/'), 'datePublished' => $p['date']], $posts),
        ]],
        'src' => [__DIR__ . '/posts.php', __DIR__ . '/blog.php'],
    ];
    ob_start(); ?>
<section class="phead">
  <div class="wrap">
    <p class="eyebrow">Opia Coffee Co.</p>
    <h1 class="phead__h">Blog</h1>
    <p class="lead">Kahve, demleme, kış içecekleri ve Eskişehir üzerine kısa yazılar. Menüde gördüğün bir içeceği merak ediyorsan buradan başlayabilirsin.</p>
  </div>
</section>
<section class="sec sec--tight">
  <div class="wrap"><ul class="posts"><?php foreach ($posts as $p) echo post_card($p); ?></ul></div>
</section>
<?php return [$meta, ob_get_clean()];
}

function render_post(array $p, array $posts): array {
    $m = menu_data(); $al = allergen_names($m);
    $byId = []; foreach ($m['products'] as $x) $byId[$x['id']] = $x;
    $prods = array_values(array_filter(array_map(fn($id) => $byId[$id] ?? null, $p['products']), fn($x) => $x && $x['available']));
    $others = array_values(array_filter($posts, fn($o) => $o['slug'] !== $p['slug']));
    $path = '/blog/' . $p['slug'] . '/';
    $schema = [post_schema($p)];
    if (!empty($p['faq'])) $schema[] = faq_schema($p['faq']);
    $meta = [
        'path' => $path, 'title' => $p['title'] . ' | Opia', 'description' => $p['description'],
        'og_type' => 'article', 'body' => 'page-post', 'menu_js' => (bool)$prods, 'priority' => '0.6',
        'breadcrumb' => [['Ana Sayfa', '/'], ['Blog', '/blog/'], [$p['h1'], $path]],
        'schema' => $schema, 'lastmod' => strtotime($p['updated'] . ' 09:00'),
    ];
    ob_start(); ?>
<article class="post">
  <header class="phead">
    <div class="wrap narrow">
      <nav class="crumbs" aria-label="Sayfa yolu"><a href="/">Ana Sayfa</a><span aria-hidden="true">/</span><a href="/blog/">Blog</a></nav>
      <p class="eyebrow"><?= e($p['section']) ?> <span class="sep" aria-hidden="true">/</span> <time datetime="<?= e($p['date']) ?>"><?= e(post_date($p['date'])) ?></time> <span class="sep" aria-hidden="true">/</span> <?= post_minutes($p) ?> dk okuma</p>
      <h1 class="phead__h phead__h--sm"><?= e($p['h1']) ?></h1>
      <p class="lead"><?= e($p['lead']) ?></p>
    </div>
  </header>
  <figure class="wrap narrow post__fig"><?= img('blog-' . $p['slug'], $p['h1'] . ', Opia Coffee Co. Eskişehir', ['w' => 1200, 'h' => 750, 'eager' => true, 'label' => 'blog-' . $p['slug'] . ' / 1200×750']) ?></figure>
  <div class="sec sec--tight"><div class="wrap narrow prose post__body"><?= $p['body'] ?></div></div>
</article>

<?php if ($prods): ?>
<section class="sec sec--tint sec--tight" aria-labelledby="menude-h">
  <div class="wrap">
    <header class="sec__head"><p class="label">Menüde</p><h2 id="menude-h" class="h2">Bu yazıdakiler</h2></header>
    <ul class="cards"><?php foreach ($prods as $x) echo product_card($x, $al); ?></ul>
  </div>
</section>
<?= menu_embed($prods, $al) ?>
<?php endif; ?>

<?php if (!empty($p['faq'])): ?>
<section class="sec sec--tight" aria-labelledby="sss-h"><div class="wrap narrow"><h2 id="sss-h" class="h2">Sık sorulanlar</h2><?= faq_html($p['faq']) ?></div></section>
<?php endif; ?>

<section class="sec sec--ink sec--tight">
  <div class="wrap">
    <p class="label label--inv">Diğer yazılar</p>
    <ul class="related"><?php foreach (array_slice($others, 0, 4) as $o): ?><li><a href="/blog/<?= e($o['slug']) ?>/"><?= e($o['h1']) ?> <?= icon('arrow-ur') ?></a></li><?php endforeach; ?></ul>
  </div>
</section>
<?php return [$meta, ob_get_clean()];
}
