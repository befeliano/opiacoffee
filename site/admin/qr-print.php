<?php
require __DIR__ . '/bootstrap.php';
require_login();
$tables = db()->query('SELECT * FROM tables ORDER BY sort, id')->fetchAll();
?><!doctype html>
<html lang="tr"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow"><title>QR kodlar | Opia</title>
<link rel="stylesheet" href="/assets/css/fonts.css">
<style>
  @page { size: A4; margin: 10mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: 'Barlow', Arial, sans-serif; color: #0a0a0a; background: #f2f2f0; }
  .tools { padding: 14px; display: flex; gap: 10px; align-items: center; font-size: 14px; }
  .tools button { font: 500 13px 'Oswald', sans-serif; letter-spacing: .14em; text-transform: uppercase; padding: 12px 18px; background: #0a0a0a; color: #fff; border: 0; cursor: pointer; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(62mm, 1fr)); gap: 6mm; padding: 6mm; }
  .tag { background: #fff; border: 1px solid #0a0a0a; padding: 7mm 6mm 6mm; display: grid; justify-items: center; gap: 3mm; text-align: center; break-inside: avoid; }
  .logo { line-height: 1; display: grid; justify-items: center; }
  .logo b { font: 400 34px/.9 'Oswald', sans-serif; letter-spacing: .04em; }
  .logo span { font: 400 8px 'Oswald', sans-serif; letter-spacing: .42em; margin-top: 3px; margin-right: -.42em; }
  .qr { width: 42mm; height: 42mm; }
  .qr svg { width: 100%; height: 100%; display: block; }
  .no { font: 500 22px/1 'Oswald', sans-serif; letter-spacing: .12em; text-transform: uppercase; }
  .hint { font-size: 11px; line-height: 1.4; color: #333; }
  @media print { .tools { display: none; } body { background: #fff; } .grid { padding: 0; } }
</style>
</head><body>
<div class="tools"><button onclick="window.print()">Yazdır</button><span><?= count($tables) ?> masa. Kartları kesip masalara yerleştir.</span></div>
<div class="grid">
<?php foreach ($tables as $t): ?>
  <div class="tag">
    <div class="logo"><b>OPIA</b><span>COFFEE CO</span></div>
    <div class="qr" data-qr="<?= h(url('/m/' . $t['token'])) ?>"></div>
    <div class="no">Masa <?= h($t['name']) ?></div>
    <div class="hint">Kameranla okut: menüye bak, sipariş ver, garson çağır.<br>Ödeme kasada ya da masada.</div>
  </div>
<?php endforeach; ?>
</div>
<script src="/admin/assets/qr.js?v=<?= filemtime(__DIR__ . '/assets/qr.js') ?>"></script>
<script>
document.querySelectorAll('[data-qr]').forEach(function (el) {
  el.innerHTML = QR.svg(el.getAttribute('data-qr'), 2);
});
</script>
</body></html>
