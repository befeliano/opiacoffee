# Opia Coffee Co. - Web sitesi

HTML + CSS + JS ön yüz, PHP yönetim paneli (veritabanı yok; menü `site/data/menu.json`).

## Çalıştırma

```
start-server.cmd              # http://localhost:8080   /   yönetim: /admin/
php tools/pipeline.php        # derle + SEO denetimi + taşma taraması
php tools/set-admin.php admin # yönetici hesabı oluştur / şifreyi sıfırla (şifre ekrana yazılır)
```

PHP: `C:\Users\befes\php\php.exe` / Node (araçlar için): `D:\tools\node.exe`

## Yapı

```
site/                      ← yayına çıkacak klasör (hosting'e bunu yükle)
  index.html, menu/, hakkimizda/, iletisim/ ...   (üretilmiş statik sayfalar)
  _src/                    sayfa şablonları, config.php, build.php (hosting'te de kalmalı: admin menüyü buradan yeniler)
  admin/                   PHP yönetim paneli
  api/contact.php          iletişim formu
  data/menu.json           ürünler, kategoriler, alerjenler, mevsim ayarı
  assets/{css,js,fonts,img}
  uploads/                 admin'den yüklenen ürün fotoğrafları
  _private/                şifre, mesajlar, yedekler (web'den kapalı)
tools/                     seo-audit, pipeline, check-layout, shot (ekran görüntüsü), seed-menu
docs/SEO-PIPELINE.md       SEO stratejisi ve kontrol listesi
```

## Yönetim paneli (`/admin/`)

- **Ürünler**: ekle / düzenle / sil / sırala / gizle, fotoğraf yükle (tarayıcıda WebP’ye küçültülür), alerjenler (14 AB alerjeni), besin değerleri (100 ml/100 g başına + porsiyon listesi, porsiyona özel fiyat).
- **Kategoriler**, **Mevsim & Ayarlar** (ana sayfa seçkisi), **Mesajlar** (iletişim formu), **Hesap**.
- Her kaydetmede site (menü sayfası, ana sayfa seçkisi, Menu şeması, sitemap) otomatik yeniden üretilir; son 30 menü yedeği `_private/backups/`.

## Fotoğraf slotları (`site/assets/img/`)

Dosyayı aşağıdaki adla bırak (`.jpg/.webp/.png`), sonra panelden “Siteyi yeniden oluştur” ya da `php site/_src/build.php`:

| Dosya | Boyut önerisi | Nerede |
|---|---|---|
| `hero` | 1000×1250 (dikey) | Ana sayfa |
| `galeri-1` … `galeri-6` | 800×800 (1 ve 4: 4:3) | Ana sayfa galeri |
| `hakkimizda-1` / `hakkimizda-2` | 1000×1250 / 1200×900 | Hakkımızda |
| `yerel-nitelikli-kahve`, `yerel-yenibaglar`, `yerel-tepebasi`, `yerel-anadolu-universitesi`, `yerel-hava-muzesi`, `yerel-casaba-modern`, `yerel-tren-gari` | 1200×900 | Yerel SEO sayfaları |
| `og-image.png` | 1200×630 | Sosyal paylaşım (şu an yazı tabanlı; `tools/og-template.html`) |

Ürün fotoğrafları admin panelinden yüklenir.

## Yayına alırken

`docs/SEO-PIPELINE.md` → Aşama 7. Özet: `_src/config.php` içinde `url`, `phone`, `email`, `ga_id`; `.htaccess` HTTPS yönlendirmesi; admin şifresini değiştir; PHP 8.1+ olan bir hosting.

> Menüdeki fiyatlar, besin değerleri ve alerjenler **örnek başlangıç verisidir**; panelden gerçek değerlerle güncellenmelidir.

## QR masa siparişi

- **Masalar & QR** (`/admin/tables.php`): masa ekle (ör. 1 - 12), QR kodlarını yazdır (`/admin/qr-print.php`), masa başına tek tuşla siparişi kapat/aç. Kapalı masanın QR'ı düz menüye (`/menu/`) yönlenir. Tüm sistem için de tek bir aç/kapat düğmesi ve saat kısıtı var.
- QR adresi: `https://<alan-adı>/m/<masa-kodu>`. Misafir menüde ürün seçer, süt (normal/laktozsuz/bitkisel), sıcak/soğuk, ekstra shot ve tatlı eklerini seçer, siparişe not yazar ve gönderir. Ödeme yok. Garson çağır / hesap iste düğmeleri var; sipariş durumunu (Alındı, Hazırlanıyor) telefonundan görür.
- **Bar ekranı** (`/admin/bar.php`): 4 sn'de bir yenilenir; yeni sipariş ve çağrıda ses (önce "Sesi aç"a dokun). Akış: Yeni -> Hazırlanıyor -> Teslim edildi (kapanır). Yan panelde bugünün sipariş adedi, cirosu ve en çok satanlar.
- **İstatistik** (`/admin/stats.php`): gün gün sipariş adedi, ciro, ürün bazında satış; CSV indir.
- Fiyatlar sunucuda menüden hesaplanır; ekstraların fiyatı "Ekstralar" kategorisindeki ürünlerden gelir.
- Veri: `site/_private/opia.sqlite` (SQLite). Hosting'te PHP `pdo_sqlite` eklentisi açık olmalı (çoğu hostingte varsayılan açık). Yerelde `start-server.cmd` bunu otomatik açar.

## Blog

Yazılar `site/_src/posts.php` içinde. Yeni yazı ekleyip `php site/_src/build.php` çalıştırınca `/blog/`, yazı sayfası, `BlogPosting` şeması ve sitemap güncellenir. Kapak görselleri `assets/img/blog-<slug>.jpg` adıyla eklenir.

## Hesaplar ve roller

- **Sahip** (`admin`): her şey. Hesaplar sayfasından bar hesabını oluşturur, şifresini değiştirir ya da siler.
- **Bar** (`bar`): yalnızca bar ekranı (siparişler, masa hesapları, tükendi), gün sonu ve kendi şifresi. Menüyü, fiyatları, masaları ve istatistiği değiştiremez.
- Komut satırından: `php tools/set-admin.php <kullanici> <sifre> [owner|bar]`

## Masa hesabı ve gün sonu

- Bar ekranı, **Masa hesapları** sekmesi: ödenmemiş siparişler masa bazında toplanır, "Nakit ile kapat" / "Kart ile kapat". Masaların QR siparişi de buradan tek tuşla açılıp kapanır.
- **Tükendi** sekmesi: biten ürüne dokun; menüde "Tükendi" görünür, QR'dan sipariş verilemez.
- **Gün sonu** (`/admin/dayend.php`): sipariş adedi, ciro, nakit, kart, açık hesap, ürün satışları; "Günü kapat" raporu kaydeder, sipariş notlarını siler, isteğe bağlı tükendi işaretlerini sıfırlar. Yazdırılabilir.

## İngilizce

- İngilizce sayfalar `/en/` altında (`site/_src/pages-en/`); menü verisindeki `name_en`, `description_en` alanları admin ürün formundan düzenlenir.
- `node tools/menu-en.mjs` eksik İngilizce alanları doldurur (`tools/seed-menu.mjs` ile menü sıfırlanırsa sonra çalıştırılmalı).
- Blog ve yerel SEO sayfaları yalnızca Türkçe.

## Veri

Ziyaretçilerden kişisel veri toplanmaz: form, üyelik ve online ödeme yok; siparişlerde IP tutulmaz, notlar gün sonunda silinir.
