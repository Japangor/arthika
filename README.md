# Arthika — Stock Screener & AI Markets (Backend)

SEO-rich Node/Express backend + SPA for **Arthika**, an Indian-markets (NSE) stock
screener with AI insights. It proxies StockeZee's public market data with an
in-memory TTL cache and exposes a clean JSON API consumed by the Arthika Flutter
app and the web SPA. AI insights are generated via NVIDIA NIM.

> Not investment advice. Market data is provided for informational/educational
> purposes only.

## Stack
- Node.js + Express
- Axios upstream client with TTL cache (`stockData.js`)
- NVIDIA NIM (OpenAI-compatible) for AI insights
- Server-rendered SEO pages + JSON-LD (`seoPages.js`)
- Static SPA in `public/`
- Vercel serverless entry (`api/index.js` + `vercel.json`)

## Run locally
```bash
npm install
cp .env.example .env   # add your NVIDIA_API_KEY
npm start              # http://localhost:3010
```

## Deploy (Vercel)
1. Import this repo in Vercel.
2. Set env var `NVIDIA_API_KEY`.
3. Deploy — `vercel.json` routes `/api/*` and SEO pages to `api/index.js`.
4. Point a domain (e.g. `arthika.gjam.in`) and set it as the Flutter `API_BASE`.

## API overview
| Route | Description |
|---|---|
| `GET /api/health` | Service health |
| `GET /api/market/indices` | NSE index data |
| `GET /api/market/movers?type=gainers\|losers` | Real top gainers/losers |
| `GET /api/market/global` | Global indices / bonds |
| `GET /api/market/commodities` | Commodities & currencies |
| `GET /api/market/heatmap` | NSE heatmap (all durations) |
| `GET /api/stocks?filter=&cap=&limit=` | Screener over full NSE universe |
| `GET /api/search?q=` | Symbol/company search |
| `GET /api/recommend?pro=` | AI buy/sell recommendations (free-capped) |
| `GET /api/stock/:symbol` | Quote + valuation + signal |
| `GET /api/stock/:symbol/financials` | P&L, balance sheet, cash flow |
| `GET /api/stock/:symbol/technicals` | Indicators, MAs, history |
| `GET /api/stock/:symbol/shareholding` | Shareholding pattern |
| `GET /api/stock/:symbol/peers` | Peer companies (same cap) |
| `GET /api/stock/:symbol/corp-actions` | Corp actions + filings |
| `GET /api/ai/insight/:symbol?pro=` | NVIDIA NIM AI insight (free-truncated) |
| `GET /api/smart-money/insider` | NSE insider trades |
| `GET /api/smart-money/slb` / `slb-dates` | Securities lending & borrowing |
| `GET /api/smart-money/fii-dii?segment=` | FII/DII activity |
| `GET /api/derivatives/ban-list` | F&O ban list |
| `GET /api/derivatives/lot-size` | F&O lot sizes |
| `GET /api/calendar/results` | Upcoming results calendar |
| `GET /api/calendar/ipo` | IPO calendar |
| `GET /api/patterns/candlestick?period=day\|week` | Candlestick pattern scans |
| `GET /api/sectors` | Sector analysis |
| `GET /sitemap.xml`, `/robots.txt` | SEO |

## Filters for `/api/stocks`
`all` (default), `gainers`, `losers`, `value` (PE<20), `dividend`,
`volume`, `largecap`. Optional `cap=large|mid|small` and `sort=mcap`.

## Data source
Proxies `webapi.stockezee.com` and `api.stockezee.com`. The data layer is fully
contained in `stockData.js` so the provider can be swapped without touching routes.
