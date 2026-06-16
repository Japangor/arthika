/**
 * Arthika — Stock Screener & AI Markets API + SEO web app.
 * Mirrors cricAi/server.js pattern (Express, Vercel serverless gate).
 */
const express = require('express');
const cors = require('cors');
const path = require('path');
const OpenAI = require('openai');
require('dotenv').config();

const stock = require('./stockData');
const { registerSEOPages, robotsTxt, buildSitemap } = require('./seoPages');

const app = express();
const PORT = process.env.PORT || 3010;
const IS_SERVERLESS = !!process.env.VERCEL;

const nvidiaClient = process.env.NVIDIA_API_KEY
  ? new OpenAI({
      apiKey: process.env.NVIDIA_API_KEY,
      baseURL: 'https://integrate.api.nvidia.com/v1',
    })
  : null;

app.use(cors());
app.use(express.json());

// SEO routes before static
registerSEOPages(app);

app.use(express.static(path.join(__dirname, 'public')));

// --- Health ---
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'arthika', ts: Date.now() });
});

// --- Market ---
app.get('/api/market/indices', async (_req, res) => {
  try {
    const data = await stock.getIndices();
    res.json({ status: 1, data });
  } catch (e) {
    res.status(500).json({ status: 0, error: e.message });
  }
});

app.get('/api/market/movers', async (req, res) => {
  try {
    const type = req.query.type || 'gainers';
    const { gainers, losers } = await stock.getTopGainerLoser();
    const data = type === 'losers' ? losers : gainers;
    res.json({ status: 1, data: data.slice(0, 30), type });
  } catch (e) {
    res.status(500).json({ status: 0, error: e.message });
  }
});

app.get('/api/market/global', async (_req, res) => {
  try {
    const data = await stock.getGlobalMarket();
    res.json({ status: 1, data });
  } catch (e) {
    res.status(500).json({ status: 0, error: e.message });
  }
});

app.get('/api/market/commodities', async (_req, res) => {
  try {
    const data = await stock.getCommodities();
    res.json({ status: 1, data });
  } catch (e) {
    res.status(500).json({ status: 0, error: e.message });
  }
});

app.get('/api/market/heatmap', async (_req, res) => {
  try {
    const data = await stock.getHeatmap();
    res.json({ status: 1, data });
  } catch (e) {
    res.status(500).json({ status: 0, error: e.message });
  }
});

// --- Smart money ---
app.get('/api/smart-money/insider', async (_req, res) => {
  try {
    const data = await stock.getInsiderTrades();
    res.json({ status: 1, data: data.data, date: data.date });
  } catch (e) {
    res.status(500).json({ status: 0, error: e.message });
  }
});

app.get('/api/smart-money/slb', async (req, res) => {
  try {
    const data = await stock.getSlbData(req.query.date);
    res.json({ status: 1, data });
  } catch (e) {
    res.status(500).json({ status: 0, error: e.message });
  }
});

app.get('/api/smart-money/slb-dates', async (_req, res) => {
  try {
    const data = await stock.getSlbDates();
    res.json({ status: 1, data });
  } catch (e) {
    res.status(500).json({ status: 0, error: e.message });
  }
});

app.get('/api/smart-money/fii-dii', async (req, res) => {
  try {
    const data = await stock.getFiiDii(req.query.segment || 'index');
    res.json({ status: 1, data });
  } catch (e) {
    res.status(500).json({ status: 0, error: e.message });
  }
});

// --- Derivatives & calendars ---
app.get('/api/derivatives/ban-list', async (_req, res) => {
  try {
    const data = await stock.getBanList();
    res.json({ status: 1, data });
  } catch (e) {
    res.status(500).json({ status: 0, error: e.message });
  }
});

app.get('/api/derivatives/lot-size', async (_req, res) => {
  try {
    const data = await stock.getFnoLotSize();
    res.json({ status: 1, data });
  } catch (e) {
    res.status(500).json({ status: 0, error: e.message });
  }
});

app.get('/api/calendar/results', async (_req, res) => {
  try {
    const data = await stock.getResultsCalendar();
    res.json({ status: 1, data });
  } catch (e) {
    res.status(500).json({ status: 0, error: e.message });
  }
});

app.get('/api/calendar/ipo', async (_req, res) => {
  try {
    const data = await stock.getIpoCalendar();
    res.json({ status: 1, data });
  } catch (e) {
    res.status(500).json({ status: 0, error: e.message });
  }
});

// --- Patterns & sector ---
app.get('/api/patterns/candlestick', async (req, res) => {
  try {
    const period = req.query.period === 'week' ? 'week' : 'day';
    const data = await stock.getCandlestickPatterns(period);
    res.json({ status: 1, data, period });
  } catch (e) {
    res.status(500).json({ status: 0, error: e.message });
  }
});

app.get('/api/sectors', async (_req, res) => {
  try {
    const data = await stock.getSectorAnalysis();
    res.json({ status: 1, data });
  } catch (e) {
    res.status(500).json({ status: 0, error: e.message });
  }
});

// --- Search ---
app.get('/api/search', async (req, res) => {
  try {
    const data = await stock.searchStocks(req.query.q || '', 25);
    res.json({ status: 1, data });
  } catch (e) {
    res.status(500).json({ status: 0, error: e.message });
  }
});

// --- Recommendations (free cap) ---
app.get('/api/recommend', async (req, res) => {
  try {
    const pro = req.query.pro === '1' || req.query.pro === 'true';
    const raw = await stock.getRecommendations();
    const cap = pro ? 999 : 5;
    res.json({
      status: 1,
      data: {
        buy: (raw.buy || []).slice(0, cap),
        sell: (raw.sell || []).slice(0, cap),
      },
      pro,
    });
  } catch (e) {
    res.status(500).json({ status: 0, error: e.message });
  }
});

// --- Screener ---
app.get('/api/stocks', async (req, res) => {
  try {
    const filter = req.query.filter || 'all';
    const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);
    const data = await stock.getScreenerList({
      filter,
      limit,
      cap: req.query.cap,
      sort: req.query.sort,
    });
    res.json({ status: 1, count: data.length, data });
  } catch (e) {
    res.status(500).json({ status: 0, error: e.message });
  }
});

// --- Stock detail ---
app.get('/api/stock/:symbol', async (req, res) => {
  try {
    const data = await stock.getStockOverview(req.params.symbol);
    res.json({ status: 1, data });
  } catch (e) {
    res.status(500).json({ status: 0, error: e.message });
  }
});

app.get('/api/stock/:symbol/financials', async (req, res) => {
  try {
    const s = req.params.symbol;
    const [pl, bs, cf] = await Promise.all([
      stock.getProfitLoss(s),
      stock.getBalanceSheet(s),
      stock.getCashFlow(s),
    ]);
    res.json({ status: 1, data: { profitLoss: pl, balanceSheet: bs, cashFlow: cf } });
  } catch (e) {
    res.status(500).json({ status: 0, error: e.message });
  }
});

app.get('/api/stock/:symbol/technicals', async (req, res) => {
  try {
    const s = req.params.symbol;
    const [indicators, ma] = await Promise.all([
      stock.getTechnicalIndicators(s).catch(() => ({})),
      stock.getMovingAverages(s).catch(() => ({})),
    ]);
    res.json({ status: 1, data: { indicators, movingAverages: ma } });
  } catch (e) {
    res.status(500).json({ status: 0, error: e.message });
  }
});

app.get('/api/stock/:symbol/returns', async (req, res) => {
  try {
    const data = await stock.getReturns(req.params.symbol);
    res.json({ status: 1, data });
  } catch (e) {
    res.status(500).json({ status: 0, error: e.message });
  }
});

app.get('/api/stock/:symbol/shareholding', async (req, res) => {
  try {
    const data = await stock.getShareholdingPattern(req.params.symbol);
    res.json({ status: 1, data });
  } catch (e) {
    res.status(500).json({ status: 0, error: e.message });
  }
});

app.get('/api/stock/:symbol/peers', async (req, res) => {
  try {
    const data = await stock.getPeers(req.params.symbol);
    res.json({ status: 1, data });
  } catch (e) {
    res.status(500).json({ status: 0, error: e.message });
  }
});

app.get('/api/stock/:symbol/corp-actions', async (req, res) => {
  try {
    const [actions, filings] = await Promise.all([
      stock.getCorpActions(req.params.symbol),
      stock.getCorpAnnouncements(req.params.symbol),
    ]);
    res.json({ status: 1, data: { actions, filings } });
  } catch (e) {
    res.status(500).json({ status: 0, error: e.message });
  }
});

// --- AI insight (NVIDIA NIM) ---
const aiCache = new Map();

app.get('/api/ai/insight/:symbol', async (req, res) => {
  const s = stock.sym(req.params.symbol);
  const pro = req.query.pro === '1' || req.query.pro === 'true';
  const cacheKey = `${s}:${new Date().toISOString().slice(0, 10)}`;

  try {
  if (aiCache.has(cacheKey)) {
    const full = aiCache.get(cacheKey);
    return res.json({
      status: 1,
      data: {
        symbol: s,
        insight: pro ? full : full.slice(0, 420) + (full.length > 420 ? '…' : ''),
        truncated: !pro,
      },
    });
  }

  const overview = await stock.getStockOverview(s);
  const prompt = `You are a concise Indian equity analyst. Summarize ${overview.company_name} (${s}) for retail investors in 3 short paragraphs: valuation vs sector, key risks, and what to watch next quarter. Use the data: LTP ${overview.quote?.ltp}, change ${overview.quote?.change_percent}%, recommendation ${overview.recommendation}. Not investment advice.`;

  let insight = `**${overview.company_name} (${s})** — Trading at ₹${overview.quote?.ltp ?? '—'} (${overview.quote?.change_percent ?? 0}%). Signal: ${overview.recommendation}. Review fundamentals, debt, and sector trends before investing. This is not investment advice.`;

  if (nvidiaClient) {
    try {
      const completion = await nvidiaClient.chat.completions.create({
        model: 'meta/llama-3.3-70b-instruct',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 500,
        temperature: 0.4,
      });
      insight = completion.choices?.[0]?.message?.content?.trim() || insight;
    } catch (aiErr) {
      console.warn('[AI]', aiErr.message);
    }
  }

  aiCache.set(cacheKey, insight);

  res.json({
    status: 1,
    data: {
      symbol: s,
      insight: pro ? insight : insight.slice(0, 420) + (insight.length > 420 ? '…' : ''),
      truncated: !pro,
    },
  });
  } catch (e) {
    res.status(500).json({ status: 0, error: e.message });
  }
});

// --- Sitemap & robots ---
app.get('/sitemap.xml', async (req, res) => {
  try {
    const xml = await buildSitemap(req);
    res.type('application/xml').send(xml);
  } catch (e) {
    res.status(500).send('<!-- sitemap error -->');
  }
});

app.get('/robots.txt', (req, res) => {
  res.type('text/plain').send(robotsTxt(req));
});

// SPA fallback
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

if (!IS_SERVERLESS) {
  app.listen(PORT, () => {
    console.log(`Arthika running http://localhost:${PORT}`);
  });
}

module.exports = app;
