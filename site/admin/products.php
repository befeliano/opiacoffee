<?php
require __DIR__ . '/bootstrap.php';
require_login();
$m = menu_load();
$cats = []; foreach ($m['categories'] as $c) $cats[$c['id']] = $c['name'];

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    $id = (string)($_POST['id'] ?? ''); $do = $_POST['do'] ?? '';
    $i = product_index($m, $id);
    if ($i > -1) {
        $p = &$m['products'][$i];
        if ($do === 'toggle') { $p['available'] = empty($p['available']); flash($p['name'] . ($p['available'] ? ' yayına alındı.' : ' gizlendi.')); }
        elseif ($do === 'soldout') { $p['soldout'] = empty($p['soldout']); flash($p['name'] . ($p['soldout'] ? ' tükendi olarak işaretlendi.' : ' tekrar satışta.')); }
        elseif ($do === 'season') { $p['seasonal'] = empty($p['seasonal']); flash($p['name'] . ($p['seasonal'] ? ' mevsim seçkisine eklendi.' : ' seçkiden çıkarıldı.')); }
        elseif ($do === 'delete') { delete_upload($p['image'] ?? ''); $n = $p['name']; unset($p); array_splice($m['products'], $i, 1); flash($n . ' silindi.'); }
        elseif ($do === 'up' || $do === 'down') {
            // aynı kategorideki komşuyla sıra değiştir
            $siblings = array_keys(array_filter($m['products'], fn($x) => $x['category'] === $p['category']));
            usort($siblings, fn($a, $b) => $m['products'][$a]['sort'] <=> $m['products'][$b]['sort']);
            $pos = array_search($i, $siblings, true);
            $swap = $do === 'up' ? $pos - 1 : $pos + 1;
            if (isset($siblings[$swap])) {
                $a = $siblings[$pos]; $b = $siblings[$swap];
                [$m['products'][$a]['sort'], $m['products'][$b]['sort']] = [$m['products'][$b]['sort'], $m['products'][$a]['sort']];
            }
        } elseif ($do === 'dup') {
            $c = $p; $c['id'] = $c['id'] . '-kopya'; $c['name'] .= ' (kopya)'; $c['available'] = false; $c['image'] = '';
            $c['sort'] = max(array_column($m['products'], 'sort')) + 1;
            $k = 2; while (product_index($m, $c['id']) > -1) $c['id'] = $p['id'] . '-kopya-' . $k++;
            $m['products'][] = $c; flash('Kopya oluşturuldu (gizli).');
        }
        unset($p);
        menu_save($m);
    }
    parse_str((string)($_POST['back'] ?? ''), $bq);
    $bq = array_intersect_key($bq, ['f' => 1, 'c' => 1, 'q' => 1]);
    redirect('/admin/products.php' . ($bq ? '?' . http_build_query($bq) : '') . '#p-' . rawurlencode($id));
}

$f = $_GET['f'] ?? ''; $cat = $_GET['c'] ?? ''; $q = mb_strtolower(trim($_GET['q'] ?? ''), 'UTF-8');
$list = array_values(array_filter($m['products'], function ($p) use ($f, $cat, $q) {
    if ($cat && $p['category'] !== $cat) return false;
    if ($f === 'season' && empty($p['seasonal'])) return false;
    if ($f === 'noimg' && !empty($p['image'])) return false;
    if ($f === 'hidden' && !empty($p['available'])) return false;
    if ($q && mb_strpos(mb_strtolower($p['name'], 'UTF-8'), $q) === false) return false;
    return true;
}));
usort($list, function ($a, $b) use ($m) {
    $ca = array_search($a['category'], array_column($m['categories'], 'id')); $cb = array_search($b['category'], array_column($m['categories'], 'id'));
    return [$ca, $a['sort']] <=> [$cb, $b['sort']];
});
$back = http_build_query(array_filter(['f' => $f, 'c' => $cat, 'q' => $_GET['q'] ?? '']));

admin_head('Ürünler', 'products'); ?>
<div class="bar"><h1>Ürünler <small><?= count($list) ?></small></h1><a class="abtn" href="/admin/product.php">+ Yeni ürün</a></div>

<form class="filters" method="get">
  <input type="search" name="q" value="<?= h($_GET['q'] ?? '') ?>" placeholder="Ara">
  <select name="c" aria-label="Kategori"><option value="">Tüm kategoriler</option>
    <?php foreach ($cats as $id => $n): ?><option value="<?= h($id) ?>"<?= $cat === $id ? ' selected' : '' ?>><?= h($n) ?></option><?php endforeach; ?></select>
  <select name="f" aria-label="Filtre">
    <option value="">Hepsi</option><option value="season"<?= $f === 'season' ? ' selected' : '' ?>>Sezonluk</option>
    <option value="noimg"<?= $f === 'noimg' ? ' selected' : '' ?>>Fotoğrafsız</option><option value="hidden"<?= $f === 'hidden' ? ' selected' : '' ?>>Gizli</option></select>
  <button class="abtn abtn--line" type="submit">Filtrele</button>
</form>

<ul class="plist">
<?php foreach ($list as $p): ?>
  <li class="prow<?= empty($p['available']) ? ' off' : '' ?>" id="p-<?= h($p['id']) ?>">
    <a class="prow__img" href="/admin/product.php?id=<?= h($p['id']) ?>"><?php if (!empty($p['image'])): ?><img src="/uploads/<?= h($p['image']) ?>" alt="" loading="lazy"><?php else: ?><span>Foto yok</span><?php endif; ?></a>
    <div class="prow__main">
      <a class="prow__name" lang="<?= h($p['lang'] ?? 'tr') ?>" href="/admin/product.php?id=<?= h($p['id']) ?>"><?= h($p['name']) ?></a>
      <p class="muted"><?= h($cats[$p['category']] ?? $p['category']) ?> / <?= h(money($p['price'])) ?>
        <?= !empty($p['seasonal']) ? ' / <b class="tag">SEZONLUK</b>' : '' ?><?= empty($p['available']) ? ' / <b class="tag tag--off">GİZLİ</b>' : '' ?><?= !empty($p['soldout']) ? ' / <b class="tag tag--off">TÜKENDİ</b>' : '' ?>
        <?= !empty($p['allergens']) ? ' / ' . count($p['allergens']) . ' alerjen' : '' ?></p>
    </div>
    <form class="prow__acts" method="post">
      <?= csrf_field() ?><input type="hidden" name="id" value="<?= h($p['id']) ?>"><input type="hidden" name="back" value="<?= h($back) ?>">
      <button name="do" value="up" title="Yukarı" aria-label="Yukarı taşı">↑</button>
      <button name="do" value="down" title="Aşağı" aria-label="Aşağı taşı">↓</button>
      <button name="do" value="toggle"><?= !empty($p['available']) ? 'Gizle' : 'Yayınla' ?></button>
      <button name="do" value="soldout"><?= !empty($p['soldout']) ? 'Satışa al' : 'Tükendi' ?></button>
      <button name="do" value="season"><?= !empty($p['seasonal']) ? 'Seçkiden çıkar' : 'Seçkiye ekle' ?></button>
      <a class="btnlike" href="/admin/product.php?id=<?= h($p['id']) ?>">Düzenle</a>
      <button name="do" value="dup">Kopyala</button>
      <button name="do" value="delete" class="danger" data-confirm="“<?= h($p['name']) ?>” kalıcı olarak silinsin mi?">Sil</button>
    </form>
  </li>
<?php endforeach; ?>
<?php if (!$list): ?><li class="muted pad">Ürün bulunamadı.</li><?php endif; ?>
</ul>
<?php admin_foot();
