<?php
// QR giriş noktası: /m/TOKEN (veya /masa/?k=TOKEN)
// Masa geçerli ve sipariş açıksa sipariş modunda menüye, değilse düz menüye yönlendirir.
require __DIR__ . '/../_src/lib.php';
require __DIR__ . '/../_src/db.php';

header('X-Robots-Tag: noindex, nofollow');
header('Cache-Control: no-store');

$to = '/menu/';
try {
    $t = table_by_token((string)($_GET['k'] ?? ''));
    if ($t && ordering_global() && (int)$t['ordering'] === 1) $to = '/menu/?t=' . rawurlencode($t['token']);
} catch (Throwable $e) {
    error_log('[opia masa] ' . $e->getMessage());
}
header('Location: ' . $to, true, 302);
