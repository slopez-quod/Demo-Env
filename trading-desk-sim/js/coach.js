/* Trader coach: watches your orders and the tape and explains what a senior trader would notice. */
window.DS = window.DS || {};

DS.Log = {
  action: function (S, p, k) {
    var s = S.stocks[p.tkr];
    if (k.type === 'MKT') {
      var spreadX = (s.ask - s.bid) / s.mid * 1e4 / s.spr;
      if (S.t < 900 && spreadX > 1.8) DS.Desk.tip(S, 'mktopen' + p.id, 'warn', 'You sent a market order in ' + p.tkr + ' in the first 15 minutes while the spread is ' + spreadX.toFixed(1) + 'x normal. Opening spreads are the most expensive liquidity of the day.', p.tkr);
      if (k.qty / s.adv > 0.01) DS.Desk.tip(S, 'mktbig' + k.id, 'warn', 'That market order was ' + (k.qty / s.adv * 100).toFixed(1) + '% of ADV. It walked through several price levels; check the fill vs the mid at the time. Large size belongs in algos, dark or blocks.', p.tkr);
    }
    if (k.type === 'TWAP' && p.bench === 'VWAP') DS.Desk.tip(S, 'twapvwap' + p.id, 'info', 'TWAP on a VWAP-benchmarked order: TWAP trades evenly in time, so it will under-trade the busy open/close and over-trade lunch. Expect tracking error vs VWAP.', p.tkr);
    if ((k.type === 'VWAP' || k.type === 'TWAP' || k.type === 'IS') && p.maxPct && (!k.pct || k.pct > p.maxPct)) DS.Desk.tip(S, 'nocap' + k.id, 'warn', 'The client capped ' + p.tkr + ' at ' + Math.round(p.maxPct * 100) + '% of volume. The engine enforces the client cap on top of your ' + k.type + ', but set the cap on the strategy yourself so you are not relying on a safety net.', p.tkr);
    if (k.type === 'POV' && p.maxPct && k.pct > p.maxPct) DS.Desk.tip(S, 'povcap' + k.id, 'bad', 'POV ' + Math.round(k.pct * 100) + '% is above the client\'s ' + Math.round(p.maxPct * 100) + '% cap on ' + p.tkr + '. That is an instruction breach.', p.tkr);
    if (k.type === 'IS' && p.urgency === 'Low' && p.bench === 'VWAP') DS.Desk.tip(S, 'isvwap' + p.id, 'info', 'Arrival (IS) front-loads. On a low-urgency VWAP order that creates impact and tracking error you do not need.', p.tkr);
  },

  run: function (S) {
    if (S.t % 60 !== 0) return;
    var T = DS.tOf;
    S.orders.forEach(function (p) {
      if (p.status === 'done' || p.status === 'cxl' || p.basket) return;
      var s = S.stocks[p.tkr];
      var avail = DS.Orders.available(p);
      // Idle
      if (avail >= 100 && p.idleSince != null && S.t - p.idleSince >= 600) DS.Desk.tip(S, 'idle' + p.id + Math.floor(S.t / 3600), 'warn', p.tkr + ': ' + DS.fmtQty(avail) + ' shares with nothing working for ' + Math.round((S.t - p.idleSince) / 60) + ' minutes. An idle order is a decision too. If it is deliberate, tell the client.', p.tkr);
      if (p.status === 'new' && S.t - p.recvT >= 300) DS.Desk.tip(S, 'ack' + p.id, 'warn', p.tkr + ' order from ' + p.client.name + ' has not been started for 5 minutes. Acknowledge and start working, or tell the client why you are waiting.', p.tkr);
      // Participation cap
      var mv = s.cumV - p.cumV0;
      if (p.maxPct && mv > s.adv * 0.02) {
        var part = p.filled / mv;
        if (part > p.maxPct * 1.12) {
          if (!p.breaches.length || S.t - p.breaches[p.breaches.length - 1] > 1800) p.breaches.push(S.t);
          DS.Desk.tip(S, 'cap' + p.id + Math.floor(S.t / 1800), 'bad', p.tkr + ' participation is ' + (part * 100).toFixed(1) + '% vs the client\'s ' + Math.round(p.maxPct * 100) + '% cap. Slow down.', p.tkr);
        }
      }
      // Limit
      if (p.limit != null && ((p.side > 0 && s.mid > p.limit) || (p.side < 0 && s.mid < p.limit))) DS.Desk.tip(S, 'lim' + p.id + Math.floor(S.t / 3600), 'warn', p.tkr + ' is trading through the client\'s limit ' + p.limit.toFixed(2) + '. Strategies stop at the limit. Tell the client and ask whether they want to move it.', p.tkr);
      // Schedule vs curve
      if (p.bench === 'VWAP' && S.t - p.recvT > 1800) {
        var exp = (DS.curveAt(S.t) - DS.curveAt(p.recvT)) / Math.max(1e-6, 1 - DS.curveAt(p.recvT));
        var done = p.filled / p.qty;
        if (done < exp - 0.15) DS.Desk.tip(S, 'behind' + p.id + Math.floor(S.t / 3600), 'warn', p.tkr + ' is ' + Math.round(done * 100) + '% done vs ' + Math.round(exp * 100) + '% of the volume curve. Behind schedule on a VWAP order means a bigger catch-up later. Check limits, caps and whether enough is allocated.', p.tkr);
        if (done > exp + 0.2) DS.Desk.tip(S, 'ahead' + p.id + Math.floor(S.t / 3600), 'info', p.tkr + ' is ' + Math.round(done * 100) + '% done vs ' + Math.round(exp * 100) + '% of the curve. Ahead of VWAP schedule: fine if price is favorable, but it is a deviation from the benchmark the client chose.', p.tkr);
      }
      // Arrival, urgent, slow
      if (p.bench === 'ARRIVAL' && p.urgency === 'High' && S.t - p.recvT > 2400 && p.filled / p.qty < 0.35) DS.Desk.tip(S, 'slowurg' + p.id, 'warn', p.tkr + ' is a high-urgency arrival order and only ' + Math.round(p.filled / p.qty * 100) + '% done after 40 minutes. Every minute adds timing risk for this client.', p.tkr);
      // Wide spreads
      var sx = (s.ask - s.bid) / s.mid * 1e4 / s.spr;
      if (sx > 2.4 && S.t > 600) DS.Desk.tip(S, 'spr' + p.tkr + Math.floor(S.t / 1800), 'info', p.tkr + ' spread is ' + sx.toFixed(1) + 'x normal. Liquidity providers have stepped back, often after news. Aggressive orders pay more right now; passive and dark orders get paid.', p.tkr);
      // Tape reading: persistent one-sided flow
      if (s.flow && S.t < s.flow.until && S.t - s.flow.start >= 1200) {
        DS.Desk.tip(S, 'flow' + p.tkr, 'info', 'Tape read on ' + p.tkr + ': prints keep landing on the ' + (s.flow.side < 0 ? 'bid' : 'offer') + ', volume is ' + DS.Market.relVol(S, s).toFixed(1) + 'x normal and there have been large dark prints. That is the signature of a big ' + (s.flow.side < 0 ? 'seller' : 'buyer') + ' working an order. ' + (p.side === -s.flow.side ? 'For you that is natural liquidity: be patient and ask for a block.' : 'You are competing with them: consider more urgency or ask the client.'), p.tkr);
      }
      // Close
      if (p.bench === 'CLOSE' && S.t >= T('15:35') && S.t < T('15:50') && DS.Orders.mocGross(S, p.tkr) === 0 && p.filled < p.qty) DS.Desk.tip(S, 'moc' + p.id, 'bad', 'MOC cutoff is 15:50. ' + p.tkr + ' is a close-benchmark order with no MOC entered.', p.tkr);
      if (S.t === T('15:15') && p.filled / p.qty < 0.7 && avail + DS.Orders.working(p) > 0) DS.Desk.tip(S, 'compl' + p.id, 'warn', p.tkr + ' is ' + Math.round(p.filled / p.qty * 100) + '% done with 45 minutes left. Decide now: speed up within limits, use the close, or tell the client what will be left.', p.tkr);
    });
    if (S.t === T('15:50')) DS.Desk.tip(S, 'imbpub', 'info', 'Closing imbalances published. Check the imbalance column in the watchlist: a large buy imbalance pushes the close up, a sell imbalance pushes it down. After 15:50 only offsetting close orders are accepted.');
    if (S.t === 600) DS.Desk.tip(S, 'open10', 'info', 'First 10 minutes done. Spreads are narrowing and volume is settling. This is when most desks have their strategies fully running.');
  }
};
