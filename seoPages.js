/**
 * SEO engine for arthika.rail24.in — keyword-targeted hubs + stock detail pages
 * with server-rendered live data, FAQ blocks and rich JSON-LD structured data.
 *
 * Goal: rank for high-intent queries like "live stock screener", "intraday
 * trades today", "top gainers NSE", "IPO calendar", "F&O ban list" — not the
 * brand name. Each hub renders real, link-rich content crawlers can index.
 */
const path = require('path');
const fs = require('fs');
const stock = require('./stockData');

const SITE_URL = (process.env.SITE_URL || 'https://arthika.rail24.in').replace(/\/$/, '');
const BRAND = 'Arthika';

let INDEX_HTML = null;
function readIndex() {
  if (INDEX_HTML) return INDEX_HTML;
  INDEX_HTML = fs.readFileSync(path.join(__dirname, 'public', 'shell.html'), 'utf8');
  return INDEX_HTML;
}

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
function num(v) {
  const x = Number(v);
  return Number.isFinite(x) ? x : NaN;
}
function fmt(v, dec = 2) {
  const x = num(v);
  if (Number.isNaN(x)) return '—';
  return x.toLocaleString('en-IN', { maximumFractionDigits: dec });
}

/* ---------------- structured data ---------------- */
function websiteLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: BRAND,
    alternateName: 'Arthika Markets',
    url: SITE_URL + '/',
    potentialAction: {
      '@type': 'SearchAction',
      target: { '@type': 'EntryPoint', urlTemplate: SITE_URL + '/stocks/{search_term_string}' },
      'query-input': 'required name=search_term_string',
    },
  };
}
function orgLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: BRAND,
    url: SITE_URL + '/',
    description: 'Live NSE stock screener, intraday trades and AI market insights.',
  };
}
function breadcrumbLd(items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: SITE_URL + it.path,
    })),
  };
}
function faqLd(faqs) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };
}
function itemListLd(items, name) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name,
    numberOfItems: items.length,
    itemListElement: items.slice(0, 25).map((s, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: `${SITE_URL}/stocks/${String(s.symbol || '').toLowerCase()}`,
      name: `${s.symbol} ${s.company_name || ''}`.trim(),
    })),
  };
}

/* ---------------- html fragments ---------------- */
function stockTableHtml(items, limit = 30) {
  const rows = (items || []).slice(0, limit).map((s) => {
    const sym = esc(String(s.symbol || '').toLowerCase());
    return `<tr>
      <td><a href="/stocks/${sym}">${esc(s.symbol)} — ${esc(s.company_name || '')}</a></td>
      <td>₹${fmt(s.ltp ?? s.close)}</td>
      <td>${fmt(s.change_percent)}%</td>
      <td>${fmt(s.market_cap, 0)}</td>
      <td>${fmt(s.pe)}</td>
      <td>${s.dividend_yield ? fmt(s.dividend_yield) + '%' : '—'}</td>
    </tr>`;
  }).join('');
  if (!rows) return '';
  return `<table><thead><tr><th>Stock</th><th>Price</th><th>Change %</th><th>Market Cap (₹ Cr)</th><th>P/E</th><th>Div Yield</th></tr></thead><tbody>${rows}</tbody></table>`;
}
function faqHtml(faqs) {
  if (!faqs || !faqs.length) return '';
  return '<h2>Frequently asked questions</h2>' + faqs.map((f) =>
    `<h3>${esc(f.q)}</h3><p>${esc(f.a)}</p>`).join('');
}
function relatedNav() {
  const themes = THEMES.slice(0, 8)
    .map((t) => `<li><a href="/${t.slug}">${esc(t.linkText)}</a></li>`).join('');
  const sectors = SECTORS.slice(0, 8)
    .map((s) => `<li><a href="/stocks/sector/${s.slug}">${esc(s.linkText)}</a></li>`).join('');
  return `<nav aria-label="Explore"><h2>Explore Arthika</h2><ul>
    <li><a href="/stock-screener">Live Stock Screener</a></li>
    <li><a href="/intraday-trades">Intraday Trades Today</a></li>
    <li><a href="/top-gainers">Top Gainers Today</a></li>
    <li><a href="/top-losers">Top Losers Today</a></li>
    <li><a href="/ipo">IPO Calendar</a></li>
    <li><a href="/results-calendar">Results Calendar</a></li>
    <li><a href="/fno-ban-list">F&amp;O Ban List</a></li>
    <li><a href="/stocks">NSE Stock List</a></li>
  </ul>
  <h2>Popular stock screens</h2><ul>${themes}</ul>
  <h2>Stocks by sector</h2><ul>${sectors}
    <li><a href="/sectors">All sectors &amp; indices →</a></li>
  </ul></nav>`;
}

/* ---------------- SEO injection ---------------- */
function injectSEO(html, { title, description, canonical, jsonLd, bodyHtml }) {
  const lds = (Array.isArray(jsonLd) ? jsonLd : [jsonLd]).filter(Boolean);
  let out = html
    .replace(/<title>[^<]*<\/title>/i, `<title>${esc(title)}</title>`)
    .replace(/<meta name="description"[^>]*>/i, `<meta name="description" content="${esc(description)}">`);
  if (!/name="description"/.test(out)) {
    out = out.replace('</head>', `<meta name="description" content="${esc(description)}">\n</head>`);
  }
  const head =
    `<link rel="canonical" href="${esc(canonical)}">\n` +
    `<meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1">\n` +
    `<meta property="og:type" content="website">\n` +
    `<meta property="og:site_name" content="${BRAND}">\n` +
    `<meta property="og:title" content="${esc(title)}">\n` +
    `<meta property="og:description" content="${esc(description)}">\n` +
    `<meta property="og:url" content="${esc(canonical)}">\n` +
    `<meta name="twitter:card" content="summary_large_image">\n` +
    `<meta name="twitter:title" content="${esc(title)}">\n` +
    `<meta name="twitter:description" content="${esc(description)}">\n` +
    lds.map((l) => `<script type="application/ld+json">${JSON.stringify(l)}</script>`).join('\n') +
    `\n</head>`;
  out = out.replace('</head>', head);
  const seoBlock = `<article id="seo-content" class="seo-landing">${bodyHtml}${relatedNav()}</article>`;
  out = out.replace('<body>', `<body>\n${seoBlock}\n`);
  return out;
}

/* ---------------- hubs ---------------- */
const HUBS = [
  {
    path: '/',
    canonical: '/',
    crumb: [{ name: 'Home', path: '/' }],
    title: 'Live Stock Screener, Intraday Trades & NSE Market Today | Arthika',
    desc: 'Free live NSE stock screener with intraday trades, top gainers & losers, IPO and results calendar, F&O ban list and AI insights. Real-time Indian stock market data.',
    h1: 'Live Stock Screener & Intraday Market Today',
    intro: 'Screen the entire NSE universe in real time — filter stocks by price, valuation, volume and dividend yield, track live intraday trades, top gainers and losers, IPOs, quarterly results and the F&O ban list, with AI-powered insights on every stock. All data is live from NSE feeds.',
    section: async () => {
      const { gainers, losers } = await stock.getTopGainerLoser();
      return `<h2>Top gainers right now</h2>${stockTableHtml(gainers, 10)}` +
        `<h2>Top losers right now</h2>${stockTableHtml(losers, 10)}`;
    },
    faq: [
      { q: 'What is a live stock screener?', a: 'A live stock screener lets you filter NSE-listed stocks in real time by metrics like price, P/E ratio, market cap, volume and dividend yield, so you can quickly find intraday and investment opportunities.' },
      { q: 'Is Arthika free to use?', a: 'Yes. Arthika offers a free live stock screener, intraday movers, IPO and results calendars and AI insights. It is for educational purposes only and not investment advice.' },
      { q: 'Where does the market data come from?', a: 'Prices, gainers, losers and fundamentals are sourced from live NSE feeds and may be delayed. Always confirm on the exchange before trading.' },
    ],
  },
  {
    path: '/stock-screener',
    aliases: ['/screener'],
    canonical: '/stock-screener',
    crumb: [{ name: 'Home', path: '/' }, { name: 'Stock Screener', path: '/stock-screener' }],
    title: 'Live Stock Screener — Screen NSE Stocks by Price, P/E, Volume & Dividend | Arthika',
    desc: 'Free live stock screener for NSE India. Filter stocks by price, P/E, market cap, volume, dividend yield and momentum. Find value, large-cap and high-dividend stocks in real time.',
    h1: 'Live Stock Screener for NSE India',
    intro: 'Screen 2000+ NSE-listed stocks in real time. Filter by value (low P/E), high dividend yield, high volume, large-cap and intraday momentum, then sort by market cap, price or change percentage to build your watchlist.',
    section: async () => {
      const list = await stock.getScreenerList({ filter: 'value', limit: 30 });
      return `<h2>Value stocks (low P/E) today</h2>${stockTableHtml(list, 30)}`;
    },
    faq: [
      { q: 'How do I screen stocks by P/E ratio?', a: 'Open the live stock screener and choose the Value filter to list NSE stocks trading at a low price-to-earnings ratio, then sort the results by market cap or change percentage.' },
      { q: 'Can I find high dividend yield stocks?', a: 'Yes. Use the High Dividend filter in the screener to rank NSE stocks by dividend yield.' },
      { q: 'Does the screener update live?', a: 'Yes, prices and change percentages refresh from live NSE feeds while the market is open.' },
    ],
  },
  {
    path: '/intraday-trades',
    aliases: ['/intraday'],
    canonical: '/intraday-trades',
    crumb: [{ name: 'Home', path: '/' }, { name: 'Intraday Trades', path: '/intraday-trades' }],
    title: 'Live Intraday Trades Today — NSE Most Active, Gainers & Volume Shockers | Arthika',
    desc: 'Track live intraday trades on NSE — most active stocks, top gainers, volume shockers and momentum movers updating in real time. Spot intraday trading opportunities today.',
    h1: 'Live Intraday Trades Today',
    intro: 'Follow live intraday trades across NSE — today’s most active stocks, biggest gainers, volume shockers and momentum breakouts updating in real time. Use these intraday movers alongside the screener and technical signals to plan your trades.',
    section: async () => {
      const vol = await stock.getScreenerList({ filter: 'volume', limit: 20 });
      const { gainers } = await stock.getTopGainerLoser();
      return `<h2>High volume intraday movers</h2>${stockTableHtml(vol, 20)}` +
        `<h2>Top intraday gainers</h2>${stockTableHtml(gainers, 10)}`;
    },
    faq: [
      { q: 'What are intraday trades?', a: 'Intraday trades are positions opened and closed within the same trading session. Traders watch most-active stocks, volume shockers and momentum movers to find intraday opportunities.' },
      { q: 'How do I find the most active stocks today?', a: 'Arthika ranks NSE stocks by traded volume so you can spot the most active and high-momentum stocks for intraday trading in real time.' },
    ],
  },
  {
    path: '/top-gainers',
    aliases: ['/gainers'],
    canonical: '/top-gainers',
    crumb: [{ name: 'Home', path: '/' }, { name: 'Top Gainers', path: '/top-gainers' }],
    title: 'Top Gainers Today — NSE Live Stock Gainers | Arthika',
    desc: 'NSE top gainers today with live prices and change %. See which Indian stocks are rising the most in real time and track intraday momentum.',
    h1: 'Top Gainers Today — NSE',
    intro: 'The biggest NSE gainers today, ranked by intraday change percentage and updated live. Track which Indian stocks are leading the market right now.',
    section: async () => {
      const { gainers } = await stock.getTopGainerLoser();
      return stockTableHtml(gainers, 30);
    },
    faq: [
      { q: 'Which stocks are the top gainers today?', a: 'Arthika lists the NSE stocks with the highest intraday percentage gains, refreshed live from the exchange feed.' },
    ],
  },
  {
    path: '/top-losers',
    aliases: ['/losers'],
    canonical: '/top-losers',
    crumb: [{ name: 'Home', path: '/' }, { name: 'Top Losers', path: '/top-losers' }],
    title: 'Top Losers Today — NSE Live Stock Losers | Arthika',
    desc: 'NSE top losers today with live prices and change %. See which Indian stocks are falling the most in real time.',
    h1: 'Top Losers Today — NSE',
    intro: 'The biggest NSE losers today, ranked by intraday change percentage and updated live. Track which Indian stocks are under pressure right now.',
    section: async () => {
      const { losers } = await stock.getTopGainerLoser();
      return stockTableHtml(losers, 30);
    },
    faq: [
      { q: 'Which stocks are the top losers today?', a: 'Arthika lists the NSE stocks with the largest intraday percentage declines, refreshed live from the exchange feed.' },
    ],
  },
  {
    path: '/ipo',
    aliases: ['/ipo-calendar'],
    canonical: '/ipo',
    crumb: [{ name: 'Home', path: '/' }, { name: 'IPO Calendar', path: '/ipo' }],
    title: 'IPO Calendar 2026 — Live, Upcoming & Listed IPOs NSE/BSE | Arthika',
    desc: 'IPO calendar with live, upcoming and recently listed IPOs on NSE and BSE — open and close dates, price bands and status. Track Indian IPOs in one place.',
    h1: 'IPO Calendar — Live & Upcoming IPOs',
    intro: 'Track every Indian IPO in one place — live, upcoming and recently listed issues on NSE and BSE with open and close dates, price bands and current status.',
    section: async () => {
      const ipos = await stock.getIpoCalendar();
      const rows = (ipos || []).slice(0, 30).map((r) => `<tr>
        <td>${esc(r.company_name || r.symbol)}</td><td>${esc(r.exchange || '')}</td>
        <td>${esc(r.ipo_status || '')}</td><td>${esc(r.start_date || '')}</td>
        <td>${esc(r.end_date || '')}</td><td>${esc(r.price_range || '')}</td></tr>`).join('');
      return rows ? `<table><thead><tr><th>Company</th><th>Exchange</th><th>Status</th><th>Open</th><th>Close</th><th>Price Band</th></tr></thead><tbody>${rows}</tbody></table>` : '';
    },
    faq: [
      { q: 'What is an IPO calendar?', a: 'An IPO calendar lists upcoming, live and recently listed initial public offerings with their open/close dates and price bands so investors can plan applications.' },
    ],
  },
  {
    path: '/results-calendar',
    aliases: ['/results'],
    canonical: '/results-calendar',
    crumb: [{ name: 'Home', path: '/' }, { name: 'Results Calendar', path: '/results-calendar' }],
    title: 'Q Results Calendar — Upcoming NSE Earnings Dates | Arthika',
    desc: 'Quarterly results calendar for NSE companies — upcoming board meetings and earnings announcement dates with live prices. Never miss an earnings date.',
    h1: 'Quarterly Results Calendar — NSE',
    intro: 'Upcoming quarterly earnings and board-meeting dates for NSE-listed companies, with live prices so you can prepare for results-day moves.',
    section: async () => {
      const r = await stock.getResultsCalendar();
      const rows = (r || []).slice(0, 30).map((x) => `<tr>
        <td><a href="/stocks/${esc(String(x.symbol || '').toLowerCase())}">${esc(x.symbol)} — ${esc(x.long_name || '')}</a></td>
        <td>${esc(x.meeting_date || '')}</td></tr>`).join('');
      return rows ? `<table><thead><tr><th>Company</th><th>Meeting Date</th></tr></thead><tbody>${rows}</tbody></table>` : '';
    },
    faq: [
      { q: 'What is a results calendar?', a: 'A results calendar shows upcoming board meeting and earnings announcement dates for listed companies so traders and investors can anticipate results-day volatility.' },
    ],
  },
  {
    path: '/fno-ban-list',
    aliases: ['/ban-list'],
    canonical: '/fno-ban-list',
    crumb: [{ name: 'Home', path: '/' }, { name: 'F&O Ban List', path: '/fno-ban-list' }],
    title: 'F&O Ban List Today — NSE Securities in Ban Period | Arthika',
    desc: 'Live NSE F&O ban list — securities in ban today, possible entrants and exits. Updated daily for derivatives traders.',
    h1: 'F&O Ban List Today — NSE',
    intro: 'The NSE F&O ban list updated for today — securities currently in the ban period plus possible entrants and exits, essential for derivatives traders managing position limits.',
    section: async () => {
      const b = await stock.getBanList();
      const inBan = (b?.securities_ban_result || []).slice(0, 40)
        .map((x) => `<li>${esc(x.symbol_name)}</li>`).join('');
      return inBan ? `<h2>Securities in ban today</h2><ul>${inBan}</ul>` : '';
    },
    faq: [
      { q: 'What is the F&O ban list?', a: 'The F&O ban list contains derivatives contracts that have crossed 95% of market-wide position limits. Fresh positions are barred until open interest falls back below the threshold.' },
    ],
  },
  {
    path: '/stocks',
    aliases: ['/nse-stocks'],
    canonical: '/stocks',
    crumb: [{ name: 'Home', path: '/' }, { name: 'NSE Stocks', path: '/stocks' }],
    title: 'NSE Stock List — Live Share Prices, P/E & Market Cap | Arthika',
    desc: 'Browse 2000+ NSE stocks with live share prices, P/E ratio, market cap and dividend yield. Open any stock for fundamentals, technicals, shareholding and AI insights.',
    h1: 'NSE Stock List — Live Prices',
    intro: 'Browse the full list of NSE-listed stocks with live prices, P/E ratios, market caps and dividend yields. Open any stock for detailed fundamentals, technicals, shareholding and an AI read.',
    section: async () => {
      const list = await stock.getScreenerList({ filter: 'largecap', limit: 40 });
      return `<h2>Large-cap NSE stocks</h2>${stockTableHtml(list, 40)}`;
    },
    faq: [
      { q: 'How many stocks can I screen on Arthika?', a: 'Arthika covers 2000+ NSE-listed stocks with live prices and key fundamentals, all searchable and filterable.' },
    ],
  },
];

/* =================================================================== *
 *  PROGRAMMATIC SEO — auto-generated, data-driven landing pages.
 *  Every page below renders live data + distinct copy + FAQ + JSON-LD,
 *  and is auto-added to the sitemap. Adding an entry = a new ranked page.
 * =================================================================== */

let _uni = { t: 0, v: [] };
async function universe() {
  if (Date.now() - _uni.t < 120000 && _uni.v.length) return _uni.v;
  try {
    const v = await stock.getStockUniverse();
    if (v && v.length) _uni = { t: Date.now(), v };
  } catch (_) { /* keep stale */ }
  return _uni.v;
}
function bySymbols(list, symbols) {
  const map = new Map(list.map((x) => [x.symbol, x]));
  return symbols.map((s) => map.get(String(s).toUpperCase())).filter(Boolean);
}

/* ---- Theme screens (filter the live universe) ---- */
const THEMES = [
  {
    slug: 'high-dividend-stocks',
    aliases: ['best-dividend-stocks', 'dividend-stocks'],
    linkText: 'High Dividend Stocks',
    title: 'High Dividend Stocks in India 2026 — Best NSE Dividend Yield Stocks | Arthika',
    desc: 'Best high dividend yield stocks on NSE India, ranked live by dividend yield with price, P/E and market cap. Find the top dividend-paying Indian stocks today.',
    h1: 'High Dividend Yield Stocks — NSE India',
    intro: 'The highest dividend-yielding stocks on the NSE, ranked live by dividend yield. Dividend stocks can deliver steady passive income; always check payout consistency, earnings cover and balance-sheet strength before investing.',
    faq: [
      { q: 'Which Indian stocks have the highest dividend yield?', a: 'Arthika ranks NSE-listed stocks live by dividend yield. The list above shows the current top dividend-yield stocks with their price, P/E and market cap.' },
      { q: 'Are high dividend stocks a good investment?', a: 'High dividend stocks can provide regular income, but a very high yield can signal a falling price or unsustainable payout. Review earnings, payout ratio and debt before buying.' },
    ],
    pick: (l) => l.filter((x) => x.dividend_yield > 0).sort((a, b) => b.dividend_yield - a.dividend_yield),
  },
  {
    slug: 'value-stocks',
    aliases: ['low-pe-stocks', 'undervalued-stocks'],
    linkText: 'Value (Low P/E) Stocks',
    title: 'Undervalued Low P/E Stocks NSE India 2026 — Value Stock Screener | Arthika',
    desc: 'Undervalued NSE stocks trading at a low price-to-earnings ratio, ranked live. Find value stocks in India with low P/E, plus market cap and dividend yield.',
    h1: 'Undervalued Low P/E Value Stocks — NSE',
    intro: 'NSE stocks trading at a low price-to-earnings (P/E) ratio, ranked live from cheapest. A low P/E can indicate a value opportunity — but confirm growth, debt and sector context, as some low-P/E stocks are cheap for a reason.',
    faq: [
      { q: 'What are low P/E value stocks?', a: 'Value stocks trade at a low price relative to earnings (P/E ratio). Investors look for fundamentally sound companies whose price has lagged, expecting the gap to close over time.' },
      { q: 'How do I find undervalued stocks in India?', a: 'Use Arthika’s value screen above, which ranks NSE stocks by low P/E in real time, then check fundamentals before investing.' },
    ],
    pick: (l) => l.filter((x) => x.pe > 0 && x.pe < 20).sort((a, b) => a.pe - b.pe),
  },
  {
    slug: 'large-cap-stocks',
    aliases: ['largecap-stocks'],
    linkText: 'Large Cap Stocks',
    title: 'Large Cap Stocks List NSE India 2026 — Top Large Cap Shares | Arthika',
    desc: 'List of large cap stocks on NSE India ranked by market capitalisation, with live price, P/E and dividend yield. Explore India’s biggest large-cap companies.',
    h1: 'Large Cap Stocks List — NSE India',
    intro: 'India’s largest companies by market capitalisation, ranked live. Large-cap stocks are typically more stable and liquid, making them core holdings for long-term portfolios.',
    faq: [
      { q: 'What is a large cap stock?', a: 'Large cap stocks are companies with very high market capitalisation (broadly the top 100 listed firms). They tend to be more stable and liquid than mid or small caps.' },
    ],
    pick: (l) => l.filter((x) => /large/i.test(x.cap_category || '')).sort((a, b) => (b.market_cap || 0) - (a.market_cap || 0)),
  },
  {
    slug: 'mid-cap-stocks',
    aliases: ['midcap-stocks'],
    linkText: 'Mid Cap Stocks',
    title: 'Mid Cap Stocks List NSE India 2026 — Best Mid Cap Shares | Arthika',
    desc: 'List of mid cap stocks on NSE India ranked by market cap with live price, P/E and dividend yield. Discover India’s top mid-cap companies for growth.',
    h1: 'Mid Cap Stocks List — NSE India',
    intro: 'Mid-cap NSE companies ranked live by market capitalisation. Mid caps can offer higher growth than large caps with more volatility — useful for investors seeking the next leaders.',
    faq: [
      { q: 'What is a mid cap stock?', a: 'Mid cap stocks sit between large and small caps by market capitalisation (broadly ranks 101–250). They balance growth potential with moderate risk.' },
    ],
    pick: (l) => l.filter((x) => /mid/i.test(x.cap_category || '')).sort((a, b) => (b.market_cap || 0) - (a.market_cap || 0)),
  },
  {
    slug: 'small-cap-stocks',
    aliases: ['smallcap-stocks'],
    linkText: 'Small Cap Stocks',
    title: 'Small Cap Stocks List NSE India 2026 — High Growth Small Caps | Arthika',
    desc: 'List of small cap stocks on NSE India with live price, market cap, P/E and dividend yield. Find high-growth, high-risk small-cap shares in India.',
    h1: 'Small Cap Stocks List — NSE India',
    intro: 'Small-cap NSE companies ranked live by market capitalisation. Small caps can multiply quickly but carry higher risk and lower liquidity — size positions carefully.',
    faq: [
      { q: 'Are small cap stocks high risk?', a: 'Yes. Small caps can deliver outsized returns but are more volatile and less liquid than large or mid caps. Diversify and research thoroughly.' },
    ],
    pick: (l) => l.filter((x) => /small/i.test(x.cap_category || '')).sort((a, b) => (b.market_cap || 0) - (a.market_cap || 0)),
  },
  {
    slug: 'most-active-stocks',
    aliases: ['high-volume-stocks', 'most-traded-stocks'],
    linkText: 'Most Active Stocks',
    title: 'Most Active Stocks NSE Today — Highest Volume Shares Live | Arthika',
    desc: 'Most active stocks on NSE today by traded volume, updating live. Track the highest-volume, most-traded Indian shares for intraday momentum.',
    h1: 'Most Active Stocks Today — NSE by Volume',
    intro: 'The most active NSE stocks today, ranked live by traded volume. High volume signals strong participation and is a key input for intraday and breakout trading.',
    faq: [
      { q: 'What are the most active stocks today?', a: 'Most active stocks are those with the highest traded volume in the session. Arthika ranks NSE stocks live by volume so you can spot where the action is.' },
    ],
    pick: (l) => l.slice().sort((a, b) => (b.volume || 0) - (a.volume || 0)),
  },
  {
    slug: 'penny-stocks',
    aliases: ['penny-stocks-india', 'best-penny-stocks'],
    linkText: 'Penny Stocks',
    title: 'Penny Stocks India 2026 — NSE Stocks Under ₹50 Live List | Arthika',
    desc: 'Live list of penny stocks in India under ₹50 on NSE, ranked by volume with price and market cap. Explore low-price Indian shares (high risk).',
    h1: 'Penny Stocks India — NSE Under ₹50',
    intro: 'NSE-listed penny stocks priced under ₹50, ranked live by traded volume. Penny stocks are highly speculative and volatile — they can move sharply in both directions, so invest only what you can afford to lose.',
    faq: [
      { q: 'What are penny stocks?', a: 'Penny stocks are low-priced shares (here, under ₹50) of small companies. They are high-risk and volatile, often with low liquidity and limited disclosures.' },
      { q: 'Are penny stocks a good investment?', a: 'Penny stocks can deliver large gains but also large losses. They are speculative; research fundamentals and never over-allocate.' },
    ],
    pick: (l) => l.filter((x) => x.ltp > 0 && x.ltp < 50).sort((a, b) => (b.volume || 0) - (a.volume || 0)),
  },
];

/* ---- Sectors (curated NSE constituents → live data) ---- */
const SECTORS = [
  { slug: 'it', name: 'IT', linkText: 'IT Stocks', kw: 'IT & software',
    symbols: ['INFY','TCS','WIPRO','HCLTECH','TECHM','LTIM','MPHASIS','PERSISTENT','COFORGE','LTTS','OFSS','KPITTECH'] },
  { slug: 'bank', name: 'Banking', linkText: 'Bank Stocks', kw: 'banking',
    symbols: ['HDFCBANK','ICICIBANK','SBIN','KOTAKBANK','AXISBANK','INDUSINDBK','BANKBARODA','PNB','IDFCFIRSTB','FEDERALBNK','AUBANK','CANBK'] },
  { slug: 'pharma', name: 'Pharma', linkText: 'Pharma Stocks', kw: 'pharmaceutical',
    symbols: ['SUNPHARMA','DRREDDY','CIPLA','DIVISLAB','AUROPHARMA','LUPIN','TORNTPHARM','ALKEM','BIOCON','ZYDUSLIFE','MANKIND','GLENMARK'] },
  { slug: 'auto', name: 'Auto', linkText: 'Auto Stocks', kw: 'automobile',
    symbols: ['TATAMOTORS','M&M','MARUTI','BAJAJ-AUTO','EICHERMOT','HEROMOTOCO','TVSMOTOR','ASHOKLEY','BOSCHLTD','MOTHERSON','BHARATFORG','BALKRISIND'] },
  { slug: 'fmcg', name: 'FMCG', linkText: 'FMCG Stocks', kw: 'FMCG & consumer',
    symbols: ['HINDUNILVR','ITC','NESTLEIND','BRITANNIA','DABUR','MARICO','GODREJCP','COLPAL','TATACONSUM','VBL','UBL','EMAMILTD'] },
  { slug: 'energy', name: 'Energy & Power', linkText: 'Energy Stocks', kw: 'energy & power',
    symbols: ['RELIANCE','ONGC','NTPC','POWERGRID','COALINDIA','IOC','BPCL','GAIL','ADANIGREEN','TATAPOWER','ADANIPOWER','NHPC'] },
  { slug: 'metal', name: 'Metal', linkText: 'Metal Stocks', kw: 'metals & mining',
    symbols: ['TATASTEEL','JSWSTEEL','HINDALCO','VEDL','JINDALSTEL','SAIL','NMDC','HINDZINC','NATIONALUM','APLAPOLLO','JSL','RATNAMANI'] },
  { slug: 'realty', name: 'Realty', linkText: 'Realty Stocks', kw: 'real estate',
    symbols: ['DLF','GODREJPROP','OBEROIRLTY','PRESTIGE','PHOENIXLTD','BRIGADE','SOBHA','LODHA','MAHLIFE','SUNTECK'] },
  { slug: 'nbfc', name: 'NBFC & Finance', linkText: 'NBFC & Finance Stocks', kw: 'NBFC & financial services',
    symbols: ['BAJFINANCE','BAJAJFINSV','CHOLAFIN','SHRIRAMFIN','MUTHOOTFIN','LICHSGFIN','PFC','RECLTD','SBICARD','HDFCLIFE','SBILIFE','ICICIGI'] },
  { slug: 'infra', name: 'Infra & Capital Goods', linkText: 'Infra Stocks', kw: 'infrastructure & capital goods',
    symbols: ['LT','ADANIPORTS','ULTRACEMCO','GRASIM','SHREECEM','AMBUJACEM','ACC','SIEMENS','ABB','BHEL','CUMMINSIND','BEL'] },
];

/* ---- Indices (curated constituents → live data) ---- */
const INDICES = [
  { slug: 'nifty-50', name: 'Nifty 50', kw: 'Nifty 50',
    symbols: ['RELIANCE','HDFCBANK','ICICIBANK','INFY','TCS','ITC','LT','BHARTIARTL','SBIN','AXISBANK','KOTAKBANK','HINDUNILVR','BAJFINANCE','M&M','MARUTI','SUNPHARMA','NTPC','TATAMOTORS','HCLTECH','POWERGRID','TITAN','ULTRACEMCO','ASIANPAINT','WIPRO','ADANIENT','ADANIPORTS','ONGC','COALINDIA','NESTLEIND','TATASTEEL','JSWSTEEL','BAJAJFINSV','GRASIM','HINDALCO','TECHM','DRREDDY','CIPLA','BRITANNIA','EICHERMOT','HEROMOTOCO','DIVISLAB','APOLLOHOSP','BPCL','TATACONSUM','INDUSINDBK','BAJAJ-AUTO','SBILIFE','HDFCLIFE','LTIM','SHRIRAMFIN'] },
  { slug: 'nifty-bank', name: 'Nifty Bank', kw: 'Bank Nifty',
    symbols: ['HDFCBANK','ICICIBANK','SBIN','KOTAKBANK','AXISBANK','INDUSINDBK','BANKBARODA','PNB','IDFCFIRSTB','FEDERALBNK','AUBANK','CANBK'] },
  { slug: 'nifty-it', name: 'Nifty IT', kw: 'Nifty IT',
    symbols: ['INFY','TCS','WIPRO','HCLTECH','TECHM','LTIM','MPHASIS','PERSISTENT','COFORGE','LTTS'] },
  { slug: 'nifty-pharma', name: 'Nifty Pharma', kw: 'Nifty Pharma',
    symbols: ['SUNPHARMA','DRREDDY','CIPLA','DIVISLAB','AUROPHARMA','LUPIN','TORNTPHARM','ALKEM','BIOCON','ZYDUSLIFE'] },
  { slug: 'nifty-auto', name: 'Nifty Auto', kw: 'Nifty Auto',
    symbols: ['TATAMOTORS','M&M','MARUTI','BAJAJ-AUTO','EICHERMOT','HEROMOTOCO','TVSMOTOR','ASHOKLEY','BOSCHLTD','MOTHERSON'] },
  { slug: 'nifty-fmcg', name: 'Nifty FMCG', kw: 'Nifty FMCG',
    symbols: ['HINDUNILVR','ITC','NESTLEIND','BRITANNIA','DABUR','MARICO','GODREJCP','COLPAL','TATACONSUM','VBL'] },
];

/* ---- Generic renderer for a data-backed listing page ---- */
function renderListing(res, { canonical, title, desc, h1, crumb, intro, items, faq, ldName }) {
  const table = stockTableHtml(items, 50);
  const safeTable = table || '<p>Live data is updating — please refresh shortly.</p>';
  const jsonLd = [websiteLd(), orgLd(), breadcrumbLd(crumb)];
  if (faq) jsonLd.push(faqLd(faq));
  if (items && items.length) jsonLd.push(itemListLd(items, ldName || h1));
  const bodyHtml = `<h1>${esc(h1)}</h1><p>${esc(intro)}</p>${safeTable}${faqHtml(faq)}`;
  res.type('html').send(injectSEO(readIndex(), {
    title, description: desc, canonical: SITE_URL + canonical, jsonLd, bodyHtml,
  }));
}

function renderDirectory(res, { canonical, title, desc, h1, crumb, intro, listHtml }) {
  const jsonLd = [websiteLd(), orgLd(), breadcrumbLd(crumb)];
  const bodyHtml = `<h1>${esc(h1)}</h1><p>${esc(intro)}</p>${listHtml}`;
  res.type('html').send(injectSEO(readIndex(), {
    title, description: desc, canonical: SITE_URL + canonical, jsonLd, bodyHtml,
  }));
}

function buildHub(hub) {
  return async (req, res) => {
    let section = '';
    let listForLd = [];
    try {
      section = await hub.section();
    } catch (_) { section = ''; }
    try {
      if (/gainer/i.test(hub.path)) listForLd = (await stock.getTopGainerLoser()).gainers;
      else if (/loser/i.test(hub.path)) listForLd = (await stock.getTopGainerLoser()).losers;
    } catch (_) {}
    const canonical = SITE_URL + hub.canonical;
    const jsonLd = [websiteLd(), orgLd(), breadcrumbLd(hub.crumb)];
    if (hub.faq) jsonLd.push(faqLd(hub.faq));
    if (listForLd.length) jsonLd.push(itemListLd(listForLd, hub.h1));
    const bodyHtml = `<h1>${esc(hub.h1)}</h1><p>${esc(hub.intro)}</p>${section}${faqHtml(hub.faq)}`;
    res.type('html').send(injectSEO(readIndex(), {
      title: hub.title, description: hub.desc, canonical, jsonLd, bodyHtml,
    }));
  };
}

function registerSEOPages(app) {
  for (const hub of HUBS) {
    const handler = buildHub(hub);
    app.get(hub.path, handler);
    for (const alias of hub.aliases || []) app.get(alias, handler);
  }

  /* ---- Theme screen pages (/high-dividend-stocks, /value-stocks, …) ---- */
  for (const t of THEMES) {
    const handler = async (req, res) => {
      const list = await universe();
      const items = t.pick(list).slice(0, 50);
      renderListing(res, {
        canonical: `/${t.slug}`,
        title: t.title,
        desc: t.desc,
        h1: t.h1,
        crumb: [{ name: 'Home', path: '/' }, { name: 'Screeners', path: '/screeners' }, { name: t.linkText, path: `/${t.slug}` }],
        intro: t.intro,
        items,
        faq: t.faq,
        ldName: t.h1,
      });
    };
    app.get(`/${t.slug}`, handler);
    for (const a of t.aliases || []) app.get(`/${a}`, handler);
  }

  /* ---- Sector pages (/stocks/sector/:slug) ---- */
  for (const sec of SECTORS) {
    app.get(`/stocks/sector/${sec.slug}`, async (req, res) => {
      const list = await universe();
      const items = bySymbols(list, sec.symbols);
      renderListing(res, {
        canonical: `/stocks/sector/${sec.slug}`,
        title: `${sec.name} Stocks List NSE India 2026 — Best ${sec.name} Shares Live | Arthika`,
        desc: `Best ${sec.name} sector stocks on NSE India with live share price, P/E, market cap and dividend yield. Track top ${sec.kw} stocks and compare them in real time.`,
        h1: `${sec.name} Sector Stocks — NSE India`,
        crumb: [{ name: 'Home', path: '/' }, { name: 'Sectors', path: '/sectors' }, { name: sec.name, path: `/stocks/sector/${sec.slug}` }],
        intro: `Top ${sec.kw} stocks listed on the NSE, with live prices, P/E ratios, market caps and dividend yields. Compare the leading ${sec.name} companies in India and open any stock for fundamentals, technicals and an AI read.`,
        items,
        faq: [
          { q: `Which are the top ${sec.name} stocks in India?`, a: `Leading NSE ${sec.kw} stocks include ${sec.symbols.slice(0, 6).join(', ')} and more. The table above shows their live prices and valuations.` },
          { q: `How do I invest in ${sec.name} sector stocks?`, a: `Research each company’s fundamentals, valuation and growth, then track them live on Arthika. This is educational information, not investment advice.` },
        ],
        ldName: `${sec.name} stocks`,
      });
    });
  }

  /* ---- Index pages (/index/:slug) ---- */
  for (const idx of INDICES) {
    app.get(`/index/${idx.slug}`, async (req, res) => {
      const list = await universe();
      const items = bySymbols(list, idx.symbols);
      renderListing(res, {
        canonical: `/index/${idx.slug}`,
        title: `${idx.name} Stocks List Today — Live Prices, Weightage & Returns | Arthika`,
        desc: `${idx.name} constituents with live share prices, change %, P/E and market cap. Track all ${idx.name} index stocks in real time on Arthika.`,
        h1: `${idx.name} Stocks List — Live`,
        crumb: [{ name: 'Home', path: '/' }, { name: 'Indices', path: '/sectors' }, { name: idx.name, path: `/index/${idx.slug}` }],
        intro: `All ${idx.kw} index stocks with live prices, today’s change, P/E and market cap. Monitor the ${idx.name} constituents in real time and open any stock for deeper analysis.`,
        items,
        faq: [
          { q: `What stocks are in the ${idx.name}?`, a: `The ${idx.name} includes ${idx.symbols.slice(0, 8).join(', ')} among others. The table above lists the constituents with live data.` },
        ],
        ldName: `${idx.name} constituents`,
      });
    });
  }

  /* ---- Directory hubs (crawl + internal links) ---- */
  app.get(['/screeners', '/stock-screeners'], (req, res) => {
    const cards = THEMES.map((t) =>
      `<li><a href="/${t.slug}">${esc(t.h1)}</a> — ${esc(t.linkText)}</li>`).join('');
    renderDirectory(res, {
      canonical: '/screeners',
      title: 'Stock Screeners — High Dividend, Value, Large/Mid/Small Cap, Penny & More | Arthika',
      desc: 'All Arthika stock screeners for NSE India: high dividend stocks, undervalued low-P/E value stocks, large/mid/small cap lists, most active and penny stocks — updated live.',
      h1: 'NSE Stock Screeners',
      crumb: [{ name: 'Home', path: '/' }, { name: 'Screeners', path: '/screeners' }],
      intro: 'Browse every live stock screen on Arthika. Each screen filters the full NSE universe in real time so you can find dividend, value, large-cap, mid-cap, small-cap, high-volume and penny stocks instantly.',
      listHtml: `<ul>${cards}</ul>`,
    });
  });

  app.get(['/sectors', '/indices'], (req, res) => {
    const secCards = SECTORS.map((s) =>
      `<li><a href="/stocks/sector/${s.slug}">${esc(s.name)} sector stocks</a></li>`).join('');
    const idxCards = INDICES.map((i) =>
      `<li><a href="/index/${i.slug}">${esc(i.name)} stocks list</a></li>`).join('');
    renderDirectory(res, {
      canonical: '/sectors',
      title: 'NSE Sectors & Indices — IT, Bank, Pharma, Auto, FMCG Stock Lists | Arthika',
      desc: 'Explore NSE stocks by sector and index — IT, banking, pharma, auto, FMCG, energy, metal, realty, NBFC and infra, plus Nifty 50, Bank Nifty and Nifty IT constituents with live data.',
      h1: 'Stocks by Sector & Index — NSE India',
      crumb: [{ name: 'Home', path: '/' }, { name: 'Sectors', path: '/sectors' }],
      intro: 'Browse NSE stocks grouped by sector and by index. Each page lists the leading constituents with live prices, valuations and dividend yields so you can compare companies within a theme.',
      listHtml: `<h2>By sector</h2><ul>${secCards}</ul><h2>By index</h2><ul>${idxCards}</ul>`,
    });
  });

  app.get('/stocks/:symbol', async (req, res) => {
    const sym = stock.sym(req.params.symbol);
    try {
      const [overview, returns] = await Promise.all([
        stock.getStockOverview(sym),
        stock.getReturns(sym).catch(() => ({ stock_return: {} })),
      ]);
      const name = overview.company_name || sym;
      const q = overview.quote || {};
      const ltp = q.ltp ?? '—';
      const chg = q.change_percent ?? 0;
      const ret = returns.stock_return || {};
      const lower = sym.toLowerCase();
      const canonical = `${SITE_URL}/stocks/${lower}`;
      const title = `${name} Share Price Today — NSE:${sym} Live Price, P/E & Analysis | Arthika`;
      const desc = `${name} (NSE: ${sym}) live share price ₹${fmt(ltp)}, ${fmt(chg)}% today. P/E ${fmt(q.pe)}, market cap ₹${fmt(q.market_cap, 0)} Cr, dividend yield ${q.dividend_yield ? fmt(q.dividend_yield) + '%' : '—'}. Fundamentals, technicals, shareholding & AI insight.`;

      const faqs = [
        { q: `What is the share price of ${name} today?`, a: `${name} (NSE: ${sym}) is trading around ₹${fmt(ltp)}, ${fmt(chg)}% on the day.` },
        { q: `What is the P/E ratio of ${name}?`, a: `${name} has a P/E ratio of ${fmt(q.pe)} with a market capitalisation of ₹${fmt(q.market_cap, 0)} crore.` },
        { q: `What is the dividend yield of ${name}?`, a: `${name} has a dividend yield of ${q.dividend_yield ? fmt(q.dividend_yield) + '%' : 'not available'}.` },
        { q: `How has ${sym} performed recently?`, a: `Returns for ${sym}: 1 day ${fmt(ret.return_1d)}%, 1 week ${fmt(ret.return_5d)}%, 1 month ${fmt(ret.return_1m)}%, 1 year ${fmt(ret.return_1y)}%.` },
      ];

      const jsonLd = [
        websiteLd(),
        breadcrumbLd([
          { name: 'Home', path: '/' },
          { name: 'Stocks', path: '/stocks' },
          { name: sym, path: `/stocks/${lower}` },
        ]),
        faqLd(faqs),
        {
          '@context': 'https://schema.org',
          '@type': 'Corporation',
          name,
          tickerSymbol: `NSE:${sym}`,
          url: canonical,
        },
      ];

      const bodyHtml = `
        <h1>${esc(name)} Share Price <small>(NSE: ${esc(sym)})</small></h1>
        <p>${esc(name)} live share price is ₹${fmt(ltp)} (${fmt(chg)}% today). Market cap ₹${fmt(q.market_cap, 0)} crore, P/E ${fmt(q.pe)}, dividend yield ${q.dividend_yield ? fmt(q.dividend_yield) + '%' : '—'}. Signal: ${esc(overview.recommendation)}.</p>
        <h2>${esc(name)} key metrics</h2>
        <table><tbody>
          <tr><td>Last price</td><td>₹${fmt(ltp)}</td></tr>
          <tr><td>Change today</td><td>${fmt(chg)}%</td></tr>
          <tr><td>Open / High / Low</td><td>₹${fmt(q.open)} / ₹${fmt(q.high)} / ₹${fmt(q.low)}</td></tr>
          <tr><td>Market cap</td><td>₹${fmt(q.market_cap, 0)} Cr</td></tr>
          <tr><td>P/E ratio</td><td>${fmt(q.pe)}</td></tr>
          <tr><td>Dividend yield</td><td>${q.dividend_yield ? fmt(q.dividend_yield) + '%' : '—'}</td></tr>
          <tr><td>1Y return</td><td>${fmt(ret.return_1y)}%</td></tr>
        </tbody></table>
        ${faqHtml(faqs)}
      `;

      res.type('html').send(injectSEO(readIndex(), { title, description: desc, canonical, jsonLd, bodyHtml }));
    } catch (e) {
      res.redirect('/stocks');
    }
  });
}

async function buildSitemap() {
  const base = SITE_URL;
  const urls = [];
  for (const hub of HUBS) urls.push({ loc: base + hub.canonical, pri: hub.path === '/' ? '1.0' : '0.8' });
  // Directory hubs
  ['/screeners', '/sectors'].forEach((p) => urls.push({ loc: base + p, pri: '0.7' }));
  // Theme screens
  THEMES.forEach((t) => urls.push({ loc: `${base}/${t.slug}`, pri: '0.8' }));
  // Sector + index pages
  SECTORS.forEach((s) => urls.push({ loc: `${base}/stocks/sector/${s.slug}`, pri: '0.7' }));
  INDICES.forEach((i) => urls.push({ loc: `${base}/index/${i.slug}`, pri: '0.7' }));
  // Discover feeds
  urls.push({ loc: base + '/discover', pri: '0.5' });
  ['ipo', 'results', 'candlestick', 'ban', 'insider', 'lotsize', 'global', 'commodities']
    .forEach((t) => urls.push({ loc: `${base}/discover/${t}`, pri: '0.4' }));
  // Every stock in the live universe (~2500 pages)
  try {
    const list = await universe();
    list.forEach((s) => urls.push({ loc: `${base}/stocks/${String(s.symbol).toLowerCase()}`, pri: '0.6' }));
  } catch (_) {}

  const items = urls.map((u) =>
    `  <url><loc>${esc(u.loc)}</loc><changefreq>daily</changefreq><priority>${u.pri}</priority></url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${items}\n</urlset>`;
}

function robotsTxt() {
  return `User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /shell.html\n\nSitemap: ${SITE_URL}/sitemap.xml\n`;
}

module.exports = { registerSEOPages, robotsTxt, buildSitemap };
