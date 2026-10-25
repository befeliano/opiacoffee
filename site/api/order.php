<?php
// Misafir (QR masa) API'si: masa bilgisi, sipariş, sipariş durumu, masa hesabı, garson çağırma. Ödeme yok.
// Kişisel veri tutulmaz: IP kaydedilmez, kimlik sorulmaz.
//   GET  ?a=table&t=TOKEN
//   POST a=order   t, items(JSON), note
//   GET  ?a=status&t=TOKEN&ids=1,2
//   GET  ?a=bill&t=TOKEN
//   POST a=call    t, type=garson|hesap
// Tüm uçlara lang=en eklenirse mesajlar İngilizce döner.
declare(strict_types=1);
require __DIR__ . '/../_src/lib.php';
require __DIR__ . '/../_src/db.php';

header('Content-Type: application/json; charset=utf-8');
header('X-Robots-Tag: noindex');
header('Cache-Control: no-store');

$EN = ($_REQUEST['lang'] ?? '') === 'en';
function tx(string $tr, string $en): string { global $EN; return $EN ? $en : $tr; }
function out(int $code, array $body): never { http_response_code($code); echo json_encode($body, JSON_UNESCAPED_UNICODE); exit; }
function fail(string $msg, int $code = 422, array $extra = []): never { out($code, ['ok' => false, 'error' => $msg] + $extra); }
function status_label(string $s): string {
    $en = ['yeni' => 'Received', 'hazirlaniyor' => 'Preparing', 'teslim' => 'Served', 'iptal' => 'Cancelled'];
    return tx(ORDER_STATUS[$s] ?? $s, $en[$s] ?? $s);
}

$a = (string)($_REQUEST['a'] ?? '');
$isPost = $_SERVER['REQUEST_METHOD'] === 'POST';
if ($isPost) {
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    $host = explode(':', (string)($_SERVER['HTTP_HOST'] ?? ''))[0];
    if ($origin && parse_url($origin, PHP_URL_HOST) !== $host) fail(tx('İstek reddedildi.', 'Request rejected.'), 403);
}

try {
    $table = table_by_token((string)($_REQUEST['t'] ?? ''));
    if (!$table) fail(tx('Masa bulunamadı.', 'Table not found.'), 404, ['ordering' => false]);
    $ordering = ordering_global() && (int)$table['ordering'] === 1;

    if ($a === 'table') {
        $m = menu_data();
        $soldout = array_values(array_map(fn($p) => $p['id'], array_filter($m['products'], fn($p) => !empty($p['soldout']))));
        out(200, ['ok' => true, 'ordering' => $ordering, 'open' => is_open_now(), 'table' => ['name' => $table['name']],
            'hours' => cfg('hours'), 'options' => order_options($m), 'soldout' => $soldout]);
    }

    if ($a === 'status') {
        $ids = array_slice(array_filter(array_map('intval', explode(',', (string)($_GET['ids'] ?? '')))), 0, 20);
        if (!$ids) out(200, ['ok' => true, 'orders' => []]);
        $in = implode(',', array_fill(0, count($ids), '?'));
        $s = db()->prepare("SELECT id, status, total, created_at, paid_at FROM orders WHERE table_id = ? AND id IN ($in)");
        $s->execute(array_merge([$table['id']], $ids));
        $rows = array_map(fn($r) => $r + ['label' => status_label($r['status'])], $s->fetchAll());
        out(200, ['ok' => true, 'orders' => $rows]);
    }

    if ($a === 'bill') {
        $s = db()->prepare("SELECT COALESCE(SUM(total), 0) t, COUNT(*) n FROM orders WHERE table_id = ? AND paid_at IS NULL AND status != 'iptal'");
        $s->execute([$table['id']]);
        $r = $s->fetch();
        out(200, ['ok' => true, 'total' => (float)$r['t'], 'orders' => (int)$r['n']]);
    }

    if (!$isPost) fail(tx('Yöntem desteklenmiyor.', 'Method not allowed.'), 405);
    if (!$ordering) fail(tx('Bu masada QR sipariş şu an kapalı. Siparişini personele verebilirsin.', 'QR ordering is off for this table right now. Please order from our staff.'), 403, ['ordering' => false]);

    if ($a === 'call') {
        $type = (string)($_POST['type'] ?? 'garson');
        if (!isset(CALL_TYPES[$type])) fail(tx('Geçersiz istek.', 'Invalid request.'));
        $s = db()->prepare("SELECT id FROM calls WHERE table_id = ? AND type = ? AND status = 'acik'");
        $s->execute([$table['id'], $type]);
        if (!$s->fetchColumn()) {
            db()->prepare('INSERT INTO calls(table_id, table_name, type, created_at) VALUES(?, ?, ?, ?)')
                ->execute([$table['id'], $table['name'], $type, time()]);
        }
        out(200, ['ok' => true, 'message' => $type === 'hesap'
            ? tx('Hesabın için personelimiz geliyor.', 'Our staff is coming with your bill.')
            : tx('Garsonumuz masana geliyor.', 'A waiter is on the way to your table.')]);
    }

    if ($a === 'order') {
        if (!is_open_now()) fail(tx('Şu an kapalıyız. Sipariş saatleri: ', 'We are closed right now. Ordering hours: ') . cfg('hours')['open'] . ' - 00:00.', 403);
        $s = db()->prepare('SELECT COUNT(*) FROM orders WHERE table_id = ? AND created_at > ?');
        $s->execute([$table['id'], time() - 600]);
        if ((int)$s->fetchColumn() >= 10) fail(tx('Kısa sürede çok fazla sipariş gönderildi. Lütfen personelimize seslen.', 'Too many orders in a short time. Please ask our staff.'), 429);

        $items = json_decode((string)($_POST['items'] ?? '[]'), true);
        if (!is_array($items) || !$items) fail(tx('Sepetin boş.', 'Your basket is empty.'));
        if (count($items) > 30) fail(tx('Tek seferde en fazla 30 kalem sipariş verilebilir.', 'You can order up to 30 lines at once.'));
        $note = trim(mb_substr((string)($_POST['note'] ?? ''), 0, 300));

        $m = menu_data();
        $opt = order_options($m);
        $byId = [];
        foreach ($m['products'] as $p) $byId[$p['id']] = $p;

        $lines = []; $total = 0; $count = 0;
        foreach ($items as $it) {
            $p = $byId[(string)($it['id'] ?? '')] ?? null;
            if (!$p || empty($p['available']) || ($p['orderable'] ?? true) === false) fail(tx('Sepetteki bir ürün artık sunulmuyor. Sepeti kontrol edip tekrar dene.', 'An item in your basket is no longer available. Please check your basket.'));
            if (!empty($p['soldout'])) fail(tx($p['name'] . ' şu an tükendi. Sepetten çıkarıp tekrar dene.', $p['name'] . ' is sold out right now. Please remove it and try again.'), 409, ['soldout' => $p['id']]);
            $qty = (int)($it['qty'] ?? 0);
            if ($qty < 1 || $qty > 20) fail(tx('Geçersiz adet.', 'Invalid quantity.'));
            $calc = order_price($p, (array)($it['sel'] ?? []), $opt);
            if (!$calc) fail(tx('Geçersiz ürün seçeneği.', 'Invalid option.'));
            [$unit, $txt] = $calc;
            $lines[] = [$p['id'], $p['name'], $qty, $unit, $txt, $unit * $qty];
            $total += $unit * $qty; $count += $qty;
        }

        $pdo = db();
        $pdo->beginTransaction();
        $pdo->prepare('INSERT INTO orders(table_id, table_name, note, total, item_count, day, created_at) VALUES(?, ?, ?, ?, ?, ?, ?)')
            ->execute([$table['id'], $table['name'], $note, $total, $count, date('Y-m-d'), time()]);
        $oid = (int)$pdo->lastInsertId();
        $ins = $pdo->prepare('INSERT INTO order_items(order_id, product_id, name, qty, unit_price, options, line_total) VALUES(?, ?, ?, ?, ?, ?, ?)');
        foreach ($lines as $l) $ins->execute(array_merge([$oid], $l));
        $pdo->commit();
        out(200, ['ok' => true, 'order' => ['id' => $oid, 'total' => $total, 'status' => 'yeni', 'label' => status_label('yeni')]]);
    }

    fail(tx('Bilinmeyen işlem.', 'Unknown action.'), 400);
} catch (Throwable $e) {
    error_log('[opia order] ' . $e->getMessage());
    fail(tx('Sunucu hatası, lütfen personele sipariş ver.', 'Server error, please order from our staff.'), 500);
}
