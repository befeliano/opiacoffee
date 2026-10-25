<?php
function legal_open(string $h1, string $lead): string {
    $en = lang() === 'en';
    return '<section class="phead"><div class="wrap"><p class="eyebrow">' . ($en ? 'Legal' : 'Yasal') . '</p><h1 class="phead__h phead__h--sm">' . e($h1) . '</h1>'
        . '<p class="lead">' . e($lead) . '</p><p class="legal__date">' . ($en ? 'Last updated: ' . e(cfg('legal_updated_en')) : 'Son güncelleme: ' . e(cfg('legal_updated'))) . '</p></div></section>'
        . '<section class="sec sec--tight"><div class="wrap narrow prose prose--legal">';
}
function legal_close(): string { return '</div></section>'; }
function controller_block(): string {
    $c = cfg();
    $a = $c['address'];
    $en = lang() === 'en';
    $h = '<ul><li><strong>' . ($en ? 'Data controller' : 'Veri sorumlusu') . ':</strong> ' . e($c['legal_entity']) . '</li>'
       . '<li><strong>' . ($en ? 'Address' : 'Adres') . ':</strong> ' . e("{$a['hood']} {$a['street']}, {$a['zip']} {$a['district']} / {$a['city']}") . ($en ? ', Türkiye' : '') . '</li>'
       . '<li><strong>' . ($en ? 'Website' : 'Web sitesi') . ':</strong> ' . e($c['url']) . '</li>';
    if ($c['email']) $h .= '<li><strong>' . ($en ? 'Email' : 'E-posta') . ':</strong> ' . e($c['email']) . '</li>';
    if ($c['phone']) $h .= '<li><strong>' . ($en ? 'Phone' : 'Telefon') . ':</strong> ' . e($c['phone']) . '</li>';
    return $h . '</ul>';
}
/** İstatistik aracı etkin mi? (config: ga_id) Metinler buna göre doğru bilgi verir. */
function analytics_on(): bool { return (string)cfg('ga_id') !== ''; }
