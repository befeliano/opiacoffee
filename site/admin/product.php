<?php
require __DIR__ . '/bootstrap.php';
require_login();
$m = menu_load();
$editId = (string)($_GET['id'] ?? '');
$idx = $editId !== '' ? product_index($m, $editId) : -1;
if ($editId !== '' && $idx < 0) { flash('Ürün bulunamadı.', 'err'); redirect('/admin/products.php'); }

$blank = [
    'id' => '', 'category' => $m['categories'][0]['id'] ?? '', 'name' => '', 'description' => '', 'price' => 0, 'priceNote' => '',
    'image' => '', 'lang' => 'tr', 'name_en' => '', 'description_en' => '', 'tags_en' => [], 'priceNote_en' => '', 'tags' => [], 'allergens' => [], 'options' => ['milk' => false, 'shot' => false, 'temp' => false, 'dessert' => false], 'orderable' => true, 'soldout' => false, 'available' => true, 'featured' => false, 'seasonal' => false, 'sort' => 0,
    'nutrition' => ['basis' => 'ml', 'per100' => ['kcal' => 0, 'fat' => 0, 'satFat' => 0, 'carb' => 0, 'sugar' => 0, 'protein' => 0, 'salt' => 0, 'caffeine' => 0], 'servings' => []],
];
$p = $idx > -1 ? $m['products'][$idx] : $blank;
$errors = [];

function handle_upload(string $slug, ?string $old, array &$errors): ?string {
    if (empty($_FILES['image']['name']) || $_FILES['image']['error'] === UPLOAD_ERR_NO_FILE) return null;
    $f = $_FILES['image'];
    if ($f['error'] !== UPLOAD_ERR_OK) { $errors[] = 'Fotoğraf yüklenemedi (hata ' . $f['error'] . ').'; return null; }
    if ($f['size'] > 6 * 1024 * 1024) { $errors[] = 'Fotoğraf en fazla 6 MB olabilir.'; return null; }
    $mime = (new finfo(FILEINFO_MIME_TYPE))->file($f['tmp_name']);
    $ext = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'][$mime] ?? null;
    if (!$ext) { $errors[] = 'Yalnızca JPG, PNG ya da WebP yüklenebilir.'; return null; }
    if (!@getimagesize($f['tmp_name'])) { $errors[] = 'Geçerli bir görsel değil.'; return null; }
    if (!is_dir(UPLOAD_DIR)) mkdir(UPLOAD_DIR, 0775, true);
    $name = $slug . '-' . bin2hex(random_bytes(4)) . '.' . $ext;
    if (!move_uploaded_file($f['tmp_name'], UPLOAD_DIR . '/' . $name)) { $errors[] = 'Dosya kaydedilemedi.'; return null; }
    delete_upload($old);
    return $name;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    $in = $_POST;
    $name = trim((string)($in['name'] ?? ''));
    if ($name === '') $errors[] = 'Ürün adı gerekli.';
    $cat = (string)($in['category'] ?? '');
    if (!in_array($cat, array_column($m['categories'], 'id'), true)) $errors[] = 'Geçerli bir kategori seç.';
    $id = $idx > -1 ? $p['id'] : slugify(trim((string)($in['id'] ?? '')) ?: $name);
    if ($idx < 0) { $base = $id; $k = 2; while (product_index($m, $id) > -1) $id = $base . '-' . $k++; }

    $n = $in['n'] ?? [];
    $servings = [];
    foreach ($in['sv'] ?? [] as $s) {
        $label = trim((string)($s['label'] ?? '')); $amt = fnum($s['amount'] ?? 0);
        if ($label === '' || $amt <= 0) continue;
        $row = ['label' => mb_substr($label, 0, 60), 'amount' => $amt];
        if (trim((string)($s['price'] ?? '')) !== '') $row['price'] = fnum($s['price']);
        $servings[] = $row;
    }
    $allergens = array_values(array_intersect(array_column($m['allergens'], 'id'), (array)($in['allergens'] ?? [])));
    $tags = array_values(array_filter(array_map('trim', explode(',', (string)($in['tags'] ?? '')))));

    $new = [
        'id' => $id, 'category' => $cat, 'name' => mb_substr($name, 0, 80),
        'description' => mb_substr(trim((string)($in['description'] ?? '')), 0, 300),
        'price' => fnum($in['price'] ?? 0), 'priceNote' => mb_substr(trim((string)($in['priceNote'] ?? '')), 0, 30),
        'image' => $p['image'] ?? '', 'tags' => array_slice($tags, 0, 5), 'allergens' => $allergens,
        'name_en' => mb_substr(trim((string)($in['name_en'] ?? '')), 0, 80),
        'description_en' => mb_substr(trim((string)($in['description_en'] ?? '')), 0, 300),
        'tags_en' => array_slice(array_values(array_filter(array_map('trim', explode(',', (string)($in['tags_en'] ?? ''))))), 0, 5),
        'priceNote_en' => mb_substr(trim((string)($in['priceNote_en'] ?? '')), 0, 30),
        'lang' => !empty($in['lang_en']) ? 'en' : 'tr', 'available' => !empty($in['available']),
        'orderable' => !empty($in['orderable']), 'soldout' => !empty($in['soldout']),
        'options' => ['milk' => !empty($in['opt']['milk']), 'shot' => !empty($in['opt']['shot']), 'temp' => !empty($in['opt']['temp']), 'dessert' => !empty($in['opt']['dessert'])], 'featured' => !empty($in['featured']), 'seasonal' => !empty($in['seasonal']),
        'sort' => $p['sort'] ?: (($m['products'] ? max(array_column($m['products'], 'sort')) : 0) + 1),
        'nutrition' => [
            'basis' => ($in['basis'] ?? 'ml') === 'g' ? 'g' : 'ml',
            'per100' => [
                'kcal' => fnum($n['kcal'] ?? 0), 'fat' => fnum($n['fat'] ?? 0), 'satFat' => fnum($n['satFat'] ?? 0),
                'carb' => fnum($n['carb'] ?? 0), 'sugar' => fnum($n['sugar'] ?? 0), 'protein' => fnum($n['protein'] ?? 0),
                'salt' => fnum($n['salt'] ?? 0), 'caffeine' => fnum($n['caffeine'] ?? 0),
            ],
            'servings' => $servings,
        ],
    ];
    if ($new['price'] < 0) $errors[] = 'Fiyat negatif olamaz.';

    if (!$errors) {
        if (!empty($in['remove_image'])) { delete_upload($new['image']); $new['image'] = ''; }
        $up = handle_upload($id, $new['image'], $errors);
        if ($up) $new['image'] = $up;
    }
    if (!$errors) {
        if ($idx > -1) $m['products'][$idx] = $new; else $m['products'][] = $new;
        menu_save($m);
        flash($new['name'] . ' kaydedildi, site güncellendi.');
        redirect(!empty($in['stay']) ? '/admin/product.php?id=' . urlencode($id) : '/admin/products.php#p-' . $id);
    }
    $p = $new + $p; // formu kullanıcı girdisiyle yeniden doldur
}

$per = $p['nutrition']['per100'];
$svs = $p['nutrition']['servings'] ?: [['label' => '', 'amount' => '', 'price' => '']];
$nf = fn($k, $label, $unit, $step = '0.1') => '<label class="fld">' . h($label) . ' <small>' . h($unit) . '</small><input type="number" step="' . $step . '" min="0" name="n[' . $k . ']" value="' . h($per[$k] ?? 0) . '" inputmode="decimal"></label>';

admin_head($idx > -1 ? 'Ürünü düzenle' : 'Yeni ürün', 'products'); ?>
<div class="bar"><h1 lang="<?= h($p['lang'] ?? 'tr') ?>"><?= $idx > -1 ? h($p['name']) : 'Yeni ürün' ?></h1><a class="abtn abtn--line" href="/admin/products.php">← Ürünler</a></div>
<?php foreach ($errors as $e): ?><div class="flash flash--err" role="alert"><?= h($e) ?></div><?php endforeach; ?>

<form method="post" enctype="multipart/form-data" class="pform">
  <?= csrf_field() ?>
  <section class="card">
    <h2>Temel bilgiler</h2>
    <label class="fld">Ürün adı<input name="name" value="<?= h($p['name']) ?>" required maxlength="80" data-slug-src></label>
    <?php if ($idx < 0): ?><label class="fld">Adres kimliği <small>(boş bırakırsan addan üretilir)</small><input name="id" value="<?= h($p['id']) ?>" maxlength="60" pattern="[a-z0-9-]*"></label><?php endif; ?>
    <div class="grid2">
      <label class="fld">Kategori<select name="category"><?php foreach ($m['categories'] as $c): ?><option value="<?= h($c['id']) ?>"<?= $p['category'] === $c['id'] ? ' selected' : '' ?>><?= h($c['name']) ?></option><?php endforeach; ?></select></label>
      <label class="fld">Fiyat <small>₺</small><input name="price" type="number" step="0.5" min="0" value="<?= h($p['price']) ?>" inputmode="decimal" required></label>
    </div>
    <label class="fld">Açıklama <small>(en fazla 300 karakter)</small><textarea name="description" rows="3" maxlength="300"><?= h($p['description']) ?></textarea></label>
    <div class="grid2">
      <label class="fld">Etiketler <small>(virgülle: Vegan, Favori)</small><input name="tags" value="<?= h(implode(', ', $p['tags'])) ?>"></label>
      <label class="fld">Fiyat notu <small>(örn. 250 g, ek ücret)</small><input name="priceNote" value="<?= h($p['priceNote']) ?>" maxlength="30"></label>
    </div>
    <div class="checks">
      <label class="chk"><input type="checkbox" name="lang_en" value="1"<?= ($p['lang'] ?? 'tr') === 'en' ? ' checked' : '' ?>><span>İngilizce / yabancı ad (büyük harfte “İ” yerine “I” kullanılır: Flat White)</span></label>
      <label class="chk"><input type="checkbox" name="soldout" value="1"<?= !empty($p['soldout']) ? ' checked' : '' ?>><span>Tükendi (menüde görünür ama sipariş verilemez)</span></label>
      <label class="chk"><input type="checkbox" name="available" value="1"<?= $p['available'] ? ' checked' : '' ?>><span>Yayında</span></label>
      <label class="chk"><input type="checkbox" name="seasonal" value="1"<?= $p['seasonal'] ? ' checked' : '' ?>><span>Mevsim seçkisinde</span></label>
      <label class="chk"><input type="checkbox" name="featured" value="1"<?= $p['featured'] ? ' checked' : '' ?>><span>Öne çıkan (yerel sayfalarda gösterilir)</span></label>
    </div>
  </section>

  <section class="card">
    <h2>İngilizce</h2>
    <p class="muted">İngilizce menüde (/en/menu/) görünür. Boş bırakılan alanlarda Türkçesi gösterilir.</p>
    <label class="fld">Ürün adı (EN)<input name="name_en" value="<?= h($p['name_en'] ?? '') ?>" maxlength="80" placeholder="Turkish Coffee"></label>
    <label class="fld">Açıklama (EN)<textarea name="description_en" rows="2" maxlength="300"><?= h($p['description_en'] ?? '') ?></textarea></label>
    <div class="grid2">
      <label class="fld">Etiketler (EN)<input name="tags_en" value="<?= h(implode(', ', $p['tags_en'] ?? [])) ?>" placeholder="Vegan, Caffeine-free"></label>
      <label class="fld">Fiyat notu (EN)<input name="priceNote_en" value="<?= h($p['priceNote_en'] ?? '') ?>" maxlength="30"></label>
    </div>
  </section>

  <section class="card">
    <h2>QR sipariş seçenekleri</h2>
    <p class="muted">Masadan siparişte misafirin seçebileceği seçenekler. Ek ücretler “Ekstralar” kategorisindeki ürünlerin fiyatından gelir.</p>
    <?php $o = $p['options'] ?? []; ?>
    <div class="checks">
      <label class="chk"><input type="checkbox" name="orderable" value="1"<?= ($p['orderable'] ?? true) ? ' checked' : '' ?>><span>QR ile sipariş verilebilir</span></label>
      <label class="chk"><input type="checkbox" name="opt[milk]" value="1"<?= !empty($o['milk']) ? ' checked' : '' ?>><span>Süt seçimi (normal / laktozsuz / bitkisel)</span></label>
      <label class="chk"><input type="checkbox" name="opt[shot]" value="1"<?= !empty($o['shot']) ? ' checked' : '' ?>><span>Ekstra shot</span></label>
      <label class="chk"><input type="checkbox" name="opt[temp]" value="1"<?= !empty($o['temp']) ? ' checked' : '' ?>><span>Sıcak / soğuk seçimi</span></label>
      <label class="chk"><input type="checkbox" name="opt[dessert]" value="1"<?= !empty($o['dessert']) ? ' checked' : '' ?>><span>Tatlıya ekstra (çikolata sos, dondurma)</span></label>
    </div>
  </section>

  <section class="card">
    <h2>Fotoğraf</h2>
    <div class="imgbox">
      <div class="imgbox__prev" data-img-prev><?php if ($p['image']): ?><img src="/uploads/<?= h($p['image']) ?>" alt=""><?php else: ?><span>Fotoğraf yok</span><?php endif; ?></div>
      <div>
        <input type="file" name="image" accept="image/jpeg,image/png,image/webp" data-img-input>
        <p class="muted">JPG, PNG ya da WebP. Yüklemeden önce tarayıcıda otomatik küçültülür (en fazla 1400 px, WebP). Kare ya da 4:5 kadraj önerilir.</p>
        <?php if ($p['image']): ?><label class="chk"><input type="checkbox" name="remove_image" value="1"><span>Mevcut fotoğrafı kaldır</span></label><?php endif; ?>
      </div>
    </div>
  </section>

  <section class="card">
    <h2>Alerjenler</h2>
    <div class="checks checks--wrap">
      <?php foreach ($m['allergens'] as $a): ?>
        <label class="chk chk--pill"><input type="checkbox" name="allergens[]" value="<?= h($a['id']) ?>"<?= in_array($a['id'], $p['allergens'], true) ? ' checked' : '' ?>><span><?= h($a['name']) ?></span></label>
      <?php endforeach; ?>
    </div>
  </section>

  <section class="card">
    <h2>Enerji ve besin değerleri</h2>
    <p class="muted">Değerleri <b>100 <span data-basis-label><?= $p['nutrition']['basis'] === 'g' ? 'g' : 'ml' ?></span></b> için gir. Sitede seçilen porsiyona göre otomatik hesaplanır.</p>
    <div class="seg" role="radiogroup" aria-label="Birim">
      <label><input type="radio" name="basis" value="ml"<?= $p['nutrition']['basis'] !== 'g' ? ' checked' : '' ?> data-basis><span>Sıvı (ml)</span></label>
      <label><input type="radio" name="basis" value="g"<?= $p['nutrition']['basis'] === 'g' ? ' checked' : '' ?> data-basis><span>Katı (g)</span></label>
    </div>
    <div class="grid4">
      <?= $nf('kcal', 'Enerji', 'kcal', '1') ?><?= $nf('fat', 'Yağ', 'g') ?><?= $nf('satFat', 'Doymuş yağ', 'g') ?><?= $nf('carb', 'Karbonhidrat', 'g') ?>
      <?= $nf('sugar', 'Şekerler', 'g') ?><?= $nf('protein', 'Protein', 'g') ?><?= $nf('salt', 'Tuz', 'g', '0.01') ?><?= $nf('caffeine', 'Kafein', 'mg', '1') ?>
    </div>

    <h3>Porsiyonlar</h3>
    <p class="muted">Menüde “Porsiyon seç” listesinde görünür. Miktar, <span data-basis-label2><?= $p['nutrition']['basis'] === 'g' ? 'gram' : 'ml' ?></span> cinsindendir. Boyuta özel fiyat girersen modalda fiyat değişir.</p>
    <div class="svlist" data-sv-list>
      <?php foreach ($svs as $i => $s): ?>
      <div class="sv">
        <label class="fld">Etiket<input name="sv[<?= $i ?>][label]" value="<?= h($s['label']) ?>" placeholder="Küçük (240 ml)"></label>
        <label class="fld">Miktar<input name="sv[<?= $i ?>][amount]" type="number" step="0.1" min="0" value="<?= h($s['amount']) ?>" inputmode="decimal"></label>
        <label class="fld">Fiyat ₺<input name="sv[<?= $i ?>][price]" type="number" step="0.5" min="0" value="<?= h($s['price'] ?? '') ?>" inputmode="decimal"></label>
        <button type="button" class="sv__x" data-sv-del aria-label="Satırı sil">×</button>
      </div>
      <?php endforeach; ?>
    </div>
    <button type="button" class="abtn abtn--line" data-sv-add>+ Porsiyon ekle</button>
  </section>

  <div class="savebar">
    <button class="abtn" type="submit">Kaydet ve yayınla</button>
    <button class="abtn abtn--line" type="submit" name="stay" value="1">Kaydet, burada kal</button>
  </div>
</form>
<?php admin_foot();
