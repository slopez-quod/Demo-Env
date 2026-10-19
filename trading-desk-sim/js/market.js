/* Market engine: factor-model prices, U-shaped volume, spreads, tape, events, closing auction. */
window.DS = window.DS || {};

(function () {
  var MIN = 390;
  // Continuous-session volume curve (minute weights), heavy at the open, heavier into the close.
  var vc = [], tot = 0;
  for (var m = 0; m < MIN; m++) {
    var w = 0.55 + 2.6 * Math.exp(-m / 16) + 1.5 * Math.exp(-(MIN - 1 - m) / 32);
    vc.push(w); tot += w;
  }
  DS.CLOSE_FRAC = 0.10; // share of daily volume in the closing auction
  DS.VOL_CURVE = vc.map(function (w) { return w / tot; });
  DS.CUM_CURVE = [0];
  for (m = 0; m < MIN; m++) DS.CUM_CURVE.push(DS.CUM_CURVE[m] + DS.VOL_CURVE[m]);
  // Intraday volatility multiplier
  DS.VOLA = [];
  for (m = 0; m < MIN; m++) DS.VOLA.push(0.8 + 1.6 * Math.exp(-m / 14) + 0.35 * Math.exp(-(MIN - 1 - m) / 20));
  // Spread multiplier: wide at the open
  DS.SPRM = [];
  for (m = 0; m < MIN; m++) DS.SPRM.push(1 + 1.8 * Math.exp(-m / 6));
})();

// Fraction of the continuous-session volume curve completed by time t (seconds since open)
DS.curveAt = function (t) {
  if (t <= 0) return 0;
  if (t >= DS.DAY_SECS) return 1;
  var m = Math.floor(t / 60), f = (t % 60) / 60;
  return DS.CUM_CURVE[m] + DS.VOL_CURVE[m] * f;
};

DS.Market = {
  build: function (S, rng) {
    var STEPS_YR = 252 * DS.DAY_SECS / DS.STEP;
    S.mkt = {
      prev: 6650 + Math.round(rng.gauss() * 40), lvl: 0, f: 0, open: null, hi: 0, lo: 1e9,
      sStep: 0.13 / Math.sqrt(STEPS_YR), drift: 0, driftUntil: 0, hist: [],
      gap: rng.gauss() * 0.0035, vixBase: DS.round(15.5 + rng.range(-2, 4), 2), vix: 0
    };
    S.mkt.lvl = S.mkt.prev;
    S.rates = { prev: DS.round(4.08 + rng.gauss() * 0.08, 3), y: 0, drift: 0, driftUntil: 0, gap: rng.gauss() * 3 };
    S.oil = { prev: DS.round(71 + rng.gauss() * 3, 2), px: 0, gap: rng.gauss() * 0.012 };
    S.dxy = { prev: DS.round(103.2 + rng.gauss() * 0.8, 2), px: 0 };
    S.sectors = {};
    Object.keys(DS.SECTORS).forEach(function (k) {
      S.sectors[k] = { f: 0, sStep: DS.SECTOR_FACTOR[k].vol / Math.sqrt(STEPS_YR), drift: 0, driftUntil: 0, gap: rng.gauss() * 0.004, perf: 0 };
    });
    S.stocks = {};
    S.tkrs = [];
    DS.UNIVERSE.forEach(function (u) {
      var prev = DS.round(u.prevClose * Math.exp(rng.gauss() * 0.03), 2);
      var sec = DS.SECTOR_FACTOR[u.sector].vol;
      var sys = Math.pow(u.beta * 0.16, 2) + sec * sec;
      var idio = Math.sqrt(Math.max(0.01, u.vol * u.vol - sys));
      var s = Object.assign({}, u, {
        prevClose: prev, sd: u.vol / Math.sqrt(252), idioStep: idio / Math.sqrt(STEPS_YR),
        logF: Math.log(prev), mid: prev, bid: prev, ask: prev, open: null, hi: prev, lo: prev, close: null,
        cumV: 0, cumPV: 0, aggB: 0, aggS: 0, bars: [], tape: [], vm: 1, vmHalf: 1800, sm: 1, smHalf: 600,
        drift: 0, driftUntil: 0, flow: null, impT: 0, impP: 0, imp: 0, gap: 0, stepV: 0, stepLo: prev, stepHi: prev,
        avgPrint: Math.max(100, DS.lot(u.adv / 390 / 60 * 2.5)), imb: null, closeBias: 0, news: []
      });
      S.stocks[u.tkr] = s;
      S.tkrs.push(u.tkr);
    });
  },

  // Apply overnight gaps and set opening prints.
  open: function (S) {
    var M = S.mkt;
    M.f = M.gap;
    M.lvl = M.prev * Math.exp(M.f);
    M.open = M.lvl; M.hi = M.lvl; M.lo = M.lvl;
    S.rates.y = S.rates.prev + S.rates.gap / 100;
    S.oil.px = S.oil.prev * Math.exp(S.oil.gap);
    S.dxy.px = S.dxy.prev;
    Object.keys(S.sectors).forEach(function (k) { S.sectors[k].f = S.sectors[k].gap; });
    S.tkrs.forEach(function (tk) {
      var s = S.stocks[tk];
      s.logF += s.beta * M.gap + S.sectors[s.sector].gap + S.rng.gauss() * s.sd * 0.15 + s.gap;
      s.mid = Math.exp(s.logF);
      s.open = DS.round(s.mid, 2);
      s.hi = s.open; s.lo = s.open; s.last = s.open;
      DS.Market.quote(S, s, 0);
      // opening auction print, ~1.5% of ADV (more on news)
      var ov = DS.lot(s.adv * 0.015 * Math.min(4, s.vm) * Math.exp(S.rng.gauss() * 0.3));
      s.cumV += ov; s.cumPV += ov * s.open;
      s.tape.unshift({ t: 0, px: s.open, q: ov, v: 'OPEN', a: 0, blk: true });
      s.bars.push({ o: s.open, h: s.open, l: s.open, c: s.open, v: ov });
    });
    M.vix = M.vixBase;
    M.hist.push(M.lvl);
  },

  quote: function (S, s, m) {
    var hs = s.mid * s.spr / 2e4 * DS.SPRM[Math.min(389, m)] * s.sm;
    var spreadC = Math.max(0.01, Math.round(hs * 2 * 100) / 100);
    var bid = Math.floor((s.mid - spreadC / 2) * 100 + 1e-6) / 100;
    s.bid = bid; s.ask = DS.round(bid + spreadC, 2);
    s.hs = (s.ask - s.bid) / 2;
  },

  // Apply a scripted event (see scenarios.js for shape).
  fire: function (S, ev) {
    var t = S.t, dur = Math.max(DS.STEP, ev.dur || 0), n = dur / DS.STEP;
    if (ev.rates) {
      S.rates.y += ev.rates / 100;
      Object.keys(S.sectors).forEach(function (k) { var sc = S.sectors[k], j = DS.SECTOR_FACTOR[k].rates * ev.rates * 0.0008; sc.f += j; sc.pendingJump = (sc.pendingJump || 0) + j; });
    }
    if (ev.ratesDrift) { S.rates.drift = ev.ratesDrift / 100 / n; S.rates.driftUntil = t + dur; }
    if (ev.oil) S.oil.px *= Math.exp(ev.oil);
    var stocks = [];
    if (ev.scope === 'mkt') {
      S.mkt.f += ev.jump || 0;
      if (ev.drift) { S.mkt.drift = ev.drift / n; S.mkt.driftUntil = t + dur; }
      stocks = S.tkrs.map(function (k) { return S.stocks[k]; });
      // market jumps reach stocks through beta on the next step via the factor delta
      S.mkt.pendingJump = (S.mkt.pendingJump || 0) + (ev.jump || 0);
    } else if (ev.scope === 'sector') {
      var sec = S.sectors[ev.target];
      sec.f += ev.jump || 0;
      sec.pendingJump = (sec.pendingJump || 0) + (ev.jump || 0);
      if (ev.drift) { sec.drift = ev.drift / n; sec.driftUntil = t + dur; }
      stocks = S.tkrs.map(function (k) { return S.stocks[k]; }).filter(function (s) { return s.sector === ev.target; });
    } else if (ev.scope === 'stock') {
      var s = S.stocks[ev.target];
      s.logF += ev.jump || 0;
      if (ev.drift) { s.drift = ev.drift / n; s.driftUntil = t + dur; }
      if (ev.flowSide) s.flow = { side: ev.flowSide, until: t + dur, skew: ev.flowSkew || 0.25, start: t };
      if (ev.closeBias) s.closeBias += ev.closeBias;
      stocks = [s];
    }
    stocks.forEach(function (s) {
      var vm = ev.scope === 'mkt' ? (ev.vm || 1) : (ev.vm || 1);
      if (vm > s.vm) { s.vm = vm; s.vmHalf = ev.vmHalf || 1800; }
      if (ev.sm && ev.sm > s.sm) { s.sm = ev.sm; s.smHalf = ev.smHalf || 600; }
      if (ev.peerVm && ev.scope === 'sector' && ev.peerVm > s.vm) s.vm = ev.peerVm;
    });
  },

  step: function (S) {
    var rng = S.rng, M = S.mkt, t = S.t, m = Math.min(389, Math.floor(t / 60));
    var vola = DS.VOLA[m];
    // Market factor
    var dm = M.sStep * vola * rng.gauss() * (S.mktVolMult || 1) + (t < M.driftUntil ? M.drift : 0);
    var mJump = M.pendingJump || 0; M.pendingJump = 0;
    M.f += dm;
    M.lvl = M.prev * Math.exp(M.f);
    M.hi = Math.max(M.hi, M.lvl); M.lo = Math.min(M.lo, M.lvl);
    // Rates (bps step vol ~0.12bp), oil, dollar
    var dy = 0.0012 * rng.gauss() + (t < S.rates.driftUntil ? S.rates.drift : 0);
    S.rates.y += dy;
    S.oil.px *= Math.exp(0.0006 * rng.gauss());
    S.dxy.px *= Math.exp(0.00012 * rng.gauss());
    var mRet = M.f; // log return since prev close
    M.vix = Math.max(9, M.vixBase * Math.exp(-4.5 * (mRet - M.gap)) + 0.05 * rng.gauss());
    // Sectors
    var dsec = {};
    Object.keys(S.sectors).forEach(function (k) {
      var sc = S.sectors[k];
      var d = sc.sStep * vola * rng.gauss() + (t < sc.driftUntil ? sc.drift : 0) + DS.SECTOR_FACTOR[k].rates * dy * 0.08;
      var j = sc.pendingJump || 0; sc.pendingJump = 0;
      sc.f += d;
      dsec[k] = d + j;
    });
    // Stocks
    for (var i = 0; i < S.tkrs.length; i++) {
      var s = S.stocks[S.tkrs[i]];
      var z = rng.gauss();
      var dI = s.idioStep * vola * z;
      var dr = t < s.driftUntil ? s.drift : 0;
      s.logF += s.beta * (dm + mJump) + dsec[s.sector] + dI + dr;
      // decay of event volume/spread multipliers and our transient impact
      s.vm = 1 + (s.vm - 1) * Math.pow(0.5, DS.STEP / s.vmHalf);
      s.sm = 1 + (s.sm - 1) * Math.pow(0.5, DS.STEP / s.smHalf);
      s.impT *= Math.pow(0.5, DS.STEP / 1500);
      var X = 0.45 * s.impP + 0.55 * s.impT;
      s.imp = 0.7 * s.sd * Math.sign(X) * Math.sqrt(Math.abs(X) / s.adv);
      var prevMid = s.mid;
      s.mid = Math.exp(s.logF + s.imp);
      DS.Market.quote(S, s, m);
      // Volume this step from others
      var base = s.adv * (1 - DS.CLOSE_FRAC) * DS.VOL_CURVE[m] / (60 / DS.STEP);
      var act = 0.86 + 0.15 * Math.abs(z) + 0.04 * Math.min(5, Math.abs(s.beta * dm) / (M.sStep + 1e-9));
      var v = DS.lot(base * Math.exp(0.42 * rng.gauss() - 0.09) * s.vm * act * (s.flow && t < s.flow.until ? 1.6 : 1));
      var ret = Math.log(s.mid / prevMid);
      var stepSig = s.sd / Math.sqrt(DS.DAY_SECS / DS.STEP) * vola;
      var bf = 0.5 + 0.32 * Math.tanh(ret / (stepSig + 1e-9));
      if (s.flow && t < s.flow.until) bf = DS.clamp(bf + s.flow.side * s.flow.skew, 0.08, 0.92);
      s.stepV = v; s.stepBuyFrac = bf;
      s.stepLo = Math.min(prevMid, s.mid) - s.hs; s.stepHi = Math.max(prevMid, s.mid) + s.hs;
      DS.Market.printTape(S, s, v, bf, rng);
      s.cumV += v; s.cumPV += v * s.mid;
      s.aggB += v * bf; s.aggS += v * (1 - bf);
      s.last = s.tape.length ? s.tape[0].px : s.mid;
      s.hi = Math.max(s.hi, s.mid); s.lo = Math.min(s.lo, s.mid);
      var bar = s.bars[s.bars.length - 1];
      if (!bar || s.bars.length <= m) {
        // pad any missing minutes
        while (s.bars.length < m) s.bars.push({ o: s.mid, h: s.mid, l: s.mid, c: s.mid, v: 0 });
        s.bars.push({ o: prevMid, h: Math.max(prevMid, s.mid), l: Math.min(prevMid, s.mid), c: s.mid, v: v });
      } else {
        bar.h = Math.max(bar.h, s.mid); bar.l = Math.min(bar.l, s.mid); bar.c = s.mid; bar.v += v;
      }
    }
    if (t % 60 === 0) M.hist.push(M.lvl);
    // Sector performance (equal-weight of constituents vs prev close)
    var agg = {};
    S.tkrs.forEach(function (k) {
      var s = S.stocks[k];
      agg[s.sector] = agg[s.sector] || { n: 0, r: 0 };
      agg[s.sector].n++; agg[s.sector].r += s.mid / s.prevClose - 1;
    });
    Object.keys(agg).forEach(function (k) { S.sectors[k].perf = agg[k].r / agg[k].n; });
  },

  printTape: function (S, s, v, bf, rng) {
    if (v <= 0) return;
    var venues = ['NYSE', 'NSDQ', 'ARCA', 'BATS', 'EDGX', 'IEX', 'MEMX', 'DARK'];
    var n = Math.min(4, 1 + Math.floor(v / (s.avgPrint * 6)));
    var left = v;
    for (var i = 0; i < n && left > 0; i++) {
      var q = i === n - 1 ? left : DS.lot(left * rng.range(0.15, 0.5));
      if (q <= 0) continue;
      left -= q;
      var buy = rng.next() < bf;
      var dark = rng.next() < 0.14;
      var px = dark ? DS.round(s.mid, 3) : (buy ? s.ask : s.bid);
      s.tape.unshift({ t: S.t, px: px, q: q, v: dark ? 'DARK' : rng.pick(venues.slice(0, 7)), a: dark ? 0 : (buy ? 1 : -1) });
    }
    // Occasional block print from someone else (bigger on news / flow days)
    var pBlk = 0.0035 * Math.sqrt(s.vm) * (s.flow && S.t < s.flow.until ? 4 : 1);
    if (rng.next() < pBlk) {
      var bq = DS.lot(s.adv * rng.range(0.003, 0.012));
      var side = s.flow && S.t < s.flow.until ? s.flow.side : (rng.next() < bf ? 1 : -1);
      s.tape.unshift({ t: S.t, px: DS.round(s.mid + side * s.hs * 0.5, 2), q: bq, v: 'DARK', a: side, blk: true });
      s.cumV += bq; s.cumPV += bq * s.mid;
      if (side > 0) s.aggB += bq; else s.aggS += bq;
    }
    if (s.tape.length > 60) s.tape.length = 60;
  },

  // Closing imbalance publication: natural imbalance + bias from events + our MOC orders.
  publishImbalance: function (S) {
    S.tkrs.forEach(function (k) {
      var s = S.stocks[k];
      if (!s.natImb) s.natImb = DS.lot(s.adv * (S.rng.gauss() * 0.006 + s.closeBias));
      var ours = DS.Orders.mocNet(S, k);
      var q = s.natImb + ours;
      var ind = s.mid * Math.exp(0.6 * s.sd * Math.sign(q) * Math.sqrt(Math.abs(q) / s.adv));
      s.imb = { q: q, ours: ours, ind: DS.round(ind, 2), t: S.t };
    });
  },

  closeAuction: function (S) {
    S.tkrs.forEach(function (k) {
      var s = S.stocks[k];
      var ours = DS.Orders.mocNet(S, k);
      var q = (s.natImb || 0) + ours;
      var cp = DS.round(s.mid * Math.exp(0.6 * s.sd * Math.sign(q) * Math.sqrt(Math.abs(q) / s.adv) + S.rng.gauss() * s.sd * 0.02), 2);
      var cv = DS.lot(s.adv * DS.CLOSE_FRAC * Math.exp(S.rng.gauss() * 0.25) * Math.sqrt(s.vm)) + Math.abs(DS.Orders.mocGross(S, k));
      s.close = cp; s.closeV = cv;
      s.cumV += cv; s.cumPV += cv * cp;
      s.mid = cp; s.last = cp;
      s.tape.unshift({ t: DS.DAY_SECS, px: cp, q: cv, v: 'CLOSE', a: 0, blk: true });
      var bar = s.bars[s.bars.length - 1];
      if (bar) { bar.c = cp; bar.h = Math.max(bar.h, cp); bar.l = Math.min(bar.l, cp); bar.v += cv; }
    });
  },

  // L2 book snapshot (generated around the quote; sizes scale with ADV and liquidity state)
  book: function (S, s) {
    var lv = [], base = Math.max(100, DS.lot(s.adv / 390 / 8 / Math.sqrt(s.sm)));
    var tick = Math.max(0.01, DS.round(s.hs * 2 / 2, 2));
    var r = DS.makeRng((Math.floor(S.t / DS.STEP) * 131 + s.tkr.charCodeAt(0) * 7 + s.tkr.charCodeAt(1)) >>> 0);
    for (var i = 0; i < 6; i++) {
      var f = 1 + i * 0.35;
      var bq = DS.lot(base * f * r.range(0.4, 1.6) * (s.flow && S.t < s.flow.until && s.flow.side < 0 ? 0.6 : 1));
      var aq = DS.lot(base * f * r.range(0.4, 1.6) * (s.flow && S.t < s.flow.until && s.flow.side < 0 ? 1.6 : 1));
      lv.push({ bp: DS.round(s.bid - i * tick, 2), bq: Math.max(100, bq), ap: DS.round(s.ask + i * tick, 2), aq: Math.max(100, aq) });
    }
    return lv;
  },

  vwap: function (s) { return s.cumV ? s.cumPV / s.cumV : s.mid; },
  chg: function (s) { return s.mid / s.prevClose - 1; },
  relVol: function (S, s) { // volume vs expected at this time of day
    var exp = s.adv * (1 - DS.CLOSE_FRAC) * DS.curveAt(S.t) + s.adv * 0.015;
    return exp > 0 ? s.cumV / exp : 1;
  }
};
