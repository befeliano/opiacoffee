<?php
/**
 * Yerel SEO sayfaları. Her sayfa farklı bir arama niyetine hizmet eder (kampüs, müze, AVM, gar, mahalle).
 * Alanlar: slug, title(<=60), description(<=160), h1, lead, icon, image, sections[[h2, html]], faq[[q,a]]
 * Menüde olmayan ürün (soğuk kahve, tost vb.) burada anılmaz; içerik gerçek menüye göre yazılır.
 */
return [

[
 'slug' => 'eskisehir-nitelikli-kahve',
 'title' => 'Eskişehir’de Nitelikli Kahve | Opia Coffee Co.',
 'description' => 'Eskişehir’de nitelikli kahve arıyorsan: Yenibağlar’daki Opia Coffee Co.’da filtre kahve, espresso bazlı içecekler ve matcha. Her gün 09:00 - 00:00.',
 'h1' => 'Eskişehir’de nitelikli kahve',
 'lead' => 'Nitelikli kahve; çekirdeğin, kavrumun ve demlemenin birlikte özenle ele alındığı kahvedir. Opia Coffee Co. 2019’dan beri bunu Tepebaşı’nda, Yenibağlar’da sunuyor.',
 'icon' => 'cup', 'image' => 'yerel-nitelikli-kahve',
 'sections' => [
  ['Nitelikli kahve ne demek?', '<p>Nitelikli kahve (specialty coffee), tarladan fincana kadar her adımda kalitenin gözetildiği, tadım puanı yüksek çekirdeklerle hazırlanan kahveyi anlatır. Günlük hayattaki karşılığı basit: daha temiz, daha tatlı, daha anlaşılır bir fincan. Acı ve yanık tat yerine çekirdeğin kendi notaları öne çıkar.</p><p>Eskişehir’de bu tür kahvelere ilgi her yıl artıyor. Menümüzü hem klasik espresso sevenlere hem de filtre kahveyi yeni keşfedenlere göre kurduk.</p>'],
  ['Opia’da neler içebilirsin?', '<ul><li><strong>Filtre kahve:</strong> Günün filtre çekirdeğiyle hazırlanır. Red Eye ve Black Eye ile espresso shotlu sert seçenekleri de var.</li><li><strong>Espresso bazlı içecekler:</strong> Flat White, Latte, Piccolo Latte, Cappuccino, Cortado, Mocha ve Süt Reçelli Latte.</li><li><strong>Matcha Bar:</strong> Matcha çayı, Matcha Latte ve yulaf sütlü Oat Pistachio Matcha.</li><li><strong>Geleneksel:</strong> Türk Kahvesi ve Duble Türk Kahvesi.</li></ul><p>Tüm içeceklerin alerjen ve besin değerlerine <a href="/menu/">menü sayfasından</a> ulaşabilirsin.</p>'],
  ['İlk kez filtre kahve deneyecekler için', '<p>Filtre kahve sütsüz içilir ve çekirdeğin karakterini en açık hâliyle gösterir. Baristaya meyvemsi mi yoksa çikolatamsı mı sevdiğini söylemen yeterli. Kahveyi yanında bir dilim San Sebastian Cheesecake ile içmek iyi bir başlangıçtır.</p>'],
 ],
 'faq' => [
  ['Eskişehir’de nitelikli kahve nerede içilir?', 'Eskişehir Tepebaşı Yenibağlar’daki Opia Coffee Co., Eti Caddesi No:41/C adresinde her gün 09:00 - 00:00 arasında nitelikli kahve sunar.'],
  ['Opia’da filtre kahve var mı?', 'Evet. Menüde Filtre Kahve, Red Eye ve Black Eye bulunur.'],
  ['Matcha var mı?', 'Evet, menüde ayrı bir Matcha Bar bölümü var: Matcha Çayı, Matcha Latte ve Oat Pistachio Matcha.'],
 ],
],

[
 'slug' => 'yenibaglar-kafe',
 'title' => 'Yenibağlar Kafe ve Kahve Dükkânı | Opia Coffee Co.',
 'description' => 'Yenibağlar’da kafe mi arıyorsun? Opia Coffee Co.: Eti Caddesi’nde nitelikli kahve ve günlük tatlılar. Her gün 09:00 - 00:00, Tepebaşı Eskişehir.',
 'h1' => 'Yenibağlar’da kafe',
 'lead' => 'Yenibağlar Mahallesi’nde, Eti Caddesi üzerinde, sabah 09:00’dan gece yarısına kadar açık bir kahve dükkânı: Opia Coffee Co.',
 'icon' => 'pin', 'image' => 'yerel-yenibaglar',
 'sections' => [
  ['Mahallenin kahve durağı', '<p>Yenibağlar, Tepebaşı ilçesinin yoğun ve canlı mahallelerinden biri. Üniversite kampüsüne, Havacılık Parkı’na ve şehir merkezine yakınlığıyla gün boyu hareketli. Opia bu hareketin içinde bir mola noktası olmak istiyor: kısa bir espresso için de, uzun bir sohbet için de.</p>'],
  ['Gün içinde Opia', '<ul><li><strong>Sabah:</strong> Espresso, Flat White ya da Filtre Kahve ile güne başla.</li><li><strong>Öğleden sonra:</strong> Bir fincan kahveye tiramisu ya da cheesecake dilimi.</li><li><strong>Akşam:</strong> Matcha Latte, sıcak çikolata ya da kışın salep. Saat 00:00’a kadar açığız.</li></ul>'],
  ['Adres ve ulaşım', '<p><strong>Yenibağlar Mah. Eti Cd. No:41/C, Tepebaşı / Eskişehir.</strong> <a href="/iletisim/">İletişim sayfamızdaki</a> düğmelerle tek dokunuşla yol tarifi alabilirsin.</p>'],
 ],
 'faq' => [
  ['Yenibağlar’da gece geç saate kadar açık kafe var mı?', 'Opia Coffee Co. her gün 09:00 - 00:00 arasında açıktır.'],
  ['Opia Yenibağlar’ın neresinde?', 'Eti Caddesi No:41/C adresindedir. Anadolu Üniversitesi Yunusemre Kampüsü ve Vecihi Hürkuş Havacılık Parkı’na yakındır.'],
  ['Tatlı var mı?', 'Evet. San Sebastian Cheesecake, Cheesecake, Tiramisu, Brownie, Tart, Opia Cup, Büyükanne Turtası ve Torte menüde yer alır. Günlük çeşitleri baristaya sorabilirsin.'],
 ],
],

[
 'slug' => 'tepebasi-kafe',
 'title' => 'Tepebaşı Eskişehir Kafe | Opia Coffee Co.',
 'description' => 'Tepebaşı, Eskişehir’de kahve ve kafe: Opia Coffee Co. Yenibağlar’da nitelikli kahve ve tatlı. Alerjen ve kalori bilgili menü. Her gün 09:00 - 00:00.',
 'h1' => 'Tepebaşı’nda kahve molası',
 'lead' => 'Eskişehir’in Tepebaşı ilçesinde, Yenibağlar’da; nitelikli kahve, günlük tatlılar ve sade bir ortam.',
 'icon' => 'sun', 'image' => 'yerel-tepebasi',
 'sections' => [
  ['Tepebaşı’nda kahve kültürü', '<p>Tepebaşı; üniversitesi, müzeleri, parkları ve alışveriş merkezleriyle Eskişehir’in modern yüzü. Öğrenciler, yürüyüşçüler, çalışanlar ve ziyaretçiler günün farklı saatlerinde kahve molası veriyor. Opia da buna göre kuruldu: kalabalık olmayan bir bar, sade bir menü, her fincan için ölçülü bir hazırlık.</p>'],
  ['Menüde öne çıkanlar', '<ul><li><a href="/menu/#sicak-kahveler">Espresso bazlı içecekler ve filtre kahve</a></li><li><a href="/menu/#matcha-bar">Matcha Bar</a></li><li><a href="/menu/#sicak-cikolata">Sıcak çikolata çeşitleri</a></li><li><a href="/menu/#tatlilar">Cheesecake, tiramisu, brownie</a></li></ul><p>Mevsim değiştikçe menüye sezonluk içecekler ekleriz. Güncel seçkiyi <a href="/#mevsim">ana sayfada</a> görebilirsin.</p>'],
  ['Konum', '<p>Yenibağlar Mah. Eti Cd. No:41/C, Tepebaşı / Eskişehir. Çevredeki noktalara yakınlığımızı <a href="/anadolu-universitesi-yakini-kafe/">Anadolu Üniversitesi</a>, <a href="/hava-muzesi-yakini-kafe/">Hava Müzesi</a>, <a href="/casaba-modern-yakini-kafe/">Cassaba Modern</a> ve <a href="/eskisehir-tren-gari-yakini-kafe/">Tren Garı</a> sayfalarında anlattık.</p>'],
 ],
 'faq' => [
  ['Tepebaşı’nda kahve içilecek yer önerisi?', 'Yenibağlar’da, Eti Caddesi’ndeki Opia Coffee Co. nitelikli kahve ve tatlı sunar. Her gün 09:00 - 00:00 açıktır.'],
  ['Menüde alerjen bilgisi görebilir miyim?', 'Evet, menü sayfasında her ürüne dokunarak alerjenleri ve besin değerlerini görebilirsin.'],
 ],
],

[
 'slug' => 'anadolu-universitesi-yakini-kafe',
 'title' => 'Anadolu Üniversitesi Yakını Kafe | Opia Coffee Co.',
 'description' => 'Anadolu Üniversitesi Yunusemre Kampüsü yakınında kafe: Opia Coffee Co., Yenibağlar’da nitelikli kahve, tatlı ve gece yarısına kadar açık. Her gün 09:00 - 00:00.',
 'h1' => 'Anadolu Üniversitesi yakınında kahve',
 'lead' => 'Yunusemre Kampüsü’nün bulunduğu Yenibağlar hattındayız. Ders arası, ödev gecesi ya da kampüs ziyareti sonrası için bir kahve durağı.',
 'icon' => 'school', 'image' => 'yerel-anadolu-universitesi',
 'sections' => [
  ['Kampüse yakın', '<p>Anadolu Üniversitesi’nin Yunusemre Kampüsü Yenibağlar tarafında yer alıyor; Opia da aynı mahallede, Eti Caddesi’nde. Kampüs çıkışında yürüyerek ya da kısa bir yolculukla ulaşabilirsin. Güncel mesafeyi <a href="/iletisim/">iletişim sayfamızdaki</a> yol tarifi düğmeleriyle haritada görebilirsin.</p>'],
  ['Öğrenciler ve akademisyenler için', '<ul><li><strong>09:00 - 00:00:</strong> Sabah dersinden önce espresso, gece çalışması için filtre kahve ya da sıcak çikolata.</li><li><strong>Uzun oturumlar:</strong> Filtre Kahve, Red Eye ve Black Eye uzun saatler için seçenekler.</li><li><strong>Tatlı:</strong> Tiramisu, brownie ve cheesecake dilimleri vitrinde.</li><li><strong>Şeffaf menü:</strong> Alerjen ve kalori bilgisi her üründe.</li></ul>'],
  ['Kampüs ziyaretçileri için', '<p>Mezuniyet, sınav, mülakat ya da misafir ağırlama; Anadolu Üniversitesi’ne yolu düşenler için buluşma noktası olabilir. Bir fincan kahve ve tatlıyla gününü toparlayabilirsin.</p>'],
 ],
 'faq' => [
  ['Anadolu Üniversitesi’ne yakın kafe var mı?', 'Opia Coffee Co., Yenibağlar Mahallesi Eti Caddesi’nde, Yunusemre Kampüsü’nün bulunduğu hatta yer alır ve her gün 09:00 - 00:00 açıktır.'],
  ['Gece geç saate kadar açık mı?', 'Evet, her gün gece yarısına (00:00) kadar açığız.'],
 ],
],

[
 'slug' => 'hava-muzesi-yakini-kafe',
 'title' => 'Hava Müzesi Yakını Kafe | Opia Coffee Co. Eskişehir',
 'description' => 'Eskişehir Hava Müzesi (Vecihi Hürkuş Havacılık Parkı) yakınında kahve molası: Opia Coffee Co., Yenibağlar’da nitelikli kahve ve tatlı. Her gün 09:00 - 00:00.',
 'h1' => 'Hava Müzesi’nin yakınında kahve',
 'lead' => 'Vecihi Hürkuş Havacılık Parkı (Eskişehir Hava Müzesi) ile aynı mahalledeyiz. Müze gezisi öncesi ya da sonrası için bir kahve ve tatlı molası.',
 'icon' => 'plane', 'image' => 'yerel-hava-muzesi',
 'sections' => [
  ['Havacılık Parkı’yla aynı mahalle', '<p>Eskişehir’de “Hava Müzesi” olarak bilinen açık hava müzesi, bugün Vecihi Hürkuş Havacılık Parkı adıyla Yenibağlar’da, Anadolu Üniversitesi Yunusemre Kampüsü’nün karşısında bulunuyor. Sivil ve askerî havacılığa ait uçakların sergilendiği park, aileler ve havacılık meraklıları için sevilen bir durak. Opia da aynı mahallede, Eti Caddesi’nde.</p>'],
  ['Müze günü planı', '<ul><li><strong>Gezi öncesi:</strong> Espresso ya da Flat White.</li><li><strong>Gezi sonrası:</strong> Sıcak çikolata ya da bir dilim cheesecake ile dinlen.</li><li><strong>Çocuklarla gelenler için:</strong> Sıcak çikolata ve brownie menüde.</li></ul><p>Tatlılar için <a href="/menu/#tatlilar">menü sayfasına</a> göz atabilirsin.</p>'],
  ['Müze çalışma saatleri hakkında', '<p>Müzenin ziyaret saatleri ve giriş koşulları zamanla değişebilir; gitmeden önce Anadolu Üniversitesi’nin ya da parkın güncel duyurularına bakmanı öneririz. Opia ise her gün 09:00 - 00:00 arasında açıktır.</p>'],
 ],
 'faq' => [
  ['Eskişehir Hava Müzesi nerede?', 'Eskişehir Hava Müzesi olarak bilinen açık hava müzesi, Vecihi Hürkuş Havacılık Parkı adıyla Yenibağlar’da, Anadolu Üniversitesi Yunusemre Kampüsü’nün karşısında yer alır.'],
  ['Müzenin yakınında kahve içilecek yer var mı?', 'Opia Coffee Co., aynı mahallede Eti Caddesi No:41/C’de, her gün 09:00 - 00:00 arasında kahve ve tatlı sunar.'],
 ],
],

[
 'slug' => 'casaba-modern-yakini-kafe',
 'title' => 'Cassaba Modern Yakını Kafe | Opia Coffee Co.',
 'description' => 'Cassaba (Casaba) Modern alışveriş merkezi yakınında kahve molası: Opia Coffee Co., Yenibağlar’da nitelikli kahve. Her gün 09:00 - 00:00, Tepebaşı Eskişehir.',
 'h1' => 'Cassaba Modern’e yakın kahve',
 'lead' => 'Alışveriş ya da şehir turu sonrası Yenibağlar’a uğra: Opia, Tepebaşı’nda nitelikli kahve ve tatlı molası için açık.',
 'icon' => 'bag', 'image' => 'yerel-casaba-modern',
 'sections' => [
  ['Hoşnudiye’den Yenibağlar’a kısa yol', '<p>Cassaba Modern (çoğu kişi “Casaba Modern” diye arar), Tepebaşı’nın Hoşnudiye Mahallesi’nde yer alıyor. Yenibağlar ise çok uzakta değil; kısa bir yürüyüş ya da birkaç dakikalık yolculukla Opia’ya gelebilirsin. Güncel yol tarifi için <a href="/iletisim/">iletişim sayfamızdaki</a> harita düğmelerini kullan.</p>'],
  ['Alışveriş arasında ne içilir?', '<ul><li>Hızlı bir mola için espresso ya da Cortado,</li><li>Poşetleri bırakıp oturmak için Latte ya da Flat White,</li><li>Daha uzun bir mola için Matcha Latte,</li><li>Eşlik edecek bir dilim San Sebastian Cheesecake ya da Tiramisu.</li></ul>'],
  ['Sıcak bir şeyler', '<p>Kış aylarında Kışa Özel bölümündeki Golden Latte, Cafe Miel, Chai Tea Latte ve Salep alışveriş yorgunluğuna iyi gelir.</p>'],
 ],
 'faq' => [
  ['Casaba Modern yakınında kafe var mı?', 'Opia Coffee Co., Cassaba Modern’in bulunduğu Hoşnudiye’ye yakın Yenibağlar Mahallesi’nde, Eti Caddesi No:41/C adresinde yer alır.'],
  ['Casaba mı, Cassaba mı?', 'Alışveriş merkezinin resmî yazımı Cassaba Modern’dir; arama motorlarında çoğunlukla “Casaba Modern” diye aranır.'],
 ],
],

[
 'slug' => 'eskisehir-tren-gari-yakini-kafe',
 'title' => 'Eskişehir Tren Garı Yakını Kafe | Opia Coffee Co.',
 'description' => 'Eskişehir Garı yakınında kahve: Opia Coffee Co., Yenibağlar’da. Tren öncesi espresso, sonrası tatlı molası. Her gün 09:00 - 00:00.',
 'h1' => 'Tren Garı’na yakın kahve molası',
 'lead' => 'Eskişehir Garı’na yaklaşık bir kilometre mesafedeki Yenibağlar’da, tren öncesi ya da sonrası için gece yarısına kadar açık bir kahve durağı.',
 'icon' => 'train', 'image' => 'yerel-tren-gari',
 'sections' => [
  ['Tren saatini beklerken', '<p>Eskişehir Garı, Hoşnudiye Mahallesi’nde İstasyon Caddesi üzerinde yer alıyor. Opia ise gara kuş uçuşu yaklaşık bir kilometre mesafede, Yenibağlar’da. Treni beklemek için erken ya da trenden indikten sonra dinlenmek için geç saatte uğrayabilirsin; saat 00:00’a kadar açığız.</p>'],
  ['Yola çıkmadan önce', '<ul><li>Sıcak bir Americano ya da Filtre Kahve,</li><li>Yolda yemek için bir dilim brownie ya da tart,</li><li>Kafeinsiz tercih edenler için Rooibos Cortado ve Golden Latte.</li></ul>'],
  ['Eskişehir’e yeni gelenler için', '<p>Trenden iner inmez şehir keşfine başlamadan önce dinlenmek istersen Yenibağlar’a gel; ardından Havacılık Parkı’nı, Anadolu Üniversitesi’ni ve Tepebaşı’ndaki diğer noktaları rahatça gezebilirsin. Tüm menüye <a href="/menu/">buradan</a> bakabilirsin.</p>'],
 ],
 'faq' => [
  ['Eskişehir Garı yakınında kahve içilecek yer var mı?', 'Opia Coffee Co., gardan yaklaşık bir kilometre uzaklıktaki Yenibağlar’da, Eti Caddesi No:41/C adresinde her gün 09:00 - 00:00 açıktır.'],
  ['Kafeinsiz seçenek var mı?', 'Evet. Rooibos Cortado ve Golden Latte kafeinsizdir Diğer içeceklerin kafein değerleri menüde ürün detayında yazar.'],
 ],
],

];
