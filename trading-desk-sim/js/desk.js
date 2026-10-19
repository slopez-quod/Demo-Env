/* Desk plumbing: chat, decisions (quiz moments), coach tips, scoring. UI reads these lists. */
window.DS = window.DS || {};

DS.Desk = {
  // from: display name, kind: 'client' | 'sales' | 'desk' | 'system'
  chat: function (S, msg) {
    var m = Object.assign({ id: 'M' + (++S.seq), t: S.t, from: 'Desk', kind: 'desk', text: '', choices: null, answered: null }, msg);
    S.chat.push(m);
    S.unread.chat++;
    if (m.choices && S.autoPause) { DS.Desk.pause(S, 'Reply needed in chat'); if (DS.UI && S.curTab !== 'chat') DS.UI.tab('chat'); }
    DS.UI && DS.UI.flash('chat');
    return m;
  },

  // Answer a chat with choices: each choice {t, s (0..1), why, fx(S)}
  reply: function (S, mid, idx) {
    var m = S.chat.filter(function (x) { return x.id === mid; })[0];
    if (!m || m.answered != null) return;
    var c = m.choices[idx];
    m.answered = idx;
    S.chat.push({ id: 'M' + (++S.seq), t: S.t, from: 'You', kind: 'me', text: c.say || c.t });
    if (c.s != null) DS.Desk.score(S, m.cat || 'client', c.s, m.title || m.text, c.why, c.t, m.best != null ? m.choices[m.best].t : null);
    if (c.fx) c.fx(S);
    if (c.reply) S.chat.push({ id: 'M' + (++S.seq), t: S.t, from: m.from, kind: m.kind, text: c.reply });
  },

  decide: function (S, d) {
    var x = Object.assign({ id: 'D' + (++S.seq), t: S.t, answered: null }, d);
    S.decisions.push(x);
    S.pendingDecision = S.pendingDecision || x;
    DS.Desk.pause(S, 'Decision point');
    return x;
  },

  answer: function (S, did, idx) {
    var d = S.decisions.filter(function (x) { return x.id === did; })[0];
    if (!d || d.answered != null) return;
    d.answered = idx;
    var c = d.options[idx];
    var best = 0; d.options.forEach(function (o, i) { if (o.s > d.options[best].s) best = i; });
    d.best = best;
    DS.Desk.score(S, d.cat || 'decision', c.s, d.title, c.why, c.t, d.options[best].t);
    if (c.fx) c.fx(S);
  },

  nextDecision: function (S) {
    S.pendingDecision = S.decisions.filter(function (x) { return x.answered == null; })[0] || null;
  },

  score: function (S, cat, s, title, why, chosen, best) {
    S.score.items.push({ t: S.t, cat: cat, s: s, title: title, why: why, chosen: chosen, best: best });
    if (cat === 'client' || cat === 'color') S.score.rel = DS.clamp(S.score.rel + (s - 0.55) * 14, 0, 100);
  },

  tip: function (S, key, level, text, tkr) {
    if (S.tipKeys[key]) return;
    S.tipKeys[key] = S.t;
    S.tips.unshift({ t: S.t, level: level, text: text, tkr: tkr, key: key });
    S.unread.coach++;
    DS.UI && DS.UI.flash('coach');
  },

  news: function (S, item) {
    S.news.unshift(Object.assign({ t: S.t, id: 'N' + (++S.seq) }, item));
    S.unread.news++;
    DS.UI && DS.UI.flash('news');
  },

  pause: function (S, why) {
    if (!S.running) return;
    S.running = false;
    S.pauseWhy = why;
  }
};
