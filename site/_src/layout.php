<?php
/** @var array $meta @var string $content */
$cfg = cfg();
$en = lang() === 'en';
$path = $meta['path'];
$canonical = url($path);
$title = $meta['title'];
$desc = $meta['description'];
$ogImg = $meta['og_image'] ?? '/assets/img/og-image.png';
$alt = $meta['alt'] ?? alt_path($path);
$switch = $alt ?? ($en ? '/' : '/en/');
$nav = [
    [lp('/'), t('nav_home')],
    [lp('/menu/'), t('nav_menu')],
    ['/blog/', t('nav_blog') . ($en ? ' (TR)' : '')],
    [lp('/hakkimizda/'), t('nav_about')],
    [lp('/iletisim/'), t('nav_contact')],
];
$isActive = fn($p) => $p === $path ? ' aria-current="page"' : '';
$inLang = $en ? 'en' : 'tr-TR';

$graph = [
    ['@type' => 'WebSite', '@id' => url('/#website'), 'url' => url('/'), 'name' => $cfg['name'], 'inLanguage' => ['tr-TR', 'en'],
        'publisher' => ['@id' => url('/#cafe')]],
    ['@type' => 'WebPage', '@id' => $canonical . '#webpage', 'url' => $canonical, 'name' => $title, 'description' => $desc,
        'isPartOf' => ['@id' => url('/#website')], 'inLanguage' => $inLang,
        'about' => ['@id' => url('/#cafe')],
        'primaryImageOfPage' => ['@type' => 'ImageObject', 'url' => url($ogImg)]],
];
if (!empty($meta['business'])) $graph[] = business_schema();
if (!empty($meta['breadcrumb'])) $graph[] = breadcrumb_schema($meta['breadcrumb']);
foreach ($meta['schema'] ?? [] as $s) $graph[] = $s;
$trUrl = $en ? ($alt ? url($alt) : null) : $canonical;
$enUrl = $en ? $canonical : ($alt ? url($alt) : null);
?><!doctype html>
<html lang="<?= $en ? 'en' : 'tr' ?>">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title><?= e($title) ?></title>
<meta name="description" content="<?= e($desc) ?>">
<link rel="canonical" href="<?= e($canonical) ?>">
<meta name="robots" content="<?= e($meta['robots'] ?? 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1') ?>">
<meta name="theme-color" content="<?= e($cfg['theme_color']) ?>">
<meta name="color-scheme" content="light">
<meta name="format-detection" content="telephone=no">
<?php if (!empty($cfg['gsc_verify'])): ?><meta name="google-site-verification" content="<?= e($cfg['gsc_verify']) ?>">
<?php endif; ?><meta name="geo.region" content="TR-26">
<meta name="geo.placename" content="Yenibağlar, Tepebaşı, Eskişehir">
<meta name="geo.position" content="<?= $cfg['geo']['lat'] ?>;<?= $cfg['geo']['lng'] ?>">
<meta name="ICBM" content="<?= $cfg['geo']['lat'] ?>, <?= $cfg['geo']['lng'] ?>">
<meta property="og:type" content="<?= e($meta['og_type'] ?? 'website') ?>">
<meta property="og:site_name" content="<?= e($cfg['name']) ?>">
<meta property="og:locale" content="<?= $en ? 'en_US' : 'tr_TR' ?>">
<?php if ($alt): ?><meta property="og:locale:alternate" content="<?= $en ? 'tr_TR' : 'en_US' ?>">
<?php endif; ?><meta property="og:title" content="<?= e($title) ?>">
<meta property="og:description" content="<?= e($desc) ?>">
<meta property="og:url" content="<?= e($canonical) ?>">
<meta property="og:image" content="<?= e(url($ogImg)) ?>">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="<?= e(t('og_alt')) ?>">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="<?= e($title) ?>">
<meta name="twitter:description" content="<?= e($desc) ?>">
<meta name="twitter:image" content="<?= e(url($ogImg)) ?>">
<?php if ($trUrl): ?><link rel="alternate" hreflang="tr-TR" href="<?= e($trUrl) ?>">
<?php endif; ?><?php if ($enUrl): ?><link rel="alternate" hreflang="en" href="<?= e($enUrl) ?>">
<?php endif; ?><link rel="alternate" hreflang="x-default" href="<?= e($trUrl ?? $canonical) ?>">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/assets/img/logo-opia.png" type="image/png" sizes="225x225">
<link rel="apple-touch-icon" href="/assets/img/logo-opia.png">
<link rel="manifest" href="/manifest.webmanifest">
<link rel="preload" href="/assets/fonts/oswald-normal-200-700-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/assets/fonts/barlow-normal-400-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="<?= asset('/assets/css/fonts.css') ?>">
<link rel="stylesheet" href="<?= asset('/assets/css/main.css') ?>">
<?= ld(['@context' => 'https://schema.org', '@graph' => $graph]) ?>

</head>
<body class="<?= e($meta['body'] ?? '') ?>" data-ga="<?= e($cfg['ga_id'] ?? '') ?>">
<a class="skip" href="#icerik"><?= e(t('skip')) ?></a>

<header class="hdr" id="top">
  <div class="hdr__in">
    <button class="burger" type="button" aria-label="<?= e(t('menu_open')) ?>" aria-expanded="false" aria-controls="drawer"><span></span><span></span></button>
    <nav class="nav nav--l" aria-label="<?= e(t('nav_main')) ?>">
      <a href="<?= lp('/menu/') ?>"<?= $isActive(lp('/menu/')) ?>><?= e(t('nav_menu')) ?></a>
      <?php if ($en): ?><a href="<?= lp('/hakkimizda/') ?>"<?= $isActive(lp('/hakkimizda/')) ?>><?= e(t('nav_about')) ?></a>
      <?php else: ?><a href="/blog/"<?= str_starts_with($path, '/blog/') ? ' aria-current="page"' : '' ?>><?= e(t('nav_blog')) ?></a><?php endif; ?>
    </nav>
    <a class="logo" href="<?= lp('/') ?>" aria-label="<?= e(t('home_aria')) ?>">
      <span class="logo__a">OPIA</span><span class="logo__b">COFFEE CO</span>
    </a>
    <nav class="nav nav--r" aria-label="<?= e(t('nav_second')) ?>">
      <?php if (!$en): ?><a href="/hakkimizda/"<?= $isActive('/hakkimizda/') ?>><?= e(t('nav_about')) ?></a><?php endif; ?>
      <a href="<?= lp('/iletisim/') ?>"<?= $isActive(lp('/iletisim/')) ?>><?= e(t('nav_contact')) ?></a>
    </nav>
    <div class="hdr__r">
      <a class="hdr__lang" href="<?= e($switch) ?>" hreflang="<?= $en ? 'tr' : 'en' ?>" lang="<?= $en ? 'tr' : 'en' ?>" aria-label="<?= e(t('lang_aria')) ?>" data-lang-switch><?= e(t('lang_code')) ?></a>
      <a class="hdr__go" href="<?= e(maps_dir_url()) ?>" target="_blank" rel="noopener" aria-label="<?= e(t('directions')) ?>"><?= icon('pin') ?></a>
    </div>
  </div>
</header>

<div class="drawer" id="drawer" hidden>
  <nav aria-label="<?= e(t('nav_mobile')) ?>">
    <?php foreach ($nav as $i => [$href, $label]): ?>
    <a href="<?= $href ?>"<?= $isActive($href) ?> style="--i:<?= $i ?>"><span><?= e($label) ?></span></a>
    <?php endforeach; ?>
  </nav>
  <div class="drawer__foot">
    <p><?= e(address_line()) ?></p>
    <p><?= e(t('everyday')) ?> <?= e($cfg['hours']['open']) ?> - 00:00</p>
    <a href="https://www.instagram.com/<?= e($cfg['instagram']) ?>/" target="_blank" rel="noopener me">@<?= e($cfg['instagram']) ?></a>
    <a href="<?= e($switch) ?>" hreflang="<?= $en ? 'tr' : 'en' ?>" lang="<?= $en ? 'tr' : 'en' ?>" data-lang-switch><?= e(t('lang_other')) ?></a>
  </div>
</div>

<main id="icerik">
<?= $content ?>
</main>

<footer class="ftr">
  <div class="wrap ftr__grid">
    <div class="ftr__brand">
      <a class="logo logo--lg" href="<?= lp('/') ?>" aria-label="Opia Coffee Co.">
        <span class="logo__a">OPIA</span><span class="logo__b">COFFEE CO</span>
      </a>
      <p><?= e(t('tagline')) ?>.</p>
      <p class="ftr__open" data-open-status><?= e(t('everyday')) ?> <?= e($cfg['hours']['open']) ?> - 00:00</p>
    </div>
    <div>
      <h2 class="ftr__h"><?= e(t('f_address')) ?></h2>
      <address>
        <?= e($cfg['address']['hood']) ?><br>
        <?= e($cfg['address']['street']) ?><br>
        <?= e($cfg['address']['district']) ?> / <?= e($cfg['address']['city']) ?> <?= e($cfg['address']['zip']) ?>
      </address>
      <p><a class="ulink" href="<?= e(maps_dir_url()) ?>" target="_blank" rel="noopener"><?= e(t('directions')) ?></a></p>
      <?php if ($cfg['phone']): ?><p><a class="ulink" href="tel:<?= e(preg_replace('/\s+/', '', $cfg['phone'])) ?>"><?= e($cfg['phone']) ?></a></p><?php endif; ?>
      <?php if ($cfg['email']): ?><p><a class="ulink" href="mailto:<?= e($cfg['email']) ?>"><?= e($cfg['email']) ?></a></p><?php endif; ?>
    </div>
    <div>
      <h2 class="ftr__h"><?= e(t('f_explore')) ?></h2>
      <ul class="ftr__list">
        <li><a href="<?= lp('/menu/') ?>"><?= e(t('nav_menu')) ?></a></li>
        <li><a href="<?= lp('/hakkimizda/') ?>"><?= e(t('nav_about')) ?></a></li>
        <li><a href="<?= lp('/iletisim/') ?>"><?= e(t('nav_contact')) ?></a></li>
        <?php if ($en): ?>
        <li><a href="/" hreflang="tr" lang="tr">Türkçe</a></li>
        <?php else: ?>
        <li><a href="/blog/">Blog</a></li>
        <li><a href="/eskisehir-nitelikli-kahve/"><?= e(t('local_1')) ?></a></li>
        <li><a href="/yenibaglar-kafe/"><?= e(t('local_2')) ?></a></li>
        <li><a href="/anadolu-universitesi-yakini-kafe/"><?= e(t('local_3')) ?></a></li>
        <li><a href="/hava-muzesi-yakini-kafe/"><?= e(t('local_4')) ?></a></li>
        <li><a href="/en/" hreflang="en" lang="en">English</a></li>
        <?php endif; ?>
      </ul>
    </div>
    <div>
      <h2 class="ftr__h"><?= e(t('f_legal')) ?></h2>
      <ul class="ftr__list">
        <li><a href="<?= lp('/kvkk-aydinlatma-metni/') ?>"><?= e(t('l_kvkk')) ?></a></li>
        <li><a href="<?= lp('/gizlilik-politikasi/') ?>"><?= e(t('l_privacy')) ?></a></li>
        <li><a href="<?= lp('/cerez-politikasi/') ?>"><?= e(t('l_cookies')) ?></a></li>
        <li><a href="<?= lp('/kullanim-kosullari/') ?>"><?= e(t('l_terms')) ?></a></li>
        <li><button type="button" class="linkbtn" data-consent-open><?= e(t('l_prefs')) ?></button></li>
      </ul>
      <p class="ftr__social"><a href="https://www.instagram.com/<?= e($cfg['instagram']) ?>/" target="_blank" rel="noopener me"><?= icon('insta') ?> @<?= e($cfg['instagram']) ?></a></p>
    </div>
  </div>
  <div class="wrap ftr__bar">
    <span>© <?= date('Y') ?> <?= e($cfg['name']) ?> <?= e(t('rights')) ?></span>
    <span><?= e(t('f_loc')) ?></span>
  </div>
</footer>

<dialog class="pm" id="product-modal" aria-labelledby="pm-title">
  <div class="pm__sheet" data-modal-sheet>
    <button class="pm__x" type="button" data-close aria-label="<?= e(t('close')) ?>"><?= icon('close') ?></button>
    <div class="pm__img" data-pm-img></div>
    <div class="pm__body">
      <p class="pm__eyebrow" data-pm-eyebrow></p>
      <h2 class="pm__title" id="pm-title" data-pm-title></h2>
      <p class="pm__desc" data-pm-desc></p>
      <p class="pm__price" data-pm-price></p>
      <div class="pm__order" data-pm-order hidden></div>
      <div class="pm__blk">
        <h3><?= e(t('allergens')) ?></h3>
        <ul class="chips" data-pm-allergens></ul>
      </div>
      <div class="pm__blk">
        <div class="pm__nutr-head">
          <h3><?= e(t('nutrition')) ?></h3>
          <label class="sel"><span class="sr"><?= e(t('serving')) ?></span>
            <select data-pm-serving></select>
          </label>
        </div>
        <table class="nutr" data-pm-nutr>
          <tbody></tbody>
        </table>
        <p class="pm__note"><?= e(t('nutr_note')) ?></p>
      </div>
    </div>
  </div>
</dialog>

<div class="cc" id="cc" role="dialog" aria-modal="false" aria-labelledby="cc-t" hidden>
  <div class="cc__in">
    <h2 id="cc-t"><?= e(t('cc_t')) ?></h2>
    <p><?= e(t('cc_text')) ?> <a href="<?= lp('/cerez-politikasi/') ?>"><?= e(t('l_cookies')) ?></a>.</p>
    <div class="cc__btns">
      <button type="button" class="btn btn--line" data-cc="reject"><?= e(t('cc_reject')) ?></button>
      <button type="button" class="btn btn--line" data-cc="prefs"><?= e(t('cc_prefs')) ?></button>
      <button type="button" class="btn" data-cc="accept"><?= e(t('cc_accept')) ?></button>
    </div>
  </div>
</div>

<dialog class="ccp" id="ccp" aria-labelledby="ccp-t">
  <form method="dialog" class="ccp__in">
    <h2 id="ccp-t"><?= e(t('ccp_t')) ?></h2>
    <div class="ccp__row"><div><strong><?= e(t('ccp_nec')) ?></strong><p><?= e(t('ccp_nec_d')) ?></p></div><input type="checkbox" checked disabled aria-label="<?= e(t('ccp_nec')) ?>"></div>
    <div class="ccp__row"><div><strong><?= e(t('ccp_an')) ?></strong><p><?= e(t('ccp_an_d')) ?></p></div><label class="sw"><input type="checkbox" id="cc-an"><i></i><span class="sr"><?= e(t('ccp_an')) ?></span></label></div>
    <div class="ccp__row"><div><strong><?= e(t('ccp_tp')) ?></strong><p><?= e(t('ccp_tp_d')) ?></p></div><label class="sw"><input type="checkbox" id="cc-tp"><i></i><span class="sr"><?= e(t('ccp_tp')) ?></span></label></div>
    <div class="cc__btns">
      <button type="button" class="btn btn--line" data-ccp="reject"><?= e(t('cc_reject')) ?></button>
      <button type="button" class="btn" data-ccp="save"><?= e(t('ccp_save')) ?></button>
    </div>
  </form>
</dialog>

<script src="<?= asset('/assets/js/consent.js') ?>" defer></script>
<script src="<?= asset('/assets/js/main.js') ?>" defer></script>
<?php if (!empty($meta['menu_js'])): ?><script src="<?= asset('/assets/js/menu.js') ?>" defer></script><?php endif; ?>
</body>
</html>
