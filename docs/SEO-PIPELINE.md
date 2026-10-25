# Opia Coffee Co. - SEO Pipeline

Hedef: **Eskişehir / Tepebaşı / Yenibağlar** çevresinde “nitelikli kahve”, “kafe”, “filtre kahve” ve çevredeki odak noktalar (Anadolu Üniversitesi, Hava Müzesi, Cassaba/Casaba Modern, Tren Garı) aramalarında görünür olmak.

Pipeline sırayla çalışır; her aşama bir öncekinin çıktısına dayanır. Aşama 1–6 **kodda yapıldı ve otomatik denetlenir**, aşama 7–8 yayına çıkış sonrası sende yapılacak işlerdir.

```
php tools/pipeline.php          # derle → SEO denetimi → (sunucu açıksa) yerleşim taraması
```

---

## Aşama 0 - Anahtar kelime haritası

Her arama niyeti **tek bir sayfaya** atanır (kanibalizasyon yok).

| Arama niyeti | Sayfa | H1 |
|---|---|---|
| opia coffee, opia coffee co eskişehir | `/` | Nitelikli kahve, Yenibağlar’da. |
| eskişehir kafe menü, kahve fiyatları, alerjen / kalori | `/menu/` | Menü |
| nitelikli kahve eskişehir, specialty coffee, v60/chemex eskişehir | `/eskisehir-nitelikli-kahve/` | Eskişehir’de nitelikli kahve |
| yenibağlar kafe, yenibağlar kahve | `/yenibaglar-kafe/` | Yenibağlar’da kafe |
| tepebaşı kafe, tepebaşı kahve | `/tepebasi-kafe/` | Tepebaşı’nda kahve molası |
| anadolu üniversitesi yakını kafe, yunusemre kampüsü kafe | `/anadolu-universitesi-yakini-kafe/` | Anadolu Üniversitesi yakınında kahve |
| hava müzesi yakını kafe, vecihi hürkuş havacılık parkı kafe | `/hava-muzesi-yakini-kafe/` | Hava Müzesi’nin yakınında kahve |
| casaba modern / cassaba modern yakını kafe | `/casaba-modern-yakini-kafe/` | Cassaba Modern’e yakın kahve |
| eskişehir tren garı yakını kafe | `/eskisehir-tren-gari-yakini-kafe/` | Tren Garı’na yakın kahve molası |
| opia adres, çalışma saatleri, yol tarifi | `/iletisim/` | İletişim |
| opia coffee hikâye | `/hakkimizda/` | Hakkımızda |

> “Casaba” ve “Cassaba” yazımlarının ikisi de sayfada geçer (resmî yazım *Cassaba Modern*).

## Aşama 1 - Teknik temel

- Statik HTML çıktısı (`php _src/build.php`): hızlı, taranabilir; JS kapalıyken de içerik görünür.
- Temiz URL’ler (`/menu/`), her sayfada mutlak **canonical**, `hreflang="tr-TR"` + `x-default`.
- `sitemap.xml` (otomatik; lastmod + hero görseli), `robots.txt` (`/admin/`, `/api/`, `/_src/`, `/_private/` kapalı).
- `.htaccess`: HTTPS/www yönlendirme (alan adı sonrası aç), gzip, 1 yıllık önbellek, güvenlik başlıkları, gizli klasör koruması.
- Özel 404 (`noindex`), `manifest.webmanifest`, favicon (SVG + PNG).

## Aşama 2 - Performans / Core Web Vitals

- Fontlar **kendi sunucumuzda** (Oswald, Inter, Instrument Serif; yalnızca latin + latin-ext, `font-display: swap`, kritik fontlar `preload`).
- Üçüncü taraf istek **yok**: harita “Haritayı yükle” tıklamasına kadar yüklenmez; analitik yalnızca çerez onayından sonra.
- Tüm `<img>` için `width/height` (CLS yok), hero dışında `loading="lazy"`, hero `fetchpriority="high"`.
- Tek CSS + 3 küçük JS dosyası, içerik hash’iyle versiyonlu (`?v=`), framework yok.
- Admin’de yüklenen fotoğraflar tarayıcıda **WebP ve ≤1400 px**’e küçültülür.

## Aşama 3 - Sayfa içi (on-page)

Kurallar `tools/seo-audit.php` ile zorlanır:

- `title` 25–62 karakter, her sayfada benzersiz; marka + konum (“… | Opia Coffee Co. Yenibağlar Eskişehir”).
- `meta description` 70–165 karakter, benzersiz, eylem/konum içerir.
- Sayfa başına **tek H1**, başlık hiyerarşisi atlamaz.
- Her görselde Türkçe, konum içeren `alt`.
- İç bağlantı ağı: footer + “Çevrede” bölümü + yerel sayfalar arası “Diğer yerel rehberler”; kırık bağlantı denetimi.
- Yerel sayfalar ince değil (≥180 kelime), her biri farklı niyet/içerik + SSS.

## Aşama 4 - Yapısal veri (JSON-LD)

| Sayfa | Şemalar |
|---|---|
| Tümü | `WebSite`, `WebPage`, `BreadcrumbList` |
| `/`, `/iletisim/`, yerel sayfalar | `CafeOrCoffeeShop` + `LocalBusiness` (adres, geo, saatler, sameAs, menü bağlantısı) |
| `/menu/` | `Menu` → `MenuSection` → `MenuItem` (fiyat TRY, kalori) - **admin’den kaydedince otomatik yenilenir** |
| `/iletisim/`, yerel sayfalar | `FAQPage` |
| `/hakkimizda/` | `AboutPage` |

Doğrulama: <https://search.google.com/test/rich-results> ve <https://validator.schema.org>.

## Aşama 5 - Yerel SEO (en büyük kaldıraç)

Kodda:
- **NAP** (ad, adres, telefon) tüm sitede aynı biçimde; adres schema + görünür metin + footer.
- `geo.*` / `ICBM` meta, koordinat `39.78545, 30.50237`, `areaServed: Yenibağlar, Tepebaşı, Eskişehir`.
- Yol tarifi düğmeleri (Google / Yandex / Apple Haritalar), açık/kapalı durumu.

Sende (Aşama 7):
- **Google İşletme Profili** - kategori: *Kahve dükkanı* (ek: *Kafe*, *Tatlı dükkanı*). Adres, saatler (09:00–00:00), web sitesi, menü bağlantısı (`/menu/`), fotoğraflar, Instagram.
- Telefon numarasını **hem GBP’ye hem `_src/config.php` içindeki `phone` alanına aynen** yaz (NAP tutarlılığı).
- Yorum topla: kasaya QR kod (GBP “yorum bağlantısı”). Her yoruma yanıt ver.
- Yerel rehberlere (Yandex Haritalar, Apple Business Connect, Bing Places, Foursquare, TripAdvisor, Eskişehir yerel dizinleri) **aynı NAP** ile kayıt.

## Aşama 6 - İçerik ve güncellik

- Menü, sezon seçkisi ve fiyatlar admin’den değişince **statik HTML + Menu şeması + sitemap lastmod** otomatik yenilenir.
- Mevsim değişiminde (Admin → Mevsim & Ayarlar) başlık/etiket güncelle: “Kış 2026” gibi mevsimsel arama dalgasını yakalar.
- Öneri içerik takvimi: ayda 1 kısa yazı (ör. “V60 nasıl demlenir”, “Eskişehir’de kahve rotası: Havacılık Parkı → Opia”). Yeni sayfa eklemek için `_src/pages/` ya da `_src/locals.php`.

## Aşama 7 - Yayına çıkış kontrol listesi

1. `_src/config.php` → `url` (gerçek alan adı), `phone`, `email`, `ga_id`, `gsc_verify` doldur → `php tools/pipeline.php`.
2. `.htaccess` içinde HTTPS ve www yönlendirmelerinin yorumunu kaldır; SSL aç.
3. Google Search Console: alan adı özelliği ekle → `sitemap.xml` gönder → ana sayfa, `/menu/`, `/iletisim/` için “Dizine eklenmesini iste”.
4. Bing Webmaster Tools: Search Console’dan içe aktar.
5. Fotoğrafları `assets/img/` slotlarına koy (README’de liste) → yeniden derle.
6. Admin şifresini değiştir (`/admin/account.php`).
7. PageSpeed Insights (mobil) ≥ 90 ve Rich Results Test geçişini doğrula.

## Aşama 8 - Ölçüm ve döngü

- **Search Console**: Performans → sorgular (yenibağlar, nitelikli kahve, anadolu üniversitesi kafe…) ve sayfalar; ortalama konum + CTR.
- **GBP Insights**: aramalar, yol tarifi, arama, web sitesi tıklaması.
- **Analytics** (çerez onayıyla): `/menu/` ve `/iletisim/` hedef sayfaları.
- Aylık: `php tools/pipeline.php`, yeni fotoğraf/yorum/içerik, düşük CTR başlıklarını yeniden yaz.

---

## Otomatik kontroller (özet)

| Komut | Ne yapar |
|---|---|
| `php site/_src/build.php` | Tüm sayfaları, sitemap, robots, manifest üretir |
| `php tools/seo-audit.php` | title/desc/canonical/h1/OG/JSON-LD/alt/iç bağlantı/sitemap/NAP/yinelenen içerik denetimi → `docs/seo-report.md` |
| `node tools/check-layout.mjs` | 7 genişlikte (320–1440) tüm sayfalarda yatay taşma + kırık görsel taraması |
| `php tools/pipeline.php` | Hepsini sırayla çalıştırır |
