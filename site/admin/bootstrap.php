<?php
// Opia yönetim paneli - ortak altyapı: oturum, CSRF, depolama, şablon.
declare(strict_types=1);

define('ADMIN_ROOT', dirname(__DIR__));
define('PRIVATE_DIR', ADMIN_ROOT . '/_private');
define('UPLOAD_DIR', ADMIN_ROOT . '/uploads');
require_once ADMIN_ROOT . '/_src/build.php';   // lib.php + opia_build()
require_once ADMIN_ROOT . '/_src/db.php';      // SQLite: masalar, siparişler, çağrılar

if (!is_dir(PRIVATE_DIR)) mkdir(PRIVATE_DIR, 0775, true);

session_set_cookie_params([
    'lifetime' => 0, 'path' => '/admin/', 'httponly' => true, 'samesite' => 'Lax',
    'secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
]);
session_start();
header('X-Robots-Tag: noindex, nofollow');
header('Cache-Control: no-store');
header('X-Frame-Options: DENY');

// ---------- yardımcılar ----------
function h($s): string { return htmlspecialchars((string)$s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); }
function redirect(string $to): never { header('Location: ' . $to); exit; }
function flash(string $msg, string $type = 'ok'): void { $_SESSION['flash'][] = [$type, $msg]; }
function csrf(): string { return $_SESSION['csrf'] ??= bin2hex(random_bytes(24)); }
function csrf_field(): string { return '<input type="hidden" name="_csrf" value="' . h(csrf()) . '">'; }
function csrf_check(): void {
    if (!hash_equals($_SESSION['csrf'] ?? '', (string)($_POST['_csrf'] ?? ''))) {
        http_response_code(400); exit('Oturum doğrulanamadı. Sayfayı yenileyip tekrar dene.');
    }
}
function slugify(string $s): string {
    $s = strtr($s, ['ç' => 'c', 'Ç' => 'c', 'ğ' => 'g', 'Ğ' => 'g', 'ı' => 'i', 'İ' => 'i', 'ö' => 'o', 'Ö' => 'o', 'ş' => 's', 'Ş' => 's', 'ü' => 'u', 'Ü' => 'u']);
    $s = strtolower(preg_replace('/[^A-Za-z0-9]+/', '-', $s));
    return trim($s, '-') ?: 'urun';
}
function fnum($v): float { return (float)str_replace(',', '.', trim((string)$v)); }

// ---------- kimlik doğrulama ----------
// Roller: owner (sahip, her şey) ve bar (bar ekranı, masa hesabı, tükendi, gün sonu).
const ROLES = ['owner' => 'Sahip', 'bar' => 'Bar'];
const BAR_PAGES = ['bar', 'dayend', 'account'];

function auth_file(): string { return PRIVATE_DIR . '/auth.json'; }
/** Kullanıcı listesi. Eski tek kullanıcılı biçim (user/hash) otomatik olarak sahip hesabına çevrilir. */
function auth_users(): array {
    if (!is_file(auth_file())) return [];
    $a = json_decode(file_get_contents(auth_file()), true) ?: [];
    if (isset($a['users'])) return $a['users'];
    if (isset($a['user'], $a['hash'])) return [['user' => $a['user'], 'hash' => $a['hash'], 'role' => 'owner']];
    return [];
}
function auth_save(array $users): void {
    file_put_contents(auth_file(), json_encode(['users' => array_values($users)], JSON_UNESCAPED_UNICODE), LOCK_EX);
}
function auth_find(string $user): ?array {
    foreach (auth_users() as $u) if (hash_equals($u['user'], $user)) return $u;
    return null;
}
function auth_load(): bool { return (bool)auth_users(); }
function role(): string { return (string)($_SESSION['role'] ?? ''); }
function is_owner(): bool { return role() === 'owner'; }
function logged_in(): bool {
    if (empty($_SESSION['user']) || time() - ($_SESSION['seen'] ?? 0) > 60 * 60 * 12) return false;
    $u = auth_find((string)$_SESSION['user']);
    return $u && $u['role'] === role();
}
/** Sayfa erişimi: varsayılan yalnızca sahip; bar hesabının girebileceği sayfalar $roles ile açılır. */
function require_login(array $roles = ['owner']): void {
    if (!auth_load()) { http_response_code(503); exit('Yönetici hesabı tanımlı değil. Sunucuda "php tools/set-admin.php <kullanici> <sifre>" çalıştırın.'); }
    if (!logged_in()) redirect('/admin/login.php?next=' . rawurlencode($_SERVER['REQUEST_URI'] ?? '/admin/'));
    $_SESSION['seen'] = time();
    if (!in_array(role(), $roles, true)) {
        http_response_code(403);
        admin_head('Yetki yok');
        echo '<h1>Yetki yok</h1><p class="muted">Bu sayfa yalnızca sahip hesabıyla açılır.</p><p><a class="abtn" href="/admin/bar.php">Bar ekranına dön</a></p>';
        admin_foot();
        exit;
    }
}

function attempts_file(): string { return PRIVATE_DIR . '/login-attempts.json'; }
function ip_key(): string { return substr(hash('sha256', ($_SERVER['REMOTE_ADDR'] ?? '') . '|opia'), 0, 16); }
function login_locked(): int {
    $a = is_file(attempts_file()) ? (json_decode(file_get_contents(attempts_file()), true) ?: []) : [];
    $mine = array_filter($a[ip_key()] ?? [], fn($t) => $t > time() - 900);
    return count($mine) >= 5 ? (int)(min($mine) + 900 - time()) : 0;
}
function login_fail(): void {
    $a = is_file(attempts_file()) ? (json_decode(file_get_contents(attempts_file()), true) ?: []) : [];
    foreach ($a as $k => $v) { $a[$k] = array_values(array_filter($v, fn($t) => $t > time() - 900)); if (!$a[$k]) unset($a[$k]); }
    $a[ip_key()][] = time();
    file_put_contents(attempts_file(), json_encode($a), LOCK_EX);
}
function login_clear(): void {
    $a = is_file(attempts_file()) ? (json_decode(file_get_contents(attempts_file()), true) ?: []) : [];
    unset($a[ip_key()]);
    file_put_contents(attempts_file(), json_encode($a), LOCK_EX);
}

// ---------- menü deposu ----------
function menu_path(): string { return ADMIN_ROOT . '/data/menu.json'; }
function menu_load(): array { return json_decode(file_get_contents(menu_path()), true); }
function menu_save(array $m, bool $rebuild = true): void {
    $m['updatedAt'] = date('c');
    $bak = PRIVATE_DIR . '/backups';
    if (!is_dir($bak)) mkdir($bak, 0775, true);
    if (is_file(menu_path())) copy(menu_path(), $bak . '/menu-' . date('Ymd-His') . '.json');
    foreach (array_slice(array_reverse(glob($bak . '/menu-*.json') ?: []), 30) as $old) @unlink($old);
    $json = json_encode($m, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
    $tmp = menu_path() . '.tmp';
    file_put_contents($tmp, $json, LOCK_EX);
    rename($tmp, menu_path());
    if ($rebuild) opia_build();
}
function product_index(array $m, string $id): int {
    foreach ($m['products'] as $i => $p) if ($p['id'] === $id) return $i;
    return -1;
}
function delete_upload(?string $f): void {
    if ($f && preg_match('/^[\w.-]+$/', $f) && is_file(UPLOAD_DIR . '/' . $f)) @unlink(UPLOAD_DIR . '/' . $f);
}

// ---------- şablon ----------
function admin_head(string $title, string $active = ''): void {
    $nav = [
        'index' => ['/admin/', 'Panel'], 'bar' => ['/admin/bar.php', 'Bar'], 'dayend' => ['/admin/dayend.php', 'Gün sonu'],
        'tables' => ['/admin/tables.php', 'Masalar & QR'], 'stats' => ['/admin/stats.php', 'İstatistik'], 'products' => ['/admin/products.php', 'Ürünler'],
        'categories' => ['/admin/categories.php', 'Kategoriler'], 'settings' => ['/admin/settings.php', 'Mevsim & Ayarlar'],
        'account' => ['/admin/account.php', 'Hesaplar'],
    ];
    if (!is_owner()) $nav = array_intersect_key($nav, array_flip(BAR_PAGES));
    ?><!doctype html>
<html lang="tr"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title><?= h($title) ?> | Opia Yönetim</title>
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/assets/css/fonts.css">
<link rel="stylesheet" href="/admin/assets/admin.css?v=<?= filemtime(__DIR__ . '/assets/admin.css') ?>">
</head><body>
<header class="ah">
  <a class="ah__logo" href="/admin/"><b>OPIA</b><span>YÖNETİM</span></a>
  <button class="ah__burger" type="button" aria-label="Menü" aria-expanded="false"><span></span><span></span></button>
  <nav class="ah__nav" id="anav">
    <?php foreach ($nav as $k => [$href, $label]): ?>
      <a href="<?= $href ?>"<?= $k === $active ? ' class="on"' : '' ?>><?= h($label) ?></a>
    <?php endforeach; ?>
    <a href="/" target="_blank" rel="noopener" class="ah__site">Siteyi gör ↗</a>
    <?php if (logged_in()): ?><form method="post" action="/admin/logout.php"><?= csrf_field() ?><button type="submit">Çıkış (<?= h($_SESSION['user']) ?>)</button></form><?php endif; ?>
  </nav>
</header>
<main class="am">
<?php foreach ($_SESSION['flash'] ?? [] as [$t, $msg]): ?><div class="flash flash--<?= h($t) ?>" role="status"><?= h($msg) ?></div><?php endforeach; unset($_SESSION['flash']); ?>
<?php }

function admin_foot(): void { ?>
</main>
<script src="/admin/assets/admin.js?v=<?= filemtime(__DIR__ . '/assets/admin.js') ?>" defer></script>
</body></html>
<?php }
