<?php
require __DIR__ . '/bootstrap.php';
require_login();

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    $do = (string)($_POST['do'] ?? '');
    $id = (int)($_POST['id'] ?? 0);
    $pdo = db();
    if ($do === 'global') {
        setting_set('ordering', ordering_global() ? '0' : '1');
        flash(ordering_global() ? 'QR sipariş tüm masalarda açıldı.' : 'QR sipariş kapatıldı: tüm QR kodlar düz menüye yönlenir.');
    } elseif ($do === 'hours') {
        setting_set('enforce_hours', setting('enforce_hours', '1') === '1' ? '0' : '1');
        flash(setting('enforce_hours') === '1' ? 'Sipariş yalnızca çalışma saatlerinde alınır.' : 'Saat kısıtı kaldırıldı (test / özel gün).');
    } elseif ($do === 'add') {
        $from = (int)($_POST['from'] ?? 0); $to = (int)($_POST['to'] ?? 0); $name = trim((string)($_POST['name'] ?? ''));
        $names = [];
        if ($name !== '') $names[] = mb_substr($name, 0, 20);
        elseif ($from > 0 && $to >= $from && $to - $from < 100) for ($i = $from; $i <= $to; $i++) $names[] = (string)$i;
        if (!$names) flash('Masa adı ya da geçerli bir aralık gir (en fazla 100 masa).', 'err');
        else {
            $max = (int)$pdo->query('SELECT COALESCE(MAX(sort), 0) FROM tables')->fetchColumn();
            $ins = $pdo->prepare('INSERT INTO tables(name, token, sort, created_at) VALUES(?, ?, ?, ?)');
            foreach ($names as $n) $ins->execute([$n, new_token(), ++$max, time()]);
            flash(count($names) . ' masa eklendi.');
        }
    } elseif ($do === 'toggle') {
        $pdo->prepare('UPDATE tables SET ordering = 1 - ordering WHERE id = ?')->execute([$id]);
        flash('Masanın sipariş durumu değiştirildi.');
    } elseif ($do === 'rename') {
        $n = mb_substr(trim((string)($_POST['name'] ?? '')), 0, 20);
        if ($n !== '') { $pdo->prepare('UPDATE tables SET name = ? WHERE id = ?')->execute([$n, $id]); flash('Masa adı güncellendi.'); }
    } elseif ($do === 'token') {
        $pdo->prepare('UPDATE tables SET token = ? WHERE id = ?')->execute([new_token(), $id]);
        flash('Yeni QR kodu oluşturuldu. Eski QR artık çalışmaz; yenisini yazdır.');
    } elseif ($do === 'delete') {
        $pdo->prepare('DELETE FROM tables WHERE id = ?')->execute([$id]);
        flash('Masa silindi. Geçmiş siparişler istatistikte kalır.');
    }
    redirect('/admin/tables.php');
}

$tables = db()->query('SELECT * FROM tables ORDER BY sort, id')->fetchAll();
$open = db()->query("SELECT table_id, COUNT(*) n FROM orders WHERE status IN ('yeni','hazirlaniyor') GROUP BY table_id")->fetchAll(PDO::FETCH_KEY_PAIR);
$global = ordering_global();
$hours = setting('enforce_hours', '1') === '1';

admin_head('Masalar & QR', 'tables'); ?>
<div class="bar"><h1>Masalar & QR <small><?= count($tables) ?></small></h1>
  <?php if ($tables): ?><a class="abtn" href="/admin/qr-print.php" target="_blank" rel="noopener">QR kodları yazdır</a><?php endif; ?></div>

<section class="card">
  <div class="toggle-row">
    <div><h2>QR sipariş</h2><p class="muted"><?= $global ? 'Açık. Masa QR kodları sipariş moduna açılır.' : 'Kapalı. Tüm masa QR kodları düz menüye (/menu/) yönlenir.' ?></p></div>
    <form method="post"><?= csrf_field() ?><input type="hidden" name="do" value="global"><button class="abtn<?= $global ? ' abtn--line' : '' ?>" type="submit"><?= $global ? 'Tümünü kapat' : 'Tümünü aç' ?></button></form>
  </div>
  <div class="toggle-row">
    <div><h2>Saat kısıtı</h2><p class="muted"><?= $hours ? 'Sipariş yalnızca ' . h(cfg('hours')['open']) . ' - 00:00 arasında alınır.' : 'Kapalı: siparişler her saatte alınır.' ?></p></div>
    <form method="post"><?= csrf_field() ?><input type="hidden" name="do" value="hours"><button class="abtn abtn--line" type="submit"><?= $hours ? 'Kısıtı kaldır' : 'Kısıtı aç' ?></button></form>
  </div>
</section>

<section class="card">
  <h2>Masa ekle</h2>
  <form method="post" class="grid3"><?= csrf_field() ?><input type="hidden" name="do" value="add">
    <label class="fld">Aralık başı<input name="from" type="number" min="1" inputmode="numeric" placeholder="1"></label>
    <label class="fld">Aralık sonu<input name="to" type="number" min="1" inputmode="numeric" placeholder="12"></label>
    <label class="fld">ya da tek ad<input name="name" maxlength="20" placeholder="Bahçe 1"></label>
    <button class="abtn" type="submit">Ekle</button>
  </form>
</section>

<ul class="tlist">
<?php foreach ($tables as $t): $link = url('/m/' . $t['token']); ?>
  <li class="trow<?= $t['ordering'] ? '' : ' off' ?>">
    <div class="trow__qr" data-qr="<?= h($link) ?>"></div>
    <div class="trow__main">
      <form method="post" class="trow__name"><?= csrf_field() ?><input type="hidden" name="do" value="rename"><input type="hidden" name="id" value="<?= (int)$t['id'] ?>">
        <span>Masa</span><input name="name" value="<?= h($t['name']) ?>" maxlength="20" aria-label="Masa adı"><button type="submit" class="btnlike">Kaydet</button></form>
      <p class="muted">QR: <a href="/m/<?= h($t['token']) ?>" target="_blank" rel="noopener"><?= h($link) ?></a></p>
      <p class="muted"><?= $t['ordering'] && $global ? '<b class="tag">SİPARİŞ AÇIK</b>' : '<b class="tag tag--off">DÜZ MENÜYE YÖNLENİR</b>' ?><?= !empty($open[$t['id']]) ? ' / ' . (int)$open[$t['id']] . ' açık sipariş' : '' ?></p>
    </div>
    <div class="trow__acts">
      <form method="post"><?= csrf_field() ?><input type="hidden" name="id" value="<?= (int)$t['id'] ?>">
        <button name="do" value="toggle" class="abtn<?= $t['ordering'] ? ' abtn--line' : '' ?> abtn--sm"><?= $t['ordering'] ? 'Siparişi kapat' : 'Siparişi aç' ?></button>
        <button name="do" value="token" class="btnlike" data-confirm="Yeni QR oluşturulsun mu? Masadaki eski QR çalışmaz hâle gelir.">Yeni QR</button>
        <button name="do" value="delete" class="btnlike danger" data-confirm="Masa <?= h($t['name']) ?> silinsin mi?">Sil</button>
      </form>
    </div>
  </li>
<?php endforeach; ?>
<?php if (!$tables): ?><li class="muted pad">Henüz masa yok. Yukarıdan aralık girerek (ör. 1 - 12) masaları ekle.</li><?php endif; ?>
</ul>
<p class="muted">QR adresleri sitenin yayın alan adını kullanır (<?= h(cfg('url')) ?>). Alan adı değişirse <code>_src/config.php</code> içindeki <code>url</code> değerini güncelleyip QR’ları yeniden yazdır. Yerelde denemek için bağlantıya tıklayabilirsin.</p>
<script src="/admin/assets/qr.js?v=<?= filemtime(__DIR__ . '/assets/qr.js') ?>"></script>
<script>
document.querySelectorAll('[data-qr]').forEach(function (el) {
  el.innerHTML = QR.svg(el.getAttribute('data-qr'), 2);
});
</script>
<?php admin_foot();
