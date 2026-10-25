<?php
require __DIR__ . '/bootstrap.php';
require_login(['owner', 'bar']);
$me = (string)$_SESSION['user'];
$err = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    $do = (string)($_POST['do'] ?? '');
    $users = auth_users();
    $mine = auth_find($me);
    if ($do === 'self') {
        $new = (string)($_POST['new'] ?? '');
        if (!password_verify((string)($_POST['current'] ?? ''), $mine['hash'])) $err = 'Mevcut şifre hatalı.';
        elseif (strlen($new) < 10) $err = 'Yeni şifre en az 10 karakter olmalı.';
        elseif ($new !== (string)($_POST['new2'] ?? '')) $err = 'Yeni şifreler eşleşmiyor.';
        else {
            foreach ($users as &$u) if ($u['user'] === $me) $u['hash'] = password_hash($new, PASSWORD_DEFAULT);
            unset($u); auth_save($users); session_regenerate_id(true);
            flash('Şifren değiştirildi.'); redirect('/admin/account.php');
        }
    } elseif (is_owner() && $do === 'bar') {
        $name = trim((string)($_POST['user'] ?? '')); $pass = (string)($_POST['pass'] ?? '');
        $existing = array_values(array_filter($users, fn($u) => $u['role'] === 'bar'));
        if (!preg_match('/^[A-Za-z0-9._-]{3,30}$/', $name)) $err = 'Kullanıcı adı 3-30 karakter olmalı (harf, rakam, . _ -).';
        elseif (auth_find($name) && auth_find($name)['role'] !== 'bar') $err = 'Bu kullanıcı adı sahip hesabına ait.';
        elseif (!$existing && strlen($pass) < 8) $err = 'Bar hesabı için en az 8 karakterlik bir şifre gir.';
        elseif ($pass !== '' && strlen($pass) < 8) $err = 'Şifre en az 8 karakter olmalı.';
        else {
            $users = array_values(array_filter($users, fn($u) => $u['role'] !== 'bar'));
            $hash = $pass !== '' ? password_hash($pass, PASSWORD_DEFAULT) : $existing[0]['hash'];
            $users[] = ['user' => $name, 'hash' => $hash, 'role' => 'bar'];
            auth_save($users);
            flash('Bar hesabı kaydedildi: ' . $name . '. Bu hesap yalnızca bar ekranı, masa hesabı, tükendi ve gün sonunu görebilir.');
            redirect('/admin/account.php');
        }
    } elseif (is_owner() && $do === 'bar-delete') {
        auth_save(array_values(array_filter($users, fn($u) => $u['role'] !== 'bar')));
        flash('Bar hesabı silindi; açık oturumu da kapandı.'); redirect('/admin/account.php');
    } elseif (is_owner() && $do === 'owner-name') {
        $name = trim((string)($_POST['user'] ?? ''));
        if (!preg_match('/^[A-Za-z0-9._-]{3,30}$/', $name)) $err = 'Kullanıcı adı 3-30 karakter olmalı.';
        elseif ($name !== $me && auth_find($name)) $err = 'Bu kullanıcı adı kullanılıyor.';
        else {
            foreach ($users as &$u) if ($u['user'] === $me) $u['user'] = $name;
            unset($u); auth_save($users); $_SESSION['user'] = $name;
            flash('Kullanıcı adın güncellendi.'); redirect('/admin/account.php');
        }
    }
}
$bar = array_values(array_filter(auth_users(), fn($u) => $u['role'] === 'bar'))[0] ?? null;

admin_head('Hesaplar', 'account'); ?>
<h1><?= is_owner() ? 'Hesaplar' : 'Hesabım' ?></h1>
<?php if ($err): ?><div class="flash flash--err" role="alert"><?= h($err) ?></div><?php endif; ?>

<section class="card narrowf">
  <h2>Şifremi değiştir <small class="muted">(<?= h($me) ?>, <?= h(ROLES[role()]) ?>)</small></h2>
  <form method="post" class="pform"><?= csrf_field() ?><input type="hidden" name="do" value="self">
    <label class="fld">Mevcut şifre<input name="current" type="password" autocomplete="current-password" required></label>
    <label class="fld">Yeni şifre <small>(en az 10 karakter)</small><input name="new" type="password" autocomplete="new-password" required></label>
    <label class="fld">Yeni şifre (tekrar)<input name="new2" type="password" autocomplete="new-password" required></label>
    <button class="abtn" type="submit">Şifreyi değiştir</button>
  </form>
</section>

<?php if (is_owner()): ?>
<section class="card narrowf">
  <h2>Sahip kullanıcı adı</h2>
  <form method="post" class="pform"><?= csrf_field() ?><input type="hidden" name="do" value="owner-name">
    <label class="fld">Kullanıcı adı<input name="user" value="<?= h($me) ?>" autocomplete="username" required></label>
    <button class="abtn abtn--line" type="submit">Kaydet</button>
  </form>
</section>

<section class="card narrowf">
  <h2>Bar hesabı</h2>
  <p class="muted">Bar hesabı yalnızca bar ekranını, masa hesaplarını, tükendi işaretlemeyi ve gün sonunu görür. Menüyü, fiyatları, masaları ve istatistiği değiştiremez.</p>
  <form method="post" class="pform"><?= csrf_field() ?><input type="hidden" name="do" value="bar">
    <label class="fld">Kullanıcı adı<input name="user" value="<?= h($bar['user'] ?? 'bar') ?>" autocomplete="off" required></label>
    <label class="fld">Şifre <small><?= $bar ? '(değiştirmeyeceksen boş bırak)' : '(en az 8 karakter)' ?></small><input name="pass" type="password" autocomplete="new-password"<?= $bar ? '' : ' required' ?>></label>
    <button class="abtn" type="submit"><?= $bar ? 'Bar hesabını güncelle' : 'Bar hesabı oluştur' ?></button>
  </form>
  <?php if ($bar): ?>
  <form method="post"><?= csrf_field() ?><input type="hidden" name="do" value="bar-delete"><button class="abtn abtn--line abtn--sm danger" type="submit" data-confirm="Bar hesabı silinsin mi?">Bar hesabını sil</button></form>
  <?php endif; ?>
</section>
<?php endif; ?>
<?php admin_foot();
