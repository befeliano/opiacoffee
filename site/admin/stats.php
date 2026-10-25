<?php
require __DIR__ . '/bootstrap.php';
require_login();

$day = (string)($_GET['d'] ?? date('Y-m-d'));
if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $day)) $day = date('Y-m-d');
$stats = day_stats($day);

if (($_GET['csv'] ?? '') === '1') {
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="opia-satis-' . $day . '.csv"');
    $out = fopen('php://output', 'w');
    fwrite($out, "\xEF\xBB\xBF");
    fputcsv($out, ['Tarih', 'Ürün', 'Adet', 'Ciro (TL)'], ';', '"', '');
    foreach ($stats['items'] as $i) fputcsv($out, [$day, $i['name'], $i['qty'], number_format((float)$i['ciro'], 2, ',', '')], ';', '"', '');
    fputcsv($out, [$day, 'TOPLAM (' . $stats['orders'] . ' sipariş)', array_sum(array_column($stats['items'], 'qty')), number_format($stats['revenue'], 2, ',', '')], ';', '"', '');
    exit;
}

$days = db()->query("SELECT day, COUNT(*) n, SUM(total) ciro, SUM(item_count) adet FROM orders WHERE status != 'iptal' GROUP BY day ORDER BY day DESC LIMIT 60")->fetchAll();
$cancel = db()->prepare("SELECT COUNT(*) FROM orders WHERE day = ? AND status = 'iptal'"); $cancel->execute([$day]);
$cancelN = (int)$cancel->fetchColumn();
$avg = $stats['orders'] ? $stats['revenue'] / $stats['orders'] : 0;
$fmtDay = fn($d) => date('d.m.Y', strtotime($d));

admin_head('İstatistik', 'stats'); ?>
<div class="bar"><h1>İstatistik</h1>
  <form method="get" class="filters"><input type="date" name="d" value="<?= h($day) ?>" max="<?= date('Y-m-d') ?>" aria-label="Gün"><button class="abtn abtn--line" type="submit">Göster</button></form></div>

<div class="stats">
  <div class="stat"><b><?= $stats['orders'] ?></b><span>Sipariş <small><?= h($fmtDay($day)) ?></small></span></div>
  <div class="stat"><b><?= h(money($stats['revenue'])) ?></b><span>Ciro</span></div>
  <div class="stat"><b><?= array_sum(array_column($stats['items'], 'qty')) ?></b><span>Satılan ürün</span></div>
  <div class="stat"><b><?= h(money(round($avg))) ?></b><span>Ortalama sepet <?= $cancelN ? '<small>/ ' . $cancelN . ' iptal</small>' : '' ?></span></div>
</div>

<section class="card">
  <div class="bar"><h2>Ürün bazında: <?= h($fmtDay($day)) ?></h2>
    <?php if ($stats['items']): ?><a class="abtn abtn--line abtn--sm" href="?d=<?= h($day) ?>&csv=1">CSV indir</a><?php endif; ?></div>
  <?php if ($stats['items']): ?>
  <table class="atable"><thead><tr><th>Ürün</th><th>Adet</th><th>Ciro</th></tr></thead><tbody>
    <?php foreach ($stats['items'] as $i): ?><tr><td><?= h($i['name']) ?></td><td><?= (int)$i['qty'] ?></td><td><?= h(money($i['ciro'])) ?></td></tr><?php endforeach; ?>
  </tbody></table>
  <?php else: ?><p class="muted">Bu gün için QR sipariş kaydı yok.</p><?php endif; ?>
</section>

<section class="card">
  <h2>Günler</h2>
  <?php if ($days): ?>
  <table class="atable"><thead><tr><th>Gün</th><th>Sipariş</th><th>Ürün</th><th>Ciro</th></tr></thead><tbody>
    <?php foreach ($days as $d): ?><tr<?= $d['day'] === $day ? ' class="on"' : '' ?>><td><a href="?d=<?= h($d['day']) ?>"><?= h($fmtDay($d['day'])) ?></a></td><td><?= (int)$d['n'] ?></td><td><?= (int)$d['adet'] ?></td><td><?= h(money($d['ciro'])) ?></td></tr><?php endforeach; ?>
  </tbody></table>
  <?php else: ?><p class="muted">Henüz sipariş yok.</p><?php endif; ?>
  <p class="muted">İptal edilen siparişler hesaba katılmaz. Yalnızca QR üzerinden gelen siparişler sayılır; kasadan girilen satışlar burada görünmez.</p>
</section>
<?php admin_foot();
