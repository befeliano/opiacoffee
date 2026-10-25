/* Çerez onayı - KVKK / GDPR uyumlu: onay verilmeden istatistik yüklenmez, reddetmek kabul etmek kadar kolaydır. */
(function () {
  'use strict';
  var KEY = 'opia_consent', VERSION = 1;
  var banner = document.getElementById('cc');
  var dlg = document.getElementById('ccp');
  var state = null;

  function read() {
    try { var v = JSON.parse(localStorage.getItem(KEY)); if (v && v.v === VERSION) return v; } catch (e) {}
    var m = document.cookie.match(/(?:^|; )opia_consent=(\d)(\d)/);
    return m ? { v: VERSION, analytics: m[1] === '1', thirdparty: m[2] === '1' } : null;
  }

  function write(c) {
    c.v = VERSION; c.ts = Date.now();
    try { localStorage.setItem(KEY, JSON.stringify(c)); } catch (e) {}
    document.cookie = 'opia_consent=' + (c.analytics ? 1 : 0) + (c.thirdparty ? 1 : 0) +
      '; max-age=31536000; path=/; SameSite=Lax' + (location.protocol === 'https:' ? '; Secure' : '');
    state = c;
    apply(c);
    window.dispatchEvent(new CustomEvent('opia:consent', { detail: c }));
  }

  function clearAnalyticsCookies() {
    document.cookie.split('; ').forEach(function (k) {
      var n = k.split('=')[0];
      if (n === '_ga' || n.indexOf('_ga_') === 0 || n === '_gid') {
        document.cookie = n + '=; max-age=0; path=/';
        document.cookie = n + '=; max-age=0; path=/; domain=' + location.hostname;
      }
    });
  }

  var gaLoaded = false;
  function apply(c) {
    var id = document.body.getAttribute('data-ga');
    if (c.analytics && id && !gaLoaded) {
      gaLoaded = true;
      window.dataLayer = window.dataLayer || [];
      window.gtag = function () { window.dataLayer.push(arguments); };
      window.gtag('js', new Date());
      window.gtag('config', id, { anonymize_ip: true });
      var s = document.createElement('script');
      s.async = true; s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(id);
      document.head.appendChild(s);
    }
    if (!c.analytics) clearAnalyticsCookies();
  }

  function showBanner() { if (banner) { banner.hidden = false; } }
  function hideBanner() { if (banner) { banner.hidden = true; } }

  function openPrefs() {
    if (!dlg || !dlg.showModal) return;
    var s = state || { analytics: false, thirdparty: false };
    document.getElementById('cc-an').checked = !!s.analytics;
    document.getElementById('cc-tp').checked = !!s.thirdparty;
    if (!dlg.open) dlg.showModal();
  }

  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-cc],[data-ccp],[data-consent-open]');
    if (!t) return;
    if (t.hasAttribute('data-consent-open')) { openPrefs(); return; }
    var a = t.getAttribute('data-cc');
    if (a === 'accept') { write({ analytics: true, thirdparty: true }); hideBanner(); }
    else if (a === 'reject') { write({ analytics: false, thirdparty: false }); hideBanner(); }
    else if (a === 'prefs') { openPrefs(); }
    var p = t.getAttribute('data-ccp');
    if (p === 'save') {
      write({ analytics: document.getElementById('cc-an').checked, thirdparty: document.getElementById('cc-tp').checked });
      dlg.close(); hideBanner();
    } else if (p === 'reject') {
      write({ analytics: false, thirdparty: false }); dlg.close(); hideBanner();
    }
  });
  if (dlg) dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });

  window.OpiaConsent = { get: function () { return state; }, open: openPrefs };

  state = read();
  if (state) apply(state);
  else setTimeout(showBanner, 900);
})();
