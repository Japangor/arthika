/**
 * Upstream stock data client — proxies StockeZee's two API hosts with TTL cache.
 * Swap this module to change data providers without touching routes.
 *
 *  - webapi.stockezee.com  → { status, message, data }       (WEBAPI)
 *  - api.stockezee.com     → { result, resultMessage, resultData } (RESAPI)
 */
const axios = require('axios');

const WEBAPI = 'https://webapi.stockezee.com';
const RESAPI = 'https://api.stockezee.com';
const ORIGIN = 'https://www.stockezee.com';
const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
  Origin: ORIGIN,
  Referer: ORIGIN + '/',
  Accept: 'application/json',
};

const cache = new Map();

async function cached(key, ttlMs, loader) {
  const hit = cache.get(key);
  const now = Date.now();
  if (hit && now - hit.t < ttlMs) return hit.v;
  try {
    const v = await loader();
    cache.set(key, { t: now, v });
    return v;
  } catch (e) {
    if (hit) return hit.v;
    throw e;
  }
}

function qstr(params) {
  return params ? '?' + new URLSearchParams(params).toString() : '';
}

async function webGet(path, { ttl = 60000, params } = {}) {
  const url = `${WEBAPI}${path}${qstr(params)}`;
  return cached(`GET:${url}`, ttl, async () => {
    const r = await axios.get(url, { headers: HEADERS, timeout: 15000 });
    return r.data;
  });
}

async function resGet(path, { ttl = 60000, params } = {}) {
  const url = `${RESAPI}${path}${qstr(params)}`;
  return cached(`GET:${url}`, ttl, async () => {
    const r = await axios.get(url, { headers: HEADERS, timeout: 15000 });
    return r.data;
  });
}

/** Unwrap either API envelope to its payload array/object. */
function unwrapWeb(raw, fallback) {
  if (raw && raw.data !== undefined) return raw.data;
  return raw ?? fallback;
}
function unwrapRes(raw, fallback) {
  if (raw && raw.resultData !== undefined) return raw.resultData;
  if (raw && raw.data !== undefined) return raw.data;
  return raw ?? fallback;
}

function sym(s) {
  return String(s || '').trim().toUpperCase();
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Normalize a StockeZee row (either host) into a uniform stock item. */
function normStock(row, extra = {}) {
  const s = sym(row.symbol_name || row.symbol || row.Symbol);
  return {
    symbol: s,
    company_name: row.company_name || row.long_name || row.CompanyName || s,
    ltp: num(row.last_trade_price ?? row.close ?? row.ltp),
    change: num(row.change),
    change_percent: num(row.change_percent ?? row.changePercent),
    open: num(row.open),
    high: num(row.high),
    low: num(row.low),
    close: num(row.close),
    volume: num(row.volume),
    market_cap: row.market_cap != null ? num(row.market_cap) : undefined,
    pe: row.stock_p_e != null ? num(row.stock_p_e) : row.pe != null ? num(row.pe) : undefined,
    dividend_yield: row.dividend_yield_per != null ? num(row.dividend_yield_per) : undefined,
    cap_category: row.cap_category,
    high52: row.high52 != null ? num(row.high52) : undefined,
    low52: row.low52 != null ? num(row.low52) : undefined,
    ...extra,
  };
}

// --- Markets ---

async function getIndices() {
  const raw = await webGet('/api/symbol/stock-index-data', {
    ttl: 15000,
    params: { symbol: 'NIFTY' },
  });
  const list = unwrapWeb(raw, []);
  return Array.isArray(list) ? list : [];
}

/** Real NSE top gainers + losers (single feed, split by sign). */
async function getTopGainerLoser() {
  const raw = await webGet('/api/symbol/top-gainer-loser', { ttl: 30000 });
  const list = (unwrapWeb(raw, []) || []).map((r) => normStock(r));
  const gainers = list
    .filter((x) => x.change_percent > 0)
    .sort((a, b) => b.change_percent - a.change_percent);
  const losers = list
    .filter((x) => x.change_percent < 0)
    .sort((a, b) => a.change_percent - b.change_percent);
  return { gainers, losers, all: list };
}

/** Global indices / bonds (api.stockezee.com). */
async function getGlobalMarket() {
  const raw = await resGet('/api/v1/Resource/global-market', { ttl: 120000 });
  return unwrapRes(raw, []) || [];
}

/** Commodities + currencies (webapi). */
async function getCommodities() {
  const raw = await webGet('/api/global-market/commodities-currencies-data', {
    ttl: 120000,
  });
  return unwrapWeb(raw, { commodities: [], currencies: [] }) || {};
}

/** NSE sector/stock heatmap across durations. */
async function getHeatmap() {
  const raw = await webGet('/api/nse-heatmap/get-all-duration', { ttl: 120000 });
  return unwrapWeb(raw, {}) || {};
}

// --- Smart money ---

async function getInsiderTrades() {
  const raw = await webGet('/api/nse-insider-corporate/current-date', { ttl: 600000 });
  return { date: raw?.message, data: unwrapWeb(raw, []) || [] };
}

async function getSlbDates() {
  const raw = await webGet('/api/nse-slbs/all-dates', { ttl: 3600000 });
  return unwrapWeb(raw, []) || [];
}

async function getSlbData(date) {
  const raw = await webGet('/api/nse-slbs/specific-date-data', {
    ttl: 600000,
    params: date ? { date } : undefined,
  });
  return unwrapWeb(raw, []) || [];
}

async function getFiiDii(segment = 'index') {
  const raw = await resGet('/api/v1/Resource/fii-dii-data', {
    ttl: 600000,
    params: { segment },
  });
  return unwrapRes(raw, []) || [];
}

// --- Derivatives & calendars ---

async function getBanList() {
  const raw = await resGet('/api/v1/Resource/ban-list', { ttl: 600000 });
  return unwrapRes(raw, {}) || {};
}

async function getFnoLotSize() {
  const raw = await resGet('/api/v1/Resource/fno-lot-size', { ttl: 21600000 });
  const rd = unwrapRes(raw, []);
  // resultData is { data: [...] }
  if (rd && Array.isArray(rd.data)) return rd.data;
  return Array.isArray(rd) ? rd : [];
}

async function getResultsCalendar() {
  const raw = await resGet('/api/v1/Resource/forth-comming-result', { ttl: 3600000 });
  return unwrapRes(raw, []) || [];
}

async function getIpoCalendar() {
  const raw = await resGet('/api/v1/Resource/ipo-calendar', { ttl: 3600000 });
  return unwrapRes(raw, []) || [];
}

// --- Patterns / screeners ---

async function getCandlestickPatterns(period = 'day') {
  const path =
    period === 'week'
      ? '/api/nse-candle-sticks/per-week-patterns'
      : '/api/nse-candle-sticks/per-day-patterns';
  const raw = await webGet(path, { ttl: 600000 });
  const data = unwrapWeb(raw, {}) || {};
  // data is an object keyed by pattern name (+ "available_pattens"); flatten
  // every pattern array into a single list of tagged stock rows.
  if (Array.isArray(data)) return data;
  const out = [];
  for (const [key, val] of Object.entries(data)) {
    if (key === 'available_pattens' || !Array.isArray(val)) continue;
    for (const row of val) {
      out.push({
        symbol: sym(row.symbol_name || row.symbol),
        symbol_name: row.symbol_name,
        pattern: row.pattern_type || key,
        sentiment: row.pattern_sentiment || '',
        date: row.candle_date || row.date,
        open: num(row.o ?? row.open),
        high: num(row.h ?? row.high),
        low: num(row.l ?? row.low),
        close: num(row.c ?? row.close),
        change_percent: num(row.change_percent),
      });
    }
  }
  return out;
}

// --- Recommendations ---

async function getRecommendations() {
  const raw = await webGet('/api/stocks/recommend/long-term', { ttl: 300000 });
  return unwrapWeb(raw, { buy: [], sell: [] }) || { buy: [], sell: [] };
}

// --- Per-stock detail ---

async function getTechnicalIndicators(symbol) {
  const raw = await webGet('/api/stock/technical-indicators', {
    ttl: 60000,
    params: { symbol: sym(symbol) },
  });
  return unwrapWeb(raw, {}) || {};
}

async function getMovingAverages(symbol) {
  const raw = await webGet('/api/symbol/moving-averages', {
    ttl: 60000,
    params: { symbol: sym(symbol) },
  });
  return unwrapWeb(raw, {}) || {};
}

async function getProfitLoss(symbol, period = 'annual', type = 'consolidated') {
  const raw = await resGet(
    `/api/Analysis/profit-loss/${sym(symbol)}/${period}/${type}`,
    { ttl: 21600000 }
  );
  return unwrapRes(raw, []) || [];
}

async function getBalanceSheet(symbol, period = 'annual', type = 'consolidated') {
  const raw = await resGet(
    `/api/Analysis/balance-sheet/${sym(symbol)}/${period}/${type}`,
    { ttl: 21600000 }
  );
  return unwrapRes(raw, []) || [];
}

async function getCashFlow(symbol, period = 'annual', type = 'consolidated') {
  const raw = await resGet(
    `/api/Analysis/cash-flow/${sym(symbol)}/${period}/${type}`,
    { ttl: 21600000 }
  );
  return unwrapRes(raw, []) || [];
}

async function getShareholdingPattern(symbol) {
  const raw = await resGet(
    `/api/Analysis/shareholding-pattern/${sym(symbol)}/quarterly`,
    { ttl: 3600000 }
  );
  return unwrapRes(raw, {}) || {};
}

async function getCorpActions(symbol) {
  const raw = await resGet(`/api/Analysis/corp-action/${sym(symbol)}`, {
    ttl: 3600000,
  });
  return unwrapRes(raw, {}) || {};
}

async function getCorpAnnouncements(symbol) {
  const raw = await resGet(`/api/Analysis/corp-annoucements/${sym(symbol)}`, {
    ttl: 600000,
  });
  const d = unwrapRes(raw, {}) || {};
  return d.corp_announcements || d || [];
}

async function getReturns(symbol) {
  const raw = await resGet(`/api/Analysis/historical-chart/${sym(symbol)}`, {
    ttl: 300000,
  });
  const d = unwrapRes(raw, {}) || {};
  return {
    stock_return: d.stock_return || {},
    historical_data: d.historical_data || [],
  };
}

async function getValuationScore() {
  const raw = await webGet('/api/stock/score/by-valuation', { ttl: 300000 });
  return unwrapWeb(raw, []) || [];
}

async function getSectorAnalysis() {
  const raw = await webGet('/api/Analysis/sector-analysis', { ttl: 600000 });
  return unwrapWeb(raw, []) || [];
}

/** Full NSE stock universe (cached long) used to power the screener. */
async function getStockUniverse() {
  const raw = await webGet('/api/symbol/stock-list', { ttl: 120000 });
  const list = unwrapWeb(raw, []) || [];
  return list.map((r) => normStock(r));
}

/**
 * Screener now backed by the real ~2000 stock universe with rich filters.
 * Falls back to recommendations if the universe is unavailable.
 */
async function getScreenerList({ filter = 'all', limit = 200, sort, cap } = {}) {
  let list = [];
  try {
    list = await getStockUniverse();
  } catch (_) {
    /* fall through to recs */
  }

  if (!list.length) {
    const recs = await getRecommendations();
    const seen = new Map();
    [...(recs.buy || []), ...(recs.sell || [])].forEach((r) => {
      const n = normStock(r);
      if (n.symbol && !seen.has(n.symbol)) seen.set(n.symbol, n);
    });
    list = [...seen.values()];
  }

  if (cap) {
    const c = String(cap).toLowerCase();
    list = list.filter((x) => (x.cap_category || '').toLowerCase().includes(c));
  }

  switch (filter) {
    case 'gainers':
      list = list
        .filter((x) => x.change_percent > 0)
        .sort((a, b) => b.change_percent - a.change_percent);
      break;
    case 'losers':
      list = list
        .filter((x) => x.change_percent < 0)
        .sort((a, b) => a.change_percent - b.change_percent);
      break;
    case 'value':
      list = list
        .filter((x) => x.pe && x.pe > 0 && x.pe < 20)
        .sort((a, b) => (a.pe || 1e9) - (b.pe || 1e9));
      break;
    case 'dividend':
      list = list
        .filter((x) => x.dividend_yield && x.dividend_yield > 0)
        .sort((a, b) => (b.dividend_yield || 0) - (a.dividend_yield || 0));
      break;
    case 'volume':
      list = list.sort((a, b) => b.volume - a.volume);
      break;
    case 'largecap':
      list = list
        .filter((x) => (x.cap_category || '').toLowerCase().includes('large'))
        .sort((a, b) => (b.market_cap || 0) - (a.market_cap || 0));
      break;
    default:
      if (sort === 'mcap') list = list.sort((a, b) => (b.market_cap || 0) - (a.market_cap || 0));
  }

  return list.slice(0, limit);
}

async function searchStocks(q, limit = 25) {
  const query = sym(q);
  if (!query) return [];
  const list = await getStockUniverse().catch(() => []);
  return list
    .filter(
      (x) =>
        x.symbol.includes(query) ||
        (x.company_name || '').toUpperCase().includes(query)
    )
    .slice(0, limit);
}

async function getStockOverview(symbol) {
  const s = sym(symbol);
  const [universe, recs, technicals] = await Promise.all([
    getStockUniverse().catch(() => []),
    getRecommendations().catch(() => ({ buy: [], sell: [] })),
    getTechnicalIndicators(s).catch(() => ({})),
  ]);

  const fromUniverse = universe.find((r) => r.symbol === s);
  const all = [...(recs.buy || []), ...(recs.sell || [])];
  const fromRec = all.find((r) => sym(r.symbol_name) === s);
  const base = fromUniverse || (fromRec ? normStock(fromRec) : { symbol: s, company_name: s });

  return {
    symbol: s,
    company_name: base.company_name || s,
    quote: {
      ltp: base.ltp,
      open: base.open,
      high: base.high,
      low: base.low,
      close: base.close,
      change: base.change,
      change_percent: base.change_percent,
      volume: base.volume,
      market_cap: base.market_cap,
      pe: base.pe,
      dividend_yield: base.dividend_yield,
      cap_category: base.cap_category,
      high52: base.high52,
      low52: base.low52,
    },
    technicals,
    recommendation: (recs.buy || []).some((r) => sym(r.symbol_name) === s)
      ? 'buy'
      : (recs.sell || []).some((r) => sym(r.symbol_name) === s)
        ? 'sell'
        : 'hold',
  };
}

async function getPeers(symbol) {
  const s = sym(symbol);
  const universe = await getStockUniverse().catch(() => []);
  const self = universe.find((x) => x.symbol === s);
  if (!self || !self.cap_category) {
    return universe.filter((x) => x.symbol !== s).slice(0, 8);
  }
  return universe
    .filter((x) => x.symbol !== s && x.cap_category === self.cap_category)
    .sort(
      (a, b) =>
        Math.abs((a.market_cap || 0) - (self.market_cap || 0)) -
        Math.abs((b.market_cap || 0) - (self.market_cap || 0))
    )
    .slice(0, 8);
}

module.exports = {
  // markets
  getIndices,
  getTopGainerLoser,
  getGlobalMarket,
  getCommodities,
  getHeatmap,
  // smart money
  getInsiderTrades,
  getSlbDates,
  getSlbData,
  getFiiDii,
  // derivatives & calendars
  getBanList,
  getFnoLotSize,
  getResultsCalendar,
  getIpoCalendar,
  // patterns / recs
  getCandlestickPatterns,
  getRecommendations,
  getValuationScore,
  getSectorAnalysis,
  // screener / search
  getStockUniverse,
  getScreenerList,
  searchStocks,
  // per stock
  getTechnicalIndicators,
  getMovingAverages,
  getProfitLoss,
  getBalanceSheet,
  getCashFlow,
  getShareholdingPattern,
  getCorpActions,
  getCorpAnnouncements,
  getReturns,
  getStockOverview,
  getPeers,
  sym,
};
