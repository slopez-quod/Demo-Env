/* Builds a trading day for each role: morning notes, market events, client orders, chats and decision points. */
window.DS = window.DS || {};

(function () {
  var T = DS.tOf;
  function pct(x, d) { return DS.fmtPct(x, d == null ? 1 : d); }
  function client(name) { return DS.CLIENTS.filter(function (c) { return c.name === name; })[0]; }
  function at(S, hhmm, fn) { S.script.push({ t: typeof hhmm === 'number' ? hhmm : T(hhmm), run: fn }); }
  function liquid(S, minAdv, maxAdv, excl, sectors) {
    return S.tkrs.filter(function (k) {
      var s = S.stocks[k];
      return s.adv >= minAdv && s.adv <= maxAdv && excl.indexOf(k) < 0 && (!sectors || sectors.indexOf(s.sector) >= 0);
    });
  }
  function qtyPct(s, p) { return Math.max(1000, Math.round(s.adv * p / 1000) * 1000); }

  // Route helper used by decision effects.
  function R(S, p, type, frac, extra) {
    var q = frac ? DS.lot((p.qty - p.filled) * frac) : null;
    return DS.Orders.route(S, p, Object.assign({ type: type, qty: q }, extra || {}));
  }

  DS.Scen = {
    build: function (S) {
      var rng = DS.makeRng(S.seed * 7919 + 17);
      S.rng = DS.makeRng(S.seed * 104729 + 3);
      S.notes = []; S.events = []; S.script = [];
      DS.Market.build(S, rng);
      var macro = DS.Notes.macroPre(S, rng);
      var cal = DS.Notes.macroIntraday(S, rng);
      DS.Scen[S.role](S, rng);
      S.notes.unshift(macro);
      S.notes.unshift(DS.Scen.overnight(S, rng, cal));
      DS.Scen.marketReads(S);
      S.events.sort(function (a, b) { return a.t - b.t; });
      S.script.sort(function (a, b) { return a.t - b.t; });
    },

    overnight: function (S, rng, cal) {
      var g = S.mkt.gap, ny = rng.gauss() * 0.006 + g * 0.5, hs = rng.gauss() * 0.008, sx = rng.gauss() * 0.004 + g * 0.6;
      var body = 'ES ' + pct(g, 2) + ' indicated. Asia: Nikkei ' + pct(ny) + ', Hang Seng ' + pct(hs) + '. Europe: Stoxx 600 ' + pct(sx) + '. ' +
        'US 10y ' + (S.rates.prev + S.rates.gap / 100).toFixed(2) + '% (' + (S.rates.gap >= 0 ? '+' : '') + S.rates.gap.toFixed(1) + 'bp). WTI $' + (S.oil.prev * Math.exp(S.oil.gap)).toFixed(2) + ' (' + pct(S.oil.gap) + '). VIX ' + S.mkt.vixBase.toFixed(1) + '.';
      var calTxt = cal.map(function (c) { return c.at + ' ' + c.name + (c.est != null ? ' (est ' + c.est + ')' : ''); }).join(' · ');
      return {
        id: 'ON', cat: 'overnight', head: 'Overnight & futures', body: body + ' Today: ' + calTxt + '.', meta: { g: g },
        decode: function (S2, n) {
          return {
            what: 'The snapshot of what happened while the US was closed: futures, Asia and Europe, rates, oil and volatility, plus the scheduled events that can move the market today.',
            why: 'Futures tell you roughly where the index opens. A ' + pct(Math.abs(g), 2) + ' ' + (g >= 0 ? 'higher' : 'lower') + ' open moves every stock by its beta before any stock-specific news. The calendar tells you when to expect volatility bursts: be careful about running aggressive strategies through ' + calTxt + '.',
            expect: 'VIX around ' + S.mkt.vixBase.toFixed(0) + (S.mkt.vixBase > 18 ? ' is elevated: bigger intraday swings, wider spreads, more timing risk.' : ' is calm-to-normal: intraday ranges should be ordinary.'),
            buy: 'A lower open helps buyers of high-beta names. A higher open means part of the move already happened: do not chase it.',
            sell: 'A higher open helps sellers. Into a lower open, be careful not to sell into the first-minute air pocket.'
          };
        }
      };
    },

    // Market-read quizzes (all roles)
    marketReads: function (S) {
      var times = S.role === 'PT' ? ['10:40', '13:15', '14:45'] : ['10:35', '12:50', '14:50'];
      times.forEach(function (h) { at(S, h, function (S) { DS.Desk.decide(S, DS.Scen.marketReadQ(S)); }); });
    },

    marketReadQ: function (S) {
      var sp = S.mkt.lvl / S.mkt.prev - 1;
      var sec = S.sectors, dy = (S.rates.y - S.rates.prev) * 100;
      var g = (sec.SEMI.perf + sec.SOFT.perf + sec.INTN.perf) / 3;
      var d = (sec.UTIL.perf + sec.HLTH.perf + sec.CONS.perf) / 3;
      var v = (sec.BANK.perf + sec.ENGY.perf + sec.INDU.perf) / 3;
      var ranked = Object.keys(sec).sort(function (a, b) { return sec[b].perf - sec[a].perf; });
      var best = ranked[0], worst = ranked[ranked.length - 1];
      var K = {
        riskon: { t: 'Risk-on: high-beta growth leading, defensives lagging. Buyers are paying up for beta.', why: 'Growth (Semis/Software/Internet) is ahead of defensives (Utilities/Healthcare/Consumer) with the index up.' },
        riskoff: { t: 'Risk-off: index down, defensives holding up, high-beta names hit hardest.', why: 'Defensives outperform growth while the index falls and VIX rises.' },
        value: { t: 'Rotation into value/financials on higher yields; long-duration growth under pressure.', why: 'Yields up with Banks/Energy/Industrials beating Growth names.' },
        ratesdown: { t: 'Lower yields are lifting long-duration growth; financials lag.', why: 'Yields down with Growth beating Value/Financials.' },
        quiet: { t: 'Quiet index, stock-specific tape: the action is in individual names and news, not macro.', why: 'The index is flat and group moves are small, so dispersion comes from single-stock news.' },
        broadup: { t: 'Broad, orderly rally: most groups up together with little rotation.', why: 'Index up, groups moving together.' },
        broaddn: { t: 'Broad, orderly selloff: most groups down together with little rotation.', why: 'Index down, groups moving together.' }
      };
      var key;
      if (sp < -0.004 && d - g > 0.004) key = 'riskoff';
      else if (dy > 2 && v - g > 0.004) key = 'value';
      else if (dy < -2 && g - v > 0.004) key = 'ratesdown';
      else if (sp > 0.004 && g - d > 0.004) key = 'riskon';
      else if (Math.abs(sp) < 0.003) key = 'quiet';
      else key = sp > 0 ? 'broadup' : 'broaddn';
      var others = DS.makeRng(Math.floor(S.t) + 7).shuffle(Object.keys(K).filter(function (k) { return k !== key && !(key === 'broadup' && k === 'riskon') && !(key === 'riskon' && k === 'broadup'); })).slice(0, 3);
      var opts = [key].concat(others).map(function (k) {
        return { t: K[k].t, s: k === key ? 1 : 0, why: k === key ? 'Correct. ' + K[key].why : 'Not quite. ' + K[key].t + ' ' + K[key].why };
      });
      opts = DS.makeRng(Math.floor(S.t) + 3).shuffle(opts);
      var tbl = '<table class="mini"><tr><th>SPX</th><td class="' + (sp >= 0 ? 'up' : 'dn') + '">' + pct(sp, 2) + '</td><th>10y</th><td>' + S.rates.y.toFixed(3) + '% (' + (dy >= 0 ? '+' : '') + dy.toFixed(1) + 'bp)</td><th>VIX</th><td>' + S.mkt.vix.toFixed(1) + '</td></tr></table>' +
        '<div class="secbars">' + ranked.map(function (k) { return '<div><span>' + DS.SECTORS[k].short + '</span><b class="' + (sec[k].perf >= 0 ? 'up' : 'dn') + '">' + pct(sec[k].perf) + '</b></div>'; }).join('') + '</div>';
      var mine = DS.Scen.tideNote(S, sp);
      opts.forEach(function (o) { o.why += mine; });
      return {
        cat: 'read', title: 'Market read at ' + DS.hhmm(S.t),
        ctx: '<p>Take ten seconds to read the tape before you answer. What is the market telling you?</p>' + tbl +
          '<p class="muted">Leader: ' + DS.SECTORS[best].short + ' ' + pct(sec[best].perf) + ' · Laggard: ' + DS.SECTORS[worst].short + ' ' + pct(sec[worst].perf) + '</p>',
        options: opts
      };
    },

    tideNote: function (S, sp) {
      var live = S.orders.filter(function (p) { return p.status === 'working' || p.status === 'new'; });
      if (!live.length) return '';
      var p = live[0], s = S.stocks[p.tkr];
      var rel = DS.Market.chg(s) - S.sectors[s.sector].perf;
      var with_ = (p.side > 0 && DS.Market.chg(s) < 0) || (p.side < 0 && DS.Market.chg(s) > 0);
      return ' For your ' + DS.sideTxt(p.side) + ' in ' + p.tkr + ': the stock is ' + pct(DS.Market.chg(s)) + ', ' + pct(rel) + ' vs its sector. The tide is ' + (with_ ? 'with you: no need to rush.' : 'against you: stay on schedule, do not fall behind.');
    },

    // ---------- Chat helpers shared by roles ----------
    colorChoices: function (S, p) {
      var s = S.stocks[p.tkr], sec = S.sectors[s.sector];
      var sp = S.mkt.lvl / S.mkt.prev - 1;
      var rv = DS.Market.relVol(S, s);
      var aggr = s.aggB / Math.max(1, s.aggB + s.aggS);
      var exp = DS.clamp((DS.curveAt(S.t) - DS.curveAt(p.recvT)) / Math.max(1e-6, 1 - DS.curveAt(p.recvT)), 0, 1);
      var done = p.filled / p.qty;
      var avg = DS.Orders.avgPx(p);
      var iv = (s.cumPV - p.cumPV0) / Math.max(1, s.cumV - p.cumV0);
      var flow = aggr > 0.56 ? 'buyers more aggressive on the tape' : aggr < 0.44 ? 'sellers in control on the tape, prints mostly on the bid' : 'two-way flow, nothing one-sided';
      var vsB = avg ? (p.side * (iv - avg) / iv * 1e4) : 0;
      var good = p.tkr + ' ' + pct(DS.Market.chg(s)) + ', ' + DS.SECTORS[s.sector].short + ' ' + pct(sec.perf) + ', SPX ' + pct(sp, 2) + '. Volume ' + rv.toFixed(1) + 'x normal, ' + flow + '. You\'re ' + Math.round(done * 100) + '% done vs ' + Math.round(exp * 100) + '% of the volume curve' +
        (avg ? ', avg ' + avg.toFixed(2) + ' vs interval VWAP ' + iv.toFixed(2) + ' (' + (vsB >= 0 ? 'ahead ' : 'behind ') + Math.abs(vsB).toFixed(1) + 'bps)' : '') + '. ' +
        (done + 0.05 < exp ? 'We\'re a bit behind and will pick up the pace within your limits.' : 'Happy with the pace; will flag anything that changes.');
      var opts = [
        { t: good, s: 1, why: 'Strong color: what the stock and sector are doing, the volume and flow picture, and where the order stands vs benchmark. Facts the client can act on.' },
        { t: 'All good, working it. Will keep you posted.', s: 0.25, why: 'Polite but empty. The client asked because they want information: price vs sector, volume, flow and progress vs benchmark.' },
        { t: 'Stock looks heavy. FYI we have another big client selling it today so there\'s plenty of supply around.', s: 0, why: 'Never disclose another client\'s order. That is a serious breach of confidentiality, even if it seems helpful.' },
        { t: 'I think it goes higher from here, you should probably add to the order now.', s: 0.1, why: 'An agency trader gives facts and flow, not price predictions. Investment views are the PM\'s job; guessing direction undermines your credibility.' }
      ];
      return DS.makeRng(S.t + p.qty).shuffle(opts);
    },

    sectorColorChoices: function (S, secs) {
      var sp = S.mkt.lvl / S.mkt.prev - 1;
      var names = S.tkrs.filter(function (k) { return secs.indexOf(S.stocks[k].sector) >= 0; }).map(function (k) { return S.stocks[k]; });
      names.sort(function (a, b) { return DS.Market.chg(b) - DS.Market.chg(a); });
      var lead = names[0], lag = names[names.length - 1];
      var busiest = names.slice().sort(function (a, b) { return DS.Market.relVol(S, b) - DS.Market.relVol(S, a); })[0];
      var secTxt = secs.map(function (k) { return DS.SECTORS[k].short + ' ' + pct(S.sectors[k].perf); }).join(', ');
      var news = S.news.filter(function (n) { return n.tkr && secs.indexOf(S.stocks[n.tkr].sector) >= 0; })[0];
      var why = news ? ' Driver: ' + news.head.toLowerCase().slice(0, 90) + '.' : '';
      var good = secTxt + ' vs SPX ' + pct(sp, 2) + '. Leader ' + lead.tkr + ' ' + pct(DS.Market.chg(lead)) + ', laggard ' + lag.tkr + ' ' + pct(DS.Market.chg(lag)) + '. Busiest is ' + busiest.tkr + ' at ' + DS.Market.relVol(S, busiest).toFixed(1) + 'x normal volume.' + why + ' Our flow: ' + (S.sectors[secs[0]].perf > sp ? 'better buyers, mostly long-only.' : 'better sellers, mix of HF and programs.');
      var opts = [
        { t: good, s: 1, why: 'Good sector color: relative performance vs the index, leaders and laggards, where the volume is, the driver, and aggregate desk flow without naming clients.' },
        { t: 'Semis and software are moving around a lot today, tough tape.', s: 0.2, why: 'No numbers, no driver, no flow. A PM cannot do anything with this.' },
        { t: lead.tkr + ' is up because Atlas Peak is buying a ton of it through us.', s: 0, why: 'Naming another client and their order is a confidentiality breach. Talk about flow in aggregate only.' },
        { t: 'Sector is ' + pct(S.sectors[secs[0]].perf) + '. Not much else to say.', s: 0.4, why: 'Accurate but thin. Add relative performance vs SPX, the leaders/laggards and why, and what the desk is seeing.' }
      ];
      return DS.makeRng(S.t + 11).shuffle(opts);
    },

    clientColorChat: function (S, p, prompt) {
      if (!p || p.status === 'cxl') return;
      var c = p.client;
      var ch = DS.Scen.colorChoices(S, p);
      var best = 0; ch.forEach(function (o, i) { if (o.s > ch[best].s) best = i; });
      DS.Desk.chat(S, { from: c.contact + ' · ' + c.name, kind: 'client', text: prompt, choices: ch, cat: 'color', title: 'Color for ' + c.name + ' (' + p.tkr + ')', best: best, tkr: p.tkr });
    },

    blockIOI: function (S, p, frac, edgeBps, note) {
      if (!p || p.status === 'done' || p.status === 'cxl') return;
      var s = S.stocks[p.tkr];
      var avail = DS.Orders.available(p) + DS.Orders.working(p);
      var q = DS.lot(Math.min(avail, p.qty * frac));
      if (q < 1000) return;
      var px = DS.round(s.mid * (1 + p.side * edgeBps / 1e4), 2);
      var remPct = (p.qty - p.filled) / s.adv;
      var estImpact = 0.7 * s.sd * Math.sqrt(remPct) * 1e4 * 0.7;
      var vsMid = p.side * (px - s.mid) / s.mid * 1e4;
      var good = vsMid < estImpact * 0.8;
      var ch = [
        { t: 'Take all ' + DS.fmtQty(q) + ' at ' + px.toFixed(2), s: good ? 1 : 0.3,
          why: (good ? 'Right call. ' : 'Debatable. ') + 'The block costs ' + vsMid.toFixed(1) + 'bps vs mid. Working the remaining ' + (remPct * 100).toFixed(0) + '% of ADV through algos would cost roughly ' + estImpact.toFixed(0) + 'bps of impact, plus timing risk. ' + (good ? 'Blocks this size with a natural are the best liquidity you will see.' : 'This one is priced aggressively; taking part or countering might be better.'),
          fx: function (S) { DS.Scen.takeBlock(S, p, q, px); } },
        { t: 'Take half (' + DS.fmtQty(DS.lot(q / 2)) + ')', s: good ? 0.6 : 0.7, why: 'A compromise. You reduce footprint but leave natural liquidity on the table that may not come back.', fx: function (S) { DS.Scen.takeBlock(S, p, DS.lot(q / 2), px); } },
        { t: 'Counter at the mid', s: good ? 0.65 : 0.9, why: 'Countering is reasonable when the price is rich, but naturals can walk. ' + (good ? 'Here the price was already fair, so the counter risked losing the block.' : 'Here the price was rich, so a counter was the right instinct.'),
          fx: function (S) {
            var ok = S.rng.next() < (good ? 0.45 : 0.6);
            at(S, S.t + 90, function (S) {
              if (ok) { var m = DS.round(S.stocks[p.tkr].mid, 2); DS.Scen.takeBlock(S, p, DS.lot(q * 0.6), m); DS.Desk.chat(S, { from: 'Sales trader', kind: 'sales', text: 'Contra agreed at the mid but cut size: printed ' + DS.fmtQty(DS.lot(q * 0.6)) + ' ' + p.tkr + ' at ' + m.toFixed(2) + '.' }); }
              else DS.Desk.chat(S, { from: 'Sales trader', kind: 'sales', text: 'Contra passed on the counter, they are working it in the market instead.' });
            });
          } },
        { t: 'Pass, the algo will do better', s: good ? 0.1 : 0.5, why: good ? 'Passing on a fairly priced natural block in a large order is the most expensive mistake on a high-touch desk. The algo has to find that same liquidity one print at a time, with impact.' : 'Defensible given the price, but you still need to find the liquidity elsewhere.' }
      ];
      var best = 0; ch.forEach(function (o, i) { if (o.s > ch[best].s) best = i; });
      DS.Desk.chat(S, {
        from: 'Sales trader', kind: 'sales', tkr: p.tkr, cat: 'block', title: 'Block in ' + p.tkr, best: best,
        text: (note || 'I have a natural ' + (p.side > 0 ? 'seller' : 'buyer') + ' in ' + p.tkr + '.') + ' ' + DS.fmtQty(q) + ' shares, will print at ' + px.toFixed(2) + ' (mid ' + s.mid.toFixed(2) + '). That\'s ' + (q / s.adv * 100).toFixed(1) + '% of ADV. Interested for your ' + p.client.name + ' order?',
        choices: ch
      });
    },

    takeBlock: function (S, p, q, px) {
      // Make room by trimming live strategies if needed
      var need = q - DS.Orders.available(p);
      if (need > 0) p.kids.forEach(function (k) {
        if (need <= 0 || k.status !== 'active' || k.type === 'MOC') return;
        var free = k.qty - k.filled, cut = Math.min(free, need);
        k.qty -= cut; need -= cut;
        if (k.qty <= k.filled) k.status = 'done';
      });
      var got = DS.Orders.crossBlock(S, p, q, px);
      if (got) DS.Desk.chat(S, { from: 'Desk', kind: 'system', text: 'Block printed: ' + DS.sideTxt(p.side) + ' ' + DS.fmtQty(got) + ' ' + p.tkr + ' @ ' + px.toFixed(2) + ' for ' + p.client.name + '.' });
    },

    newsOnOrderDecision: function (S, ev) {
      var live = S.orders.filter(function (p) { return p.tkr === ev.target && (p.status === 'working' || p.status === 'new'); });
      if (!live.length || ev.scope !== 'stock') return;
      var p = live[0];
      var helps = (p.side > 0 && ev.jump < 0) || (p.side < 0 && ev.jump > 0);
      DS.Desk.decide(S, {
        cat: 'decision', title: 'Headline on a name you are working',
        ctx: '<p class="squawk">' + DS.esc(ev.head) + '</p><p>You are working a <b>' + DS.sideTxt(p.side) + ' ' + DS.fmtQty(p.qty) + ' ' + p.tkr + '</b> for ' + p.client.name + ' (' + Math.round(p.filled / p.qty * 100) + '% done). The stock just moved ' + pct(ev.jump) + '. What do you do first?</p>',
        options: [
          { t: 'Pause aggressive slicing, then message the client with the headline, the new level and ask whether they want to change the order.', s: 1,
            why: 'Material news changes the trade. The client decides, you inform. Pausing stops an algo from executing through the dislocation while you talk.',
            fx: function (S) {
              p.kids.forEach(function (k) { if (k.status === 'active' && k.type !== 'MOC' && k.type !== 'DARK') k.status = 'cxl'; });
              DS.Orders.checkIdle(S, p);
              at(S, S.t + 60, function (S) {
                DS.Desk.chat(S, { from: p.client.contact + ' · ' + p.client.name, kind: 'client', text: helps ? 'Thanks for the heads up. This works in our favor, keep going and lean in a bit while the liquidity is there.' : 'Appreciate the call. Keep going but be patient, no chasing. Stick to the limit.' });
              });
            } },
          { t: 'Keep the algo running. The client gave the order, it is not my job to second-guess it.', s: 0.25,
            why: 'Technically you have an order, but a good high-touch trader never lets a client find out about material news on their name from someone else. The client may want to cancel or change urgency.' },
          { t: 'Cancel the order immediately to protect the client.', s: 0.15, why: 'Only the client can cancel. Pausing is fine, cancelling without instruction is not.',
            fx: function (S) { DS.Orders.cancelParent(S, p); } },
          { t: helps ? 'Send a market order for the rest now while the price is good.' : 'Double the participation rate to get ahead of it.', s: 0.1,
            why: 'Reacting with aggression before talking to the client, into the widest spreads of the move, is how you get the worst prints of the day.' }
        ]
      });
    },

    // ======================= HIGH TOUCH =======================
    HT: function (S, rng) {
      var used = [];
      var upName = rng.pick(liquid(S, 4e6, 2e7, used).filter(function (k) { return S.stocks[k].sector !== 'UTIL'; })); used.push(upName);
      var erName = rng.pick(liquid(S, 2e6, 2e7, used)); used.push(erName);
      var flowName = rng.pick(liquid(S, 2.2e6, 5e6, used).filter(function (k) { return S.stocks[k].vol < 0.36; })); used.push(flowName);
      var closeName = rng.pick(liquid(S, 1.4e6, 4e6, used)); used.push(closeName);
      var dnName = rng.pick(liquid(S, 1e6, 2e7, used)); used.push(dnName);
      var ptName = rng.pick(liquid(S, 1e6, 2e7, used)); used.push(ptName);
      var hlName = rng.pick(liquid(S, 1e6, 2e7, used)); used.push(hlName);
      var B1 = DS.BROKERS.filter(function (b) { return b.tier === 1; });

      S.notes.push(DS.Notes.research(S, rng, S.stocks[upName], 'up', rng.pick(B1)));
      S.notes.push(DS.Notes.research(S, rng, S.stocks[dnName], 'down', rng.pick(DS.BROKERS.slice(0, 5))));
      S.notes.push(DS.Notes.research(S, rng, S.stocks[ptName], 'pt-up', rng.pick(DS.BROKERS.slice(3))));
      S.notes.push(DS.Notes.earnings(S, rng, S.stocks[erName], rng.pick(['beat-cut', 'miss', 'beat-raise'])));
      var fs = S.stocks[flowName];
      S.notes.push(DS.Notes.flowColor(S, rng, ['We hear a large holder has been liquidating ' + flowName + ' for two days (prints on the bid into the close). Expect more supply today.']));
      S.events.push({ t: T('11:20'), scope: 'stock', target: flowName, drift: -0.012, dur: T('14:40') - T('11:20'), flowSide: -1, flowSkew: 0.22, vm: 1.6, vmHalf: 7200 });
      S.stocks[closeName].closeBias = 0.025;
      var ers = S.stocks[erName];

      // Client orders
      var u = S.stocks[upName];
      var o1 = { tkr: upName, side: 1, qty: qtyPct(u, rng.range(0.1, 0.13)), bench: 'VWAP', urgency: 'Low', maxPct: 0.15, client: client('Atlas Peak Asset Mgmt') };
      at(S, 60, function (S) {
        o1.limit = DS.round(S.stocks[upName].mid * 1.045, 2);
        var p = DS.Orders.newParent(S, o1);
        p.instr = 'VWAP today, max 15% of volume, limit ' + p.limit.toFixed(2) + '. "We like the call but don\'t want to chase it."';
        S.byKey.o1 = p;
        DS.Desk.chat(S, { from: 'Dana (PM) · Atlas Peak', kind: 'client', text: 'Morning. Buy ' + DS.fmtInt(p.qty) + ' ' + upName + ', VWAP today, no more than 15% of volume, limit ' + p.limit.toFixed(2) + '. We like the upgrade but don\'t want to chase it.' });
        DS.Desk.decide(S, DS.Scen.gapChaseQ(S, p));
      });

      var o2side = ers.gap < 0 ? -1 : -1;
      var o2 = { tkr: erName, side: o2side, qty: qtyPct(ers, rng.range(0.05, 0.07)), bench: 'ARRIVAL', urgency: 'High', maxPct: null, client: client('Kestrel Capital') };
      at(S, '10:05', function (S) {
        var p = DS.Orders.newParent(S, o2);
        p.instr = 'Arrival benchmark, high urgency. Done by late morning. Info-sensitive.';
        S.byKey.o2 = p;
        DS.Desk.chat(S, { from: 'Marco (PM) · Kestrel', kind: 'client', text: 'Sell ' + DS.fmtInt(p.qty) + ' ' + erName + ', arrival. ' + (ers.gap < 0 ? 'Thesis is broken after that guide.' : 'Taking profits after the print.') + ' Need it done by late morning and nobody needs to know we\'re out.' });
        DS.Desk.decide(S, DS.Scen.urgentQ(S, p));
      });
      DS.Notes.headline(S, rng, ers, rng.pick(['downgradeIntra', 'ceo', 'contract']), '10:48');

      var o3 = { tkr: flowName, side: 1, qty: qtyPct(fs, rng.range(0.27, 0.33)), bench: 'VWAP', urgency: 'Low', maxPct: 0.2, client: client('Bluewater Pension') };
      at(S, '11:10', function (S) {
        var p = DS.Orders.newParent(S, o3);
        p.instr = 'VWAP to close, max 20%. Blocks welcome. Do not show size.';
        S.byKey.o3 = p;
        DS.Desk.chat(S, { from: 'Rob (Trader) · Bluewater', kind: 'client', text: 'We need to buy ' + DS.fmtInt(p.qty) + ' ' + flowName + '. Big for the name, so take your time: VWAP to the close, max 20%. Happy to take blocks, just don\'t show the size.' });
        DS.Desk.decide(S, DS.Scen.bigOrderQ(S, p));
      });
      at(S, '11:52', function (S) { DS.Scen.blockIOI(S, S.byKey.o3, S.flags.askedSales ? 0.3 : 0.18, -4, 'Natural seller in ' + flowName + ', the same holder that has been liquidating.'); });
      at(S, '13:28', function (S) { DS.Scen.blockIOI(S, S.byKey.o3, 0.25, 9, 'Second look from the ' + flowName + ' seller, they want to finish today.'); });

      at(S, '10:55', function (S) { DS.Scen.clientColorChat(S, S.byKey.o1, 'How are we doing in ' + upName + '? Any color?'); });
      at(S, '12:10', function (S) {
        var p = S.byKey.o1; if (!p || p.status === 'cxl') return;
        var add = DS.lot(p.qty * 0.4);
        DS.Desk.chat(S, {
          from: 'Dana (PM) · Atlas Peak', kind: 'client', cat: 'client', title: 'Upsize in ' + upName,
          text: 'Add ' + DS.fmtInt(add) + ' ' + upName + ' to the order, same terms. Can you still get it done today within 15%?',
          choices: [
            { t: 'Done, upsized. I\'ll re-plan the remainder on VWAP to the close inside 15%, and tell you by 14:30 if it looks like it won\'t complete.', s: 1, why: 'Accept, re-plan the remaining shares on a fresh schedule within the cap, and set expectations on completion risk. That is exactly what a PM wants to hear.',
              fx: function (S) { p.qty += add; if (p.status === 'done') { p.status = 'working'; p.doneT = null; } }, reply: 'Perfect, thanks.' },
            { t: 'Upsized. I\'ll go to 30% for an hour to catch up.', s: 0.1, why: 'Breaching the client\'s 15% cap is a compliance failure, no matter the reason. You can only catch up within the constraints.', fx: function (S) { p.qty += add; if (p.status === 'done') { p.status = 'working'; p.doneT = null; } }, reply: 'Wait, we said 15% max. Please stick to it.' },
            { t: 'We\'re too far behind, I\'d rather not.', s: 0.2, why: 'Refusing size is rarely right. Accept it and manage expectations about completion.', reply: 'Hm, ok. I\'ll give it to someone else then.' },
            { t: 'Upsized, I\'ll put the extra in the close.', s: 0.5, why: 'Not crazy for part of it, but dumping all the upsize into the close in a stock with a VWAP benchmark adds tracking error and close impact. Re-plan the whole remainder instead.', fx: function (S) { p.qty += add; if (p.status === 'done') { p.status = 'working'; p.doneT = null; } DS.Orders.route(S, p, { type: 'MOC', qty: add }); }, reply: 'Fine.' }
          ]
        });
      });

      var cs = S.stocks[closeName];
      var o4 = { tkr: closeName, side: -1, qty: qtyPct(cs, rng.range(0.035, 0.05)), bench: 'CLOSE', urgency: 'Medium', maxPct: 0.1, client: client('Ironwood Quant') };
      at(S, '13:40', function (S) {
        var p = DS.Orders.newParent(S, o4);
        p.instr = 'Close benchmark. Max 10% participation.';
        S.byKey.o4 = p;
        DS.Desk.chat(S, { from: 'Execution desk · Ironwood', kind: 'client', text: 'Sell ' + DS.fmtInt(p.qty) + ' ' + closeName + ', benchmark close, max 10%.' });
        DS.Desk.decide(S, DS.Scen.closeQ(S, p));
      });
      at(S, '14:25', function (S) { DS.Scen.clientColorChat(S, S.byKey.o3, 'How\'s ' + flowName + ' looking? Are we getting it done?'); });
      at(S, T('15:50') + 20, function (S) { DS.Scen.imbalanceQ(S, S.byKey.o4); });

      var hlKind = rng.pick(['mna', 'contract', 'index']);
      DS.Notes.headline(S, rng, S.stocks[hlName], hlKind, '13:05');
    },

    gapChaseQ: function (S, p) {
      var s = S.stocks[p.tkr];
      return {
        cat: 'decision', title: 'Opening plan for ' + p.tkr,
        ctx: '<p>' + p.tkr + ' opened <b>' + pct(DS.Market.chg(s)) + '</b> on the upgrade. The spread is ' + ((s.ask - s.bid) / s.mid * 1e4).toFixed(1) + 'bps (normal ' + s.spr.toFixed(1) + 'bps). Your order is <b>' + (p.qty / s.adv * 100).toFixed(1) + '% of ADV</b>, VWAP benchmark, 15% max, from a long-only that "doesn\'t want to chase it".</p><p>How do you start?</p>',
        options: [
          { t: 'VWAP to the close capped at 15%, plus a dark aggregator for ~20% of the order to capture spread.', s: 1, why: 'Matches the benchmark and the instruction. VWAP takes its fair share of the heavy opening volume without forcing it, and dark saves spread while it is wide.',
            fx: function (S) { R(S, p, 'VWAP', 0.8, { pct: 0.15 }); R(S, p, 'DARK', 1); } },
          { t: 'Market order for 25% now to get ahead before it runs, then VWAP the rest.', s: 0.05, why: 'This is "chasing it", the one thing the client said not to do, into the widest spreads of the day. On a VWAP benchmark, front-loading also creates tracking error.',
            fx: function (S) { R(S, p, 'MKT', 0.25); R(S, p, 'VWAP', 1, { pct: 0.15 }); } },
          { t: 'Wait until 11:00 for the gap to settle, then start.', s: 0.35, why: 'Tempting, but the VWAP benchmark includes the heavy opening volume. Skipping it is a directional bet (that the gap fades) that the client did not ask you to make.', fx: function (S) { DS.Desk.tip(S, 'wait11', 'info', 'You chose to wait. Start a strategy on ' + p.tkr + ' when you are ready: select the order and use the ticket.', p.tkr); } },
          { t: 'TWAP to the close.', s: 0.5, why: 'TWAP ignores the volume curve: it under-trades the busy open and over-trades the thin lunch hour, so it will track VWAP poorly.', fx: function (S) { R(S, p, 'TWAP', 1, { pct: 0.15 }); } }
        ]
      };
    },

    urgentQ: function (S, p) {
      var s = S.stocks[p.tkr];
      return {
        cat: 'decision', title: 'Urgent hedge fund sell in ' + p.tkr,
        ctx: '<p>Kestrel wants out of <b>' + DS.fmtInt(p.qty) + ' ' + p.tkr + '</b> (' + (p.qty / s.adv * 100).toFixed(1) + '% ADV), arrival benchmark, by late morning. The stock is ' + pct(DS.Market.chg(s)) + ' today on earnings and trading ' + DS.Market.relVol(S, s).toFixed(1) + 'x normal volume.</p><p>Which strategy?</p>',
        options: [
          { t: 'Arrival (IS), high urgency, ending 11:45, with a dark aggregator alongside for ~25%.', s: 1, why: 'Arrival benchmark + fast alpha decay = front-load. The elevated volume today absorbs a higher rate cheaply, and dark keeps the footprint down for an info-sensitive client.',
            fx: function (S) { R(S, p, 'IS', 0.75, { urg: 'High', end: T('11:45') }); R(S, p, 'DARK', 1); } },
          { t: 'VWAP to the close.', s: 0.2, why: 'Spreads the order over the whole day. Against an arrival benchmark that leaves you exposed to hours of drift, and it ignores "done by late morning".', fx: function (S) { R(S, p, 'VWAP', 1); } },
          { t: 'Market order for the full size right now.', s: 0.1, why: 'Fast, but it walks the book and shows the whole size to the street at once. Huge impact and the opposite of "nobody needs to know".', fx: function (S) { R(S, p, 'MKT', 1); } },
          { t: 'POV at 5% for the day.', s: 0.3, why: 'Too slow for an urgent client: 5% of volume will not finish by late morning.', fx: function (S) { R(S, p, 'POV', 1, { pct: 0.05 }); } }
        ]
      };
    },

    bigOrderQ: function (S, p) {
      var s = S.stocks[p.tkr];
      return {
        cat: 'decision', title: 'Large pension order in ' + p.tkr,
        ctx: '<p>Bluewater wants <b>' + DS.fmtInt(p.qty) + ' ' + p.tkr + '</b>, which is <b>' + (p.qty / s.adv * 100).toFixed(0) + '% of ADV</b>, starting at 11:10 with only ' + Math.round((1 - DS.curveAt(S.t)) * 100) + '% of the day\'s volume left. Max 20%. The morning note mentioned a holder liquidating this name.</p><p>What is your plan?</p>',
        options: [
          { t: 'VWAP to close at 20% max for ~70%, dark aggregator for the rest, and ask sales to find the seller for a block.', s: 1, why: 'At this size the algo alone cannot finish: max 20% of the remaining volume is less than the order. The missing piece is block liquidity, and the note told you a natural seller exists. Ask for it.',
            fx: function (S) { S.flags.askedSales = true; R(S, p, 'VWAP', 0.7, { pct: 0.2 }); R(S, p, 'DARK', 1); DS.Desk.chat(S, { from: 'Sales trader', kind: 'sales', text: 'On it. I\'ll call around for the ' + p.tkr + ' seller, will come back to you.' }); } },
          { t: 'POV at 25% to make sure it gets done.', s: 0.2, why: 'Breaches the client\'s 20% cap. Completion pressure never justifies breaking an instruction; tell the client instead.', fx: function (S) { R(S, p, 'POV', 1, { pct: 0.25 }); } },
          { t: 'Arrival (IS) high urgency.', s: 0.1, why: 'A patient pension, a VWAP benchmark and a huge %ADV: urgency is the worst combination. Impact would be enormous.', fx: function (S) { R(S, p, 'IS', 1, { urg: 'High' }); } },
          { t: 'VWAP to close at 20% max for the full size.', s: 0.6, why: 'Respects the instruction, but the algo alone cannot finish this size and ignores the natural seller you read about this morning.', fx: function (S) { R(S, p, 'VWAP', 1, { pct: 0.2 }); } }
        ]
      };
    },

    closeQ: function (S, p) {
      var s = S.stocks[p.tkr];
      var auct = s.adv * DS.CLOSE_FRAC;
      return {
        cat: 'decision', title: 'Close-benchmark sell in ' + p.tkr,
        ctx: '<p>Ironwood: sell <b>' + DS.fmtInt(p.qty) + ' ' + p.tkr + '</b> vs the close, max 10%. A typical closing auction in this name is about <b>' + DS.fmtQty(auct) + '</b> shares, so your order alone would be ' + Math.round(p.qty / auct * 100) + '% of it.</p><p>How do you execute?</p>',
        options: [
          { t: 'Half on a VWAP from now until 15:50 (10% cap), half MOC.', s: 1, why: 'The standard "target close" approach: trade part in the run-up to the close so you are not a huge share of the auction, and put the rest MOC to lock in the benchmark. Minimizes both close impact and tracking error.',
            fx: function (S) { R(S, p, 'VWAP', 0.5, { pct: 0.1, end: T('15:50') }); R(S, p, 'MOC', 1); } },
          { t: 'All MOC now.', s: 0.6, why: 'Zero tracking error vs the close, but you become a large part of the auction and push the closing price down against your own client.', fx: function (S) { R(S, p, 'MOC', 1); } },
          { t: 'VWAP from now to 16:00 for the full size.', s: 0.4, why: 'The benchmark is the close price, not the afternoon VWAP. Trading through the afternoon creates tracking error vs the close.', fx: function (S) { R(S, p, 'VWAP', 1, { pct: 0.1 }); } },
          { t: 'Wait for the 15:50 imbalance, then decide.', s: 0.2, why: 'The MOC cutoff is 15:50, the same moment the imbalance publishes. After that you can only enter orders that offset the imbalance. Waiting leaves you exposed.', fx: function (S) { } }
        ]
      };
    },

    imbalanceQ: function (S, p) {
      if (!p) return;
      var s = S.stocks[p.tkr], im = s.imb;
      if (!im) return;
      var rem = p.qty - p.filled - DS.Orders.mocGross(S, p.tkr);
      var offset = im.q * p.side < 0;
      var moc = DS.Orders.mocGross(S, p.tkr);
      var opts = [];
      opts.push({ t: rem > 0 && offset ? 'Enter the remaining ' + DS.fmtQty(rem) + ' as an imbalance-offsetting close order.' : 'Leave it. My close order is in and the imbalance is on my side.',
        s: 1, why: (offset ? 'The imbalance is ' + DS.fmtQty(Math.abs(im.q)) + ' to ' + (im.q > 0 ? 'BUY' : 'SELL') + ', the opposite of your side, so you are the liquidity the auction needs. Offsetting orders are allowed after 15:50 and get the close price.' : 'The imbalance is on your side, so adding more would push the close against you.'),
        fx: function (S) { if (rem > 0 && offset) DS.Orders.route(S, p, { type: 'MOC', qty: rem }); } });
      opts.push({ t: 'Cancel my MOC and sell the rest on the screen now.', s: 0.1, why: 'MOC orders cannot be cancelled after 15:50, and selling on the screen ahead of the close creates tracking error vs a close benchmark.' });
      opts.push({ t: 'Market order everything now to avoid the auction.', s: 0.15, why: 'You give up the benchmark (close) for an immediate print and pay the spread and impact.', fx: function (S) { if (rem > 0) DS.Orders.route(S, p, { type: 'MKT', qty: rem }); } });
      opts.push({ t: 'Ask the client to move the benchmark.', s: 0.2, why: 'The client set the benchmark. Your job is to execute against it.' });
      DS.Desk.decide(S, {
        cat: 'decision', title: 'Closing imbalance in ' + p.tkr,
        ctx: '<p>15:50 imbalance: <b>' + DS.fmtQty(Math.abs(im.q)) + ' to ' + (im.q > 0 ? 'BUY' : 'SELL') + '</b> in ' + p.tkr + ', indicative ' + im.ind.toFixed(2) + ' vs last ' + s.mid.toFixed(2) + '. Your order: ' + DS.sideTxt(p.side) + ' ' + DS.fmtQty(p.qty) + ', filled ' + DS.fmtQty(p.filled) + ', MOC in auction ' + DS.fmtQty(moc) + '.</p>',
        options: opts
      });
    },

    // ======================= SECTOR TRADER =======================
    ST: function (S, rng) {
      var semis = S.tkrs.filter(function (k) { return S.stocks[k].sector === 'SEMI'; });
      var soft = S.tkrs.filter(function (k) { return S.stocks[k].sector === 'SOFT'; });
      var sh = rng.shuffle(semis), so = rng.shuffle(soft);
      var reporter = sh[0], peer = sh[1], semi3 = sh[2];
      var softDn = so[0], softBuy = so[1], softWarn = so[2];
      S.notes.push(DS.Notes.earnings(S, rng, S.stocks[reporter], rng.pick(['beat-raise', 'beat-cut'])));
      S.notes.push(DS.Notes.research(S, rng, S.stocks[softDn], 'down', rng.pick(DS.BROKERS.slice(0, 3))));
      S.notes.push(DS.Notes.research(S, rng, S.stocks[semi3], 'pt-up', DS.BROKERS[6]));
      S.notes.push(DS.Notes.research(S, rng, S.stocks[softBuy], 'init-ow', rng.pick(DS.BROKERS.slice(2, 5))));
      S.notes.push(DS.Notes.flowColor(S, rng, ['In Tech: long-onlys added to Semis on weakness last week; HFs have been shorting mid-cap Software into earnings.']));
      var rep = S.stocks[reporter];
      DS.Notes.headline(S, rng, S.stocks[softWarn], 'preann', '11:05');
      DS.Notes.headline(S, rng, S.stocks[semi3], rng.pick(['contract', 'downgradeIntra']), '13:30');
      S.focusSectors = ['SEMI', 'SOFT'];

      var ps = S.stocks[peer];
      var o1 = { tkr: peer, side: 1, qty: qtyPct(ps, rng.range(0.045, 0.06)), bench: 'ARRIVAL', urgency: 'Medium', maxPct: null, client: client('Cedar Ridge Investors') };
      at(S, 90, function (S) {
        var p = DS.Orders.newParent(S, o1); S.byKey.o1 = p;
        p.instr = 'Arrival, medium urgency. Read-across trade on ' + reporter + '.';
        DS.Desk.chat(S, { from: 'Priya (Trader) · Cedar Ridge', kind: 'client', text: 'Buy ' + DS.fmtInt(p.qty) + ' ' + peer + ', arrival. PM likes the read-across from ' + reporter + ' last night.' });
        DS.Desk.decide(S, DS.Scen.readAcrossQ(S, p, rep));
      });
      var sd = S.stocks[softDn];
      var o2 = { tkr: softDn, side: -1, qty: qtyPct(sd, rng.range(0.06, 0.08)), bench: 'ARRIVAL', urgency: 'High', maxPct: 0.25, client: client('Vantage Point Partners') };
      at(S, '09:46', function (S) {
        var p = DS.Orders.newParent(S, o2); S.byKey.o2 = p;
        p.instr = 'Arrival, high urgency, max 25%.';
        DS.Desk.chat(S, { from: 'Jules (Head trader) · Vantage Point', kind: 'client', text: 'Sell ' + DS.fmtInt(p.qty) + ' ' + softDn + ' after that downgrade. Arrival, get after it, max 25%.' });
        DS.Desk.decide(S, DS.Scen.urgentQ(S, p));
      });
      var o3 = { tkr: peer, side: -1, qty: DS.lot(o1.qty * rng.range(0.5, 0.7) / 1000) * 1000 || 10000, bench: 'VWAP', urgency: 'Low', maxPct: 0.15, client: client('Atlas Peak Asset Mgmt') };
      at(S, '10:20', function (S) {
        var p = DS.Orders.newParent(S, o3); S.byKey.o3 = p;
        p.instr = 'VWAP, low urgency, max 15%.';
        DS.Desk.chat(S, { from: 'Dana (PM) · Atlas Peak', kind: 'client', text: 'Trimming ' + peer + ' into this strength. Sell ' + DS.fmtInt(p.qty) + ', VWAP, max 15%.' });
        DS.Scen.crossQ(S, S.byKey.o1, p);
      });
      at(S, '10:45', function (S) { DS.Scen.sectorChat(S, 'Kestrel Capital', 'Marco (PM)', 'What\'s going on in semis and software this morning?'); });
      at(S, '11:12', function (S) {
        var p = S.byKey.o2;
        DS.Desk.decide(S, {
          cat: 'decision', title: 'Read-across: ' + softWarn + ' warns',
          ctx: '<p>' + softWarn + ' just pre-announced revenue below guidance, citing order push-outs. Software is ' + pct(S.sectors.SOFT.perf) + '. You are selling ' + softDn + (p ? ' (' + Math.round(p.filled / p.qty * 100) + '% done)' : '') + ' and buying ' + peer + ' (semis). Which statement is the best read?</p>',
          options: [
            { t: 'Software peers will trade lower in sympathy. My ' + softDn + ' sell gets harder (more sellers): tell Vantage and stay on schedule. Semis less affected unless the issue is broad IT spending.', s: 1, why: 'Read-across hits the closest peers hardest. Your sell now competes with other holders reacting to the warning, so the client should hear it from you, and the semi order is one step removed.' },
            { t: 'Only ' + softWarn + ' is affected. Nothing changes for my orders.', s: 0.2, why: 'Pre-announcements almost always hit peers. Investors assume the same demand issue until proven otherwise.' },
            { t: 'This is great for my ' + softDn + ' sell: speed up to 50%.', s: 0.15, why: 'Speeding up into a sympathy selloff means competing with every other seller for the same bids, and it breaches the 25% cap.' },
            { t: 'Cancel the ' + peer + ' buy, all of tech is going down.', s: 0.1, why: 'Never cancel without the client, and the read-across to semis is indirect.' }
          ]
        });
      });
      var sb = S.stocks[softBuy];
      var o4 = { tkr: softBuy, side: 1, qty: qtyPct(sb, rng.range(0.03, 0.045)), bench: 'CLOSE', urgency: 'Medium', maxPct: 0.1, client: client('Ironwood Quant') };
      at(S, '12:30', function (S) {
        var p = DS.Orders.newParent(S, o4); S.byKey.o4 = p;
        p.instr = 'Close benchmark, max 10%.';
        sb.closeBias = -0.02;
        DS.Desk.chat(S, { from: 'Execution desk · Ironwood', kind: 'client', text: 'Buy ' + DS.fmtInt(p.qty) + ' ' + softBuy + ', benchmark close, max 10%.' });
        DS.Desk.decide(S, DS.Scen.closeQ(S, p));
      });
      at(S, '12:15', function (S) { DS.Scen.clientColorChat(S, S.byKey.o1, 'How\'s ' + peer + ' going? Holding up vs the group?'); });
      at(S, '14:20', function (S) { DS.Scen.sectorChat(S, 'Atlas Peak Asset Mgmt', 'Dana (PM)', 'Quick one: how are semis vs software into the afternoon?'); });
      at(S, '13:50', function (S) {
        var s3 = S.stocks[semi3];
        var o5 = DS.Orders.newParent(S, { tkr: semi3, side: 1, qty: qtyPct(s3, 0.035), bench: 'ARRIVAL', urgency: 'High', client: client('Kestrel Capital') });
        o5.instr = 'Arrival, high urgency. Trading the headline.';
        S.byKey.o5 = o5;
        DS.Desk.chat(S, { from: 'Marco (PM) · Kestrel', kind: 'client', text: 'Buy ' + DS.fmtInt(o5.qty) + ' ' + semi3 + ' on that headline, arrival, I want it done in the next 45 minutes.' });
      });
      at(S, T('15:50') + 20, function (S) { DS.Scen.imbalanceQ(S, S.byKey.o4); });
    },

    sectorChat: function (S, cname, contact, prompt) {
      var ch = DS.Scen.sectorColorChoices(S, S.focusSectors || ['SEMI', 'SOFT']);
      var best = 0; ch.forEach(function (o, i) { if (o.s > ch[best].s) best = i; });
      DS.Desk.chat(S, { from: contact + ' · ' + cname, kind: 'client', text: prompt, choices: ch, cat: 'color', title: 'Sector color for ' + cname, best: best });
    },

    readAcrossQ: function (S, p, rep) {
      var s = S.stocks[p.tkr];
      return {
        cat: 'decision', title: 'Read-across buy in ' + p.tkr,
        ctx: '<p>' + rep.tkr + ' reported last night and is ' + pct(DS.Market.chg(rep)) + '. Its peer ' + p.tkr + ' is ' + pct(DS.Market.chg(s)) + ', the semis group ' + pct(S.sectors.SEMI.perf) + '. Cedar Ridge wants ' + DS.fmtInt(p.qty) + ' ' + p.tkr + ' (' + (p.qty / s.adv * 100).toFixed(1) + '% ADV), arrival benchmark, medium urgency.</p><p>How do you approach it?</p>',
        options: [
          { t: 'Arrival (IS) medium urgency to 12:00 with dark alongside. Sympathy moves can fade, so get a good chunk done while the read-across is fresh.', s: 1, why: 'Arrival benchmark plus a catalyst that can fade argues for front-loading moderately. Dark saves spread in a wide opening market.', fx: function (S) { R(S, p, 'IS', 0.8, { urg: 'Medium', end: T('12:00') }); R(S, p, 'DARK', 1); } },
          { t: 'VWAP to the close.', s: 0.4, why: 'Spreads the order over the day against an arrival benchmark: lots of timing risk if the read-across keeps working.', fx: function (S) { R(S, p, 'VWAP', 1); } },
          { t: 'Market order now.', s: 0.15, why: 'Paying the widest spread of the day for a medium-urgency order.', fx: function (S) { R(S, p, 'MKT', 1); } },
          { t: 'Limit at yesterday\'s close and wait.', s: 0.2, why: 'A passive bet that the move fully fades. If it doesn\'t, you miss the trade and the opportunity cost counts against arrival.', fx: function (S) { R(S, p, 'LMT', 1, { lim: s.prevClose }); } }
        ]
      };
    },

    crossQ: function (S, buy, sell) {
      if (!buy || buy.status === 'done' || buy.status === 'cxl') return;
      var s = S.stocks[sell.tkr];
      var q = DS.lot(Math.min(sell.qty, buy.qty - buy.filled));
      if (q < 1000) return;
      DS.Desk.decide(S, {
        cat: 'decision', title: 'Two clients, opposite sides in ' + sell.tkr,
        ctx: '<p>You are working a <b>BUY</b> for Cedar Ridge (' + DS.fmtQty(buy.qty - buy.filled) + ' left) and just received a <b>SELL ' + DS.fmtQty(sell.qty) + '</b> from Atlas Peak in the same stock. Mid is ' + s.mid.toFixed(2) + ', spread ' + ((s.ask - s.bid) * 100).toFixed(0) + 'c.</p><p>What do you do?</p>',
        options: [
          { t: 'Get both clients\' consent and cross ' + DS.fmtQty(q) + ' at the mid.', s: 1, why: 'An agency cross at the mid gives both clients zero impact and half the spread each. It must be fair (mid or better for both) and, per desk policy, with consent. This is one of the most valuable things a sector trader does.',
            fx: function (S) { var m = DS.round(S.stocks[sell.tkr].mid, 2); DS.Orders.crossBlock(S, buy, q, m); DS.Orders.crossBlock(S, sell, q, m); DS.Desk.chat(S, { from: 'Desk', kind: 'system', text: 'Agency cross: ' + DS.fmtQty(q) + ' ' + sell.tkr + ' @ ' + m.toFixed(2) + ' between two clients. Both consented.' }); } },
          { t: 'Work both orders separately in the market.', s: 0.3, why: 'Both clients pay spread and impact against each other while the desk had the other side all along. Missed opportunity.' },
          { t: 'Tell Cedar Ridge that Atlas Peak is selling so they can lower their limit.', s: 0, why: 'Confidentiality breach. Never reveal one client\'s order to another.' },
          { t: 'Fill Cedar Ridge at the offer from Atlas Peak\'s shares.', s: 0.2, why: 'Crossing at the offer gives all the spread to the seller. Crosses should be fair to both sides, normally at the mid.' }
        ]
      });
    },

    // ======================= PROGRAM TRADER =======================
    PT: function (S, rng) {
      var c = rng.pick(DS.PT_CLIENTS);
      var close = c.type === 'Index rebalance';
      var names = rng.shuffle(S.tkrs);
      var sells = names.slice(0, 11), buys = names.slice(11, 22);
      var target = rng.range(90, 130) * 1e6;
      var orders = [];
      // Notional per name from random weights, then make the two least liquid names per side the
      // "illiquid tail" (15-30% of dollar ADV). Both sides end up close to cash-balanced.
      function mk(list, side) {
        var w = list.map(function () { return rng.range(0.5, 1.5); });
        var tw = w.reduce(function (a, b) { return a + b; }, 0);
        var byLiq = list.slice().sort(function (a, b) { return S.stocks[a].adv * S.stocks[a].prevClose - S.stocks[b].adv * S.stocks[b].prevClose; });
        var tail = byLiq.slice(0, 2);
        var rows = list.map(function (k, i) {
          var s = S.stocks[k], dadv = s.adv * s.prevClose;
          var n = Math.min(target * w[i] / tw, dadv * 0.12);
          if (tail.indexOf(k) >= 0) n = dadv * rng.range(0.15, 0.28);
          return { tkr: k, side: side, n: n };
        });
        return rows;
      }
      var sRows = mk(sells, -1), bRows = mk(buys, 1);
      var sN = sRows.reduce(function (a, r) { return a + r.n; }, 0), bN = bRows.reduce(function (a, r) { return a + r.n; }, 0);
      var adj = sN / bN;
      bRows.forEach(function (r) { r.n *= adj; });
      sRows.concat(bRows).forEach(function (r) {
        var s = S.stocks[r.tkr];
        orders.push({ tkr: r.tkr, side: r.side, qty: Math.max(100, Math.min(DS.lot(s.adv * 0.4), Math.round(r.n / s.prevClose / 100) * 100)) });
      });
      S.basketSpec = { client: c, bench: close ? 'CLOSE' : 'ARRIVAL', orders: orders };
      // News touching basket names
      var bn = rng.shuffle(sells.concat(buys));
      S.notes.push(DS.Notes.research(S, rng, S.stocks[bn[0]], rng.pick(['up', 'down']), rng.pick(DS.BROKERS.slice(0, 3))));
      S.notes.push(DS.Notes.earnings(S, rng, S.stocks[bn[1]], rng.pick(['beat-cut', 'beat-raise', 'miss'])));
      S.notes.push(DS.Notes.research(S, rng, S.stocks[bn[2]], 'pt-up', DS.BROKERS[5]));
      S.notes.push(DS.Notes.flowColor(S, rng, ['Program desk: quarter-end rebalance flows building; expect heavier closes than normal this week.']));
      DS.Notes.headline(S, rng, S.stocks[bn[3]], rng.pick(['contract', 'ceo', 'downgradeIntra']), '11:35');
      var secs = rng.shuffle(Object.keys(DS.SECTORS));
      S.events.push({ t: T('12:40'), scope: 'sector', target: secs[0], jump: -0.009, drift: -0.006, dur: 3600, vm: 1.6, vmHalf: 3600, head: DS.SECTORS[secs[0]].short.toUpperCase() + ' UNDER PRESSURE AS LARGE PEER FLAGS MARGIN HEADWINDS AT INDUSTRY CONFERENCE', src: 'SQUAWK', kind: 'sector', sector: secs[0],
        meta: { why: 'Conference commentary from a bellwether is read across the whole group. For a program, a sector move matters only through your net exposure in that sector.' }, decode: DS.Notes.decodeHeadline });
      if (close) Object.keys(S.stocks).forEach(function (k) { S.stocks[k].closeBias += rng.gauss() * 0.01; });

      at(S, 30, function (S) {
        DS.Desk.chat(S, { from: c.contact + ' · ' + c.name, kind: 'client', text: 'Basket is loaded in your blotter: ' + sells.length + ' sells, ' + buys.length + ' buys, roughly cash-balanced. Benchmark ' + (close ? 'today\'s close' : 'arrival (open)') + '. Please keep it balanced through the day.' });
        DS.Desk.decide(S, DS.Scen.ptApproachQ(S));
      });
      at(S, '12:05', function (S) { DS.Scen.ptProgressChat(S); });
      at(S, '15:30', function (S) { DS.Scen.ptResidualQ(S); });
    },

    ptApproachQ: function (S) {
      var B = S.basket;
      return {
        cat: 'decision', title: 'Program execution plan',
        ctx: '<p>' + B.orders.length + ' names, ' + DS.fmtUsd(B.gross) + ' gross. ' + B.tiers.liq + ' names under 3% ADV, ' + B.tiers.mid + ' between 3-12%, ' + B.tiers.ill + ' over 12% ADV. Benchmark: ' + (B.bench === 'CLOSE' ? 'close' : 'arrival') + '.</p><p>How do you set up the program?</p>',
        options: [
          { t: 'Tier it: liquid names on ' + (B.bench === 'CLOSE' ? 'VWAP from 14:00 + MOC' : 'IS low urgency') + ', mid names on VWAP capped at 12%, illiquid names on POV 10% plus dark. Hedge any net beta with futures.', s: 1,
            why: 'Tiering matches each name\'s strategy to its liquidity. The liquid names finish early and cheaply; the illiquid tail gets patient, capped participation so it doesn\'t blow out impact. Futures cover the market risk while the two sides finish at different speeds.',
            fx: function (S) { DS.PT.autoTier(S); } },
          { t: 'Same VWAP to the close on every name.', s: 0.45, why: 'Simple and balanced in time, but it ignores liquidity: the illiquid names will trade at very high participation and the benchmark mismatch (if arrival) leaves timing risk on the liquid names.',
            fx: function (S) { S.basket.orders.forEach(function (id) { var p = DS.Orders.get(S, id); DS.Orders.route(S, p, { type: 'VWAP' }); }); } },
          { t: 'Arrival (IS) high urgency on everything to get it done this morning.', s: 0.2, why: 'Front-loading illiquid names at 20-30% of ADV is extremely expensive. Urgency should vary by tier.',
            fx: function (S) { S.basket.orders.forEach(function (id) { var p = DS.Orders.get(S, id); DS.Orders.route(S, p, { type: 'IS', urg: 'High' }); }); } },
          { t: 'Start the sells first, then do the buys after lunch with the proceeds.', s: 0.1, why: 'This creates a huge net short market exposure all morning. The client asked for a balanced program; buys and sells should progress together.',
            fx: function (S) { S.basket.orders.forEach(function (id) { var p = DS.Orders.get(S, id); if (p.side < 0) DS.Orders.route(S, p, { type: 'IS', urg: 'Medium', end: T('12:30') }); }); } }
        ]
      };
    },

    ptProgressChat: function (S) {
      var B = S.basket; if (!B) return;
      var st = DS.PT.stats(S);
      var good = 'Sells ' + Math.round(st.sellPct * 100) + '% done, buys ' + Math.round(st.buyPct * 100) + '%. Net ' + DS.fmtUsd(st.netDone) + ' (' + (st.netDone >= 0 ? 'long' : 'short') + '), beta-adjusted ' + DS.fmtUsd(st.betaNet) + (S.fut.pos ? ', hedged with ' + S.fut.pos + ' ES' : '') + '. Cost so far ' + DS.fmtBps(st.costBps) + 'bps vs ' + (B.bench === 'CLOSE' ? 'arrival (close benchmark settles at 16:00)' : 'arrival') + ', mostly from ' + st.worst.join(', ') + '. ' + (st.illRemain > 0.3 ? 'The illiquid tail will be tight to finish today; I\'ll flag by 15:00.' : 'On track to complete.');
      var ch = [
        { t: good, s: 1, why: 'A PT update speaks in portfolio terms: completion on each side, net and beta exposure, hedge, cost vs benchmark and where the cost comes from, plus completion risk.' },
        { t: 'Going well, about half done.', s: 0.25, why: 'Nothing a transition manager can use. They need balance, exposure, cost and completion risk.' },
        { t: 'Sells are way ahead so you\'re net short, but it\'s fine, it will even out.', s: 0.2, why: 'Hand-waving a risk the client explicitly asked you to control. Either fix the imbalance or hedge it, and tell them which.' },
        { t: 'Here are all 22 fills so far: ...', s: 0.4, why: 'Raw detail without the summary. Lead with balance, exposure and cost; send the fills file separately.' }
      ];
      ch = DS.makeRng(S.t).shuffle(ch);
      var best = 0; ch.forEach(function (o, i) { if (o.s > ch[best].s) best = i; });
      DS.Desk.chat(S, { from: B.client.contact + ' · ' + B.client.name, kind: 'client', text: 'Can I get a quick update on the program?', choices: ch, cat: 'color', title: 'Program update', best: best });
    },

    ptImbalanceQ: function (S, st) {
      var fast = st.buyPct > st.sellPct ? 'buys' : 'sells';
      var n = Math.round(-st.betaNet / (S.mkt.lvl * 50));
      DS.Desk.decide(S, {
        cat: 'decision', title: 'Program is drifting out of balance',
        ctx: '<p>Buys are <b>' + Math.round(st.buyPct * 100) + '%</b> done, sells <b>' + Math.round(st.sellPct * 100) + '%</b>. Your executed net exposure is <b>' + DS.fmtUsd(st.netDone) + '</b>, beta-adjusted <b>' + DS.fmtUsd(st.betaNet) + '</b>. One ES contract is about ' + DS.fmtUsd(S.mkt.lvl * 50) + '.</p><p>What do you do?</p>',
        options: [
          { t: 'Slow the ' + fast + ', add urgency to the lagging side, and ' + (n ? (n > 0 ? 'buy ' : 'sell ') + Math.abs(n) + ' ES to hedge the gap meanwhile.' : 'keep watching.'), s: 1,
            why: 'Fix the cause (completion speed) and hedge the symptom (net beta) while it lasts. That is how program desks stay inside their risk limits.',
            fx: function (S) { DS.PT.rebalanceSpeed(S, st); if (n) DS.Orders.tradeFut(S, n); } },
          { t: 'Do nothing, it will even out by the close.', s: 0.2, why: 'Maybe, but you carry unhedged market risk the client did not ask for until then. A 1% market move on this imbalance is real money.' },
          { t: 'Hedge with futures only.', s: 0.6, why: 'Covers the market risk but not sector and stock residuals, and the imbalance keeps growing. Better to fix completion rates too.', fx: function (S) { if (n) DS.Orders.tradeFut(S, n); } },
          { t: 'Cancel the lagging side and restart it on market orders.', s: 0.1, why: 'Replacing a balance problem with an impact problem.' }
        ]
      });
    },

    ptResidualQ: function (S) {
      var B = S.basket; if (!B) return;
      var st = DS.PT.stats(S);
      var ill = B.orders.map(function (id) { return DS.Orders.get(S, id); }).filter(function (p) { return p.status !== 'done' && (p.qty - p.filled) / S.stocks[p.tkr].adv > 0.06; });
      DS.Desk.decide(S, {
        cat: 'decision', title: 'Finishing the program',
        ctx: '<p>30 minutes to the close. ' + Math.round(st.donePct * 100) + '% of notional done. ' + ill.length + ' names still have more than 6% of ADV left: ' + ill.slice(0, 5).map(function (p) { return p.tkr; }).join(', ') + '.</p><p>What is your plan for the residual?</p>',
        options: [
          { t: 'MOC the remaining liquid names. For the illiquid tail, tell the client what is left and propose carrying it into tomorrow rather than forcing it into the close.', s: 1,
            why: 'The close is good liquidity for names where your residual is small vs the auction. Dumping 10%+ of ADV into an illiquid close moves the price hard. Clients would rather carry a little residual than pay that.',
            fx: function (S) { DS.PT.mocLiquid(S, 0.06); DS.Desk.chat(S, { from: B.client.contact + ' · ' + B.client.name, kind: 'client', text: 'Agreed, carry the illiquid residual to tomorrow. Thanks for flagging.' }); } },
          { t: 'Put everything remaining MOC. Completion is all that matters.', s: 0.35, why: 'Completion matters, but large MOCs in thin names push the close against the client and the impact is permanent.', fx: function (S) { DS.PT.mocLiquid(S, 99); } },
          { t: 'Market orders now on everything left.', s: 0.1, why: 'Sweeping the book on illiquid names at 15:30 is the most expensive execution of the day.', fx: function (S) { B.orders.forEach(function (id) { var p = DS.Orders.get(S, id); if (DS.Orders.available(p) >= 100) DS.Orders.route(S, p, { type: 'MKT' }); }); } },
          { t: 'Leave the algos running and see what happens.', s: 0.3, why: 'Leaving residuals to chance without telling the client what will be left is poor communication.' }
        ]
      });
    }
  };
})();
