/* Opia Coffee Co.: genel arayüz: menü çekmecesi, açık/kapalı durumu, harita */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* ---- mobil çekmece ---- */
  var burger = $('.burger'), drawer = $('#drawer');
  function setDrawer(open) {
    if (!burger || !drawer) return;
    drawer.hidden = !open;
    burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    burger.setAttribute('aria-label', open ? 'Menüyü kapat' : 'Menüyü aç');
    document.body.classList.toggle('lock', open);
  }
  if (burger) {
    burger.addEventListener('click', function () { setDrawer(drawer.hidden); });
    drawer.addEventListener('click', function (e) { if (e.target.closest('a')) setDrawer(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !drawer.hidden) { setDrawer(false); burger.focus(); } });
    window.matchMedia('(min-width: 900px)').addEventListener('change', function (m) { if (m.matches) setDrawer(false); });
  }

  /* ---- açık / kapalı ---- */
  function istanbulNow() {
    try {
      var p = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Istanbul', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date());
      var h = +p.find(function (x) { return x.type === 'hour'; }).value % 24;
      var m = +p.find(function (x) { return x.type === 'minute'; }).value;
      return h * 60 + m;
    } catch (e) { var d = new Date(); return d.getHours() * 60 + d.getMinutes(); }
  }
  function updateStatus() {
    var t = istanbulNow();
    var open = t >= 9 * 60;                       // 09:00 - 00:00 (gece yarısında kapanır)
    var en = document.documentElement.lang === 'en';
    var txt = open ? (en ? 'Open now, until 00:00' : 'Şimdi açık, 00:00’a kadar') : (en ? 'Closed now, opens at 09:00' : 'Şimdi kapalı, 09:00’da açılıyoruz');
    $$('[data-open-status]').forEach(function (el) {
      el.textContent = txt;
      var host = el.closest('.eyebrow') || el;
      host.classList.toggle('is-closed', !open);
    });
  }
  updateStatus(); setInterval(updateStatus, 60000);

  /* ---- harita (tıklayınca yükle: açılışta üçüncü taraf isteği yok) ---- */
  $$('[data-map]').forEach(function (box) {
    var btn = $('[data-map-load]', box);
    if (!btn) return;
    btn.addEventListener('click', function () {
      var lat = +box.dataset.lat, lng = +box.dataset.lng, d = 0.0035;
      var f = document.createElement('iframe');
      f.title = document.documentElement.lang === 'en' ? 'Opia Coffee Co. on the map, Yenibağlar, Eskişehir' : 'Opia Coffee Co. harita konumu, Yenibağlar, Eskişehir';
      f.loading = 'lazy';
      f.referrerPolicy = 'no-referrer';
      f.src = 'https://www.openstreetmap.org/export/embed.html?bbox=' + [lng - d * 1.4, lat - d, lng + d * 1.4, lat + d].join('%2C') + '&layer=mapnik&marker=' + lat + '%2C' + lng;
      box.innerHTML = '';
      box.appendChild(f);
    });
  });

})();
