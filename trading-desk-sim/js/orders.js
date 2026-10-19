/* Order management and execution: client (parent) orders, algo/manual child orders, fills, blocks, futures. */
window.DS = window.DS || {};

DS.Orders = {
  newParent: function (S, o) {
    var s = S.stocks[o.tkr];
    var p = Object.assign({
      id: 'C' + (++S.seq), side: 1, qty: 0, limit: null, bench: 'VWAP', urgency: 'Medium', maxPct: null,
      instr: '', client: null, recvT: S.t, filled: 0, notional: 0, status: 'new', kids: [], fills: [],
      basket: null, cumV0: s.cumV, cumPV0: s.cumPV, cumV1: null, cumPV1: null, doneT: null, ackT: null,
      breaches: [], idleSince: S.t, arrival: S.t >= 0 ? s.mid : null
    }, o);
    S.orders.push(p);
    if (!S.selOrder || !S.basket && (function (o) { return !o || o.status === 'done' || o.status === 'cxl'; })(DS.Orders.get(S, S.selOrder))) { S.selOrder = p.id; S.selected = p.tkr; if (DS.UI && S.phase === 'open') DS.UI.renderTicket(true); }
    return p;
  },

  get: function (S, id) { for (var i = 0; i < S.orders.length; i++) if (S.orders[i].id === id) return S.orders[i]; return null; },

  // Shares already filled or currently allocated to live child orders.
  working: function (p) {
    var w = 0;
    p.kids.forEach(function (k) { if (k.status === 'active') w += k.qty - k.filled; });
    return w;
  },
  available: function (p) { return Math.max(0, p.qty - p.filled - DS.Orders.working(p)); },

  // Start a child strategy on a parent. Returns {ok, msg}
  route: function (S, p, cfg) {
    var s = S.stocks[p.tkr];
    var avail = DS.Orders.available(p);
    var qty = DS.lot(Math.min(cfg.qty || avail, avail));
    if (p.status === 'done' || p.status === 'cxl') return { ok: false, msg: 'Order is closed.' };
    if (qty < 100) return { ok: false, msg: 'Nothing left to allocate. Cancel a working strategy first.' };
    if (S.phase !== 'open') return { ok: false, msg: 'Market is not open.' };
    if (cfg.type === 'MOC' && S.t >= DS.tOf('15:50')) return { ok: false, msg: 'Rejected: MOC cutoff is 15:50. After the cutoff only offsetting imbalance orders are accepted.' };
    var lim = cfg.lim != null && cfg.lim !== '' && !isNaN(cfg.lim) ? +cfg.lim : null;
    if (p.limit != null) {
      if (lim == null) lim = p.limit;
      else if ((p.side > 0 && lim > p.limit) || (p.side < 0 && lim < p.limit)) return { ok: false, msg: 'Child limit ' + lim.toFixed(2) + ' is through the client limit ' + p.limit.toFixed(2) + '.' };
    }
    if (cfg.type === 'LMT' && lim == null) return { ok: false, msg: 'Enter a limit price.' };
    var start = S.t, end = cfg.end != null ? cfg.end : DS.DAY_SECS;
    if (end <= start + 60 && ['VWAP', 'TWAP', 'IS'].indexOf(cfg.type) >= 0) return { ok: false, msg: 'End time must be after now.' };
    var k = {
      id: 'K' + (++S.seq), pid: p.id, tkr: p.tkr, side: p.side, type: cfg.type, qty: qty, filled: 0, cost: 0,
      start: start, end: end, pct: cfg.pct || null, lim: lim, urg: cfg.urg || p.urgency, status: 'active',
      vSince: 0, cum0: DS.curveAt(start), cumE: DS.curveAt(end)
    };
    p.kids.push(k);
    if (p.status === 'new') { p.status = 'working'; p.ackT = p.ackT == null ? S.t : p.ackT; }
    p.idleSince = null;
    if (k.type === 'MKT') DS.Orders.execMarket(S, s, p, k, qty);
    if (k.type === 'LMT') DS.Orders.tryLimitCross(S, s, p, k);
    DS.Log && DS.Log.action(S, p, k);
    return { ok: true, msg: DS.ALGOS[k.type].name + ' ' + DS.fmtQty(qty) + ' started' };
  },

  cancelKid: function (S, p, k) {
    if (k.status !== 'active') return;
    if (k.type === 'MOC' && S.t >= DS.tOf('15:50')) return { ok: false, msg: 'MOC orders cannot be cancelled after 15:50.' };
    k.status = 'cxl';
    if (!p.kids.some(function (x) { return x.status === 'active'; }) && p.status === 'working') p.idleSince = S.t;
    return { ok: true };
  },

  cancelParent: function (S, p) {
    p.kids.forEach(function (k) { if (k.status === 'active' && !(k.type === 'MOC' && S.t >= DS.tOf('15:50'))) k.status = 'cxl'; });
    if (p.filled < p.qty) { p.status = 'cxl'; DS.Orders.finish(S, p); }
  },

  fill: function (S, s, p, k, q, px, src) {
    if (q <= 0) return;
    q = Math.min(q, k.qty - k.filled, p.qty - p.filled);
    if (q <= 0) return;
    px = DS.round(px, 4);
    k.filled += q; k.cost += q * px;
    p.filled += q; p.notional += q * px;
    var f = { t: S.t, id: p.id, tkr: p.tkr, side: p.side, q: q, px: px, src: src || k.type };
    p.fills.push(f); S.fills.push(f);
    if (k.filled >= k.qty) k.status = 'done';
    if (p.filled >= p.qty) { p.status = 'done'; DS.Orders.finish(S, p); }
  },

  finish: function (S, p) {
    if (p.doneT != null) return;
    var s = S.stocks[p.tkr];
    p.doneT = S.t; p.cumV1 = s.cumV; p.cumPV1 = s.cumPV;
    p.kids.forEach(function (k) { if (k.status === 'active' && k.filled >= k.qty) k.status = 'done'; });
  },

  avgPx: function (p) { return p.filled ? p.notional / p.filled : null; },

  // Impact bookkeeping for our own executions.
  impact: function (s, side, q, weight) {
    s.impT += side * q * weight; s.impP += side * q * weight;
  },

  execMarket: function (S, s, p, k, q) {
    var depth = Math.max(100, DS.lot(s.adv / 390 / 8 / Math.sqrt(s.sm)));
    var tick = Math.max(0.01, DS.round(s.hs * 2 / 2, 2));
    var left = q, cost = 0, lvl = 0;
    while (left > 0 && lvl < 60) {
      var sz = Math.min(left, DS.lot(depth * (1 + lvl * 0.35)) || 100);
      var px = k.side > 0 ? s.ask + lvl * tick : s.bid - lvl * tick;
      cost += sz * px; left -= sz; lvl++;
    }
    var avg = cost / q;
    DS.Orders.fill(S, s, p, k, q, avg, 'MKT');
    DS.Orders.impact(s, k.side, q, 1.6);
    s.cumV += q; s.cumPV += q * avg;
    if (k.side > 0) s.aggB += q; else s.aggS += q;
    s.tape.unshift({ t: S.t, px: DS.round(avg, 2), q: q, v: 'YOU', a: k.side, mine: true, blk: q > s.avgPrint * 20 });
    // Sweeping the book leaves a temporary dislocation
    s.logF += k.side * Math.min(0.02, (lvl - 1) * tick / s.mid * 0.4);
  },

  tryLimitCross: function (S, s, p, k) {
    var marketable = (k.side > 0 && k.lim >= s.ask) || (k.side < 0 && k.lim <= s.bid);
    if (!marketable) return;
    var depth = Math.max(100, DS.lot(s.adv / 390 / 8 / Math.sqrt(s.sm)));
    var q = Math.min(k.qty - k.filled, depth * 2);
    var px = k.side > 0 ? s.ask : s.bid;
    DS.Orders.fill(S, s, p, k, q, px, 'LMT');
    DS.Orders.impact(s, k.side, q, 1.2);
    s.cumV += q; s.cumPV += q * px;
    s.tape.unshift({ t: S.t, px: px, q: q, v: 'YOU', a: k.side, mine: true });
  },

  // Called once per engine step after prices update.
  step: function (S) {
    var self = DS.Orders;
    S.orders.forEach(function (p) {
      if (p.status === 'done' || p.status === 'cxl') return;
      var s = S.stocks[p.tkr];
      var otherV = s.stepV;
      p.kids.forEach(function (k) {
        if (k.status !== 'active') return;
        k.vSince += otherV;
        if (k.type === 'MOC') return;
        if (S.t > k.end + DS.STEP) { k.status = 'expired'; self.checkIdle(S, p); return; }
        var rem = k.qty - k.filled;
        var q = 0, rho = 0.5, src = k.type;
        var limOk = k.lim == null || (k.side > 0 ? s.mid <= k.lim : s.mid >= k.lim);
        var x = (S.t - k.start) / Math.max(DS.STEP, k.end - k.start);
        var target;
        switch (k.type) {
          case 'VWAP':
            var cn = DS.curveAt(S.t + DS.STEP);
            target = k.qty * DS.clamp((cn - k.cum0) / Math.max(1e-6, k.cumE - k.cum0), 0, 1);
            rho = 0.5; break;
          case 'TWAP':
            target = k.qty * DS.clamp((S.t + DS.STEP - k.start) / Math.max(DS.STEP, k.end - k.start), 0, 1);
            rho = 0.45; break;
          case 'IS':
            var kk = k.urg === 'High' ? 7 : k.urg === 'Low' ? 1.8 : 3.5;
            var xx = DS.clamp((S.t + DS.STEP - k.start) / Math.max(DS.STEP, k.end - k.start), 0, 1);
            target = k.qty * (1 - Math.exp(-kk * xx)) / (1 - Math.exp(-kk));
            rho = 0.3; break;
          case 'POV':
            var pr = k.pct || 0.1;
            target = pr / (1 - pr) * k.vSince;
            rho = 0.4; break;
          case 'DARK':
            if (!limOk) return;
            var pf = 0.16 * Math.sqrt(s.vm);
            if (S.rng.next() < pf) {
              q = DS.lot(otherV * S.rng.range(0.03, 0.12));
              if (S.rng.next() < 0.0035 * (s.flow && s.flow.side === -k.side && S.t < s.flow.until ? 6 : 1)) {
                q = DS.lot(s.adv * S.rng.range(0.004, 0.025)); src = 'DARK BLOCK';
              }
              q = Math.min(rem, q);
              if (q >= 100) {
                self.fill(S, s, p, k, q, s.mid, src);
                self.impact(s, k.side, q, 0.35);
                s.cumV += q; s.cumPV += q * s.mid;
                s.tape.unshift({ t: S.t, px: DS.round(s.mid, 3), q: q, v: 'DARK', a: 0, mine: true, blk: src === 'DARK BLOCK' });
              }
            }
            return;
          case 'LMT':
            var touchOk = k.side > 0 ? k.lim >= s.bid : k.lim <= s.ask;
            var through = k.side > 0 ? s.stepLo < k.lim - 0.001 : s.stepHi > k.lim + 0.001;
            if ((k.side > 0 && k.lim >= s.ask) || (k.side < 0 && k.lim <= s.bid)) { self.tryLimitCross(S, s, p, k); return; }
            if (through) q = DS.lot(otherV * S.rng.range(0.15, 0.35));
            else if (touchOk && S.rng.next() < 0.35) q = DS.lot(otherV * (k.side > 0 ? 1 - s.stepBuyFrac : s.stepBuyFrac) * S.rng.range(0.08, 0.25));
            q = Math.min(rem, q);
            if (q >= 100) {
              self.fill(S, s, p, k, q, k.lim, 'LMT');
              self.impact(s, k.side, q, 0.5);
              s.cumV += q; s.cumPV += q * k.lim;
              s.tape.unshift({ t: S.t, px: k.lim, q: q, v: 'YOU', a: -k.side, mine: true });
            }
            return;
        }
        if (!limOk) return;
        var need = target - k.filled;
        // participation cap (child pct for VWAP/TWAP/IS, or the parent's max %)
        var cap = k.type === 'POV' ? null : (k.pct || p.maxPct);
        if (cap) need = Math.min(need, cap / (1 - cap) * k.vSince - k.filled + 100);
        q = Math.min(rem, DS.lot(need));
        if (q < 100) return;
        // A child should never be most of one step's volume unless it is sweeping late
        q = Math.min(q, DS.lot(otherV * 1.5) || 100);
        var part = q / (otherV + q);
        var tempBps = 0.12 * s.sd * 1e4 * Math.sqrt(part);
        var px = s.mid + k.side * s.hs * (1 - 2 * rho) + k.side * s.mid * tempBps / 1e4;
        self.fill(S, s, p, k, q, px, src);
        self.impact(s, k.side, q, 1);
        s.cumV += q; s.cumPV += q * px;
        if (k.side > 0) s.aggB += q * (1 - rho); else s.aggS += q * (1 - rho);
        if (S.selected === p.tkr || q > s.avgPrint * 4) s.tape.unshift({ t: S.t, px: DS.round(px, 2), q: q, v: 'YOU', a: k.side, mine: true });
      });
      self.checkIdle(S, p);
    });
  },

  checkIdle: function (S, p) {
    if (p.status !== 'working' && p.status !== 'new') return;
    var live = p.kids.some(function (k) { return k.status === 'active'; });
    if (!live && p.idleSince == null) p.idleSince = S.t;
    if (live) p.idleSince = null;
  },

  mocNet: function (S, tkr) {
    var n = 0;
    S.orders.forEach(function (p) {
      if (p.tkr !== tkr) return;
      p.kids.forEach(function (k) { if (k.type === 'MOC' && k.status === 'active') n += k.side * (k.qty - k.filled); });
    });
    return n;
  },
  mocGross: function (S, tkr) {
    var n = 0;
    S.orders.forEach(function (p) {
      if (p.tkr !== tkr) return;
      p.kids.forEach(function (k) { if (k.type === 'MOC' && k.status === 'active') n += (k.qty - k.filled); });
    });
    return n;
  },

  // At 16:00: fill MOCs at the official close and expire everything else.
  atClose: function (S) {
    S.orders.forEach(function (p) {
      var s = S.stocks[p.tkr];
      p.kids.forEach(function (k) {
        if (k.status !== 'active') return;
        if (k.type === 'MOC') DS.Orders.fill(S, s, p, k, k.qty - k.filled, s.close, 'MOC');
        if (k.status === 'active') k.status = 'expired';
      });
      if (p.status !== 'done' && p.status !== 'cxl') { p.status = p.filled > 0 ? 'part' : 'unfilled'; DS.Orders.finish(S, p); }
      if (p.doneT === DS.DAY_SECS || p.cumV1 == null) { p.cumV1 = s.cumV; p.cumPV1 = s.cumPV; }
    });
  },

  // Accept a block cross offered by sales / an IOI.
  crossBlock: function (S, p, q, px) {
    var s = S.stocks[p.tkr];
    q = DS.lot(Math.min(q, DS.Orders.available(p)));
    if (q < 100) return 0;
    var k = { id: 'K' + (++S.seq), pid: p.id, tkr: p.tkr, side: p.side, type: 'BLOCK', qty: q, filled: 0, cost: 0, start: S.t, end: S.t, status: 'active' };
    p.kids.push(k);
    if (p.status === 'new') { p.status = 'working'; p.ackT = S.t; }
    DS.Orders.fill(S, s, p, k, q, px, 'BLOCK');
    k.status = 'done';
    DS.Orders.impact(s, p.side, q, 0.15);
    s.cumV += q; s.cumPV += q * px;
    s.tape.unshift({ t: S.t, px: px, q: q, v: 'BLOCK', a: 0, mine: true, blk: true });
    return q;
  },

  // Index futures for hedging (ES-style, $50 x index)
  futPx: function (S) { return S.mkt.lvl * (1 + 0.0009); },
  tradeFut: function (S, n) {
    if (!n || S.phase !== 'open') return;
    var px = DS.Orders.futPx(S) + Math.sign(n) * 0.125;
    S.fut.trades.push({ t: S.t, n: n, px: px });
    S.fut.pos += n; S.fut.cash -= n * px * 50;
  },
  futPnl: function (S) { return S.fut.cash + S.fut.pos * DS.Orders.futPx(S) * 50; }
};
