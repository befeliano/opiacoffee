// MySQL/MariaDB şeması. Uygulama ilk bağlantıda eksik tabloları oluşturur (CREATE TABLE IF NOT EXISTS).
// Elle kurmak için: npm run db:mysql-schema > schema.sql ve phpMyAdmin > İçe aktar.

export const SCHEMA_SQL = `-- Adisyon veritabanı şeması (MySQL 8 / MariaDB 10.6+).
-- Postgres şemasının (supabase/migrations) birebir karşılığıdır; iş kuralları src/lib/data/mysql/*.ts içindedir.
-- Diziler ve nesneler (option_ids, tags, permissions, summary) kanonik JSON metni olarak saklanır.
-- Kimlikler UUID (VARCHAR(36); CHAR hesaplanan sütunda kullanılamıyor), zamanlar UTC DATETIME(6), para DECIMAL(12,2).
-- Postgres'teki koşullu benzersizlikler (masada tek açık adisyon, tek açık gün) hesaplanan sütunla sağlanır.
-- MySQL hesaplanan sütunun kaynağında ON DELETE SET NULL/CASCADE kabul etmez; bu yüzden masa silinirken
-- orders.table_id ve kafe silinirken cafe_days kodda (tables.ts, admin.ts) elle temizlenir.
-- Bileşik (cafe_id, x) anahtarlar bir kafenin kaydının başka kafeye bağlanmasını engeller. Postgres'teki
-- "SET NULL (kolon)" MySQL'de yok; o ilişkiler (ürün→kategori, masa→bölge, satır→ürün) tek kolonla kurulur,
-- kafe eşleşmesini fonksiyonlar denetler. Hammadde silme kontrolü (E_INGREDIENT_IN_USE) kodda yapılır.

CREATE TABLE IF NOT EXISTS app_users (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  email VARCHAR(190) NOT NULL UNIQUE,
  encrypted_password VARCHAR(255) NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE IF NOT EXISTS cafes (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  slug VARCHAR(40) NOT NULL UNIQUE,
  name VARCHAR(80) NOT NULL,
  timezone VARCHAR(64) NOT NULL DEFAULT 'Europe/Istanbul',
  card_commission_rate DECIMAL(6,4) NOT NULL DEFAULT 0.0100,
  open_hour SMALLINT NOT NULL DEFAULT 10,
  close_hour SMALLINT NOT NULL DEFAULT 24,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  theme VARCHAR(10) NOT NULL DEFAULT 'coffee',
  vat_rate DECIMAL(5,4) NOT NULL DEFAULT 0.1000,
  ticket_commission_rate DECIMAL(6,4) NOT NULL DEFAULT 0,
  logo MEDIUMTEXT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'TRY',
  language CHAR(2) NOT NULL DEFAULT 'tr',
  cash_count TINYINT(1) NOT NULL DEFAULT 0,
  qr_ordering TINYINT(1) NOT NULL DEFAULT 1,
  lat DECIMAL(9,6) NULL,
  lon DECIMAL(9,6) NULL,
  rain_warn_min INT NOT NULL DEFAULT 15,
  CONSTRAINT cafes_card_commission_rate_check CHECK (card_commission_rate >= 0 AND card_commission_rate <= 0.2),
  CONSTRAINT cafes_close_hour_check CHECK (close_hour >= 1 AND close_hour <= 24),
  CONSTRAINT cafes_hours_check CHECK (close_hour > open_hour),
  CONSTRAINT cafes_open_hour_check CHECK (open_hour >= 0 AND open_hour <= 23),
  CONSTRAINT cafes_theme_check CHECK (theme IN ('coffee','forest','ocean','berry','slate','sunset')),
  CONSTRAINT cafes_ticket_commission_rate_check CHECK (ticket_commission_rate >= 0 AND ticket_commission_rate <= 0.3),
  CONSTRAINT cafes_vat_rate_check CHECK (vat_rate >= 0 AND vat_rate <= 0.5),
  CONSTRAINT cafes_language_check CHECK (language IN ('tr','en'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE IF NOT EXISTS cafe_members (
  cafe_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  role VARCHAR(8) NOT NULL DEFAULT 'staff',
  display_name VARCHAR(60) NOT NULL DEFAULT '',
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  permissions TEXT NOT NULL,
  PRIMARY KEY (cafe_id, user_id),
  KEY cafe_members_user_idx (user_id),
  CONSTRAINT cafe_members_role_check CHECK (role IN ('owner','manager','staff')),
  CONSTRAINT cafe_members_cafe_fk FOREIGN KEY (cafe_id) REFERENCES cafes(id) ON DELETE CASCADE,
  CONSTRAINT cafe_members_user_fk FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE IF NOT EXISTS areas (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  cafe_id VARCHAR(36) NOT NULL,
  name VARCHAR(40) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  UNIQUE KEY areas_cafe_name (cafe_id, name),
  UNIQUE KEY areas_cafe_id_id (cafe_id, id),
  CONSTRAINT areas_cafe_fk FOREIGN KEY (cafe_id) REFERENCES cafes(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE IF NOT EXISTS dining_tables (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  cafe_id VARCHAR(36) NOT NULL,
  area_id VARCHAR(36) NULL,
  name VARCHAR(24) NOT NULL,
  is_takeaway TINYINT(1) NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  sort_order INT NOT NULL DEFAULT 0,
  qr_token VARCHAR(32) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  UNIQUE KEY dining_tables_cafe_name (cafe_id, name),
  UNIQUE KEY dining_tables_qr_token (qr_token),
  KEY dining_tables_cafe_idx (cafe_id, sort_order),
  UNIQUE KEY dining_tables_cafe_id_id (cafe_id, id),
  CONSTRAINT dining_tables_cafe_fk FOREIGN KEY (cafe_id) REFERENCES cafes(id) ON DELETE CASCADE,
  CONSTRAINT dining_tables_area_fk FOREIGN KEY (area_id) REFERENCES areas(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE IF NOT EXISTS categories (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  cafe_id VARCHAR(36) NOT NULL,
  name VARCHAR(40) NOT NULL,
  subtitle VARCHAR(60) NOT NULL DEFAULT '',
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  KEY categories_cafe_idx (cafe_id, sort_order),
  UNIQUE KEY categories_cafe_id_id (cafe_id, id),
  CONSTRAINT categories_cafe_fk FOREIGN KEY (cafe_id) REFERENCES cafes(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE IF NOT EXISTS products (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  cafe_id VARCHAR(36) NOT NULL,
  category_id VARCHAR(36) NULL,
  name VARCHAR(60) NOT NULL,
  description VARCHAR(200) NOT NULL DEFAULT '',
  price DECIMAL(12,2) NOT NULL,
  cost_mode VARCHAR(6) NOT NULL DEFAULT 'recipe',
  fixed_cost DECIMAL(14,4) NOT NULL DEFAULT 0,
  tags VARCHAR(100) NOT NULL DEFAULT '[]',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  is_open_price TINYINT(1) NOT NULL DEFAULT 0,
  favorite_rank INT NULL,
  KEY products_cafe_idx (cafe_id, category_id, sort_order),
  UNIQUE KEY products_cafe_id_id (cafe_id, id),
  CONSTRAINT products_cost_mode_check CHECK (cost_mode IN ('recipe','fixed')),
  CONSTRAINT products_price_check CHECK (price >= 0 AND price < 1000000),
  CONSTRAINT products_fixed_cost_check CHECK (fixed_cost >= 0 AND fixed_cost < 1000000),
  CONSTRAINT products_favorite_rank_check CHECK (favorite_rank IS NULL OR favorite_rank >= 0),
  CONSTRAINT products_cafe_fk FOREIGN KEY (cafe_id) REFERENCES cafes(id) ON DELETE CASCADE,
  CONSTRAINT products_category_fk FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE IF NOT EXISTS option_groups (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  cafe_id VARCHAR(36) NOT NULL,
  name VARCHAR(40) NOT NULL,
  selection VARCHAR(6) NOT NULL DEFAULT 'single',
  is_required TINYINT(1) NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  UNIQUE KEY option_groups_cafe_name (cafe_id, name),
  UNIQUE KEY option_groups_cafe_id_id (cafe_id, id),
  CONSTRAINT option_groups_selection_check CHECK (selection IN ('single','multi')),
  CONSTRAINT option_groups_cafe_fk FOREIGN KEY (cafe_id) REFERENCES cafes(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE IF NOT EXISTS options (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  cafe_id VARCHAR(36) NOT NULL,
  group_id VARCHAR(36) NOT NULL,
  name VARCHAR(40) NOT NULL,
  price_delta DECIMAL(12,2) NOT NULL DEFAULT 0,
  cost_mode VARCHAR(6) NOT NULL DEFAULT 'fixed',
  fixed_cost DECIMAL(14,4) NOT NULL DEFAULT 0,
  is_default TINYINT(1) NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  KEY options_group_idx (group_id, sort_order),
  UNIQUE KEY options_cafe_id_id (cafe_id, id),
  CONSTRAINT options_cost_mode_check CHECK (cost_mode IN ('recipe','fixed')),
  CONSTRAINT options_cafe_fk FOREIGN KEY (cafe_id) REFERENCES cafes(id) ON DELETE CASCADE,
  CONSTRAINT options_group_fk FOREIGN KEY (cafe_id, group_id) REFERENCES option_groups(cafe_id, id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE IF NOT EXISTS product_option_groups (
  cafe_id VARCHAR(36) NOT NULL,
  product_id VARCHAR(36) NOT NULL,
  group_id VARCHAR(36) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  PRIMARY KEY (product_id, group_id),
  KEY product_option_groups_group_idx (group_id),
  CONSTRAINT pog_product_fk FOREIGN KEY (cafe_id, product_id) REFERENCES products(cafe_id, id) ON DELETE CASCADE,
  CONSTRAINT pog_group_fk FOREIGN KEY (cafe_id, group_id) REFERENCES option_groups(cafe_id, id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE IF NOT EXISTS ingredients (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  cafe_id VARCHAR(36) NOT NULL,
  name VARCHAR(60) NOT NULL,
  unit VARCHAR(4) NOT NULL DEFAULT 'g',
  package_size DECIMAL(12,3) NOT NULL DEFAULT 1000,
  package_price DECIMAL(12,2) NOT NULL DEFAULT 0,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  UNIQUE KEY ingredients_cafe_name (cafe_id, name),
  UNIQUE KEY ingredients_cafe_id_id (cafe_id, id),
  CONSTRAINT ingredients_unit_check CHECK (unit IN ('g','ml','adet')),
  CONSTRAINT ingredients_package_size_check CHECK (package_size > 0 AND package_size < 10000000),
  CONSTRAINT ingredients_package_price_check CHECK (package_price >= 0 AND package_price < 100000000),
  CONSTRAINT ingredients_cafe_fk FOREIGN KEY (cafe_id) REFERENCES cafes(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE IF NOT EXISTS recipe_items (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  cafe_id VARCHAR(36) NOT NULL,
  product_id VARCHAR(36) NULL,
  option_id VARCHAR(36) NULL,
  ingredient_id VARCHAR(36) NOT NULL,
  quantity DECIMAL(12,3) NOT NULL,
  UNIQUE KEY recipe_items_product_uq (product_id, ingredient_id),
  UNIQUE KEY recipe_items_option_uq (option_id, ingredient_id),
  KEY recipe_items_ingredient_idx (ingredient_id),
  CONSTRAINT recipe_items_owner_check CHECK ((product_id IS NULL) <> (option_id IS NULL)),
  CONSTRAINT recipe_items_cafe_fk FOREIGN KEY (cafe_id) REFERENCES cafes(id) ON DELETE CASCADE,
  CONSTRAINT recipe_items_product_fk FOREIGN KEY (cafe_id, product_id) REFERENCES products(cafe_id, id) ON DELETE CASCADE,
  CONSTRAINT recipe_items_option_fk FOREIGN KEY (cafe_id, option_id) REFERENCES options(cafe_id, id) ON DELETE CASCADE,
  CONSTRAINT recipe_items_ingredient_fk FOREIGN KEY (cafe_id, ingredient_id) REFERENCES ingredients(cafe_id, id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE IF NOT EXISTS orders (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  cafe_id VARCHAR(36) NOT NULL,
  table_id VARCHAR(36) NULL,
  table_name VARCHAR(24) NOT NULL,
  is_takeaway TINYINT(1) NOT NULL DEFAULT 0,
  status VARCHAR(10) NOT NULL DEFAULT 'open',
  note VARCHAR(200) NOT NULL DEFAULT '',
  discount_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  cancel_reason VARCHAR(200) NOT NULL DEFAULT '',
  opened_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  closed_at DATETIME(6) NULL,
  opened_by VARCHAR(36) NULL,
  closed_by VARCHAR(36) NULL,
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  is_demo TINYINT(1) NOT NULL DEFAULT 0,
  extra_discount DECIMAL(12,2) NOT NULL DEFAULT 0,
  guests SMALLINT NULL,
  open_table_id VARCHAR(36) AS (IF(status = 'open', table_id, NULL)) STORED,
  UNIQUE KEY orders_one_open_per_table (open_table_id),
  KEY orders_cafe_closed_idx (cafe_id, closed_at),
  KEY orders_cafe_status_idx (cafe_id, status),
  KEY orders_table_idx (table_id),
  UNIQUE KEY orders_cafe_id_id (cafe_id, id),
  CONSTRAINT orders_status_check CHECK (status IN ('open','paid','cancelled')),
  CONSTRAINT orders_closed_check CHECK ((status = 'open') = (closed_at IS NULL)),
  CONSTRAINT orders_discount_amount_check CHECK (discount_amount >= 0),
  CONSTRAINT orders_extra_discount_check CHECK (extra_discount >= 0),
  CONSTRAINT orders_guests_check CHECK (guests IS NULL OR (guests >= 1 AND guests <= 99)),
  CONSTRAINT orders_cafe_fk FOREIGN KEY (cafe_id) REFERENCES cafes(id) ON DELETE CASCADE,
  CONSTRAINT orders_table_fk FOREIGN KEY (table_id) REFERENCES dining_tables(id),
  CONSTRAINT orders_opened_by_fk FOREIGN KEY (opened_by) REFERENCES app_users(id) ON DELETE SET NULL,
  CONSTRAINT orders_closed_by_fk FOREIGN KEY (closed_by) REFERENCES app_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE IF NOT EXISTS order_items (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  cafe_id VARCHAR(36) NOT NULL,
  order_id VARCHAR(36) NOT NULL,
  product_id VARCHAR(36) NULL,
  product_name VARCHAR(60) NOT NULL,
  category_name VARCHAR(40) NOT NULL DEFAULT '',
  option_ids VARCHAR(800) NOT NULL DEFAULT '[]',
  options_label VARCHAR(400) NOT NULL DEFAULT '',
  quantity INT NOT NULL,
  unit_price DECIMAL(12,2) NOT NULL,
  unit_cost DECIMAL(14,4) NOT NULL DEFAULT 0,
  is_comp TINYINT(1) NOT NULL DEFAULT 0,
  note VARCHAR(120) NOT NULL DEFAULT '',
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  created_by VARCHAR(36) NULL,
  list_price DECIMAL(12,2) NULL,
  unit_discount DECIMAL(12,2) NOT NULL DEFAULT 0,
  split_parts SMALLINT NOT NULL DEFAULT 1,
  KEY order_items_order_idx (order_id, created_at),
  KEY order_items_product_idx (product_id),
  CONSTRAINT order_items_quantity_check CHECK (quantity >= 1 AND quantity <= 999),
  CONSTRAINT order_items_split_parts_check CHECK (split_parts >= 1 AND split_parts <= 20),
  CONSTRAINT order_items_unit_price_check CHECK (unit_price >= 0),
  CONSTRAINT order_items_unit_cost_check CHECK (unit_cost >= 0),
  CONSTRAINT order_items_unit_discount_check CHECK (unit_discount >= 0 AND unit_discount <= unit_price),
  CONSTRAINT order_items_order_fk FOREIGN KEY (cafe_id, order_id) REFERENCES orders(cafe_id, id) ON DELETE CASCADE,
  CONSTRAINT order_items_product_fk FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL,
  CONSTRAINT order_items_created_by_fk FOREIGN KEY (created_by) REFERENCES app_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE IF NOT EXISTS payments (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  cafe_id VARCHAR(36) NOT NULL,
  order_id VARCHAR(36) NOT NULL,
  method VARCHAR(8) NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  commission_rate DECIMAL(6,4) NOT NULL DEFAULT 0,
  commission_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  created_by VARCHAR(36) NULL,
  vat_rate DECIMAL(5,4) NOT NULL DEFAULT 0,
  vat_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  KEY payments_cafe_created_idx (cafe_id, created_at),
  KEY payments_order_idx (order_id),
  CONSTRAINT payments_method_check CHECK (method IN ('cash','card','ticket')),
  CONSTRAINT payments_amount_check CHECK (amount > 0),
  CONSTRAINT payments_order_fk FOREIGN KEY (cafe_id, order_id) REFERENCES orders(cafe_id, id) ON DELETE CASCADE,
  CONSTRAINT payments_created_by_fk FOREIGN KEY (created_by) REFERENCES app_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE IF NOT EXISTS payment_items (
  payment_id VARCHAR(36) NOT NULL,
  item_id VARCHAR(36) NOT NULL,
  cafe_id VARCHAR(36) NOT NULL,
  quantity INT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  PRIMARY KEY (payment_id, item_id),
  KEY payment_items_item_idx (item_id),
  CONSTRAINT payment_items_quantity_check CHECK (quantity >= 1 AND quantity <= 999),
  CONSTRAINT payment_items_amount_check CHECK (amount >= 0),
  CONSTRAINT payment_items_cafe_fk FOREIGN KEY (cafe_id) REFERENCES cafes(id) ON DELETE CASCADE,
  CONSTRAINT payment_items_payment_fk FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE CASCADE,
  CONSTRAINT payment_items_item_fk FOREIGN KEY (item_id) REFERENCES order_items(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE IF NOT EXISTS cafe_days (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  cafe_id VARCHAR(36) NOT NULL,
  business_date DATE NOT NULL,
  opened_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  opened_by VARCHAR(36) NULL,
  opening_cash DECIMAL(12,2) DEFAULT 0,
  closed_at DATETIME(6) NULL,
  closed_by VARCHAR(36) NULL,
  expected_cash DECIMAL(12,2) NULL,
  counted_cash DECIMAL(12,2) NULL,
  cash_difference DECIMAL(12,2) NULL,
  summary TEXT NULL,
  note VARCHAR(200) NOT NULL DEFAULT '',
  pos_total DECIMAL(12,2) NULL,
  card_expected DECIMAL(12,2) NULL,
  card_difference DECIMAL(12,2) NULL,
  open_cafe_id VARCHAR(36) AS (IF(closed_at IS NULL, cafe_id, NULL)) STORED,
  UNIQUE KEY cafe_days_one_open (open_cafe_id),
  KEY cafe_days_cafe_opened_idx (cafe_id, opened_at),
  CONSTRAINT cafe_days_counted_cash_check CHECK (counted_cash IS NULL OR (counted_cash >= 0 AND counted_cash < 10000000)),
  CONSTRAINT cafe_days_opening_cash_check CHECK (opening_cash IS NULL OR (opening_cash >= 0 AND opening_cash < 10000000)),
  CONSTRAINT cafe_days_cafe_fk FOREIGN KEY (cafe_id) REFERENCES cafes(id),
  CONSTRAINT cafe_days_opened_by_fk FOREIGN KEY (opened_by) REFERENCES app_users(id) ON DELETE SET NULL,
  CONSTRAINT cafe_days_closed_by_fk FOREIGN KEY (closed_by) REFERENCES app_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE IF NOT EXISTS expenses (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  cafe_id VARCHAR(36) NOT NULL,
  kind VARCHAR(10) NOT NULL DEFAULT 'monthly',
  category VARCHAR(12) NOT NULL DEFAULT 'diger',
  name VARCHAR(60) NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  starts_on DATE NOT NULL,
  ends_on DATE NULL,
  note VARCHAR(200) NOT NULL DEFAULT '',
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  is_demo TINYINT(1) NOT NULL DEFAULT 0,
  KEY expenses_cafe_idx (cafe_id, starts_on),
  CONSTRAINT expenses_kind_check CHECK (kind IN ('monthly','one_time')),
  CONSTRAINT expenses_category_check CHECK (category IN ('kira','fatura','personel','banka','vergi','ekipman','pazarlama','diger')),
  CONSTRAINT expenses_amount_check CHECK (amount >= 0 AND amount < 100000000),
  CONSTRAINT expenses_one_time_check CHECK (kind = 'monthly' OR ends_on IS NULL),
  CONSTRAINT expenses_range_check CHECK (ends_on IS NULL OR ends_on >= starts_on),
  CONSTRAINT expenses_cafe_fk FOREIGN KEY (cafe_id) REFERENCES cafes(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

-- Masadaki QR koddan gelen istekler (sipariş, garson çağırma, hesap isteme). Yalnızca MySQL sürümünde var.
-- Siparişin kalemleri ayrıca masanın adisyonuna eklenir; bu tablo bar ekranındaki bildirim ve müşterinin
-- telefonundaki durum (Alındı / Hazırlanıyor / Teslim edildi) içindir. Kişisel veri tutulmaz.
CREATE TABLE IF NOT EXISTS guest_requests (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  cafe_id VARCHAR(36) NOT NULL,
  table_id VARCHAR(36) NULL,
  table_name VARCHAR(24) NOT NULL,
  kind VARCHAR(8) NOT NULL,
  summary VARCHAR(600) NOT NULL DEFAULT '',
  note VARCHAR(300) NOT NULL DEFAULT '',
  total DECIMAL(12,2) NOT NULL DEFAULT 0,
  status VARCHAR(12) NOT NULL DEFAULT 'yeni',
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  KEY guest_requests_cafe_status (cafe_id, status, created_at),
  KEY guest_requests_table (table_id, created_at),
  CONSTRAINT guest_requests_kind_check CHECK (kind IN ('order','garson','hesap')),
  CONSTRAINT guest_requests_status_check CHECK (status IN ('yeni','hazirlaniyor','teslim','iptal')),
  CONSTRAINT guest_requests_cafe_fk FOREIGN KEY (cafe_id) REFERENCES cafes(id) ON DELETE CASCADE,
  CONSTRAINT guest_requests_table_fk FOREIGN KEY (table_id) REFERENCES dining_tables(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

-- Yağmur uyarısı (radar): panel sunucusu en fazla 5 dakikada bir RainViewer radarından ölçer (src/lib/rain/check.ts).
-- Uyarı açılınca tabletlerde şerit çıkar; "Topladık" o kafedeki bütün cihazlarda kapatır.
CREATE TABLE IF NOT EXISTS rain_status (
  cafe_id VARCHAR(36) NOT NULL PRIMARY KEY,
  checked_at DATETIME(6) NOT NULL,
  frame_at DATETIME(6) NULL,
  frame_age_min DECIMAL(6,1) NULL,
  stale TINYINT(1) NOT NULL DEFAULT 0,
  eta_min INT NULL,
  nearest_km DECIMAL(7,1) NULL,
  speed_kmh INT NULL,
  from_deg INT NULL,
  alert_since DATETIME(6) NULL,
  last_alert_seen DATETIME(6) NULL,
  ack_at DATETIME(6) NULL,
  ack_by VARCHAR(60) NOT NULL DEFAULT '',
  CONSTRAINT rain_status_cafe_fk FOREIGN KEY (cafe_id) REFERENCES cafes(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
`;

/** Var olan veritabanına sonradan eklenen sütunlar (tablo, sütun, tanım) */
export const SCHEMA_COLUMNS: [table: string, column: string, ddl: string][] = [
  ["cafes", "qr_ordering", "ADD COLUMN qr_ordering TINYINT(1) NOT NULL DEFAULT 1"],
  ["cafes", "lat", "ADD COLUMN lat DECIMAL(9,6) NULL, ADD COLUMN lon DECIMAL(9,6) NULL, ADD COLUMN rain_warn_min INT NOT NULL DEFAULT 15"],
  ["dining_tables", "qr_token", "ADD COLUMN qr_token VARCHAR(32) NULL, ADD UNIQUE KEY dining_tables_qr_token (qr_token)"],
];
