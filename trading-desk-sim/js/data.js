/* Static reference data: universe, counterparties, glossary, playbook.
   All companies, brokers and clients are fictional. Prices are simulated. */
window.DS = window.DS || {};

DS.SECTORS = {
  SEMI: { name: 'Semiconductors', etf: 'XSMH', short: 'Semis' },
  SOFT: { name: 'Software', etf: 'XSFT', short: 'Software' },
  INTN: { name: 'Internet & Media', etf: 'XNET', short: 'Internet' },
  BANK: { name: 'Banks & Financials', etf: 'XFIN', short: 'Financials' },
  HLTH: { name: 'Healthcare', etf: 'XHLC', short: 'Healthcare' },
  ENGY: { name: 'Energy', etf: 'XENG', short: 'Energy' },
  INDU: { name: 'Industrials', etf: 'XIND', short: 'Industrials' },
  CONS: { name: 'Consumer', etf: 'XCON', short: 'Consumer' },
  UTIL: { name: 'Utilities', etf: 'XUTL', short: 'Utilities' }
};

// Sector factor: annual vol of the sector-specific factor, and how it reacts to rates (+ = likes higher yields)
DS.SECTOR_FACTOR = {
  SEMI: { vol: 0.20, rates: -0.6 }, SOFT: { vol: 0.16, rates: -0.8 }, INTN: { vol: 0.15, rates: -0.5 },
  BANK: { vol: 0.13, rates: 0.9 }, HLTH: { vol: 0.10, rates: 0.0 }, ENGY: { vol: 0.20, rates: 0.2 },
  INDU: { vol: 0.10, rates: 0.1 }, CONS: { vol: 0.10, rates: -0.2 }, UTIL: { vol: 0.10, rates: -1.0 }
};

// tkr, name, sector, prevClose, ADV (shares), annual vol, beta, quoted spread (bps), market cap ($B)
DS.UNIVERSE = [
  ['NVLT', 'Novalith Semiconductor', 'SEMI', 148.20, 9.5e6, 0.48, 1.60, 1.6, 610],
  ['ARXS', 'Arxis Micro Devices', 'SEMI', 62.35, 6.1e6, 0.42, 1.45, 2.4, 98],
  ['QBIT', 'Quantabit Systems', 'SEMI', 214.10, 2.4e6, 0.38, 1.35, 2.2, 140],
  ['LMNA', 'Lumina Photonics', 'SEMI', 37.48, 3.1e6, 0.55, 1.50, 6.5, 9],
  ['ORCX', 'Orcasoft', 'SOFT', 88.40, 4.2e6, 0.34, 1.20, 2.0, 210],
  ['CLDR', 'Cloudreach', 'SOFT', 241.05, 1.8e6, 0.40, 1.30, 3.0, 64],
  ['SYNQ', 'Synqware', 'SOFT', 54.22, 2.6e6, 0.36, 1.15, 3.6, 18],
  ['FRTA', 'Fortalis Security', 'SOFT', 132.60, 1.1e6, 0.42, 1.25, 4.5, 31],
  ['PXLM', 'Pixelmark', 'INTN', 172.15, 7.0e6, 0.33, 1.15, 1.4, 480],
  ['STRM', 'Streamline Media', 'INTN', 96.52, 3.4e6, 0.37, 1.10, 2.6, 45],
  ['HVNW', 'Havenware Social', 'INTN', 28.74, 11.0e6, 0.45, 1.30, 3.5, 22],
  ['GRNT', 'Granite Bancorp', 'BANK', 51.30, 14.0e6, 0.24, 1.10, 2.0, 160],
  ['MRDN', 'Meridian Capital Group', 'BANK', 418.40, 1.6e6, 0.26, 1.20, 1.8, 135],
  ['HLYN', 'Halyard Financial', 'BANK', 74.90, 3.8e6, 0.27, 1.15, 2.7, 38],
  ['CVRP', 'Covey Regional Bank', 'BANK', 23.42, 4.5e6, 0.32, 1.20, 4.3, 6],
  ['VTRX', 'Vitrex Pharma', 'HLTH', 112.80, 5.1e6, 0.22, 0.65, 1.8, 260],
  ['ALVO', 'Alveo Biosciences', 'HLTH', 46.10, 2.9e6, 0.55, 1.00, 5.5, 7],
  ['CRDN', 'Cardinia Medical', 'HLTH', 205.30, 1.2e6, 0.24, 0.80, 2.9, 52],
  ['MDPT', 'Medpoint Health', 'HLTH', 318.75, 2.1e6, 0.23, 0.70, 1.9, 180],
  ['PTRX', 'Petrex Energy', 'ENGY', 78.62, 8.2e6, 0.30, 0.95, 1.6, 205],
  ['BSLT', 'Basalt Oil & Gas', 'ENGY', 34.18, 6.4e6, 0.38, 1.05, 3.2, 21],
  ['TRWD', 'Tradewind Renewables', 'ENGY', 19.84, 5.5e6, 0.50, 1.20, 5.6, 5],
  ['AXLE', 'Axle Industries', 'INDU', 162.40, 2.2e6, 0.26, 1.05, 2.2, 74],
  ['KSTL', 'Keystone Aerospace', 'INDU', 247.10, 1.5e6, 0.27, 1.00, 2.5, 88],
  ['RLWY', 'Railway Logistics', 'INDU', 68.30, 2.7e6, 0.23, 0.95, 2.6, 33],
  ['BRCK', 'Brickhaus Retail', 'CONS', 141.05, 3.6e6, 0.28, 1.00, 2.0, 96],
  ['NOMA', 'Noma Foods', 'CONS', 63.40, 3.1e6, 0.18, 0.55, 2.3, 41],
  ['VELA', 'Vela Apparel', 'CONS', 41.82, 2.4e6, 0.40, 1.15, 4.2, 8],
  ['HRTH', 'Hearth Home', 'CONS', 95.20, 1.9e6, 0.30, 1.05, 3.4, 15],
  ['VLTA', 'Volta Power', 'UTIL', 72.10, 3.3e6, 0.18, 0.40, 2.4, 58],
  ['HDRO', 'Hydro Grid', 'UTIL', 48.60, 2.2e6, 0.17, 0.40, 3.0, 23]
].map(function (r) {
  return { tkr: r[0], name: r[1], sector: r[2], prevClose: r[3], adv: r[4], vol: r[5], beta: r[6], spr: r[7], mcap: r[8] };
});

// Sell-side research providers. tier 1 = bulge bracket axe, moves stocks more.
DS.BROKERS = [
  { name: 'Halcyon Partners', tier: 1 }, { name: 'Brightwater & Co', tier: 1 }, { name: 'Ironbridge Capital Markets', tier: 1 },
  { name: 'Corbel Securities', tier: 2 }, { name: 'Stanmore Research', tier: 2 }, { name: 'Northgate Equity', tier: 2 },
  { name: 'Pellham Small-Cap Advisors', tier: 3 }
];

// Buy-side clients and how they behave.
DS.CLIENTS = [
  { name: 'Atlas Peak Asset Mgmt', type: 'Long-only', contact: 'Dana (PM)', style: 'patient', note: 'Benchmarks to VWAP. Hates footprint. Will add size on weakness.' },
  { name: 'Bluewater Pension', type: 'Pension', contact: 'Rob (Trader)', style: 'patient', note: 'Large, slow orders. Low urgency. Values block liquidity.' },
  { name: 'Cedar Ridge Investors', type: 'Long-only', contact: 'Priya (Trader)', style: 'balanced', note: 'Arrival benchmark. Wants frequent color.' },
  { name: 'Kestrel Capital', type: 'Hedge fund', contact: 'Marco (PM)', style: 'urgent', note: 'Event-driven. Alpha decays fast. Info-sensitive.' },
  { name: 'Vantage Point Partners', type: 'Hedge fund', contact: 'Jules (Head trader)', style: 'urgent', note: 'Long/short. Trades around catalysts. Wants speed, no leakage.' },
  { name: 'Ironwood Quant', type: 'Quant', contact: 'Execution desk', style: 'balanced', note: 'Strict participation caps. Measures everything in bps vs arrival.' }
];

DS.PT_CLIENTS = [
  { name: 'State Teachers Retirement Fund', type: 'Pension transition', contact: 'Transition mgmt team' },
  { name: 'Harborline Index Advisors', type: 'Index rebalance', contact: 'Portfolio trading desk' },
  { name: 'Ironwood Quant', type: 'Quant rebalance', contact: 'Execution desk' }
];

DS.ROLES = {
  HT: {
    id: 'HT', title: 'High-Touch Agency Trader', kicker: 'Cash equities · single stocks',
    desc: 'Work large single-stock orders for institutional clients. Pick algos, source block liquidity, manage client instructions and give color in real time.',
    learn: ['Choosing the right algo for the benchmark', 'Sourcing blocks and dark liquidity', 'Talking to PMs and traders', 'Working the close']
  },
  PT: {
    id: 'PT', title: 'Program Trader', kicker: 'Portfolio trading · baskets',
    desc: 'Execute a multi-name basket for a transition or rebalance. Run pre-trade, price a risk bid, tier the list, keep the basket balanced and hedge residual risk with futures.',
    learn: ['Pre-trade analytics and tiering', 'Pricing a principal risk bid', 'Dollar and beta neutrality', 'Hedging residuals with futures']
  },
  ST: {
    id: 'ST', title: 'Sector Trader', kicker: 'Coverage · Technology',
    desc: 'Cover Semis and Software. Read sector research and read-across, give color on your names, and work several client orders in the same sector at once.',
    learn: ['Sector read-across from earnings and news', 'Relative performance vs sector and SPX', 'Giving useful color', 'Juggling crossing interest']
  }
};

DS.ALGOS = {
  VWAP: { name: 'VWAP', desc: 'Follows the historical volume curve between start and end time. Low footprint, tracks the VWAP benchmark.', bench: 'VWAP' },
  TWAP: { name: 'TWAP', desc: 'Even slices over time. Ignores the volume curve, so it can be heavy at lunch when volume is thin.', bench: 'TWAP' },
  POV: { name: 'POV', desc: 'Participates at a fixed percentage of market volume. Speeds up when the stock trades more. Finish time is uncertain.', bench: 'Arrival / participation' },
  IS: { name: 'Arrival (IS)', desc: 'Implementation shortfall. Front-loads to reduce timing risk vs the arrival price. Higher impact, lower drift risk.', bench: 'Arrival' },
  DARK: { name: 'Dark aggregator', desc: 'Rests at the midpoint in dark pools. Saves the spread, no displayed footprint, but fills are slow and uncertain. Occasional blocks.', bench: 'Arrival / spread capture' },
  MOC: { name: 'Market-on-close', desc: 'Executes in the closing auction at the official close. Must be entered before the 15:50 cutoff.', bench: 'Close' },
  LMT: { name: 'Limit (manual)', desc: 'A resting limit order you control. Fills only if the market trades at your price.', bench: '-' },
  MKT: { name: 'Market (manual)', desc: 'Crosses the spread and walks the book immediately. Certainty of execution at the cost of spread and impact.', bench: '-' }
};

DS.GLOSSARY = {
  'ADV': 'Average daily volume. The single most important liquidity measure. An order\'s size is described as a % of ADV: under 5% is easy, 10-20% is a full day of careful work, over 25% usually needs blocks or multiple days.',
  '% ADV': 'Order size divided by average daily volume. Rough guide: <5% easy, 5-15% normal day\'s work, 15-30% needs patience or blocks, >30% multi-day.',
  'Arrival price': 'The mid price when the order reached the desk. Implementation-shortfall benchmarks measure every fill against it.',
  'Implementation shortfall': 'The total cost of executing vs the arrival price: spread, impact, timing drift and any unfilled opportunity cost.',
  'VWAP': 'Volume-weighted average price over a period. A VWAP benchmark asks you to trade in line with the market\'s volume, not to beat a specific price.',
  'TWAP': 'Time-weighted average price. Even slices per unit of time.',
  'POV': 'Percent of volume. Trade a fixed share of what the market prints, e.g. 10%.',
  'Participation': 'Your volume as a share of total market volume over a period. High participation = more impact and more visible footprint.',
  'Market impact': 'How much your own trading moves the price. Grows roughly with the square root of size relative to ADV, and with volatility.',
  'Square-root law': 'Empirical rule: impact ≈ Y · daily vol · √(Q / ADV), with Y around 0.5-1. A 10% ADV order in a 2% daily-vol stock costs ~40-60 bps.',
  'Timing risk': 'The risk the price drifts away while you wait. Trading slowly lowers impact but raises timing risk. Urgency is the dial between them.',
  'Alpha decay': 'How quickly the reason for a trade gets priced in. Event-driven hedge funds have fast-decaying alpha and want speed. Long-only rebalancing has slow alpha.',
  'Spread': 'Difference between best bid and best ask. Crossing it costs half the spread vs mid. Usually quoted in bps.',
  'bps': 'Basis points. 1 bp = 0.01%. Traders measure cost and performance in bps.',
  'Mid': 'Midpoint between best bid and best offer. Dark pools usually cross at the mid.',
  'Level 2': 'The order book: displayed bids and offers at each price level with sizes.',
  'Tape': 'Time & sales: every print with price, size and venue. Reading the tape means inferring who is aggressive and how big they are.',
  'Print': 'A reported trade.',
  'Block': 'A large single trade, often negotiated or crossed off-exchange. Typical threshold: 10,000+ shares or $200k+, but desks think in % ADV.',
  'IOI': 'Indication of interest. A broker signals it has (or may have) natural interest on one side of a stock.',
  'Natural': 'A real institutional buyer or seller, as opposed to a market maker or an algo slice. Crossing with a natural avoids market impact.',
  'Axe': 'A broker\'s strongest interest or position in a name. "We\'re axed to buy" means they have real buy interest.',
  'Color': 'Market information given to a client: what a stock is doing, why, who is trading it, and what the desk is seeing.',
  'Flow': 'Who is trading what. "Better buyers" means the desk saw more buys than sells.',
  'Better buyer': 'Desk jargon: more buy than sell interest went through the desk. "1.5:1 better buyer" means 1.5 dollars bought per dollar sold.',
  'Dark pool': 'A venue with no displayed quotes. Orders cross at the mid. Less footprint, uncertain fills.',
  'Iceberg': 'A large order that shows only a small displayed size and keeps refilling at the same price. Spot it on the tape as repeated prints at one level that never clears.',
  'Closing auction': 'The 16:00 auction that sets the official close. Typically 8-12% of daily volume, more on index rebalance days.',
  'MOC': 'Market-on-close order. Must be entered before the 15:50 cutoff on most venues and cannot be cancelled after it.',
  'Imbalance': 'Published from 15:50: how many more shares are to buy than sell (or vice versa) at the close. Large imbalances move the closing price.',
  'Risk bid': 'A principal trade: the broker quotes a price (e.g. close minus 15 bps) to take the whole basket onto its own book, then unwinds it. The client gets certainty, the broker takes the risk.',
  'Agency': 'The broker works the order on the client\'s behalf and earns a commission. The client keeps the price risk.',
  'Principal': 'The broker trades with its own capital and takes the price risk.',
  'Tracking error': 'Uncertainty of a basket\'s performance vs its benchmark. Unbalanced baskets have high tracking error.',
  'Dollar neutral': 'Equal dollars bought and sold. A balanced program keeps the buy and sell sides finishing at similar rates.',
  'Beta': 'Sensitivity of a stock to the market. Beta-adjusted exposure = notional × beta.',
  'Residual': 'Exposure left after hedging the market. In a basket, the sector and stock-specific risk you still carry.',
  'Futures hedge': 'Selling or buying index futures (ES) to offset the market exposure of an unbalanced basket.',
  'Tiering': 'Splitting a basket into groups by liquidity (% ADV) and trading each with a strategy suited to it.',
  'PT': 'Price target from a research analyst.',
  'Upgrade': 'An analyst raises the rating, e.g. Neutral to Overweight. Tier-1 upgrades with a big PT increase can move a stock 2-5%.',
  'Read-across': 'News at one company that implies something for its peers. A supplier\'s strong guide can lift its customers\' stocks.',
  'Guide': 'Company forecast for the next quarter or year. The guide usually matters more than the reported beat or miss.',
  'Beat': 'Results above consensus estimates.',
  'Gap': 'An open far from the prior close. Gaps on news often see heavy volume and wide spreads in the first 15-30 minutes.',
  'Gap fill': 'The stock trades back toward the prior close after gapping.',
  'Opening auction': 'The 9:30 auction that sets the opening price.',
  'Squawk': 'Real-time headlines read out or streamed on the desk.',
  'High touch': 'An order worked by a human trader who manages strategy, sources liquidity and talks to the client.',
  'Low touch': 'Client-driven electronic execution through algos, with little trader involvement.',
  'Upsize': 'The client increases the order size.',
  'Footprint': 'How visible your activity is to other participants. Large footprint invites front-running.',
  'Information leakage': 'Others inferring your intentions from your trading or your questions, then trading ahead of you.',
  'Limit': 'The worst price the client will accept. Never trade through it.',
  'Benchmark': 'The price your execution will be measured against: arrival, VWAP, close, or TWAP.',
  'Relative performance': 'A stock\'s move vs its sector or the index. Separates stock-specific news from the tide.',
  'Risk-on': 'Market tone where investors buy growth, cyclicals and high-beta names and sell defensives.',
  'Risk-off': 'Market tone where investors sell high-beta names and buy defensives, bonds and low-vol stocks.',
  'Rotation': 'Money moving from one group of stocks to another, e.g. out of tech and into financials when yields rise.',
  'Cash-balanced': 'A basket where buy and sell notionals match, so the client does not need to add or raise cash.',
  'Opportunity cost': 'The cost of shares you did not trade when the price moved away. Part of implementation shortfall.',
  'Cents per share': 'High-touch commission is often quoted in cents per share (cps), e.g. 2-3 cps.'
};

// The playbook: how agency traders think. Rendered in the Playbook drawer.
DS.PLAYBOOK = [
  {
    t: '1. What the desk is paid to do',
    b: [
      'An agency desk works orders on the client\'s behalf. You do not take a view on the stock. You take a view on <b>how to trade it</b>: how fast, where, in what size, and what to tell the client.',
      'Every order is a trade-off between <b>market impact</b> (trading fast moves the price against you) and <b>timing risk</b> (trading slow leaves you exposed to drift). The client\'s benchmark and urgency tell you where to sit on that dial.',
      'Good agency traders are judged on three things: performance vs benchmark, following instructions exactly, and the quality of the information (color) they give back.'
    ]
  },
  {
    t: '2. Reading an order in ten seconds',
    b: [
      '<b>Side and size as % ADV.</b> 300k shares means nothing until you know the stock trades 3M a day (10% ADV, a full day) or 30M (1%, an hour).',
      '<b>Benchmark.</b> VWAP means trade with the curve. Arrival means the clock is running against you. Close means the auction is your friend.',
      '<b>Limit.</b> A hard wall. Never trade through it. If the stock runs through it, stop and tell the client.',
      '<b>Who is the client?</b> A long-only rebalancing is patient. An event-driven hedge fund wants it done before the news is priced in. Same order, different strategy.',
      '<b>What is going on in the name today?</b> Check the morning notes and the tape before you start. Earnings, rating changes and flow color change everything.'
    ]
  },
  {
    t: '3. Picking the strategy',
    b: [
      '<b>VWAP</b>: low-urgency orders benchmarked to VWAP. Keep participation under the client\'s cap.',
      '<b>Arrival / IS</b>: urgent or alpha-driven orders. Front-loaded. Accept impact to cut drift risk.',
      '<b>POV</b>: when you want to scale with liquidity, e.g. 10% on a news day when volume is 3x normal.',
      '<b>Dark</b>: alongside any of the above to capture the spread and find blocks without showing size.',
      '<b>MOC</b>: close benchmarks, or the last chunk of a large order. Enter before 15:50.',
      '<b>Blocks</b>: the best liquidity there is. A natural on the other side at a fair price beats hours of algo trading. Check price vs mid, size vs your remaining, and whether taking it breaks an instruction.'
    ]
  },
  {
    t: '4. Reading the tape and the book',
    b: [
      'Prints at the offer = buyers are aggressive. Prints at the bid = sellers are aggressive. The aggressor bar shows the running split.',
      'A <b>block print</b> far larger than the normal print size says an institution is active. Repeated prints at the same price that never clears suggests an <b>iceberg</b>.',
      'A stock that falls on heavy volume with prints mostly at the bid has a seller. If you are a buyer, let it come to you. If you are a seller, you have competition: consider dark and blocks before you join the queue.',
      'Spread widening and thin size in the book means liquidity has left. Slow down rather than paying up.'
    ]
  },
  {
    t: '5. Reading broker notes',
    b: [
      'A morning note has a predictable structure: overnight markets and futures, the economic calendar, research calls (upgrades, downgrades, initiations, price target changes), earnings, and the desk\'s flow color. Scan it for anything touching your orders first.',
      '<b>What moves stocks:</b> a Tier-1 broker changing a rating with a big PT change (2-5% move), the guide in earnings (more than the beat or miss), and read-across from peers and suppliers. Small PT tweaks with no rating change rarely matter.',
      '<b>Ask: is it already in the price?</b> If the stock is up 4% pre-market on an upgrade, the news is known. What matters now is whether volume confirms it or the gap fades.',
      '<b>Flow color</b> tells you who is on the other side: "long-onlys selling into strength" means a buyer may find natural liquidity.',
      'Translate every line into an action: does it change my urgency, my strategy, or what I tell the client?'
    ]
  },
  {
    t: '6. Giving color',
    b: [
      'Good color answers four questions in two or three lines: <b>what</b> (price and relative move), <b>why</b> (catalyst), <b>who</b> (flow: long-only, hedge fund, programs, retail) and <b>what we are doing / suggest</b>.',
      'Example: "NVLT +3.2%, semis +1.9%, so it is leading the group on the Halcyon upgrade. Volume 2.5x normal, mostly long-only buying, we have seen a few HF sellers into strength. You are 42% done vs 38% of the volume curve, average 151.12 vs VWAP 151.30. Happy to stay patient."',
      'Never leak other clients\' orders. Talk about flow in aggregate.'
    ]
  },
  {
    t: '7. Program trading',
    b: [
      'A program is a basket traded as one portfolio. Think in <b>dollars, beta and sectors</b>, not individual names.',
      '<b>Pre-trade:</b> gross and net notional, % ADV per name, spread and volatility, expected cost, and how the risk changes as you trade.',
      '<b>Tier</b> the list. Liquid names (<3% ADV) go on VWAP, mid names on capped VWAP or POV, illiquid names on POV with dark and maybe multi-day.',
      '<b>Stay balanced.</b> If buys finish faster than sells, you build net market exposure. Watch the dollar and beta imbalance and hedge it with futures when it grows.',
      '<b>Risk bids.</b> The quote is expected cost + a risk premium (a multiple of the basket\'s residual risk) + profit. Too low and you lose money, too high and you lose the trade.'
    ]
  },
  {
    t: '8. Sector trading',
    b: [
      'Always know where your names are vs the sector ETF and vs the SPX. Relative moves tell you whether it is stock news or sector tide.',
      'Read-across is the sector trader\'s edge: a supplier\'s guide, a peer\'s pre-announcement or a big customer\'s capex comment moves the whole group.',
      'Juggle multiple orders in the same sector by watching for crossing interest and avoiding competing with yourself.'
    ]
  },
  {
    t: '9. The close',
    b: [
      'The closing auction is the biggest single liquidity event of the day, typically ~10% of volume.',
      'MOC cutoff is 15:50. Imbalances publish from 15:50. A large buy imbalance means the close will print up; that is free liquidity for a seller and a warning for a buyer.',
      'Your own MOC adds to the imbalance. A huge MOC in a thin name moves the close against you.'
    ]
  },
  {
    t: '10. Classic mistakes',
    b: [
      'Chasing a gap on the open with market orders.',
      'Breaching the client\'s participation cap because you were behind schedule.',
      'Sitting on an order with nothing working while the stock moves away.',
      'Ignoring a block because it was a few cents away from the mid on a 30% ADV order.',
      'Letting a program drift unbalanced and carrying market risk the client never asked for.',
      'Telling a client what another client is doing.'
    ]
  }
];
