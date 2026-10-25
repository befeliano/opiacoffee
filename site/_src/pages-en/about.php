<?php
$cfg = cfg();
$meta = [
    'path' => '/en/about/',
    'title' => 'About | Opia Coffee Co. Eskişehir',
    'description' => 'Opia Coffee Co. is a specialty coffee shop in Yenibağlar, Tepebaşı, Eskişehir, open since 2019: espresso drinks, filter coffee, a matcha bar and daily desserts.',
    'body' => 'page-about',
    'breadcrumb' => [['Home', '/en/'], ['About', '/en/about/']],
    'schema' => [['@type' => 'AboutPage', '@id' => url('/en/about/#about'), 'url' => url('/en/about/'), 'about' => ['@id' => url('/#cafe')]]],
];
ob_start(); ?>
<section class="phead">
  <div class="wrap">
    <p class="eyebrow">Opia Coffee Co.</p>
    <h1 class="phead__h">About</h1>
    <p class="lead">A coffee shop in Yenibağlar. Short, simple and honest: good beans, careful brewing and a warm table.</p>
  </div>
</section>

<section class="sec sec--tight">
  <div class="wrap split">
    <figure class="split__fig">
      <?= img('hakkimizda-1', 'Inside Opia Coffee Co. in Yenibağlar, Eskişehir', ['w' => 1000, 'h' => 1250, 'label' => 'hakkimizda-1 / 1000×1250']) ?>
    </figure>
    <div class="prose">
      <h2 class="h2">A cup, <em>a pause.</em></h2>
      <p>Opia Coffee Co. has been on Eti Street in the Yenibağlar neighbourhood of Tepebaşı, Eskişehir since 2019. Our motto is “Awaken the senses”, and the idea is simple: a cup you can drink at your own pace, away from the rush of the city.</p>
      <p>Next to the espresso classics our bar serves filter coffee, Red Eye and Black Eye, Turkish coffee and a dedicated Matcha Bar. Whether you love coffee or are just getting to know it, you should find something for yourself.</p>
      <p>Our counter has different desserts every day: cheesecake, tiramisu, brownie, tarts and more. Part of the menu changes with the seasons; in winter we serve Golden Latte, Cafe Miel, Chai Tea Latte and salep.</p>
    </div>
  </div>
</section>

<section class="sec sec--ink">
  <div class="wrap">
    <p class="label label--inv">How we see coffee</p>
    <ol class="values">
      <li><span class="values__n">01</span><h3>Specialty beans</h3><p>We work with carefully selected, freshly roasted beans. Ask about the filter coffee of the day and we will tell you its story.</p></li>
      <li><span class="values__n">02</span><h3>Careful brewing</h3><p>Water, grind, time and temperature are measured for every cup. We aim for a consistent cup, not a show.</p></li>
      <li><span class="values__n">03</span><h3>Transparency</h3><p>Every item on our menu lists its allergens and nutrition values. You have the right to know what you drink.</p></li>
      <li><span class="values__n">04</span><h3>No rush</h3><p>Open every day from 09:00 until midnight. For a coffee between classes, after a walk or late in the evening.</p></li>
    </ol>
  </div>
</section>

<section class="sec">
  <div class="wrap split split--rev">
    <figure class="split__fig split__fig--wide">
      <?= img('hakkimizda-2', 'Making coffee at the Opia Coffee Co. bar', ['w' => 1200, 'h' => 900, 'label' => 'hakkimizda-2 / 1200×900']) ?>
    </figure>
    <div class="prose">
      <h2 class="h2">Where are we? <em>Yenibağlar.</em></h2>
      <p>We are right next to Anadolu University’s Yunusemre Campus and the Vecihi Hürkuş Aviation Park (the Aviation Museum). The city centre, Eskişehir Train Station and Cassaba Modern are a short ride away.</p>
      <p><strong>Address:</strong> <?= e($cfg['address']['hood']) ?> <?= e($cfg['address']['street']) ?>, <?= e($cfg['address']['district']) ?> / <?= e($cfg['address']['city']) ?><br><strong>Hours:</strong> Every day 09:00 - 00:00</p>
      <div class="visit__cta">
        <a class="btn" href="/en/menu/">See the menu <?= icon('arrow') ?></a>
        <a class="btn btn--line" href="/en/contact/">Contact</a>
      </div>
    </div>
  </div>
</section>
<?php $content = ob_get_clean();
