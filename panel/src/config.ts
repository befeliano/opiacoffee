/**
 * Uygulama geneli ayarlar. Kafeye özel ayarlar (ad, logo, para birimi,
 * komisyonlar…) veritabanında tutulur ve Ayarlar ekranından değişir;
 * buradakiler kurulum (Vercel ortam değişkeni) düzeyindedir.
 */

/** Uygulamanın adı (tarayıcı sekmesi, ana ekran simgesi, Excel çıktısı) */
export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME?.trim() || "Adisyon";

/**
 * TEST (DEMO) MODU — NEXT_PUBLIC_DEMO_MODE=1
 * ------------------------------------------
 * Açıkken: menüde "Test" rozeti ve Ayarlar › Test verisi paneli görünür,
 * giriş ekranında "Demo olarak dene" düğmeleri çıkar (tek dokunuşla sahip
 * ya da barista olarak girilir). Satış sunumu için idealdir.
 *
 * Gerçek işletmeye başlarken:
 *   1) Uygulamada: Ayarlar › Test verisi › "Test verilerini sil".
 *   2) Vercel'de NEXT_PUBLIC_DEMO_MODE değişkenini kaldır (ya da 0 yap) ve
 *      yeniden yayınla. Demo hesaplarını Ayarlar › Ekip'ten sil.
 */
export const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "1";
