<?php
$cfg = cfg();
$meta = [
    'path' => '/hakkimizda/',
    'title' => 'Hakkımızda | Opia Coffee Co. Yenibağlar Eskişehir',
    'description' => 'Opia Coffee Co., Eskişehir Tepebaşı Yenibağlar’da nitelikli kahve, filtre demleme ve günlük tatlılar sunan bir kahve dükkânı. Hikâyemiz ve kahveye bakışımız.',
    'body' => 'page-about',
    'breadcrumb' => [['Ana Sayfa', '/'], ['Hakkımızda', '/hakkimizda/']],
    'schema' => [['@type' => 'AboutPage', '@id' => url('/hakkimizda/#about'), 'url' => url('/hakkimizda/'), 'about' => ['@id' => url('/#cafe')]]],
];
ob_start(); ?>
<section class="phead">
  <div class="wrap">
    <p class="eyebrow">Opia Coffee Co.</p>
    <h1 class="phead__h">Hakkımızda</h1>
    <p class="lead">Yenibağlar’da bir kahve dükkânı. Kısa, sade ve dürüst: iyi çekirdek, doğru demleme, sıcak bir masa.</p>
  </div>
</section>

<section class="sec sec--tight">
  <div class="wrap split">
    <figure class="split__fig">
      <?= img('hakkimizda-1', 'Opia Coffee Co. Yenibağlar Eskişehir iç mekân', ['w' => 1000, 'h' => 1250, 'label' => 'hakkimizda-1 / 1000×1250']) ?>
    </figure>
    <div class="prose">
      <h2 class="h2">Bir kahve, <em>bir mola.</em></h2>
      <p>Opia Coffee Co., 2019’dan beri Eskişehir’in Tepebaşı ilçesinde, Yenibağlar Mahallesi’nde Eti Caddesi üzerinde yer alan bir kahve dükkânı. Marka sloganımız “Awaken the senses”. Fikrimiz basit: şehrin hızında kaybolmadan, kendi hızında içilen bir fincan sunmak.</p>
      <p>Barımızda espresso bazlı klasiklerin yanında filtre kahve, Red Eye ve Black Eye, Türk Kahvesi ve ayrı bir Matcha Bar var. Kahveyi seven de, kahveyle arası yeni düzelen de kendine bir şey bulabilsin istiyoruz.</p>
      <p>Vitrinimizde her gün farklı tatlılar olur: cheesecake, tiramisu, brownie, tart ve daha fazlası. Mevsim değiştikçe menünün bir bölümü de değişir; kışın Golden Latte, Cafe Miel, Chai Tea Latte ve salep gelir.</p>
    </div>
  </div>
</section>

<section class="sec sec--ink">
  <div class="wrap">
    <p class="label label--inv">Kahveye bakışımız</p>
    <ol class="values">
      <li><span class="values__n">01</span><h3>Nitelikli çekirdek</h3><p>Özenle seçilmiş, taze kavrulmuş çekirdeklerle çalışırız. Günün filtre çekirdeği hakkında sorarsan hikâyesini anlatırız.</p></li>
      <li><span class="values__n">02</span><h3>Doğru demleme</h3><p>Su, öğütme, süre, sıcaklık. Her fincan ölçülür ve tadılır. Amacımız gösterişli değil, tutarlı bir fincan.</p></li>
      <li><span class="values__n">03</span><h3>Şeffaflık</h3><p>Menümüzdeki her üründe alerjen ve besin değerlerini açıkça paylaşırız. Ne içtiğini bilmek hakkındır.</p></li>
      <li><span class="values__n">04</span><h3>Acelesiz masa</h3><p>Her gün sabah 09:00’dan gece yarısına kadar açığız. Ders arasında, yürüyüş sonrası ya da gece geç bir kahve için.</p></li>
    </ol>
  </div>
</section>

<section class="sec">
  <div class="wrap split split--rev">
    <figure class="split__fig split__fig--wide">
      <?= img('hakkimizda-2', 'Opia Coffee Co. barda kahve hazırlığı', ['w' => 1200, 'h' => 900, 'label' => 'hakkimizda-2 / 1200×900']) ?>
    </figure>
    <div class="prose">
      <h2 class="h2">Neredeyiz? <em>Yenibağlar.</em></h2>
      <p>Anadolu Üniversitesi Yunusemre Kampüsü’nün ve Vecihi Hürkuş Havacılık Parkı’nın (Hava Müzesi) bulunduğu hattın hemen yanındayız. Şehir merkezine, Eskişehir Garı’na ve Cassaba Modern’e kısa bir yolculukla ulaşabilirsin.</p>
      <p><strong>Adres:</strong> <?= e($cfg['address']['hood']) ?> <?= e($cfg['address']['street']) ?>, <?= e($cfg['address']['district']) ?> / <?= e($cfg['address']['city']) ?><br><strong>Saatler:</strong> Her gün 09:00 - 00:00</p>
      <div class="visit__cta">
        <a class="btn" href="/menu/">Menüye bak <?= icon('arrow') ?></a>
        <a class="btn btn--line" href="/iletisim/">İletişim</a>
      </div>
    </div>
  </div>
</section>
<?php $content = ob_get_clean();
