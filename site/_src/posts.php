<?php
/**
 * Blog yazıları. Her yazı tek bir arama niyetine odaklanır; menüdeki gerçek ürünlere bağlanır.
 * Alanlar: slug, title(<=60), description(<=160), h1, date, updated, lead, section, keywords, products(menü id), body(HTML), faq
 * Yeni yazı: diziye ekle, `php _src/build.php` çalıştır (sitemap ve blog sayfası otomatik güncellenir).
 */
return [

[
 'slug' => 'flat-white-latte-cappuccino-cortado-farki',
 'title' => 'Flat White, Latte, Cappuccino ve Cortado Farkı',
 'description' => 'Flat white, latte, cappuccino, cortado ve piccolo latte arasındaki fark ne? Süt oranı, köpük ve bardak boyutuyla espresso bazlı içecekleri sade bir dille anlattık.',
 'h1' => 'Flat White, Latte, Cappuccino, Cortado: farkları ne?',
 'date' => '2026-10-23', 'updated' => '2026-10-23',
 'lead' => 'Hepsinde espresso ve süt var; farkı süt miktarı, köpüğün kalınlığı ve bardağın boyu yaratıyor. Menüye bakıp hangisini seçeceğini bilemeyenler için kısa bir rehber.',
 'section' => 'Kahve rehberi',
 'keywords' => ['flat white nedir', 'latte cappuccino farkı', 'cortado nedir', 'piccolo latte'],
 'products' => ['flat-white', 'latte', 'cappuccino', 'cortado', 'piccolo-latte'],
 'body' => <<<'HTML'
<h2>Hepsinin ortak noktası: espresso</h2>
<p>Espresso bazlı sütlü içeceklerin hepsi aynı temelden başlar: yüksek basınçla kısa sürede demlenen yoğun bir kahve. Sonrasında eklenen sütün miktarı ve nasıl köpürtüldüğü içeceğin adını değiştirir. Süt arttıkça içim yumuşar, kahvenin karakteri geri çekilir; süt azaldıkça espresso öne çıkar.</p>

<h2>Latte</h2>
<p>Latte, bu ailenin en sütlü ve en uzun içimli üyesidir. Espressonun üzerine bol miktarda buharla ısıtılmış süt ve ince bir köpük katmanı gelir. Kahveyi ilk kez sütlü içecekler üzerinden deneyenler için iyi bir başlangıçtır; tatlı ve yumuşaktır. Opia’da latte yaklaşık 300 ml’lik bir bardakta servis edilir.</p>

<h2>Cappuccino</h2>
<p>Cappuccino geleneksel olarak üç eşit parçadan oluşur: espresso, süt ve kalın bir süt köpüğü. Latteye göre daha küçük ve daha köpüklüdür. Köpük, ağızda hafif ve havadar bir doku bırakır. Kahveyi hissetmek ama sütten de vazgeçmemek isteyenlerin seçimidir.</p>

<h2>Flat White</h2>
<p>Flat white’ın 1980’lerde Avustralya ya da Yeni Zelanda’da ortaya çıktığı kabul edilir; iki ülke de bu içeceği sahiplenir. Latteden daha küçük bir bardakta, genellikle çift shot espresso ile hazırlanır. Sütü çok ince, ipeksi bir mikro köpükle işlenir; üstte kalın köpük katmanı olmaz, adı da buradan gelir. Sonuç: sütlü ama kahvesi belirgin bir fincan.</p>

<h2>Cortado</h2>
<p>Cortado, İspanyolca “kesmek” fiilinden gelir: espresso, kabaca aynı miktarda sıcak sütle “kesilir”. Köpük çok azdır ya da hiç yoktur. Küçük, sert ve dengeli bir içecektir. Espressoyu tek başına fazla yoğun bulanlar için ara bir yol sunar.</p>

<h2>Piccolo Latte</h2>
<p>Piccolo, İtalyanca “küçük” demektir. Küçük bir bardakta hazırlanan minyatür bir lattedir; daha az süt sayesinde kahvenin tadı lattedekinden belirgin kalır. Kısa bir mola için iyi bir seçenektir.</p>

<h2>Kısa karşılaştırma</h2>
<ul>
  <li><strong>En sütlü:</strong> Latte</li>
  <li><strong>En köpüklü:</strong> Cappuccino</li>
  <li><strong>Kahvesi en belirgin sütlü içecek:</strong> Flat White ve Cortado</li>
  <li><strong>En küçük:</strong> Cortado ve Piccolo Latte</li>
</ul>

<h2>Süt tercihi</h2>
<p>Bu içeceklerin hepsi laktozsuz süt ya da bitkisel sütle de hazırlanabilir. Bitkisel sütler (yulaf, badem) köpüğü ve tadı biraz değiştirir; yulaf sütü genelde en yumuşak ve tatlı sonucu verir. QR menüden sipariş verirken süt seçimini ürün ekranından yapabilirsin.</p>
HTML,
 'faq' => [
  ['Flat white ile latte arasındaki fark nedir?', 'Flat white daha küçük bir bardakta, genellikle çift shot espresso ve ince mikro köpüklü sütle hazırlanır; kahvesi daha belirgindir. Latte daha büyük, daha sütlü ve daha yumuşaktır.'],
  ['Cappuccino mu latte mi daha sert?', 'Cappuccino daha az süt içerdiği için kahve tadı latteye göre daha belirgindir; latte ise daha sütlü ve yumuşaktır.'],
  ['Cortado nedir?', 'Cortado, espressonun kabaca eşit miktarda sıcak sütle karıştırıldığı küçük ve köpüğü az bir İspanyol kahvesidir.'],
 ],
],

[
 'slug' => 'red-eye-black-eye-nedir',
 'title' => 'Red Eye ve Black Eye Nedir? Filtre Kahveye Shot',
 'description' => 'Red Eye ve Black Eye nedir, ne kadar kafein içerir? Filtre kahveye espresso eklenen bu sert içecekleri ve kimler için uygun olduğunu anlattık.',
 'h1' => 'Red Eye ve Black Eye nedir?',
 'date' => '2026-10-23', 'updated' => '2026-10-23',
 'lead' => 'Filtre kahve yetmediğinde: üzerine bir ya da iki shot espresso. Uzun bir günün, gece çalışmasının ve sınav haftalarının içeceği.',
 'section' => 'Kahve rehberi',
 'keywords' => ['red eye kahve', 'black eye kahve', 'en sert kahve', 'filtre kahve kafein'],
 'products' => ['red-eye', 'black-eye', 'filtre-kahve'],
 'body' => <<<'HTML'
<h2>Red Eye: filtre kahve + bir shot</h2>
<p>Red Eye, bir bardak filtre kahvenin içine bir shot espresso eklenerek hazırlanır. Adının gece uçuşlarından (“red-eye flight”) sonra uykusuz kalan yolculara gönderme yaptığı söylenir. Tadı filtre kahveye göre daha yoğun ve gövdelidir; espresso, fincana karamelimsi bir derinlik katar.</p>

<h2>Black Eye: filtre kahve + iki shot</h2>
<p>Black Eye aynı fikrin bir adım ötesidir: filtre kahveye çift shot espresso. Opia menüsündeki en sert seçenektir. Kahveyi sade ve güçlü sevenler için uygundur; sütsüz içilir.</p>

<h2>Ne kadar kafein var?</h2>
<p>Kafein miktarı çekirdeğe, demleme oranına ve bardak boyuna göre değişir. Kabaca bir hesap yapmak gerekirse: 250 ml’lik bir filtre kahvede yaklaşık 90 - 100 mg, tek bir espresso shotunda yaklaşık 60 - 65 mg kafein bulunur. Buna göre bir Red Eye yaklaşık 150 mg, bir Black Eye ise 200 mg civarında kafein içerebilir. Opia menüsünde her ürünün tahmini kafein değerini ürün detayında görebilirsin.</p>
<p>Sağlık kuruluşları yetişkinler için günlük kafein alımında genellikle 400 mg civarını sınır olarak gösterir; hamileler, kafeine hassas olanlar ve çocuklar için bu değer çok daha düşüktür. Gün içinde başka kahveler de içtiysen bunu hesaba katmak iyi olur.</p>

<h2>Kimler için uygun?</h2>
<ul>
  <li>Filtre kahveyi seven ama daha gövdeli bir fincan isteyenler,</li>
  <li>Uzun çalışma seansları, sınav haftaları ve gece mesaisi,</li>
  <li>Sütsüz ve şekersiz kahveyi tercih edenler.</li>
</ul>

<h2>Daha hafif bir alternatif</h2>
<p>Kafeini azaltmak istersen sade <a href="/menu/#urun-filtre-kahve">Filtre Kahve</a> ya da kafein içermeyen <a href="/menu/#urun-rooibos-cortado">Rooibos Cortado</a> iyi seçeneklerdir.</p>
HTML,
 'faq' => [
  ['Red Eye ile Black Eye farkı nedir?', 'Red Eye filtre kahveye bir shot espresso, Black Eye ise iki shot espresso eklenerek hazırlanır.'],
  ['Black Eye ne kadar kafein içerir?', 'Bardak boyuna ve çekirdeğe göre değişmekle birlikte 250 ml’lik bir Black Eye yaklaşık 200 mg kafein içerebilir.'],
 ],
],

[
 'slug' => 'matcha-latte-nedir-kafein',
 'title' => 'Matcha Latte Nedir, Ne Kadar Kafein İçerir?',
 'description' => 'Matcha nedir, matcha latte nasıl hazırlanır ve ne kadar kafein içerir? Kahveye alternatif arayanlar için matcha hakkında bilmen gerekenler.',
 'h1' => 'Matcha Latte nedir, ne kadar kafein içerir?',
 'date' => '2026-10-23', 'updated' => '2026-10-23',
 'lead' => 'Yeşil rengiyle tanınan matcha, son yıllarda kahvenin en sevilen alternatiflerinden biri oldu. Peki tam olarak nedir, kahveden farkı ne?',
 'section' => 'Matcha',
 'keywords' => ['matcha nedir', 'matcha latte', 'matcha kafein', 'matcha eskişehir'],
 'products' => ['matcha-latte', 'matcha-cayi', 'oat-pistachio-matcha', 'matcha-beyaz-cikolata'],
 'body' => <<<'HTML'
<h2>Matcha nedir?</h2>
<p>Matcha, gölgede yetiştirilen yeşil çay yapraklarının kurutulup taş değirmenlerde ince bir toza dönüştürülmesiyle elde edilir. Japon çay kültürünün bir parçasıdır. Demlenip süzülen yeşil çaydan farkı, yaprağın kendisinin tüketilmesidir: toz suyla çırpılır ve tamamı içilir. Bu yüzden tadı daha yoğun, rengi daha canlıdır.</p>

<h2>Matcha latte nasıl hazırlanır?</h2>
<p>Birkaç gram matcha tozu az miktarda sıcak (kaynar olmayan) suyla pürüzsüz olana kadar çırpılır, ardından buharla ısıtılmış ya da soğuk süt eklenir. Opia’da Matcha Latte normal, laktozsuz ya da bitkisel sütle; sıcak ya da soğuk hazırlanabilir. Yulaf sütü ve Antep fıstığıyla hazırlanan <strong>Oat Pistachio, Matcha</strong> ise daha tatlı ve kremsi bir seçenek.</p>

<h2>Ne kadar kafein içerir?</h2>
<p>Matchanın kafein miktarı kullanılan toz miktarına ve kaliteye göre değişir. Bir bardak matcha latte için kullanılan 2 - 3 gram toz, kabaca 60 - 100 mg kafein içerebilir; bu, bir shot espresso ile bir bardak filtre kahve arasında bir değerdir. Matchada bulunan L-teanin aminoasidi nedeniyle etkisinin kahveye göre daha dengeli hissedildiği sıkça söylenir; bu kişiden kişiye değişebilir.</p>

<h2>Matcha mı kahve mi?</h2>
<ul>
  <li><strong>Tat:</strong> Matcha bitkisel, hafif acımsı ve umami bir tada sahiptir; kahve ise kavrulmuş, meyvemsi ya da çikolatamsı notalar taşır.</li>
  <li><strong>Kafein:</strong> Bir matcha latte, çoğu zaman bir filtre kahveden biraz daha az kafein içerir.</li>
  <li><strong>Süt uyumu:</strong> İkisi de sütle çok iyi anlaşır; matcha özellikle yulaf sütüyle sevilir.</li>
</ul>

<h2>Vegan seçenek</h2>
<p>Matcha Çayı yalnızca matcha ve sudan oluşur, bitkisel kaynaklıdır. Matcha Latte’yi bitkisel sütle sipariş ederek vegan içebilirsin. Alerjen bilgileri için ürün detayına bakabilirsin; Oat Pistachio Matcha yulaf (gluten) ve Antep fıstığı (sert kabuklu yemiş) içerir.</p>
HTML,
 'faq' => [
  ['Matcha latte kafein içerir mi?', 'Evet. Bir bardak matcha latte, kullanılan toz miktarına göre kabaca 60 - 100 mg kafein içerebilir.'],
  ['Matcha vegan mı?', 'Matcha tozu bitkiseldir. Matcha Çayı ve bitkisel sütle hazırlanan Matcha Latte vegan seçeneklerdir.'],
 ],
],

[
 'slug' => 'nitelikli-kahve-nedir',
 'title' => 'Nitelikli Kahve (Specialty Coffee) Nedir?',
 'description' => 'Nitelikli kahve nedir, sıradan kahveden farkı ne? Puanlama, kavrum, tazelik ve demleme ile specialty coffee kavramını kısaca anlattık.',
 'h1' => 'Nitelikli kahve (specialty coffee) nedir?',
 'date' => '2026-10-23', 'updated' => '2026-10-23',
 'lead' => '“Nitelikli kahve” son yıllarda her yerde karşımıza çıkıyor. Bir pazarlama sözü mü, yoksa gerçekten bir şey ifade ediyor mu? Kısaca anlatalım.',
 'section' => 'Kahve rehberi',
 'keywords' => ['nitelikli kahve nedir', 'specialty coffee', 'nitelikli kahve eskişehir', 'filtre kahve'],
 'products' => ['filtre-kahve', 'espresso', 'americano'],
 'body' => <<<'HTML'
<h2>Bir puanla başlıyor</h2>
<p>Nitelikli kahve (specialty coffee) kavramı, kahvenin profesyonel tadımcılar tarafından belirli bir standartla değerlendirilmesine dayanır. Uluslararası Specialty Coffee Association’ın (SCA) yöntemine göre yapılan tadımda 100 üzerinden 80 ve üzeri puan alan kahveler “nitelikli” kabul edilir. Puanlamada aroma, tat, asidite, gövde, denge ve kusursuzluk gibi kriterler bulunur.</p>

<h2>Tarladan fincana</h2>
<p>İyi bir puan, uzun bir zincirin sonucudur: doğru rakımda yetişen bitki, olgunken toplanan meyve, özenli işleme, iyi depolama, doğru kavurma ve son olarak doğru demleme. Bu zincirin herhangi bir halkasındaki hata fincana yansır. Bu yüzden nitelikli kahvede çekirdeğin nereden geldiği, hangi yöntemle işlendiği genellikle bilinir ve paylaşılır.</p>

<h2>Sıradan kahveden farkı</h2>
<ul>
  <li><strong>Tat:</strong> Acı ve yanık tat yerine meyve, çikolata, karamel ya da çiçek notaları öne çıkar.</li>
  <li><strong>Kavrum:</strong> Çekirdeğin karakterini kapatmamak için genellikle daha açık ya da orta kavrulur.</li>
  <li><strong>Tazelik:</strong> Kavrumdan sonraki haftalar içinde tüketilmesi önerilir.</li>
  <li><strong>Demleme:</strong> Su sıcaklığı, öğütme, oran ve süre ölçülerek hazırlanır.</li>
</ul>

<h2>Nasıl başlamalı?</h2>
<p>Nitelikli kahveyi en açık hâliyle tanımanın yolu sade içmektir. Bir <a href="/menu/#urun-filtre-kahve">Filtre Kahve</a> ya da bir <a href="/menu/#urun-espresso">Espresso</a> ile başlayıp barda çekirdeğin hangi notalara sahip olduğunu sorabilirsin. Sütlü içecekleri seviyorsan <a href="/blog/flat-white-latte-cappuccino-cortado-farki/">Flat White, Latte ve Cappuccino farkları</a> yazımız yardımcı olabilir.</p>

<h2>Eskişehir’de nitelikli kahve</h2>
<p>Eskişehir’de nitelikli kahve sunan mekânların sayısı her yıl artıyor. Opia Coffee Co., 2019’dan beri Tepebaşı’nda, Yenibağlar Mahallesi Eti Caddesi’nde bu kültürün bir parçası. Her gün 09:00 - 00:00 arasında açığız.</p>
HTML,
 'faq' => [
  ['Nitelikli kahve ne demek?', 'Profesyonel tadımda SCA standartlarına göre 100 üzerinden 80 ve üzeri puan alan, tarladan fincana kadar özenle işlenmiş kahveye nitelikli kahve denir.'],
  ['Nitelikli kahve daha mı sert?', 'Hayır, sertlik kavrum derecesi ve demleme ile ilgilidir. Nitelikli kahveler genellikle daha açık kavrulur ve acılık yerine çekirdeğin kendi notaları öne çıkar.'],
 ],
],

[
 'slug' => 'salep-nedir',
 'title' => 'Salep Nedir? Kışın Sevilen Sıcak İçecek',
 'description' => 'Salep nedir, nereden gelir, nasıl hazırlanır? Kış aylarının vazgeçilmezi saleple ilgili kısa bilgiler ve Opia’nın Kışa Özel menüsü.',
 'h1' => 'Salep nedir?',
 'date' => '2026-10-23', 'updated' => '2026-10-23',
 'lead' => 'Kış geldiğinde akla ilk gelen içeceklerden biri salep. Sütle pişen, üzerine tarçın serpilen bu koyu ve sıcak içeceğin hikâyesi, bir orkide köküne dayanıyor.',
 'section' => 'Kış içecekleri',
 'keywords' => ['salep nedir', 'salep kalori', 'kış içecekleri', 'salep eskişehir'],
 'products' => ['salep', 'golden-latte', 'cafe-miel', 'chai-tea-latte'],
 'body' => <<<'HTML'
<h2>Bir orkide kökünden</h2>
<p>Salep, bazı yabani orkide türlerinin yumrularının kurutulup öğütülmesiyle elde edilen bir undur. Bu un sütle pişirildiğinde içeceğe kendine has koyu ve kadifemsi kıvamını verir. Osmanlı döneminden bu yana kış aylarının sevilen sıcak içeceklerinden biridir. Doğal orkide türlerini korumak için yabani salep toplanması sınırlandırılmıştır; bu yüzden gerçek salep değerli bir üründür ve hazır karışımlarda genellikle nişasta gibi kıvam vericilerle birlikte kullanılır.</p>

<h2>Nasıl hazırlanır?</h2>
<p>Salep unu soğuk sütle karıştırılır, ardından sürekli karıştırılarak kısık ateşte koyulaşana kadar pişirilir. Şeker ekleyip servis ederken üzerine tarçın serpilir. Kıvamı muhallebi gibi değil, içilebilir bir koyulukta olmalıdır.</p>

<h2>Kaç kalori?</h2>
<p>Sütle hazırlanmış bir bardak salep, kullanılan süt ve şeker miktarına göre değişmekle birlikte kabaca 100 ml’de 90 - 100 kcal içerir. Opia menüsünde salebin tahmini besin değerlerini ürün detayında, porsiyon seçerek görebilirsin. Laktoz hassasiyetin varsa QR menüden laktozsuz süt seçebilirsin.</p>

<h2>Kışa Özel menü</h2>
<p>Salep, Opia’nın Kışa Özel seçkisinin bir parçası. Soğuk günler için yanında şunlar da var:</p>
<ul>
  <li><strong>Golden Latte:</strong> Zencefil, tarçın, bal ve süt. Kafein içermez.</li>
  <li><strong>Cafe Miel:</strong> Tarçın, bal, espresso ve süt.</li>
  <li><strong>Chai Tea Latte:</strong> Baharatlı çay ve süt.</li>
</ul>
HTML,
 'faq' => [
  ['Salep neyden yapılır?', 'Salep, bazı yabani orkide türlerinin kurutulup öğütülen yumrularından elde edilen undan yapılır ve sütle pişirilir.'],
  ['Salep kaç kalori?', 'Sütle hazırlanan salep kabaca 100 ml’de 90 - 100 kcal içerir; süt ve şeker miktarına göre değişir.'],
 ],
],

[
 'slug' => 'yenibaglar-bir-gun-havacilik-parki-kahve',
 'title' => 'Yenibağlar’da Bir Gün: Havacılık Parkı ve Kahve',
 'description' => 'Eskişehir Yenibağlar’da bir gün: Vecihi Hürkuş Havacılık Parkı, Anadolu Üniversitesi Yunusemre Kampüsü, Cassaba Modern ve bir kahve molası için kısa rota.',
 'h1' => 'Yenibağlar’da bir gün: Havacılık Parkı, kampüs ve kahve',
 'date' => '2026-10-23', 'updated' => '2026-10-23',
 'lead' => 'Eskişehir’e yolun düştüyse ya da şehirde yaşıyorsan, Tepebaşı’nın Yenibağlar tarafı yürüyerek gezilebilecek kısa bir rota sunuyor.',
 'section' => 'Eskişehir',
 'keywords' => ['yenibağlar gezilecek yerler', 'eskişehir hava müzesi', 'anadolu üniversitesi yakını kafe', 'eskişehir kahve molası'],
 'products' => ['flat-white', 'san-sebastian-cheesecake', 'klasik-sicak-cikolata'],
 'body' => <<<'HTML'
<h2>Sabah: bir kahveyle başla</h2>
<p>Güne Yenibağlar’da, Eti Caddesi No:41/C’deki Opia Coffee Co.’da bir kahveyle başlayabilirsin. 09:00’da açılıyoruz. Sabah için önerimiz bir Flat White ya da sade bir Filtre Kahve.</p>

<h2>Vecihi Hürkuş Havacılık Parkı (Hava Müzesi)</h2>
<p>Eskişehir’de uzun yıllar “Hava Müzesi” olarak bilinen açık hava müzesi, bugün Vecihi Hürkuş Havacılık Parkı adıyla Yenibağlar’da, Anadolu Üniversitesi Yunusemre Kampüsü’nün karşısında yer alıyor. Park, Anadolu Üniversitesi tarafından işletiliyor ve sivil ile askerî havacılığa ait uçakları sergiliyor. Çocuklu aileler ve havacılık meraklıları için keyifli bir durak. Ziyaret saatleri değişebileceği için gitmeden önce güncel duyurulara bakmanı öneririz.</p>

<h2>Anadolu Üniversitesi Yunusemre Kampüsü</h2>
<p>Parkın karşısındaki Yunusemre Kampüsü, Türkiye’nin köklü üniversitelerinden Anadolu Üniversitesi’nin ana yerleşkelerinden biri. Kampüsün çevresi gün boyu öğrenciyle hareketli; bu da mahalleye canlı bir hava katıyor.</p>

<h2>Öğleden sonra: Cassaba Modern ve gar tarafı</h2>
<p>Alışveriş için Hoşnudiye’deki Cassaba Modern’e (çoğu kişi “Casaba Modern” diye arar) kısa bir yolculukla ulaşabilirsin. Trenle gelenler için Eskişehir Garı da aynı bölgede, İstasyon Caddesi üzerinde. Şehrin bilinen diğer noktaları olan Porsuk Çayı kıyısı ve tarihi Odunpazarı evleri de günü uzatmak isteyenler için seçenekler arasında.</p>

<h2>Akşam: tatlı ve sıcak bir içecek</h2>
<p>Günü yine Yenibağlar’da kapatabilirsin. Gece yarısına kadar açığız; bir dilim San Sebastian Cheesecake ve yanında sıcak çikolata ya da kışın salep iyi bir kapanış olur. Yol tarifi için <a href="/iletisim/">iletişim sayfamıza</a> bakabilirsin.</p>
HTML,
 'faq' => [
  ['Eskişehir Hava Müzesi nerede?', 'Hava Müzesi olarak bilinen açık hava müzesi, Vecihi Hürkuş Havacılık Parkı adıyla Tepebaşı Yenibağlar’da, Anadolu Üniversitesi Yunusemre Kampüsü’nün karşısında yer alır.'],
  ['Yenibağlar’da kahve molası için nereye gidilir?', 'Opia Coffee Co., Yenibağlar Mahallesi Eti Caddesi No:41/C’de her gün 09:00 - 00:00 arasında açıktır.'],
 ],
],

];
