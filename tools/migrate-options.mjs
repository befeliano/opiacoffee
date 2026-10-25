// Mevcut menu.json'a sipariş seçeneklerini ekler (diğer alanlara dokunmaz). Tekrar çalıştırılabilir.
import fs from 'node:fs';
const f = new URL('../site/data/menu.json', import.meta.url);
const m = JSON.parse(fs.readFileSync(f, 'utf8'));
const MILK = ['latte','piccolo-latte','flat-white','cappuccino','cortado','rooibos-cortado','sut-receli-latte','mocha','matcha-latte','golden-latte','cafe-miel','chai-tea-latte','klasik-sicak-cikolata','gingerbread-cikolata','salep'];
const SHOT = ['espresso','americano','latte','piccolo-latte','flat-white','cappuccino','cortado','sut-receli-latte','mocha','filtre-kahve','red-eye','black-eye','matcha-latte','cafe-miel','chai-tea-latte'];
const TEMP = ['americano','latte','flat-white','sut-receli-latte','mocha','filtre-kahve','matcha-cayi','matcha-latte','oat-pistachio-matcha','chai-tea-latte','cafe-miel','klasik-sicak-cikolata'];
for (const p of m.products) {
  if (!p.options) p.options = {
    milk: MILK.includes(p.id), shot: SHOT.includes(p.id), temp: TEMP.includes(p.id), dessert: p.category === 'tatlilar',
  };
  if (p.orderable === undefined) p.orderable = p.category !== 'ekstralar';
}
m.updatedAt = new Date().toISOString();
fs.writeFileSync(f, JSON.stringify(m, null, 2));
console.log('seçenekler eklendi:', m.products.filter(p => p.options.milk || p.options.shot || p.options.temp || p.options.dessert).length, 'ürün');
