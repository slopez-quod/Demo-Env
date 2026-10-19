/* Broker notes, macro calendar, flow color and intraday squawk. Each item carries the market event it
   causes and a "decode" that teaches how a trader reads it. */
window.DS = window.DS || {};

(function () {
  var R = {
    SEMI: { up: ['datacenter capex is inflecting higher into 2027', 'accelerator share gains look under-modeled', 'the inventory correction is over and pricing is firming', 'gross margin upside from mix'],
      dn: ['channel inventory is building again', 'valuation already discounts peak margins', 'export-restriction risk is rising', 'hyperscaler capex digestion likely in 2H'] },
    SOFT: { up: ['net revenue retention is re-accelerating', 'AI monetization is under-appreciated by consensus', 'operating margin expansion has a long runway'],
      dn: ['AI agents threaten seat-based pricing', 'sales cycles are elongating in mid-market', 'FY27 consensus looks too high'] },
    INTN: { up: ['ad pricing is recovering faster than expected', 'engagement trends are the best in two years'], dn: ['regulatory overhang is building', 'ad budgets are slowing into year-end'] },
    BANK: { up: ['net interest income has troughed', 'capital return upside from the new rules', 'credit is better than feared'], dn: ['deposit costs are sticky', 'commercial real estate exposure is under-reserved', 'the NII guide looks at risk'] },
    HLTH: { up: ['the pipeline is under-appreciated', 'the Phase 3 readout looks de-risked'], dn: ['drug pricing headwinds intensify in 2027', 'the patent cliff is closer than consensus thinks'] },
    ENGY: { up: ['free cash flow yield is the best in the group', 'production growth surprises to the upside'], dn: ['the oil price deck in consensus is too high', 'capex overruns on the new project'] },
    INDU: { up: ['aftermarket strength and backlog visibility', 'pricing power is underestimated'], dn: ['customer destocking will last two more quarters', 'margin pressure from input costs'] },
    CONS: { up: ['traffic is inflecting', 'gross margin tailwinds from freight'], dn: ['the low-end consumer is slowing', 'the promotional environment is intensifying'] },
    UTIL: { up: ['datacenter load growth drives rate base upside', 'the regulatory outcome was constructive'], dn: ['equity issuance risk to fund capex', 'regulatory lag on the rate case'] }
  };

  function pct(x, d) { return (x >= 0 ? '+' : '') + (x * 100).toFixed(d == null ? 1 : d) + '%'; }

  DS.Notes = {
    reasons: R,

    // ---------- Research calls ----------
    research: function (S, rng, s, kind, broker) {
      var tier = broker.tier;
      var up = kind === 'up' || kind === 'init-ow' || kind === 'pt-up';
      var pxPrev = s.prevClose;
      var ptOld = DS.round(pxPrev * rng.range(up ? 0.95 : 1.05, up ? 1.12 : 1.2), 0);
      var ptNew, gap, head, rating;
      var reason = rng.pick(R[s.sector][up ? 'up' : 'dn']);
      if (kind === 'up') {
        ptNew = DS.round(pxPrev * rng.range(1.18, 1.32), 0);
        rating = 'Overweight from Neutral';
        gap = (tier === 1 ? 0.028 : tier === 2 ? 0.016 : 0.008) * rng.range(0.7, 1.35);
        head = broker.name + ' upgrades ' + s.tkr + ' to ' + rating + '; PT $' + ptNew + ' (from $' + ptOld + ')';
      } else if (kind === 'down') {
        ptNew = DS.round(pxPrev * rng.range(0.78, 0.9), 0);
        rating = 'Underweight from Neutral';
        gap = -(tier === 1 ? 0.031 : tier === 2 ? 0.018 : 0.009) * rng.range(0.7, 1.35);
        head = broker.name + ' downgrades ' + s.tkr + ' to ' + rating + '; PT $' + ptNew + ' (from $' + ptOld + ')';
      } else if (kind === 'init-ow') {
        ptNew = DS.round(pxPrev * rng.range(1.2, 1.35), 0);
        rating = 'Overweight (initiation)';
        gap = (tier === 1 ? 0.012 : 0.006) * rng.range(0.6, 1.4);
        head = broker.name + ' initiates ' + s.tkr + ' at Overweight; PT $' + ptNew;
      } else { // pt-up / pt-dn, no rating change
        ptNew = DS.round(ptOld * (up ? rng.range(1.03, 1.06) : rng.range(0.94, 0.97)), 0);
        rating = 'rating unchanged';
        gap = (up ? 1 : -1) * 0.002 * rng.range(0, 1.5);
        head = broker.name + ' ' + (up ? 'raises' : 'trims') + ' ' + s.tkr + ' PT to $' + ptNew + ' (from $' + ptOld + '); rating unchanged';
      }
      var fade = rng.chance(0.45);
      var bigCall = (kind === 'up' || kind === 'down') && tier <= 2;
      s.gap += gap;
      var vm = bigCall ? (tier === 1 ? 2.8 : 2.0) : kind === 'init-ow' ? 1.5 : 1.1;
      s.vm = Math.max(s.vm, vm); s.vmHalf = 3600;
      if (bigCall) { s.sm = Math.max(s.sm, 1.6); s.smHalf = 600; }
      var ev = bigCall ? { t: 120, scope: 'stock', target: s.tkr, drift: (fade ? -0.55 : 0.35) * gap, dur: 7200 } : null;
      if (ev) S.events.push(ev);
      return {
        id: 'R' + s.tkr + kind, cat: 'research', tkr: s.tkr, sector: s.sector, head: head,
        body: 'Analyst argues ' + reason + '. ' + (ptNew > pxPrev ? 'New PT implies ' + pct(ptNew / pxPrev - 1, 0) + ' upside.' : 'New PT implies ' + pct(ptNew / pxPrev - 1, 0) + ' downside.'),
        meta: { kind: kind, tier: tier, broker: broker.name, gap: gap, fade: fade, bigCall: bigCall, ptNew: ptNew, ptOld: ptOld, up: up },
        decode: DS.Notes.decodeResearch
      };
    },

    decodeResearch: function (S, n) {
      var s = S.stocks[n.tkr], m = n.meta;
      var upside = m.ptNew / s.prevClose - 1;
      var d = { what: '', why: '', expect: '', buy: '', sell: '' };
      if (m.kind === 'up' || m.kind === 'down') {
        d.what = m.broker + ' (Tier ' + m.tier + ') moved ' + s.name + ' to ' + (m.up ? 'Overweight' : 'Underweight') + ' and changed the price target from $' + m.ptOld + ' to $' + m.ptNew + ', which is ' + pct(upside, 0) + ' from yesterday\'s close.';
        d.why = m.tier === 1 ? 'A rating change from a Tier-1 broker is one of the few research calls that reliably moves a stock: it reaches most of the buy-side before the open and gives PMs a reason to act today. A PT this far from the price gives the call conviction.'
          : 'A rating change matters, but a Tier-' + m.tier + ' broker reaches fewer accounts than a bulge bracket, so the reaction is usually smaller.';
        d.expect = (m.up ? 'Typical reaction is a ' + (m.tier === 1 ? '+2% to +4%' : '+1% to +2%') : 'Typical reaction is a ' + (m.tier === 1 ? '-2% to -4%' : '-1% to -2%')) + ' gap at the open, with volume ' + (m.tier === 1 ? '2-3x' : '1.5-2x') + ' normal in the first hour and wide spreads in the first 10 minutes. By 10:30 you want to know whether the move is extending (more buyers arriving) or fading (early movers taking profits).';
        if (m.up) {
          d.buy = 'Do not chase the open. The first minutes are the most expensive part of the day. Let a VWAP or capped POV take its share, add dark to capture spread, and watch for a fade back toward the prior close. Tell a VWAP client the stock is gapping on the call and confirm their limit still works.';
          d.sell = 'The upgrade is your liquidity: buyers are showing up today and the volume is there. Lean in with higher participation in the first hour and offer blocks into strength. Waiting risks the gap fading.';
        } else {
          d.buy = 'The downgrade is your liquidity: sellers are motivated today. Be patient early, let the selling exhaust, and look for blocks from holders cutting. Higher participation is cheap when volume is elevated.';
          d.sell = 'You are competing with every other holder who read the same note. Avoid hitting bids into the first-minute air pocket. Use dark and blocks, and tell the client what the stock is doing before you press.';
        }
      } else if (m.kind === 'init-ow') {
        d.what = m.broker + ' started covering ' + s.name + ' with an Overweight rating and a $' + m.ptNew + ' target (' + pct(upside, 0) + ').';
        d.why = 'Initiations get attention but carry less weight than a change of view: the analyst has no prior stance to reverse. Expect a modest move unless the broker is very influential in the name.';
        d.expect = 'A small positive open (0.5-1.5%) and slightly higher volume. Often fades by midday.';
        d.buy = 'Minor headwind. Work normally, maybe a touch more patience at the open.';
        d.sell = 'Minor tailwind. Slightly more buyers around early; nothing to change your plan for.';
      } else {
        d.what = m.broker + ' changed its price target on ' + s.name + ' to $' + m.ptNew + ' from $' + m.ptOld + ' but kept the rating.';
        d.why = 'A small PT change with no rating change is housekeeping, usually catching up to the share price. Most of the buy-side ignores it.';
        d.expect = 'Little or no price reaction. Normal volume.';
        d.buy = 'Ignore it. Trade your normal plan.';
        d.sell = 'Ignore it. Trade your normal plan.';
      }
      return d;
    },

    // ---------- Earnings ----------
    earnings: function (S, rng, s, outcome) {
      var q = DS.round(s.prevClose / rng.range(18, 34) / 4, 2);
      var cons = q, act, guide, gap, head;
      if (outcome === 'beat-raise') { act = DS.round(cons * rng.range(1.06, 1.14), 2); guide = 'raises FY guide above consensus'; gap = rng.range(0.045, 0.085); }
      else if (outcome === 'beat-cut') { act = DS.round(cons * rng.range(1.03, 1.08), 2); guide = 'guides next quarter below consensus'; gap = -rng.range(0.05, 0.09); }
      else if (outcome === 'miss') { act = DS.round(cons * rng.range(0.88, 0.96), 2); guide = 'cuts FY guide'; gap = -rng.range(0.07, 0.12); }
      else { act = DS.round(cons * rng.range(1.0, 1.03), 2); guide = 'reiterates FY guide'; gap = rng.range(-0.015, 0.015); }
      head = s.tkr + ' reported after the close: EPS $' + act.toFixed(2) + ' vs $' + cons.toFixed(2) + ' consensus; ' + guide;
      s.gap += gap;
      s.vm = Math.max(s.vm, outcome === 'inline' ? 1.8 : 4.0); s.vmHalf = 4200;
      s.sm = Math.max(s.sm, outcome === 'inline' ? 1.3 : 2.2); s.smHalf = 900;
      var extend = rng.chance(0.5);
      S.events.push({ t: 300, scope: 'stock', target: s.tkr, drift: (extend ? 0.3 : -0.35) * gap, dur: 9000 });
      // Read-across to peers: a fraction of the move through the sector factor
      var ra = outcome === 'inline' ? 0 : gap * rng.range(0.1, 0.2);
      if (ra) S.sectors[s.sector].gap += ra;
      return {
        id: 'E' + s.tkr, cat: 'earnings', tkr: s.tkr, sector: s.sector, head: head,
        body: 'Revenue ' + (outcome === 'miss' ? 'light' : outcome === 'inline' ? 'in line' : 'ahead') + '. Management ' + guide + '. Stock indicated ' + pct(gap) + ' pre-market. ' + (ra ? 'Peers indicated ' + pct(ra) + ' in sympathy.' : ''),
        meta: { outcome: outcome, gap: gap, ra: ra, act: act, cons: cons, extend: extend },
        decode: DS.Notes.decodeEarnings
      };
    },

    decodeEarnings: function (S, n) {
      var s = S.stocks[n.tkr], m = n.meta, sec = DS.SECTORS[s.sector].short;
      var d = {};
      d.what = s.name + ' reported EPS of $' + m.act.toFixed(2) + ' vs $' + m.cons.toFixed(2) + ' expected, and ' + n.head.split('; ')[1] + '. The stock is indicated ' + pct(m.gap) + ' before the open.';
      if (m.outcome === 'beat-cut') d.why = 'This is the classic trap: a beat on the quarter but a weak guide. The market prices the future, so the guide wins and the stock trades down even though the headline says "beat".';
      else if (m.outcome === 'beat-raise') d.why = 'Beat and raise is the strongest combination: the quarter was good and the outlook improved. Estimates will go up, which is why the stock gaps higher.';
      else if (m.outcome === 'miss') d.why = 'A miss plus a guide cut forces analysts to lower numbers. Holders who owned it for growth will re-underwrite; some will sell for days.';
      else d.why = 'In-line results with a reiterated guide: no new information. Expect a small move driven more by positioning than fundamentals.';
      d.expect = m.outcome === 'inline' ? 'Modest move, volume 1.5-2x normal early.' : 'Expect 3-5x normal volume in the first hour, very wide spreads in the first 10-15 minutes, and big two-way swings as the stock finds a level. ' + (m.ra ? 'Peers in ' + sec + ' move in sympathy (' + pct(m.ra) + ' read-across): watch them too if you have orders in the group.' : '');
      if (m.gap > 0) {
        d.buy = 'Avoid the opening auction and first 5 minutes unless the client is urgent. Use a capped POV so you scale with the heavy volume, not ahead of it. Expect the client to ask for color.';
        d.sell = 'Volume is your friend today. A seller can trade a much larger % of ADV than normal without much extra impact, because the stock trades 3-5x its average.';
      } else {
        d.buy = 'Volume is your friend today, and motivated sellers mean blocks are likely. Patience early: gap-downs on guide cuts often see continued selling into the first hour before stabilizing.';
        d.sell = 'If the client still wants out, waiting for a bounce is a bet, not a strategy. Use the elevated volume with a POV, and check whether the client wants to change urgency now the news is out.';
      }
      return d;
    },

    // ---------- Macro ----------
    macroPre: function (S, rng) {
      var types = [
        { k: 'CPI', name: 'CPI (Sep)', unit: '% m/m core', est: 0.3 },
        { k: 'NFP', name: 'Nonfarm payrolls', unit: 'k', est: 140 },
        { k: 'PPI', name: 'PPI (Sep)', unit: '% m/m', est: 0.2 }
      ];
      var x = rng.pick(types), surprise = rng.pick([-1, 0, 1]);
      var act = x.k === 'NFP' ? x.est + surprise * rng.int(35, 80) : DS.round(x.est + surprise * 0.1, 1);
      var hot = surprise > 0;
      var dy = surprise * rng.range(4, 9) * (x.k === 'PPI' ? 0.6 : 1);
      var mk = -surprise * rng.range(0.0025, 0.005) * (x.k === 'PPI' ? 0.6 : 1);
      if (x.k === 'NFP') { mk = surprise * rng.range(-0.001, 0.003); }
      S.mkt.gap += mk; S.rates.gap += dy;
      Object.keys(S.sectors).forEach(function (k) { S.sectors[k].gap += DS.SECTOR_FACTOR[k].rates * dy * 0.0008; });
      return {
        id: 'MPRE', cat: 'macro', head: '8:30 ' + x.name + ': ' + act + (x.k === 'NFP' ? 'k' : '%') + ' vs ' + x.est + (x.k === 'NFP' ? 'k' : '%') + ' est',
        body: surprise === 0 ? 'In line. Futures little changed on the print.' : (hot ? 'Hotter than expected. ' : 'Softer than expected. ') + '10y yield ' + (dy > 0 ? '+' : '') + dy.toFixed(1) + 'bp on the print; ES ' + pct(mk) + '.',
        meta: { k: x.k, surprise: surprise, dy: dy, mk: mk }, decode: DS.Notes.decodeMacroPre
      };
    },

    decodeMacroPre: function (S, n) {
      var m = n.meta, d = {};
      d.what = n.head + '. ' + n.body;
      if (m.surprise === 0) {
        d.why = 'An in-line print removes a risk event. Markets often drift on positioning after a non-event.';
        d.expect = 'No big sector rotation from the data. Focus on stock-specific news.';
      } else if (m.k === 'NFP') {
        d.why = m.surprise > 0 ? 'Strong jobs data is good for growth but pushes yields up as rate-cut odds fall. Mixed for equities.' : 'Weak jobs raises rate-cut odds (yields down) but also growth worries.';
        d.expect = 'Rates move first. Rate-sensitive groups (banks, utilities, long-duration tech) react most.';
      } else {
        d.why = m.surprise > 0 ? 'Hot inflation means rate cuts are further away. Yields rise, which hits long-duration growth stocks (software, semis) hardest, helps banks (wider net interest margins) and hurts bond proxies like utilities.'
          : 'Soft inflation brings rate cuts closer. Yields fall, which helps long-duration growth (software, semis) and utilities, and weighs on bank margins.';
        d.expect = 'A broad market move of ' + pct(m.mk) + ' at the open with sector rotation on top: ' + (m.surprise > 0 ? 'Financials outperform, Software and Utilities lag.' : 'Software and Utilities outperform, Financials lag.');
      }
      d.buy = 'Market-wide moves hit every name in proportion to its beta. A high-beta buy order in a falling market is getting the tide in its favor: no need to rush. In a rising market the tide is against you: stay on schedule.';
      d.sell = 'Mirror image: selling high-beta names into a down market means the tide is against you. Stay on schedule or slightly ahead, and let sector strength (if your name is in a favored group) be your liquidity.';
      return d;
    },

    macroIntraday: function (S, rng) {
      var list = [];
      var opts = [
        { at: '10:00', name: 'ISM Services', est: 52.0, unit: '' },
        { at: '10:00', name: 'Consumer confidence', est: 99.5, unit: '' },
        { at: '14:00', name: 'FOMC minutes', est: null, unit: '' },
        { at: '13:00', name: 'Fed Governor speech', est: null, unit: '' },
        { at: '11:30', name: 'Treasury 10y auction', est: null, unit: '' }
      ];
      var picks = rng.shuffle(opts).slice(0, 2).sort(function (a, b) { return DS.tOf(a.at) - DS.tOf(b.at); });
      picks.forEach(function (x) {
        var sgn = rng.pick([-1, 1]);
        var dy = 0, mk = 0, head, body;
        if (x.est != null) {
          var act = DS.round(x.est + sgn * rng.range(1.2, 3.0), 1);
          dy = sgn * rng.range(2, 5); mk = sgn * rng.range(0.0015, 0.0035);
          head = x.name.toUpperCase() + ' ' + act + ' VS ' + x.est + ' EST';
          body = sgn > 0 ? 'Better than expected: growth worries ease, yields up.' : 'Weaker than expected: growth worries, yields down.';
        } else if (x.name === 'FOMC minutes') {
          dy = sgn * rng.range(3, 7); mk = -sgn * rng.range(0.002, 0.005);
          head = sgn > 0 ? 'FOMC MINUTES: MANY OFFICIALS SAW RISK INFLATION STAYS ELEVATED; SOME FAVORED PAUSE' : 'FOMC MINUTES: MOST OFFICIALS SAW ROOM FOR FURTHER CUTS IF LABOR MARKET COOLS';
          body = sgn > 0 ? 'Hawkish read: yields up, equities lower, growth names lead the decline.' : 'Dovish read: yields down, equities higher, growth leads.';
        } else if (x.name === 'Fed Governor speech') {
          dy = sgn * rng.range(2, 5); mk = -sgn * rng.range(0.0015, 0.0035);
          head = sgn > 0 ? 'FED GOVERNOR: "NOT IN A HURRY TO CUT FURTHER"; INFLATION PROGRESS STALLED' : 'FED GOVERNOR: POLICY "WELL POSITIONED" TO ADJUST AS INFLATION COOLS';
          body = sgn > 0 ? 'Hawkish remarks.' : 'Dovish remarks.';
        } else {
          dy = sgn * rng.range(2, 5); mk = -sgn * rng.range(0.001, 0.004);
          head = sgn > 0 ? '10Y AUCTION TAILS 2.1BP; WEAK DEMAND, BID-TO-COVER 2.31' : '10Y AUCTION STOPS THROUGH 1.4BP; STRONG DEMAND';
          body = sgn > 0 ? 'A tail means weak demand: yields jump.' : 'Stop-through means strong demand: yields dip.';
        }
        var ev = { t: DS.tOf(x.at), scope: 'mkt', jump: mk * 0.6, drift: mk * 0.4, dur: 1800, rates: dy * 0.6, ratesDrift: dy * 0.4, vm: 1.4, vmHalf: 900, kind: 'macro',
          head: head, src: 'SQUAWK', meta: { name: x.name, dy: dy, mk: mk, body: body }, decode: DS.Notes.decodeMacroIntra };
        S.events.push(ev);
        list.push({ at: x.at, name: x.name, est: x.est });
      });
      return list;
    },

    decodeMacroIntra: function (S, n) {
      var m = n.meta, d = {};
      d.what = m.name + ': ' + m.body;
      d.why = m.dy > 0 ? 'Higher yields hurt long-duration growth (software, semis, internet) and bond-like utilities, and help banks. Equities overall tend to dip on hawkish surprises.'
        : 'Lower yields help long-duration growth and utilities and weigh on bank margins. Equities overall tend to rally on dovish surprises.';
      d.expect = 'Index move of roughly ' + pct(m.mk) + ' over the next 30 minutes, with a short burst of volume as algos and macro funds reposition.';
      d.buy = 'If the market is falling and you are a patient buyer, the tide is helping you. Do not accelerate into a falling knife; let your schedule pick it up.';
      d.sell = 'If the market is rallying and you are a seller, the tide is helping you. If it is falling, consider whether the client wants to stay on schedule or slow down.';
      return d;
    },

    // ---------- Flow color ----------
    flowColor: function (S, rng, extra) {
      var secs = rng.shuffle(Object.keys(DS.SECTORS));
      var lines = [];
      var ratio = DS.round(rng.range(1.1, 1.8), 1);
      var buyer = rng.chance(0.55);
      lines.push('Desk finished ' + ratio + ':1 better ' + (buyer ? 'buyer' : 'seller') + ' yesterday.');
      lines.push('Long-onlys were buyers of ' + DS.SECTORS[secs[0]].short + ' and ' + DS.SECTORS[secs[1]].short + '; hedge funds net sellers of ' + DS.SECTORS[secs[2]].short + ' into strength.');
      lines.push('Program desk saw large sell programs in ' + DS.SECTORS[secs[3]].short + ' (looked like de-grossing), balanced elsewhere.');
      (extra || []).forEach(function (e) { lines.push(e); });
      return { id: 'FLOW', cat: 'flow', head: 'Desk flow & color', body: lines.join(' '), lines: lines, meta: { secs: secs, buyer: buyer, ratio: ratio }, decode: DS.Notes.decodeFlow };
    },

    decodeFlow: function (S, n) {
      var m = n.meta, d = {};
      d.what = 'A summary of what passed through the desk yesterday and what types of clients were on each side.';
      d.why = 'Flow tells you who is likely on the other side of your orders. If long-onlys were buying ' + DS.SECTORS[m.secs[0]].short + ' and you have a sell there, there may be natural buyers to cross with. If hedge funds are selling a group into strength, rallies there may stall.';
      d.expect = 'Flow is persistent: institutions that started building or cutting positions usually keep going for days. Big "de-grossing" sell programs mean risk is coming off; watch for follow-through.';
      d.buy = 'Look for your names in the groups with sellers: those are where blocks and natural contras are most likely. Ask sales to look for the other side.';
      d.sell = 'In groups where long-onlys are buying, you have natural contras. Ask your sales trader to check interest before you show size on the screens.';
      return d;
    },

    decodeFlowEvent: function (S, n) {
      var s = S.stocks[n.tkr], d = {};
      d.what = n.head;
      d.why = 'When a large institution is working a big order, it leaves fingerprints: heavier volume than usual, prints clustering on one side, repeated block prints, and a drifting price.';
      d.expect = 'The drift lasts as long as the order does, often hours. Once the order finishes the stock tends to bounce back partly.';
      d.buy = 'A big natural seller is the best thing a buyer can find. Be patient, use dark aggregators and ask sales to find the seller for a block. Do not chase.';
      d.sell = 'You are competing with a bigger seller. Your price will drift lower while they work. Consider getting ahead with more urgency, or ask the client if they want to wait it out.';
      return d;
    },

    // ---------- Intraday stock headlines ----------
    headline: function (S, rng, s, kind, at) {
      var map = {
        mna: { head: s.tkr + ' SAID TO EXPLORE SALE AFTER RECEIVING TAKEOVER INTEREST - PEOPLE FAMILIAR', jump: rng.range(0.06, 0.1), drift: 0.01, vm: 6, sm: 2.5, why: 'Takeover reports reprice a stock toward a possible deal price immediately. "Said to" stories are unconfirmed, so the stock usually trades at a discount to the rumored premium.' },
        ceo: { head: s.tkr + ' CFO TO STEP DOWN EFFECTIVE IMMEDIATELY; COMPANY REAFFIRMS GUIDANCE', jump: -rng.range(0.025, 0.04), drift: -0.006, vm: 2.5, sm: 1.6, why: 'An abrupt CFO exit makes investors worry about accounting or guidance risk, even when the company reaffirms. The first move is usually down, and it often partly recovers.' },
        contract: { head: s.tkr + ' WINS $2.4B MULTI-YEAR CONTRACT; RAISES BACKLOG OUTLOOK', jump: rng.range(0.02, 0.035), drift: 0.006, vm: 2.2, sm: 1.4, why: 'A large contract adds visible future revenue. Moves are usually measured because the market partly expected it.' },
        preann: { head: s.tkr + ' PRE-ANNOUNCES Q3 REVENUE BELOW PRIOR GUIDANCE, CITES ORDER PUSH-OUTS', jump: -rng.range(0.07, 0.11), drift: -0.01, vm: 5, sm: 2.4, why: 'A pre-announcement is a company warning before the scheduled report. Negative ones hit hard and often hit peers too (read-across).', sector: -0.35 },
        index: { head: s.tkr + ' TO JOIN MAJOR LARGE-CAP INDEX EFFECTIVE NEXT WEEK', jump: rng.range(0.03, 0.05), drift: 0.004, vm: 2.4, sm: 1.2, why: 'Index additions force passive funds to buy on the effective date, usually in the closing auction. Active funds buy ahead of that.' },
        fda: { head: s.tkr + ' RECEIVES FDA APPROVAL FOR LEAD CANDIDATE; LABEL BROADER THAN EXPECTED', jump: rng.range(0.08, 0.14), drift: 0.01, vm: 6, sm: 2.5, why: 'Binary biotech events reprice the stock in seconds. A broader-than-expected label increases the addressable market.' },
        downgradeIntra: { head: 'CORBEL CUTS ' + s.tkr + ' TO SELL ON CHANNEL CHECKS; SEES 25% DOWNSIDE', jump: -rng.range(0.015, 0.03), drift: -0.006, vm: 2, sm: 1.4, why: 'An intraday rating change hits immediately because many funds see it at once on the squawk. Usually smaller than a morning Tier-1 call.' }
      };
      var x = map[kind];
      var t = DS.tOf(at);
      var ev = { t: t, scope: 'stock', target: s.tkr, jump: x.jump, drift: x.drift, dur: 3600, vm: x.vm, vmHalf: 2400, sm: x.sm, smHalf: 600,
        kind: 'headline', head: x.head, src: 'SQUAWK', tkr: s.tkr, meta: { kind: kind, why: x.why, jump: x.jump }, decode: DS.Notes.decodeHeadline };
      S.events.push(ev);
      if (x.sector) S.events.push({ t: t + 20, scope: 'sector', target: s.sector, jump: x.jump * 0.3, dur: 1800, drift: 0, vm: 1.6, vmHalf: 1800,
        head: DS.SECTORS[s.sector].short.toUpperCase() + ' PEERS LOWER IN SYMPATHY WITH ' + s.tkr, src: 'SQUAWK', sector: s.sector, kind: 'sector',
        meta: { why: 'Read-across: when one company warns about demand, investors assume peers face the same issue until proven otherwise.' }, decode: DS.Notes.decodeHeadline });
      return ev;
    },

    decodeHeadline: function (S, n) {
      var d = {}, s = n.tkr ? S.stocks[n.tkr] : null;
      d.what = n.head;
      d.why = n.meta.why;
      var big = n.meta.jump != null && Math.abs(n.meta.jump) > 0.05;
      d.expect = big ? 'An immediate repricing with a volume spike (5x+) and very wide spreads for several minutes. Liquidity providers pull back until the price settles.' : 'A quick move followed by a period where the stock looks for direction. Volume elevated for 30-60 minutes.';
      d.buy = 'If you are working a buy: pause or slow aggressive strategies for a minute, check the new level, and call the client. Material news changes the trade; the client may want to cancel, add a limit or speed up.';
      d.sell = 'If you are working a sell: same rule. Do not let an algo keep slicing through a news event without the client knowing. If the news helps your side, the client may want to use the liquidity.';
      return d;
    }
  };
})();
