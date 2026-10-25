<?php
// Site genelinde kullanılan sabit bilgiler. Tek kaynak burası: değiştir, `php _src/build.php` çalıştır.
return [
    'name'        => 'Opia Coffee Co.',
    'short'       => 'OPIA',
    'url'         => 'https://opiacoffeeco.com',   // yayına çıkarken gerçek alan adıyla değiştir
    'lang'        => 'tr',
    'locale'      => 'tr_TR',
    'tagline'     => 'Yenibağlar, Eskişehir’de nitelikli kahve',
    'instagram'   => 'opiacoffeeco',
    'phone'       => '',                            // boşsa sitede hiç gösterilmez
    'email'       => '',                            // boşsa sitede hiç gösterilmez
    'address'     => [
        'street'   => 'Eti Cd. No:41/C',
        'hood'     => 'Yenibağlar Mah.',
        'district' => 'Tepebaşı',
        'city'     => 'Eskişehir',
        'zip'      => '26170',
        'country'  => 'TR',
    ],
    'geo'         => ['lat' => 39.78545388328983, 'lng' => 30.50237731156014],
    'maps_url'    => 'https://maps.app.goo.gl/KKHjZvkypfuQQUkt8',
    'hours'       => ['open' => '09:00', 'close' => '00:00'],
    'theme_color' => '#0a0a0a',
    // Yasal metinlerde veri sorumlusu bilgisi
    'legal_updated' => '23 Ekim 2026',
    'legal_updated_en' => '23 October 2026',
    'legal_entity'  => 'Opia Coffee Co.',
    // Büyük harfe çevrilen alanlarda Türkçe i->İ kuralının bozmaması gereken İngilizce/marka sözcükleri
    'en_words' => ['Opia', 'opiacoffeeco', 'Instagram', 'San Sebastian', 'Tiramisu', 'Cappuccino', 'Americano', 'Piccolo', 'Brownie', 'Chai', 'Miel', 'Flat White', 'Red Eye', 'Black Eye', 'Cheesecake', 'Gingerbread', 'Pistachio', 'Matcha Bar', 'Single', 'Awaken the senses', 'Cold Brew', 'Mocha', 'White', 'Eye'],
    // İngilizce sayfalarda büyük harfe çevrilirken Türkçe İ'si korunacak yer adları
    'tr_words' => ['Yenibağlar', 'Eskişehir', 'Tepebaşı', 'Hoşnudiye', 'Eti Caddesi', 'Eti Cd.', 'Vecihi Hürkuş', 'Anadolu Üniversitesi', 'Yunusemre', 'İstasyon', 'Bağlar', 'Mah.', 'Türkçe'],
    'ga_id'         => '',                          // Google Analytics ölçüm kimliği (G-XXXX). Boşsa hiç yüklenmez.
    'gsc_verify'    => '',                          // Search Console doğrulama kodu (opsiyonel)
];
