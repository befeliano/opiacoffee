<?php
// Bar ekranı JSON API'si (oturum + CSRF gerekli; sahip ve bar hesapları kullanabilir).
//   GET  ?a=feed                          açık siparişler, çağrılar, masa hesapları, bugünün özeti
//   GET  ?a=products                      tükendi listesi için ürünler
//   POST a=order    id, status            yeni -> hazirlaniyor -> teslim (ya da iptal)
//   POST a=call     id                    çağrıyı kapat
//   POST a=pay      table_id, method      masa hesabını kapat (nakit | kart)
//   POST a=soldout  id, value             ürünü tükendi / mevcut yap
//   POST a=ordering table_id              masanın QR siparişini aç / kapat
require __DIR__ . '/bootstrap.php';
header('Content-Type: application/json; charset=utf-8');

function jout(int $code, array $b): never { http_response_code($code); echo json_encode($b, JSON_UNESCAPED_UNICODE); exit; }

if (!auth_load() || !logged_in()) jout(401, ['ok' => false, 'error' => 'Oturum süresi doldu, yeniden giriş yap.']);
$_SESSION['seen'] = time();
$a = (string)($_REQUEST['a'] ?? '');

try {
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        if (!hash_equals($_SESSION['csrf'] ?? '', (string)($_SERVER['HTTP_X_CSRF'] ?? $_POST['_csrf'] ?? ''))) jout(400, ['ok' => false, 'error' => 'Oturum doğrulanamadı, sayfayı yenile.']);
        $id = (int)($_POST['id'] ?? 0);
        if ($a === 'order') {
            $st = (string)($_POST['status'] ?? '');
            $allowed = ['yeni' => ['hazirlaniyor', 'iptal'], 'hazirlaniyor' => ['teslim', 'iptal', 'yeni'], 'teslim' => ['hazirlaniyor']];
            $cur = db()->prepare('SELECT status FROM orders WHERE id = ?'); $cur->execute([$id]);
            $now = $cur->fetchColumn();
            if ($now === false) jout(404, ['ok' => false, 'error' => 'Sipariş bulunamadı.']);
            if (!in_array($st, $allowed[$now] ?? [], true)) jout(409, ['ok' => false, 'error' => 'Bu sipariş zaten güncellenmiş.']);
            $col = ['hazirlaniyor' => ', started_at = COALESCE(started_at, :t)', 'teslim' => ', delivered_at = :t'][$st] ?? '';
            $params = [':s' => $st, ':id' => $id]; if ($col) $params[':t'] = time();
            db()->prepare("UPDATE orders SET status = :s $col WHERE id = :id")->execute($params);
            jout(200, ['ok' => true]);
        }
        if ($a === 'call') {
            db()->prepare("UPDATE calls SET status = 'kapandi', closed_at = ? WHERE id = ?")->execute([time(), $id]);
            jout(200, ['ok' => true]);
        }
        if ($a === 'pay') {
            $method = (string)($_POST['method'] ?? '');
            $n = close_bill((int)($_POST['table_id'] ?? 0), $method);
            if (!$n) jout(409, ['ok' => false, 'error' => 'Kapatılacak açık hesap yok.']);
            db()->prepare("UPDATE calls SET status = 'kapandi', closed_at = ? WHERE table_id = ? AND type = 'hesap' AND status = 'acik'")->execute([time(), (int)$_POST['table_id']]);
            jout(200, ['ok' => true, 'closed' => $n]);
        }
        if ($a === 'soldout') {
            $m = menu_load(); $i = product_index($m, (string)($_POST['pid'] ?? ''));
            if ($i < 0) jout(404, ['ok' => false, 'error' => 'Ürün bulunamadı.']);
            $m['products'][$i]['soldout'] = ($_POST['value'] ?? '') === '1';
            menu_save($m);
            jout(200, ['ok' => true, 'soldout' => $m['products'][$i]['soldout']]);
        }
        if ($a === 'ordering') {
            db()->prepare('UPDATE tables SET ordering = 1 - ordering WHERE id = ?')->execute([(int)($_POST['table_id'] ?? 0)]);
            jout(200, ['ok' => true]);
        }
        jout(400, ['ok' => false, 'error' => 'Bilinmeyen işlem.']);
    }

    if ($a === 'products') {
        $m = menu_load();
        $cats = []; foreach ($m['categories'] as $c) $cats[$c['id']] = $c['name'];
        $list = array_values(array_map(fn($p) => ['id' => $p['id'], 'name' => $p['name'], 'lang' => $p['lang'] ?? 'tr', 'category' => $cats[$p['category']] ?? '', 'soldout' => !empty($p['soldout'])],
            array_filter($m['products'], fn($p) => $p['available'] && ($p['orderable'] ?? true))));
        jout(200, ['ok' => true, 'products' => $list]);
    }

    if ($a === 'feed') {
        $orders = db()->query("SELECT * FROM orders WHERE status IN ('yeni','hazirlaniyor') ORDER BY created_at ASC LIMIT 200")->fetchAll();
        $recent = db()->query("SELECT * FROM orders WHERE status = 'teslim' ORDER BY delivered_at DESC LIMIT 8")->fetchAll();
        $ids = array_merge(array_column($orders, 'id'), array_column($recent, 'id'));
        $items = [];
        if ($ids) {
            $in = implode(',', array_map('intval', $ids));
            foreach (db()->query("SELECT order_id, name, qty, options, line_total FROM order_items WHERE order_id IN ($in) ORDER BY id")->fetchAll() as $it) $items[$it['order_id']][] = $it;
        }
        foreach ($orders as &$o) { $o['items'] = $items[$o['id']] ?? []; unset($o['ip']); } unset($o);
        foreach ($recent as &$o) { $o['items'] = $items[$o['id']] ?? []; unset($o['ip']); } unset($o);
        $calls = db()->query("SELECT * FROM calls WHERE status = 'acik' ORDER BY created_at ASC")->fetchAll();
        foreach ($calls as &$c) $c['label'] = CALL_TYPES[$c['type']] ?? $c['type']; unset($c);
        $tables = db()->query('SELECT id, name, ordering FROM tables ORDER BY sort, id')->fetchAll();
        jout(200, ['ok' => true, 'now' => time(), 'orders' => $orders, 'recent' => $recent, 'calls' => $calls,
            'bills' => table_bills(), 'tables' => $tables, 'today' => day_stats(date('Y-m-d')), 'ordering' => ordering_global(),
            'role' => role()]);
    }
    jout(400, ['ok' => false, 'error' => 'Bilinmeyen işlem.']);
} catch (Throwable $e) {
    error_log('[opia bar] ' . $e->getMessage());
    jout(500, ['ok' => false, 'error' => 'Sunucu hatası.']);
}
