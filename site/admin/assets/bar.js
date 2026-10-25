/* Bar ekranı: siparişler, garson çağrıları, masa hesapları ve tükendi listesi. 4 sn'de bir yenilenir. */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var CSRF = document.body.getAttribute('data-csrf');
  var seenOrders = null, seenCalls = null, sound = false, actx = null, busy = false, timer = null, products = null, tab = 'orders';

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function money(n) { n = +n; return (n % 1 === 0 ? n.toLocaleString('tr-TR') : n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })) + ' ₺'; }
  function ago(ts, now) { var m = Math.floor((now - ts) / 60); return m < 1 ? 'şimdi' : m < 60 ? m + ' dk' : Math.floor(m / 60) + ' sa ' + (m % 60) + ' dk'; }
  function hm(ts) { var d = new Date(ts * 1000); return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2); }
  var STATUS = { yeni: 'Yeni', hazirlaniyor: 'Hazırlanıyor', teslim: 'Teslim edildi' };

  function beep() {
    if (!sound) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      [0, 0.22].forEach(function (t) {
        var o = actx.createOscillator(), g = actx.createGain();
        o.type = 'sine'; o.frequency.value = 880; g.gain.value = 0.18;
        o.connect(g); g.connect(actx.destination);
        o.start(actx.currentTime + t); o.stop(actx.currentTime + t + 0.15);
      });
    } catch (e) {}
    if (navigator.vibrate) navigator.vibrate([120, 80, 120]);
  }

  function itemsHtml(items) {
    return items.map(function (i) {
      return '<li><b>' + i.qty + '×</b><div>' + esc(i.name) + (i.options ? '<small>' + esc(i.options) + '</small>' : '') + '</div></li>';
    }).join('');
  }

  function card(o, now, isNew) {
    var late = (now - o.created_at) > 15 * 60;
    var acts = o.status === 'yeni'
      ? '<button class="bbtn bbtn--ghost" data-act="iptal" data-id="' + o.id + '" data-confirm="#' + o.id + ' iptal edilsin mi?">İptal</button><button class="bbtn bbtn--solid" data-act="hazirlaniyor" data-id="' + o.id + '">Hazırlanıyor</button>'
      : '<button class="bbtn bbtn--ghost" data-act="yeni" data-id="' + o.id + '">Geri al</button><button class="bbtn bbtn--solid" data-act="teslim" data-id="' + o.id + '">Teslim edildi</button>';
    return '<article class="bcard' + (isNew ? ' is-new' : '') + '"><div class="bcard__h"><b>Masa ' + esc(o.table_name) + '</b><span class="' + (late ? 'late' : '') + '">#' + o.id + ' / ' + hm(o.created_at) + ' / ' + ago(o.created_at, now) + '</span></div>' +
      '<ul class="bitems">' + itemsHtml(o.items) + '</ul>' + (o.note ? '<p class="bnote">' + esc(o.note) + '</p>' : '') +
      '<div class="bcard__f"><span>' + money(o.total) + '</span><div>' + acts + '</div></div></article>';
  }

  function renderBills(d) {
    var box = $('[data-bills]');
    $('[data-n-bills]').textContent = d.bills.length;
    box.innerHTML = d.bills.length ? d.bills.map(function (b) {
      var lines = b.orders.map(function (o) {
        return '<div class="bbill__o"><span>#' + o.id + ' / ' + hm(o.created_at) + ' / ' + (STATUS[o.status] || o.status) + '</span><b>' + money(o.total) + '</b></div><ul class="bitems bitems--sm">' + itemsHtml(o.items) + '</ul>';
      }).join('');
      return '<article class="bbill"><div class="bcard__h"><b>Masa ' + esc(b.table_name) + '</b><span>' + ago(b.since, d.now) + ' / ' + b.orders.length + ' sipariş' + (b.open ? ' / ' + b.open + ' hazırlanıyor' : '') + '</span></div>' +
        lines + '<div class="bbill__t"><span>Toplam</span><b>' + money(b.total) + '</b></div>' +
        '<div class="bbill__acts"><button class="bbtn bbtn--solid" data-pay="nakit" data-table="' + b.table_id + '" data-name="' + esc(b.table_name) + '" data-total="' + b.total + '">Nakit ile kapat</button>' +
        '<button class="bbtn bbtn--solid" data-pay="kart" data-table="' + b.table_id + '" data-name="' + esc(b.table_name) + '" data-total="' + b.total + '">Kart ile kapat</button></div></article>';
    }).join('') : '<p class="bempty">Açık masa hesabı yok.</p>';

    $('[data-tables]').innerHTML = d.tables.length ? d.tables.map(function (t) {
      var on = +t.ordering === 1 && d.ordering;
      return '<button type="button" class="btable' + (on ? '' : ' off') + '" data-ordering="' + t.id + '" title="QR siparişi aç / kapat"><b>' + esc(t.name) + '</b><span>' + (on ? 'QR açık' : 'QR kapalı') + '</span></button>';
    }).join('') : '<p class="bempty">Masa yok.</p>';
  }

  function renderStock() {
    var box = $('[data-stock]'); if (!products) return;
    var q = ($('[data-stock-search]').value || '').toLocaleLowerCase('tr-TR');
    var groups = {};
    products.forEach(function (p) { if (q && p.name.toLocaleLowerCase('tr-TR').indexOf(q) < 0) return; (groups[p.category] = groups[p.category] || []).push(p); });
    $('[data-n-soldout]').textContent = products.filter(function (p) { return p.soldout; }).length;
    box.innerHTML = Object.keys(groups).map(function (g) {
      return '<h3>' + esc(g) + '</h3><div class="bstock__g">' + groups[g].map(function (p) {
        return '<button type="button" class="bprod' + (p.soldout ? ' is-out' : '') + '" data-soldout="' + esc(p.id) + '" aria-pressed="' + p.soldout + '"><b lang="' + (p.lang === 'en' ? 'en' : 'tr') + '">' + esc(p.name) + '</b><span>' + (p.soldout ? 'Tükendi' : 'Var') + '</span></button>';
      }).join('') + '</div>';
    }).join('') || '<p class="bempty">Ürün bulunamadı.</p>';
  }

  function render(d) {
    var now = d.now, newOrder = false, newCall = false;
    var ids = d.orders.map(function (o) { return o.id; }), cids = d.calls.map(function (c) { return c.id; });
    if (seenOrders) ids.forEach(function (id) { if (seenOrders.indexOf(id) < 0) newOrder = true; });
    if (seenCalls) cids.forEach(function (id) { if (seenCalls.indexOf(id) < 0) newCall = true; });
    var prev = seenOrders || ids;
    seenOrders = ids; seenCalls = cids;
    if (newOrder || newCall) beep();

    $('[data-n-orders]').textContent = d.orders.length;
    ['yeni', 'hazirlaniyor'].forEach(function (st) {
      var list = d.orders.filter(function (o) { return o.status === st; });
      $('[data-n-' + st + ']').textContent = list.length;
      $('[data-col="' + st + '"]').innerHTML = list.length
        ? list.map(function (o) { return card(o, now, prev.indexOf(o.id) < 0); }).join('')
        : '<p class="bempty">' + (st === 'yeni' ? 'Yeni sipariş yok.' : 'Hazırlanan sipariş yok.') + '</p>';
    });

    var calls = $('[data-calls]');
    calls.hidden = !d.calls.length;
    calls.innerHTML = d.calls.map(function (c) {
      var bill = c.type === 'hesap' ? d.bills.filter(function (b) { return +b.table_id === +c.table_id; })[0] : null;
      return '<div class="bcall"><div><b>Masa ' + esc(c.table_name) + '</b> <span>' + esc(c.label) + (bill ? ' / hesap ' + money(bill.total) : '') + ' / ' + ago(c.created_at, now) + '</span></div><button class="bbtn" data-callclose="' + c.id + '">Tamam</button></div>';
    }).join('');

    var t = d.today;
    $('[data-s-orders]').textContent = t.orders;
    $('[data-s-revenue]').textContent = money(t.revenue);
    $('[data-s-unpaid]').textContent = money(t.unpaid);
    $('[data-top]').innerHTML = t.items.length ? t.items.slice(0, 8).map(function (i) { return '<li><span>' + esc(i.name) + '</span><b>' + i.qty + '</b></li>'; }).join('') : '<li><span>Henüz satış yok.</span></li>';
    $('[data-recent]').innerHTML = d.recent.length ? d.recent.map(function (o) {
      return '<li><span>Masa ' + esc(o.table_name) + ' / #' + o.id + ' / ' + hm(o.delivered_at || o.created_at) + '</span><button class="bbtn" data-act="hazirlaniyor" data-id="' + o.id + '">Geri al</button></li>';
    }).join('') : '<li>Bugün teslim yok.</li>';
    renderBills(d);

    var open = d.orders.length + d.calls.length;
    document.title = (open ? '(' + open + ') ' : '') + 'Bar | Opia';
    var s = $('[data-state]'); s.className = 'bh__state'; s.textContent = d.ordering ? 'QR sipariş açık' : 'QR sipariş kapalı';
  }

  function fail(msg) { var s = $('[data-state]'); s.className = 'bh__state err'; s.textContent = msg; }

  function getJSON(url) {
    return fetch(url, { headers: { 'Accept': 'application/json' }, cache: 'no-store' })
      .then(function (r) { if (r.status === 401) { location.href = '/admin/login.php?next=' + encodeURIComponent('/admin/bar.php'); throw 0; } return r.json(); });
  }
  function load() {
    clearTimeout(timer);
    getJSON('/admin/api.php?a=feed')
      .then(function (d) { if (d.ok) render(d); else fail(d.error || 'Hata'); })
      .catch(function (e) { if (e !== 0) fail('Bağlantı yok, tekrar deneniyor'); })
      .then(function () { timer = setTimeout(load, 4000); });
  }
  function loadProducts() {
    getJSON('/admin/api.php?a=products').then(function (d) { if (d.ok) { products = d.products; renderStock(); } }).catch(function () {});
  }

  function post(params) {
    if (busy) return Promise.resolve({}); busy = true;
    var fd = new FormData(); Object.keys(params).forEach(function (k) { fd.append(k, params[k]); });
    return fetch('/admin/api.php', { method: 'POST', body: fd, headers: { 'X-CSRF': CSRF, 'Accept': 'application/json' } })
      .then(function (r) { return r.json(); })
      .then(function (d) { if (!d.ok) fail(d.error || 'İşlem yapılamadı'); return d; })
      .catch(function () { fail('Bağlantı hatası'); return {}; })
      .then(function (d) { busy = false; load(); return d; });
  }

  function showTab(name) {
    tab = name;
    $$('[data-tab]').forEach(function (b) { b.setAttribute('aria-selected', b.getAttribute('data-tab') === name); });
    $$('[data-panel]').forEach(function (p) { p.hidden = p.getAttribute('data-panel') !== name; });
    if (name === 'stock') loadProducts();
    try { sessionStorage.setItem('opia_bar_tab', name); } catch (x) {}
  }

  document.addEventListener('click', function (e) {
    var tb = e.target.closest('[data-tab]'); if (tb) { showTab(tb.getAttribute('data-tab')); return; }
    var b = e.target.closest('[data-act]');
    if (b) {
      if (b.hasAttribute('data-confirm') && !confirm(b.getAttribute('data-confirm'))) return;
      b.disabled = true; post({ a: 'order', id: b.getAttribute('data-id'), status: b.getAttribute('data-act') });
    }
    var c = e.target.closest('[data-callclose]');
    if (c) { c.disabled = true; post({ a: 'call', id: c.getAttribute('data-callclose') }); }
    var pay = e.target.closest('[data-pay]');
    if (pay) {
      var m = pay.getAttribute('data-pay');
      if (!confirm('Masa ' + pay.getAttribute('data-name') + ' hesabı (' + money(pay.getAttribute('data-total')) + ') ' + (m === 'nakit' ? 'nakit' : 'kart') + ' ile kapatılsın mı?')) return;
      pay.disabled = true; post({ a: 'pay', table_id: pay.getAttribute('data-table'), method: m });
    }
    var so = e.target.closest('[data-soldout]');
    if (so) {
      var pid = so.getAttribute('data-soldout'), p = products.filter(function (x) { return x.id === pid; })[0];
      so.disabled = true;
      post({ a: 'soldout', pid: pid, value: p.soldout ? '0' : '1' }).then(function (d) { if (d.ok) { p.soldout = d.soldout; renderStock(); } so.disabled = false; });
    }
    var tg = e.target.closest('[data-ordering]');
    if (tg) { tg.disabled = true; post({ a: 'ordering', table_id: tg.getAttribute('data-ordering') }); }
    var s = e.target.closest('[data-sound]');
    if (s) {
      sound = !sound; s.setAttribute('aria-pressed', sound); s.textContent = sound ? 'Ses açık' : 'Sesi aç';
      if (sound) beep();
    }
  });
  $('[data-stock-search]').addEventListener('input', renderStock);

  function clock() { var d = new Date(); $('[data-clock]').textContent = ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2); }
  clock(); setInterval(clock, 15000);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) load(); });
  try { var st = sessionStorage.getItem('opia_bar_tab'); if (st) showTab(st); } catch (x) {}
  load(); loadProducts();
})();
