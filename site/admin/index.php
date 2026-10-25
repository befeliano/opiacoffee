<?php
require __DIR__ . '/bootstrap.php';
require_login();
$m = menu_load();

if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['do'] ?? '') === 'rebuild') {
    csrf_check();
    $r = opia_build();
    flash(count($r) . ' sayfa yeniden oluşturuldu (sitemap.xml dahil).');
    redirect('/admin/');
}

$total = count($m['products']);
$live = count(array_filter($m['products'], fn($p) => $p['available']));
$seasonal = count(array_filter($m['products'], fn($p) => !empty($p['seasonal']) && $p['available']));
$noImg = count(array_filter($m['products'], fn($p) => empty($p['image'])));
$soldout = count(array_filter($m['products'], fn($p) => !empty($p['soldout'])));
$today = day_stats(date('Y-m-d'));
$openOrders = (int)db()->query("SELECT COUNT(*) FROM orders WHERE status IN ('yeni','hazirlaniyor')")->fetchColumn();

admin_head('Panel', 'index'); ?>
<h1>Panel</h1>
<div class="stats">
  <a class="stat" href="/admin/bar.php"><b><?= $openOrders ?></b><span>Açık sipariş</span></a>
  <a class="stat" href="/admin/stats.php"><b><?= $today['orders'] ?></b><span>Bugün QR sipariş</span></a>
  <a class="stat" href="/admin/stats.php"><b><?= h(money($today['revenue'])) ?></b><span>Bugün ciro</span></a>
  <a class="stat" href="/admin/tables.php"><b><?= ordering_global() ? 'Açık' : 'Kapalı' ?></b><span>QR sipariş</span></a>
</div>
<div class="stats">
  <a class="stat" href="/admin/products.php"><b><?= $live ?></b><span>Yayında ürün <small>/ <?= $total ?></small></span></a>
  <a class="stat" href="/admin/products.php?f=season"><b><?= $seasonal ?></b><span>Sezonluk ürün</span></a>
  <a class="stat" href="/admin/products.php?f=noimg"><b><?= $noImg ?></b><span>Fotoğrafı eksik</span></a>
  <a class="stat" href="/admin/bar.php"><b><?= $soldout ?></b><span>Tükendi işaretli</span></a>
</div>

<section class="card">
  <h2>Hızlı işlemler</h2>
  <div class="btns">
    <a class="abtn" href="/admin/product.php">+ Yeni ürün</a>
    <a class="abtn abtn--line" href="/admin/settings.php">Mevsim seçkisini düzenle</a>
    <a class="abtn abtn--line" href="/menu/" target="_blank" rel="noopener">Menüyü gör ↗</a>
  </div>
</section>

<section class="card">
  <h2>Yayın</h2>
  <p>Her kaydetme sonrası menü ve ana sayfa otomatik güncellenir. Şablon ya da yasal metinlerde elle değişiklik yaptıysan siteyi buradan yeniden oluşturabilirsin.</p>
  <p class="muted">Son menü güncellemesi: <?= h(date('d.m.Y H:i', strtotime($m['updatedAt'] ?? 'now'))) ?></p>
  <form method="post"><?= csrf_field() ?><input type="hidden" name="do" value="rebuild"><button class="abtn abtn--line" type="submit">Siteyi yeniden oluştur</button></form>
</section>
<?php admin_foot();
