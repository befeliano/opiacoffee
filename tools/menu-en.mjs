// Menü verisine İngilizce alanları ekler (name_en, description_en, tags_en, priceNote_en; kategori, alerjen, sezon).
// Var olan İngilizce alanların üzerine yazmaz; --force ile yazar.  Kullanım: node tools/menu-en.mjs [--force]
import fs from 'node:fs';
const f = new URL('../site/data/menu.json', import.meta.url);
const m = JSON.parse(fs.readFileSync(f, 'utf8'));
const force = process.argv.includes('--force');

const P = {
  'espresso': ['Espresso', 'Intense and balanced, a single shot.'],
  'americano': ['Americano', 'Espresso and hot water. Clean and light.'],
  'latte': ['Latte', 'Smooth, milky and long.'],
  'piccolo-latte': ['Piccolo Latte', 'A small, strong and milky cup.'],
  'flat-white': ['Flat White', 'Double shot with silky milk. The coffee leads.'],
  'cappuccino': ['Cappuccino', 'Espresso, milk and a thick layer of foam.'],
  'cortado': ['Cortado', 'Espresso cut with a little warm milk.'],
  'rooibos-cortado': ['Rooibos Cortado', 'Caffeine-free alternative: rooibos and warm milk.'],
  'sut-receli-latte': ['Milk Jam Latte', 'Latte sweetened with Turkish milk jam (dulce de leche).'],
  'mocha': ['Mocha', 'Espresso, chocolate and milk. Choose chocolate, white chocolate or caramel.'],
  'filtre-kahve': ['Filter Coffee', 'Our filter coffee of the day, clean and bright.'],
  'red-eye': ['Red Eye', 'Filter coffee with a shot of espresso.'],
  'black-eye': ['Black Eye', 'Filter coffee with a double shot. Our strongest cup.'],
  'turk-kahvesi': ['Turkish Coffee', 'Brewed in a cezve, with plenty of foam.'],
  'duble-turk-kahvesi': ['Double Turkish Coffee', 'Turkish coffee, double portion.'],
  'matcha-cayi': ['Matcha Tea', 'Whisked matcha with hot water.'],
  'matcha-latte': ['Matcha Latte', 'Matcha and milk. Vegan with plant-based milk.'],
  'oat-pistachio-matcha': ['Oat Pistachio, Matcha', 'Oat milk, Antep pistachio and matcha.'],
  'golden-latte': ['Golden Latte', 'Ginger, cinnamon, honey and milk. Coffee-free and warming.'],
  'cafe-miel': ['Cafe Miel', 'Cinnamon, honey, espresso and milk.'],
  'chai-tea-latte': ['Chai Tea Latte', 'Spiced tea and milk.'],
  'salep': ['Salep', 'A classic Turkish winter drink, cooked with milk and served with cinnamon.'],
  'klasik-sicak-cikolata': ['Classic Hot Chocolate', 'Chocolate and milk. Rich and dark.'],
  'matcha-beyaz-cikolata': ['Matcha White Chocolate', 'Matcha and white chocolate, made with almond milk.'],
  'gingerbread-cikolata': ['Gingerbread Hot Chocolate', 'Hot chocolate with cinnamon, ginger, nutmeg and vanilla.'],
  'tart': ['Tart', 'Milk jam or chocolate. Ask for today’s choice.'],
  'opia-cup': ['Opia Cup', 'Our signature dessert served in a cup.'],
  'tiramisu': ['Tiramisu', 'Ladyfingers soaked in espresso, mascarpone and cocoa.'],
  'buyukanne-turtasi': ['Grandma’s Pie', 'Homestyle pie, can be served warm.'],
  'torte': ['Torte', 'A layered cream cake slice.'],
  'cheesecake': ['Cheesecake', 'Classic and creamy on a biscuit base.'],
  'san-sebastian-cheesecake': ['San Sebastian Cheesecake', 'Burnt top, soft centre, rich cream cheese.'],
  'brownie': ['Brownie', 'With white chocolate and sour cherry.'],
  'ekstra-sut': ['Milk', 'Extra milk for your drink.'],
  'ekstra-laktozsuz-sut': ['Lactose-free Milk', 'Lactose-free milk instead of regular.'],
  'ekstra-bitkisel-sut': ['Plant-based Milk', 'Oat or almond milk.'],
  'ekstra-single-espresso': ['Extra Espresso Shot', 'One more shot in your drink.'],
  'ekstra-cikolata': ['Chocolate', 'Chocolate sauce with your dessert.'],
  'ekstra-dondurma': ['Ice Cream', 'Vanilla ice cream with your dessert.'],
};
const TAGS = { 'Kafeinsiz': 'Caffeine-free', 'Nitelikli': 'Specialty', 'Geleneksel': 'Traditional', 'Vegan': 'Vegan', 'Sezonluk': 'Seasonal', 'Sonbahar': 'Autumn', 'Kış': 'Winter', 'Favori': 'Favourite', 'Paylaşmalık': 'To share' };
const NOTES = { 'ekstra': 'extra', 'tatlıya': 'with dessert', 'badem sütü +50 ₺': 'almond milk +50 ₺', '250 g': '250 g', 'ek ücret': 'extra charge' };
const CATS = {
  'sicak-kahveler': ['Hot Coffee', 'Espresso drinks, filter and Turkish coffee.'],
  'matcha-bar': ['Matcha Bar', ''],
  'kisa-ozel': ['Winter Specials', 'Cups for cold days.'],
  'sicak-cikolata': ['Hot Chocolate', ''],
  'tatlilar': ['Desserts', 'Ask for today’s selection.'],
  'ekstralar': ['Extras', 'Add to your drink or dessert.'],
};
const ALG = { gluten: 'Gluten', sut: 'Milk', yumurta: 'Egg', soya: 'Soy', 'sert-kabuklu': 'Tree nuts', 'yer-fistigi': 'Peanuts', susam: 'Sesame', sulfit: 'Sulphites', kereviz: 'Celery', hardal: 'Mustard', balik: 'Fish', 'kabuklu-deniz': 'Crustaceans', yumusakcalar: 'Molluscs', 'aci-bakla': 'Lupin' };

const set = (o, k, v) => { if (v !== undefined && (force || o[k] === undefined || o[k] === '')) o[k] = v; };
let n = 0;
for (const p of m.products) {
  const t = P[p.id];
  set(p, 'name_en', t ? t[0] : p.name);
  set(p, 'description_en', t ? t[1] : '');
  set(p, 'tags_en', (p.tags || []).map(x => TAGS[x] || x));
  set(p, 'priceNote_en', p.priceNote ? (NOTES[p.priceNote] || p.priceNote) : '');
  if (t) n++;
}
for (const c of m.categories) { const t = CATS[c.id]; set(c, 'name_en', t ? t[0] : c.name); set(c, 'note_en', t ? t[1] : ''); }
for (const a of m.allergens) set(a, 'name_en', ALG[a.id] || a.name);
const s = m.settings.season;
set(s, 'title_en', s.title === 'Kışa Özel' ? 'Winter Specials' : s.title);
set(s, 'label_en', (s.label || '').replace('Kış', 'Winter').replace('Sonbahar', 'Autumn').replace('İlkbahar', 'Spring').replace('Yaz', 'Summer'));
set(s, 'subtitle_en', s.title === 'Kışa Özel' ? 'Ginger, cinnamon, honey and salep. Cups for cold days, at the bar now.' : '');
m.updatedAt = new Date().toISOString();
fs.writeFileSync(f, JSON.stringify(m, null, 2));
console.log(`İngilizce alanlar eklendi: ${n}/${m.products.length} ürün çevrildi`);
