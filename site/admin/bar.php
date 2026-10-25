<?php
require __DIR__ . '/bootstrap.php';
require_login(['owner', 'bar']);
?><!doctype html>
<html lang="tr"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow"><meta name="theme-color" content="#0a0a0a">
<title>Bar | Opia Yönetim</title>
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/assets/css/fonts.css">
<link rel="stylesheet" href="/admin/assets/admin.css?v=<?= filemtime(__DIR__ . '/assets/admin.css') ?>">
<link rel="stylesheet" href="/admin/assets/bar.css?v=<?= filemtime(__DIR__ . '/assets/bar.css') ?>">
</head>
<body class="barpage" data-csrf="<?= h(csrf()) ?>">
<header class="bh">
  <a class="bh__logo" href="<?= is_owner() ? '/admin/' : '/admin/bar.php' ?>"><b>OPIA</b><span>BAR</span></a>
  <span class="bh__clock" data-clock></span>
  <span class="bh__state" data-state></span>
  <div class="bh__acts">
    <button type="button" class="bbtn" data-sound aria-pressed="false">Sesi aç</button>
    <a class="bbtn" href="/admin/dayend.php">Gün sonu</a>
    <?php if (is_owner()): ?><a class="bbtn" href="/admin/tables.php">Masalar</a><a class="bbtn" href="/admin/stats.php">İstatistik</a><?php endif; ?>
    <form method="post" action="/admin/logout.php"><?= csrf_field() ?><button class="bbtn bbtn--ghost" type="submit">Çıkış</button></form>
  </div>
</header>

<nav class="btabs" role="tablist" aria-label="Bar bölümleri">
  <button type="button" role="tab" aria-selected="true" data-tab="orders">Siparişler <i data-n-orders>0</i></button>
  <button type="button" role="tab" aria-selected="false" data-tab="bills">Masa hesapları <i data-n-bills>0</i></button>
  <button type="button" role="tab" aria-selected="false" data-tab="stock">Tükendi <i data-n-soldout>0</i></button>
</nav>

<div class="bcalls" data-calls hidden></div>

<main class="bmain" data-panel="orders">
  <section class="bcol">
    <h2>Yeni <i data-n-yeni>0</i></h2>
    <div class="blist" data-col="yeni"><p class="bempty">Yeni sipariş yok.</p></div>
  </section>
  <section class="bcol">
    <h2>Hazırlanıyor <i data-n-hazirlaniyor>0</i></h2>
    <div class="blist" data-col="hazirlaniyor"><p class="bempty">Hazırlanan sipariş yok.</p></div>
  </section>
  <aside class="bside">
    <h2>Bugün</h2>
    <dl class="bstats">
      <div><dt>Sipariş</dt><dd data-s-orders>0</dd></div>
      <div><dt>Ciro</dt><dd data-s-revenue>0 ₺</dd></div>
      <div><dt>Açık hesap</dt><dd data-s-unpaid>0 ₺</dd></div>
    </dl>
    <h3>En çok satanlar</h3>
    <ol class="btop" data-top></ol>
    <h3>Son teslim edilenler</h3>
    <ul class="brecent" data-recent></ul>
  </aside>
</main>

<main class="bwide" data-panel="bills" hidden>
  <p class="bhint">Ödemesi alınmamış siparişler masa bazında toplanır. Ödeme alınınca yöntemini seçip hesabı kapat. Masanın QR siparişini buradan da kapatabilirsin.</p>
  <div class="bbills" data-bills></div>
  <h2 class="bsub">Masalar</h2>
  <div class="btables" data-tables></div>
</main>

<main class="bwide" data-panel="stock" hidden>
  <p class="bhint">Biten ürüne dokun: menüde “Tükendi” görünür ve QR’dan sipariş verilemez. Tekrar dokununca geri gelir. Gün sonunda istersen hepsi sıfırlanır.</p>
  <input type="search" class="bsearch" data-stock-search placeholder="Ürün ara" aria-label="Ürün ara">
  <div class="bstock" data-stock><p class="bempty">Yükleniyor</p></div>
</main>
<script src="/admin/assets/bar.js?v=<?= filemtime(__DIR__ . '/assets/bar.js') ?>" defer></script>
</body></html>
