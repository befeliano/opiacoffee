# Besin değerleri: nasıl hesaplandı

Menüdeki kalori ve besin değerleri **kabaca** (tahmini) değerlerdir. Her içecek, tarifinden (hangi malzemeden kaç ml/g) hesaplanır; tatlılar için 100 g referans değer kullanılır. Hesap `tools/seed-menu.mjs` içindedir (`ING` tablosu = girdiler, `recipe()` = hesaplayıcı).

Formül: `100 ml değer = Σ (girdi değeri × miktar / 100) / bardak hacmi × 100`. Porsiyon değeri, 100 ml değerinin porsiyon hacmiyle çarpılmasıdır (site bunu seçilen porsiyona göre canlı hesaplar).

## Girdiler (100 ml / 100 g başına) ve kaynakları

| Girdi | kcal | Yağ | Karb. | Şeker | Protein | Kafein | Kaynak |
|---|---|---|---|---|---|---|---|
| Espresso | 9 | 0.2 | 1.7 | 0 | 0.1 | 212 mg | USDA FDC 171891 (restoran espresso); ~63 mg / 30 ml shot |
| Filtre kahve | 1 | 0 | 0 | 0 | 0.1 | 40 mg | USDA demleme kahve, tipik değer |
| Tam yağlı süt | 61 | 3.3 | 4.8 | 4.8 | 3.1 | 0 | USDA FDC 172217 (doymuş yağ ~1.9 g, etiket değerinden) |
| Yulaf sütü (barista) | 61 | 3.0 | 7.1 | 3.4 | 1.1 | 0 | Oatly Barista AB etiketi |
| Badem sütü (barista) | 24 | 1.6 | 2.5 | 2.0 | 0.6 | 0 | USDA şekersiz 15 kcal ile şekerli ürünler arası tahmin |
| Çikolata sosu | 343 | 2.6 | 73.6 | 72.1 | 3.5 | 0 | Monin Dark Chocolate Sauce / 100 g |
| Beyaz çikolata sosu | 330 | 3.5 | 70 | 68 | 2.5 | 0 | **Tahmin**: net etiket bulunamadı (glikoz şurubu + yoğunlaştırılmış süt ağırlıklı) |
| Karamel / aromalı şurup | 323 | 0 | 79.3 | 79.3 | 0 | 0 | Monin Caramel Syrup / 100 ml (zencefilli/gingerbread şurup için aynı kabul) |
| Bal | 304 | 0 | 82.4 | 82.1 | 0.3 | 0 | USDA FDC 169640 |
| Süt reçeli | 315 | 6.8 | 55 | 55 | 7 | 0 | Dulce de leche tipik değeri |
| Matcha tozu | 330 | 5 | 40 | 2 | 30 | 3500 mg | Etiketler 285-379 kcal arası; kafein ~3.5 g / 100 g (Mattisson organik matcha) |
| Antep fıstığı (ezme) | 562 | 45.3 | 27.2 | 7.7 | 20.2 | 0 | USDA ham fıstık |
| Chai Tea Latte (hazır içecek) | 58 | 1.9 | 8.6 | 7.1 | 1.7 | 20 mg | FatSecret, Starbucks Chai Tea Latte / 100 ml |
| Salep (sütlü) | 94 | 2.6 | 14.5 | 12.5 | 2.8 | 0 | Gazete Vatan (94 kcal) ve FatSecret (97 kcal) / 100 ml |
| Vanilyalı dondurma | 207 | 11 | 23.6 | 21.2 | 3.5 | 0 | USDA |

## Tatlılar (100 g)

| Tatlı | kcal | Yağ | Karb. | Şeker | Protein | Not |
|---|---|---|---|---|---|---|
| Tiramisu | 283 | 18.2 | 24.4 | 16 | 4.8 | FatSecret genel tiramisu |
| San Sebastian Cheesecake | 320 | 26.4 | 16 | 13 | 5.5 | Basque cheesecake kaynakları 316-380 kcal arası |
| Cheesecake | 321 | 22.5 | 25.5 | 21.9 | 5.5 | USDA cheesecake |
| Brownie | 466 | 29.1 | 50.2 | 36 | 6.2 | USDA brownies (tariften) |
| Tart, Opia Cup, Büyükanne Turtası, Torte | 260-410 | | | | | **Tahmin**: tarif bilinmiyor, benzer ürünlerin ortalaması |

## Varsayılan porsiyon hacimleri

Menüde tek boyut görünüyor; hacimler varsayımdır ve admin panelinden düzeltilebilir: Espresso 30 ml, Americano 240, Latte/Mocha/Matcha Latte ve kış içecekleri 300, Flat White 180, Cappuccino 200, Cortado 120, Piccolo 100, filtre kahve 250, Türk kahvesi 70 (duble 140). Tatlı dilimleri 90 - 150 g.

> Gerçek tarifler (kaç gram sos, kaç ml süt, hangi marka süt/şurup) ve gerçek bardak boyutları bilindiğinde `seed-menu.mjs` içindeki miktarlar güncellenip değerler yeniden hesaplanmalı, ya da değerler panelden elle düzeltilmelidir.
