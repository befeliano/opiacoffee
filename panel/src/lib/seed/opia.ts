// Opia Coffee Co. adisyon kurulumu: kategoriler, ürünler, fiyatlar ve seçenek grupları.
// İlk kez site/data/menu.json'dan üretildi. Kurulumdan sonra menü panelden (Menü ekranı) yönetilir;
// bu dosya yalnızca yeni bir veritabanı kurulurken (npm run setup:mysql) kullanılır.

import type { CafeDef } from "./menus";

const range = (prefix: string, from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => `${prefix}${from + i}`);

export const OPIA_CAFE: CafeDef = {
  slug: "opia",
  name: "Opia Coffee Co.",
  theme: "slate",
  timezone: "Europe/Istanbul",
  cardCommissionRate: 0.01,
  openHour: 9,
  closeHour: 24,
  areas: [{ name: "Salon", tables: range("Masa ", 1, 12) }],
  takeaway: "Gel-Al",
  demoDailyOrders: 55,
  favorites: ["Latte", "Americano", "Flat White", "Cappuccino", "Espresso", "Filtre Kahve", "Türk Kahvesi", "Matcha Latte", "San Sebastian Cheesecake", "Brownie"],
  ingredients: [],
  groups: [
    {
      key: "temp",
      name: "Sıcaklık",
      selection: "single",
      options: [
        { key: "hot", name: "Sıcak", isDefault: true, demoShare: 0.65 },
        { key: "iced", name: "Soğuk", demoShare: 0.35 },
      ],
    },
    {
      key: "milk",
      name: "Süt",
      selection: "single",
      options: [
        { key: "regular", name: "Normal süt", isDefault: true, demoShare: 0.82 },
        { key: "lf", name: "Laktozsuz süt", priceDelta: 20, demoShare: 0.1 },
        { key: "plant", name: "Bitkisel süt (vegan)", priceDelta: 50, demoShare: 0.08 },
      ],
    },
    {
      key: "shot",
      name: "Ekstra shot",
      selection: "single",
      options: [
        { key: "shot1", name: "+1 shot", priceDelta: 50, demoShare: 0.08 },
        { key: "shot2", name: "+2 shot", priceDelta: 100, demoShare: 0.02 },
      ],
    },
    {
      key: "dessert",
      name: "Tatlı ekstra",
      selection: "multi",
      options: [
        { key: "choc", name: "Çikolata sos", priceDelta: 70, demoShare: 0.1 },
        { key: "icecream", name: "Dondurma", priceDelta: 50, demoShare: 0.12 },
      ],
    },
  ],
  categories: [
    {
      name: "Sıcak Kahveler",
      subtitle: "Espresso bazlı, filtre ve Türk kahvesi.",
      products: [
        { name: "Espresso", price: 120, description: "Yoğun ve dengeli, tek shot.", tags: ["vegan"], groups: ["shot"], demoWeight: 3 },
        { name: "Americano", price: 140, description: "Espresso ve sıcak su. Temiz ve hafif.", tags: ["vegan"], groups: ["temp","shot"], demoWeight: 5 },
        { name: "Latte", price: 170, description: "Yumuşak, sütlü, uzun içimli.", tags: ["milk"], groups: ["temp","milk","shot"], demoWeight: 6 },
        { name: "Piccolo Latte", price: 160, description: "Küçük bardakta yoğun, sütlü bir içim.", tags: ["milk"], groups: ["milk","shot"] },
        { name: "Flat White", price: 170, description: "Çift shot, ipek dokulu süt. Kahve karakteri önde.", tags: ["milk"], groups: ["temp","milk","shot"], demoWeight: 4 },
        { name: "Cappuccino", price: 170, description: "Espresso, süt ve yoğun süt köpüğü.", tags: ["milk"], groups: ["milk","shot"], demoWeight: 4 },
        { name: "Cortado", price: 150, description: "Espresso ve az miktarda sıcak süt.", tags: ["milk"], groups: ["milk","shot"] },
        { name: "Rooibos Cortado", price: 170, description: "Kafeinsiz alternatif: rooibos ve sıcak süt.", tags: ["milk"], groups: ["milk"] },
        { name: "Süt Reçelli Latte", price: 180, description: "Süt reçeli ile tatlandırılmış latte.", tags: ["milk"], groups: ["temp","milk","shot"] },
        { name: "Mocha", price: 180, description: "Espresso, çikolata ve süt. Chocolate, white chocolate ya da caramel seçenekleriyle.", tags: ["milk"], groups: ["temp","milk","shot"] },
        { name: "Filtre Kahve", price: 150, description: "Günün filtre çekirdeği, temiz ve aydınlık bir fincan.", tags: ["vegan"], groups: ["temp","shot"], demoWeight: 3 },
        { name: "Red Eye", price: 180, description: "Filtre kahveye bir shot espresso.", tags: ["vegan"], groups: ["shot"] },
        { name: "Black Eye", price: 200, description: "Filtre kahveye çift shot espresso. En sert seçenek.", tags: ["vegan"], groups: ["shot"] },
        { name: "Türk Kahvesi", price: 120, description: "Cezvede, bol köpüklü.", tags: ["vegan"], demoWeight: 3 },
        { name: "Duble Türk Kahvesi", price: 160, description: "Türk kahvesi, çift porsiyon.", tags: ["vegan"] },
      ],
    },
    {
      name: "Matcha Bar",
      subtitle: "",
      products: [
        { name: "Matcha Çayı", price: 160, description: "Çırpılmış matcha, sıcak su ile.", tags: ["vegan"], groups: ["temp"] },
        { name: "Matcha Latte", price: 180, description: "Matcha ve süt. Bitkisel süt seçeneğiyle vegan olur.", tags: ["milk"], groups: ["temp","milk","shot"], demoWeight: 3 },
        { name: "Oat Pistachio, Matcha", price: 250, description: "Yulaf sütü, Antep fıstığı ve matcha çayı.", tags: ["gluten","nuts"], groups: ["temp"] },
      ],
    },
    {
      name: "Kışa Özel",
      subtitle: "Soğuk günlerin fincanları.",
      products: [
        { name: "Golden Latte", price: 160, description: "Zencefil, tarçın, bal ve süt. Kahvesiz, sıcacık.", tags: ["milk"], groups: ["milk"] },
        { name: "Cafe Miel", price: 180, description: "Tarçın, bal, espresso ve süt.", tags: ["milk"], groups: ["temp","milk","shot"] },
        { name: "Chai Tea Latte", price: 180, description: "Baharatlı çay ve süt.", tags: ["milk"], groups: ["temp","milk","shot"] },
        { name: "Salep", price: 180, description: "Sütle pişen, tarçınla servis edilen klasik kış içeceği.", tags: ["milk"], groups: ["milk"] },
      ],
    },
    {
      name: "Sıcak Çikolata",
      subtitle: "",
      products: [
        { name: "Klasik Sıcak Çikolata", price: 180, description: "Çikolata ve süt. Yoğun ve koyu.", tags: ["milk"], groups: ["temp","milk"], demoWeight: 2 },
        { name: "Matcha Beyaz Çikolata", price: 220, description: "Matcha ve beyaz çikolata. Badem sütü ile hazırlanır.", tags: ["milk","nuts"] },
        { name: "Gingerbread Çikolata", price: 180, description: "Tarçın, zencefil, muskat ve vanilya ile sıcak çikolata.", tags: ["milk"], groups: ["milk"] },
      ],
    },
    {
      name: "Tatlılar",
      subtitle: "Günlük çeşitlerimizi sorunuz.",
      products: [
        { name: "Tart", price: 220, description: "Süt reçelli ya da çikolatalı. Günlük çeşidi sorunuz.", tags: ["gluten","milk","egg"], groups: ["dessert"] },
        { name: "Opia Cup", price: 220, description: "Bardakta servis edilen imza tatlımız.", tags: ["gluten","milk","egg"], groups: ["dessert"] },
        { name: "Tiramisu", price: 200, description: "Espresso ile ıslanmış kedi dili, mascarpone, kakao.", tags: ["gluten","milk","egg"], groups: ["dessert"], demoWeight: 2 },
        { name: "Büyükanne Turtası", price: 230, description: "Ev usulü turta, sıcak servis edilebilir.", tags: ["gluten","milk","egg"], groups: ["dessert"] },
        { name: "Torte", price: 240, description: "Katmanlı, kremalı pasta dilimi.", tags: ["gluten","milk","egg"], groups: ["dessert"] },
        { name: "Cheesecake", price: 240, description: "Klasik, kremsi, bisküvi tabanlı.", tags: ["gluten","milk","egg"], groups: ["dessert"] },
        { name: "San Sebastian Cheesecake", price: 230, description: "Yanık yüzeyli, içi akışkan, baskın krem peynir.", tags: ["milk","egg","gluten"], groups: ["dessert"], demoWeight: 3 },
        { name: "Brownie", price: 240, description: "Beyaz çikolatalı ve vişneli.", tags: ["gluten","milk","egg"], groups: ["dessert"], demoWeight: 2 },
      ],
    },
    {
      name: "Ekstralar",
      subtitle: "İçeceğine ve tatlına ekle.",
      products: [
        { name: "Süt", price: 10, description: "İçeceğine ekstra süt.", tags: ["milk"], demoWeight: 0.3 },
        { name: "Laktozsuz Süt", price: 20, description: "Süt yerine laktozsuz süt.", tags: ["milk"], demoWeight: 0.3 },
        { name: "Bitkisel Süt", price: 50, description: "Yulaf ya da badem sütü.", tags: ["gluten","nuts"], demoWeight: 0.3 },
        { name: "Single Espresso İlave", price: 50, description: "İçeceğine bir shot espresso daha.", demoWeight: 0.3 },
        { name: "Çikolata", price: 70, description: "Tatlının yanına çikolata sosu.", tags: ["milk"], demoWeight: 0.3 },
        { name: "Dondurma", price: 50, description: "Tatlının yanına vanilyalı dondurma.", tags: ["milk","egg"], demoWeight: 0.3 },
      ],
    },
  ],
};

/** Yalnızca yerel geliştirme (MYSQL_SEED_DEMO=1) hesapları. Canlıda hesaplar npm run setup:mysql ile açılır. */
export const OPIA_DEV_TEAM = [
  { key: "sahip", email: "sahip@opia.local", name: "Sahip", password: "opia-sahip", memberships: [{ slug: "opia", role: "owner" as const }] },
  { key: "bar", email: "bar@opia.local", name: "Bar", password: "opia-bar", memberships: [{ slug: "opia", role: "staff" as const }] },
];
