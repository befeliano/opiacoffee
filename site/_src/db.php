<?php
// Yerel SQLite veritabanı (masalar, siparişler, garson çağrıları, ayarlar). Dosya: _private/opia.sqlite
declare(strict_types=1);

date_default_timezone_set('Europe/Istanbul');

function db(): PDO {
    static $pdo;
    if ($pdo) return $pdo;
    $dir = __DIR__ . '/../_private';
    if (!is_dir($dir)) mkdir($dir, 0775, true);
    $pdo = new PDO('sqlite:' . $dir . '/opia.sqlite', null, null, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
    $pdo->exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 4000;');
    $pdo->exec(<<<SQL
CREATE TABLE IF NOT EXISTS tables (
  id INTEGER PRIMARY KEY, name TEXT NOT NULL, token TEXT NOT NULL UNIQUE,
  ordering INTEGER NOT NULL DEFAULT 1, sort INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY, table_id INTEGER, table_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'yeni', note TEXT NOT NULL DEFAULT '',
  total REAL NOT NULL, item_count INTEGER NOT NULL, day TEXT NOT NULL,
  created_at INTEGER NOT NULL, started_at INTEGER, delivered_at INTEGER, ip TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS orders_day ON orders(day);
CREATE INDEX IF NOT EXISTS orders_status ON orders(status);
CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY, order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL, name TEXT NOT NULL, qty INTEGER NOT NULL,
  unit_price REAL NOT NULL, options TEXT NOT NULL DEFAULT '', line_total REAL NOT NULL
);
CREATE INDEX IF NOT EXISTS order_items_order ON order_items(order_id);
CREATE TABLE IF NOT EXISTS calls (
  id INTEGER PRIMARY KEY, table_id INTEGER, table_name TEXT NOT NULL, type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'acik', created_at INTEGER NOT NULL, closed_at INTEGER
);
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS day_closes (day TEXT PRIMARY KEY, closed_at INTEGER NOT NULL, closed_by TEXT NOT NULL, summary TEXT NOT NULL);
SQL);
    $cols = array_column($pdo->query('PRAGMA table_info(orders)')->fetchAll(), 'name');
    if (!in_array('paid_at', $cols, true)) $pdo->exec('ALTER TABLE orders ADD COLUMN paid_at INTEGER');
    if (!in_array('pay_method', $cols, true)) $pdo->exec("ALTER TABLE orders ADD COLUMN pay_method TEXT NOT NULL DEFAULT ''");
    return $pdo;
}

const PAY_METHODS = ['nakit' => 'Nakit', 'kart' => 'Kart'];

/** Ödenmemiş masa hesapları (iptal hariç). */
function table_bills(): array {
    $rows = db()->query("SELECT * FROM orders WHERE paid_at IS NULL AND status != 'iptal' ORDER BY created_at")->fetchAll();
    if (!$rows) return [];
    $in = implode(',', array_map('intval', array_column($rows, 'id')));
    $items = [];
    foreach (db()->query("SELECT order_id, name, qty, options, line_total FROM order_items WHERE order_id IN ($in) ORDER BY id")->fetchAll() as $it) $items[$it['order_id']][] = $it;
    $bills = [];
    foreach ($rows as $o) {
        $k = (int)$o['table_id'];
        $bills[$k] ??= ['table_id' => $k, 'table_name' => $o['table_name'], 'total' => 0, 'since' => (int)$o['created_at'], 'open' => 0, 'orders' => []];
        $bills[$k]['total'] += (float)$o['total'];
        if (in_array($o['status'], ['yeni', 'hazirlaniyor'], true)) $bills[$k]['open']++;
        $bills[$k]['orders'][] = ['id' => (int)$o['id'], 'status' => $o['status'], 'total' => (float)$o['total'], 'created_at' => (int)$o['created_at'], 'items' => $items[$o['id']] ?? []];
    }
    return array_values($bills);
}

function close_bill(int $tableId, string $method): int {
    if (!isset(PAY_METHODS[$method])) return 0;
    $s = db()->prepare("UPDATE orders SET paid_at = ?, pay_method = ? WHERE table_id = ? AND paid_at IS NULL AND status != 'iptal'");
    $s->execute([time(), $method, $tableId]);
    return $s->rowCount();
}

function setting(string $key, ?string $default = null): ?string {
    $s = db()->prepare('SELECT value FROM settings WHERE key = ?');
    $s->execute([$key]);
    $v = $s->fetchColumn();
    return $v === false ? $default : (string)$v;
}
function setting_set(string $key, string $value): void {
    db()->prepare('INSERT INTO settings(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')->execute([$key, $value]);
}

function ordering_global(): bool { return setting('ordering', '1') === '1'; }

function table_by_token(string $token): ?array {
    if (!preg_match('/^[A-Za-z0-9]{6,32}$/', $token)) return null;
    $s = db()->prepare('SELECT * FROM tables WHERE token = ?');
    $s->execute([$token]);
    return $s->fetch() ?: null;
}

function new_token(): string {
    $abc = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    $t = '';
    for ($i = 0; $i < 10; $i++) $t .= $abc[random_int(0, strlen($abc) - 1)];
    return $t;
}

/** Sipariş saatleri: config'deki açılış - kapanış (00:00 = gece yarısı). */
function is_open_now(): bool {
    if (setting('enforce_hours', '1') !== '1') return true;
    $h = cfg('hours');
    [$oh, $om] = array_map('intval', explode(':', $h['open']));
    [$ch, $cm] = array_map('intval', explode(':', $h['close']));
    $now = (int)date('G') * 60 + (int)date('i');
    $open = $oh * 60 + $om; $close = $ch * 60 + $cm;
    if ($close === 0) $close = 24 * 60;
    return $close > $open ? ($now >= $open && $now < $close) : ($now >= $open || $now < $close);
}

const ORDER_STATUS = ['yeni' => 'Alındı', 'hazirlaniyor' => 'Hazırlanıyor', 'teslim' => 'Teslim edildi', 'iptal' => 'İptal'];
const CALL_TYPES = ['garson' => 'Garson çağırıyor', 'hesap' => 'Hesap istiyor'];

/** Günlük özet: sipariş adedi, ciro, ürün adetleri (iptaller hariç). */
function day_stats(string $day): array {
    $o = db()->prepare("SELECT COUNT(*) n, COALESCE(SUM(total),0) ciro, COALESCE(SUM(status='teslim'),0) teslim,
        COALESCE(SUM(CASE WHEN pay_method='nakit' THEN total END),0) nakit, COALESCE(SUM(CASE WHEN pay_method='kart' THEN total END),0) kart,
        COALESCE(SUM(CASE WHEN paid_at IS NULL THEN total END),0) acik
        FROM orders WHERE day = ? AND status != 'iptal'");
    $o->execute([$day]);
    $sum = $o->fetch();
    $c = db()->prepare("SELECT COUNT(*) FROM orders WHERE day = ? AND status = 'iptal'");
    $c->execute([$day]);
    $i = db()->prepare("SELECT oi.product_id, oi.name, SUM(oi.qty) qty, SUM(oi.line_total) ciro
        FROM order_items oi JOIN orders o ON o.id = oi.order_id
        WHERE o.day = ? AND o.status != 'iptal' GROUP BY oi.product_id, oi.name ORDER BY qty DESC, ciro DESC");
    $i->execute([$day]);
    return ['day' => $day, 'orders' => (int)$sum['n'], 'revenue' => (float)$sum['ciro'], 'delivered' => (int)$sum['teslim'],
        'cash' => (float)$sum['nakit'], 'card' => (float)$sum['kart'], 'unpaid' => (float)$sum['acik'], 'cancelled' => (int)$c->fetchColumn(),
        'items' => $i->fetchAll()];
}
