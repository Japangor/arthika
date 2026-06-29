/**
 * IndexNow + sitemap ping for arthika.rail24.in
 * Uses a static hub list so cron does not need live stock API.
 */
const SITE_URL = (process.env.SITE_URL || 'https://arthika.rail24.in').replace(/\/$/, '');
const INDEXNOW_KEY = process.env.ARTHIKA_INDEXNOW_KEY || 'b2c3d4e5f60718293a4b5c6d7e8f90a1';
const HOST = SITE_URL.replace(/^https?:\/\//, '');

const HUB_PATHS = [
  '/',
  '/app',
  '/ai-stock-screener',
  '/ai-screener',
  '/stock-screener',
  '/free-stock-screener',
  '/nse-stock-screener',
  '/top-gainers',
  '/top-losers',
  '/intraday-trades',
  '/global-markets',
  '/commodity-prices',
  '/news',
  '/screeners',
  '/sectors',
  '/discover',
  '/discover/ipo',
  '/discover/results',
  '/discover/candlestick',
  '/discover/ban',
  '/discover/insider',
  '/discover/lotsize',
  '/discover/global',
  '/discover/commodities',
  '/ipo',
  '/results-calendar',
  '/fno-ban-list',
  '/stocks',
  '/index/nifty-50',
  '/index/nifty-bank',
  '/index/nifty-it',
  '/stocks/sector/it',
  '/stocks/sector/bank',
  '/stocks/sector/pharma',
  '/high-dividend-stocks',
  '/value-stocks',
  '/large-cap-stocks',
];

async function postJson(url, body) {
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(body),
  });
  return { ok: resp.ok, status: resp.status };
}

async function submitIndexNow(extraPaths = []) {
  const paths = [...new Set([...HUB_PATHS, ...extraPaths])];
  const urlList = paths.map((p) => (p.startsWith('http') ? p : `${SITE_URL}${p}`));
  const results = {};

  try {
    results.indexnow = await postJson('https://api.indexnow.org/indexnow', {
      host: HOST,
      key: INDEXNOW_KEY,
      keyLocation: `${SITE_URL}/${INDEXNOW_KEY}.txt`,
      urlList,
    });
  } catch (e) {
    results.indexnow = { ok: false, error: e.message };
  }

  const sitemap = encodeURIComponent(`${SITE_URL}/sitemap.xml`);
  try {
    const b = await fetch(`https://www.bing.com/ping?sitemap=${sitemap}`);
    // Bing retired this endpoint (HTTP 410); IndexNow above is the supported path.
    results.bingPing = { ok: b.ok, status: b.status, deprecated: b.status === 410 };
  } catch (e) {
    results.bingPing = { ok: false, error: e.message };
  }

  return { submitted: urlList.length, host: HOST, results };
}

module.exports = { submitIndexNow, INDEXNOW_KEY, HUB_PATHS };
