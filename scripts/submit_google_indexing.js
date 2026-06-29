/**
 * Submit priority arthika.rail24.in URLs to the Google Indexing API.
 *
 * Credentials (first match wins):
 *   GOOGLE_INDEXING_KEY_B64  — base64-encoded service-account JSON (set on Vercel)
 *   GOOGLE_INDEXING_KEY      — path to JSON file, or raw JSON string
 *   ~/.config/gcloud/gjam-gsc-mcp.json
 *   ./google-indexing-key.json in repo root (local dev only)
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

let _creds;

function resolveIndexingCredentials() {
  if (_creds !== undefined) return _creds;
  _creds = null;

  const b64 = process.env.GOOGLE_INDEXING_KEY_B64;
  if (b64) {
    try {
      _creds = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
      return _creds;
    } catch (e) {
      console.error('[indexing] GOOGLE_INDEXING_KEY_B64 decode failed:', e.message);
    }
  }

  const envKey = process.env.GOOGLE_INDEXING_KEY;
  if (envKey) {
    if (envKey.trim().startsWith('{')) {
      try {
        _creds = JSON.parse(envKey);
        return _creds;
      } catch (e) {
        console.error('[indexing] GOOGLE_INDEXING_KEY JSON parse failed:', e.message);
      }
    }
    if (fs.existsSync(envKey)) {
      try {
        _creds = JSON.parse(fs.readFileSync(envKey, 'utf8'));
        return _creds;
      } catch (e) {
        console.error('[indexing] read GOOGLE_INDEXING_KEY file failed:', e.message);
      }
    }
  }

  const candidates = [
    path.join(process.env.HOME || '', '.config/gcloud/gjam-gsc-mcp.json'),
    path.join(__dirname, '..', 'google-indexing-key.json'),
    path.join(__dirname, '../../../railwayengine/google-indexing-key.json'),
  ];
  for (const p of candidates) {
    try {
      if (p && fs.existsSync(p)) {
        _creds = JSON.parse(fs.readFileSync(p, 'utf8'));
        break;
      }
    } catch (e) {
      console.error('[indexing] read key failed:', p, e.message);
    }
  }
  return _creds;
}

function makeJwt(sa) {
  return new google.auth.JWT({
    email: sa.client_email,
    key: sa.private_key,
    scopes: ['https://www.googleapis.com/auth/indexing'],
  });
}

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
  const sa = resolveIndexingCredentials();
  if (!sa?.client_email || !sa?.private_key) {
    return {
      ok: false,
      skipped: true,
      reason: 'no indexing credentials (set GOOGLE_INDEXING_KEY_B64 on Vercel)',
    };
  }

  const list = Array.isArray(urls) && urls.length ? urls.map(abs).slice(0, CAP) : await buildList([]);
  const jwt = makeJwt(sa);
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

module.exports = { submitGoogleIndexing, buildList, PRIORITY, resolveIndexingCredentials };
