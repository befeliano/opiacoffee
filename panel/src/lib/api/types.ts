// Veritabanı API fonksiyonlarının döndürdüğü JSON yapıları

import type { Permissions } from "@/lib/permissions";

export type Role = "owner" | "manager" | "staff";
export type PaymentMethod = "cash" | "card" | "ticket";
export type CostMode = "recipe" | "fixed";
export type StockUnit = "g" | "ml" | "adet";
export type OptionSelection = "single" | "multi";
export type ProductTag = "vegan" | "milk" | "gluten" | "nuts" | "egg";

/** Kafe renk paleti (globals.css içindeki [data-cafe-theme] blokları) */
export type CafeTheme = "coffee" | "forest" | "ocean" | "berry" | "slate" | "sunset";

export interface CafeSummary {
  id: string;
  slug: string;
  name: string;
  role: Role;
  theme: CafeTheme;
  /** Yüklenen logo (data: URL); yoksa kahve simgesi */
  logo?: string | null;
}

export interface CafeContext {
  cafe: {
    id: string;
    slug: string;
    name: string;
    timezone: string;
    card_commission_rate: number;
    ticket_commission_rate: number;
    vat_rate: number;
    open_hour: number;
    close_hour: number;
    theme: CafeTheme;
    /** Yüklenen logo (data: URL) */
    logo: string | null;
    /** ISO 4217: TRY, EUR, USD, GBP */
    currency: string;
    language: "tr" | "en";
    /** Açılış/kapanışta kasa sayımı (kapalıysa kafe çalışma saatlerinde kendiliğinden açık) */
    cash_count: boolean;
  };
  role: Role;
  /** Oturumdaki kişinin geçerli yetkileri (rol varsayılanı + kişiye özel) */
  permissions: Permissions;
  user: { id: string; email: string; display_name: string };
  cafes: CafeSummary[];
}

// ---------------------------------------------------------------------
// POS
// ---------------------------------------------------------------------
export interface FloorTable {
  id: string;
  name: string;
  area_id: string | null;
  is_takeaway: boolean;
  order: { id: string; opened_at: string; total: number; paid: number; items: number } | null;
}

export interface FloorData {
  now: string;
  areas: { id: string; name: string }[];
  tables: FloorTable[];
  /** Günün özeti (eski sunucu sürümü yalnızca yönetici ve sahibe döndürürdü) */
  /** İş günü (05:00 sınırlı) */
  business_date: string;
  /** Açık iş günü; kafe kapalıysa null */
  day: { id: string; business_date: string; opened_at: string } | null;
  /** Ciro kapsamı "hiç" olana gelmez; kâr/maliyet yetkisi yoksa cost ve profit boş */
  today?: {
    date: string;
    orders: number;
    items: number;
    revenue: number;
    cost: number | null;
    commission: number;
    profit: number | null;
  } | null;
}

export interface MenuCategory {
  id: string;
  name: string;
  subtitle: string;
}

export interface MenuProduct {
  id: string;
  category_id: string | null;
  name: string;
  description: string;
  price: number;
  /** Joker: fiyatı satışta girilir, maliyeti 0 */
  is_open_price: boolean;
  /** Favoriler sekmesindeki sıra (boş = favori değil) */
  favorite_rank: number | null;
  tags: ProductTag[];
  group_ids: string[];
}

export interface MenuOption {
  id: string;
  name: string;
  price_delta: number;
  is_default: boolean;
}

export interface MenuGroup {
  id: string;
  name: string;
  selection: OptionSelection;
  is_required: boolean;
  options: MenuOption[];
}

export interface PosMenu {
  categories: MenuCategory[];
  products: MenuProduct[];
  groups: MenuGroup[];
}

export interface OrderItem {
  id: string;
  product_id: string | null;
  name: string;
  options_label: string;
  option_ids: string[];
  quantity: number;
  unit_price: number;
  /** Menü fiyatı (satır fiyatı değiştirildiyse farklıdır) */
  list_price: number;
  /** Birim başı indirim */
  unit_discount: number;
  /** Ürün bazlı ödemeyle ödenmiş adet (tam adetler) */
  paid_quantity: number;
  /** Bir adet kaç paya bölündü (1 = bölünmedi) */
  split_parts: number;
  /** Ödenmiş pay sayısı (bölünmemiş satırda = ödenmiş adet) */
  paid_parts: number;
  is_comp: boolean;
  note: string;
  created_at: string;
}

export interface OrderPayment {
  id: string;
  method: PaymentMethod;
  amount: number;
  commission: number;
  created_at: string;
  /** Ürün bazlı ödemede ödenen satırlar, örn. "2× Latte, 1× Cookie" */
  lines: string;
}

export interface Order {
  id: string;
  status: "open" | "paid" | "cancelled";
  table_id: string | null;
  table_name: string;
  is_takeaway: boolean;
  opened_at: string;
  closed_at: string | null;
  note: string;
  cancel_reason: string;
  /** Masadaki kişi sayısı (girilmediyse boş) */
  guests: number | null;
  /** Adisyon geneli indirim (satır indirimleri hariç) */
  extra_discount: number;
  /** Toplam indirim (adisyon + satır) */
  discount: number;
  subtotal: number;
  comp_total: number;
  total: number;
  paid: number;
  remaining: number;
  items_count: number;
  items: OrderItem[];
  payments: OrderPayment[];
}

export interface TableOrderData {
  now: string;
  table: { id: string; name: string; is_takeaway: boolean; is_active: boolean; area_name: string | null };
  order: Order | null;
}

export interface PayResult {
  closed: boolean;
  order: Order;
}

export interface DaySummary {
  orders: number;
  cancelled: number;
  revenue: number;
  discount: number;
  comp: number;
  cost: number;
  cash: number;
  card: number;
  ticket: number;
  commission: number;
}

export interface CafeDay {
  id: string;
  business_date: string;
  opened_at: string;
  opened_by: string;
  /** Boş = açılışta sayım pas geçildi */
  opening_cash: number | null;
  closed_at: string | null;
  closed_by: string;
  /** Boş = kapanışta sayım pas geçildi (ya da gün açık) */
  counted_cash: number | null;
  cash_difference: number | null;
  /** Gün sonunda POS cihazında görünen kart toplamı */
  pos_total: number | null;
  /** POS − sistemdeki kart tahsilatı */
  card_difference: number | null;
  note: string;
  expected_cash?: number | null;
  card_expected?: number | null;
  summary?: DaySummary | null;
}

export interface DayStatus {
  now: string;
  business_date: string;
  open: CafeDay | null;
  /** Açık günün anlık özeti (açılış nakdi girilmediyse beklenen nakit boş) */
  live: (DaySummary & { expected_cash: number | null }) | null;
  last: CafeDay | null;
  open_orders: number;
  history: CafeDay[];
}

export interface DayCloseResult {
  day: CafeDay;
  /** Boş = nakit sayılmadı ya da açılış nakdi girilmedi */
  difference: number | null;
  card_difference: number | null;
}

export interface ZReport {
  cafe: { name: string; timezone: string };
  date: string;
  from: string;
  to: string;
  generated_at: string;
  vat_rate: number;
  commission_rate: number;
  ticket_commission_rate: number;
  sales: { orders: number; cancelled: number; gross: number; comp: number; discount: number; revenue: number; items: number; guests: number };
  payments: {
    cash: number;
    card: number;
    cash_count: number;
    card_count: number;
    ticket: number;
    ticket_count: number;
    total: number;
    vat: number;
    vat_cash: number;
    vat_card: number;
    vat_ticket: number;
    commission: number;
  };
  cost: number;
  expenses: { name: string; category: string; kind: "monthly" | "one_time"; monthly_amount: number | null; amount: number }[];
  summary: {
    revenue: number;
    vat: number;
    revenue_ex_vat: number;
    cost: number;
    commission: number;
    gross_profit: number;
    expenses: number;
    net_profit: number;
  };
  products: { name: string; category: string; qty: number; comp_qty: number | null; revenue: number | null; cost: number }[];
  categories: { name: string | null; qty: number; revenue: number }[];
  payment_list: { at: string; table: string; method: PaymentMethod; amount: number; vat: number; commission: number }[];
  days: CafeDay[];
}

export interface HistoryData {
  date: string;
  today: string;
  orders: Order[];
}

// ---------------------------------------------------------------------
// Menü yönetimi
// ---------------------------------------------------------------------
export interface RecipeLine {
  ingredient_id: string;
  quantity: number;
}

export interface AdminProduct {
  id: string;
  category_id: string | null;
  name: string;
  description: string;
  price: number;
  cost_mode: CostMode;
  fixed_cost: number;
  unit_cost: number;
  tags: ProductTag[];
  is_active: boolean;
  sort_order: number;
  favorite_rank: number | null;
  recipe: RecipeLine[];
  group_ids: string[];
}

export interface AdminIngredient {
  id: string;
  name: string;
  unit: StockUnit;
  package_size: number;
  package_price: number;
  unit_cost: number;
  usage_count: number;
  updated_at: string;
}

export interface AdminOption {
  id: string;
  name: string;
  price_delta: number;
  cost_mode: CostMode;
  fixed_cost: number;
  unit_cost: number;
  is_default: boolean;
  is_active: boolean;
  recipe: RecipeLine[];
}

export interface AdminGroup {
  id: string;
  name: string;
  selection: OptionSelection;
  is_required: boolean;
  sort_order: number;
  product_count: number;
  options: AdminOption[];
}

export interface MenuAdminData {
  categories: (MenuCategory & { sort_order: number })[];
  products: AdminProduct[];
  ingredients: AdminIngredient[];
  groups: AdminGroup[];
}

// ---------------------------------------------------------------------
// Masa düzeni
// ---------------------------------------------------------------------
export interface TablesAdminData {
  areas: { id: string; name: string; sort_order: number }[];
  tables: {
    id: string;
    name: string;
    area_id: string | null;
    is_takeaway: boolean;
    is_active: boolean;
    sort_order: number;
    has_open_order: boolean;
  }[];
}

// ---------------------------------------------------------------------
// Ekip, giderler
// ---------------------------------------------------------------------
export interface TeamMember {
  user_id: string;
  email: string;
  display_name: string;
  role: Role;
  /** Geçerli yetkiler ve yalnızca kişiye özel ayarlananlar */
  permissions: Permissions;
  custom_permissions: Partial<Permissions>;
  created_at: string;
  is_self: boolean;
}

export type ExpenseCategory = "kira" | "fatura" | "personel" | "banka" | "vergi" | "ekipman" | "pazarlama" | "diger";

export interface Expense {
  id: string;
  kind: "monthly" | "one_time";
  category: ExpenseCategory;
  name: string;
  amount: number;
  starts_on: string;
  ends_on: string | null;
  note: string;
}

// ---------------------------------------------------------------------
// Raporlar
// ---------------------------------------------------------------------
export interface DailyRow {
  date: string;
  orders: number;
  revenue: number;
  cost: number;
  commission: number;
  card: number;
  cash: number;
  /** Eski kayıtlarda olmayabilir */
  ticket?: number;
  /** Kişi sayısı girilmiş adisyonların toplam kişi sayısı */
  guests?: number;
  guest_orders?: number;
  guest_revenue?: number;
  discount: number;
  comp_value: number;
  items: number;
  table_sessions: number;
  occupancy_minutes: number;
  takeaway_orders: number;
  cancelled: number;
}

export interface HourlyRow {
  date: string;
  hour: number;
  rounds: number;
  items: number;
  revenue: number;
}

export interface ProductRow {
  product_id: string | null;
  name: string;
  category: string;
  qty: number;
  revenue: number;
  cost: number;
  comp_qty: number;
}

export interface TableRow {
  table_id: string | null;
  name: string;
  sessions: number;
  minutes: number;
  max_minutes: number;
  revenue: number;
}

export interface ReportData {
  range: { from: string; to: string; timezone: string };
  generated_at: string;
  daily: DailyRow[];
  hourly: HourlyRow[];
  products: ProductRow[];
  tables: TableRow[];
  longest: { table_name: string; opened_at: string; closed_at: string; minutes: number; revenue: number }[];
  options: { id: string; name: string; group_name: string; qty: number }[];
  menu: { product_id: string; name: string; category: string; price: number; unit_cost: number; is_active: boolean }[];
}

export interface ProductDailyRow {
  d: string;
  p: string;
  q: number;
}

export interface ProductsReport {
  range: { from: string; to: string; timezone: string };
  first_sale: string | null;
  days: number;
  totals: { orders: number; items: number; revenue: number; cost: number };
  products: (ProductRow & { days_sold: number; is_active: boolean; price: number | null })[];
  unsold: { product_id: string; name: string; category: string; price: number }[];
}
