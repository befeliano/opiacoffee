<?php
/**
 * SEO denetimi: derlenmiş HTML'i tarar ve puanlı rapor üretir.
 *   php tools/seo-audit.php            -> konsol raporu (+ docs/seo-report.md)
 * Hata (✗) varsa çıkış kodu 1 olur; CI / yayın öncesi kapı olarak kullanılabilir.
 */
$root = realpath(__DIR__ . '/../site');
$cfg = require $root . '/_src/config.php';
$base = rtrim($cfg['url'], '/');

$pages = [];
foreach (new RecursiveIteratorIterator(new RecursiveDirectoryIterator($root, FilesystemIterator::SKIP_DOTS)) as $f) {
    $rel = str_replace('\\', '/', substr($f->getPathname(), strlen($root)));
    if (preg_match('#^/(_src|_private|admin|api|assets|uploads|data)/#', $rel)) continue;
    if (basename($rel) === 'index.html' || $rel === '/404.html') $pages[$rel] = file_get_contents($f->getPathname());
}
ksort($pages);

$results = []; $titles = []; $descs = [];
$err = $warn = $okc = 0;
$add = function (string $page, string $lvl, string $msg) use (&$results, &$err, &$warn, &$okc) {
    $results[$page][] = [$lvl, $msg];
    if ($lvl === 'ERR') $err++; elseif ($lvl === 'WARN') $warn++; else $okc++;
};

$sitemap = is_file("$root/sitemap.xml") ? file_get_contents("$root/sitemap.xml") : '';
$robots = is_file("$root/robots.txt") ? file_get_contents("$root/robots.txt") : '';

foreach ($pages as $rel => $html) {
    $url = $rel === '/404.html' ? '/404.html' : ($rel === '/index.html' ? '/' : preg_replace('#index\.html$#', '', $rel));
    $doc = new DOMDocument(); @$doc->loadHTML('<?xml encoding="utf-8"?>' . $html);
    $x = new DOMXPath($doc);
    $q = fn($e) => $x->query($e);
    $noindex = (bool)preg_match('/<meta name="robots" content="[^"]*noindex/i', $html);

    // title
    $t = trim($q('//title')->item(0)?->textContent ?? '');
    $len = mb_strlen($t);
    if (!$t) $add($url, 'ERR', 'title yok');
    elseif ($len > 62) $add($url, 'WARN', "title uzun ($len > 62): $t");
    elseif ($len < 25) $add($url, 'WARN', "title kısa ($len)");
    else $add($url, 'OK', "title $len karakter");
    $titles[$t][] = $url;

    // description
    $d = trim($q('//meta[@name="description"]/@content')->item(0)?->nodeValue ?? '');
    $dl = mb_strlen($d);
    if (!$d) $add($url, 'ERR', 'meta description yok');
    elseif ($dl > 165) $add($url, 'WARN', "description uzun ($dl > 165)");
    elseif ($dl < 70) $add($url, 'WARN', "description kısa ($dl)");
    else $add($url, 'OK', "description $dl karakter");
    $descs[$d][] = $url;

    // canonical
    $c = $q('//link[@rel="canonical"]/@href')->item(0)?->nodeValue ?? '';
    $want = $base . $url;
    if (!$c) $add($url, 'ERR', 'canonical yok');
    elseif ($c !== $want) $add($url, $url === '/404.html' ? 'OK' : 'ERR', "canonical beklenen değil: $c ≠ $want");
    else $add($url, 'OK', 'canonical doğru');

    // h1 / başlık hiyerarşisi
    $h1 = $q('//h1');
    if ($h1->length !== 1) $add($url, 'ERR', "h1 sayısı {$h1->length} (1 olmalı)");
    else $add($url, 'OK', 'tek h1: ' . trim(preg_replace('/\s+/', ' ', $h1->item(0)->textContent)));
    $prev = 1; foreach ($q('//h1|//h2|//h3|//h4') as $h) { $lv = (int)$h->nodeName[1]; if ($lv > $prev + 1) { $add($url, 'WARN', "başlık atlaması h$prev → h$lv"); break; } $prev = $lv; }

    // html lang, viewport
    $wantLang = str_starts_with($url, '/en/') ? 'en' : 'tr';
    if (!preg_match('/<html lang="' . $wantLang . '"/', $html)) $add($url, 'ERR', 'html lang="' . $wantLang . '" yok');
    // hreflang: karşı dildeki sayfa var olmalı ve bu sayfaya geri bağlanmalı
    foreach ($q('//link[@rel="alternate"][@hreflang!="x-default"]/@href') as $hl) {
        $altPath = substr($hl->nodeValue, strlen($base));
        if ($altPath === $url) continue;
        $altFile = $root . ($altPath === '/' ? '/index.html' : $altPath . 'index.html');
        if (!is_file($altFile)) { $add($url, 'ERR', "hreflang hedefi yok: $altPath"); continue; }
        if (!str_contains(file_get_contents($altFile), 'href="' . $base . $url . '"')) $add($url, 'ERR', "hreflang karşılıklı değil: $altPath geri bağlanmıyor");
        else $add($url, 'OK', "hreflang eşi: $altPath");
    }
    if (!$q('//meta[@name="viewport"]')->length) $add($url, 'ERR', 'viewport yok');

    // OG / Twitter
    foreach (['og:title', 'og:description', 'og:image', 'og:url', 'og:type', 'og:locale'] as $p)
        if (!$q("//meta[@property='$p']")->length) $add($url, 'ERR', "$p yok");
    if (!$q('//meta[@name="twitter:card"]')->length) $add($url, 'WARN', 'twitter:card yok');

    // JSON-LD
    $ld = $q('//script[@type="application/ld+json"]');
    if (!$ld->length) $add($url, 'ERR', 'JSON-LD yok');
    foreach ($ld as $s) {
        $j = json_decode($s->textContent, true);
        if ($j === null) $add($url, 'ERR', 'JSON-LD geçersiz: ' . json_last_error_msg());
        else {
            $types = array_map(fn($n) => is_array($n['@type'] ?? '') ? implode('/', $n['@type']) : ($n['@type'] ?? '?'), $j['@graph'] ?? [$j]);
            $add($url, 'OK', 'JSON-LD: ' . implode(', ', $types));
        }
    }

    // görseller
    $noAlt = 0; $noDim = 0;
    foreach ($q('//img') as $im) {
        if (!$im->hasAttribute('alt')) $noAlt++;
        if (!$im->hasAttribute('width') && !$im->hasAttribute('height') && !str_contains($im->getAttribute('src'), '/uploads/')) $noDim++;
    }
    if ($noAlt) $add($url, 'ERR', "$noAlt görselde alt yok");
    if ($noDim) $add($url, 'WARN', "$noDim görselde width/height yok (CLS)");

    // iç bağlantılar
    $broken = [];
    foreach ($q('//a/@href') as $a) {
        $href = $a->nodeValue;
        if (!str_starts_with($href, '/') || str_starts_with($href, '//')) continue;
        $p = parse_url($href, PHP_URL_PATH);
        $f = $root . $p;
        if (!(is_file($f) || is_file(rtrim($f, '/') . '/index.html'))) $broken[] = $href;
    }
    if ($broken) $add($url, 'ERR', 'kırık iç bağlantı: ' . implode(', ', array_unique($broken)));

    // dış bağlantı güvenliği
    foreach ($q('//a[starts-with(@href,"http")][@target="_blank"]') as $a)
        if (!str_contains($a->getAttribute('rel'), 'noopener')) { $add($url, 'WARN', 'target=_blank rel=noopener eksik: ' . $a->getAttribute('href')); break; }

    // içerik uzunluğu
    $body = $q('//main')->item(0)?->textContent ?? '';
    $words = str_word_count(preg_replace('/\s+/', ' ', $body), 0, 'çğıöşüÇĞİÖŞÜ');
    $isLegal = (bool)preg_match('#politika|kvkk|kosul|privacy|cookie|terms|personal-data#', $rel) || $rel === '/404.html';
    if (!$isLegal && $words < 180) $add($url, 'WARN', "ince içerik ($words kelime)");
    else $add($url, 'OK', "$words kelime");

    // sitemap ve noindex tutarlılığı
    if ($url !== '/404.html' && !$noindex && !str_contains($sitemap, "<loc>$base$url</loc>")) $add($url, 'ERR', 'sitemap.xml içinde değil');
    if ($url === '/404.html' && !$noindex) $add($url, 'ERR', '404 sayfası noindex olmalı');

    // yerel SEO: NAP tutarlılığı (ana sayfa, iletişim)
    if (in_array($url, ['/', '/iletisim/', '/en/', '/en/contact/'], true)) {
        foreach (['Eti Cd. No:41/C' => $cfg['address']['street'], 'Yenibağlar' => $cfg['address']['hood'], 'Tepebaşı' => 'Tepebaşı', 'Eskişehir' => 'Eskişehir'] as $k => $needle)
            if (!str_contains($html, $needle)) $add($url, 'WARN', "NAP: '$needle' bulunamadı");
        if (!str_contains($html, '"CafeOrCoffeeShop"')) $add($url, 'ERR', 'CafeOrCoffeeShop şeması yok');
    }
}
foreach ($titles as $t => $u) if (count($u) > 1) $add($u[0], 'ERR', 'yinelenen title: ' . implode(', ', $u));
foreach ($descs as $d => $u) if (count($u) > 1) $add($u[0], 'ERR', 'yinelenen description: ' . implode(', ', $u));

// site geneli
$site = '/(site geneli)';
if (!str_contains($robots, 'Sitemap:')) $add($site, 'ERR', 'robots.txt içinde Sitemap yok'); else $add($site, 'OK', 'robots.txt sitemap işaretli');
if (str_contains($robots, 'Disallow: /admin/')) $add($site, 'OK', 'robots.txt /admin/ engelli');
$xml = @simplexml_load_string($sitemap);
if (!$xml) $add($site, 'ERR', 'sitemap.xml geçersiz'); else $add($site, 'OK', 'sitemap.xml geçerli, ' . count($xml->url) . ' URL');
foreach (['favicon.svg', 'manifest.webmanifest', 'assets/img/og-image.png'] as $f)
    if (!is_file("$root/$f")) $add($site, $f === 'assets/img/og-image.png' ? 'WARN' : 'ERR', "$f yok" . ($f === 'assets/img/og-image.png' ? ' (php tools/make-og.php / README)' : ''));
if (!is_file("$root/.htaccess")) $add($site, 'WARN', '.htaccess yok');
if (str_contains($cfg['url'], 'localhost') || $cfg['url'] === 'https://opiacoffeeco.com') $add($site, 'WARN', "site URL varsayılan ({$cfg['url']}): yayına çıkmadan _src/config.php içindeki 'url' değerini gerçek alan adıyla değiştir");
if (!$cfg['phone'] && !$cfg['email']) $add($site, 'WARN', 'telefon/e-posta tanımsız: yerel SEO için (NAP) en az telefon eklemen önerilir');
if (!$cfg['ga_id']) $add($site, 'WARN', "ga_id boş: istatistik kapalı (çerez onayı yine çalışır)");
if (!$cfg['gsc_verify']) $add($site, 'WARN', 'Search Console doğrulama kodu (gsc_verify) boş');
$phs = glob("$root/assets/img/placeholders/*.svg") ?: [];
if ($phs) $add($site, 'WARN', count($phs) . ' fotoğraf slotu hâlâ placeholder: ' . implode(', ', array_map(fn($f) => basename($f, '.svg'), $phs)));

// rapor
$out = "# SEO denetim raporu\n\n_" . date('d.m.Y H:i') . "_ / ✗ $err hata / ⚠ $warn uyarı / ✓ $okc geçti\n\n";
foreach ($results as $page => $rows) {
    $bad = array_filter($rows, fn($r) => $r[0] !== 'OK');
    $out .= "## `$page`" . ($bad ? '' : ' ✓') . "\n";
    foreach ($rows as [$l, $m]) if ($l !== 'OK') $out .= '- ' . ($l === 'ERR' ? '✗ ' : '⚠ ') . $m . "\n";
    $out .= "\n";
}
@mkdir(__DIR__ . '/../docs', 0775, true);
file_put_contents(__DIR__ . '/../docs/seo-report.md', $out);

foreach ($results as $page => $rows) {
    $bad = array_filter($rows, fn($r) => $r[0] !== 'OK');
    echo ($bad ? '' : "✓ ") . $page . "\n";
    foreach ($bad as [$l, $m]) echo '   ' . ($l === 'ERR' ? '✗ ' : '⚠ ') . $m . "\n";
}
echo "\nSonuç: ✗ $err hata / ⚠ $warn uyarı / ✓ $okc geçti\n";
exit($err ? 1 : 0);
