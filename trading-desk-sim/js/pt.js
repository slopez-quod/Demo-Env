/* Program trading: pre-trade analytics, risk bid, tiering, live basket stats and balancing. */
window.DS = window.DS || {};

DS.PT = {
  costBps: function (s, q, px) {
    var pa = q / s.adv;
    return s.spr / 2 + 0.7 * s.sd * Math.sqrt(pa) * 1e4 * 0.6;
  },

  pretrade: function (S) {
    var spec = S.basketSpec, rows = [], gross = 0, buy = 0, sell = 0, betaNet = 0, cost = 0, idioVar = 0;
    var secNet = {};
    spec.orders.forEach(function (o) {
      var s = S.stocks[o.tkr], px = s.prevClose, n = o.qty * px;
      var pa = o.qty / s.adv, c = DS.PT.costBps(s, o.qty, px);
      rows.push({ tkr: o.tkr, side: o.side, qty: o.qty, n: n, pa: pa, spr: s.spr, vol: s.vol, cost: c, sector: s.sector, beta: s.beta });
      gross += n; if (o.side > 0) buy += n; else sell += n;
      betaNet += o.side * n * s.beta;
      secNet[s.sector] = (secNet[s.sector] || 0) + o.side * n;
      cost += c * n;
      var idio = Math.sqrt(Math.max(0.01, s.vol * s.vol - Math.pow(s.beta * 0.16, 2) - Math.pow(DS.SECTOR_FACTOR[s.sector].vol, 2))) / Math.sqrt(252);
      idioVar += Math.pow(n * idio, 2);
    });
    var mVar = Math.pow(betaNet * 0.16 / Math.sqrt(252), 2), sVar = 0;
    Object.keys(secNet).forEach(function (k) { sVar += Math.pow(secNet[k] * DS.SECTOR_FACTOR[k].vol / Math.sqrt(252), 2); });
    // Liquidating linearly over the day: average variance factor 1/3
    var risk$ = Math.sqrt((mVar + sVar + idioVar) / 3);
    var costBps = cost / gross;
    var riskBps = risk$ / gross * 1e4;
    rows.sort(function (a, b) { return b.pa - a.pa; });
    var tiers = { liq: 0, mid: 0, ill: 0 };
    rows.forEach(function (r) { if (r.pa < 0.03) tiers.liq++; else if (r.pa < 0.12) tiers.mid++; else tiers.ill++; });
    var fair = costBps + 0.6 * riskBps + 2;
    var rr = DS.makeRng(S.seed * 31 + 5);
    var comp = DS.round(fair * rr.range(0.88, 1.18), 1);
    return { rows: rows, gross: gross, buy: buy, sell: sell, net: buy - sell, betaNet: betaNet, secNet: secNet, costBps: costBps, riskBps: riskBps, risk$: risk$, tiers: tiers, fair: fair, comp: comp };
  },

  // mode: 'agency' | 'principal'; bps: quoted risk price
  start: function (S, mode, bps) {
    var spec = S.basketSpec, pre = DS.PT.pretrade(S);
    S.basket = { client: spec.client, bench: spec.bench, mode: mode, bps: bps || 0, orders: [], gross: pre.gross, tiers: pre.tiers, pre: pre, strike: {}, lastImbQ: -1e9 };
  },

  createOrders: function (S) {
    var B = S.basket, spec = S.basketSpec;
    spec.orders.forEach(function (o) {
      var p = DS.Orders.newParent(S, { tkr: o.tkr, side: o.side, qty: o.qty, bench: spec.bench, urgency: 'Medium', client: { name: spec.client.name, contact: spec.client.contact, type: spec.client.type }, basket: 'B1' });
      p.instr = 'Program: ' + (spec.bench === 'CLOSE' ? 'close' : 'arrival') + ' benchmark, keep balanced.';
      B.orders.push(p.id);
      B.strike[o.tkr] = S.stocks[o.tkr].mid;
    });
  },

  parents: function (S) { return S.basket ? S.basket.orders.map(function (id) { return DS.Orders.get(S, id); }) : []; },

  tier: function (S, p) {
    var pa = p.qty / S.stocks[p.tkr].adv;
    return pa < 0.03 ? 'Liquid' : pa < 0.12 ? 'Mid' : 'Illiquid';
  },

  autoTier: function (S) {
    var close = S.basket.bench === 'CLOSE', T = DS.tOf;
    DS.PT.parents(S).forEach(function (p) {
      var tr = DS.PT.tier(S, p), O = DS.Orders;
      var rem = function (f) { return DS.lot((p.qty - p.filled) * f); };
      if (close) {
        if (tr === 'Liquid') { O.route(S, p, { type: 'VWAP', qty: rem(0.6), pct: 0.1, end: T('15:50') }); O.route(S, p, { type: 'MOC' }); }
        else if (tr === 'Mid') { O.route(S, p, { type: 'VWAP', qty: rem(0.7), pct: 0.12, end: T('15:50') }); O.route(S, p, { type: 'MOC' }); }
        else { O.route(S, p, { type: 'POV', qty: rem(0.7), pct: 0.1 }); O.route(S, p, { type: 'DARK' }); }
      } else {
        if (tr === 'Liquid') O.route(S, p, { type: 'IS', urg: 'Low', end: T('13:00') });
        else if (tr === 'Mid') { O.route(S, p, { type: 'VWAP', qty: rem(0.8), pct: 0.12 }); O.route(S, p, { type: 'DARK' }); }
        else { O.route(S, p, { type: 'POV', qty: rem(0.7), pct: 0.1 }); O.route(S, p, { type: 'DARK' }); }
      }
    });
  },

  stats: function (S) {
    var B = S.basket, bq = 0, bd = 0, sq = 0, sd = 0, netDone = 0, betaNet = 0, costN = 0, filledN = 0, remN = 0, illRem = 0, contrib = [];
    DS.PT.parents(S).forEach(function (p) {
      var s = S.stocks[p.tkr], n = p.qty * s.prevClose, d = p.filled * s.prevClose;
      if (p.side > 0) { bq += n; bd += d; } else { sq += n; sd += d; }
      var rem = (p.qty - p.filled) * s.mid;
      remN += rem;
      if ((p.qty - p.filled) / s.adv > 0.06) illRem += rem;
      if (B.mode === 'principal') betaNet += -p.side * (p.qty - p.filled) * s.mid * s.beta;
      else betaNet += p.side * p.filled * s.mid * s.beta;
      netDone += p.side * p.filled * s.mid;
      if (p.filled) {
        var c = p.side * (DS.Orders.avgPx(p) - p.arrival) * p.filled;
        costN += c; filledN += p.filled * p.arrival;
        contrib.push({ tkr: p.tkr, c: c });
      }
    });
    betaNet += S.fut.pos * DS.Orders.futPx(S) * 50;
    contrib.sort(function (a, b) { return b.c - a.c; });
    return {
      buyPct: bq ? bd / bq : 0, sellPct: sq ? sd / sq : 0, donePct: (bd + sd) / Math.max(1, bq + sq),
      netDone: netDone, betaNet: betaNet, costBps: filledN ? costN / filledN * 1e4 : 0,
      worst: contrib.slice(0, 3).map(function (x) { return x.tkr; }), illRemain: remN ? illRem / remN : 0
    };
  },

  pnl: function (S) {
    var B = S.basket; if (!B) return 0;
    var tot = 0;
    DS.PT.parents(S).forEach(function (p) {
      var s = S.stocks[p.tkr], k = B.strike[p.tkr] * (1 + p.side * B.bps / 1e4);
      var avg = DS.Orders.avgPx(p) || 0;
      tot += p.filled * p.side * (k - avg) + (p.qty - p.filled) * p.side * (k - s.mid);
    });
    return tot + DS.Orders.futPnl(S);
  },

  sectorResidual: function (S) {
    var out = {};
    DS.PT.parents(S).forEach(function (p) {
      var s = S.stocks[p.tkr];
      var e = S.basket.mode === 'principal' ? -p.side * (p.qty - p.filled) * s.mid : p.side * p.filled * s.mid;
      out[s.sector] = (out[s.sector] || 0) + e;
    });
    return out;
  },

  rebalanceSpeed: function (S, st) {
    var fastSide = st.buyPct > st.sellPct ? 1 : -1;
    DS.PT.parents(S).forEach(function (p) {
      if (p.status === 'done' || p.status === 'cxl') return;
      p.kids.forEach(function (k) { if (k.status === 'active' && k.type !== 'MOC' && k.type !== 'DARK') k.status = 'cxl'; });
      var tr = DS.PT.tier(S, p);
      if (p.side === fastSide) DS.Orders.route(S, p, { type: 'VWAP', pct: 0.06 });
      else DS.Orders.route(S, p, { type: 'POV', pct: tr === 'Illiquid' ? 0.15 : 0.2 });
    });
  },

  mocLiquid: function (S, maxPa) {
    DS.PT.parents(S).forEach(function (p) {
      if (p.status === 'done' || p.status === 'cxl') return;
      var s = S.stocks[p.tkr];
      if ((p.qty - p.filled) / s.adv > maxPa) return;
      p.kids.forEach(function (k) { if (k.status === 'active' && k.type !== 'MOC') k.status = 'cxl'; });
      if (DS.Orders.available(p) >= 100) DS.Orders.route(S, p, { type: 'MOC' });
    });
  },

  monitor: function (S) {
    if (!S.basket || S.t % 60 !== 0 || S.t < 1800) return;
    var st = DS.PT.stats(S);
    var gap = Math.abs(st.buyPct - st.sellPct);
    if (gap > 0.15 && S.t - S.basket.lastImbQ > 5400 && S.t < DS.tOf('15:20')) {
      S.basket.lastImbQ = S.t;
      DS.Scen.ptImbalanceQ(S, st);
    }
    var lim = S.basket.gross * 0.03;
    if (Math.abs(st.betaNet) > lim) DS.Desk.tip(S, 'ptbeta' + Math.floor(S.t / 3600), 'warn', 'Beta-adjusted exposure is ' + DS.fmtUsd(st.betaNet) + ', above 3% of gross. Hedge with ' + Math.abs(Math.round(st.betaNet / (S.mkt.lvl * 50))) + ' ES (' + (st.betaNet > 0 ? 'sell' : 'buy') + ') or rebalance completion.');
  }
};
