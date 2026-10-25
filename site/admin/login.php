<?php
require __DIR__ . '/bootstrap.php';
$home = fn() => is_owner() ? '/admin/' : '/admin/bar.php';
if (logged_in()) redirect($home());
$err = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    $wait = login_locked();
    $u = auth_find((string)($_POST['user'] ?? ''));
    $pass = (string)($_POST['pass'] ?? '');
    if ($wait > 0) {
        $err = 'Çok fazla hatalı deneme. ' . ceil($wait / 60) . ' dakika sonra tekrar dene.';
    } elseif ($u && password_verify($pass, $u['hash'])) {
        session_regenerate_id(true);
        $_SESSION['user'] = $u['user']; $_SESSION['role'] = $u['role']; $_SESSION['seen'] = time();
        login_clear();
        if (password_needs_rehash($u['hash'], PASSWORD_DEFAULT)) {
            $all = auth_users();
            foreach ($all as &$x) if ($x['user'] === $u['user']) $x['hash'] = password_hash($pass, PASSWORD_DEFAULT);
            unset($x); auth_save($all);
        }
        $next = (string)($_GET['next'] ?? '');
        $okNext = preg_match('#^/admin/[A-Za-z0-9_./?=&%-]*$#', $next) && !str_contains($next, '//');
        redirect($okNext && (is_owner() || preg_match('#^/admin/(bar|dayend|account)\.php#', $next)) ? $next : $home());
    } else {
        login_fail(); usleep(400000);
        $err = 'Kullanıcı adı ya da şifre hatalı.';
    }
}
?><!doctype html>
<html lang="tr"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow"><title>Giriş | Opia Yönetim</title>
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/assets/css/fonts.css">
<link rel="stylesheet" href="/admin/assets/admin.css?v=<?= filemtime(__DIR__ . '/assets/admin.css') ?>">
</head><body class="login">
<form class="login__box" method="post" autocomplete="on">
  <div class="login__logo"><b>OPIA</b><span>COFFEE CO</span></div>
  <h1>Yönetim girişi</h1>
  <?php if ($err): ?><p class="flash flash--err" role="alert"><?= h($err) ?></p><?php endif; ?>
  <?= csrf_field() ?>
  <label>Kullanıcı adı<input name="user" type="text" autocomplete="username" required autofocus></label>
  <label>Şifre<input name="pass" type="password" autocomplete="current-password" required></label>
  <button class="abtn" type="submit">Giriş yap</button>
</form>
</body></html>
