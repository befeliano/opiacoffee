<?php
// Hesap oluşturur / şifre sıfırlar.   php tools/set-admin.php <kullanici> [sifre] [owner|bar]
// Şifre verilmezse rastgele üretilir ve ekrana yazılır. Rol verilmezse sahip (owner).
$dir = __DIR__ . '/../site/_private';
if (!is_dir($dir)) mkdir($dir, 0775, true);
$file = $dir . '/auth.json';
$user = $argv[1] ?? 'admin';
$pass = ($argv[2] ?? '') !== '' ? $argv[2] : substr(strtr(base64_encode(random_bytes(12)), '+/=', 'xyz'), 0, 14);
$role = ($argv[3] ?? 'owner') === 'bar' ? 'bar' : 'owner';

$a = is_file($file) ? (json_decode(file_get_contents($file), true) ?: []) : [];
$users = $a['users'] ?? (isset($a['user']) ? [['user' => $a['user'], 'hash' => $a['hash'], 'role' => 'owner']] : []);
$users = array_values(array_filter($users, fn($u) => $u['user'] !== $user && !($role === 'bar' && $u['role'] === 'bar')));
$users[] = ['user' => $user, 'hash' => password_hash($pass, PASSWORD_DEFAULT), 'role' => $role];
file_put_contents($file, json_encode(['users' => $users]));
echo "Kullanıcı: $user ($role)\nŞifre:     $pass\n";
