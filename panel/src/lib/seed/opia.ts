// Opia Coffee Co. adisyon kurulumu: kategoriler, ürünler, fiyatlar ve seçenek grupları.
// scripts/import-jacca-menu.mjs ile güncel menüden (opiacoffee.jacca.com, 23 Kasım 2026) üretildi.
// Kurulumdan sonra menü panelden (Menü ekranı) yönetilir; bu dosya yalnızca yeni bir veritabanı
// kurulurken (npm run setup:mysql) kullanılır.

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
  favorites: ["Latte", "Americano", "Flat White", "Cappucino", "Espresso", "Iced Latte", "Iced Americano", "Filtre Kahve", "Türk Kahvesi", "Iced Matcha Latte", "San Sebastian Cheesecake", "Beyaz Çikolatalı Brownie"],
  ingredients: [],
  groups: [
    {
      key: "milk",
      name: "Süt",
      selection: "single",
      options: [
        { key: "regular", name: "Normal süt", isDefault: true, demoShare: 0.8 },
        { key: "oat", name: "Yulaf sütü", priceDelta: 50, demoShare: 0.08 },
        { key: "almond", name: "Badem sütü", priceDelta: 50, demoShare: 0.05 },
        { key: "coconut", name: "Hindistan cevizi sütü", priceDelta: 50, demoShare: 0.04 },
        { key: "protein", name: "Yüksek protein süt", priceDelta: 50, demoShare: 0.03 },
      ],
    },
    {
      key: "dessert",
      name: "Tatlı ekstra",
      selection: "multi",
      options: [
        { key: "icecream", name: "Dondurma", priceDelta: 60, demoShare: 0.12 },
        { key: "choc", name: "Çikolata sos", priceDelta: 70, demoShare: 0.1 },
      ],
    },
  ],
  categories: [
    {
      name: "OPIA Fall&Winter",
      subtitle: "Sezonun fincanları.",
      products: [
        { name: "Levant", price: 275, description: "Espresso, çikolata ve tahinli ipeksi foam ile hazırlanan modern mocha yorumu.", tags: ["milk"], groups: ["milk"], demoWeight: 2 },
        { name: "Sıcak Çikolata", price: 200, description: "Çikolata ve süt. Yoğun ve koyu.", tags: ["milk"], groups: ["milk"], demoWeight: 1 },
        { name: "Salep", price: 200, description: "Sütle pişen, tarçınla servis edilen klasik kış içeceği.", tags: ["milk"], groups: ["milk"], demoWeight: 1 },
        { name: "Cafe Miel", price: 220, description: "Tarçın, Bal, Espresso, Süt.", tags: ["milk"], groups: ["milk"], demoWeight: 1 },
        { name: "Golden Latte", price: 210, description: "Zencefil, Tarçın, Bal, Süt", tags: ["milk"], groups: ["milk"], demoWeight: 1 },
        { name: "Pumpkin Spice Latte", price: 220, tags: ["milk"], groups: ["milk"], demoWeight: 1 },
      ],
    },
    {
      name: "PROTEIN Bar",
      subtitle: "Protein shake'ler; besin değerleri açıklamada.",
      products: [
        { name: "Berry Bliss", price: 260, description: "24 g protein / 13 g karbonhidrat / 5 g yağ Protein Tozu, Kırmızı Meyveler, Süt, Buz", tags: ["milk"], demoWeight: 1 },
        { name: "Golden Crunch", price: 280, description: "24 g protein / 20 g karbonhidrat / 5 g yağ Protein Tozu, Muz, Tarçın, Süt, Buz", tags: ["milk"], demoWeight: 1 },
        { name: "Dark Matter", price: 290, description: "25 g protein / 14 g karbonhidrat / 10 g yağ Protein Tozu, Espresso, Bitter Çikolata, Kakao, Süt, Buz", tags: ["milk"], demoWeight: 1 },
        { name: "Green Muse", price: 320, description: "24 g protein / 19 g karbonhidrat / 5 g yağ Protein Tozu, Matcha, Muz, Süt, Buz", tags: ["milk"], demoWeight: 1 },
        { name: "Mango Ritual", price: 320, description: "21 g protein / 11 g karbonhidrat / 3 g yağ Protein Tozu, Mango, Hindistan Cevizi Sütü, Buz", tags: ["milk"], demoWeight: 1 },
      ],
    },
    {
      name: "Espresso Bar",
      subtitle: "Espresso bazlı sıcak kahveler.",
      products: [
        { name: "Espresso", price: 140, description: "Yoğun ve dengeli, tek shot.", demoWeight: 3 },
        { name: "Americano", price: 170, description: "Espresso ve sıcak su. Temiz ve hafif.", demoWeight: 5 },
        { name: "Latte", price: 190, description: "Yumuşak, sütlü, uzun içimli.", tags: ["milk"], groups: ["milk"], demoWeight: 6 },
        { name: "Flat White", price: 190, description: "Çift shot, ipek dokulu süt. Kahve karakteri önde.", tags: ["milk"], groups: ["milk"], demoWeight: 5 },
        { name: "Cappucino", price: 190, description: "Espresso, süt ve yoğun süt köpüğü.", tags: ["milk"], groups: ["milk"], demoWeight: 4 },
        { name: "Cortado", price: 170, description: "Espresso ve az miktarda sıcak süt.", tags: ["milk"], groups: ["milk"], demoWeight: 1 },
        { name: "Dark Chocolate Mocha", price: 220, description: "Espresso, çikolata ve süt. Chocolate, white chocolate ya da caramel seçenekleriyle.", tags: ["milk"], groups: ["milk"], demoWeight: 1 },
        { name: "White Chocolate Mocha", price: 220, tags: ["milk"], groups: ["milk"], demoWeight: 1 },
        { name: "Caramel Mocha", price: 220, tags: ["milk"], groups: ["milk"], demoWeight: 1 },
        { name: "Caramel Latte", price: 220, tags: ["milk"], groups: ["milk"], demoWeight: 1 },
        { name: "Süt Reçelli Latte", price: 210, description: "Süt reçeli ile tatlandırılmış latte.", tags: ["milk"], groups: ["milk"], demoWeight: 1 },
        { name: "Rooibos Cortado", price: 180, description: "Kafeinsiz alternatif: rooibos ve sıcak süt.", tags: ["milk"], groups: ["milk"], demoWeight: 1 },
        { name: "RED EYE", price: 210, description: "Filtre kahveye bir shot espresso.", demoWeight: 1 },
        { name: "BLACK EYE", price: 240, description: "Filtre kahveye çift shot espresso. En sert seçenek.", demoWeight: 1 },
      ],
    },
    {
      name: "Brew Bar",
      subtitle: "Filtre kahve ve günün çekirdekleri: V60/Kalita ya da Japanes",
      products: [
        { name: "Filtre Kahve", price: 180, description: "Günün filtre çekirdeği, temiz ve aydınlık bir fincan.", demoWeight: 3 },
        { name: "Etiyopya Chelbesa V60/Kalita", price: 270, description: "Yöre: Etiyopya, Yirgacheffe Çiftlik/İstasyon: Worka Chelbesa Üretici: Worka Chelbesa ile Çalışan Çiftçiler Rakım: 2.000-2.100 m Varyete: Heirloom İşlem: Natürel Profil: Filtre Tadım Notları: Karpuz, K", demoWeight: 1 },
        { name: "Etiyopya Chelbesa Japanese Cold Brew", price: 300, description: "Yöre: Etiyopya, Yirgacheffe Çiftlik/İstasyon: Worka Chelbesa Üretici: Worka Chelbesa ile Çalışan Çiftçiler Rakım: 2.000-2.100 m Varyete: Heirloom İşlem: Natürel Profil: Filtre Tadım Notları: Karpuz, K", demoWeight: 1 },
        { name: "Peru Edilberto Torres V60/Kalita", price: 250, description: "Yöre: Peru, Jaén, Cajamarca İstasyon: Chacra Coffee Company Üretici: Edilberto Torres Rakım: 1.800 – 2.100 m Varyete: Harman Varyeteler İşlem: Natürel Tadım Notaları: Kırmızı Erik, Kuru Üzüm, Bal Tadı", demoWeight: 1 },
        { name: "Peru Edilberto Torres Japanese Cold Brew", price: 280, description: "Yöre: Peru, Jaén, Cajamarca İstasyon: Chacra Coffee Company Üretici: Edilberto Torres Rakım: 1.800 – 2.100 m Varyete: Harman Varyeteler İşlem: Natürel Tadım Notaları: Kırmızı Erik, Kuru Üzüm, Bal Tadı", demoWeight: 1 },
        { name: "Kolombiya Diego Horta V60/Kalita", price: 300, description: "Yöre: Kolombiya, Santa Maria, Huila İstasyon: Diego Horta ile çalışan küçük üreticiler Üretici: Diego Horta Rakım: 1.500 – 2.000 m Varyete: Colombia, Castillo İşlem: Natürel Tadım Notları: Portakal, K", demoWeight: 1 },
        { name: "Kolombiya Diego Horta Japanese Cold Brew", price: 330, description: "Yöre: Kolombiya, Santa Maria, Huila İstasyon: Diego Horta ile çalışan küçük üreticiler Üretici: Diego Horta Rakım: 1.500 – 2.000 m Varyete: Colombia, Castillo İşlem: Natürel Tadım Notları: Portakal, K", demoWeight: 1 },
        { name: "Kenya Wanrich V60/Kalita", price: 300, description: "Yöre: Kenya, Rift Vadisi Çiftlik/İstasyon: Wanrich Üretici: Jane Wanjiku Kiriri–Kamau Rakım: 1.800-2.000 m Varyete: SL28, SL34, Batian, Ruiru İşlem: Anaerobik Yıkanmış Profil: Filtre Tadım Notları: Po", demoWeight: 1 },
        { name: "Kenya Wanrich Japanese Cold Brew", price: 330, description: "Yöre: Kenya, Rift Vadisi Çiftlik/İstasyon: Wanrich Üretici: Jane Wanjiku Kiriri–Kamau Rakım: 1.800-2.000 m Varyete: SL28, SL34, Batian, Ruiru İşlem: Anaerobik Yıkanmış Profil: Filtre Tadım Notları: Po", demoWeight: 1 },
        { name: "Kenya Kathakwa V60/Kalita", price: 280, description: "Yöre: Kenya, Kirinyaga Çiftlik/İstasyon: Kathakwa Üretici: Kathakwa İstasyonu ile Çalışan Çiftçiler Rakım: 1.610 m. Varyete: SL28, SL34, Batian İşlem: Yıkanmış Profil: Filtre Tadım Notları: Greyfurt, ", demoWeight: 1 },
        { name: "Kenya Kathakwa Japanese Cold Brew", price: 310, description: "Kenya, Kirinyaga Çiftlik/İstasyon: Kathakwa Üretici: Kathakwa İstasyonu ile Çalışan Çiftçiler Rakım: 1.610 m. Varyete: SL28, SL34, Batian İşlem: Yıkanmış Profil: Filtre Tadım Notları: Greyfurt, Kumkat", demoWeight: 1 },
      ],
    },
    {
      name: "Cold Coffee",
      subtitle: "Buzlu kahveler.",
      products: [
        { name: "Iced Espresso", price: 150, demoWeight: 1 },
        { name: "Iced Americano", price: 180, demoWeight: 4 },
        { name: "Iced Latte", price: 200, tags: ["milk"], groups: ["milk"], demoWeight: 5 },
        { name: "Iced Flat White", price: 200, tags: ["milk"], groups: ["milk"], demoWeight: 1 },
        { name: "Iced Caramel Latte", price: 230, tags: ["milk"], groups: ["milk"], demoWeight: 1 },
        { name: "Iced Mocha", price: 230, tags: ["milk"], groups: ["milk"], demoWeight: 1 },
        { name: "Iced Caramel Mocha", price: 230, tags: ["milk"], groups: ["milk"], demoWeight: 1 },
        { name: "Iced White Mocha", price: 230, tags: ["milk"], groups: ["milk"], demoWeight: 1 },
        { name: "Süt Reçelli Iced Latte", price: 220, tags: ["milk"], groups: ["milk"], demoWeight: 1 },
        { name: "Espresso Soda", price: 200, demoWeight: 1 },
        { name: "Espresso Tonic", price: 190, demoWeight: 1 },
      ],
    },
    {
      name: "Türk Kahvesi",
      subtitle: "",
      products: [
        { name: "Türk Kahvesi", price: 120, description: "Cezvede, bol köpüklü.", demoWeight: 3 },
        { name: "Double Türk Kahvesi", price: 160, description: "Türk kahvesi, çift porsiyon.", demoWeight: 1 },
      ],
    },
    {
      name: "Matcha Bar",
      subtitle: "Sıcak ve soğuk matcha.",
      products: [
        { name: "Matcha Çayı", price: 190, description: "Çırpılmış matcha, sıcak su ile.", demoWeight: 1 },
        { name: "Matcha Latte", price: 220, description: "Matcha ve süt. Bitkisel süt seçeneğiyle vegan olur.", tags: ["milk"], groups: ["milk"], demoWeight: 3 },
        { name: "Vanilla Matcha Latte", price: 250, tags: ["milk"], groups: ["milk"], demoWeight: 1 },
        { name: "Coconut Matcha Latte", price: 270, tags: ["milk"], groups: ["milk"], demoWeight: 1 },
        { name: "Iced Matcha Latte", price: 230, tags: ["milk"], groups: ["milk"], demoWeight: 4 },
        { name: "Strawberry Matcha Cloud", price: 280, demoWeight: 1 },
        { name: "Mango Matcha Cloud", price: 280, demoWeight: 1 },
        { name: "Blueberry Matcha Cloud", price: 280, demoWeight: 1 },
        { name: "Coconut Matcha Breeze", price: 280, demoWeight: 1 },
        { name: "Matcha Lemonade", price: 280, description: "Taze limonata, matcha, hafif tatlılık", demoWeight: 1 },
        { name: "Matcha Affogato", price: 290, demoWeight: 1 },
      ],
    },
    {
      name: "Ube Bar",
      subtitle: "Sıcak ve soğuk ube.",
      products: [
        { name: "Ube Çayı", price: 190, demoWeight: 1 },
        { name: "Ube Latte", price: 220, tags: ["milk"], groups: ["milk"], demoWeight: 1 },
        { name: "Vanilla Ube Latte", price: 250, tags: ["milk"], groups: ["milk"], demoWeight: 1 },
        { name: "Coconut Ube Latte", price: 270, tags: ["milk"], groups: ["milk"], demoWeight: 1 },
        { name: "Iced Ube Latte", price: 230, tags: ["milk"], groups: ["milk"], demoWeight: 1 },
        { name: "Strawberry Ube Cloud", price: 280, demoWeight: 1 },
        { name: "Mango Ube Cloud", price: 280, demoWeight: 1 },
        { name: "Blueberry Ube Cloud", price: 280, demoWeight: 1 },
        { name: "Coconut Ube Breeze", price: 280, demoWeight: 1 },
      ],
    },
    {
      name: "Tea Bar",
      subtitle: "Demlik çaylar.",
      products: [
        { name: "Tropical Green", price: 180, description: "Yeşil çay, gül yaprakları, hindistan cevizi, tropikal aromalar", demoWeight: 1 },
        { name: "White Yasmine", price: 180, description: "Beyaz çay yaprağı, yasemin çiçeği", demoWeight: 1 },
        { name: "Berry Punch", price: 180, description: "Böğürtlen, çilek, gül yaprağı, hibiskus, portakal kurusu", demoWeight: 1 },
        { name: "Blue Flowers Earl Grey", price: 180, description: "Siyah Çay, Ebegümeci, Bergamut", demoWeight: 1 },
        { name: "Rooibos Vanilla", price: 180, description: "Rooibos yaprağı,vanilya parçaları, vanilya aroması", demoWeight: 1 },
        { name: "Tropical Mate", price: 180, description: "Mate çayı, ananas parçaları, peygamber çiçeği, tropik meyve ve aromalar", demoWeight: 1 },
      ],
    },
    {
      name: "Tatlılar",
      subtitle: "Günlük çeşitlerimizi sorunuz.",
      products: [
        { name: "San Sebastian Cheesecake", price: 280, description: "Yanık yüzeyli, içi akışkan, baskın krem peynir.", tags: ["milk","egg","gluten"], groups: ["dessert"], demoWeight: 3 },
        { name: "Çikolatalı San Sebastian Cheesecake", price: 350, groups: ["dessert"], demoWeight: 1 },
        { name: "Beyaz Çikolatalı Brownie", price: 280, description: "Beyaz çikolatalı ve vişneli.", tags: ["gluten","milk","egg"], groups: ["dessert"], demoWeight: 2 },
        { name: "Tiramisu", price: 240, description: "Espresso ile ıslanmış kedi dili, mascarpone, kakao.", tags: ["gluten","milk","egg"], groups: ["dessert"], demoWeight: 2 },
        { name: "Torte Della Nonna", price: 260, description: "Ev usulü turta, sıcak servis edilebilir.", tags: ["gluten","milk","egg"], groups: ["dessert"], demoWeight: 1 },
        { name: "Cinnamon Roll", price: 200, groups: ["dessert"], demoWeight: 1 },
      ],
    },
    {
      name: "Sandviçler",
      subtitle: "",
      products: [
        { name: "Dana Füme", price: 380, description: "Dana füme, eski kaşar, krem peynir, pesto sos, roka, balzamik glaze sos.", tags: ["milk","gluten"], demoWeight: 1 },
        { name: "Akdeniz", price: 330, description: "Suda mozzarella, domates, krem peynir, pesto sos, roka, zeytinyağı, balzamik glaze sos.", tags: ["milk","gluten"], demoWeight: 1 },
        { name: "Hindi füme", price: 330, description: "Hindi füme, cheddar peyniri, krem peynir, pesto sos, roka.", tags: ["milk","gluten"], demoWeight: 1 },
      ],
    },
    {
      name: "Diğer Sıcak İçecekler",
      subtitle: "",
      products: [
        { name: "Fincan Çay", price: 100, demoWeight: 1 },
        { name: "Chai Tea Latte", price: 190, description: "Baharatlı çay ve süt.", tags: ["milk"], groups: ["milk"], demoWeight: 1 },
      ],
    },
    {
      name: "Diğer Soğuk İçecekler",
      subtitle: "",
      products: [
        { name: "Su", price: 40, demoWeight: 1 },
        { name: "Soda", price: 80, demoWeight: 1 },
        { name: "Churchill", price: 120, demoWeight: 1 },
        { name: "Iced Chai Tea Latte", price: 200, tags: ["milk"], groups: ["milk"], demoWeight: 1 },
      ],
    },
    {
      name: "Ekstralar",
      subtitle: "İçeceğine ve tatlına ekle.",
      products: [
        { name: "Yulaf Sütü", price: 50, demoWeight: 0.3 },
        { name: "Badem Sütü", price: 50, demoWeight: 0.3 },
        { name: "Hindistan Cevizi Sütü", price: 50, demoWeight: 0.3 },
        { name: "Dondurma", price: 60, description: "Tatlının yanına vanilyalı dondurma.", tags: ["milk","egg"], demoWeight: 0.3 },
        { name: "Çikolata", price: 70, description: "Tatlının yanına çikolata sosu.", tags: ["milk"], demoWeight: 0.3 },
        { name: "Yüksek Protein Süt ( 50 G )", price: 50, tags: ["milk"], demoWeight: 0.3 },
      ],
    },
  ],
};

/** Yalnızca yerel geliştirme (MYSQL_SEED_DEMO=1) hesapları. Canlıda hesaplar npm run setup:mysql ile açılır. */
export const OPIA_DEV_TEAM = [
  { key: "sahip", email: "sahip@opia.local", name: "Sahip", password: "opia-sahip", memberships: [{ slug: "opia", role: "owner" as const }] },
  { key: "bar", email: "bar@opia.local", name: "Bar", password: "opia-bar", memberships: [{ slug: "opia", role: "staff" as const }] },
];
