<?php
// Opia site derleyicisi için yardımcılar (HTML üretimi, görsel slotları, JSON-LD).

const OPIA_ROOT = __DIR__ . '/..';

function cfg(?string $k = null) {
    static $c;
    $c ??= require __DIR__ . '/config.php';
    return $k === null ? $c : ($c[$k] ?? null);
}

function e($s): string { return htmlspecialchars((string)$s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); }

function url(string $path = '/'): string { return rtrim(cfg('url'), '/') . $path; }

function money($n): string {
    $n = (float)$n;
    $s = floor($n) == $n ? number_format($n, 0, ',', '.') : number_format($n, 2, ',', '.');
    return $s . ' ₺';
}

function json_attr($v): string {
    return json_encode($v, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_HEX_AMP);
}

function ld($data): string {
    return '<script type="application/ld+json">' . json_encode($data,
        JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_HEX_AMP) . '</script>';
}

function asset(string $path): string {
    $f = OPIA_ROOT . $path;
    return $path . (is_file($f) ? '?v=' . substr(md5_file($f), 0, 8) : '');
}

/** Görsel slotu: assets/img/<slot>.(webp|jpg|jpeg|png) varsa onu, yoksa placeholder üretir. */
function img_src(string $slot, string $label = '', int $w = 1200, int $h = 900): array {
    foreach (['webp', 'jpg', 'jpeg', 'png', 'avif'] as $ext) {
        $f = OPIA_ROOT . "/assets/img/$slot.$ext";
        if (is_file($f)) {
            [$iw, $ih] = @getimagesize($f) ?: [$w, $h];
            return ['src' => "/assets/img/$slot.$ext?v=" . substr(md5_file($f), 0, 6), 'w' => $iw, 'h' => $ih, 'real' => true];
        }
    }
    $dir = OPIA_ROOT . '/assets/img/placeholders';
    if (!is_dir($dir)) mkdir($dir, 0775, true);
    $file = "$dir/$slot.svg";
    $label = $label ?: strtoupper($slot);
    $svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' . $w . ' ' . $h . '" preserveAspectRatio="xMidYMid slice">'
        . '<rect width="100%" height="100%" fill="#d9d8d4"/>'
        . '<defs><pattern id="p" width="28" height="28" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="28" height="28" fill="#d9d8d4"/><rect width="1.5" height="28" fill="#cbcac5"/></pattern></defs>'
        . '<rect width="100%" height="100%" fill="url(#p)"/>'
        . '<g fill="none" stroke="#0a0a0a" stroke-width="2" opacity=".55"><rect x="' . ($w / 2 - 44) . '" y="' . ($h / 2 - 52) . '" width="88" height="64" rx="6"/><circle cx="' . ($w / 2) . '" cy="' . ($h / 2 - 20) . '" r="19"/><path d="M' . ($w / 2 - 20) . ' ' . ($h / 2 - 52) . 'l8 -10h24l8 10"/></g>'
        . '<text x="50%" y="' . ($h / 2 + 52) . '" text-anchor="middle" font-family="Arial,sans-serif" font-size="' . max(14, round($w / 55)) . '" letter-spacing="3" fill="#0a0a0a" opacity=".6">FOTOĞRAF / ' . htmlspecialchars($label) . '</text>'
        . '</svg>';
    if (!is_file($file) || file_get_contents($file) !== $svg) file_put_contents($file, $svg);
    return ['src' => "/assets/img/placeholders/$slot.svg", 'w' => $w, 'h' => $h, 'real' => false];
}

function img(string $slot, string $alt, array $o = []): string {
    $w = $o['w'] ?? 1200; $h = $o['h'] ?? 900;
    $i = img_src($slot, $o['label'] ?? '', $w, $h);
    $cls = $o['class'] ?? '';
    $loading = ($o['eager'] ?? false) ? 'eager' : 'lazy';
    $extra = ($o['eager'] ?? false) ? ' fetchpriority="high"' : ' decoding="async"';
    return '<img src="' . e($i['src']) . '" alt="' . e($alt) . '" width="' . $i['w'] . '" height="' . $i['h'] . '"'
        . ($cls ? ' class="' . e($cls) . '"' : '') . ' loading="' . $loading . '"' . $extra . '>';
}

function address_line(): string {
    $a = cfg('address');
    return "{$a['hood']}, {$a['street']}, {$a['district']}/{$a['city']}";
}

function postal_address(): array {
    $a = cfg('address');
    return [
        '@type' => 'PostalAddress',
        'streetAddress' => "{$a['hood']} {$a['street']}",
        'addressLocality' => $a['district'],
        'addressRegion' => $a['city'],
        'postalCode' => $a['zip'],
        'addressCountry' => $a['country'],
    ];
}

function maps_dir_url(): string {
    $g = cfg('geo');
    return 'https://www.google.com/maps/dir/?api=1&destination=' . $g['lat'] . ',' . $g['lng'];
}

function icon(string $n): string {
    static $i = [
        'pin' => '<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
        'clock' => '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
        'insta' => '<rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r="1" fill="currentColor" stroke="none"/>',
        'arrow' => '<path d="M5 12h14M13 6l6 6-6 6"/>',
        'arrow-ur' => '<path d="M7 17 17 7M8 7h9v9"/>',
        'close' => '<path d="M6 6l12 12M18 6 6 18"/>',
        'search' => '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>',
        'cup' => '<path d="M5 9h12v5a5 5 0 0 1-5 5h-2a5 5 0 0 1-5-5V9z"/><path d="M17 10h1.5a2.5 2.5 0 0 1 0 5H17"/><path d="M8 3c0 1.5 1.2 1.5 1.2 3M12 3c0 1.5 1.2 1.5 1.2 3"/>',
        'leaf' => '<path d="M5 19c0-8 5-13 14-14 0 9-5 14-13 14"/><path d="M5 19c2-4 5-7 9-9"/>',
        'phone' => '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A15 15 0 0 1 3 6a2 2 0 0 1 2-2z"/>',
        'mail' => '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
        'train' => '<rect x="5" y="3" width="14" height="14" rx="3"/><path d="M5 11h14M8 21l2-4M16 21l-2-4"/><circle cx="9" cy="14" r=".6" fill="currentColor"/><circle cx="15" cy="14" r=".6" fill="currentColor"/>',
        'plane' => '<path d="M10.5 13.5 3 11l1-2 8 1.5 4-5.5 2 .5-2 6.5 4.5 4-1 1.5-5-1.5-3 4-1.5-.5.5-5z"/>',
        'school' => '<path d="m3 9 9-5 9 5-9 5-9-5z"/><path d="M7 11.5V16c0 1.2 2.2 2.5 5 2.5s5-1.3 5-2.5v-4.5"/>',
        'bag' => '<path d="M5 8h14l-1 12H6L5 8z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
        'sun' => '<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4"/>',
    ];
    return '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' . ($i[$n] ?? '') . '</svg>';
}

// ---------- MENÜ ----------

function menu_data(): array {
    return json_decode(file_get_contents(OPIA_ROOT . '/data/menu.json'), true);
}

function products_in(array $m, string $cat): array {
    $r = array_values(array_filter($m['products'], fn($p) => $p['category'] === $cat && $p['available']));
    usort($r, fn($a, $b) => $a['sort'] <=> $b['sort']);
    return $r;
}

function seasonal_products(array $m): array {
    $r = array_values(array_filter($m['products'], fn($p) => !empty($p['seasonal']) && $p['available']));
    usort($r, fn($a, $b) => $a['sort'] <=> $b['sort']);
    return $r;
}

function allergen_names(array $m): array {
    $o = [];
    foreach ($m['allergens'] as $a) $o[$a['id']] = lang() === 'en' ? ($a['name_en'] ?? $a['name']) : $a['name'];
    return $o;
}

// ---------- DİL ----------

/** Derlenen sayfanın dili (tr | en). */
function lang(?string $set = null): string {
    static $l = 'tr';
    if ($set !== null) $l = $set === 'en' ? 'en' : 'tr';
    return $l;
}
function t(string $k): string {
    static $d;
    $d ??= require __DIR__ . '/i18n.php';
    return $d[lang()][$k] ?? $d['tr'][$k] ?? $k;
}
/** Türkçe ve İngilizce sayfa eşleri. */
const PAGE_PAIRS = [
    '/' => '/en/', '/menu/' => '/en/menu/', '/hakkimizda/' => '/en/about/', '/iletisim/' => '/en/contact/',
    '/kvkk-aydinlatma-metni/' => '/en/personal-data-notice/', '/gizlilik-politikasi/' => '/en/privacy-policy/',
    '/cerez-politikasi/' => '/en/cookie-policy/', '/kullanim-kosullari/' => '/en/terms/',
];
/** Türkçe yolu geçerli dile çevirir: lp('/menu/') -> /en/menu/ (İngilizce sayfada). */
function lp(string $trPath): string {
    if (lang() !== 'en') return $trPath;
    [$p, $hash] = array_pad(explode('#', $trPath, 2), 2, null);
    return (PAGE_PAIRS[$p] ?? $p) . ($hash !== null ? '#' . $hash : '');
}
/** Bir sayfanın diğer dildeki eşi (yoksa null). */
function alt_path(string $path): ?string {
    if (isset(PAGE_PAIRS[$path])) return PAGE_PAIRS[$path];
    $r = array_search($path, PAGE_PAIRS, true);
    return $r === false ? null : $r;
}
function pn(array $p): string { return lang() === 'en' ? (($p['name_en'] ?? '') ?: $p['name']) : $p['name']; }
function pd(array $p): string { return lang() === 'en' ? (($p['description_en'] ?? '') ?: $p['description']) : $p['description']; }
function ptags(array $p): array { return lang() === 'en' ? ($p['tags_en'] ?? $p['tags']) : $p['tags']; }
function pnote(array $p): string { return lang() === 'en' ? (($p['priceNote_en'] ?? '') ?: ($p['priceNote'] ?? '')) : ($p['priceNote'] ?? ''); }
function cn(array $c): string { return lang() === 'en' ? (($c['name_en'] ?? '') ?: $c['name']) : $c['name']; }
function cnote(array $c): string { return lang() === 'en' ? ($c['note_en'] ?? '') : ($c['note'] ?? ''); }
function season_txt(array $s, string $k): string { return lang() === 'en' ? (($s[$k . '_en'] ?? '') ?: $s[$k]) : $s[$k]; }
/** Porsiyon etiketini çevirir: "Standart (300 ml)" -> "Regular (300 ml)". */
function serving_label(string $l): string {
    if (lang() !== 'en') return $l;
    return strtr($l, ['Standart' => 'Regular', 'Tek' => 'Single', 'Duble' => 'Double', 'Dilim' => 'Slice', 'Kase' => 'Bowl',
        'Bardak' => 'Cup', 'Kare' => 'Square', 'Porsiyon' => 'Portion', 'Top' => 'Scoop', 'Küçük' => 'Small', 'Büyük' => 'Large', 'Orta' => 'Medium']);
}

/** Ürün adı: büyük harfe çevrilirken doğru i/İ kuralı için dil etiketi. */
function pname(array $p): string {
    $name = e(pn($p));
    if (lang() === 'en') return ($p['lang'] ?? 'tr') === 'tr' && empty($p['name_en']) ? '<span lang="tr">' . $name . '</span>' : $name;
    return ($p['lang'] ?? 'tr') === 'en' ? '<span lang="en">' . $name . '</span>' : $name;
}

/**
 * Büyük harfe çevrilen alanlarda yanlış i/İ olmasın diye sözcükleri dil etiketiyle sarar.
 * Türkçe sayfada İngilizce/marka sözcükleri (lang="en"), İngilizce sayfada Türkçe yer adları (lang="tr").
 */
function lang_wrap(string $html): string {
    [$words, $tag] = lang() === 'en' ? [cfg('tr_words'), 'tr'] : [cfg('en_words'), 'en'];
    usort($words, fn($a, $b) => strlen($b) <=> strlen($a));
    $re = '~(?<![[:alpha:]])(' . implode('|', array_map(fn($w) => preg_quote($w, '~'), $words)) . ')(?![[:alpha:]])~u';
    $parts = preg_split('~(<script[ >].*?</script>|<style[ >].*?</style>|<title[ >].*?</title>|<!--.*?-->|<[^>]+>)~s', $html, -1, PREG_SPLIT_DELIM_CAPTURE);
    foreach ($parts as $i => $t) {
        if ($t === '' || $t[0] === '<') continue;
        $parts[$i] = preg_replace($re, '<span lang="' . $tag . '">$1</span>', $t);
    }
    return implode('', $parts);
}

function product_img(array $p, string $class = ''): string {
    if (!empty($p['image'])) {
        return '<img src="/uploads/' . e($p['image']) . '" alt="' . e(pn($p)) . ', Opia Coffee Co. Eskişehir" loading="lazy" decoding="async"' . ($class ? ' class="' . e($class) . '"' : '') . '>';
    }
    return '<span class="noimg" aria-hidden="true">' . icon('cup') . '</span>';
}

function price_label(array $p): string {
    $prices = [];
    foreach ($p['nutrition']['servings'] ?? [] as $s) if (!empty($s['price'])) $prices[] = (float)$s['price'];
    $base = (float)$p['price'];
    $txt = money($base);
    if (count($prices) > 1 && min($prices) < max($prices)) $txt = money(min($prices)) . ' - ' . money(max($prices));
    return $txt;
}

function product_row(array $p, array $alNames): string {
    $tags = '';
    foreach (array_slice(ptags($p), 0, 3) as $tg) $tags .= '<li>' . e($tg) . '</li>';
    $badge = !empty($p['seasonal']) ? '<span class="badge">' . e(t('seasonal')) . '</span>' : '';
    $out = !empty($p['soldout']) ? '<span class="badge badge--out">' . e(t('soldout')) . '</span>' : '';
    $note = pnote($p);
    return '<li class="row' . (!empty($p['soldout']) ? ' is-soldout' : '') . '" data-allergens="' . e(implode(' ', $p['allergens'])) . '">'
        . '<button type="button" class="prod" data-id="' . e($p['id']) . '" aria-haspopup="dialog">'
        . '<span class="prod__txt">'
        . '<span class="prod__name">' . pname($p) . $badge . $out . '</span>'
        . '<span class="prod__desc">' . e(pd($p)) . '</span>'
        . ($tags ? '<ul class="prod__tags">' . $tags . '</ul>' : '')
        . '</span>'
        . '<span class="prod__side"><span class="prod__thumb">' . product_img($p) . '</span>'
        . '<span class="prod__price">' . e(price_label($p)) . ($note ? '<small>' . e($note) . '</small>' : '') . '</span></span>'
        . '</button></li>';
}

function product_card(array $p): string {
    $tag = !empty($p['soldout']) ? t('soldout') : (ptags($p)[0] ?? t('seasonal'));
    return '<li class="card' . (!empty($p['soldout']) ? ' is-soldout' : '') . '" data-allergens="' . e(implode(' ', $p['allergens'])) . '">'
        . '<button type="button" class="prod prod--card" data-id="' . e($p['id']) . '" aria-haspopup="dialog">'
        . '<span class="card__img">' . product_img($p) . '</span>'
        . '<span class="card__body"><span class="card__tag">' . e($tag) . '</span>'
        . '<span class="card__name">' . pname($p) . '</span>'
        . '<span class="card__desc">' . e(pd($p)) . '</span>'
        . '<span class="card__price">' . e(price_label($p)) . '</span></span>'
        . '</button></li>';
}

/** Modal için sayfaya gömülen veri (SEO için ayrıca HTML'de de ürünler var). */
function menu_embed(array $products, array $alNames): string {
    $out = [];
    foreach ($products as $p) {
        $nut = $p['nutrition'];
        foreach ($nut['servings'] as &$sv) $sv['label'] = serving_label($sv['label']);
        unset($sv);
        $nameLang = lang() === 'en' ? (empty($p['name_en']) && ($p['lang'] ?? 'tr') === 'tr' ? 'tr' : 'en') : ($p['lang'] ?? 'tr');
        $out[$p['id']] = [
            'id' => $p['id'], 'name' => pn($p), 'lang' => $nameLang,
            'description' => pd($p), 'price' => $p['price'], 'priceNote' => pnote($p), 'image' => $p['image'], 'tags' => ptags($p),
            'seasonal' => !empty($p['seasonal']), 'soldout' => !empty($p['soldout']),
            'allergens' => array_map(fn($a) => $alNames[$a] ?? $a, $p['allergens']),
            'nutrition' => $nut,
            'options' => $p['options'] ?? new stdClass(), 'orderable' => $p['orderable'] ?? true,
        ];
    }
    return '<script type="application/json" id="menu-data">' . json_attr($out) . '</script>';
}

function menu_schema(array $m): array {
    $sections = [];
    foreach ($m['categories'] as $c) {
        $items = [];
        foreach (products_in($m, $c['id']) as $p) {
            $item = [
                '@type' => 'MenuItem', 'name' => pn($p), 'description' => pd($p),
                'offers' => ['@type' => 'Offer', 'price' => (string)$p['price'], 'priceCurrency' => 'TRY',
                    'availability' => !empty($p['soldout']) ? 'https://schema.org/SoldOut' : 'https://schema.org/InStock'],
            ];
            if (!empty($p['image'])) $item['image'] = url('/uploads/' . $p['image']);
            if (!empty($p['nutrition']['per100']['kcal']) && $p['nutrition']['basis']) {
                $s = $p['nutrition']['servings'][0] ?? null;
                if ($s) $item['nutrition'] = ['@type' => 'NutritionInformation', 'servingSize' => serving_label($s['label']),
                    'calories' => round($p['nutrition']['per100']['kcal'] * $s['amount'] / 100) . ' kcal'];
            }
            $items[] = $item;
        }
        if ($items) $sections[] = ['@type' => 'MenuSection', 'name' => cn($c), 'hasMenuItem' => $items];
    }
    $en = lang() === 'en';
    return ['@type' => 'Menu', 'name' => $en ? 'Opia Coffee Co. Menu' : 'Opia Coffee Co. Menü', 'inLanguage' => $en ? 'en' : 'tr', 'hasMenuSection' => $sections];
}

function business_schema(bool $withMenu = false): array {
    $g = cfg('geo');
    $b = [
        '@type' => ['CafeOrCoffeeShop', 'LocalBusiness'],
        '@id' => url('/#cafe'),
        'name' => cfg('name'),
        'alternateName' => ['Opia Coffee', 'Opia Coffee Co Eskişehir', 'Opia Kahve'],
        'url' => url('/'),
        'image' => [url('/assets/img/og-image.png')],
        'logo' => url('/assets/img/logo-opia.png'),
        'description' => t('biz_desc'),
        'servesCuisine' => lang() === 'en' ? ['Coffee', 'Desserts', 'Matcha', 'Hot chocolate'] : ['Kahve', 'Tatlı', 'Matcha', 'Sıcak çikolata'],
        'priceRange' => '₺₺',
        'address' => postal_address(),
        'geo' => ['@type' => 'GeoCoordinates', 'latitude' => $g['lat'], 'longitude' => $g['lng']],
        'hasMap' => cfg('maps_url'),
        'openingHoursSpecification' => [[
            '@type' => 'OpeningHoursSpecification',
            'dayOfWeek' => ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
            'opens' => cfg('hours')['open'], 'closes' => '23:59',
        ]],
        'sameAs' => ['https://www.instagram.com/' . cfg('instagram') . '/'],
        'areaServed' => ['Yenibağlar', 'Tepebaşı', 'Eskişehir'],
        'currenciesAccepted' => 'TRY',
        'paymentAccepted' => 'Nakit, Kredi Kartı',
        'menu' => url(lp('/menu/')),
    ];
    if (cfg('phone')) $b['telephone'] = cfg('phone');
    if (cfg('email')) $b['email'] = cfg('email');
    return $b;
}

function breadcrumb_schema(array $trail): array {
    $items = [];
    foreach ($trail as $i => [$name, $path]) {
        $items[] = ['@type' => 'ListItem', 'position' => $i + 1, 'name' => $name, 'item' => url($path)];
    }
    return ['@type' => 'BreadcrumbList', 'itemListElement' => $items];
}

function faq_schema(array $faq): array {
    return ['@type' => 'FAQPage', 'mainEntity' => array_map(fn($q) => [
        '@type' => 'Question', 'name' => $q[0],
        'acceptedAnswer' => ['@type' => 'Answer', 'text' => $q[1]],
    ], $faq)];
}

function faq_html(array $faq): string {
    $h = '<div class="faq">';
    foreach ($faq as $q) {
        $h .= '<details><summary>' . e($q[0]) . '</summary><p>' . e($q[1]) . '</p></details>';
    }
    return $h . '</div>';
}

// ---------- SİPARİŞ SEÇENEKLERİ ----------

/** Ekstra ürünlerin fiyatı menüdeki “Ekstralar” kategorisinden okunur; panelden değişince sipariş fiyatı da değişir. */
function order_options(array $m): array {
    $price = function (string $id, float $def) use ($m): float {
        foreach ($m['products'] as $p) if ($p['id'] === $id) return (float)$p['price'];
        return $def;
    };
    return [
        'milk' => [
            ['id' => 'normal', 'label' => 'Normal süt', 'label_en' => 'Regular milk', 'price' => 0],
            ['id' => 'laktozsuz', 'label' => 'Laktozsuz süt', 'label_en' => 'Lactose-free milk', 'price' => $price('ekstra-laktozsuz-sut', 20)],
            ['id' => 'bitkisel', 'label' => 'Bitkisel süt (vegan)', 'label_en' => 'Plant-based milk (vegan)', 'price' => $price('ekstra-bitkisel-sut', 50)],
        ],
        'shot' => ['label' => 'Ekstra shot', 'label_en' => 'Extra shot', 'price' => $price('ekstra-single-espresso', 50), 'max' => 2],
        'temp' => [['id' => 'sicak', 'label' => 'Sıcak', 'label_en' => 'Hot'], ['id' => 'soguk', 'label' => 'Soğuk', 'label_en' => 'Iced']],
        'dessert' => [
            ['id' => 'cikolata', 'label' => 'Çikolata sos', 'label_en' => 'Chocolate sauce', 'price' => $price('ekstra-cikolata', 70)],
            ['id' => 'dondurma', 'label' => 'Dondurma', 'label_en' => 'Ice cream', 'price' => $price('ekstra-dondurma', 50)],
        ],
    ];
}

/**
 * Bir sepet satırının fiyatını sunucuda hesaplar (istemci fiyatına asla güvenilmez).
 * $sel: ['milk' => 'laktozsuz', 'shot' => 1, 'temp' => 'soguk', 'addons' => ['dondurma']]
 * Dönüş: [birim fiyat, seçenek metni] ya da hata için null.
 */
function order_price(array $p, array $sel, array $opt): ?array {
    $f = $p['options'] ?? [];
    $unit = (float)$p['price']; $txt = [];
    if (!empty($f['milk'])) {
        $milk = (string)($sel['milk'] ?? 'normal');
        $hit = array_values(array_filter($opt['milk'], fn($o) => $o['id'] === $milk));
        if (!$hit) return null;
        if ($milk !== 'normal') { $unit += $hit[0]['price']; $txt[] = $hit[0]['label']; }
    }
    if (!empty($f['shot'])) {
        $n = (int)($sel['shot'] ?? 0);
        if ($n < 0 || $n > $opt['shot']['max']) return null;
        if ($n) { $unit += $n * $opt['shot']['price']; $txt[] = '+' . $n . ' shot'; }
    }
    if (!empty($f['temp'])) {
        $t = (string)($sel['temp'] ?? 'sicak');
        $hit = array_values(array_filter($opt['temp'], fn($o) => $o['id'] === $t));
        if (!$hit) return null;
        $txt[] = $hit[0]['label'];
    }
    if (!empty($f['dessert'])) {
        foreach (array_unique((array)($sel['addons'] ?? [])) as $a) {
            $hit = array_values(array_filter($opt['dessert'], fn($o) => $o['id'] === $a));
            if (!$hit) return null;
            $unit += $hit[0]['price']; $txt[] = $hit[0]['label'];
        }
    }
    return [$unit, implode(', ', $txt)];
}
