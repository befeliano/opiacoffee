<?php
// Geliştirme sunucusu: php -d extension=pdo_sqlite -S 127.0.0.1:8080 router.php
// Apache'de .htaccess aynı işi yapar.
$rawPath = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) ?: '/';
$query = parse_url($_SERVER['REQUEST_URI'], PHP_URL_QUERY);
$uri = urldecode($rawPath);
$root = __DIR__;

function opia_404(string $root): bool {
    http_response_code(404);
    header('Content-Type: text/html; charset=utf-8');
    readfile($root . '/404.html');
    return true;
}

if (preg_match('#^/(_src|_private)(/|$)#', $uri) || str_starts_with(basename($uri), '.')) return opia_404($root);

// QR kısa bağlantısı: /m/TOKEN -> masa/index.php
if (preg_match('#^/m/([A-Za-z0-9]{6,32})/?$#', $uri, $mm)) {
    $_GET['k'] = $mm[1];
    require $root . '/masa/index.php';
    return true;
}

$file = realpath($root . $uri);
if ($file && str_starts_with($file, realpath($root))) {
    if (is_file($file)) return false;                       // statik dosya ya da PHP betiği
    if (is_dir($file)) {
        if (substr($rawPath, -1) !== '/') { header('Location: ' . $rawPath . '/' . ($query ? '?' . $query : ''), true, 301); return true; }
        if (is_file($file . '/index.php')) { require $file . '/index.php'; return true; }
        if (is_file($file . '/index.html')) { header('Content-Type: text/html; charset=utf-8'); readfile($file . '/index.html'); return true; }
    }
}
return opia_404($root);
