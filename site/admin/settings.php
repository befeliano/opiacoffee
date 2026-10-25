<?php
require __DIR__ . '/bootstrap.php';
require_login();
$m = menu_load();
$s = $m['settings'];

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    $m['settings']['season'] = [
        'title' => mb_substr(trim((string)($_POST['title'] ?? '')), 0, 60) ?: 'Mevsim Seçkisi',
        'label' => mb_substr(trim((string)($_POST['label'] ?? '')), 0, 40),
        'subtitle' => mb_substr(trim((string)($_POST['subtitle'] ?? '')), 0, 160),
        'title_en' => mb_substr(trim((string)($_POST['title_en'] ?? '')), 0, 60),
        'label_en' => mb_substr(trim((string)($_POST['label_en'] ?? '')), 0, 40),
        'subtitle_en' => mb_substr(trim((string)($_POST['subtitle_en'] ?? '')), 0, 160),
    ];
    $m['settings']['announcement'] = mb_substr(trim((string)($_POST['announcement'] ?? '')), 0, 160);
    // seçkiye girecek ürünler
    $ids = (array)($_POST['seasonal'] ?? []);
    foreach ($m['products'] as &$p) $p['seasonal'] = in_array($p['id'], $ids, true);
    unset($p);
    menu_save($m);
    flash('Mevsim seçkisi kaydedildi; ana sayfa ve menü güncellendi.');
    redirect('/admin/settings.php');
}
admin_head('Mevsim & Ayarlar', 'settings'); ?>
<h1>Mevsim seçkisi</h1>
<p class="muted">Ana sayfadaki “seçki” bölümü ve menünün en üstündeki Sezonluk başlığı buradan yönetilir. Mevsim değişince başlığı güncelle, ürünleri işaretle.</p>
<form method="post" class="pform">
  <?= csrf_field() ?>
  <section class="card">
    <div class="grid2">
      <label class="fld">Başlık<input name="title" value="<?= h($s['season']['title']) ?>" maxlength="60"></label>
      <label class="fld">Etiket <small>(örn. Kış 2026)</small><input name="label" value="<?= h($s['season']['label']) ?>" maxlength="40"></label>
    </div>
    <label class="fld">Alt başlık<input name="subtitle" value="<?= h($s['season']['subtitle']) ?>" maxlength="160"></label>
    <div class="grid2">
      <label class="fld">Başlık (EN)<input name="title_en" value="<?= h($s['season']['title_en'] ?? '') ?>" maxlength="60" placeholder="Winter Specials"></label>
      <label class="fld">Etiket (EN)<input name="label_en" value="<?= h($s['season']['label_en'] ?? '') ?>" maxlength="40" placeholder="Winter 2026"></label>
    </div>
    <label class="fld">Alt başlık (EN)<input name="subtitle_en" value="<?= h($s['season']['subtitle_en'] ?? '') ?>" maxlength="160"></label>
  </section>
  <section class="card">
    <h2>Seçkideki ürünler</h2>
    <div class="checks checks--wrap">
      <?php foreach ($m['products'] as $p): ?>
        <label class="chk chk--pill"><input type="checkbox" name="seasonal[]" value="<?= h($p['id']) ?>"<?= !empty($p['seasonal']) ? ' checked' : '' ?>><span><?= h($p['name']) ?></span></label>
      <?php endforeach; ?>
    </div>
  </section>
  <div class="savebar"><button class="abtn" type="submit">Kaydet ve yayınla</button></div>
</form>
<?php admin_foot();
