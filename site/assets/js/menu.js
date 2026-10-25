/* Opia menü: ürün modalı + besin tablosu (porsiyon seçimi), arama, alerjen filtresi, kategori vurgusu,
   QR masa siparişi (sepet, seçenekler, not, garson çağırma, sipariş durumu, masa hesabı). Ödeme yok. */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  var EN = document.documentElement.lang === 'en';
  var LOC = EN ? 'en-GB' : 'tr-TR';
  var S = EN ? {
    seasonal: 'Seasonal', soldout: 'Sold out', noAllergen: 'No known allergens', per: 'per', energy: 'Energy', fat: 'Fat', sat: 'Saturates',
    carb: 'Carbohydrate', sugar: 'Sugars', protein: 'Protein', salt: 'Salt', caffeine: 'Caffeine',
    milk: 'Milk', temp: 'Hot / iced', extra: 'Extra', dessert: 'Add to your dessert', qty: 'Quantity', dec: 'Decrease', inc: 'Increase',
    add: 'Add to basket', closedNow: 'Not taking orders now', soldoutNow: 'Sold out right now', added: ' added to your basket.',
    waiter: 'Waiter', basket: 'Basket', table: 'Table ', tipOpen: 'Tap an item, choose your options and add it to your basket. You pay at the counter or at your table.',
    tipClosed: 'We are outside ordering hours right now ({h} - 00:00). Feel free to browse the menu.', close: 'Close', yourBasket: 'Your basket',
    note: 'Note for your order', notePh: 'e.g. no sugar, not too hot, bring together', total: 'Total', send: 'Send order',
    payInfo: 'No online payment. You pay at the counter or at your table.', callStaff: 'Call staff', callWaiter: 'Call a waiter', askBill: 'Ask for the bill',
    failed: 'Could not send.', empty: 'Your basket is empty. Tap an item on the menu to add it.', yourOrders: 'Your orders', received: 'Received',
    sending: 'Sending', sent: 'Your order reached the bar (#{id}). We will bring it to your table when it is ready.',
    netErr: 'Connection error. Please try again or ask our staff.', orderStatus: 'Order #{id}: ', bill: 'Table bill (unpaid)', conn: 'Connection error.'
  } : {
    seasonal: 'Sezonluk', soldout: 'Tükendi', noAllergen: 'Bilinen alerjen içermez', per: 'başına', energy: 'Enerji', fat: 'Yağ', sat: 'Doymuş yağ',
    carb: 'Karbonhidrat', sugar: 'Şekerler', protein: 'Protein', salt: 'Tuz', caffeine: 'Kafein',
    milk: 'Süt', temp: 'Sıcak / soğuk', extra: 'Ekstra', dessert: 'Tatlına ekle', qty: 'Adet', dec: 'Azalt', inc: 'Arttır',
    add: 'Sepete ekle', closedNow: 'Şu an sipariş alınmıyor', soldoutNow: 'Şu an tükendi', added: ' sepete eklendi.',
    waiter: 'Garson', basket: 'Sepet', table: 'Masa ', tipOpen: 'Ürüne dokun, seçeneklerini seç, sepete ekle. Ödeme kasada ya da masada yapılır.',
    tipClosed: 'Şu an sipariş saatleri dışındayız ({h} - 00:00). Menüye göz atabilirsin.', close: 'Kapat', yourBasket: 'Sepetin',
    note: 'Siparişe not', notePh: 'Örn. şekersiz, az sıcak, aynı anda gelsin', total: 'Toplam', send: 'Siparişi gönder',
    payInfo: 'Online ödeme yok. Ödemeni kasada ya da masada yaparsın.', callStaff: 'Personel çağır', callWaiter: 'Garson çağır', askBill: 'Hesap iste',
    failed: 'Gönderilemedi.', empty: 'Sepetin boş. Menüden bir ürüne dokunup sepete ekleyebilirsin.', yourOrders: 'Siparişlerin', received: 'Alındı',
    sending: 'Gönderiliyor', sent: 'Siparişin bara ulaştı (#{id}). Hazırlanınca masana getireceğiz.',
    netErr: 'Bağlantı hatası. Lütfen tekrar dene ya da personele seslen.', orderStatus: '#{id} numaralı sipariş: ', bill: 'Masa hesabı (ödenmemiş)', conn: 'Bağlantı hatası.'
  };

  var dataEl = $('#menu-data');
  var DATA = {};
  try { DATA = JSON.parse(dataEl ? dataEl.textContent : '{}'); } catch (e) {}

  var dlg = $('#product-modal');
  var CUP = '<span class="noimg" aria-hidden="true"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 9h12v5a5 5 0 0 1-5 5h-2a5 5 0 0 1-5-5V9z"/><path d="M17 10h1.5a2.5 2.5 0 0 1 0 5H17"/><path d="M8 3c0 1.5 1.2 1.5 1.2 3M12 3c0 1.5 1.2 1.5 1.2 3"/></svg></span>';
  var XSVG = '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>';

  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function money(n) { n = +n; return (n % 1 === 0 ? n.toLocaleString(LOC) : n.toLocaleString(LOC, { minimumFractionDigits: 2, maximumFractionDigits: 2 })) + ' ₺'; }
  function num(v, d) { return (+v).toLocaleString(LOC, { minimumFractionDigits: 0, maximumFractionDigits: d }); }
  function fill(s, o) { return s.replace(/\{(\w+)\}/g, function (_, k) { return o[k]; }); }
  function lbl(o) { return EN && o.label_en ? o.label_en : o.label; }
  function store(kind) { try { return kind === 'local' ? window.localStorage : window.sessionStorage; } catch (e) { return null; } }
  function sget(kind, k, def) { var s = store(kind); if (!s) return def; try { var v = JSON.parse(s.getItem(k)); return v == null ? def : v; } catch (e) { return def; } }
  function sset(kind, k, v) { var s = store(kind); if (!s) return; try { if (v == null) s.removeItem(k); else s.setItem(k, JSON.stringify(v)); } catch (e) {} }

  var current = null, lastTrigger = null;

  /* ================= BESİN TABLOSU ================= */
  function nutrRows(p, f) {
    var n = p.nutrition.per100, kcal = n.kcal * f;
    var rows = [
      ['big', S.energy, Math.round(kcal) + ' kcal / ' + Math.round(kcal * 4.184) + ' kJ'],
      ['', S.fat, num(n.fat * f, 1) + ' g'],
      ['sub', S.sat, num(n.satFat * f, 1) + ' g'],
      ['', S.carb, num(n.carb * f, 1) + ' g'],
      ['sub', S.sugar, num(n.sugar * f, 1) + ' g'],
      ['', S.protein, num(n.protein * f, 1) + ' g'],
      ['', S.salt, num(n.salt * f, 2) + ' g'],
    ];
    if (n.caffeine > 0) rows.push(['', S.caffeine, Math.round(n.caffeine * f) + ' mg']);
    return rows.map(function (r) { return '<tr class="' + r[0] + '"><th scope="row">' + r[1] + '</th><td>' + r[2] + '</td></tr>'; }).join('');
  }

  function renderNutrition() {
    var p = current; if (!p) return;
    var idx = $('[data-pm-serving]', dlg).value, factor, priceNow = p.price;
    if (idx === 'per100') factor = 1;
    else { var s = p.nutrition.servings[+idx]; factor = s.amount / 100; if (s.price) priceNow = s.price; }
    $('[data-pm-nutr] tbody', dlg).innerHTML = nutrRows(p, factor);
    $('[data-pm-price]', dlg).innerHTML = money(priceNow) + (p.priceNote ? '<small>' + esc(p.priceNote) + '</small>' : '');
  }

  function open(id, trigger) {
    var p = DATA[id]; if (!p || !dlg || !dlg.showModal) return;
    current = p; lastTrigger = trigger || null;
    $('[data-pm-img]', dlg).innerHTML = p.image
      ? '<img src="/uploads/' + encodeURI(p.image) + '" alt="' + esc(p.name) + ', Opia Coffee Co. Eskişehir" decoding="async">'
      : CUP;
    var eb = $('[data-pm-eyebrow]', dlg), tags = (p.tags || []).slice();
    if (p.soldout) tags.unshift(S.soldout); else if (p.seasonal) tags.unshift(S.seasonal);
    eb.setAttribute('lang', tags.length ? (EN ? 'en' : 'tr') : 'en');
    eb.textContent = tags.length ? tags.join(' / ') : 'Opia Coffee Co.';
    var ttl = $('[data-pm-title]', dlg); ttl.textContent = p.name; ttl.setAttribute('lang', p.lang === 'en' ? 'en' : 'tr');
    $('[data-pm-desc]', dlg).textContent = p.description;
    $('[data-pm-allergens]', dlg).innerHTML = p.allergens.length
      ? p.allergens.map(function (a) { return '<li>' + esc(a) + '</li>'; }).join('')
      : '<li class="none">' + S.noAllergen + '</li>';
    var sel = $('[data-pm-serving]', dlg);
    var unit = p.nutrition.basis === 'g' ? '100 g' : '100 ml';
    sel.innerHTML = p.nutrition.servings.map(function (s, i) { return '<option value="' + i + '">' + esc(s.label) + '</option>'; }).join('') +
      '<option value="per100">' + (EN ? S.per + ' ' + unit : unit + ' ' + S.per) + '</option>';
    sel.value = p.nutrition.servings.length ? '0' : 'per100';
    renderNutrition();
    renderOrderBlock(p);
    dlg.showModal();
    document.body.classList.add('lock');
    var body = $('.pm__body', dlg); if (body) body.scrollTop = 0;
    try { history.replaceState(null, '', '#urun-' + id); } catch (e) {}
  }
  function close() { if (dlg && dlg.open) dlg.close(); }

  if (dlg) {
    $('[data-pm-serving]', dlg).addEventListener('change', renderNutrition);
    dlg.addEventListener('click', function (e) { if (e.target === dlg || e.target.closest('[data-close]')) close(); });
    dlg.addEventListener('close', function () {
      if (!$('.drawer:not([hidden])')) document.body.classList.remove('lock');
      current = null;
      try { if (location.hash.indexOf('#urun-') === 0) history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
      if (lastTrigger && lastTrigger.focus) lastTrigger.focus({ preventScroll: true });
    });
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('.prod[data-id]');
    if (b) { e.preventDefault(); open(b.getAttribute('data-id'), b); }
  });

  /* Tükendi durumunu sayfaya uygular (sunucudan gelen güncel liste ile) */
  function applySoldout(ids) {
    Object.keys(DATA).forEach(function (id) { DATA[id].soldout = ids.indexOf(id) > -1; });
    $$('.prod[data-id]').forEach(function (b) {
      var id = b.getAttribute('data-id'), out = ids.indexOf(id) > -1, li = b.closest('.row, .card');
      if (!li) return;
      li.classList.toggle('is-soldout', out);
      var name = $('.prod__name', b), badge = name && $('.badge--out', name);
      if (name && out && !badge) name.insertAdjacentHTML('beforeend', '<span class="badge badge--out">' + S.soldout + '</span>');
      if (badge && !out) badge.remove();
    });
  }

  /* ================= QR MASA SİPARİŞİ ================= */
  var ORDER = null, TOKEN = null, CART = [], MINE = [];

  function cartKey() { return 'opia_cart_' + TOKEN; }
  function mineKey() { return 'opia_orders_' + TOKEN; }
  function saveCart() { sset('session', cartKey(), CART); updateBar(); }

  function api(params, post) {
    var url = '/api/order.php', opt = { headers: { 'Accept': 'application/json' } };
    params.t = TOKEN; if (EN) params.lang = 'en';
    if (post) {
      var fd = new FormData(); Object.keys(params).forEach(function (k) { fd.append(k, params[k]); });
      opt.method = 'POST'; opt.body = fd;
    } else {
      url += '?' + Object.keys(params).map(function (k) { return k + '=' + encodeURIComponent(params[k]); }).join('&');
    }
    return fetch(url, opt).then(function (r) { return r.json().catch(function () { return { ok: false, error: S.conn }; }); });
  }

  function linePrice(p, sel) {
    var o = ORDER.options, f = p.options || {}, u = +p.price, txt = [];
    if (f.milk && sel.milk && sel.milk !== 'normal') { o.milk.forEach(function (m) { if (m.id === sel.milk) { u += +m.price; txt.push(lbl(m)); } }); }
    if (f.shot && sel.shot) { u += sel.shot * o.shot.price; txt.push('+' + sel.shot + ' shot'); }
    if (f.temp) { o.temp.forEach(function (t) { if (t.id === (sel.temp || 'sicak')) txt.push(lbl(t)); }); }
    if (f.dessert && sel.addons) { o.dessert.forEach(function (a) { if (sel.addons.indexOf(a.id) > -1) { u += +a.price; txt.push(lbl(a)); } }); }
    return { unit: u, txt: txt.join(', ') };
  }

  function chip(type, name, value, label, price, checked) {
    return '<label class="ochip"><input type="' + type + '" name="' + name + '" value="' + esc(value) + '"' + (checked ? ' checked' : '') + '><span>' + esc(label) +
      (price ? ' <em>+' + money(price) + '</em>' : '') + '</span></label>';
  }

  function renderOrderBlock(p) {
    var box = $('[data-pm-order]', dlg); if (!box) return;
    if (!ORDER || p.orderable === false) { box.hidden = true; box.innerHTML = ''; return; }
    if (p.soldout) { box.innerHTML = '<p class="pm__out">' + S.soldoutNow + '</p>'; box.hidden = false; return; }
    var o = ORDER.options, f = p.options || {}, h = '';
    if (f.milk) h += '<fieldset class="opt"><legend>' + S.milk + '</legend><div class="ochips">' + o.milk.map(function (m, i) { return chip('radio', 'milk', m.id, lbl(m), m.price, i === 0); }).join('') + '</div></fieldset>';
    if (f.temp) h += '<fieldset class="opt"><legend>' + S.temp + '</legend><div class="ochips">' + o.temp.map(function (t, i) { return chip('radio', 'temp', t.id, lbl(t), 0, i === 0); }).join('') + '</div></fieldset>';
    if (f.shot) h += '<fieldset class="opt"><legend>' + S.extra + '</legend><div class="ochips">' + chip('checkbox', 'shot', '1', lbl(o.shot), o.shot.price, false) + '</div></fieldset>';
    if (f.dessert) h += '<fieldset class="opt"><legend>' + S.dessert + '</legend><div class="ochips">' + o.dessert.map(function (a) { return chip('checkbox', 'addons', a.id, lbl(a), a.price, false); }).join('') + '</div></fieldset>';
    h += '<div class="oadd">' +
      '<div class="qty" role="group" aria-label="' + S.qty + '"><button type="button" data-q="-1" aria-label="' + S.dec + '">-</button><output data-qty>1</output><button type="button" data-q="1" aria-label="' + S.inc + '">+</button></div>' +
      '<button type="button" class="btn oadd__btn" data-add' + (ORDER.open ? '' : ' disabled') + '><span>' + (ORDER.open ? S.add : S.closedNow) + '</span><b data-add-price></b></button></div>';
    box.innerHTML = h; box.hidden = false;
    refreshAddPrice();
  }

  function readSel() {
    var box = $('[data-pm-order]', dlg), sel = {};
    var m = $('input[name=milk]:checked', box); if (m) sel.milk = m.value;
    var t = $('input[name=temp]:checked', box); if (t) sel.temp = t.value;
    var s = $('input[name=shot]:checked', box); sel.shot = s ? 1 : 0;
    sel.addons = $$('input[name=addons]:checked', box).map(function (i) { return i.value; });
    return sel;
  }
  function refreshAddPrice() {
    if (!current || !ORDER || current.soldout) return;
    var q = $('[data-qty]', dlg); if (!q) return;
    var lp = linePrice(current, readSel());
    var el = $('[data-add-price]', dlg); if (el) el.textContent = money(lp.unit * (+q.textContent || 1));
  }

  if (dlg) {
    dlg.addEventListener('change', function (e) { if (e.target.closest('[data-pm-order]')) refreshAddPrice(); });
    dlg.addEventListener('click', function (e) {
      var q = e.target.closest('[data-q]');
      if (q) { var o = $('[data-qty]', dlg), v = Math.min(20, Math.max(1, (+o.textContent) + (+q.getAttribute('data-q')))); o.textContent = v; refreshAddPrice(); return; }
      if (e.target.closest('[data-add]') && current && ORDER && ORDER.open && !current.soldout) {
        var sel = readSel(), lp = linePrice(current, sel), qty = +$('[data-qty]', dlg).textContent;
        var key = current.id + '|' + JSON.stringify(sel);
        var hit = CART.filter(function (c) { return c.key === key; })[0];
        if (hit) hit.qty = Math.min(20, hit.qty + qty);
        else CART.push({ key: key, id: current.id, name: current.name, lang: current.lang, qty: qty, sel: sel, unit: lp.unit, txt: lp.txt });
        var nm = current.name; saveCart(); close(); toast(nm + S.added);
      }
    });
  }

  function buildUI() {
    var bar = document.createElement('div');
    bar.className = 'obar'; bar.id = 'obar';
    bar.innerHTML = '<div class="obar__in"><button type="button" class="obar__call" data-open-call>' + S.waiter + '</button>' +
      '<button type="button" class="obar__cart" data-open-cart><span class="obar__t">' + S.basket + ' <i data-cart-n>0</i></span><b data-cart-total>0 ₺</b></button></div>';
    document.body.appendChild(bar);
    document.body.classList.add('has-obar');

    var note = document.createElement('div');
    note.className = 'otable';
    note.innerHTML = '<div class="wrap otable__in"><b>' + S.table + esc(ORDER.table) + '</b><span>' +
      (ORDER.open ? S.tipOpen : fill(S.tipClosed, { h: esc(ORDER.hours.open) })) + '</span></div>';
    var anchor = $('.mtools') || $('main');
    anchor.parentNode.insertBefore(note, anchor);

    var cart = document.createElement('dialog');
    cart.className = 'sheet'; cart.id = 'cart'; cart.setAttribute('aria-labelledby', 'cart-h');
    cart.innerHTML = '<div class="sheet__in"><button class="pm__x" type="button" data-sheet-close aria-label="' + S.close + '">' + XSVG + '</button>' +
      '<p class="pm__eyebrow">' + S.table + esc(ORDER.table) + '</p><h2 class="sheet__h" id="cart-h">' + S.yourBasket + '</h2>' +
      '<div data-mine></div><div data-bill></div><ul class="clist" data-clist></ul>' +
      '<label class="cnote"><span>' + S.note + '</span><textarea data-cnote rows="2" maxlength="300" placeholder="' + esc(S.notePh) + '"></textarea></label>' +
      '<div class="ctotal"><span>' + S.total + '</span><b data-ctotal>0 ₺</b></div>' +
      '<button type="button" class="btn csend" data-send>' + S.send + '</button>' +
      '<p class="cinfo">' + S.payInfo + '</p><p class="form__msg" data-cmsg role="status" aria-live="polite"></p></div>';
    document.body.appendChild(cart);

    var call = document.createElement('dialog');
    call.className = 'sheet sheet--sm'; call.id = 'callsheet'; call.setAttribute('aria-labelledby', 'call-h');
    call.innerHTML = '<div class="sheet__in"><button class="pm__x" type="button" data-sheet-close aria-label="' + S.close + '">' + XSVG + '</button>' +
      '<p class="pm__eyebrow">' + S.table + esc(ORDER.table) + '</p><h2 class="sheet__h" id="call-h">' + S.callStaff + '</h2>' +
      '<div data-bill></div><div class="callbtns"><button type="button" class="btn" data-call="garson">' + S.callWaiter + '</button><button type="button" class="btn btn--line" data-call="hesap">' + S.askBill + '</button></div></div>';
    document.body.appendChild(call);

    var t = document.createElement('div'); t.className = 'toast'; t.id = 'toast'; t.setAttribute('role', 'status'); t.setAttribute('aria-live', 'polite');
    document.body.appendChild(t);

    [cart, call].forEach(function (d) {
      d.addEventListener('click', function (e) { if (e.target === d || e.target.closest('[data-sheet-close]')) d.close(); });
      d.addEventListener('close', function () { document.body.classList.remove('lock'); });
    });
    document.addEventListener('click', function (e) {
      if (e.target.closest('[data-open-cart]')) { renderCart(); loadBill(); cart.showModal(); document.body.classList.add('lock'); }
      if (e.target.closest('[data-open-call]')) { loadBill(); call.showModal(); document.body.classList.add('lock'); }
      var c = e.target.closest('[data-call]');
      if (c) {
        c.disabled = true;
        api({ a: 'call', type: c.getAttribute('data-call') }, true).then(function (r) {
          c.disabled = false; call.close(); toast(r.ok ? r.message : (r.error || S.failed));
          if (r.ordering === false) exitOrder();
        });
      }
      var cq = e.target.closest('[data-cq]');
      if (cq) {
        var i = +cq.getAttribute('data-i'), d = +cq.getAttribute('data-cq');
        CART[i].qty += d; if (CART[i].qty < 1) CART.splice(i, 1); else CART[i].qty = Math.min(20, CART[i].qty);
        saveCart(); renderCart();
      }
      if (e.target.closest('[data-send]')) send();
    });
    updateBar();
  }

  function loadBill() {
    api({ a: 'bill' }).then(function (r) {
      $$('[data-bill]').forEach(function (el) {
        el.innerHTML = r.ok && r.total > 0 ? '<div class="cbill"><span>' + S.bill + '</span><b>' + money(r.total) + '</b></div>' : '';
      });
    }).catch(function () {});
  }

  function cartTotal() { return CART.reduce(function (s, c) { return s + c.unit * c.qty; }, 0); }
  function updateBar() {
    var n = CART.reduce(function (s, c) { return s + c.qty; }, 0);
    var nEl = $('[data-cart-n]'), tEl = $('[data-cart-total]');
    if (nEl) nEl.textContent = n;
    if (tEl) tEl.textContent = money(cartTotal());
    var bar = $('#obar'); if (bar) bar.classList.toggle('has-items', n > 0);
  }

  function renderCart() {
    var ul = $('[data-clist]');
    ul.innerHTML = CART.length ? CART.map(function (c, i) {
      return '<li><div class="clist__t"><b lang="' + (c.lang === 'en' ? 'en' : 'tr') + '">' + esc(c.name) + '</b>' + (c.txt ? '<small>' + esc(c.txt) + '</small>' : '') + '</div>' +
        '<div class="qty qty--sm"><button type="button" data-cq="-1" data-i="' + i + '" aria-label="' + S.dec + '">-</button><output>' + c.qty + '</output><button type="button" data-cq="1" data-i="' + i + '" aria-label="' + S.inc + '">+</button></div>' +
        '<span class="clist__p">' + money(c.unit * c.qty) + '</span></li>';
    }).join('') : '<li class="clist__empty">' + S.empty + '</li>';
    $('[data-ctotal]').textContent = money(cartTotal());
    $('[data-send]').disabled = !CART.length || !ORDER.open;
    renderMine();
  }

  function renderMine() {
    var box = $('[data-mine]'); if (!box) return;
    var active = MINE.filter(function (o) { return o.status !== 'teslim' && o.status !== 'iptal'; });
    box.innerHTML = active.length ? '<div class="mine"><p class="mine__h">' + S.yourOrders + '</p><ul>' + active.map(function (o) {
      var step = o.status === 'hazirlaniyor' ? 2 : 1;
      return '<li><span>#' + o.id + ' / ' + money(o.total) + '</span><span class="mine__s mine__s--' + step + '">' + esc(o.label || S.received) + '</span></li>';
    }).join('') + '</ul></div>' : '';
  }

  function send() {
    var btn = $('[data-send]'), msg = $('[data-cmsg]');
    if (!CART.length) return;
    btn.disabled = true; msg.className = 'form__msg'; msg.textContent = S.sending;
    var items = CART.map(function (c) { return { id: c.id, qty: c.qty, sel: c.sel }; });
    api({ a: 'order', items: JSON.stringify(items), note: $('[data-cnote]').value }, true).then(function (r) {
      if (r.ok) {
        MINE.unshift({ id: r.order.id, total: r.order.total, status: r.order.status, label: r.order.label, ts: Date.now() });
        sset('local', mineKey(), MINE.slice(0, 20));
        CART = []; saveCart(); $('[data-cnote]').value = '';
        msg.textContent = fill(S.sent, { id: r.order.id });
        renderCart(); loadBill(); poll();
      } else {
        msg.textContent = r.error || S.failed; msg.classList.add('err'); btn.disabled = false;
        if (r.soldout) { applySoldout(Object.keys(DATA).filter(function (id) { return DATA[id].soldout; }).concat([r.soldout])); }
        if (r.ordering === false) exitOrder();
      }
    }).catch(function () { msg.textContent = S.netErr; msg.classList.add('err'); btn.disabled = false; });
  }

  var pollT = null;
  function poll() {
    clearTimeout(pollT);
    var active = MINE.filter(function (o) { return o.status !== 'teslim' && o.status !== 'iptal'; });
    if (!active.length) return;
    api({ a: 'status', ids: active.map(function (o) { return o.id; }).join(',') }).then(function (r) {
      if (r.ok) r.orders.forEach(function (n) {
        MINE.forEach(function (o) {
          if (o.id === +n.id && o.status !== n.status) { o.status = n.status; o.label = n.label; toast(fill(S.orderStatus, { id: o.id }) + n.label); }
        });
      });
      sset('local', mineKey(), MINE); renderMine();
      pollT = setTimeout(poll, 10000);
    }).catch(function () { pollT = setTimeout(poll, 20000); });
  }

  var toastT;
  function toast(t) {
    var el = $('#toast'); if (!el) return;
    el.textContent = t; el.classList.add('on');
    clearTimeout(toastT); toastT = setTimeout(function () { el.classList.remove('on'); }, 3200);
  }

  function exitOrder() {
    ORDER = null; sset('session', 'opia_table', null);
    ['#obar', '.otable', '#cart', '#callsheet'].forEach(function (s) { var el = $(s); if (el) el.remove(); });
    document.body.classList.remove('has-obar');
  }

  function initOrder() {
    if (!$('#menu-root')) return;
    var q = new URLSearchParams(location.search), t = q.get('t');
    if (t) {
      sset('session', 'opia_table', t);
      q.delete('t');
      try { history.replaceState(null, '', location.pathname + (q.toString() ? '?' + q : '') + location.hash); } catch (e) {}
    }
    TOKEN = t || sget('session', 'opia_table', null);
    if (!TOKEN || !/^[A-Za-z0-9]{6,32}$/.test(TOKEN)) return;
    api({ a: 'table' }).then(function (r) {
      if (!r.ok || !r.ordering) { sset('session', 'opia_table', null); return; }
      ORDER = { token: TOKEN, table: r.table.name, options: r.options, open: r.open, hours: r.hours };
      applySoldout(r.soldout || []);
      CART = sget('session', cartKey(), []).filter(function (c) { return DATA[c.id] && !DATA[c.id].soldout; });
      MINE = sget('local', mineKey(), []).filter(function (o) { return Date.now() - (o.ts || 0) < 12 * 3600e3; });
      buildUI(); poll();
    }).catch(function () {});
  }
  initOrder();

  if (location.hash.indexOf('#urun-') === 0) {
    var hid = decodeURIComponent(location.hash.slice(6));
    if (DATA[hid]) setTimeout(function () { open(hid); }, 300);
  }

  /* ================= MENÜ: arama, alerjen filtresi, kategori vurgusu ================= */
  var root = $('#menu-root');
  if (!root) return;

  var search = $('#menu-search');
  var rows = $$('.row', root), sections = $$('[data-section]', root);
  var names = rows.map(function (r) { return r.textContent.toLocaleLowerCase(LOC); });
  var empty = $('#menu-empty');
  var checks = $$('.afilter__list input');
  var counter = $('[data-afilter-n]');

  function apply() {
    var q = search ? search.value.trim().toLocaleLowerCase(LOC) : '';
    var ex = checks.filter(function (c) { return c.checked; }).map(function (c) { return c.value; });
    if (counter) { counter.hidden = !ex.length; counter.textContent = ex.length; }
    var shown = 0;
    rows.forEach(function (r, i) {
      var okQ = !q || names[i].indexOf(q) > -1;
      var al = (r.getAttribute('data-allergens') || '').split(' ');
      var okA = !ex.some(function (x) { return al.indexOf(x) > -1; });
      var ok = okQ && okA; r.hidden = !ok; if (ok) shown++;
    });
    sections.forEach(function (s) { s.hidden = !$$('.row', s).some(function (r) { return !r.hidden; }); });
    if (empty) empty.hidden = shown > 0;
  }
  if (search) search.addEventListener('input', apply);
  checks.forEach(function (c) { c.addEventListener('change', apply); });
  var clr = $('[data-afilter-clear]');
  if (clr) clr.addEventListener('click', function () { checks.forEach(function (c) { c.checked = false; }); apply(); });
  document.addEventListener('click', function (e) {
    var d = $('.afilter[open]');
    if (d && !d.contains(e.target) && window.matchMedia('(min-width:1000px)').matches) d.removeAttribute('open');
  });

  function pad() {
    var h = $('.hdr'), t = $('.mtools');
    var v = (h ? h.offsetHeight : 0) + (t && getComputedStyle(t).position === 'sticky' ? t.offsetHeight : 0) + 12;
    document.documentElement.style.scrollPaddingTop = v + 'px';
  }
  pad(); window.addEventListener('resize', pad);

  var links = $$('.cats a');
  if ('IntersectionObserver' in window && links.length) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (en) {
        if (en.isIntersecting) links.forEach(function (l) { l.classList.toggle('on', l.getAttribute('data-cat') === en.target.id); });
      });
    }, { rootMargin: '-30% 0px -60% 0px' });
    sections.forEach(function (s) { io.observe(s); });
  }
})();
