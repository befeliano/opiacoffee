# Adisyon

Kafeler için adisyon, maliyet ve analiz uygulaması. Telefon, tablet ve
bilgisayarda çalışır. Her kafe kendi kurulumunu (ayrı Supabase veritabanı +
ayrı Vercel yayını) kullanır.

## Ne yapar?

- **Masalar ve adisyon**: masaya dokun, ürünü ekle, ödemeyi al. Seçenekler
  (sıcak/buzlu, yulaf sütü, ekstra shot) fiyata ve maliyete otomatik yansır.
- **Ürün bazlı ödeme**: ödenecek ürünler seçilir, "Nakit", "Kart" ya da "Ticket"a
  basılır. Paylaşılan kalem **Böl** ile 2–6 kişiye bölünür. İstenirse tutar
  girerek de bölünür.
- **İkram, indirim, satır fiyatı ve Joker ürün** (menü dışı satış).
- **Favoriler**, **kişi sayısı**, **geçmiş adisyonlar** (kart/nakit/ticket süzgeci).
- **Raporlar**: günlük/haftalık/aylık ciro, ortalama sepet, maliyet, brüt kâr,
  saatlik yoğunluk, masa işgal süreleri. **Ürün satışları** sıralaması.
- **Analiz**: 7 günlük ciro tahmini, ay sonu projeksiyonu, başabaş noktası,
  gün × saat haritası, menü mühendisliği.
- **Menü ve maliyet**: reçeteden (1 kg çekirdek → 18 g espresso) ya da alış
  fiyatından maliyet. **Masa düzeni** düzenlenebilir.
- **Z raporu** (Excel), **finans** (sabit/tek seferlik giderler, net kâr),
  **koyu tema**, kafeye özel **renk paleti**.

## Roller ve yetkiler

| Rol | Varsayılan |
|---|---|
| **Sahip** | Her şey: ciro, raporlar, analiz, finans, Z raporu, ekip, ayarlar |
| **Müdür** | Satış + menü/maliyet + raporlar (finans, ekip ve ayarlar hariç) |
| **Barista** | Satış ekranı; bugünün ve dünün adisyonları ve cirosu |

Sahip, Ayarlar › Ekip › **Kişi ekle** sihirbazında her kişi için ayrıca şunları
seçer: ciroyu ne kadar görsün (hiç / bugün / son 2 gün / tümü), kâr-maliyet,
raporlar, adisyon silme/iptal, ödeme yöntemi değiştirme, indirim/ikram, menü
düzenleme. Yetkiler veritabanı fonksiyonlarında uygulanır.

## Hızlı başlangıç (internetsiz demo)

```bash
npm install
npm run demo        # http://localhost:3000 — yerleşik veritabanı + 60 günlük test verisi
```

Giriş ekranındaki **"Sahip olarak dene" / "Barista olarak dene"** düğmeleri
hazır demo hesaplarıyla girer. Demo ekip ve şifreleri: `src/lib/seed/team.ts`.

## Yeni kafe kurulumu (canlı)

1. **Supabase**: yeni proje aç → `supabase link --project-ref <ref>` →
   `supabase db push` (tek dosya: `supabase/migrations/*_baseline.sql`).
2. `.env.example` → `.env.local` kopyala, Supabase anahtarlarını gir.
3. `src/lib/seed/menus.ts` (kafe adı, menü, masalar) ve `src/lib/seed/team.ts`
   (ekip) dosyalarını kafeye göre düzenle.
4. `npm run setup` → kafe, menü, masalar ve hesaplar oluşur.
   Tanıtım için `npm run setup -- --demo` (test satışları da yüklenir;
   uygulamada Ayarlar › Test verisi'nden tek tuşla silinir).
5. **Vercel**: GitHub reposunu içe aktar, ortam değişkenlerini gir, yayınla.
   Kafenin alan adı için `panel.kafeadi.com` → Vercel'e CNAME.

## Teknik özet

- **Next.js 16** (App Router, Server Components, Server Actions) + **Tailwind CSS 4**
- **Supabase** (Postgres + Auth). Tüm iş kuralları veritabanı fonksiyonlarında:
  fiyat ve maliyet sunucuda hesaplanır, yetki her çağrıda kontrol edilir,
  tablolara doğrudan erişim kapalıdır.
- Supabase anahtarı yokken uygulama, aynı SQL şemasını çalıştıran yerleşik
  Postgres (PGlite) ile çalışır.
- Kontroller: `npm run typecheck`, `npm run lint`, `npm run test`.

```
src/
  app/                 sayfalar ve sunucu eylemleri
  components/          arayüz (pos, menu, reports, charts, ui, brand)
  lib/
    api/               veritabanı API tipleri
    data/              veri erişim katmanı (Supabase / yerel)
    domain/            rapor, tahmin, menü mühendisliği hesapları
    seed/              menü, ekip, test verisi üreteci
supabase/migrations/   veritabanı şeması ve API fonksiyonları
scripts/               kurulum, ikon ve renk paleti üreticileri
```
