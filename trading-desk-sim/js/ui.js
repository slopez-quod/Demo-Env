/* Rendering and interaction. Panels with clickable rows update in place (keyed) so clicks survive ticks. */
window.DS = window.DS || {};

(function () {
  var $ = DS.$, $$ = DS.$$, esc = DS.esc, F = DS;
  var sig = {};
  var tk = { type: 'VWAP', qty: '', pct: '', lim: '', end: '16:00', urg: 'Medium', forId: null, msg: null };
  var colors = {};

  function S() { return DS.S; }
  function cssv(n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); }
  function readColors() { ['--ink', '--mute', '--faint', '--line', '--accent', '--up', '--dn', '--info', '--you', '--panel', '--panel2', '--warn'].forEach(function (k) { colors[k] = cssv(k); }); }
  function cls(x) { return x >= 0 ? 'up' : 'dn'; }

  function keyed(box, items, key, create, update) {
    var have = {};
    Array.prototype.forEach.call(box.children, function (el) { if (el.dataset.k) have[el.dataset.k] = el; });
    var prev = null;
    items.forEach(function (it) {
      var k = key(it), el = have[k];
      if (!el) { el = create(it); el.dataset.k = k; }
      delete have[k];
      update(el, it);
      var want = prev ? prev.nextSibling : box.firstChild;
      if (el !== want) box.insertBefore(el, want);
      prev = el;
    });
    Object.keys(have).forEach(function (k) { have[k].remove(); });
  }

  DS.UI = {
    tk: tk,
    init: function () {
      readColors();
      try { window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () { readColors(); }); } catch (e) { /* older browsers */ }
      // Speed + play
      $('#btnPlay').onclick = function () { DS.App.toggle(); };
      $$('.spd').forEach(function (b) { b.onclick = function () { $$('.spd').forEach(function (x) { x.classList.remove('on'); }); b.classList.add('on'); DS.App.speed = +b.dataset.spd; }; });
      $('#autoPause').onchange = function (e) { S().autoPause = e.target.checked; };
      $$('[data-open]').forEach(function (b) { b.onclick = function () { DS.UI.drawer(b.dataset.open); }; });
      $('#btnMenu').onclick = function () { DS.UI.menu(); };
      $$('.tab').forEach(function (b) { b.onclick = function () { DS.UI.tab(b.dataset.tab); }; });
      $$('.mnav button').forEach(function (b) { b.onclick = function () { DS.UI.view(b.dataset.view); }; });
      document.addEventListener('keydown', function (e) {
        if (e.target.matches('input,select,textarea')) return;
        if (e.code === 'Space') { e.preventDefault(); if ($('#ovDecision').hidden && $('#ovMorning').hidden && $('#ovHome').hidden && $('#ovPretrade').hidden) DS.App.toggle(); }
        if (e.key === 'Escape') { DS.UI.closeDrawer(); if (!$('#ovDecode').hidden) $('#ovDecode').hidden = true; if (!$('#ovMenu').hidden) $('#ovMenu').hidden = true; }
      });
      // Glossary tooltips
      document.addEventListener('mouseover', function (e) {
        var g = e.target.closest && e.target.closest('.g');
        var tip = $('#gtip');
        if (!g) { tip.hidden = true; return; }
        tip.innerHTML = '<b>' + esc(g.dataset.g) + '</b>' + esc(DS.GLOSSARY[g.dataset.g] || '');
        tip.hidden = false;
        var r = g.getBoundingClientRect();
        tip.style.left = Math.min(window.innerWidth - 330, Math.max(8, r.left)) + 'px';
        tip.style.top = (r.bottom + 6 + 120 > window.innerHeight ? r.top - tip.offsetHeight - 6 : r.bottom + 6) + 'px';
      });
      // Delegated clicks
      $('#blotter').addEventListener('click', function (e) {
        var row = e.target.closest('.ord'); if (!row) return;
        if (e.target.matches('input[type=checkbox]')) { var set = S().ptSel; if (e.target.checked) set[row.dataset.k] = 1; else delete set[row.dataset.k]; DS.UI.renderTicket(true); return; }
        DS.UI.selectOrder(row.dataset.k);
      });
      $('#wl').addEventListener('click', function (e) { var tr = e.target.closest('tr[data-k]'); if (tr) DS.UI.selectStock(tr.dataset.k); });
      $('#tab-chat').addEventListener('click', function (e) {
        var b = e.target.closest('button[data-ch]'); if (!b) return;
        DS.Desk.reply(S(), b.dataset.m, +b.dataset.ch);
        DS.App.maybeResume();
        DS.UI.render(true);
      });
      ['#tab-news', '#tab-notes'].forEach(function (id) {
        $(id).addEventListener('click', function (e) { var b = e.target.closest('button[data-dec]'); if (b) DS.UI.decode(b.dataset.dec); var l = e.target.closest('[data-load]'); if (l) DS.UI.selectStock(l.dataset.load); });
      });
      $('#tab-coach').addEventListener('click', function (e) { var l = e.target.closest('[data-load]'); if (l) DS.UI.selectStock(l.dataset.load); });
      $('#ticket').addEventListener('click', DS.UI.ticketClick);
      $('#ticket').addEventListener('input', DS.UI.ticketInput);
      $('#ticket').addEventListener('change', DS.UI.ticketInput);
      $('#basketBox').addEventListener('click', DS.UI.basketClick);
      window.addEventListener('resize', function () { DS.UI.render(true); });
    },

    view: function (v) { $('#app').dataset.view = v; $$('.mnav button').forEach(function (b) { b.classList.toggle('on', b.dataset.view === v); }); DS.UI.render(true); },
    tab: function (t) {
      $$('.tab').forEach(function (b) { b.classList.toggle('on', b.dataset.tab === t); b.classList.remove('flash'); });
      ['chat', 'news', 'notes', 'coach'].forEach(function (k) { $('#tab-' + k).hidden = k !== t; });
      S().curTab = t;
      if (S().unread[t] != null) S().unread[t] = 0;
      DS.UI.render(true);
    },
    flash: function (t) {
      var s = S(); if (!s || s.curTab === t) return;
      var b = $('.tab[data-tab="' + t + '"]'); if (!b) return;
      b.classList.remove('flash'); void b.offsetWidth; b.classList.add('flash');
    },
    toast: function (m) {
      var t = $('#toast'); t.textContent = m; t.hidden = false;
      clearTimeout(DS.UI._tt); DS.UI._tt = setTimeout(function () { t.hidden = true; }, 2600);
    },

    selectOrder: function (id) {
      var s = S(), p = DS.Orders.get(s, id); if (!p) return;
      s.selOrder = id; s.selected = p.tkr;
      DS.UI.renderTicket(true);
      DS.UI.render(true);
      if (window.innerWidth <= 900) DS.UI.view('stock');
    },
    selectStock: function (tkr) {
      var s = S(); s.selected = tkr;
      var p = s.orders.filter(function (o) { return o.tkr === tkr && o.status !== 'done' && o.status !== 'cxl'; })[0];
      if (p) s.selOrder = p.id;
      DS.UI.renderTicket(true);
      DS.UI.render(true);
      if (window.innerWidth <= 900) DS.UI.view('stock');
    },

    render: function (force) {
      var s = S(); if (!s) return;
      DS.UI.renderTop(s);
      var v = $('#app').dataset.view, narrow = window.innerWidth <= 900;
      if (!narrow || v === 'orders') { if (s.basket) DS.UI.renderBasket(s); DS.UI.renderBlotter(s); }
      if (!narrow || v === 'stock') { DS.UI.renderStock(s); DS.UI.renderKids(s); DS.UI.updateEst(s); }
      if (!narrow || v === 'feed') DS.UI.renderFeed(s, force);
      if (!narrow || v === 'market') DS.UI.renderWatch(s);
      $('#bChat').textContent = s.unread.chat && s.curTab !== 'chat' ? s.unread.chat : '';
      $('#bNews').textContent = s.unread.news && s.curTab !== 'news' ? s.unread.news : '';
      $('#bCoach').textContent = s.unread.coach && s.curTab !== 'coach' ? s.unread.coach : '';
      if (s.pendingDecision && $('#ovDecision').hidden) DS.UI.decision(s.pendingDecision);
    },

    renderTop: function (s) {
      $('#clock').textContent = s.phase === 'pre' ? '08:45' : s.phase === 'closed' ? '16:00' : DS.clock(s.t);
      $('#phase').textContent = s.phase === 'pre' ? 'PRE-MARKET' : s.phase === 'closed' ? 'CLOSED' : s.t >= DS.tOf('15:50') ? 'CLOSING AUCTION' : s.running ? 'LIVE' : 'PAUSED' + (s.pauseWhy ? ' · ' + s.pauseWhy.toUpperCase() : '');
      var pb = $('#btnPlay'); pb.textContent = s.running ? '❚❚' : '▶'; pb.classList.toggle('running', !!s.running);
      if (!s.mkt) return;
      var M = s.mkt, lvl = s.phase === 'pre' ? M.prev * Math.exp(M.gap) : M.lvl;
      var sp = lvl / M.prev - 1, dy = s.phase === 'pre' ? s.rates.gap : (s.rates.y - s.rates.prev) * 100;
      var oil = s.phase === 'pre' ? s.oil.prev * Math.exp(s.oil.gap) : s.oil.px;
      var items = [
        ['SPX', lvl.toFixed(2), sp, DS.fmtPct(sp)],
        ['ES', (lvl * 1.0009).toFixed(2), sp, DS.fmtPct(sp)],
        ['US10Y', (s.phase === 'pre' ? s.rates.prev + s.rates.gap / 100 : s.rates.y).toFixed(3) + '%', dy, (dy >= 0 ? '+' : '') + dy.toFixed(1) + 'bp'],
        ['VIX', (s.phase === 'pre' ? M.vixBase : M.vix).toFixed(2), -(M.vix - M.vixBase), ''],
        ['WTI', oil.toFixed(2), oil / s.oil.prev - 1, DS.fmtPct(oil / s.oil.prev - 1)]
      ];
      if (s.basket) items.push(['Futures', (s.fut.pos > 0 ? '+' : '') + s.fut.pos + ' ES', DS.Orders.futPnl(s), DS.fmtUsd(DS.Orders.futPnl(s))]);
      var dd = s.score.items.filter(function (x) { return x.cat !== 'color' && x.cat !== 'client'; });
      var good = dd.filter(function (x) { return x.s >= 0.8; }).length;
      items.push(['Calls', good + '/' + dd.length, 0, '']);
      items.push(['Client rel.', Math.round(s.score.rel), s.score.rel - 60, '']);
      $('#mstrip').innerHTML = items.map(function (x) { return '<div><span>' + x[0] + '</span>' + x[1] + (x[3] ? ' <em class="' + cls(x[2]) + '" style="font-style:normal">' + x[3] + '</em>' : '') + '</div>'; }).join('');
    },

    // ---------- Blotter ----------
    renderBlotter: function (s) {
      var box = $('#blotter');
      var list = s.orders.slice();
      $('#leftTitle').textContent = s.basket ? 'Basket · ' + s.basket.orders.length + ' names' : 'Client orders';
      $('#leftSub').textContent = s.basket ? (s.basket.mode === 'principal' ? 'Principal @ ' + s.basket.bps + 'bps' : 'Agency') : list.length + ' orders';
      if (!list.length) {
        if (!box.querySelector('.empty')) box.innerHTML = '<div class="empty">' + (s.phase === 'pre' ? 'Orders arrive once the market opens. Read the morning note first.' : 'No client orders yet. Watch the chat: clients send orders through the day.') + '</div>';
        return;
      }
      var e = box.querySelector('.empty'); if (e) e.remove();
      list.sort(function (a, b) { var r = { new: 0, working: 1, part: 2, unfilled: 2, done: 3, cxl: 4 }; return (r[a.status] - r[b.status]) || (b.recvT - a.recvT); });
      if (s.basket) list.sort(function (a, b) { return (a.side - b.side) || (b.qty / s.stocks[b.tkr].adv - a.qty / s.stocks[a.tkr].adv); });
      keyed(box, list, function (p) { return p.id; }, function (p) {
        var d = document.createElement('div');
        d.className = 'ord' + (s.basket ? ' pt' : '');
        d.innerHTML = (s.basket ? '<input type="checkbox" aria-label="Select ' + p.tkr + '">' : '') +
          '<div class="r1"><span class="side ' + (p.side > 0 ? 'b' : 's') + '">' + DS.sideTxt(p.side) + '</span><span class="tk">' + p.tkr + '</span><span class="q"></span><span class="st"></span></div>' +
          (s.basket ? '' : '<div class="cl"></div>') + '<div class="prog"><i></i><b></b></div><div class="r3"></div>';
        return d;
      }, function (el, p) {
        var st = s.stocks[p.tkr];
        el.classList.toggle('sel', s.selOrder === p.id);
        var avail = DS.Orders.available(p), wk = DS.Orders.working(p);
        el.querySelector('.q').textContent = DS.fmtQty(p.qty) + ' · ' + (p.qty / st.adv * 100).toFixed(1) + '% ADV';
        var stx = el.querySelector('.st');
        var label = p.status === 'working' && !wk && p.filled < p.qty ? 'idle' : p.status;
        stx.textContent = label; stx.className = 'st ' + label;
        var cl = el.querySelector('.cl');
        if (cl) cl.textContent = p.client.name + ' · ' + (p.bench === 'ARRIVAL' ? 'Arrival' : p.bench === 'CLOSE' ? 'Close' : 'VWAP') + (p.maxPct ? ' · max ' + Math.round(p.maxPct * 100) + '%' : '') + (p.limit ? ' · lmt ' + p.limit.toFixed(2) : '') + ' · ' + p.urgency;
        el.querySelector('.prog i').style.width = (p.filled / p.qty * 100) + '%';
        var exp = p.bench === 'VWAP' || p.bench === 'CLOSE' ? (DS.curveAt(s.t) - DS.curveAt(p.recvT)) / Math.max(1e-6, 1 - DS.curveAt(p.recvT)) : null;
        var mk = el.querySelector('.prog b');
        if (exp != null && p.status !== 'done') { mk.hidden = false; mk.style.left = DS.clamp(exp * 100, 0, 100) + '%'; } else mk.hidden = true;
        var avg = DS.Orders.avgPx(p);
        var vsA = avg && p.arrival ? p.side * (p.arrival - avg) / p.arrival * 1e4 : null;
        el.querySelector('.r3').innerHTML = '<em>' + Math.round(p.filled / p.qty * 100) + '%</em><em>avg ' + (avg ? avg.toFixed(2) : '-') + '</em><em class="' + (vsA == null ? '' : cls(vsA)) + '">' + (vsA == null ? '' : DS.fmtBps(vsA) + 'bp vs arr') + '</em>' + (avail && p.status !== 'done' && p.status !== 'cxl' && s.phase === 'open' ? '<em>' + DS.fmtQty(avail) + ' unalloc</em>' : '');
        var cb = el.querySelector('input'); if (cb) cb.checked = !!s.ptSel[p.id];
      });
    },

    // ---------- Basket (program trading) ----------
    renderBasket: function (s) {
      var box = $('#basketBox'); box.hidden = false;
      var st = DS.PT.stats(s), B = s.basket;
      var pnl = B.mode === 'principal' ? DS.PT.pnl(s) : null;
      var res = DS.PT.sectorResidual(s), maxR = 1;
      Object.keys(res).forEach(function (k) { maxR = Math.max(maxR, Math.abs(res[k])); });
      var hedgeN = Math.round(-st.betaNet / (s.mkt.lvl * 50));
      if (!box.firstChild) {
        box.innerHTML = '<div class="bsum"></div><div class="bsel"><span class="muted">Select:</span><button class="btn sm" data-sel="all">All</button><button class="btn sm" data-sel="Liquid">Liquid</button><button class="btn sm" data-sel="Mid">Mid</button><button class="btn sm" data-sel="Illiquid">Illiquid</button><button class="btn sm" data-sel="buy">Buys</button><button class="btn sm" data-sel="sell">Sells</button><button class="btn sm" data-sel="none">None</button></div>';
      }
      $('.bsum', box).innerHTML =
        '<div class="pbar"><span class="up">BUY</span><div class="prog"><i style="width:' + (st.buyPct * 100) + '%"></i></div><span>' + Math.round(st.buyPct * 100) + '%</span></div>' +
        '<div class="pbar s"><span class="dn">SELL</span><div class="prog"><i style="width:' + (st.sellPct * 100) + '%"></i></div><span>' + Math.round(st.sellPct * 100) + '%</span></div>' +
        '<div class="row"><span>Net executed</span><b class="' + cls(st.netDone) + '">' + DS.fmtUsd(st.netDone) + '</b></div>' +
        '<div class="row"><span>Beta-adj exposure (incl. futures)</span><b class="' + (Math.abs(st.betaNet) > B.gross * 0.03 ? 'dn' : '') + '">' + DS.fmtUsd(st.betaNet) + '</b></div>' +
        '<div class="row"><span>Cost vs arrival</span><b class="' + cls(-st.costBps) + '">' + DS.fmtBps(st.costBps) + ' bps</b></div>' +
        (pnl != null ? '<div class="row"><span>Principal P&amp;L (incl. ' + B.bps + 'bp)</span><b class="' + cls(pnl) + '">' + DS.fmtUsd(pnl) + '</b></div>' : '') +
        '<div class="secres">' + Object.keys(res).map(function (k) { var w = Math.abs(res[k]) / maxR * 50; return '<div><span>' + DS.SECTORS[k].short + '</span><span class="zb"><i style="' + (res[k] >= 0 ? 'left:50%;' : 'right:50%;') + 'width:' + w + '%;background:' + (res[k] >= 0 ? 'var(--up)' : 'var(--dn)') + '"></i></span><span>' + DS.fmtUsd(res[k]) + '</span></div>'; }).join('') + '</div>' +
        '<div class="futs"><span class="muted">ES hedge: ' + s.fut.pos + '</span><button class="btn sm buy" data-fut="1">Buy 1</button><button class="btn sm sell" data-fut="-1">Sell 1</button><button class="btn sm" data-fut="hedge" title="Trade the futures needed to flatten beta exposure">Hedge to flat (' + (hedgeN > 0 ? '+' : '') + hedgeN + ')</button></div>';
    },
    basketClick: function (e) {
      var s = S();
      var f = e.target.closest('[data-fut]');
      if (f) {
        if (s.phase !== 'open') return DS.UI.toast('Futures trade when the market is open.');
        var n = f.dataset.fut === 'hedge' ? Math.round(-DS.PT.stats(s).betaNet / (s.mkt.lvl * 50)) : +f.dataset.fut;
        if (n) { DS.Orders.tradeFut(s, n); DS.UI.toast((n > 0 ? 'Bought ' : 'Sold ') + Math.abs(n) + ' ES @ ' + DS.Orders.futPx(s).toFixed(2)); }
        DS.UI.render(true); return;
      }
      var b = e.target.closest('[data-sel]'); if (!b) return;
      var k = b.dataset.sel; s.ptSel = {};
      DS.PT.parents(s).forEach(function (p) {
        if (p.status === 'done' || p.status === 'cxl') return;
        var ok = k === 'all' || (k === 'buy' && p.side > 0) || (k === 'sell' && p.side < 0) || DS.PT.tier(s, p) === k;
        if (k !== 'none' && ok) s.ptSel[p.id] = 1;
      });
      DS.UI.renderTicket(true); DS.UI.render(true);
    },

    // ---------- Stock panel ----------
    renderStock: function (s) {
      var tkr = s.selected || s.tkrs[0], st = s.stocks[tkr];
      if (!st) return;
      var chg = s.phase === 'pre' ? Math.exp(st.gap + st.beta * s.mkt.gap) - 1 : DS.Market.chg(st);
      var px = s.phase === 'pre' ? st.prevClose * (1 + chg) : st.mid;
      var vw = DS.Market.vwap(st);
      var sec = s.sectors[st.sector];
      var sprB = (st.ask - st.bid) / st.mid * 1e4;
      $('#sthead').innerHTML = '<span class="tk">' + tkr + '</span><span class="nm">' + esc(st.name) + ' · ' + DS.SECTORS[st.sector].name + '</span>' +
        '<span class="px">' + px.toFixed(2) + '</span><span class="' + cls(chg) + '" style="font-family:var(--f-num)">' + DS.fmtPct(chg) + (s.phase === 'pre' ? ' indicated' : '') + '</span>' +
        (s.phase !== 'pre' ? '<span class="kv">Bid <b>' + st.bid.toFixed(2) + '</b> Ask <b>' + st.ask.toFixed(2) + '</b> (' + sprB.toFixed(1) + 'bp)</span><span class="kv">VWAP <b>' + vw.toFixed(2) + '</b></span><span class="kv">Vol <b>' + DS.fmtQty(st.cumV) + '</b> · ' + DS.Market.relVol(s, st).toFixed(1) + 'x</span><span class="kv">vs ' + DS.SECTORS[st.sector].short + ' <b class="' + cls(chg - sec.perf) + '">' + DS.fmtPct(chg - sec.perf) + '</b></span>' : '') +
        '<span class="kv">ADV <b>' + DS.fmtQty(st.adv) + '</b> · Vol <b>' + Math.round(st.vol * 100) + '%</b> · β <b>' + st.beta.toFixed(2) + '</b></span>';
      DS.UI.drawChart(s, st);
      if (s.phase === 'pre') { $('#book').innerHTML = '<div class="empty">Book opens at 9:30</div>'; $('#tape').innerHTML = ''; return; }
      var lv = DS.Market.book(s, st), mx = 1;
      lv.forEach(function (l) { mx = Math.max(mx, l.bq, l.aq); });
      $('#book').innerHTML = lv.map(function (l) {
        return '<div class="brow"><i class="l" style="width:' + (l.bq / mx * 50) + '%"></i><i class="r" style="width:' + (l.aq / mx * 50) + '%"></i><span class="bq">' + DS.fmtQty(l.bq) + '</span><span class="bp">' + l.bp.toFixed(2) + '</span><span class="ap2">' + l.ap.toFixed(2) + '</span><span class="aq">' + DS.fmtQty(l.aq) + '</span></div>';
      }).join('');
      var bs = lv.slice(0, 3).reduce(function (a, l) { return a + l.bq; }, 0), as = lv.slice(0, 3).reduce(function (a, l) { return a + l.aq; }, 0);
      $('#bookSub').textContent = 'Top-3 depth ' + DS.fmtQty(bs) + ' × ' + DS.fmtQty(as);
      var big = st.avgPrint * 15;
      $('#tape').innerHTML = st.tape.slice(0, 16).map(function (t) {
        return '<div class="trow a' + t.a + (t.blk || t.q >= big ? ' blk' : '') + (t.mine ? ' mine' : '') + '"><span class="tt">' + DS.clock(t.t) + '</span><span class="tp">' + t.px.toFixed(2) + '</span><span class="tq">' + DS.fmtInt(t.q) + '</span><span class="tv">' + t.v + '</span></div>';
      }).join('');
      var ag = st.aggB / Math.max(1, st.aggB + st.aggS);
      $('#aggbar i').style.width = (ag * 100) + '%';
      $('#aggSub').textContent = 'At offer ' + Math.round(ag * 100) + '% · at bid ' + Math.round((1 - ag) * 100) + '%';
    },

    drawChart: function (s, st) {
      var cv = $('#chart'), box = cv.parentElement;
      var W = box.clientWidth, H = box.clientHeight;
      if (!W || !H) return;
      var dpr = window.devicePixelRatio || 1;
      if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
      var c = cv.getContext('2d');
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.clearRect(0, 0, W, H);
      var L = 8, Rr = 58, Tt = 26, Bb = 20;
      var pw = W - L - Rr, ph = H - Tt - Bb, vh = ph * 0.18, prh = ph - vh - 6;
      var bars = st.bars;
      var p = s.selOrder ? DS.Orders.get(s, s.selOrder) : null;
      if (p && p.tkr !== st.tkr) p = null;
      var lo = st.prevClose, hi = st.prevClose;
      bars.forEach(function (b) { lo = Math.min(lo, b.l); hi = Math.max(hi, b.h); });
      if (s.phase === 'pre') { var ind = st.prevClose * Math.exp(st.gap + st.beta * s.mkt.gap); lo = Math.min(lo, ind); hi = Math.max(hi, ind); }
      if (p && p.arrival) { lo = Math.min(lo, p.arrival); hi = Math.max(hi, p.arrival); }
      if (p && p.limit && Math.abs(p.limit / st.mid - 1) < 0.06) { lo = Math.min(lo, p.limit); hi = Math.max(hi, p.limit); }
      var pad = (hi - lo) * 0.08 || st.prevClose * 0.005; lo -= pad; hi += pad;
      var X = function (m) { return L + m / 390 * pw; };
      var Y = function (v) { return Tt + (hi - v) / (hi - lo) * prh; };
      c.font = '10.5px ' + cssv('--f-num');
      c.strokeStyle = colors['--line']; c.fillStyle = colors['--faint']; c.lineWidth = 1;
      for (var i = 0; i <= 4; i++) {
        var v = lo + (hi - lo) * i / 4, y = Math.round(Y(v)) + 0.5;
        c.beginPath(); c.moveTo(L, y); c.lineTo(L + pw, y); c.stroke();
        c.fillText(v.toFixed(2), L + pw + 6, y + 3);
      }
      ['10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00'].forEach(function (h) {
        var x = Math.round(X(DS.tOf(h) / 60)) + 0.5;
        c.beginPath(); c.moveTo(x, Tt); c.lineTo(x, Tt + ph); c.stroke();
        c.fillText(h, x - 14, H - 5);
      });
      // prev close
      c.setLineDash([3, 4]); c.strokeStyle = colors['--faint'];
      c.beginPath(); c.moveTo(L, Y(st.prevClose)); c.lineTo(L + pw, Y(st.prevClose)); c.stroke();
      if (p && p.arrival) { c.strokeStyle = colors['--info']; c.beginPath(); c.moveTo(X(p.recvT / 60), Y(p.arrival)); c.lineTo(L + pw, Y(p.arrival)); c.stroke(); }
      if (p && p.limit && p.limit > lo && p.limit < hi) { c.strokeStyle = colors['--dn']; c.beginPath(); c.moveTo(L, Y(p.limit)); c.lineTo(L + pw, Y(p.limit)); c.stroke(); }
      c.setLineDash([]);
      // volume
      var mv = 1; bars.forEach(function (b) { mv = Math.max(mv, b.v); });
      var bw = Math.max(1, pw / 390 * 0.72);
      bars.forEach(function (b, m) {
        var h = b.v / mv * vh;
        c.fillStyle = colors['--line'];
        c.fillRect(X(m + 0.5) - bw / 2, Tt + ph - h, bw, h);
      });
      // candles
      bars.forEach(function (b, m) {
        var x = X(m + 0.5), up = b.c >= b.o;
        c.strokeStyle = c.fillStyle = up ? colors['--up'] : colors['--dn'];
        c.beginPath(); c.moveTo(x, Y(b.h)); c.lineTo(x, Y(b.l)); c.stroke();
        var y1 = Y(Math.max(b.o, b.c)), y2 = Y(Math.min(b.o, b.c));
        c.fillRect(x - bw / 2, y1, bw, Math.max(1, y2 - y1));
      });
      // running VWAP
      var cpv = 0, cvv = 0; c.strokeStyle = colors['--accent']; c.lineWidth = 1.6; c.beginPath();
      bars.forEach(function (b, m) { cpv += (b.h + b.l + b.c) / 3 * b.v; cvv += b.v; var y = Y(cpv / Math.max(1, cvv)); if (m === 0) c.moveTo(X(m + 0.5), y); else c.lineTo(X(m + 0.5), y); });
      c.stroke(); c.lineWidth = 1;
      // our fills
      c.fillStyle = colors['--you'];
      s.fills.forEach(function (f) { if (f.tkr !== st.tkr) return; c.beginPath(); c.arc(X(f.t / 60), Y(f.px), f.src === 'BLOCK' || f.src === 'DARK BLOCK' ? 4.5 : 2.2, 0, 7); c.fill(); });
      // news markers
      c.fillStyle = colors['--warn'];
      s.news.forEach(function (n) { if (n.tkr !== st.tkr && n.sector !== st.sector) return; var x = X(n.t / 60); c.beginPath(); c.moveTo(x - 4, Tt - 10); c.lineTo(x + 4, Tt - 10); c.lineTo(x, Tt - 3); c.fill(); });
      // last price tag
      if (bars.length) { var last = bars[bars.length - 1].c, yy = Y(last); c.fillStyle = colors['--ink']; c.fillRect(L + pw + 2, yy - 8, Rr - 4, 16); c.fillStyle = colors['--panel']; c.fillText(last.toFixed(2), L + pw + 6, yy + 4); }
      if (s.phase === 'pre') { var ip = st.prevClose * Math.exp(st.gap + st.beta * s.mkt.gap); c.fillStyle = colors['--accent']; c.fillText('indicated open ' + ip.toFixed(2), L + 6, Y(ip) - 4); c.fillRect(L, Y(ip), pw * 0.04, 2); }
      $('#legend').innerHTML = '<span><i style="background:var(--accent)"></i>VWAP</span><span><i style="background:var(--faint)"></i>Prev close ' + st.prevClose.toFixed(2) + '</span>' + (p && p.arrival ? '<span><i style="background:var(--info)"></i>Arrival ' + p.arrival.toFixed(2) + '</span>' : '') + (p && p.limit ? '<span><i style="background:var(--dn)"></i>Limit ' + p.limit.toFixed(2) + '</span>' : '') + '<span><i style="background:var(--you);height:6px;width:6px;border-radius:3px"></i>Your fills</span><span><i style="background:var(--warn)"></i>News</span>';
    },

    // ---------- Ticket ----------
    renderTicket: function (force) {
      var s = S(), box = $('#ticket');
      var bulk = s.basket && Object.keys(s.ptSel).length;
      var p = s.selOrder ? DS.Orders.get(s, s.selOrder) : null;
      if (!bulk && !p) { box.innerHTML = '<div class="empty">Select a client order to work it.<br><span class="muted">Strategies, sizes and limits go here.</span></div>'; tk.forId = null; return; }
      var key = bulk ? 'bulk' : p.id;
      if (tk.forId !== key) { tk.forId = key; tk.qty = ''; tk.msg = null; if (!bulk && p.bench === 'CLOSE') tk.type = 'MOC'; }
      var algos = ['VWAP', 'TWAP', 'POV', 'IS', 'DARK', 'MOC', 'LMT', 'MKT'];
      var head = bulk ? '<div class="tk-head"><b>Bulk route</b><span class="muted">' + Object.keys(s.ptSel).length + ' names selected · each gets its unallocated shares</span></div>'
        : '<div class="tk-head"><span class="side ' + (p.side > 0 ? 'b' : 's') + '">' + DS.sideTxt(p.side) + '</span><b class="num">' + DS.fmtInt(p.qty) + ' ' + p.tkr + '</b><span class="muted">' + esc(p.client.name) + '</span><span class="instr">' + esc(p.instr || '') + '</span></div>';
      var endOpts = ['10:30', '11:00', '11:45', '12:00', '13:00', '14:00', '15:00', '15:30', '15:50', '16:00'].map(function (h) { return '<option' + (tk.end === h ? ' selected' : '') + '>' + h + '</option>'; }).join('');
      var T = tk.type;
      box.innerHTML = head +
        '<div class="algos" role="group" aria-label="Strategy">' + algos.map(function (a) { return '<button data-algo="' + a + '" class="' + (a === T ? 'on' : '') + '">' + DS.ALGOS[a].name + '</button>'; }).join('') + '</div>' +
        '<div class="adesc">' + DS.gloss(esc(DS.ALGOS[T].desc)) + '</div>' +
        '<div class="fields">' +
        (bulk ? '' : '<label>Shares<input type="number" id="tkQty" step="100" min="100" placeholder="' + DS.Orders.available(p) + '" value="' + tk.qty + '"></label>') +
        (T === 'POV' ? '<label>Rate %<input type="number" id="tkPct" min="1" max="50" step="1" placeholder="10" value="' + tk.pct + '"></label>' : '') +
        (['VWAP', 'TWAP', 'IS'].indexOf(T) >= 0 ? '<label>Max %<input type="number" id="tkPct" min="1" max="50" step="1" placeholder="' + (p && p.maxPct ? Math.round(p.maxPct * 100) : 'none') + '" value="' + tk.pct + '"></label>' : '') +
        (['VWAP', 'TWAP', 'IS'].indexOf(T) >= 0 ? '<label>End<select id="tkEnd">' + endOpts + '</select></label>' : '') +
        (T === 'IS' ? '<label>Urgency<select id="tkUrg">' + ['Low', 'Medium', 'High'].map(function (u) { return '<option' + (tk.urg === u ? ' selected' : '') + '>' + u + '</option>'; }).join('') + '</select></label>' : '') +
        (T !== 'MKT' && T !== 'MOC' ? '<label>Limit<input type="number" id="tkLim" step="0.01" placeholder="' + (p && p.limit ? p.limit.toFixed(2) : 'none') + '" value="' + tk.lim + '"></label>' : '') +
        '<button class="btn pri" id="tkGo">' + (bulk ? 'Route to selected' : 'Route ' + DS.ALGOS[T].name) + '</button>' +
        (p && !bulk ? '<button class="btn ghost" id="tkCxl" title="Cancel all working strategies and the order">Cancel order</button>' : '') +
        '</div><div class="est" id="tkEst"></div>' + (tk.msg ? '<div class="msg ' + tk.msg[0] + '">' + esc(tk.msg[1]) + '</div>' : '') + '<div class="kids" id="kids"></div>';
      DS.UI.updateEst(s);
      DS.UI.renderKids(s);
    },
    ticketClick: function (e) {
      var s = S();
      var a = e.target.closest('[data-algo]');
      if (a) { tk.type = a.dataset.algo; tk.pct = ''; tk.lim = ''; tk.msg = null; DS.UI.renderTicket(true); return; }
      if (e.target.id === 'tkGo') return DS.UI.route();
      if (e.target.id === 'tkCxl') {
        var p = DS.Orders.get(s, s.selOrder);
        if (!e.target.dataset.confirm) { e.target.dataset.confirm = '1'; e.target.textContent = 'Confirm: cancel ' + p.tkr + '?'; return; }
        DS.Orders.cancelParent(s, p); tk.msg = ['ok', 'Order cancelled. Make sure the client asked for it.'];
        DS.UI.renderTicket(true); DS.UI.render(true); return;
      }
      var k = e.target.closest('[data-kcx]');
      if (k) {
        var pp = DS.Orders.get(s, k.dataset.p), kid = pp.kids.filter(function (x) { return x.id === k.dataset.kcx; })[0];
        var r = DS.Orders.cancelKid(s, pp, kid);
        if (r && !r.ok) DS.UI.toast(r.msg);
        DS.UI.renderKids(s); DS.UI.render(true);
      }
    },
    ticketInput: function (e) {
      var id = e.target.id;
      if (id === 'tkQty') tk.qty = e.target.value;
      if (id === 'tkPct') tk.pct = e.target.value;
      if (id === 'tkLim') tk.lim = e.target.value;
      if (id === 'tkEnd') tk.end = e.target.value;
      if (id === 'tkUrg') tk.urg = e.target.value;
      DS.UI.updateEst(S());
    },
    cfg: function () {
      var c = { type: tk.type };
      if (tk.qty) c.qty = +tk.qty;
      if (tk.pct) c.pct = DS.clamp(+tk.pct / 100, 0.01, 0.5);
      else if (tk.type === 'POV') c.pct = 0.1;
      if (tk.lim) c.lim = +tk.lim;
      if (['VWAP', 'TWAP', 'IS'].indexOf(tk.type) >= 0) c.end = tk.end === '16:00' ? DS.DAY_SECS : DS.tOf(tk.end);
      if (tk.type === 'IS') c.urg = tk.urg;
      return c;
    },
    route: function () {
      var s = S(), c = DS.UI.cfg();
      if (s.basket && Object.keys(s.ptSel).length) {
        var ok = 0, bad = [];
        Object.keys(s.ptSel).forEach(function (id) {
          var p = DS.Orders.get(s, id), cc = Object.assign({}, c); delete cc.qty;
          var r = DS.Orders.route(s, p, cc); if (r.ok) ok++; else bad.push(p.tkr + ': ' + r.msg);
        });
        tk.msg = [bad.length && !ok ? 'err' : 'ok', 'Routed ' + DS.ALGOS[c.type].name + ' on ' + ok + ' names' + (bad.length ? '. Skipped ' + bad.length + ' (' + bad[0] + ')' : '.')];
      } else {
        var p = DS.Orders.get(s, s.selOrder);
        if (c.type === 'MOC' && s.t >= DS.tOf('15:50') && s.stocks[p.tkr].imb) {
          var im = s.stocks[p.tkr].imb;
          if (im.q * p.side < 0) { var q = DS.lot(Math.min(c.qty || DS.Orders.available(p), Math.abs(im.q), DS.Orders.available(p))); var kid = { id: 'K' + (++s.seq), pid: p.id, tkr: p.tkr, side: p.side, type: 'MOC', qty: q, filled: 0, cost: 0, start: s.t, end: DS.DAY_SECS, status: 'active', vSince: 0 }; p.kids.push(kid); if (p.status === 'new') p.status = 'working'; tk.msg = ['ok', 'Imbalance-offsetting close order accepted for ' + DS.fmtQty(q) + '.']; tk.qty = ''; DS.UI.renderTicket(true); DS.UI.render(true); return; }
        }
        var r = DS.Orders.route(s, p, c);
        tk.msg = [r.ok ? 'ok' : 'err', r.msg];
        if (r.ok) tk.qty = '';
      }
      DS.UI.renderTicket(true); DS.UI.render(true);
    },
    updateEst: function (s) {
      var el = $('#tkEst'); if (!el) return;
      var p = s.selOrder ? DS.Orders.get(s, s.selOrder) : null;
      if (!p || (s.basket && Object.keys(s.ptSel).length)) { el.innerHTML = ''; return; }
      var st = s.stocks[p.tkr], c = DS.UI.cfg();
      var q = c.qty || DS.Orders.available(p);
      if (!q || s.phase !== 'open') { el.innerHTML = s.phase === 'pre' ? '<span>Market opens at 9:30.</span>' : ''; return; }
      var end = c.end || DS.DAY_SECS;
      var rv = DS.clamp(DS.Market.relVol(s, st), 0.5, 4);
      var mvol = st.adv * (1 - DS.CLOSE_FRAC) * Math.max(0, DS.curveAt(end) - DS.curveAt(s.t)) * rv;
      var part = c.type === 'POV' ? c.pct : c.type === 'MOC' ? q / (st.adv * DS.CLOSE_FRAC + q) : mvol ? q / (q + mvol) : 1;
      var halfS = (st.ask - st.bid) / 2 / st.mid * 1e4;
      var rho = { VWAP: 0.5, TWAP: 0.45, POV: 0.4, IS: 0.3, DARK: 1, MOC: 1, LMT: 1, MKT: 0 }[c.type];
      var imp = 0.7 * st.sd * Math.sqrt(q / st.adv) * 1e4 * (c.type === 'MKT' ? 1.6 : c.type === 'IS' ? 1.05 : c.type === 'DARK' ? 0.35 : 0.8);
      var cost = halfS * (1 - 2 * rho) + imp;
      var fin = '';
      if (c.type === 'POV') {
        var need = q / c.pct * (1 - c.pct), t = s.t, acc = 0;
        while (t < DS.DAY_SECS && acc < need) { acc += st.adv * (1 - DS.CLOSE_FRAC) * DS.VOL_CURVE[Math.floor(t / 60)] * rv; t += 60; }
        fin = acc >= need ? 'Est. finish ' + DS.hhmm(t) : 'Will not finish today (~' + Math.round(acc / need * 100) + '%)';
      }
      el.innerHTML = '<span>Size <b>' + (q / st.adv * 100).toFixed(1) + '% ADV</b></span>' +
        (c.type !== 'MKT' && c.type !== 'DARK' && c.type !== 'LMT' ? '<span>Participation <b>' + (part * 100).toFixed(0) + '%</b>' + (p.maxPct && part > p.maxPct && c.type !== 'MOC' ? ' <span class="dn">over client cap</span>' : '') + '</span>' : '') +
        '<span>Est. cost <b>' + cost.toFixed(1) + ' bps</b> (spread ' + (halfS * (1 - 2 * rho)).toFixed(1) + ' + impact ' + imp.toFixed(1) + ')</span>' + (fin ? '<span>' + fin + '</span>' : '') +
        (c.type === 'MKT' ? '<span class="dn">Crosses the spread now and walks the book</span>' : '');
    },
    renderKids: function (s) {
      var box = $('#kids'); if (!box) return;
      var p = s.selOrder ? DS.Orders.get(s, s.selOrder) : null;
      if (!p || (s.basket && Object.keys(s.ptSel).length)) { box.innerHTML = ''; return; }
      var list = p.kids.slice().reverse();
      keyed(box, list, function (k) { return k.id; }, function (k) {
        var d = document.createElement('div'); d.className = 'kid';
        d.innerHTML = '<span class="kt"></span><span class="kp"></span><span class="ks"></span><span class="kc"></span>';
        return d;
      }, function (el, k) {
        el.querySelector('.kt').textContent = (DS.ALGOS[k.type] ? DS.ALGOS[k.type].name : k.type) + (k.pct ? ' ' + Math.round(k.pct * 100) + '%' : '');
        el.querySelector('.kp').textContent = DS.fmtQty(k.filled) + ' / ' + DS.fmtQty(k.qty) + (k.filled ? ' @ ' + (k.cost / k.filled).toFixed(2) : '') + (k.end && k.end < DS.DAY_SECS && k.type !== 'BLOCK' ? ' → ' + DS.hhmm(k.end) : '') + (k.lim ? ' lmt ' + k.lim.toFixed(2) : '');
        el.querySelector('.ks').textContent = k.status;
        el.querySelector('.kc').innerHTML = k.status === 'active' ? '<button class="btn sm" data-kcx="' + k.id + '" data-p="' + p.id + '">Cancel</button>' : '';
      });
    },

    // ---------- Feed (chat, news, notes, coach) ----------
    renderFeed: function (s, force) {
      var t = s.curTab;
      if (t === 'chat') {
        var sg = s.chat.length + ':' + s.chat.filter(function (m) { return m.answered != null; }).length;
        if (force || sig.chat !== sg) { sig.chat = sg; DS.UI.renderChat(s); }
        s.unread.chat = 0;
      } else if (t === 'news') {
        if (force || sig.news !== s.news.length) { sig.news = s.news.length; DS.UI.renderNews(s); }
        s.unread.news = 0;
      } else if (t === 'notes') {
        if (force || sig.notes !== s.notes.length + ':' + s.orders.length) { sig.notes = s.notes.length + ':' + s.orders.length; DS.UI.renderNotes(s); }
      } else if (t === 'coach') {
        var sc = s.tips.length + ':' + s.score.items.length;
        if (force || sig.coach !== sc) { sig.coach = sc; DS.UI.renderCoach(s); }
        s.unread.coach = 0;
      }
    },
    renderChat: function (s) {
      var box = $('#tab-chat');
      if (!s.chat.length) { box.innerHTML = '<div class="empty">Client and sales messages appear here. Some need a reply: pick the best response.</div>'; return; }
      box.innerHTML = s.chat.map(function (m) {
        var h = '<div class="cm k-' + m.kind + '"><div class="who"><b>' + esc(m.from) + '</b><span class="ct">' + (m.t >= 0 ? DS.hhmm(m.t) : '08:45') + '</span></div><div class="bub">' + esc(m.text) + '</div>';
        if (m.choices) {
          if (m.answered == null) h += '<div class="choices">' + m.choices.map(function (c, i) { return '<button data-m="' + m.id + '" data-ch="' + i + '">' + esc(c.t) + '</button>'; }).join('') + '</div>';
          else {
            var c = m.choices[m.answered];
            if (c.s != null) h += '<div class="fb ' + (c.s >= 0.8 ? 'good' : c.s < 0.5 ? 'bad' : '') + '"><b>' + (c.s >= 0.8 ? 'Good call' : c.s < 0.5 ? 'Poor call' : 'Partial credit') + '</b>' + DS.gloss(esc(c.why)) + (c.s < 0.8 && m.best != null && m.best !== m.answered ? '<div class="best">Best answer: ' + esc(m.choices[m.best].t) + '</div>' : '') + '</div>';
          }
        }
        return h + '</div>';
      }).join('');
      box.scrollTop = box.scrollHeight;
    },
    renderNews: function (s) {
      var box = $('#tab-news');
      if (!s.news.length) { box.innerHTML = '<div class="empty">Squawk headlines appear here during the session. Use Decode to learn how to read each one.</div>'; return; }
      box.innerHTML = s.news.map(function (n) {
        var mine = n.tkr && s.orders.some(function (p) { return p.tkr === n.tkr; });
        return '<div class="nitem sq"><div class="nh"><span class="nt">' + DS.hhmm(n.t) + '</span><span class="cat">' + (n.src || 'NEWS') + '</span>' + (mine ? '<span class="mine-tag">YOUR NAME</span>' : '') + '</div><div class="hd">' + esc(n.head) + '</div><div class="act">' + (n.decode ? '<button class="btn sm" data-dec="' + n.id + '">Decode</button>' : '') + (n.tkr ? '<button class="btn sm ghost" data-load="' + n.tkr + '">Load ' + n.tkr + '</button>' : '') + '</div></div>';
      }).join('');
    },
    renderNotes: function (s) {
      var box = $('#tab-notes');
      box.innerHTML = '<div class="sec-h">Morning note · ' + s.dateStr + '</div>' + s.notes.map(function (n) {
        var mine = n.tkr && s.orders.some(function (p) { return p.tkr === n.tkr; });
        return '<div class="nitem"><div class="nh"><span class="cat">' + n.cat + '</span>' + (mine ? '<span class="mine-tag">YOUR NAME</span>' : '') + '</div><div class="hd">' + esc(n.head) + '</div><div class="bd">' + esc(n.body) + '</div><div class="act"><button class="btn sm" data-dec="' + n.id + '">Decode</button>' + (n.tkr ? '<button class="btn sm ghost" data-load="' + n.tkr + '">Load ' + n.tkr + '</button>' : '') + '</div></div>';
      }).join('');
    },
    renderCoach: function (s) {
      var box = $('#tab-coach');
      var tips = s.tips.map(function (t) { return '<div class="tipi ' + t.level + '"><span class="nt">' + (t.t >= 0 ? DS.hhmm(t.t) : '') + '</span>' + DS.gloss(esc(t.text)) + (t.tkr ? ' <button class="btn sm ghost" data-load="' + t.tkr + '">' + t.tkr + '</button>' : '') + '</div>'; }).join('');
      var dec = s.score.items.slice().reverse().map(function (x) {
        return '<div class="fb ' + (x.s >= 0.8 ? 'good' : x.s < 0.5 ? 'bad' : '') + '"><b>' + DS.hhmm(x.t) + ' · ' + esc(x.title || '') + ' · ' + Math.round(x.s * 100) + '%</b>' + DS.gloss(esc(x.why || '')) + '</div>';
      }).join('');
      box.innerHTML = '<div class="sec-h">Coach</div>' + (tips || '<div class="muted">The coach watches your orders, the tape and the client instructions, and speaks up when a senior trader would.</div>') + '<div class="sec-h">Your calls</div>' + (dec || '<div class="muted">Decisions and chat replies are scored here with explanations.</div>');
    },

    // ---------- Watchlist ----------
    renderWatch: function (s) {
      if (!s.mkt) return;
      $('#sectors').innerHTML = Object.keys(DS.SECTORS).map(function (k) { var x = s.phase === 'pre' ? s.sectors[k].gap + s.mkt.gap : s.sectors[k].perf; return '<span class="secc"><span>' + DS.SECTORS[k].short + '</span><b class="' + cls(x) + '">' + DS.fmtPct(x) + '</b></span>'; }).join('');
      var order = s.watchOrder;
      var mineSet = {}; s.orders.forEach(function (p) { if (p.status !== 'cxl') mineSet[p.tkr] = 1; });
      keyed($('#wl tbody'), order, function (k) { return k; }, function (k) {
        var tr = document.createElement('tr');
        tr.innerHTML = '<td>' + k + '</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td>';
        return tr;
      }, function (tr, k) {
        var st = s.stocks[k], td = tr.children;
        tr.classList.toggle('sel', s.selected === k); tr.classList.toggle('has', !!mineSet[k]);
        if (s.phase === 'pre') {
          var g = Math.exp(st.gap + st.beta * s.mkt.gap + s.sectors[st.sector].gap) - 1;
          td[1].textContent = st.prevClose.toFixed(2); td[2].textContent = DS.fmtPct(g); td[2].className = cls(g);
          td[3].textContent = ''; td[4].textContent = ''; td[5].textContent = st.spr.toFixed(1); td[6].textContent = ''; td[7].textContent = '';
          return;
        }
        var ch = DS.Market.chg(st), rel = ch - s.sectors[st.sector].perf, rv = DS.Market.relVol(s, st);
        td[1].textContent = st.mid.toFixed(2);
        td[2].textContent = DS.fmtPct(ch); td[2].className = cls(ch);
        td[3].textContent = DS.fmtPct(rel); td[3].className = cls(rel);
        td[4].textContent = rv.toFixed(1) + 'x'; td[4].style.color = rv > 1.8 ? 'var(--accent)' : '';
        td[5].textContent = ((st.ask - st.bid) / st.mid * 1e4).toFixed(1);
        var ag = st.aggB / Math.max(1, st.aggB + st.aggS);
        td[6].textContent = Math.round(ag * 100); td[6].className = ag > 0.56 ? 'up' : ag < 0.44 ? 'dn' : '';
        td[7].textContent = st.imb ? (st.imb.q > 0 ? 'B ' : 'S ') + DS.fmtQty(Math.abs(st.imb.q)) : ''; td[7].className = st.imb ? cls(st.imb.q) : '';
      });
    },

    // ---------- Overlays ----------
    decision: function (d) {
      var ov = $('#ovDecision');
      ov.hidden = false;
      ov.innerHTML = '<div class="card" role="dialog" aria-modal="true"><h1><small>' + (d.cat === 'read' ? 'Read the market' : 'Decision point') + ' · ' + DS.hhmm(d.t) + '</small>' + esc(d.title) + '</h1><div class="ctx">' + DS.gloss(d.ctx) + '</div><div class="opts">' +
        d.options.map(function (o, i) { return '<button data-o="' + i + '">' + esc(o.t) + '</button>'; }).join('') + '</div><div id="decFb"></div></div>';
      ov.onclick = function (e) {
        var b = e.target.closest('button[data-o]');
        if (b && d.answered == null) {
          DS.Desk.answer(S(), d.id, +b.dataset.o);
          var c = d.options[d.answered];
          $$('.opts button', ov).forEach(function (x, i) { x.disabled = true; if (i === d.answered) x.classList.add('pick'); if (i === d.best) x.classList.add('best'); });
          $('#decFb').innerHTML = '<div class="fb ' + (c.s >= 0.8 ? 'good' : c.s < 0.5 ? 'bad' : '') + '"><b>' + (c.s >= 0.8 ? 'Good call' : c.s < 0.5 ? 'Not the best call' : 'Partial credit') + ' · ' + Math.round(c.s * 100) + '%</b>' + DS.gloss(esc(c.why)) + (d.best !== d.answered ? '<div class="best">Best answer: ' + esc(d.options[d.best].t) + '<br>' + esc(d.options[d.best].why) + '</div>' : '') + '</div>' +
            (c.fx && d.cat !== 'read' ? '<p class="muted" style="margin-top:6px">Your choice has been applied to the order. You can adjust it in the ticket at any time.</p>' : '') +
            '<div class="rowf" style="margin-top:10px"><button class="btn pri" id="decGo">Continue</button></div>';
          return;
        }
        if (e.target.id === 'decGo') {
          ov.hidden = true;
          DS.Desk.nextDecision(S());
          DS.UI.renderTicket(true);
          if (S().pendingDecision) DS.UI.decision(S().pendingDecision); else DS.App.maybeResume();
          DS.UI.render(true);
        }
      };
    },

    findItem: function (id) {
      var s = S();
      return s.notes.filter(function (n) { return n.id === id; })[0] || s.news.filter(function (n) { return n.id === id; })[0];
    },

    decodeHTML: function (s, n) {
      var d = n.decode(s, n);
      var mine = n.tkr ? s.orders.filter(function (p) { return p.tkr === n.tkr && p.status !== 'cxl'; })[0] : null;
      var live = '';
      if (n.tkr && s.phase !== 'pre') {
        var st = s.stocks[n.tkr];
        live = '<div class="livechk"><b>Live check, ' + DS.hhmm(s.t) + ':</b> ' + n.tkr + ' ' + DS.fmtPct(DS.Market.chg(st)) + ' (opened ' + DS.fmtPct(st.open / st.prevClose - 1) + '), vs sector ' + DS.fmtPct(DS.Market.chg(st) - s.sectors[st.sector].perf) + ', volume ' + DS.Market.relVol(s, st).toFixed(1) + 'x normal, spread ' + ((st.ask - st.bid) / st.mid * 1e4).toFixed(1) + 'bp vs ' + st.spr.toFixed(1) + 'bp typical. ' +
          (st.mid > st.open ? 'Trading above the open: buyers have kept coming.' : 'Trading below the open: the opening move is ' + (st.open > st.prevClose ? 'fading.' : 'extending.')) + '</div>';
      }
      return '<dl class="dec"><dt>What it says</dt><dd>' + DS.gloss(esc(d.what)) + '</dd><dt>Why it matters</dt><dd>' + DS.gloss(esc(d.why)) + '</dd><dt>What to expect</dt><dd>' + DS.gloss(esc(d.expect)) + '</dd>' +
        '<dt>If you are buying</dt><dd class="' + (mine && mine.side > 0 ? 'me' : '') + '">' + (mine && mine.side > 0 ? '<b>You are buying ' + n.tkr + '.</b> ' : '') + DS.gloss(esc(d.buy)) + '</dd>' +
        '<dt>If you are selling</dt><dd class="' + (mine && mine.side < 0 ? 'me' : '') + '">' + (mine && mine.side < 0 ? '<b>You are selling ' + n.tkr + '.</b> ' : '') + DS.gloss(esc(d.sell)) + '</dd></dl>' + live;
    },

    decode: function (id) {
      var s = S(), n = DS.UI.findItem(id); if (!n || !n.decode) return;
      var ov = $('#ovDecode'); ov.hidden = false;
      ov.innerHTML = '<div class="card"><h1><small>Decode · ' + (n.cat || n.src || 'headline') + '</small>' + esc(n.head) + '</h1>' + (n.body ? '<p class="bd" style="font-family:var(--f-note);font-size:15px">' + esc(n.body) + '</p>' : '') + DS.UI.decodeHTML(s, n) + '<div class="rowf"><button class="btn pri" id="decClose">Got it</button></div></div>';
      ov.onclick = function (e) { if (e.target === ov || e.target.id === 'decClose') ov.hidden = true; };
    },

    home: function () {
      var ov = $('#ovHome'); ov.hidden = false;
      var hist = DS.store.get('hist', []);
      var sel = DS.store.get('role', 'HT');
      var day = DS.store.get('day', 1);
      ov.innerHTML = '<div class="card wide"><h1><small>Agency Desk Simulator</small>Learn to think like a cash equities trader</h1>' +
        '<p class="lead">Take a seat on a simulated agency trading desk. Clients send orders, sales traders bring blocks, research and headlines hit the tape, and you decide how to work it. Every decision is scored and explained.</p>' +
        '<div class="roles">' + Object.keys(DS.ROLES).map(function (k) { var r = DS.ROLES[k]; return '<button class="role' + (k === sel ? ' on' : '') + '" data-role="' + k + '"><span class="k">' + r.kicker + '</span><b>' + r.title + '</b><p>' + r.desc + '</p><ul>' + r.learn.map(function (l) { return '<li>' + l + '</li>'; }).join('') + '</ul></button>'; }).join('') + '</div>' +
        '<div class="rowf"><label class="muted">Trading day #<input type="number" id="dayNo" min="1" max="9999" value="' + day + '"></label><span class="muted">Each day number is a different market. Replay a day to try a different approach.</span></div>' +
        '<div class="howto"><span><b>How a day runs:</b> morning meeting with the broker note (8:45) → the bell at 9:30 → orders, chats, blocks and headlines through the day → closing auction at 16:00 → TCA scorecard.</span><span><b>Controls:</b> Space to play/pause, speed buttons up top. The sim pauses itself when you need to make a call.</span><span><b>Learning tools:</b> Decode on any note or headline, the Coach tab, the Playbook and Glossary (hover any dotted term).</span></div>' +
        '<div class="rowf"><button class="btn pri" id="goStart">Start the day</button>' + (DS.S && DS.S.phase !== 'closed' && DS.S.started ? '<button class="btn" id="goResume">Back to current day</button>' : '') + '</div>' +
        (hist.length ? '<div><h4>Recent days</h4><div class="hist">' + hist.slice(-6).reverse().map(function (h) { return h.date + ' · ' + DS.ROLES[h.role].title + ' · day #' + h.day + ' · grade ' + h.grade + ' (' + Math.round(h.score * 100) + ')'; }).join('<br>') + '</div></div>' : '') + '</div>';
      ov.onclick = function (e) {
        var r = e.target.closest('[data-role]');
        if (r) { $$('.role', ov).forEach(function (x) { x.classList.remove('on'); }); r.classList.add('on'); sel = r.dataset.role; return; }
        if (e.target.id === 'goStart') { var d = Math.max(1, parseInt($('#dayNo').value, 10) || 1); DS.store.set('role', sel); DS.store.set('day', d); ov.hidden = true; DS.App.newDay(sel, d); }
        if (e.target.id === 'goResume') ov.hidden = true;
      };
    },

    morning: function () {
      var s = S(), ov = $('#ovMorning'); ov.hidden = false;
      var callable = function (n) { return n.cat === 'research' || n.cat === 'earnings'; };
      var truth = function (n) {
        if (n.cat === 'earnings') return n.meta.outcome === 'inline' ? 'Modest' : 'Big';
        var m = n.meta; if (m.kind === 'pt-up' || m.kind === 'pt-dn') return 'Noise';
        if (m.kind === 'init-ow') return 'Modest';
        return m.tier === 1 ? 'Big' : 'Modest';
      };
      ov.innerHTML = '<div class="card wide"><h1><small>Morning meeting · 08:45 · ' + s.dateStr + '</small>' + DS.ROLES[s.role].title + ': read the note</h1>' +
        '<p class="lead">Every desk starts here. Read each item and ask: does this move a stock I might trade, and does it change how I would trade it? For research and earnings items, call the expected impact before you decode it.</p>' +
        s.notes.map(function (n) {
          return '<div class="note"><span class="cat">' + n.cat + '</span><div class="hd">' + esc(n.head) + '</div><div class="bd">' + esc(n.body) + '</div>' +
            (callable(n) ? '<div class="call" data-n="' + n.id + '"><span>Your call on the open:</span>' + ['Big', 'Modest', 'Noise'].map(function (x) { return '<button class="btn sm" data-call="' + x + '">' + (x === 'Big' ? 'Big mover (2%+)' : x === 'Modest' ? 'Modest (0.5-2%)' : 'Noise') + '</button>'; }).join('') + '<span class="res"></span></div>' : '') +
            '<div class="rowf"><button class="btn sm" data-dec="' + n.id + '">Decode</button></div><div class="dx" hidden></div></div>';
        }).join('') +
        '<div class="rowf"><button class="btn pri" id="mStart">' + (s.role === 'PT' ? 'Go to pre-trade' : 'Ring the bell (9:30)') + '</button><span class="muted">You can reopen the note any time from the Research tab.</span></div></div>';
      ov.onclick = function (e) {
        var c = e.target.closest('[data-call]');
        if (c) {
          var box = c.closest('.call'); if (box.dataset.done) return;
          var n = DS.UI.findItem(box.dataset.n), t = truth(n), ok = c.dataset.call === t;
          box.dataset.done = 1; c.classList.add('on');
          box.querySelector('.res').innerHTML = ok ? '<b class="up">Right.</b>' : '<b class="dn">Expected: ' + t + '.</b>';
          DS.Desk.score(s, 'read', ok ? 1 : (t === 'Modest' || c.dataset.call === 'Modest' ? 0.4 : 0), 'Morning call: ' + n.tkr, ok ? 'You read the likely impact correctly.' : 'Rule of thumb: Tier-1 rating changes and earnings with a guide change are big; initiations and Tier-2 calls are modest; PT tweaks without a rating change are noise.', c.dataset.call, t);
          var dx = box.parentElement.querySelector('.dx'); dx.hidden = false; dx.innerHTML = DS.UI.decodeHTML(s, n);
          return;
        }
        var d = e.target.closest('[data-dec]');
        if (d) { var dx2 = d.closest('.note').querySelector('.dx'); dx2.hidden = !dx2.hidden; if (!dx2.hidden) dx2.innerHTML = DS.UI.decodeHTML(s, DS.UI.findItem(d.dataset.dec)); return; }
        if (e.target.id === 'mStart') { ov.hidden = true; if (s.role === 'PT') DS.UI.pretrade(); else DS.App.openMarket(); }
      };
    },

    pretrade: function () {
      var s = S(), ov = $('#ovPretrade'); ov.hidden = false;
      var pre = DS.PT.pretrade(s), spec = s.basketSpec;
      var secRows = Object.keys(pre.secNet).sort(function (a, b) { return Math.abs(pre.secNet[b]) - Math.abs(pre.secNet[a]); });
      ov.innerHTML = '<div class="card wide"><h1><small>Pre-trade · ' + esc(spec.client.name) + ' · ' + esc(spec.client.type) + '</small>Program: ' + spec.orders.length + ' names, ' + DS.fmtUsd(pre.gross) + ' gross</h1>' +
        '<p class="lead">The client wants this basket executed today, benchmark <b>' + (spec.bench === 'CLOSE' ? 'the close' : 'arrival (the open)') + '</b>. They will either pay you a commission to work it as agent, or ask for a <span class="g" data-g="Risk bid">risk bid</span>: a price for you to take the whole thing onto your book.</p>' +
        '<div class="kpis"><div class="kpi"><span>Buys</span><b class="up">' + DS.fmtUsd(pre.buy) + '</b></div><div class="kpi"><span>Sells</span><b class="dn">' + DS.fmtUsd(pre.sell) + '</b></div><div class="kpi"><span>Net</span><b>' + DS.fmtUsd(pre.net) + '</b></div><div class="kpi"><span>Beta-adj net</span><b>' + DS.fmtUsd(pre.betaNet) + '</b></div><div class="kpi"><span>Est. cost</span><b>' + pre.costBps.toFixed(1) + ' bps</b></div><div class="kpi"><span>1-day risk (unwind)</span><b>' + pre.riskBps.toFixed(1) + ' bps</b></div></div>' +
        '<div><h4>Sector net exposure</h4><div class="secbars">' + secRows.map(function (k) { return '<div><span>' + DS.SECTORS[k].short + '</span><b class="' + cls(pre.secNet[k]) + '">' + DS.fmtUsd(pre.secNet[k]) + '</b></div>'; }).join('') + '</div></div>' +
        '<div class="tblw"><table class="pt"><thead><tr><th>Name</th><th>Side</th><th>Shares</th><th>Notional</th><th>% ADV</th><th>Tier</th><th>Spread</th><th>Vol</th><th>Est cost</th><th>Sector</th></tr></thead><tbody>' +
        pre.rows.map(function (r) { var tier = r.pa < 0.03 ? 'Liquid' : r.pa < 0.12 ? 'Mid' : 'Illiquid'; return '<tr><td>' + r.tkr + '</td><td class="' + (r.side > 0 ? 'up' : 'dn') + '">' + DS.sideTxt(r.side) + '</td><td>' + DS.fmtInt(r.qty) + '</td><td>' + DS.fmtUsd(r.n) + '</td><td' + (r.pa > 0.12 ? ' class="dn"' : '') + '>' + (r.pa * 100).toFixed(1) + '%</td><td>' + tier + '</td><td>' + r.spr.toFixed(1) + '</td><td>' + Math.round(r.vol * 100) + '%</td><td>' + r.cost.toFixed(1) + '</td><td>' + DS.SECTORS[r.sector].short + '</td></tr>'; }).join('') +
        '</tbody></table></div>' +
        '<div class="note"><span class="cat">How to read this</span><div class="bd" style="font-size:14px">Most of the cost sits in the names over 12% of ADV: they need patient, capped strategies. The basket is close to dollar-neutral, but the beta-adjusted net and sector nets show the residual market and sector risk you carry while the two sides trade at different speeds. A risk bid should cover expected cost plus a premium for that risk.</div></div>' +
        '<div class="rowf"><button class="btn" id="ptAgency">Trade it agency (commission)</button><span class="muted">or</span><label class="muted">Risk bid <input type="number" id="ptBps" step="0.5" min="0" placeholder="bps"> bps</label><button class="btn pri" id="ptBid">Submit risk bid</button><button class="btn ghost" id="ptHint">How do I price it?</button></div><div id="ptRes"></div></div>';
      ov.onclick = function (e) {
        if (e.target.id === 'ptHint') { $('#ptRes').innerHTML = '<div class="note"><div class="bd" style="font-size:14px">Fair price ≈ expected cost (' + pre.costBps.toFixed(1) + 'bp) + risk premium (0.6 × ' + pre.riskBps.toFixed(1) + 'bp = ' + (0.6 * pre.riskBps).toFixed(1) + 'bp) + a little margin (2bp) = <b>' + pre.fair.toFixed(1) + 'bp</b>. Competitors quote around that, give or take their appetite for risk. Lower wins the trade; too low and you lose money unwinding.</div></div>'; return; }
        if (e.target.id === 'ptAgency') { DS.PT.start(s, 'agency', 0); s.score.items.push({ t: 0, cat: 'decision', s: 0.8, title: 'Agency vs risk', why: 'Agency is the safe choice: the client keeps the price risk and pays a commission.', chosen: 'Agency', best: 'Either works' }); ov.hidden = true; DS.App.openMarket(); return; }
        if (e.target.id === 'ptBid') {
          var b = parseFloat($('#ptBps').value);
          if (isNaN(b) || b <= 0) { $('#ptRes').innerHTML = '<div class="msg err">Enter a bid in bps, e.g. ' + pre.fair.toFixed(0) + '.</div>'; return; }
          var win = b <= pre.comp;
          var sc = win ? (b >= pre.fair * 0.85 ? 1 : 0.4) : (b > pre.fair * 1.3 ? 0.3 : 0.7);
          var why = win ? (b >= pre.fair * 0.85 ? 'You won at a price that covers cost and risk. Now hedge and unwind carefully: your P&L is live.' : 'You won, but below fair value: the expected cost and risk are higher than what you charged. Unwind carefully.') : 'Competitor quoted ' + pre.comp.toFixed(1) + 'bp. ' + (b > pre.fair * 1.3 ? 'Your price was well above fair; too much risk premium loses trades.' : 'Close, but the competitor had more appetite.');
          DS.Desk.score(s, 'decision', sc, 'Risk bid at ' + b + 'bp', why, b + 'bp', 'Around ' + pre.fair.toFixed(1) + 'bp');
          $('#ptRes').innerHTML = '<div class="fb ' + (win ? 'good' : 'bad') + '"><b>' + (win ? 'You won the risk bid at ' + b + 'bp.' : 'Lost: the client awarded it at ' + pre.comp.toFixed(1) + 'bp.') + '</b>' + esc(why) + (win ? '' : ' The client still sends you a smaller agency version to work.') + '</div><div class="rowf" style="margin-top:8px"><button class="btn pri" id="ptGo">Ring the bell (9:30)</button></div>';
          DS.PT.start(s, win ? 'principal' : 'agency', win ? b : 0);
          if (!win) s.basketSpec.orders.forEach(function (o) { o.qty = Math.max(100, DS.lot(o.qty * 0.5)); });
          if (!win) DS.PT.start(s, 'agency', 0);
          $$('#ptAgency,#ptBid,#ptBps').forEach(function (x) { x.disabled = true; });
          return;
        }
        if (e.target.id === 'ptGo') { ov.hidden = true; DS.App.openMarket(); }
      };
    },

    eod: function () {
      var s = S(), ov = $('#ovEod'); ov.hidden = false;
      var sm = DS.TCA.summary(s);
      var ptS = s.ptSummary;
      var rows = sm.rows.map(function (r) {
        var p = r.p;
        return '<tr><td>' + p.tkr + '</td><td class="' + (p.side > 0 ? 'up' : 'dn') + '">' + DS.sideTxt(p.side) + '</td><td>' + esc(p.client.name) + '</td><td>' + (p.bench === 'ARRIVAL' ? 'Arrival' : p.bench === 'CLOSE' ? 'Close' : 'VWAP') + '</td><td>' + Math.round(r.fill * 100) + '%</td><td>' + (r.avg ? r.avg.toFixed(2) : '-') + '</td><td class="' + cls(r.vsArr || 0) + '">' + DS.fmtBps(r.vsArr) + '</td><td class="' + cls(r.vsVwap || 0) + '">' + DS.fmtBps(r.vsVwap) + '</td><td class="' + cls(r.vsClose || 0) + '">' + DS.fmtBps(r.vsClose) + '</td><td>' + (r.part * 100).toFixed(1) + '%' + (p.maxPct ? ' / ' + Math.round(p.maxPct * 100) + '%' : '') + '</td><td>' + (r.breaches ? '<span class="dn">' + r.breaches + '</span>' : '0') + '</td><td><b>' + Math.round(r.score * 100) + '</b></td></tr>';
      }).join('');
      var lessons = sm.missed.slice(0, 8).map(function (x) { return '<div class="fb bad"><b>' + DS.hhmm(x.t) + ' · ' + esc(x.title) + '</b>You chose: ' + esc(x.chosen || '') + '<div class="best">Better: ' + esc(x.best) + '</div>' + DS.gloss(esc(x.why || '')) + '</div>'; }).join('');
      var tips = s.tips.filter(function (t) { return t.level !== 'info'; }).slice(0, 6).map(function (t) { return '<div class="tipi ' + t.level + '"><span class="nt">' + DS.hhmm(t.t) + '</span>' + esc(t.text) + '</div>'; }).join('');
      ov.innerHTML = '<div class="card wide"><div class="rowf" style="align-items:flex-end;gap:20px"><div class="grade">' + sm.grade + '</div><h1><small>End of day · ' + s.dateStr + ' · ' + DS.ROLES[s.role].title + '</small>Trading day #' + s.day + ' scorecard</h1></div>' +
        '<div class="kpis"><div class="kpi"><span>Overall</span><b>' + Math.round(sm.score * 100) + '</b></div><div class="kpi"><span>Execution</span><b>' + (sm.ex != null ? Math.round(sm.ex * 100) : '-') + '</b></div><div class="kpi"><span>Decisions</span><b>' + (sm.dec != null ? Math.round(sm.dec * 100) : '-') + '</b></div><div class="kpi"><span>Client color</span><b>' + (sm.col != null ? Math.round(sm.col * 100) : '-') + '</b></div><div class="kpi"><span>Client relationship</span><b>' + Math.round(sm.rel) + '</b></div><div class="kpi"><span>' + (s.basket && s.basket.mode === 'principal' ? 'Principal P&amp;L' : 'Commission') + '</span><b class="' + (ptS && ptS.pnl != null ? cls(ptS.pnl) : '') + '">' + (ptS && ptS.pnl != null ? DS.fmtUsd(ptS.pnl) : DS.fmtUsd(sm.comm)) + '</b></div></div>' +
        (rows ? '<div><h4>Transaction cost analysis (bps, + = beat the benchmark)</h4><div class="tblw"><table class="pt"><thead><tr><th>Name</th><th>Side</th><th>Client</th><th>Bench</th><th>Filled</th><th>Avg px</th><th>vs Arrival</th><th>vs VWAP</th><th>vs Close</th><th>Particip.</th><th>Breaches</th><th>Score</th></tr></thead><tbody>' + rows + '</tbody></table></div></div>' : '') +
        (ptS ? '<div><h4>Program summary</h4><div class="kpis"><div class="kpi"><span>Vs benchmark</span><b class="' + cls(ptS.bench) + '">' + DS.fmtBps(ptS.bench) + ' bps</b></div><div class="kpi"><span>Pre-trade estimate</span><b>-' + ptS.est.toFixed(1) + ' bps</b></div><div class="kpi"><span>Completion</span><b>' + Math.round(ptS.fill * 100) + '%</b></div><div class="kpi"><span>Balance score</span><b>' + Math.round(ptS.balance * 100) + '</b></div><div class="kpi"><span>Futures P&amp;L</span><b class="' + cls(ptS.fut) + '">' + DS.fmtUsd(ptS.fut) + '</b></div></div><p class="muted" style="margin-top:6px">A program that comes in near its pre-trade estimate, completes, and stays balanced is a good day. Beating the estimate by a lot usually means the market moved in your favor, not skill.</p></div>' : '') +
        '<div><h4>How to read your TCA</h4><p class="muted">Judge each order against <b>its own benchmark</b>. VWAP orders: vs VWAP within ±5bps is solid. Arrival orders: a cost of a few bps per 1% of ADV is normal; a big positive number in a falling market for a buyer is luck, not skill. Close orders: look at vs Close. Breaches of a client cap or limit cost more than a few bps ever will.</p></div>' +
        (lessons ? '<div><h4>Calls to review</h4><div style="display:grid;gap:6px">' + lessons + '</div></div>' : '<div><h4>Calls to review</h4><p class="muted">No weak calls today. Try a harder role or a different day.</p></div>') +
        (tips ? '<div><h4>Coach warnings during the day</h4><div style="display:grid;gap:4px">' + tips + '</div></div>' : '') +
        '<div class="rowf"><button class="btn pri" id="eNext">Next day (#' + (s.day + 1) + ')</button><button class="btn" id="eReplay">Replay day #' + s.day + '</button><button class="btn" id="eRole">Change role</button><button class="btn ghost" id="eClose">Look at the market</button></div></div>';
      if (!s.saved) {
        s.saved = true;
        var hist = DS.store.get('hist', []);
        hist.push({ date: new Date().toISOString().slice(0, 10), role: s.role, day: s.day, grade: sm.grade, score: sm.score });
        DS.store.set('hist', hist.slice(-30));
      }
      ov.onclick = function (e) {
        if (e.target.id === 'eNext') { ov.hidden = true; DS.store.set('day', s.day + 1); DS.App.newDay(s.role, s.day + 1); }
        if (e.target.id === 'eReplay') { ov.hidden = true; DS.App.newDay(s.role, s.day); }
        if (e.target.id === 'eRole') { ov.hidden = true; DS.UI.home(); }
        if (e.target.id === 'eClose') ov.hidden = true;
      };
    },

    menu: function () {
      var s = S(), ov = $('#ovMenu'); ov.hidden = false;
      var th = document.documentElement.dataset.theme || '';
      ov.innerHTML = '<div class="card" style="width:min(420px,100%)"><h1><small>Menu</small>' + (s ? DS.ROLES[s.role].title + ' · day #' + s.day : 'Agency Desk') + '</h1><div class="opts">' +
        '<button data-m="close">Resume</button>' +
        (s && s.phase === 'open' ? '<button data-m="ff">Fast-forward to the close</button>' : '') +
        (s && s.phase === 'closed' ? '<button data-m="eod">Show scorecard</button>' : '') +
        '<button data-m="replay">Restart this day</button><button data-m="home">Change role or day</button>' +
        '<button data-m="theme">Theme: ' + (th === 'light' ? 'light' : th === 'dark' ? 'dark' : 'system') + ' (switch)</button></div></div>';
      ov.onclick = function (e) {
        if (e.target === ov) { ov.hidden = true; return; }
        var b = e.target.closest('[data-m]'); if (!b) return;
        var m = b.dataset.m; ov.hidden = true;
        if (m === 'ff') DS.App.fastForward();
        if (m === 'eod') DS.UI.eod();
        if (m === 'replay') DS.App.newDay(s.role, s.day);
        if (m === 'home') DS.UI.home();
        if (m === 'theme') { var nx = th === '' ? 'light' : th === 'light' ? 'dark' : ''; if (nx) document.documentElement.dataset.theme = nx; else delete document.documentElement.dataset.theme; DS.store.set('theme', nx); readColors(); DS.UI.render(true); }
      };
    },

    drawer: function (kind) {
      var d = $('#drawer'); d.hidden = false;
      var s = S();
      if (kind === 'playbook') {
        d.innerHTML = '<div class="dh"><h2>Trader playbook</h2><button class="btn sm" id="dClose">Close</button></div><div class="db">' + DS.PLAYBOOK.map(function (x) { return '<section><h3>' + x.t + '</h3>' + x.b.map(function (p) { return '<p>' + DS.gloss(p) + '</p>'; }).join('') + '</section>'; }).join('') + '</div>';
      } else if (kind === 'glossary') {
        var keys = Object.keys(DS.GLOSSARY).sort(function (a, b) { return a.toLowerCase() < b.toLowerCase() ? -1 : 1; });
        d.innerHTML = '<div class="dh"><h2>Glossary</h2><button class="btn sm" id="dClose">Close</button></div><div class="db"><input type="search" id="gq" placeholder="Search terms" aria-label="Search glossary"><dl class="gl" id="gl">' + keys.map(function (k) { return '<div data-t="' + esc(k.toLowerCase() + ' ' + DS.GLOSSARY[k].toLowerCase()) + '"><dt>' + esc(k) + '</dt><dd>' + esc(DS.GLOSSARY[k]) + '</dd></div>'; }).join('') + '</dl></div>';
        $('#gq').oninput = function (e) { var q = e.target.value.toLowerCase(); $$('#gl > div').forEach(function (x) { x.hidden = q && x.dataset.t.indexOf(q) < 0; }); };
      } else if (kind === 'notes') {
        DS.UI.tab('notes'); if (window.innerWidth <= 900) DS.UI.view('feed'); d.hidden = true; return;
      }
      $('#dClose').onclick = DS.UI.closeDrawer;
    },
    closeDrawer: function () { $('#drawer').hidden = true; }
  };
})();
