# Agency Desk Simulator

A browser-based training simulator for a cash-equities agency trading desk. You take a seat as a
**high-touch trader**, **program trader** or **sector trader**, work client orders through a simulated
trading day, and get scored and coached on every decision.

The goal is to learn how traders think: reading broker notes and the tape, choosing strategies for a
benchmark, sourcing liquidity, giving clients useful color, and managing risk.

## Run it

No build step and no dependencies. Open `index.html` in a browser, or serve the folder:

```bash
npx http-server trading-desk-sim
```

## How a day runs

1. **Morning meeting (08:45).** Read the broker note: overnight markets and futures, the 8:30 macro
   print, research calls, earnings and desk flow color. Call the expected impact of each research and
   earnings item, then **Decode** it to see how a trader reads it.
2. **The bell (9:30).** Client orders arrive in the blotter and the chat. Pick strategies in the
   ticket (VWAP, TWAP, POV, Arrival/IS, dark aggregator, MOC, limit, market) with caps, end times and
   limits. Decision points pause the sim and ask what you would do; your choice is applied.
3. **Through the day.** Sales traders offer blocks, squawk headlines hit your names, clients ask for
   color and upsize, and the coach flags cap breaches, idle orders, schedule drift, wide spreads and
   one-sided tape. Market-read quizzes ask you to name the regime (risk-on, rotation, risk-off...).
4. **The close.** MOC cutoff at 15:50, imbalance publication, then the closing auction.
5. **Scorecard.** TCA per order (vs arrival, interval VWAP and close), participation vs cap, breaches,
   decision and color scores, client relationship, and a review of the calls you missed.

## Roles

| Role | What you practice |
| --- | --- |
| High-touch agency trader | Gap days on upgrades, urgent hedge-fund sells, a 30% ADV pension order with a natural seller in the market, client upsizes, close-benchmark orders and imbalances |
| Program trader | Pre-trade analytics, tiering by % ADV, pricing a principal risk bid, keeping buys and sells balanced, hedging beta with ES futures, handling the illiquid tail at the close |
| Sector trader (Tech) | Earnings read-across, pre-announcements, sector color, two clients on opposite sides of the same stock (agency cross) |

Each trading day number is a different, reproducible market. Replay a day to try another approach.

## Learning tools

- **Decode** on every note and headline: what it says, why it matters, what to expect, and what it
  means if you are buying or selling, plus a live check against what the stock is doing.
- **Coach** tab: real-time observations a senior trader would make.
- **Playbook**: how agency traders think, from reading an order to the close.
- **Glossary**: 60+ desk terms; hover any dotted term in the app.

## Market model

- 31 fictional stocks across 9 sectors with realistic ADV, volatility, beta and spreads.
- Prices follow a factor model (market + sector + rates sensitivity + idiosyncratic) with an intraday
  volatility smile, U-shaped volume curve, opening/closing auctions and scripted news shocks.
- Your trading has market impact following the square-root law, split into transient and permanent
  parts, so aggressive execution visibly moves the price against you.
- Algos follow their real logic (volume curve, participation, front-loading), respect participation
  caps and limits, and dark fills arrive at the mid with occasional blocks.

All companies, brokers, clients and prices are fictional and simulated. This is a training tool, not
market data or investment advice.

## Files

```
index.html        page shell
styles.css        layout and theme (dark-first, light supported)
js/util.js        RNG, formatting, glossary linking
js/data.js        universe, brokers, clients, roles, glossary, playbook
js/market.js      price/volume/spread engine, tape, events, closing auction
js/orders.js      client orders, algo execution, blocks, futures
js/notes.js       broker notes, macro, flow color, squawk + decoders
js/scenarios.js   role scripts: orders, chats, decision points
js/pt.js          program trading analytics, risk bid, balancing
js/coach.js       coach rules
js/tca.js         transaction cost analysis and scoring
js/desk.js        chat, decisions, tips, scoring plumbing
js/ui.js          rendering and interaction
js/app.js         clock, game loop, day setup
```
