// Opia menüsü (fiziksel menü görselinden) + tariften hesaplanan besin değerleri -> site/data/menu.json
// Kullanım: node tools/seed-menu.mjs   (mevcut menu.json'un üzerine yazar!)
// Besin mantığı ve kaynaklar: docs/BESIN-DEGERLERI.md
import fs from 'node:fs';

/* ---------- Girdi veritabanı: 100 ml / 100 g başına ----------
   [kcal, yağ, doymuş yağ, karbonhidrat, şeker, protein, tuz(g), kafein(mg)] */
const ING = {
  espresso:   [9, 0.2, 0.0, 1.7, 0.0, 0.1, 0.01, 212],  // USDA 171891 (restoran espresso); kafein ~63 mg / 30 ml shot
  filtre:     [1, 0.0, 0.0, 0.0, 0.0, 0.1, 0.01, 40],   // demleme kahve, USDA tipik değer
  turk:       [3, 0.2, 0.0, 0.4, 0.0, 0.3, 0.01, 65],   // tahmin: telve dahil, 70 ml fincan
  rooibos:    [1, 0.0, 0.0, 0.2, 0.0, 0.0, 0.00, 0],    // demleme bitki çayı
  su:         [0, 0, 0, 0, 0, 0, 0, 0],
  sut:        [61, 3.3, 1.9, 4.8, 4.8, 3.1, 0.11, 0],   // USDA 172217 tam yağlı süt (doymuş yağ etiketten ~1.9)
  laktozsuz:  [61, 3.3, 1.9, 4.8, 4.8, 3.1, 0.11, 0],   // süt ile aynı kabul (laktoz enzimle parçalı)
  yulaf:      [61, 3.0, 0.3, 7.1, 3.4, 1.1, 0.10, 0],   // Oatly Barista (AB etiketi)
  badem:      [24, 1.6, 0.1, 2.5, 2.0, 0.6, 0.10, 0],   // barista badem sütü, USDA şekersiz 15 kcal ile şekerli ~35 arası
  cikolataSos:[343, 2.6, 1.6, 73.6, 72.1, 3.5, 0.13, 0],// Monin Dark Chocolate Sauce / 100 g
  beyazSos:   [330, 3.5, 2.2, 70.0, 68.0, 2.5, 0.15, 0],// tahmin: Monin beyaz çikolata sosu için net panel yok (şeker + yoğunlaştırılmış süt ağırlıklı)
  karamel:    [323, 0.0, 0.0, 79.3, 79.3, 0.0, 0.00, 0],// Monin Caramel Syrup / 100 ml
  sutReceli:  [315, 6.8, 4.3, 55.0, 55.0, 7.0, 0.30, 0],// dulce de leche tipik değer
  bal:        [304, 0.0, 0.0, 82.4, 82.1, 0.3, 0.00, 0],// USDA 169640
  matcha:     [330, 5.0, 1.0, 40.0, 2.0, 30.0, 0.05, 3500], // 285-379 kcal arası etiketler; kafein ~3.5 g/100 g
  fistik:     [562, 45.3, 5.4, 27.2, 7.7, 20.2, 0.01, 0],   // Antep fıstığı (USDA ham fıstık), ezme için
  zencefilSurup: [320, 0.0, 0.0, 78.0, 78.0, 0.0, 0.00, 0],  // Monin tipi şurup ~ karamel ile aynı mertebe
  chai:       [58, 1.9, 1.2, 8.6, 7.1, 1.7, 0.07, 20],  // süt+çay latte, Starbucks Chai Tea Latte / 100 ml (FatSecret)
  salep:      [94, 2.6, 1.6, 14.5, 12.5, 2.8, 0.10, 0], // sütlü hazır salep ~94-97 kcal / 100 ml
  baharat:    [250, 3, 1, 55, 2, 4, 0.05, 0],           // tarçın/zencefil/muskat tozu, ~1 g kullanılır
  dondurma:   [207, 11.0, 6.8, 23.6, 21.2, 3.5, 0.20, 0], // USDA vanilyalı dondurma
};
const KEYS = ['kcal', 'fat', 'satFat', 'carb', 'sugar', 'protein', 'salt', 'caffeine'];
const round = (v, d) => +v.toFixed(d);

/** Tariften 100 ml değerleri hesapla. parts: [[girdi, miktar(ml/g)], ...], total: bardak hacmi (ml). */
function recipe(total, parts) {
  const sum = Array(8).fill(0);
  for (const [k, amt] of parts) ING[k].forEach((v, i) => sum[i] += v * amt / 100);
  const per = sum.map(v => v / total * 100);
  return {
    kcal: Math.round(per[0]), fat: round(per[1], 1), satFat: round(per[2], 1), carb: round(per[3], 1),
    sugar: round(per[4], 1), protein: round(per[5], 1), salt: round(per[6], 2), caffeine: Math.round(per[7]),
  };
}
const direct = (k) => { const a = ING[k]; return Object.fromEntries(KEYS.map((n, i) => [n, n === 'kcal' || n === 'caffeine' ? Math.round(a[i]) : round(a[i], n === 'salt' ? 2 : 1)])); };
const raw = (a) => Object.fromEntries(KEYS.map((n, i) => [n, n === 'kcal' || n === 'caffeine' ? Math.round(a[i] ?? 0) : round(a[i] ?? 0, n === 'salt' ? 2 : 1)]));

const drink = (total, parts, label, price) => ({ basis: 'ml', per100: recipe(total, parts), servings: [{ label: `${label} (${total} ml)`, amount: total, price }] });
const food = (a, grams, label, price) => ({ basis: 'g', per100: raw(a), servings: [{ label: `${label} (${grams} g)`, amount: grams, price }] });

/* ---------- Tatlı referansları (100 g) ----------
   [kcal, yağ, doymuş, karb, şeker, protein, tuz] */
const TATLI = {
  tiramisu:   [283, 18.2, 10.5, 24.4, 16.0, 4.8, 0.12],  // FatSecret genel tiramisu
  sanSeb:     [320, 26.4, 15.0, 16.0, 13.0, 5.5, 0.45],  // Basque cheesecake kaynakları 316-380 kcal
  cheesecake: [321, 22.5, 12.6, 25.5, 21.9, 5.5, 1.10],  // USDA cheesecake
  brownie:    [466, 29.1, 7.5, 50.2, 36.0, 6.2, 0.45],   // USDA brownies (tariften)
  tart:       [410, 20.0, 11.0, 52.0, 33.0, 5.0, 0.30],  // tahmin: kısa hamur + süt reçeli/ganaj
  opiaCup:    [260, 14.0, 8.5, 30.0, 20.0, 4.0, 0.20],   // tahmin: katmanlı krema/bisküvi bardak tatlı
  turta:      [300, 14.0, 6.5, 40.0, 22.0, 4.0, 0.30],   // tahmin: ev usulü turta
  torte:      [350, 19.0, 10.0, 42.0, 30.0, 5.0, 0.30],  // tahmin: katmanlı kremalı pasta
};

/* ---------- Menü ---------- */
const categories = [
  { id: 'sicak-kahveler', name: 'Sıcak Kahveler', note: 'Espresso bazlı, filtre ve Türk kahvesi.', sort: 1 },
  { id: 'matcha-bar', name: 'Matcha Bar', note: '', sort: 2 },
  { id: 'kisa-ozel', name: 'Kışa Özel', note: 'Soğuk günlerin fincanları.', sort: 3 },
  { id: 'sicak-cikolata', name: 'Sıcak Çikolata', note: '', sort: 4 },
  { id: 'tatlilar', name: 'Tatlılar', note: 'Günlük çeşitlerimizi sorunuz.', sort: 5 },
  { id: 'ekstralar', name: 'Ekstralar', note: 'İçeceğine ve tatlına ekle.', sort: 6 },
];

const P = [];
let sort = 0;
const add = (p) => P.push({
  image: '', tags: [], allergens: [], available: true, featured: false, seasonal: false,
  priceNote: '', lang: 'en', ...p, sort: ++sort,
});

// ---- Sıcak Kahveler ----
const SK = 'sicak-kahveler';
add({ id: 'espresso', category: SK, name: 'Espresso', price: 120, description: 'Yoğun ve dengeli, tek shot.',
  nutrition: drink(30, [['espresso', 30]], 'Single', 120) });
add({ id: 'americano', category: SK, name: 'Americano', price: 140, description: 'Espresso ve sıcak su. Temiz ve hafif.',
  nutrition: drink(240, [['espresso', 60], ['su', 180]], 'Standart', 140) });
add({ id: 'latte', category: SK, name: 'Latte', price: 170, description: 'Yumuşak, sütlü, uzun içimli.', allergens: ['sut'],
  nutrition: drink(300, [['espresso', 60], ['sut', 240]], 'Standart', 170) });
add({ id: 'piccolo-latte', category: SK, name: 'Piccolo Latte', price: 160, description: 'Küçük bardakta yoğun, sütlü bir içim.', allergens: ['sut'],
  nutrition: drink(100, [['espresso', 30], ['sut', 70]], 'Standart', 160) });
add({ id: 'flat-white', category: SK, name: 'Flat White', price: 170, featured: true, description: 'Çift shot, ipek dokulu süt. Kahve karakteri önde.', allergens: ['sut'],
  nutrition: drink(180, [['espresso', 60], ['sut', 120]], 'Standart', 170) });
add({ id: 'cappuccino', category: SK, name: 'Cappuccino', price: 170, description: 'Espresso, süt ve yoğun süt köpüğü.', allergens: ['sut'],
  nutrition: drink(200, [['espresso', 60], ['sut', 140]], 'Standart', 170) });
add({ id: 'cortado', category: SK, name: 'Cortado', price: 150, description: 'Espresso ve az miktarda sıcak süt.', allergens: ['sut'],
  nutrition: drink(120, [['espresso', 60], ['sut', 60]], 'Standart', 150) });
add({ id: 'rooibos-cortado', category: SK, name: 'Rooibos Cortado', price: 170, description: 'Kafeinsiz alternatif: rooibos ve sıcak süt.', allergens: ['sut'], tags: ['Kafeinsiz'],
  nutrition: drink(120, [['rooibos', 60], ['sut', 60]], 'Standart', 170) });
add({ id: 'sut-receli-latte', category: SK, name: 'Süt Reçelli Latte', price: 180, lang: 'tr', description: 'Süt reçeli ile tatlandırılmış latte.', allergens: ['sut'],
  nutrition: drink(300, [['espresso', 60], ['sut', 220], ['sutReceli', 25]], 'Standart', 180) });
add({ id: 'mocha', category: SK, name: 'Mocha', price: 180, description: 'Espresso, çikolata ve süt. Chocolate, white chocolate ya da caramel seçenekleriyle.', allergens: ['sut', 'soya'],
  nutrition: drink(300, [['espresso', 60], ['sut', 210], ['cikolataSos', 30]], 'Standart', 180) });
add({ id: 'filtre-kahve', category: SK, name: 'Filtre Kahve', price: 150, lang: 'tr', featured: true, description: 'Günün filtre çekirdeği, temiz ve aydınlık bir fincan.', tags: ['Nitelikli'],
  nutrition: drink(250, [['filtre', 250]], 'Standart', 150) });
add({ id: 'red-eye', category: SK, name: 'Red Eye', price: 180, description: 'Filtre kahveye bir shot espresso.',
  nutrition: drink(250, [['filtre', 220], ['espresso', 30]], 'Standart', 180) });
add({ id: 'black-eye', category: SK, name: 'Black Eye', price: 200, description: 'Filtre kahveye çift shot espresso. En sert seçenek.',
  nutrition: drink(250, [['filtre', 190], ['espresso', 60]], 'Standart', 200) });
add({ id: 'turk-kahvesi', category: SK, name: 'Türk Kahvesi', price: 120, lang: 'tr', description: 'Cezvede, bol köpüklü.', tags: ['Geleneksel'],
  nutrition: drink(70, [['turk', 70]], 'Tek', 120) });
add({ id: 'duble-turk-kahvesi', category: SK, name: 'Duble Türk Kahvesi', price: 160, lang: 'tr', description: 'Türk kahvesi, çift porsiyon.', tags: ['Geleneksel'],
  nutrition: drink(140, [['turk', 140]], 'Duble', 160) });

// ---- Matcha Bar ----
const MB = 'matcha-bar';
add({ id: 'matcha-cayi', category: MB, name: 'Matcha Çayı', price: 160, lang: 'tr', description: 'Çırpılmış matcha, sıcak su ile.', tags: ['Vegan'],
  nutrition: drink(200, [['matcha', 3], ['su', 197]], 'Standart', 160) });
add({ id: 'matcha-latte', category: MB, name: 'Matcha Latte', price: 180, featured: true, description: 'Matcha ve süt. Bitkisel süt seçeneğiyle vegan olur.', allergens: ['sut'],
  nutrition: drink(300, [['matcha', 3], ['sut', 240]], 'Standart', 180) });
add({ id: 'oat-pistachio-matcha', category: MB, name: 'Oat Pistachio, Matcha', price: 250, description: 'Yulaf sütü, Antep fıstığı ve matcha çayı.', allergens: ['gluten', 'sert-kabuklu'], tags: ['Vegan'],
  nutrition: drink(300, [['matcha', 3], ['yulaf', 235], ['fistik', 18]], 'Standart', 250) });

// ---- Kışa Özel (mevsim seçkisi) ----
const KO = 'kisa-ozel';
add({ id: 'golden-latte', category: KO, name: 'Golden Latte', price: 160, seasonal: true, description: 'Zencefil, tarçın, bal ve süt. Kahvesiz, sıcacık.', allergens: ['sut'], tags: ['Kafeinsiz'],
  nutrition: drink(300, [['sut', 270], ['bal', 15], ['baharat', 2]], 'Standart', 160) });
add({ id: 'cafe-miel', category: KO, name: 'Cafe Miel', price: 180, seasonal: true, description: 'Tarçın, bal, espresso ve süt.', allergens: ['sut'],
  nutrition: drink(300, [['espresso', 60], ['sut', 215], ['bal', 15], ['baharat', 1]], 'Standart', 180) });
add({ id: 'chai-tea-latte', category: KO, name: 'Chai Tea Latte', price: 180, seasonal: true, description: 'Baharatlı çay ve süt.', allergens: ['sut'],
  nutrition: { basis: 'ml', per100: direct('chai'), servings: [{ label: 'Standart (300 ml)', amount: 300, price: 180 }] } });
add({ id: 'salep', category: KO, name: 'Salep', price: 180, lang: 'tr', seasonal: true, description: 'Sütle pişen, tarçınla servis edilen klasik kış içeceği.', allergens: ['sut'],
  nutrition: { basis: 'ml', per100: direct('salep'), servings: [{ label: 'Standart (250 ml)', amount: 250, price: 180 }] } });

// ---- Sıcak Çikolata ----
const SC = 'sicak-cikolata';
add({ id: 'klasik-sicak-cikolata', category: SC, name: 'Klasik Sıcak Çikolata', price: 180, lang: 'tr', description: 'Çikolata ve süt. Yoğun ve koyu.', allergens: ['sut', 'soya'],
  nutrition: drink(300, [['sut', 255], ['cikolataSos', 45]], 'Standart', 180) });
add({ id: 'matcha-beyaz-cikolata', category: SC, name: 'Matcha Beyaz Çikolata', price: 220, lang: 'tr', description: 'Matcha ve beyaz çikolata. Badem sütü ile hazırlanır.', allergens: ['sut', 'sert-kabuklu', 'soya'], priceNote: 'badem sütü +50 ₺',
  nutrition: drink(300, [['matcha', 3], ['badem', 245], ['beyazSos', 40]], 'Standart', 220) });
add({ id: 'gingerbread-cikolata', category: SC, name: 'Gingerbread Çikolata', price: 180, description: 'Tarçın, zencefil, muskat ve vanilya ile sıcak çikolata.', allergens: ['sut', 'soya'],
  nutrition: drink(300, [['sut', 240], ['cikolataSos', 30], ['zencefilSurup', 20], ['baharat', 1]], 'Standart', 180) });

// ---- Tatlılar ----
const T = 'tatlilar';
add({ id: 'tart', category: T, name: 'Tart', price: 220, lang: 'tr', description: 'Süt reçelli ya da çikolatalı. Günlük çeşidi sorunuz.', allergens: ['gluten', 'sut', 'yumurta'],
  nutrition: food(TATLI.tart, 120, 'Dilim', 220) });
add({ id: 'opia-cup', category: T, name: 'Opia Cup', price: 220, description: 'Bardakta servis edilen imza tatlımız.', allergens: ['gluten', 'sut', 'yumurta'],
  nutrition: food(TATLI.opiaCup, 150, 'Bardak', 220) });
add({ id: 'tiramisu', category: T, name: 'Tiramisu', price: 200, description: 'Espresso ile ıslanmış kedi dili, mascarpone, kakao.', allergens: ['gluten', 'sut', 'yumurta'],
  nutrition: food(TATLI.tiramisu, 130, 'Kase', 200) });
add({ id: 'buyukanne-turtasi', category: T, name: 'Büyükanne Turtası', price: 230, lang: 'tr', description: 'Ev usulü turta, sıcak servis edilebilir.', allergens: ['gluten', 'sut', 'yumurta'],
  nutrition: food(TATLI.turta, 130, 'Dilim', 230) });
add({ id: 'torte', category: T, name: 'Torte', price: 240, description: 'Katmanlı, kremalı pasta dilimi.', allergens: ['gluten', 'sut', 'yumurta'],
  nutrition: food(TATLI.torte, 140, 'Dilim', 240) });
add({ id: 'cheesecake', category: T, name: 'Cheesecake', price: 240, description: 'Klasik, kremsi, bisküvi tabanlı.', allergens: ['gluten', 'sut', 'yumurta'],
  nutrition: food(TATLI.cheesecake, 130, 'Dilim', 240) });
add({ id: 'san-sebastian-cheesecake', category: T, name: 'San Sebastian Cheesecake', price: 230, featured: true, description: 'Yanık yüzeyli, içi akışkan, baskın krem peynir.', allergens: ['sut', 'yumurta', 'gluten'],
  nutrition: food(TATLI.sanSeb, 120, 'Dilim', 230) });
add({ id: 'brownie', category: T, name: 'Brownie', price: 240, description: 'Beyaz çikolatalı ve vişneli.', allergens: ['gluten', 'sut', 'yumurta', 'soya'],
  nutrition: food(TATLI.brownie, 90, 'Kare', 240) });

// ---- Ekstralar ----
const EX = 'ekstralar';
add({ id: 'ekstra-sut', category: EX, name: 'Süt', price: 10, lang: 'tr', description: 'İçeceğine ekstra süt.', allergens: ['sut'], priceNote: 'ekstra',
  nutrition: { basis: 'ml', per100: direct('sut'), servings: [{ label: 'Porsiyon (50 ml)', amount: 50, price: 10 }] } });
add({ id: 'ekstra-laktozsuz-sut', category: EX, name: 'Laktozsuz Süt', price: 20, lang: 'tr', description: 'Süt yerine laktozsuz süt.', allergens: ['sut'], priceNote: 'ekstra',
  nutrition: { basis: 'ml', per100: direct('laktozsuz'), servings: [{ label: 'Porsiyon (200 ml)', amount: 200, price: 20 }] } });
add({ id: 'ekstra-bitkisel-sut', category: EX, name: 'Bitkisel Süt', price: 50, lang: 'tr', description: 'Yulaf ya da badem sütü.', allergens: ['gluten', 'sert-kabuklu'], priceNote: 'ekstra', tags: ['Vegan'],
  nutrition: { basis: 'ml', per100: direct('yulaf'), servings: [{ label: 'Porsiyon (200 ml)', amount: 200, price: 50 }] } });
add({ id: 'ekstra-single-espresso', category: EX, name: 'Single Espresso İlave', price: 50, lang: 'tr', description: 'İçeceğine bir shot espresso daha.', priceNote: 'ekstra',
  nutrition: drink(30, [['espresso', 30]], 'Shot', 50) });
add({ id: 'ekstra-cikolata', category: EX, name: 'Çikolata', price: 70, lang: 'tr', description: 'Tatlının yanına çikolata sosu.', allergens: ['sut', 'soya'], priceNote: 'tatlıya',
  nutrition: { basis: 'g', per100: direct('cikolataSos'), servings: [{ label: 'Porsiyon (30 g)', amount: 30, price: 70 }] } });
add({ id: 'ekstra-dondurma', category: EX, name: 'Dondurma', price: 50, lang: 'tr', description: 'Tatlının yanına vanilyalı dondurma.', allergens: ['sut', 'yumurta'], priceNote: 'tatlıya',
  nutrition: { basis: 'g', per100: direct('dondurma'), servings: [{ label: 'Top (50 g)', amount: 50, price: 50 }] } });

// QR sipariş seçenekleri (tools/migrate-options.mjs ile aynı varsayılanlar)
const MILK = ['latte','piccolo-latte','flat-white','cappuccino','cortado','rooibos-cortado','sut-receli-latte','mocha','matcha-latte','golden-latte','cafe-miel','chai-tea-latte','klasik-sicak-cikolata','gingerbread-cikolata','salep'];
const SHOT = ['espresso','americano','latte','piccolo-latte','flat-white','cappuccino','cortado','sut-receli-latte','mocha','filtre-kahve','red-eye','black-eye','matcha-latte','cafe-miel','chai-tea-latte'];
const TEMP = ['americano','latte','flat-white','sut-receli-latte','mocha','filtre-kahve','matcha-cayi','matcha-latte','oat-pistachio-matcha','chai-tea-latte','cafe-miel','klasik-sicak-cikolata'];
for (const p of P) {
  p.options = { milk: MILK.includes(p.id), shot: SHOT.includes(p.id), temp: TEMP.includes(p.id), dessert: p.category === 'tatlilar' };
  p.orderable = p.category !== 'ekstralar';
}

const data = {
  version: 2,
  updatedAt: new Date().toISOString(),
  settings: {
    season: {
      title: 'Kışa Özel',
      label: 'Kış 2026',
      subtitle: 'Zencefil, tarçın, bal ve salep. Soğuk günlerin fincanları barda.',
    },
    announcement: '',
    hours: { open: '09:00', close: '00:00', days: 'Her gün' },
  },
  categories,
  allergens: [
    { id: 'gluten', name: 'Gluten' }, { id: 'sut', name: 'Süt' }, { id: 'yumurta', name: 'Yumurta' },
    { id: 'soya', name: 'Soya' }, { id: 'sert-kabuklu', name: 'Sert Kabuklu Yemişler' }, { id: 'yer-fistigi', name: 'Yer Fıstığı' },
    { id: 'susam', name: 'Susam' }, { id: 'sulfit', name: 'Sülfit' }, { id: 'kereviz', name: 'Kereviz' },
    { id: 'hardal', name: 'Hardal' }, { id: 'balik', name: 'Balık' }, { id: 'kabuklu-deniz', name: 'Kabuklu Deniz Ürünleri' },
    { id: 'yumusakcalar', name: 'Yumuşakçalar' }, { id: 'aci-bakla', name: 'Acı Bakla' },
  ],
  products: P,
};

fs.writeFileSync(new URL('../site/data/menu.json', import.meta.url), JSON.stringify(data, null, 2));
console.log(`menu.json yazıldı: ${P.length} ürün, ${categories.length} kategori`);
for (const p of P.filter(x => ['latte', 'filtre-kahve', 'matcha-latte', 'cafe-miel', 'san-sebastian-cheesecake', 'mocha'].includes(x.id)))
  console.log(p.name.padEnd(26), JSON.stringify(p.nutrition.per100));
