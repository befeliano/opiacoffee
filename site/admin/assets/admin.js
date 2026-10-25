(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  // mobil menü
  var b = $('.ah__burger'), n = $('#anav');
  if (b) b.addEventListener('click', function () { var o = n.classList.toggle('open'); b.setAttribute('aria-expanded', o); });

  // silme onayı
  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-confirm]');
    if (t && !confirm(t.getAttribute('data-confirm'))) { e.preventDefault(); e.stopImmediatePropagation(); }
  }, true);

  // porsiyon satırları
  var list = $('[data-sv-list]');
  if (list) {
    var idx = list.children.length;
    $('[data-sv-add]').addEventListener('click', function () {
      var row = list.firstElementChild.cloneNode(true);
      $$('input', row).forEach(function (i) { i.value = ''; i.name = i.name.replace(/sv\[\d+\]/, 'sv[' + idx + ']'); });
      idx++; list.appendChild(row);
    });
    list.addEventListener('click', function (e) {
      if (!e.target.closest('[data-sv-del]')) return;
      var row = e.target.closest('.sv');
      if (list.children.length > 1) row.remove(); else $$('input', row).forEach(function (i) { i.value = ''; });
    });
  }

  // birim etiketi
  $$('[data-basis]').forEach(function (r) {
    r.addEventListener('change', function () {
      $$('[data-basis-label]').forEach(function (s) { s.textContent = r.value; });
      $$('[data-basis-label2]').forEach(function (s) { s.textContent = r.value === 'g' ? 'gram' : 'ml'; });
    });
  });

  // fotoğraf: önizleme + tarayıcıda küçültme (WebP, en fazla 1400 px)
  var input = $('[data-img-input]'), prev = $('[data-img-prev]');
  if (input) input.addEventListener('change', function () {
    var f = input.files && input.files[0]; if (!f) return;
    var url = URL.createObjectURL(f), img = new Image();
    img.onload = function () {
      prev.innerHTML = ''; var p = new Image(); p.src = url; prev.appendChild(p);
      var max = 1400, s = Math.min(1, max / Math.max(img.width, img.height));
      if (s === 1 && f.size < 600 * 1024) return;
      var c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      c.toBlob(function (blob) {
        if (!blob || blob.size >= f.size) return;
        try {
          var nf = new File([blob], f.name.replace(/\.\w+$/, '') + '.webp', { type: 'image/webp' });
          var dt = new DataTransfer(); dt.items.add(nf); input.files = dt.files;
        } catch (e) {}
      }, 'image/webp', 0.86);
    };
    img.src = url;
  });
})();
