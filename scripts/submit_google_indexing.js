/**
 * Submit priority arthika.rail24.in URLs to the Google Indexing API.
 *
 * Usage:
 *   node scripts/submit_google_indexing.js
 *   node scripts/submit_google_indexing.js /ai-stock-screener /news
 */
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const HOST = (process.env.SITE_URL || 'https://arthika.rail24.in').replace(/\/$/, '');
const CAP = Number(process.env.GOOGLE_INDEXING_CAP || 180);
const RAIL24_SA = path.join(process.env.HOME || '', '.config/gcloud/gjam-gsc-mcp.json');
const REPO_KEY = path.join(__dirname, '../../../railwayengine/google-indexing-key.json');
const KEY = process.env.GOOGLE_INDEXING_KEY || (fs.existsSync(RAIL24_SA) ? RAIL24_SA : REPO_KEY);

const PRIORITY = [
  '/',
  '/ai-stock-screener',
  '/ai-screener',
  '/stock-screener',
  '/free-stock-screener',
  '/nse-stock-screener',
  '/screeners',
  '/news',
  '/global-markets',
  '/commodity-prices',
  '/top-gainers',
  '/top-losers',
  '/intraday-trades',
  '/ipo',
  '/results-calendar',
  '/fno-ban-list',
  '/stocks',
  '/discover',
  '/discover/ipo',
  '/discover/global',
  '/discover/commodities',
  '/discover/candlestick',
  '/discover/insider',
  '/app',
  '/sectors',
  '/high-dividend-stocks',
  '/value-stocks',
  '/large-cap-stocks',
  '/index/nifty-50',
  '/index/nifty-bank',
  '/stocks/sector/it',
  '/stocks/sector/bank',
  '/stocks/sector/pharma',
];

const abs = (p) => (p.startsWith('http') ? p : `${HOST}${p === '/' ? '/' : p}`);

async function hotStockPaths(limit = 60) {
  try {
    const stock = require('../stockData');
    const { gainers, losers } = await stock.getTopGainerLoser();
    const movers = [...(gainers || []), ...(losers || [])]
      .map((s) => `/stocks/${String(s.symbol || '').toLowerCase()}`);
    const large = await stock.getScreenerList({ filter: 'largecap', limit: 30 }).catch(() => []);
    const stocks = (large || []).map((s) => `/stocks/${String(s.symbol || '').toLowerCase()}`);
    return [...new Set([...movers, ...stocks])].slice(0, limit);
  } catch {
    return [];
  }
}

async function buildList(explicit) {
  if (explicit.length) return [...new Set(explicit.map(abs))].slice(0, CAP);
  const hot = await hotStockPaths();
  return [...new Set([...PRIORITY, ...hot])].map(abs).slice(0, CAP);
}

async function submitGoogleIndexing(urls) {
  if (!fs.existsSync(KEY)) {
    return { ok: false, skipped: true, reason: `key not found at ${KEY}` };
  }
  const list = Array.isArray(urls) && urls.length ? urls.map(abs).slice(0, CAP) : await buildList([]);
  const jwt = new google.auth.JWT({ keyFile: KEY, scopes: ['https://www.googleapis.com/auth/indexing'] });
  await jwt.authorize();

  let ok = 0;
  let fail = 0;
  let quota = false;
  const errors = [];

  for (const url of list) {
    try {
      await jwt.request({
        url: 'https://indexing.googleapis.com/v3/urlNotifications:publish',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, type: 'URL_UPDATED' }),
      });
      ok++;
    } catch (e) {
      fail++;
      if (/Quota exceeded/i.test(e.message)) {
        quota = true;
        break;
      }
      errors.push({ url, error: e.message });
    }
    await new Promise((r) => setTimeout(r, 120));
  }

  return { ok: ok > 0 || fail === 0, submitted: ok, failed: fail, quota, total: list.length, errors: errors.slice(0, 5) };
}

async function main() {
  const result = await submitGoogleIndexing(process.argv.slice(2));
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok && !result.skipped) process.exit(1);
}

if (require.main === module) main().catch((e) => { console.error(e); process.exit(1); });

module.exports = { submitGoogleIndexing, buildList, PRIORITY };
