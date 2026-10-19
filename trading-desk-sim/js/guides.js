/* "How to read this" guides for each type of morning-note item, with basic economics behind the color.
   Each guide: read = how to parse the item line by line, econ = the economics that makes it matter,
   ask = the questions a trader asks before the open. */
window.DS = window.DS || {};

DS.READ_GUIDES = {
  overnight: {
    title: 'Reading the overnight & futures line',
    read: [
      '<b>ES (S&amp;P 500 futures)</b> trade nearly 24 hours. The % shown is where the index would open if it opened now. +0.5% means most stocks open higher, each by roughly its beta × 0.5%.',
      '<b>Asia and Europe</b> tell you the global mood. If all three regions are down together, it is a macro story (rates, growth, geopolitics). If only one region moves, it is usually local news.',
      '<b>US 10y yield</b> is the most important price in finance: the return on a 10-year Treasury. The bp change matters more than the level. +5bp overnight is a notable move; +10bp is big.',
      '<b>WTI</b> is US crude oil. It drives energy stocks directly and inflation expectations indirectly.',
      '<b>VIX</b> is the market\'s expected volatility over the next 30 days. Under 15 is calm, 15-20 normal, 20-30 nervous, over 30 stressed.',
      '<b>Today\'s calendar</b> lists the scheduled events. These are the moments when spreads widen and prices jump, so plan around them.'
    ],
    econ: [
      '<b>Yields up = stocks\' future earnings are worth less today.</b> A company\'s value is its future profits discounted back to today. Higher rates mean heavier discounting, which hits "long-duration" stocks hardest: growth companies whose profits are far in the future (software, semis, unprofitable tech).',
      '<b>Yields up helps banks.</b> Banks earn the gap between what they charge on loans and pay on deposits (net interest margin). Higher rates usually widen that gap.',
      '<b>Utilities and REITs are "bond proxies".</b> Investors own them for steady dividends, so when bonds pay more they look less attractive and fall.',
      '<b>Oil up</b> helps energy producers, hurts airlines, transports and consumers (fuel is a cost), and pushes inflation expectations higher, which can push yields up.',
      '<b>VIX and stocks move opposite.</b> When the market falls, VIX jumps. A rising VIX on a flat market is a warning that investors are buying protection.',
      '<b>The dollar (DXY)</b>: a strong dollar hurts US multinationals (overseas sales are worth fewer dollars) and commodities priced in dollars.'
    ],
    ask: ['Where will my names open, given their beta and the futures move?', 'Is today a macro day (rates and data drive everything) or a stock-picking day?', 'What times today are dangerous to run aggressive strategies through?']
  },

  macro: {
    title: 'Reading an economic data release',
    read: [
      'Format: <b>indicator: actual vs estimate</b>. The estimate (consensus) is the median forecast of economists. Markets have already priced the estimate in.',
      '<b>Only the surprise matters.</b> A strong number that matches the estimate moves nothing. A small miss vs a tight consensus can move a lot.',
      'Then read the reaction line: what did the <b>10y yield</b> and <b>ES</b> do on the print? The bond market reacts first and is the best judge of what the number means.',
      'Watch for revisions to prior months and the details (core vs headline). Desks often reverse the first move once people read past the headline.'
    ],
    econ: [
      '<b>The Fed\'s job</b> is stable prices (inflation around 2%) and maximum employment. Every data point is read through one lens: does this make the Fed more likely to cut rates (dovish) or keep them high / hike (hawkish)?',
      '<b>Hawkish surprise</b> (hot inflation, very strong jobs): yields up, dollar up, stocks down, growth/tech hit hardest, banks hold up better.',
      '<b>Dovish surprise</b> (soft inflation, weak jobs): yields down, stocks usually up, growth/tech and utilities lead. But if the data is weak enough to signal recession, stocks can fall anyway ("bad news is bad news").',
      '<b>"Good news is bad news"</b>: in an inflation-focused market, strong economic data can push stocks down because it means higher rates for longer. Learn which regime the market is in by watching how it reacts.'
    ],
    ask: ['Was it a surprise, and in which direction (hawkish or dovish)?', 'Which of my names are rate-sensitive?', 'Does the move change the urgency of any order?'],
    byKind: {
      CPI: ['<b>CPI</b> (Consumer Price Index) measures inflation in what households buy. Traders focus on <b>core CPI m/m</b> (month-on-month, excluding food and energy) because food and energy are volatile and the Fed looks through them.', 'A 0.1% difference in core m/m sounds tiny but annualizes to ~1.2% a year: that is why 0.4% vs 0.3% est can move the whole market.'],
      NFP: ['<b>Nonfarm payrolls (NFP)</b> counts jobs added last month, released the first Friday of the month. Around 100-150k is a "normal" pace today.', 'Also watch the unemployment rate and average hourly earnings: fast wage growth feeds inflation, which matters more to the Fed than the headline jobs count.'],
      PPI: ['<b>PPI</b> (Producer Price Index) measures prices businesses receive. It tends to lead CPI: costs that hit producers often get passed on to consumers later.', 'PPI usually moves markets less than CPI, but a big PPI surprise right before a CPI release gets attention.']
    }
  },

  research: {
    title: 'Reading a research call',
    read: [
      '<b>Broker name</b>: who wrote it. Tier-1 (bulge bracket) analysts are read by almost every fund and move stocks more.',
      '<b>Action</b>: upgrade, downgrade, initiation, or PT change. A <b>rating change</b> is a change of opinion and matters most. An initiation is a first opinion. A PT change with no rating change is usually the analyst catching up to the price.',
      '<b>Rating scale</b>: Overweight / Buy = expect it to beat the market; Neutral / Equal-weight / Hold = in line; Underweight / Sell = lag. Moving two notches (Underweight to Overweight) is rare and powerful.',
      '<b>PT (price target)</b>: where the analyst thinks the stock will be in ~12 months. Compute the implied upside vs yesterday\'s close. 20%+ from a fresh upgrade signals conviction.',
      '<b>The reason</b> (the thesis line) tells you whether it is new information (channel checks, a new product read) or a valuation call ("too cheap"). New information moves stocks more.'
    ],
    econ: [
      'Stock prices reflect expectations. A call moves a stock only when it <b>changes what investors expect</b> about future earnings or valuation.',
      '<b>Consensus</b>: the average of analysts\' earnings estimates. A call that argues consensus is too low (or too high) is the most market-moving type.',
      'Valuation basics: <b>P/E</b> (price / earnings) tells you what investors pay per dollar of profit. An analyst arguing for a higher multiple ("re-rating") is a bet that investors will pay more for the same earnings.',
      '<b>Crowding</b>: if everyone already owns a stock, an upgrade has fewer new buyers. If the stock is under-owned, a Tier-1 upgrade can bring a wave of buyers for days.'
    ],
    ask: ['Is this a rating change or noise?', 'How big is the PT vs the price?', 'Do I have an order in the name, and is the call with me or against me?', 'Will the move extend or fade after the open?']
  },

  earnings: {
    title: 'Reading an earnings headline',
    read: [
      '<b>AMC / BMO</b>: after market close or before market open. Companies report outside trading hours so the price reacts in pre-market.',
      '<b>EPS actual vs consensus</b>: earnings per share. A "beat" is above consensus. Most companies beat by a little; a beat is expected, not exciting.',
      '<b>Revenue</b>: sales. A beat on EPS driven by cost cuts with weak revenue is lower quality than a revenue beat.',
      '<b>Guidance</b> is the most important line: the company\'s own forecast for next quarter or year. Raise, reiterate, or cut. Markets trade the future, so the guide usually decides the direction.',
      '<b>Pre-market indication</b> (e.g. "-6% pre"): where the stock is trading before the open. Thin pre-market volume means the real price discovery happens at 9:30.',
      '<b>Peers indicated</b>: read-across. Suppliers, customers and competitors move in sympathy.'
    ],
    econ: [
      '<b>Beat and raise</b> = estimates go up for the coming year. The strongest outcome.',
      '<b>Beat but weak guide</b> = the past was good, the future is worse. Usually the stock falls. This trips up beginners more than anything else.',
      '<b>Margins</b> (profit as a % of sales) show pricing power. Rising margins with rising sales is the healthiest combination.',
      '<b>Read-across</b> follows the supply chain: a chip maker\'s strong guide often means its customers are spending (good for peers) and its suppliers have orders (good for equipment makers).'
    ],
    ask: ['What did the guide do?', 'How far is it indicated, and on how much pre-market volume?', 'Which peers move with it, and do I have orders in any of them?', 'Expect very wide spreads and heavy volume in the first 15 minutes.']
  },

  flow: {
    title: 'Reading desk flow & color',
    read: [
      '<b>"Finished 1.4:1 better buyer"</b>: for every $1 the desk\'s clients sold, they bought $1.40. It describes the desk\'s client flow, not the whole market.',
      '<b>Client type matters</b>: long-onlys (mutual funds, pensions) move slowly and persistently over days or weeks. Hedge funds are faster and more tactical. Programs are often rebalancing and not a view on single stocks.',
      '<b>"Selling into strength"</b>: investors are using up-days to reduce. Rallies may stall. <b>"Buying weakness"</b>: dips are being bought, a sign of support.',
      '<b>"De-grossing"</b>: hedge funds cutting both longs and shorts to reduce risk. Crowded longs fall and crowded shorts rise at the same time, which can look strange.',
      'Specific hints like <b>"a large holder has been liquidating"</b> are gold: they tell you where block liquidity probably sits today.'
    ],
    econ: [
      'Prices move when one side is more urgent than the other. Flow color tells you <b>who is urgent</b>.',
      'Institutional flow is <b>persistent</b>: a pension that started selling a position yesterday is likely still selling today. That is why yesterday\'s flow helps predict today\'s liquidity.',
      'Sector rotation shows up in flow before it shows in prices: long-onlys moving from tech to financials, for example, often signals a view on rates or the economy.'
    ],
    ask: ['Where is the natural other side for my orders likely to be?', 'Is anyone a big, persistent seller or buyer in my names?', 'Should I ask sales to look for a block before I show size on the screens?']
  }
};

DS.readGuideHTML = function (n) {
  var g = DS.READ_GUIDES[n.cat];
  if (!g) return '';
  var extra = n.cat === 'macro' && n.meta && g.byKind[n.meta.k] ? '<h5>About this indicator</h5><ul>' + g.byKind[n.meta.k].map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ul>' : '';
  var li = function (a) { return '<ul>' + a.map(function (x) { return '<li>' + DS.gloss(x) + '</li>'; }).join('') + '</ul>'; };
  return '<details class="howread"><summary>How to read this</summary><div class="hr-body">' +
    '<h5>' + g.title + '</h5>' + li(g.read) + extra +
    '<h5>Econ basics behind the color</h5>' + li(g.econ) +
    '<h5>Questions to ask before the open</h5>' + li(g.ask) + '</div></details>';
};
