/**
 * SEO pages for arthika.gjam.in — hubs + stock detail with JSON-LD.
 */
const path = require('path');
const fs = require('fs');
const stock = require('./stockData');

const SITE_URL = (process.env.SITE_URL || 'https://arthika.gjam.in').replace(/\/$/, '');

let INDEX_HTML = null;
function readIndex() {
  if (INDEX_HTML) return INDEX_HTML;
  INDEX_HTML = fs.readFileSync(path.join(__dirname, 'public', 'index.html'), 'utf8');
  return INDEX_HTML;
}

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function injectSEO(html, { title, description, canonical, jsonLd, bodyHtml }) {
  let out = html
    .replace(/<title>[^<]*<\/title>/i, `<title>${esc(title)}</title>`)
    .replace(
      /<meta name="description"[^>]*>/i,
      `<meta name="description" content="${esc(description)}">`
    );
  if (!out.includes('name="description"')) {
    out = out.replace('</head>', `<meta name="description" content="${esc(description)}">\n</head>`);
  }
  out = out.replace(
    '</head>',
    `<link rel="canonical" href="${esc(canonical)}">\n` +
      `<meta property="og:title" content="${esc(title)}">\n` +
      `<meta property="og:description" content="${esc(description)}">\n` +
      `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>\n` +
      `</head>`
  );
  const seoBlock = `<article id="seo-content" class="seo-landing">${bodyHtml}</article>`;
  out = out.replace('<body>', `<body>\n${seoBlock}\n`);
  return out;
}

const HUBS = [
  { path: '/stocks', title: 'NSE Stock List — Live Prices & Screener | Arthika', desc: 'Browse 2000+ NSE stocks with live prices, P/E, market cap and AI insights.' },
  { path: '/screener', title: 'Stock Screener — Filter NSE Stocks | Arthika', desc: 'Screen Indian stocks by valuation, momentum, gainers and losers.' },
  { path: '/gainers', title: 'Top Gainers Today — NSE | Arthika', desc: 'NSE top gainers today with live prices and change %.' },
  { path: '/losers', title: 'Top Losers Today — NSE | Arthika', desc: 'NSE top losers today with live prices and change %.' },
];

function registerSEOPages(app) {
  for (const hub of HUBS) {
    app.get(hub.path, (req, res) => {
      const html = injectSEO(readIndex(), {
        title: hub.title,
        description: hub.desc,
        canonical: SITE_URL + hub.path,
        jsonLd: {
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          name: hub.title,
          description: hub.desc,
          url: SITE_URL + hub.path,
        },
        bodyHtml: `<h1>${esc(hub.title.split('|')[0].trim())}</h1><p>${esc(hub.desc)}</p>`,
      });
      res.type('html').send(html);
    });
  }

  app.get('/stocks/:symbol', async (req, res) => {
    const sym = stock.sym(req.params.symbol);
    try {
      const overview = await stock.getStockOverview(sym);
      const name = overview.company_name || sym;
      const ltp = overview.quote?.ltp ?? '—';
      const chg = overview.quote?.change_percent ?? 0;
      const title = `${name} Share Price — NSE:${sym} Live Price & Analysis | Arthika`;
      const desc = `${name} (NSE: ${sym}) share price ₹${ltp}, ${chg}% today. Fundamentals, technicals, shareholding & AI insight. Not investment advice.`;

      const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'FinancialProduct',
        name: `${name} (${sym})`,
        description: desc,
        url: `${SITE_URL}/stocks/${sym.toLowerCase()}`,
      };

      const bodyHtml = `
        <h1>${esc(name)} <small>NSE: ${esc(sym)}</small></h1>
        <p>Live price: ₹${esc(ltp)} (${esc(chg)}%). ${esc(desc)}</p>
        <h2>Overview</h2><p>Recommendation signal: ${esc(overview.recommendation)}.</p>
        <h2>FAQ</h2>
        <h3>What is the current price of ${esc(name)}?</h3>
        <p>As of the latest update, ${esc(name)} (${esc(sym)}) trades around ₹${esc(ltp)} on NSE.</p>
      `;

      const html = injectSEO(readIndex(), {
        title,
        description: desc,
        canonical: `${SITE_URL}/stocks/${sym.toLowerCase()}`,
        jsonLd,
        bodyHtml,
      });
      res.type('html').send(html);
    } catch (e) {
      res.redirect('/stocks');
    }
  });
}

async function buildSitemap(req) {
  const base = SITE_URL;
  const urls = HUBS.map((h) => `${base}${h.path}`);
  try {
    const list = await stock.getScreenerList({ limit: 200 });
    list.forEach((s) => urls.push(`${base}/stocks/${s.symbol.toLowerCase()}`));
  } catch (_) {}

  const items = urls
    .map((u) => `  <url><loc>${esc(u)}</loc><changefreq>daily</changefreq></url>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${items}\n</urlset>`;
}

function robotsTxt(req) {
  const base = SITE_URL;
  return `User-agent: *\nAllow: /\nDisallow: /api/\nSitemap: ${base}/sitemap.xml\n`;
}

module.exports = { registerSEOPages, robotsTxt, buildSitemap };
