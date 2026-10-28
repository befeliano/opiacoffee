# Opia: düzenleme ve kurulum rehberi

Tek bir Next.js uygulaması iki adreste çalışır:

| Adres | Ne | Kod |
|---|---|---|
| `opiacoffee.com.tr` | Tanıtım sitesi (menü, blog, yasal metinler, QR sipariş) | `src/site/`, `src/app/(site)/web/`, `public/assets/` |
| `panel.opiacoffee.com.tr` | Adisyon (masalar, ödeme, raporlar, menü yönetimi) | `src/app/(panel)/`, `src/components/`, `src/lib/` |

Hangi adresin hangi tarafı açacağına `src/proxy.ts` karar verir (`SITE_HOSTS` ortam değişkeni). Veritabanı Hostinger MySQL'dir.

---

## 1. Kod gerektirmeyen işler (panelden)

Bunlar için hiçbir dosyaya dokunma; `panel.opiacoffee.com.tr` adresinden yap:

- **Fiyat değiştirmek, ürün eklemek ya da silmek:** Menü ekranı. Site menüsü ve fiyatlar 20 saniye içinde güncellenir.
- **"Tükendi" yapmak:** Menü ekranında ürünü pasif yap. Sitede "Tükendi" yazar, QR'dan sipariş verilemez. Tekrar aktif yapınca düzelir.
- **Süt, shot, sıcak/soğuk ve tatlı ekstralarının fiyatı:** Menü › Seçenekler. QR siparişteki fiyatlar da buradan gelir.
- **Masa eklemek ya da adını değiştirmek:** Masa düzeni.
- **QR kodları yazdırmak, QR siparişi açıp kapatmak:** Masa düzeni › Masa QR kodları.
- **Ekip hesapları ve şifreler:** Ayarlar › Ekip.

> Seçenek gruplarının adları sabit kalmalı: **Süt**, **Sıcaklık**, **Ekstra shot**, **Tatlı ekstra**. Site, QR siparişteki seçenekleri bu adlarla eşleştirir (`src/site/menu-data.ts` içinde `GROUP_NAMES`). Bir grubun adını değiştirirsen o seçenek QR menüde görünmez.

---

## 2. Neyi değiştirmek için hangi dosya

| Değiştirmek istediğin | Düzenlenecek dosya(lar) | Not |
|---|---|---|
| Yeni ürünün besin değerleri, alerjenleri, İngilizce adı ve açıklaması | `src/site/content/menu.json` | Ürün, paneldeki adıyla eşleşir (`"name"` alanı birebir aynı olmalı). Fiyat panelden gelir. |
| Sezonluk ürünler ve sezon başlığı ("Kışa Özel") | `src/site/content/menu.json` | Üründe `"seasonal": true`; başlık ve alt metin üstteki `"season"` alanında (Türkçe ve `_en`). |
| Yerel sayfalardaki "Sevilenler" kartları | `src/site/content/menu.json` | Üründe `"featured": true` (ilk 3 gösterilir). |
| Adres, telefon, e-posta, Instagram, açılış saati | `src/site/config.ts` | Adres yasal metinlerde de geçiyor: `src/site/pages/kvkk-*.tsx`, `privacy-*.tsx`, `contact-*.tsx`, `about-*.tsx`. QR sipariş saatleri panelde Ayarlar › açılış/kapanış saati. |
| Hakkımızda, iletişim sayfası metni | `src/site/pages/about-tr.tsx` **ve** `about-en.tsx`; `contact-tr.tsx` **ve** `contact-en.tsx` | Türkçe ile İngilizceyi birlikte güncelle. Başlık ve açıklama dosyanın üstündeki `page` nesnesinde. |
| Yasal metinler (KVKK, gizlilik, çerez, kullanım koşulları) | `src/site/pages/kvkk-tr.tsx`, `privacy-tr.tsx`, `cookies-tr.tsx`, `terms-tr.tsx` ve `-en` eşleri | "Son güncelleme" tarihini de değiştir. |
| Ana sayfa metinleri | `src/site/pages/home.tsx` | Üstteki `TXT.tr` ve `TXT.en` ikisi birlikte. |
| Menü sayfasının metinleri (arama, alerji notu) | `src/site/pages/menu.tsx` | `TXT.tr` ve `TXT.en`. |
| Blog yazısı eklemek | `src/site/content/posts.ts` | Diziye yeni nesne ekle. Görsel: `public/assets/img/blog-<slug>.jpg`. Blog listesi ve site haritası kendiliğinden güncellenir. |
| Yerel SEO sayfası eklemek (ör. "Odunpazarı yakını kafe") | `src/site/content/locals.ts` | Diziye ekle; adres `/<slug>` olur. Görsel: `public/assets/img/<image>.jpg`. |
| Üst menü, alt bölüm, çerez bildirimi | `src/site/shell.tsx` | Ortak metinler `src/site/i18n.ts` içinde (Türkçe ve İngilizce). |
| Fotoğraflar | `public/assets/img/<ad>.jpg` (ya da `.webp`, `.png`) | Ad listesi aşağıda. Dosya yoksa gri yer tutucu görünür. |
| Ürün fotoğrafı | `public/uploads/<dosya>.jpg` + `menu.json` içinde ürünün `"image"` alanı | |
| Görünüm (renk, yazı, boşluk) | `public/assets/css/main.css` | |
| Sayfadaki davranışlar (ürün penceresi, sepet, harita, çerez) | `public/assets/js/menu.js`, `main.js`, `consent.js` | |
| Google Analytics, Search Console | Ortam değişkenleri `NEXT_PUBLIC_GA_ID`, `GSC_VERIFY` | GA açılırsa çerez ve gizlilik metinlerini de güncelle. |

**Fotoğraf adları:** `hero` (1000×1250, dikey), `galeri-1` … `galeri-6` (800×800), `hakkimizda-1` (1000×1250), `hakkimizda-2` (1200×900), `yerel-nitelikli-kahve`, `yerel-yenibaglar`, `yerel-tepebasi`, `yerel-anadolu-universitesi`, `yerel-hava-muzesi`, `yerel-casaba-modern`, `yerel-tren-gari` (1200×900), `blog-<yazının slug'ı>` (1200×750), `og-image.png` (paylaşım görseli, 1200×630).

### Yeni bir site sayfası eklemek

1. İçerik: `src/site/pages/ornek-tr.tsx` (var olan `about-tr.tsx` dosyasını kopyalayıp değiştir; ilk satırdaki `/** @jsxImportSource @/site/jsx */` kalmalı).
2. Adres: `src/app/(site)/web/ornek/route.ts` dosyası (yine `hakkimizda/route.ts` dosyasını kopyala, içe aktarılan dosya adını değiştir).
3. İngilizce eşi varsa `src/site/config.ts` içindeki `PAGE_PAIRS` listesine ekle (dil düğmesi ve site haritası buradan çalışır).
4. Alt bölümde bağlantı istersen `src/site/shell.tsx`.

> Site sayfaları React değildir: TSX ile yazılır ama `src/site/jsx` içindeki küçük çalışma zamanı onları doğrudan HTML'e çevirir. Bu yüzden `useState` gibi React özellikleri burada çalışmaz; sayfa üzerindeki davranışlar `public/assets/js` dosyalarındadır.

---

## 3. Adisyon (panel) tarafı

| Ne | Nerede |
|---|---|
| İş kuralları (fiyat, ödeme, indirim, yetki, raporlar) | `src/lib/data/mysql/*.ts` (`pos.ts`, `menu.ts`, `reports.ts`, `day.ts`, `team.ts`, `tables.ts`, `guest.ts`) |
| Veritabanı tabloları | `src/lib/data/mysql/schema.ts`. Var olan tabloya sütun eklersen `SCHEMA_COLUMNS` listesine de ekle; uygulama açılışta eksik sütunu kendisi ekler. |
| Ekranlar | `src/app/(panel)/[cafe]/…` ve `src/components/…` |
| QR bildirimleri (masalar ekranı) | `src/components/pos/guest-requests.tsx` |
| Misafir QR sipariş API'si | `src/app/(site)/web/api/order/route.ts` ve `src/site/guest.ts` |

Adisyonun Postgres (Supabase) sürümü de klasörde durur (`supabase/migrations`); Opia onu kullanmaz. MySQL motorunun doğru çalıştığını `src/lib/data/mysql/differential.test.ts` iki motoru karşılaştırarak denetler.

---

## 4. Komutlar

`D:\Opia\panel` klasöründe:

```bash
npm run dev
```
Geliştirme sunucusu. Site: `http://opia.localhost:3000`, panel: `http://localhost:3000`. Yerel deneme hesapları `sahip@opia.local` / `opia-sahip` ve `bar@opia.local` / `opia-bar` (yalnızca `MYSQL_SEED_DEMO=1` iken açılır).

```bash
npm run test
```
Tüm testler. MySQL testleri için `MYSQL_TEST_URL=mysql://kullanici:sifre@127.0.0.1:3306` tanımlı olmalı.

```bash
npm run typecheck
```

```bash
npm run lint
```

```bash
npm run build
```

Yerel MySQL (MariaDB) `D:\Opia\.devtools\mariadb` içinde; 3307 portunda çalışır, kullanıcı `root`, şifre `opia-dev`.

---

## 5. Hostinger Business kurulumu

> Hostinger paneli zaman zaman değişir; menü adlarını kendi panelinle karşılaştır.

1. **Veritabanı:** hPanel › Veritabanları › MySQL › yeni veritabanı ve kullanıcı oluştur. Bağlantı adresi şu biçimde olur: `mysql://KULLANICI:SIFRE@localhost:3306/VERITABANI`.
2. **Node.js uygulaması:** hPanel › Web siteleri › Node.js uygulaması ekle. Kaynak: GitHub deposu (`befeliano/opiacoffee`). Kök klasör `panel`. Node 20 ya da üstü. Derleme komutu `npm ci && npm run build`, başlatma komutu `npm run start`.
3. **Ortam değişkenleri** (uygulama ayarlarında):
   - `DATABASE_URL` = 1. adımdaki bağlantı adresi
   - `LOCAL_SESSION_SECRET` = en az 32 karakterlik rastgele bir metin (oturum çerezi imzası; değişirse herkes yeniden giriş yapar)
   - `SITE_URL` = `https://opiacoffee.com.tr`
   - `SITE_HOSTS` = `opiacoffee.com.tr,www.opiacoffee.com.tr`
   - `OWNER_EMAIL`, `OWNER_PASSWORD` (ilk kurulum için; sonra silebilirsin), isteğe bağlı `BAR_EMAIL`, `BAR_PASSWORD`
4. **İlk kurulum:** uygulamanın terminalinde bir kez çalıştır (tabloları, Opia menüsünü, masaları ve hesapları oluşturur):
   ```bash
   npm run setup:mysql
   ```
5. **Alan adları:** `opiacoffee.com.tr` ve `panel.opiacoffee.com.tr` aynı uygulamaya yönlendirilir; hangi tarafın açılacağını uygulama alan adından anlar. Hostinger bir uygulamaya tek alan adı bağlatıyorsa aynı depodan iki uygulama aç: sitede `APP_MODE=site`, panelde `APP_MODE=panel`. İkisine de aynı `DATABASE_URL` ve `LOCAL_SESSION_SECRET` ver.
6. **SSL:** iki alan adı için de ücretsiz SSL'i aç.
7. **Kontrol:** `panel.opiacoffee.com.tr` adresinde sahip hesabıyla giriş yap, Masa düzeni › Masa QR kodları sayfasından kodları yazdır, bir kodu telefonla okutup deneme siparişi ver.

`DATABASE_URL` tanımlı değilse site, `src/site/content/menu.json` içindeki fiyatlarla menüyü göstermeye devam eder; QR sipariş ve panel çalışmaz.
