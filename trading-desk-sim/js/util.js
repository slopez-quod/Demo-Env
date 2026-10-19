/* Small helpers: seeded RNG, formatting, DOM. */
window.DS = window.DS || {};

DS.makeRng = function (seed) {
  var s = seed >>> 0;
  function next() {
    s = (s + 0x6D2B79F5) >>> 0;
    var t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  var r = {
    next: next,
    range: function (a, b) { return a + (b - a) * next(); },
    int: function (a, b) { return Math.floor(a + (b - a + 1) * next()); },
    pick: function (arr) { return arr[Math.floor(next() * arr.length)]; },
    chance: function (p) { return next() < p; },
    gauss: function () {
      var u = 1 - next(), v = next();
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    },
    shuffle: function (arr) {
      var a = arr.slice();
      for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(next() * (i + 1)); var x = a[i]; a[i] = a[j]; a[j] = x; }
      return a;
    }
  };
  return r;
};

DS.clamp = function (x, a, b) { return Math.max(a, Math.min(b, x)); };
DS.round = function (x, d) { var m = Math.pow(10, d || 0); return Math.round(x * m) / m; };
DS.lot = function (x) { return Math.max(0, Math.round(x / 100) * 100); };

DS.DAY_SECS = 23400; // 9:30 to 16:00
DS.STEP = 10;        // seconds per engine step

DS.clock = function (t) {
  var secs = 9.5 * 3600 + t;
  var h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60), s = Math.floor(secs % 60);
  return h + ':' + (m < 10 ? '0' : '') + m + (s !== undefined ? ':' + (s < 10 ? '0' : '') + s : '');
};
DS.hhmm = function (t) {
  var secs = 9.5 * 3600 + t;
  var h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60);
  return h + ':' + (m < 10 ? '0' : '') + m;
};
DS.tOf = function (hhmm) { // '10:15' -> seconds since 9:30
  var p = hhmm.split(':');
  return (parseInt(p[0], 10) * 3600 + parseInt(p[1], 10) * 60) - 9.5 * 3600;
};

DS.fmtPx = function (p) { return p == null || isNaN(p) ? '-' : p.toFixed(2); };
DS.fmtQty = function (q) {
  if (q == null || isNaN(q)) return '-';
  var a = Math.abs(q);
  if (a >= 1e6) return (q / 1e6).toFixed(a >= 1e7 ? 1 : 2) + 'M';
  if (a >= 1e3) return (q / 1e3).toFixed(a >= 1e5 ? 0 : 1) + 'k';
  return String(Math.round(q));
};
DS.fmtInt = function (q) { return Math.round(q).toLocaleString('en-US'); };
DS.fmtUsd = function (v, compact) {
  if (v == null || isNaN(v)) return '-';
  var a = Math.abs(v), s = v < 0 ? '-' : '';
  if (compact !== false) {
    if (a >= 1e9) return s + '$' + (a / 1e9).toFixed(2) + 'B';
    if (a >= 1e6) return s + '$' + (a / 1e6).toFixed(a >= 1e8 ? 0 : 1) + 'M';
    if (a >= 1e3) return s + '$' + (a / 1e3).toFixed(0) + 'k';
  }
  return s + '$' + Math.round(a).toLocaleString('en-US');
};
DS.fmtPct = function (x, d) { if (x == null || isNaN(x)) return '-'; return (x >= 0 ? '+' : '') + (x * 100).toFixed(d == null ? 2 : d) + '%'; };
DS.fmtBps = function (x, d) { if (x == null || isNaN(x)) return '-'; return (x >= 0 ? '+' : '') + x.toFixed(d == null ? 1 : d); };
DS.sideTxt = function (side) { return side > 0 ? 'BUY' : 'SELL'; };
DS.esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };

DS.$ = function (sel, root) { return (root || document).querySelector(sel); };
DS.$$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

// Wrap glossary terms found in text with hoverable spans. Only the first occurrence of each term, and
// only in text outside tags and outside spans already wrapped.
DS.gloss = function (html) {
  var terms = Object.keys(DS.GLOSSARY).sort(function (a, b) { return b.length - a.length; });
  terms.forEach(function (term) {
    var re = new RegExp('(^|[^\\w%-])(' + term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')(?![\\w])');
    var parts = html.split(/(<[^>]+>)/), inG = 0, done = false;
    for (var i = 0; i < parts.length && !done; i++) {
      var x = parts[i];
      if (x.charAt(0) === '<') {
        if (/^<span class="g"/.test(x)) inG++;
        else if (inG && x === '</span>') inG--;
        continue;
      }
      if (inG || !re.test(x)) continue;
      parts[i] = x.replace(re, function (m, pre, word) { return pre + '<span class="g" data-g="' + term + '">' + word + '</span>'; });
      done = true;
    }
    html = parts.join('');
  });
  return html;
};

DS.store = {
  get: function (k, d) { try { var v = localStorage.getItem('ds.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set: function (k, v) { try { localStorage.setItem('ds.' + k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } }
};
