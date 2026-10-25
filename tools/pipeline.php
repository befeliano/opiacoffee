<?php
// Opia SEO/kalite pipeline'ı:  php tools/pipeline.php
// 1) derle  2) SEO denetimi  3) yerleşim/taşma taraması (yerel sunucu açıksa ve node varsa)
$php = PHP_BINARY; $root = dirname(__DIR__);
$step = function (string $name, string $cmd) {
    echo "\n━━ $name ━━\n"; passthru($cmd, $code); return $code;
};
$fail = 0;
$fail |= $step('1/3 Derleme', escapeshellarg($php) . ' ' . escapeshellarg($root . '/site/_src/build.php')) ? 1 : 0;
$fail |= $step('2/3 SEO denetimi', escapeshellarg($php) . ' ' . escapeshellarg($root . '/tools/seo-audit.php')) ? 1 : 0;

$node = is_file('D:/tools/node.exe') ? 'D:/tools/node.exe' : 'node';
$up = @fsockopen('127.0.0.1', 8080, $e, $s, 0.5);
if ($up) { fclose($up); $fail |= $step('3/3 Yerleşim taraması', escapeshellarg($node) . ' ' . escapeshellarg($root . '/tools/check-layout.mjs')) ? 1 : 0; }
else echo "\n━━ 3/3 Yerleşim taraması atlandı (127.0.0.1:8080 kapalı: start-server.cmd) ━━\n";
echo $fail ? "\n✗ Pipeline hata ile bitti.\n" : "\n✓ Pipeline temiz.\n";
exit($fail);
