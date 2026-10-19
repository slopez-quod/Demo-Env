/* App shell: creates a trading day, runs the clock and steps the engine. */
window.DS = window.DS || {};

DS.App = {
  speed: 6, // engine steps per real second (6 = one sim minute per second)

  newDay: function (role, day) {
    var S = {
      role: role, day: day, seed: day * 9973 + (role === 'HT' ? 1 : role === 'PT' ? 2 : 3),
      t: 0, phase: 'pre', running: false, autoPause: DS.$('#autoPause').checked, seq: 0,
      orders: [], fills: [], chat: [], news: [], tips: [], tipKeys: {}, decisions: [], pendingDecision: null,
      score: { items: [], rel: 60 }, unread: { chat: 0, news: 0, coach: 0 }, flags: {}, byKey: {}, ptSel: {},
      fut: { pos: 0, cash: 0, trades: [] }, curTab: 'chat', selected: null, selOrder: null, started: true
    };
    var base = new Date(2026, 9, 19);
    var dt = new Date(base.getTime() + (day - 1) * 86400000);
    while (dt.getDay() === 0 || dt.getDay() === 6) dt = new Date(dt.getTime() + 86400000);
    S.dateStr = dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    DS.S = S;
    DS.Scen.build(S);
    // Watchlist order: focus names first
    var focus = S.role === 'ST' ? ['SEMI', 'SOFT'] : null;
    var basketNames = S.basketSpec ? S.basketSpec.orders.map(function (o) { return o.tkr; }) : null;
    S.watchOrder = S.tkrs.slice().sort(function (a, b) {
      var A = S.stocks[a], B = S.stocks[b];
      var fa = focus ? (focus.indexOf(A.sector) >= 0 ? 0 : 1) : basketNames ? (basketNames.indexOf(a) >= 0 ? 0 : 1) : 0;
      var fb = focus ? (focus.indexOf(B.sector) >= 0 ? 0 : 1) : basketNames ? (basketNames.indexOf(b) >= 0 ? 0 : 1) : 0;
      return (fa - fb) || (Object.keys(DS.SECTORS).indexOf(A.sector) - Object.keys(DS.SECTORS).indexOf(B.sector));
    });
    var firstNote = S.notes.filter(function (n) { return n.tkr; })[0];
    S.selected = firstNote ? firstNote.tkr : S.tkrs[0];
    DS.$('#roleChip').textContent = DS.ROLES[role].title + ' · ' + S.dateStr;
    DS.$('#basketBox').hidden = true; DS.$('#basketBox').innerHTML = '';
    DS.$('#blotter').innerHTML = '';
    DS.$('#wl tbody').innerHTML = '';
    ['#ovDecision', '#ovEod', '#ovDecode', '#ovPretrade'].forEach(function (id) { DS.$(id).hidden = true; });
    DS.UI.tab('notes');
    DS.UI.renderTicket(true);
    DS.UI.render(true);
    DS.Desk.chat(S, { from: 'Desk head', kind: 'desk', text: DS.App.welcome(role) });
    DS.UI.morning();
  },

  welcome: function (role) {
    if (role === 'PT') return 'Morning. You are on the program desk today. A client basket comes in before the open: run pre-trade, decide agency or risk bid, then keep it balanced all day. Hedge with futures when you drift.';
    if (role === 'ST') return 'Morning. You are covering Tech today: Semis and Software. Watch the read-across from last night\'s earnings, keep your clients posted on the group, and look for crosses between clients.';
    return 'Morning. You are on the high-touch desk. Clients will send orders through the day. Read the note, pick the right strategy for each benchmark, keep clients informed, and grab block liquidity when it shows up.';
  },

  openMarket: function () {
    var S = DS.S;
    DS.Market.open(S);
    S.phase = 'open';
    if (S.role === 'PT' && S.basket) {
      DS.PT.createOrders(S);
      S.selOrder = S.basket.orders[0];
      S.selected = DS.Orders.get(S, S.selOrder).tkr;
    }
    DS.UI.tab('chat');
    DS.UI.renderTicket(true);
    S.running = true; S.pauseWhy = null;
    DS.App.last = performance.now();
    DS.UI.render(true);
  },

  toggle: function () {
    var S = DS.S; if (!S) return;
    if (S.phase === 'pre') { if (DS.$('#ovMorning').hidden && DS.$('#ovPretrade').hidden) DS.UI.morning(); return; }
    if (S.phase === 'closed') { DS.UI.eod(); return; }
    if (S.pendingDecision) { DS.UI.decision(S.pendingDecision); return; }
    S.running = !S.running; S.pauseWhy = null; S.autoPaused = false;
    DS.App.last = performance.now();
    DS.UI.render(true);
  },

  // Resume after an automatic pause once nothing is waiting on the user.
  maybeResume: function () {
    var S = DS.S;
    if (!S || S.phase !== 'open' || S.running) return;
    if (S.pendingDecision) return;
    if (S.chat.some(function (m) { return m.choices && m.answered == null; })) return;
    if (S.pauseWhy) { S.running = true; S.pauseWhy = null; DS.App.last = performance.now(); }
  },

  step: function () {
    var S = DS.S;
    S.t += DS.STEP;
    // scripted market events
    while (S.events.length && S.events[0].t <= S.t) {
      var ev = S.events.shift();
      DS.Market.fire(S, ev);
      if (ev.head) {
        DS.Desk.news(S, { head: ev.head, src: ev.src, tkr: ev.tkr || (ev.scope === 'stock' ? ev.target : null), sector: ev.sector, meta: ev.meta, decode: ev.decode, cat: ev.kind });
        if (ev.scope === 'stock') DS.Scen.newsOnOrderDecision(S, ev);
      }
    }
    DS.Market.step(S);
    DS.Orders.step(S);
    S.script.forEach(function (x) { if (!x.done && x.t <= S.t) { x.done = true; x.run(S); } });
    if (S.t === DS.tOf('15:50') || S.t === DS.tOf('15:55')) DS.Market.publishImbalance(S);
    DS.Log.run(S);
    if (S.basket) DS.PT.monitor(S);
    if (S.t >= DS.DAY_SECS) {
      DS.Market.closeAuction(S);
      DS.Orders.atClose(S);
      S.phase = 'closed'; S.running = false;
      DS.UI.render(true);
      DS.UI.eod();
    }
  },

  loop: function (now) {
    var S = DS.S;
    if (S && S.running && S.phase === 'open') {
      var dt = Math.min(0.25, (now - (DS.App.last || now)) / 1000);
      DS.App.acc = (DS.App.acc || 0) + dt * DS.App.speed;
      var n = Math.floor(DS.App.acc);
      DS.App.acc -= n;
      for (var i = 0; i < n && S.running && S.phase === 'open'; i++) DS.App.step();
      // Render at ~8fps while running, and immediately when the sim pauses itself
      if (!S.running || !DS.App.lastR || now - DS.App.lastR > 120) { DS.App.lastR = now; DS.UI.render(); }
    }
    DS.App.last = now;
    requestAnimationFrame(DS.App.loop);
  },

  fastForward: function () {
    var S = DS.S;
    S.autoPause = false;
    var guard = 0;
    while (S.phase === 'open' && guard++ < 5000) {
      if (S.pendingDecision) { var d = S.pendingDecision; d.answered = -1; S.score.items.push({ t: S.t, cat: d.cat, s: 0.3, title: d.title, why: 'Skipped by fast-forward.', chosen: 'skipped', best: d.options.slice().sort(function (a, b) { return b.s - a.s; })[0].t }); DS.Desk.nextDecision(S); }
      S.running = true;
      DS.App.step();
    }
    S.autoPause = DS.$('#autoPause').checked;
    DS.UI.render(true);
  }
};

(function boot() {
  var th = DS.store.get('theme', '');
  if (th) document.documentElement.dataset.theme = th;
  DS.UI.init();
  requestAnimationFrame(DS.App.loop);
  DS.UI.home();
})();
