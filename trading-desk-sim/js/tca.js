/* Transaction cost analysis and end-of-day scorecard. Positive bps = outperformed the benchmark. */
window.DS = window.DS || {};

DS.TCA = {
  order: function (S, p) {
    var s = S.stocks[p.tkr];
    var avg = DS.Orders.avgPx(p);
    var v1 = p.cumV1 != null ? p.cumV1 : s.cumV, pv1 = p.cumPV1 != null ? p.cumPV1 : s.cumPV;
    var ivwap = (pv1 - p.cumPV0) / Math.max(1, v1 - p.cumV0);
    var close = s.close != null ? s.close : s.mid;
    function bps(ref) { return avg && ref ? p.side * (ref - avg) / ref * 1e4 : null; }
    var r = {
      p: p, avg: avg, ivwap: ivwap, close: close, arrival: p.arrival,
      vsArr: bps(p.arrival), vsVwap: bps(ivwap), vsClose: bps(close),
      fill: p.filled / p.qty, part: p.filled / Math.max(1, v1 - p.cumV0),
      breaches: p.breaches.length
    };
    r.vsBench = p.bench === 'VWAP' ? r.vsVwap : p.bench === 'CLOSE' ? r.vsClose : r.vsArr;
    // Opportunity cost on unfilled shares vs arrival (only for arrival benchmark)
    var unf = p.qty - p.filled;
    r.opp = p.bench === 'ARRIVAL' && unf > 0 ? p.side * (p.arrival - close) / p.arrival * 1e4 * unf / p.qty : 0;
    // Score: benchmark performance scaled by stock vol, completion, compliance
    var scale = Math.max(8, s.sd * 1e4 * 0.25);
    var perf = DS.clamp(0.55 + (r.vsBench || 0) / (2.5 * scale), 0, 1);
    var compl = DS.clamp(r.fill / 0.95, 0, 1);
    r.score = DS.clamp(perf * 0.6 + compl * 0.4 - r.breaches * 0.15, 0, 1);
    if (p.status === 'cxl') r.score = Math.max(r.score, 0.5);
    return r;
  },

  summary: function (S) {
    var rows = S.orders.filter(function (p) { return !p.basket; }).map(function (p) { return DS.TCA.order(S, p); });
    var ex = rows.length ? rows.reduce(function (a, r) { return a + r.score; }, 0) / rows.length : null;
    if (S.basket) {
      var st = DS.PT.stats(S);
      var pr = DS.PT.parents(S).map(function (p) { return DS.TCA.order(S, p); });
      var n = 0, w = 0, bench = 0, fillN = 0, totN = 0;
      pr.forEach(function (r) { var notional = r.p.filled * (r.avg || 0); if (r.vsBench != null) { n += notional; w += r.vsBench * notional; } fillN += r.p.filled * S.stocks[r.p.tkr].prevClose; totN += r.p.qty * S.stocks[r.p.tkr].prevClose; });
      bench = n ? w / n : 0;
      var est = S.basket.pre.costBps;
      var balance = 1 - Math.min(1, Math.abs(st.buyPct - st.sellPct) * 2);
      var perf = DS.clamp(0.55 + (bench + est) / (est * 2.5 + 10), 0, 1);
      ex = DS.clamp(perf * 0.5 + (fillN / totN) * 0.3 + balance * 0.2, 0, 1);
      S.ptSummary = { bench: bench, est: est, fill: fillN / totN, balance: balance, rows: pr, pnl: S.basket.mode === 'principal' ? DS.PT.pnl(S) : null, fut: DS.Orders.futPnl(S) };
    }
    var dec = S.score.items.filter(function (x) { return x.cat === 'decision' || x.cat === 'read' || x.cat === 'block'; });
    var col = S.score.items.filter(function (x) { return x.cat === 'color' || x.cat === 'client'; });
    var avg = function (a) { return a.length ? a.reduce(function (x, y) { return x + y.s; }, 0) / a.length : null; };
    var d = avg(dec), c = avg(col);
    var parts = [[ex, 0.45], [d, 0.35], [c != null ? (c * 0.6 + S.score.rel / 100 * 0.4) : S.score.rel / 100, 0.2]];
    var tot = 0, wt = 0;
    parts.forEach(function (x) { if (x[0] != null) { tot += x[0] * x[1]; wt += x[1]; } });
    var score = wt ? tot / wt : 0;
    var grade = score >= 0.88 ? 'A' : score >= 0.78 ? 'B+' : score >= 0.68 ? 'B' : score >= 0.58 ? 'C+' : score >= 0.48 ? 'C' : 'D';
    var shares = S.orders.reduce(function (a, p) { return a + p.filled; }, 0);
    var notional = S.orders.reduce(function (a, p) { return a + p.notional; }, 0);
    var comm = S.role === 'PT' ? (S.basket && S.basket.mode === 'principal' ? 0 : notional * 0.0002) : shares * 0.025;
    return { rows: rows, ex: ex, dec: d, col: c, rel: S.score.rel, score: score, grade: grade, comm: comm, shares: shares, notional: notional,
      missed: S.score.items.filter(function (x) { return x.s < 0.6 && x.best; }) };
  }
};
