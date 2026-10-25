<?php
require __DIR__ . '/bootstrap.php';
require_login(['owner', 'bar']);

$day = (string)($_GET['d'] ?? date('Y-m-d'));
if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $day) || $day > date('Y-m-d')) $day = date('Y-m-d');
if (!is_owner() && $day < date('Y-m-d', strtotime('-7 days'))) $day = date('Y-m-d');

if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['do'] ?? '') === 'close') {
    csrf_check();
    $s = day_stats($day);
    db()->prepare('INSERT INTO day_closes(day, closed_at, closed_by, summary) VALUES(?, ?, ?, ?) ON CONFLICT(day) DO UPDATE SET closed_at = excluded.closed_at, closed_by = excluded.closed_by, summary = excluded.summary')
        ->execute([$day, time(), (string)$_SESSION['user'], json_encode($s, JSON_UNESCAPED_UNICODE)]);
    // Sipariş notları gün sonunda silinir; siparişlerde kimlik bilgisi zaten yoktur.
    db()->prepare("UPDATE orders SET note = '' WHERE day = ?")->execute([$day]);
    db()->prepare("UPDATE calls SET status = 'kapandi', closed_at = ? WHERE status = 'acik'")->execute([time()]);
    if (!empty($_POST['reset_soldout'])) {
        $m = menu_load(); $n = 0;
        foreach ($m['products'] as &$p) if (!empty($p['soldout'])) { $p['soldout'] = false; $n++; }
        unset($p);
        if ($n) menu_save($m);
    }
    flash('Gün kapatıldı: ' . date('d.m.Y', strtotime($day)) . '. Rapor aşağıda; yazdırabilirsin.');
    redirect('/admin/dayend.php?d=' . $day);
}

$s = day_stats($day);
$closed = db()->prepare('SELECT * FROM day_closes WHERE day = ?'); $closed->execute([$day]);
$closed = $closed->fetch();
$open = db()->prepare("SELECT COUNT(*) FROM orders WHERE day = ? AND status IN ('yeni','hazirlaniyor')"); $open->execute([$day]);
$openN = (int)$open->fetchColumn();
$bills = array_filter(table_bills(), fn($b) => true);
$soldout = array_filter(menu_load()['products'], fn($p) => !empty($p['soldout']));
$history = db()->query('SELECT day, closed_at, closed_by, summary FROM day_closes ORDER BY day DESC LIMIT 14')->fetchAll();
$fmt = fn($d) => date('d.m.Y', strtotime($d));

admin_head('Gün sonu', 'dayend'); ?>
<div class="bar"><h1>Gün sonu <small><?= h($fmt($day)) ?></small></h1>
  <form method="get" class="filters noprint"><input type="date" name="d" value="<?= h($day) ?>" max="<?= date('Y-m-d') ?>" aria-label="Gün"><button class="abtn abtn--line" type="submit">Göster</button>
  <button class="abtn abtn--line" type="button" onclick="window.print()">Yazdır</button></form></div>

<?php if ($closed): ?><div class="flash flash--ok">Bu gün <?= h(date('d.m.Y H:i', (int)$closed['closed_at'])) ?> saatinde <?= h($closed['closed_by']) ?> tarafından kapatıldı.</div><?php endif; ?>
<?php if ($openN): ?><div class="flash flash--err noprint"><?= $openN ?> sipariş hâlâ yeni ya da hazırlanıyor. Kapatmadan önce bar ekranından teslim et ya da iptal et.</div><?php endif; ?>
<?php if ($bills): ?><div class="flash flash--err noprint">Ödenmemiş masa hesabı var: <?= h(implode(', ', array_map(fn($b) => 'Masa ' . $b['table_name'] . ' (' . money($b['total']) . ')', $bills))) ?>. <a href="/admin/bar.php">Bar ekranı, Masa hesapları</a> sekmesinden kapatabilirsin.</div><?php endif; ?>

<div class="stats">
  <div class="stat"><b><?= $s['orders'] ?></b><span>Sipariş<?= $s['cancelled'] ? ' <small>/ ' . $s['cancelled'] . ' iptal</small>' : '' ?></span></div>
  <div class="stat"><b><?= h(money($s['revenue'])) ?></b><span>Toplam ciro</span></div>
  <div class="stat"><b><?= h(money($s['cash'])) ?></b><span>Nakit</span></div>
  <div class="stat"><b><?= h(money($s['card'])) ?></b><span>Kart</span></div>
</div>
<?php if ($s['unpaid'] > 0): ?><p class="muted">Ödemesi alınmamış: <b><?= h(money($s['unpaid'])) ?></b></p><?php endif; ?>

<section class="card">
  <h2>Satılan ürünler</h2>
  <?php if ($s['items']): ?>
  <table class="atable"><thead><tr><th>Ürün</th><th>Adet</th><th>Tutar</th></tr></thead><tbody>
    <?php foreach ($s['items'] as $i): ?><tr><td><?= h($i['name']) ?></td><td><?= (int)$i['qty'] ?></td><td><?= h(money($i['ciro'])) ?></td></tr><?php endforeach; ?>
    <tr><td><b>Toplam</b></td><td><b><?= array_sum(array_column($s['items'], 'qty')) ?></b></td><td><b><?= h(money($s['revenue'])) ?></b></td></tr>
  </tbody></table>
  <?php else: ?><p class="muted">Bu gün QR sipariş yok.</p><?php endif; ?>
</section>

<?php if ($day === date('Y-m-d') || is_owner()): ?>
<section class="card noprint">
  <h2>Günü kapat</h2>
  <p class="muted">Kapanış raporu kaydedilir, açık garson çağrıları temizlenir ve sipariş notları silinir. Kapattıktan sonra gelen siparişler aynı güne eklenir; gerekirse günü yeniden kapatabilirsin.</p>
  <form method="post" class="pform"><?= csrf_field() ?><input type="hidden" name="do" value="close">
    <label class="chk"><input type="checkbox" name="reset_soldout" value="1" checked><span>Tükendi işaretlerini sıfırla<?= $soldout ? ' (' . count($soldout) . ' ürün: ' . h(implode(', ', array_map(fn($p) => $p['name'], $soldout))) . ')' : '' ?></span></label>
    <button class="abtn" type="submit" data-confirm="<?= h($fmt($day)) ?> günü kapatılsın mı?"><?= $closed ? 'Günü yeniden kapat' : 'Günü kapat' ?></button>
  </form>
</section>
<?php endif; ?>

<?php if ($history): ?>
<section class="card noprint">
  <h2>Kapanmış günler</h2>
  <table class="atable"><thead><tr><th>Gün</th><th>Sipariş</th><th>Nakit</th><th>Kart</th><th>Toplam</th></tr></thead><tbody>
  <?php foreach ($history as $hrow): $sm = json_decode($hrow['summary'], true) ?: []; ?>
    <tr><td><a href="?d=<?= h($hrow['day']) ?>"><?= h($fmt($hrow['day'])) ?></a></td><td><?= (int)($sm['orders'] ?? 0) ?></td><td><?= h(money($sm['cash'] ?? 0)) ?></td><td><?= h(money($sm['card'] ?? 0)) ?></td><td><?= h(money($sm['revenue'] ?? 0)) ?></td></tr>
  <?php endforeach; ?>
  </tbody></table>
</section>
<?php endif; ?>
<?php admin_foot();
