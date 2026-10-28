/* eslint-disable */
// @ts-nocheck
// QR kod üreteci (bağımlılıksız): bayt kipi, M hata düzeltme, sürüm 1-9. Eski sitenin admin/assets/qr.js dosyasından.
var QR = (function () {
  'use strict';

  var EXP = new Array(512), LOG = new Array(256);
  (function () {
    var x = 1;
    for (var i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 0x100) x ^= 0x11d; }
    for (var j = 255; j < 512; j++) EXP[j] = EXP[j - 255];
  })();
  function mul(a, b) { return a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]; }

  function generator(n) {
    var g = [1];
    for (var i = 0; i < n; i++) {
      var ng = new Array(g.length + 1).fill(0);
      for (var j = 0; j < g.length; j++) { ng[j] ^= g[j]; ng[j + 1] ^= mul(g[j], EXP[i]); }
      g = ng;
    }
    return g;
  }
  function ecc(data, n) {
    var g = generator(n), r = data.concat(new Array(n).fill(0));
    for (var i = 0; i < data.length; i++) {
      var c = r[i];
      if (c) for (var j = 0; j < g.length; j++) r[i + j] ^= mul(g[j], c);
    }
    return r.slice(data.length);
  }

  // sürüm: [blok başına hata kodu, [[blok sayısı, veri kodu], ...]]
  var M = {
    1: [10, [[1, 16]]], 2: [16, [[1, 28]]], 3: [26, [[1, 44]]], 4: [18, [[2, 32]]], 5: [24, [[2, 43]]],
    6: [16, [[4, 27]]], 7: [18, [[4, 31]]], 8: [22, [[2, 38], [2, 39]]], 9: [22, [[3, 36], [2, 37]]],
  };
  var ALIGN = { 1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30], 6: [6, 34], 7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46] };

  function dataCodewords(v) { return M[v][1].reduce(function (s, g) { return s + g[0] * g[1]; }, 0); }

  function utf8(s) { return Array.prototype.slice.call(new TextEncoder().encode(s)); }

  function encode(bytes, v) {
    var cap = dataCodewords(v) * 8, bits = [];
    function put(val, len) { for (var i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1); }
    put(4, 4); put(bytes.length, 8);
    bytes.forEach(function (b) { put(b, 8); });
    put(0, Math.min(4, cap - bits.length));
    while (bits.length % 8) bits.push(0);
    var cw = [];
    for (var i = 0; i < bits.length; i += 8) cw.push(parseInt(bits.slice(i, i + 8).join(''), 2));
    for (var p = 0; cw.length < cap / 8; p++) cw.push(p % 2 ? 0x11 : 0xEC);

    var blocks = [], eccs = [], k = 0, n = M[v][0];
    M[v][1].forEach(function (g) {
      for (var b = 0; b < g[0]; b++) { var d = cw.slice(k, k + g[1]); k += g[1]; blocks.push(d); eccs.push(ecc(d, n)); }
    });
    var out = [], max = Math.max.apply(null, blocks.map(function (b) { return b.length; }));
    for (var i2 = 0; i2 < max; i2++) blocks.forEach(function (b) { if (i2 < b.length) out.push(b[i2]); });
    for (var j = 0; j < n; j++) eccs.forEach(function (e) { out.push(e[j]); });
    return out;
  }

  function build(v, codewords, mask) {
    var size = 17 + 4 * v, m = [], fn = [];
    for (var y = 0; y < size; y++) { m.push(new Array(size).fill(0)); fn.push(new Array(size).fill(false)); }
    function set(x, y, d) { m[y][x] = d ? 1 : 0; fn[y][x] = true; }

    function finder(cx, cy) {
      for (var dy = -4; dy <= 4; dy++) for (var dx = -4; dx <= 4; dx++) {
        var x = cx + dx, y = cy + dy, dist = Math.max(Math.abs(dx), Math.abs(dy));
        if (x >= 0 && x < size && y >= 0 && y < size) set(x, y, dist !== 2 && dist !== 4);
      }
    }
    finder(3, 3); finder(size - 4, 3); finder(3, size - 4);
    for (var i = 8; i < size - 8; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
    var al = ALIGN[v];
    al.forEach(function (ay) {
      al.forEach(function (ax) {
        if ((ax === 6 && ay === 6) || (ax === 6 && ay === al[al.length - 1]) || (ax === al[al.length - 1] && ay === 6)) return;
        for (var dy = -2; dy <= 2; dy++) for (var dx = -2; dx <= 2; dx++) set(ax + dx, ay + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
      });
    });

    function format(msk) {
      var data = (0 << 3) | msk, rem = data;
      for (var i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
      var bits = ((data << 10) | rem) ^ 0x5412, b = function (i) { return (bits >>> i) & 1; };
      for (i = 0; i <= 5; i++) set(8, i, b(i));
      set(8, 7, b(6)); set(8, 8, b(7)); set(7, 8, b(8));
      for (i = 9; i < 15; i++) set(14 - i, 8, b(i));
      for (i = 0; i < 8; i++) set(size - 1 - i, 8, b(i));
      for (i = 8; i < 15; i++) set(8, size - 15 + i, b(i));
      set(8, size - 8, 1);
    }
    format(0);
    if (v >= 7) {
      var rem = v;
      for (var r = 0; r < 12; r++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1F25);
      var vb = (v << 12) | rem;
      for (var q = 0; q < 18; q++) { var c = (vb >>> q) & 1, a = size - 11 + (q % 3), bb = Math.floor(q / 3); set(a, bb, c); set(bb, a, c); }
    }

    var bit = 0, total = codewords.length * 8;
    for (var right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (var vert = 0; vert < size; vert++) {
        for (var j = 0; j < 2; j++) {
          var x = right - j, up = ((right + 1) & 2) === 0, yy = up ? size - 1 - vert : vert;
          if (!fn[yy][x]) {
            m[yy][x] = bit < total ? (codewords[bit >>> 3] >>> (7 - (bit & 7))) & 1 : 0;
            bit++;
          }
        }
      }
    }

    var masks = [
      function (x, y) { return (x + y) % 2 === 0; }, function (x, y) { return y % 2 === 0; },
      function (x) { return x % 3 === 0; }, function (x, y) { return (x + y) % 3 === 0; },
      function (x, y) { return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0; },
      function (x, y) { return (x * y) % 2 + (x * y) % 3 === 0; },
      function (x, y) { return ((x * y) % 2 + (x * y) % 3) % 2 === 0; },
      function (x, y) { return ((x + y) % 2 + (x * y) % 3) % 2 === 0; },
    ];
    for (var y2 = 0; y2 < size; y2++) for (var x2 = 0; x2 < size; x2++) if (!fn[y2][x2] && masks[mask](x2, y2)) m[y2][x2] ^= 1;
    format(mask);
    return m;
  }

  function penalty(m) {
    var n = m.length, p = 0, dark = 0, x, y;
    function runs(get) {
      for (var a = 0; a < n; a++) {
        var len = 1;
        for (var b = 1; b < n; b++) {
          if (get(a, b) === get(a, b - 1)) { len++; if (len === 5) p += 3; else if (len > 5) p++; }
          else len = 1;
        }
      }
    }
    runs(function (a, b) { return m[a][b]; });
    runs(function (a, b) { return m[b][a]; });
    for (y = 0; y < n - 1; y++) for (x = 0; x < n - 1; x++) {
      var c = m[y][x];
      if (c === m[y][x + 1] && c === m[y + 1][x] && c === m[y + 1][x + 1]) p += 3;
    }
    var pat1 = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0], pat2 = [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1];
    function finders(get) {
      for (var a = 0; a < n; a++) for (var b = 0; b <= n - 11; b++) {
        var ok1 = true, ok2 = true;
        for (var k = 0; k < 11; k++) { var v = get(a, b + k); if (v !== pat1[k]) ok1 = false; if (v !== pat2[k]) ok2 = false; }
        if (ok1) p += 40; if (ok2) p += 40;
      }
    }
    finders(function (a, b) { return m[a][b]; });
    finders(function (a, b) { return m[b][a]; });
    for (y = 0; y < n; y++) for (x = 0; x < n; x++) dark += m[y][x];
    p += Math.floor(Math.abs(dark * 20 / (n * n) - 10)) * 10;
    return p;
  }

  function matrix(text, forceMask) {
    var bytes = utf8(text), v = 1;
    while (v <= 9 && Math.floor((dataCodewords(v) * 8 - 12) / 8) < bytes.length) v++;
    if (v > 9) throw new Error('QR: metin çok uzun');
    var cw = encode(bytes, v);
    if (forceMask != null) return build(v, cw, forceMask);
    var best = null, bestP = Infinity;
    for (var k = 0; k < 8; k++) { var mm = build(v, cw, k), pp = penalty(mm); if (pp < bestP) { bestP = pp; best = mm; } }
    return best;
  }

  function svg(text, margin) {
    var m = matrix(text), n = m.length, q = margin == null ? 2 : margin, d = '';
    for (var y = 0; y < n; y++) for (var x = 0; x < n; x++) if (m[y][x]) d += 'M' + (x + q) + ' ' + (y + q) + 'h1v1h-1z';
    var s = n + q * 2;
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + s + ' ' + s + '" shape-rendering="crispEdges"><rect width="' + s + '" height="' + s + '" fill="#fff"/><path d="' + d + '" fill="#0a0a0a"/></svg>';
  }

  return { matrix: matrix, svg: svg };
})();
export default QR as { svg(text: string, margin?: number): string };
