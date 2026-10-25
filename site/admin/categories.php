<?php
require __DIR__ . '/bootstrap.php';
require_login();
$m = menu_load();

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    $do = $_POST['do'] ?? '';
    if ($do === 'add') {
        $name = trim((string)($_POST['name'] ?? ''));
        if ($name === '') flash('Kategori adı gerekli.', 'err');
        else {
            $id = slugify($name); $base = $id; $k = 2;
            while (in_array($id, array_column($m['categories'], 'id'), true)) $id = $base . '-' . $k++;
            $m['categories'][] = ['id' => $id, 'name' => mb_substr($name, 0, 40), 'note' => mb_substr(trim((string)($_POST['note'] ?? '')), 0, 120), 'name_en' => mb_substr(trim((string)($_POST['name_en'] ?? '')), 0, 40), 'note_en' => '',
                'sort' => ($m['categories'] ? max(array_column($m['categories'], 'sort')) : 0) + 1];
            menu_save($m); flash('Kategori eklendi.');
        }
    } elseif ($do === 'save') {
        foreach ($m['categories'] as &$c) {
            if (isset($_POST['name'][$c['id']])) {
                $c['name'] = mb_substr(trim((string)$_POST['name'][$c['id']]), 0, 40) ?: $c['name'];
                $c['note'] = mb_substr(trim((string)($_POST['note'][$c['id']] ?? '')), 0, 120);
                $c['name_en'] = mb_substr(trim((string)($_POST['name_en'][$c['id']] ?? '')), 0, 40);
                $c['note_en'] = mb_substr(trim((string)($_POST['note_en'][$c['id']] ?? '')), 0, 120);
                $c['sort'] = (int)($_POST['sort'][$c['id']] ?? $c['sort']);
            }
        } unset($c);
        menu_save($m); flash('Kategoriler kaydedildi.');
    } elseif ($do === 'delete') {
        $id = (string)($_POST['id'] ?? '');
        if (array_filter($m['products'], fn($p) => $p['category'] === $id)) flash('İçinde ürün olan kategori silinemez. Önce ürünleri taşı ya da sil.', 'err');
        else { $m['categories'] = array_values(array_filter($m['categories'], fn($c) => $c['id'] !== $id)); menu_save($m); flash('Kategori silindi.'); }
    }
    redirect('/admin/categories.php');
}
usort($m['categories'], fn($a, $b) => $a['sort'] <=> $b['sort']);
$count = fn($id) => count(array_filter($m['products'], fn($p) => $p['category'] === $id));

admin_head('Kategoriler', 'categories'); ?>
<h1>Kategoriler</h1>
<form method="post" class="card">
  <?= csrf_field() ?><input type="hidden" name="do" value="save">
  <?php foreach ($m['categories'] as $c): ?>
  <div class="crow">
    <label class="fld">Ad<input name="name[<?= h($c['id']) ?>]" value="<?= h($c['name']) ?>" maxlength="40"></label>
    <label class="fld">Not <small>(menüde başlık altında)</small><input name="note[<?= h($c['id']) ?>]" value="<?= h($c['note'] ?? '') ?>" maxlength="120"></label>
    <label class="fld">Ad (EN)<input name="name_en[<?= h($c['id']) ?>]" value="<?= h($c['name_en'] ?? '') ?>" maxlength="40"></label>
    <label class="fld">Not (EN)<input name="note_en[<?= h($c['id']) ?>]" value="<?= h($c['note_en'] ?? '') ?>" maxlength="120"></label>
    <label class="fld fld--sm">Sıra<input name="sort[<?= h($c['id']) ?>]" type="number" value="<?= (int)$c['sort'] ?>"></label>
    <div class="crow__meta"><span class="muted"><?= $count($c['id']) ?> ürün</span>
      <button class="danger" type="submit" name="do" value="delete" formaction="/admin/categories.php" data-confirm="Kategori silinsin mi?" onclick="this.form.querySelector('[name=id]')?.remove();var i=document.createElement('input');i.type='hidden';i.name='id';i.value='<?= h($c['id']) ?>';this.form.appendChild(i)">Sil</button></div>
  </div>
  <?php endforeach; ?>
  <button class="abtn" type="submit">Kaydet</button>
</form>

<form method="post" class="card">
  <h2>Yeni kategori</h2>
  <?= csrf_field() ?><input type="hidden" name="do" value="add">
  <div class="grid2">
    <label class="fld">Ad<input name="name" maxlength="40" required></label>
    <label class="fld">Not<input name="note" maxlength="120"></label>
  </div>
  <button class="abtn abtn--line" type="submit">Ekle</button>
</form>
<?php admin_foot();
