'use strict';

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */
const $ = (sel, root = document) => root.querySelector(sel);
const app = $('#app');
const cache = new Map();

async function api(path) {
  if (cache.has(path)) return cache.get(path);
  const r = await fetch(path);
  if (!r.ok) throw new Error(r.status + ' ' + r.statusText);
  const j = await r.json();
  cache.set(path, j);
  return j;
}

function num(v) {
  if (v === null || v === undefined || v === '') return NaN;
  const x = Number(v);
  return Number.isFinite(x) ? x : NaN;
}
function fmt(v, dec = 2) {
  const x = num(v);
  if (Number.isNaN(x)) return '—';
  return x.toLocaleString('en-IN', { maximumFractionDigits: dec, minimumFractionDigits: 0 });
}
function money(v, dec = 2) {
  const x = num(v);
  return Number.isNaN(x) ? '—' : '₹' + fmt(x, dec);
}
function crore(v) {
  const x = num(v);
  if (Number.isNaN(x)) return '—';
  if (x >= 100000) return '₹' + fmt(x / 100000, 2) + ' L Cr';
  if (x >= 1000) return '₹' + fmt(x / 1000, 2) + ' K Cr';
  return '₹' + fmt(x, 2) + ' Cr';
}
function pctHTML(v) {
  const x = num(v);
  if (Number.isNaN(x)) return '<span class="muted">—</span>';
  const cls = x >= 0 ? 'up' : 'down';
  return `<span class="${cls} chip-pct">${x >= 0 ? '+' : ''}${fmt(x, 2)}%</span>`;
}
function esc(s) {
  return String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
function dateShort(s) {
  if (!s) return '—';
  const str = String(s);
  const d = new Date(str);
  if (Number.isNaN(d.getTime())) return str.slice(0, 10);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}
function spinner() { return '<div class="loading-screen"><span class="spinner"></span></div>'; }
function adSlot(placement, opts) {
  opts = opts || {};
  const slot = opts.slot || '4698617583';
  const fmt = opts.format ? ` data-ad-format="${opts.format}"` : '';
  return `<div class="mkt-slot mkt-slot--inline" data-ad-slot="${slot}"${fmt} data-ad-placement="${placement}"></div>`;
}

/* ------------------------------------------------------------------ */
/* Router                                                            */
/* ------------------------------------------------------------------ */
function go(path) {
  history.pushState({}, '', path);
  render();
}
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[data-link]');
  if (a) { e.preventDefault(); go(a.getAttribute('href')); }
});
window.addEventListener('popstate', render);

function setActiveNav(path) {
  document.querySelectorAll('.topnav a').forEach((a) => {
    const href = a.getAttribute('href');
    a.classList.toggle('active', href === path || (href !== '/' && path.startsWith(href)));
  });
}

async function render() {
  const path = location.pathname;
  setActiveNav(path);
  const stock = path.match(/^\/stocks\/([a-z0-9&.-]+)/i);
  if (stock) return viewStock(stock[1].toUpperCase());
  const disc = path.match(/^\/discover\/([a-z]+)/i);
  if (disc) return viewFeed(disc[1]);
  if (path === '/screener' || path === '/stock-screener') return viewScreener('value');
  if (path === '/intraday-trades' || path === '/intraday') return viewScreener('volume');
  if (path === '/discover') return viewDiscover();
  if (path === '/gainers' || path === '/top-gainers') return viewScreener('gainers');
  if (path === '/losers' || path === '/top-losers') return viewScreener('losers');
  if (path === '/ipo' || path === '/ipo-calendar') return viewFeed('ipo');
  if (path === '/results-calendar' || path === '/results') return viewFeed('results');
  if (path === '/fno-ban-list' || path === '/ban-list') return viewFeed('ban');
  if (path === '/stocks' || path === '/nse-stocks') return viewScreener('all');
  return viewHome();
}

/* ------------------------------------------------------------------ */
/* Ticker (indices)                                                  */
/* ------------------------------------------------------------------ */
async function loadTicker() {
  const el = $('#ticker');
  try {
    const { data } = await api('/api/market/indices');
    el.innerHTML = (data || []).map((i) => `
      <span class="ti"><b>${esc(i.symbol_name || 'Index')}</b> ${fmt(i.last_trade_price ?? i.close)} ${pctHTML(i.change_percent)}</span>
    `).join('');
  } catch { el.innerHTML = ''; }
}

/* ------------------------------------------------------------------ */
/* Home                                                              */
/* ------------------------------------------------------------------ */
function stockRow(s) {
  return `<div class="stock-row" data-go="/stocks/${esc((s.symbol || '').toLowerCase())}">
    <div><div class="sym">${esc(s.symbol)}</div><div class="co">${esc(s.company_name || '')}</div></div>
    <div class="r"><div>${money(s.ltp ?? s.close)}</div>${pctHTML(s.change_percent)}</div>
  </div>`;
}
function bindGo(root) {
  root.querySelectorAll('[data-go]').forEach((r) =>
    r.addEventListener('click', () => go(r.dataset.go)));
}

async function viewHome() {
  app.innerHTML = `
    <section class="hero">
      <h1>Markets <em>Today</em></h1>
      <p class="sub">Live NSE indices, movers &amp; intraday breadth</p>
    </section>
    <div id="indices" class="index-strip">${spinner()}</div>
    <div class="two-col" style="margin-top:0.5rem">
      <div class="panel"><h2>Top Gainers <a class="more" data-go="/top-gainers">All →</a></h2><div id="gainers" class="mover-list">${spinner()}</div></div>
      <div class="panel"><h2>Top Losers <a class="more" data-go="/top-losers">All →</a></h2><div id="losers" class="mover-list">${spinner()}</div></div>
    </div>
    ${adSlot('home-mid')}
    <div class="section-title">Explore</div>
    <div id="home-disc" class="disc-grid"></div>
    <div id="commodities"></div>
  `;
  bindGo(app);
  loadTicker();
  loadIndices();
  loadMovers('/api/market/movers?type=gainers', 'gainers', 8);
  loadMovers('/api/market/movers?type=losers', 'losers', 8);
  loadCommodities();
  $('#home-disc').innerHTML = DISCOVER.slice(0, 4).map(discCard).join('');
  bindGo($('#home-disc'));
}

function rangeBar(low, cur, high) {
  const l = num(low), c = num(cur), h = num(high);
  if ([l, c, h].some(Number.isNaN) || h <= l) return '';
  const pos = Math.max(0, Math.min(100, ((c - l) / (h - l)) * 100));
  return `<div class="range-bar"><span class="range-fill" style="width:${pos}%"></span><span class="range-dot" style="left:${pos}%"></span></div>`;
}

function breadthBar(adv, dec) {
  const a = num(adv), d = num(dec);
  if (Number.isNaN(a) || Number.isNaN(d) || (a + d) === 0) return '';
  const ap = (a / (a + d)) * 100;
  return `<div class="breadth"><div class="breadth-track"><span class="breadth-adv" style="width:${ap}%"></span></div>
    <div class="breadth-lbl"><span class="up">▲ ${a}</span><span class="down">${d} ▼</span></div></div>`;
}

async function loadIndices() {
  const el = $('#indices');
  try {
    const { data } = await api('/api/market/indices');
    const list = data || [];
    if (!list.length) { el.innerHTML = ''; return; }
    el.innerHTML = list.slice(0, 6).map((i) => {
      const ltp = i.last_trade_price ?? i.close;
      return `<div class="idx-card">
        <div class="idx-name">${esc(i.symbol_name || 'Index')}</div>
        <div class="idx-price">${fmt(ltp)}</div>
        <div class="idx-chg">${pctHTML(i.change_percent)} <span class="muted">${num(i.change) >= 0 ? '+' : ''}${fmt(i.change)}</span></div>
        ${rangeBar(i.low, ltp, i.high)}
        ${breadthBar(i.advance, i.decline)}
      </div>`;
    }).join('');
  } catch { el.innerHTML = ''; }
}

function moverRow(s, maxAbs) {
  const chg = num(s.change_percent) || 0;
  const cls = chg >= 0 ? 'up' : 'down';
  const w = maxAbs ? Math.max(6, Math.min(100, (Math.abs(chg) / maxAbs) * 100)) : 0;
  return `<div class="mover" data-go="/stocks/${esc((s.symbol || '').toLowerCase())}">
    <div class="mover-top">
      <span class="mover-sym">${esc(s.symbol)}</span>
      <span class="mover-px">${money(s.ltp ?? s.close)}</span>
    </div>
    <div class="mover-bar-row">
      <div class="mover-bar"><span class="mover-fill ${cls}" style="width:${w}%"></span></div>
      <span class="${cls} mover-pct">${chg >= 0 ? '+' : ''}${fmt(chg)}%</span>
    </div>
  </div>`;
}

async function loadMovers(path, id, cap) {
  const el = $('#' + id);
  try {
    const { data } = await api(path);
    const list = (data || []).slice(0, cap);
    if (!list.length) { el.innerHTML = '<p class="empty">No data right now.</p>'; return; }
    const maxAbs = Math.max(...list.map((s) => Math.abs(num(s.change_percent) || 0)), 1);
    el.innerHTML = list.map((s) => moverRow(s, maxAbs)).join('');
    bindGo(el);
  } catch { el.innerHTML = '<p class="empty">Unavailable.</p>'; }
}

async function loadList(path, id, cap) {
  const el = $('#' + id);
  try {
    const { data } = await api(path);
    const rows = (data || []).slice(0, cap).map(stockRow).join('');
    el.innerHTML = rows || '<p class="empty">No data right now.</p>';
    bindGo(el);
  } catch { el.innerHTML = '<p class="empty">Unavailable.</p>'; }
}
async function loadRecommend() {
  const el = $('#recommend');
  try {
    const { data } = await api('/api/recommend');
    const rows = (data?.buy || []).slice(0, 8).map(stockRow).join('');
    el.innerHTML = rows || '<p class="empty">No recommendations.</p>';
    bindGo(el);
  } catch { el.innerHTML = '<p class="empty">Unavailable.</p>'; }
}
async function loadCommodities() {
  const el = $('#commodities');
  try {
    const { data } = await api('/api/market/commodities');
    const list = (data?.commodities || []).concat(data?.currencies || []);
    if (!list.length) { el.innerHTML = ''; return; }
    el.innerHTML = '<div class="section-title">Commodities &amp; Currencies</div><div class="chip-strip">' +
      list.map((c) => `<div class="quote-chip"><span class="qc-name">${esc(c.symbol_name)}</span>
        <span class="qc-px">${fmt(c.last_trade_price ?? c.close)}</span>${pctHTML(c.change_percent)}</div>`).join('') +
      '</div>';
  } catch { el.innerHTML = ''; }
}

/* ------------------------------------------------------------------ */
/* Screener                                                          */
/* ------------------------------------------------------------------ */
const FILTERS = [
  ['all', 'All'], ['gainers', 'Gainers'], ['losers', 'Losers'],
  ['value', 'Value (PE<20)'], ['dividend', 'High Dividend'],
  ['volume', 'High Volume'], ['largecap', 'Large Cap'],
];
let screenerSort = { key: 'change_percent', dir: -1 };

async function viewScreener(initial = 'all') {
  app.innerHTML = `
    <section class="hero"><h1>Stock <em>Screener</em></h1><p class="sub">Filter the full NSE universe by momentum, value, dividend & size.</p></section>
    <div class="toolbar" id="filters">${FILTERS.map(([v, l]) =>
      `<span class="chip ${v === initial ? 'active' : ''}" data-f="${v}">${l}</span>`).join('')}</div>
    <input type="search" id="scr-search" placeholder="Filter loaded results…" style="width:100%;padding:0.6rem 1rem;border-radius:10px;border:1px solid var(--border);background:var(--bg);color:var(--text);margin-bottom:1rem">
    ${adSlot('screener-top')}
    <div id="scr-table">${spinner()}</div>
  `;
  loadTicker();
  let current = initial;
  let rows = [];

  const draw = () => {
    const q = ($('#scr-search').value || '').trim().toUpperCase();
    let list = rows;
    if (q) list = list.filter((s) => (s.symbol || '').includes(q) || (s.company_name || '').toUpperCase().includes(q));
    const { key, dir } = screenerSort;
    list = [...list].sort((a, b) => ((num(b[key]) || -Infinity) - (num(a[key]) || -Infinity)) * (dir === -1 ? 1 : -1));
    $('#scr-table').innerHTML = screenerTable(list.slice(0, 200));
    bindGo($('#scr-table'));
    $('#scr-table').querySelectorAll('th[data-k]').forEach((th) =>
      th.addEventListener('click', () => {
        const k = th.dataset.k;
        screenerSort = { key: k, dir: screenerSort.key === k ? -screenerSort.dir : -1 };
        draw();
      }));
  };

  const load = async (f) => {
    current = f;
    $('#scr-table').innerHTML = spinner();
    try {
      const { data } = await api(`/api/stocks?filter=${f}&limit=300`);
      rows = data || [];
      draw();
    } catch { $('#scr-table').innerHTML = '<p class="empty">Could not load screener.</p>'; }
  };

  $('#filters').querySelectorAll('.chip').forEach((c) =>
    c.addEventListener('click', () => {
      $('#filters .chip.active')?.classList.remove('active');
      c.classList.add('active');
      load(c.dataset.f);
    }));
  $('#scr-search').addEventListener('input', draw);
  load(initial);
}

function screenerTable(list) {
  if (!list.length) return '<p class="empty">No matching stocks.</p>';
  const cols = [
    ['company_name', 'Stock'], ['ltp', 'LTP'], ['change_percent', 'Chg%'],
    ['market_cap', 'Mkt Cap (Cr)'], ['pe', 'P/E'], ['dividend_yield', 'Div%'], ['volume', 'Volume'],
  ];
  return `<div class="table-wrap"><table class="data"><thead><tr>${
    cols.map(([k, l]) => `<th data-k="${k}">${l}</th>`).join('')
  }</tr></thead><tbody>${
    list.map((s) => `<tr data-go="/stocks/${esc((s.symbol || '').toLowerCase())}">
      <td><strong>${esc(s.symbol)}</strong><div class="co">${esc(s.company_name || '')}</div></td>
      <td>${money(s.ltp)}</td>
      <td>${pctHTML(s.change_percent)}</td>
      <td>${fmt(s.market_cap, 0)}</td>
      <td>${fmt(s.pe)}</td>
      <td>${s.dividend_yield ? fmt(s.dividend_yield) + '%' : '—'}</td>
      <td>${fmt(s.volume, 0)}</td>
    </tr>`).join('')
  }</tbody></table></div>`;
}

/* ------------------------------------------------------------------ */
/* Discover                                                          */
/* ------------------------------------------------------------------ */
const DISCOVER = [
  { type: 'ipo', title: 'IPO Calendar', desc: 'Live, upcoming & listed IPOs', icon: '📅', color: 'var(--gold)' },
  { type: 'results', title: 'Results Calendar', desc: 'Upcoming earnings meetings', icon: '🗓️', color: 'var(--accent)' },
  { type: 'candlestick', title: 'Candlestick Scans', desc: 'Daily bullish/bearish patterns', icon: '📊', color: 'var(--green)' },
  { type: 'ban', title: 'F&O Ban List', desc: 'Securities in ban & entrants', icon: '🚫', color: 'var(--red)' },
  { type: 'insider', title: 'Insider Trades', desc: 'Promoter & insider activity', icon: '👁️', color: 'var(--gold)' },
  { type: 'lotsize', title: 'F&O Lot Sizes', desc: 'Derivatives lot sizes', icon: '📦', color: 'var(--accent)' },
  { type: 'global', title: 'Global Markets', desc: 'World indices & bonds', icon: '🌐', color: 'var(--green)' },
  { type: 'commodities', title: 'Commodities & FX', desc: 'Gold, crude, currencies', icon: '💎', color: 'var(--gold)' },
];
function discCard(d) {
  return `<div class="disc-card" data-go="/discover/${d.type}">
    <div class="ic" style="background:${d.color}22;color:${d.color}">${d.icon}</div>
    <h3>${d.title}</h3><p>${d.desc}</p></div>`;
}
function viewDiscover() {
  app.innerHTML = `<section class="hero"><h1><em>Discover</em></h1><p class="sub">IPOs, results, ban list, insider trades, patterns & global markets.</p></section>
    <div class="disc-grid">${DISCOVER.map(discCard).join('')}</div>
    ${adSlot('discover-bottom')}`;
  bindGo(app);
  loadTicker();
}

/* ------------------------------------------------------------------ */
/* Feed                                                              */
/* ------------------------------------------------------------------ */
const FEED_API = {
  ipo: '/api/calendar/ipo', results: '/api/calendar/results',
  candlestick: '/api/patterns/candlestick', ban: '/api/derivatives/ban-list',
  insider: '/api/smart-money/insider', lotsize: '/api/derivatives/lot-size',
  global: '/api/market/global', commodities: '/api/market/commodities',
};
async function viewFeed(type) {
  const meta = DISCOVER.find((d) => d.type === type) || { title: 'Feed' };
  app.innerHTML = `<div class="crumbs"><a data-link href="/discover">Discover</a> › ${meta.title}</div>
    <section class="hero" style="padding-top:0"><h1>${meta.title}</h1></section>${adSlot('feed-top')}<div id="feed">${spinner()}</div>`;
  bindGo(app);
  loadTicker();
  const el = $('#feed');
  try {
    const res = await api(FEED_API[type]);
    let rows = res.data;
    if (type === 'ban') {
      const m = res.data || {};
      rows = (m.securities_ban_result || []).concat(
        (m.possible_entrants_result || []).map((r) => ({ ...r, _entrant: true })));
    } else if (type === 'commodities') {
      const m = res.data || {};
      rows = (m.commodities || []).concat(m.currencies || []);
    }
    if (!rows || !rows.length) { el.innerHTML = '<p class="empty">No data available right now.</p>'; return; }
    el.innerHTML = feedTable(type, rows);
    bindGo(el);
  } catch { el.innerHTML = '<p class="empty">Could not load this feed.</p>'; }
}

function feedTable(type, rows) {
  const wrap = (head, body) => `<div class="table-wrap"><table class="data"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
  const T = (s) => esc(s ?? '—');
  switch (type) {
    case 'ipo':
      return wrap('<th>Company</th><th>Exchange</th><th>Status</th><th>Open</th><th>Close</th><th>Price</th>',
        rows.map((r) => `<tr><td><strong>${T(r.symbol)}</strong><div class="co">${T(r.company_name)}</div></td>
          <td>${T(r.exchange)}</td><td>${T(r.ipo_status)}</td><td>${dateShort(r.start_date)}</td>
          <td>${dateShort(r.end_date)}</td><td>${T(r.price_range)}</td></tr>`).join(''));
    case 'results':
      return wrap('<th>Company</th><th>Meeting</th><th>LTP</th><th>Chg%</th>',
        rows.map((r) => `<tr data-go="/stocks/${esc((r.symbol || '').toLowerCase())}"><td><strong>${T(r.symbol)}</strong><div class="co">${T(r.long_name)}</div></td>
          <td>${dateShort(r.meeting_date)}</td><td>${num(r.last_trade_price) ? money(r.last_trade_price) : '—'}</td><td>${pctHTML(r.change_percent)}</td></tr>`).join(''));
    case 'candlestick':
      return wrap('<th>Stock</th><th>Pattern</th><th>Sentiment</th><th>Date</th>',
        rows.map((r) => `<tr data-go="/stocks/${esc((r.symbol || '').toLowerCase())}"><td><strong>${T(r.symbol)}</strong></td>
          <td>${T(r.pattern)}</td><td><span class="tag ${String(r.sentiment).toLowerCase().includes('bull') ? 'green' : 'red'}">${T(r.sentiment)}</span></td>
          <td>${dateShort(r.date)}</td></tr>`).join(''));
    case 'ban':
      return wrap('<th>Symbol</th><th>Status</th><th>Limit Next Day</th><th>Ban %</th>',
        rows.map((r) => `<tr><td><strong>${T(r.symbol_name)}</strong></td>
          <td>${r._entrant ? '<span class="tag gold">Possible entrant</span>' : '<span class="tag red">In ban</span>'}</td>
          <td>${T(r.limitfornextday)}</td><td>${fmt(r.current_percent, 0)}%</td></tr>`).join(''));
    case 'insider':
      return wrap('<th>Company</th><th>Acquirer</th><th>Qty</th><th>Type</th><th>Date</th>',
        rows.map((r) => `<tr><td><strong>${T(r.symbol_name)}</strong><div class="co">${T(r.company_name)}</div></td>
          <td>${T(r.acquirer)}</td><td>${fmt(r.no_of_securities, 0)}</td>
          <td><span class="tag ${String(r.acquisition_disposal).toLowerCase().includes('buy') ? 'green' : 'red'}">${T(r.acquisition_disposal)}</span></td>
          <td>${T(r.date)}</td></tr>`).join(''));
    case 'lotsize':
      return wrap('<th>Underlying</th><th>Symbol</th><th>Lot (current)</th><th>LTP</th>',
        rows.map((r) => {
          let lot = '—';
          try { const md = JSON.parse(r.month_data || '{}'); lot = Object.values(md)[0] || '—'; } catch {}
          return `<tr data-go="/stocks/${esc((r.symbol || '').toLowerCase())}"><td>${T(r.underlying)}</td><td><strong>${T(r.symbol)}</strong></td>
            <td>${esc(lot)}</td><td>${money(r.last_trade_price)}</td></tr>`;
        }).join(''));
    case 'global':
    case 'commodities':
      return wrap('<th>Name</th><th>LTP</th><th>Chg%</th><th>52W H</th><th>52W L</th>',
        rows.map((r) => `<tr><td><strong>${T(r.symbol_name)}</strong><div class="co">${T(r.region || r.type || '')}</div></td>
          <td>${fmt(r.last_trade_price ?? r.close)}</td><td>${pctHTML(r.change_percent)}</td>
          <td>${fmt(r.high52)}</td><td>${fmt(r.low52)}</td></tr>`).join(''));
    default:
      return '<p class="empty">Unsupported feed.</p>';
  }
}

/* ------------------------------------------------------------------ */
/* Stock detail                                                      */
/* ------------------------------------------------------------------ */
const STOCK_TABS = ['Overview', 'Valuation', 'Technicals', 'Shareholding', 'Peers', 'Corp Actions', 'AI Insight', 'About'];

async function viewStock(symbol) {
  app.innerHTML = `<div class="crumbs"><a data-link href="/">Markets</a> › <a data-link href="/screener">Stocks</a> › ${esc(symbol)}</div>
    <div id="stk-head">${spinner()}</div>
    ${adSlot('stock-top')}
    <div class="tabs" id="stk-tabs"></div>
    <div id="stk-body"></div>`;
  bindGo(app);
  loadTicker();

  let overview;
  try {
    const res = await api(`/api/stock/${symbol}`);
    overview = res.data || {};
  } catch {
    $('#stk-head').innerHTML = '<p class="empty">Could not load stock.</p>';
    return;
  }
  const q = overview.quote || {};
  const rec = (overview.recommendation || 'hold').toLowerCase();
  $('#stk-head').innerHTML = `<div class="stock-head">
    <div>
      <div class="nm">${esc(overview.company_name || symbol)}</div>
      <div class="meta">NSE: ${esc(symbol)} · ${esc(q.cap_category || '—')} <span class="pill ${rec}">${esc(rec)}</span></div>
    </div>
    <div class="px-row">
      <div class="px">${money(q.ltp)}</div>
      <div>${pctHTML(q.change_percent)} <span class="muted">(${money(q.change)})</span></div>
    </div>
  </div>`;

  const tabsEl = $('#stk-tabs');
  tabsEl.innerHTML = STOCK_TABS.map((t, i) => `<span class="tab ${i === 0 ? 'active' : ''}" data-t="${t}">${t}</span>`).join('');
  const body = $('#stk-body');
  const showTab = (t) => {
    tabsEl.querySelectorAll('.tab').forEach((x) => x.classList.toggle('active', x.dataset.t === t));
    body.innerHTML = spinner();
    renderStockTab(t, symbol, overview).then((html) => { body.innerHTML = html; bindGo(body); attachAITeaser(body, symbol); });
  };
  tabsEl.querySelectorAll('.tab').forEach((x) => x.addEventListener('click', () => showTab(x.dataset.t)));
  showTab('Overview');
}

function metric(k, v) { return `<div class="metric"><div class="k">${k}</div><div class="v">${v}</div></div>`; }

async function renderStockTab(tab, symbol, ov) {
  const q = ov.quote || {};
  try {
    switch (tab) {
      case 'Overview': {
        let ret = {};
        try { ret = (await api(`/api/stock/${symbol}/returns`)).data?.stock_return || {}; } catch {}
        return `
          <div class="metric-grid">
            ${metric('Open', money(q.open))}
            ${metric('High', money(q.high))}
            ${metric('Low', money(q.low))}
            ${metric('Prev Close', money(q.close))}
            ${metric('Volume', fmt(q.volume, 0))}
            ${metric('Market Cap', crore(q.market_cap))}
          </div>
          <div class="section-title">Returns</div>
          <div class="returns-row">
            ${['return_1d:1D', 'return_5d:1W', 'return_1m:1M', 'return_6m:6M', 'return_1y:1Y', 'return_5y:5Y'].map((p) => {
              const [k, l] = p.split(':');
              return `<div class="rt"><div class="k">${l}</div><div class="v">${pctHTML(ret[k])}</div></div>`;
            }).join('')}
          </div>
          <div class="section-title">AI Snapshot</div>
          <div id="ai-teaser" class="ai-box"><span class="spinner"></span></div>`;
      }
      case 'Valuation':
        return `<div class="metric-grid">
          ${metric('Market Cap', crore(q.market_cap))}
          ${metric('P/E Ratio', fmt(q.pe))}
          ${metric('Dividend Yield', q.dividend_yield ? fmt(q.dividend_yield) + '%' : '—')}
          ${metric('Cap Category', esc(q.cap_category || '—'))}
          ${metric('52W High', money(q.high52))}
          ${metric('52W Low', money(q.low52))}
        </div>
        <p class="empty" style="text-align:left;padding:1rem 0">Detailed P&amp;L, balance sheet and cash-flow statements are available in the Arthika app.</p>`;
      case 'Technicals': {
        const { data } = await api(`/api/stock/${symbol}/technicals`);
        return technicalsHTML(data || {});
      }
      case 'Shareholding': {
        const { data } = await api(`/api/stock/${symbol}/shareholding`);
        return shareholdingHTML(data || {});
      }
      case 'Peers': {
        const { data } = await api(`/api/stock/${symbol}/peers`);
        if (!data || !data.length) return '<p class="empty">No peers found.</p>';
        return screenerTable(data);
      }
      case 'Corp Actions': {
        const { data } = await api(`/api/stock/${symbol}/corp-actions`);
        return corpActionsHTML(data || {});
      }
      case 'AI Insight': {
        const { data } = await api(`/api/ai/insight/${symbol}`);
        return `<div class="ai-box"><h3>✦ AI Insight</h3><p>${esc(data?.insight || 'Not available.')}</p>
          <div class="ai-cta" data-go="/screener">Get full AI insights in the Arthika app</div></div>`;
      }
      case 'About':
        return `<div class="panel"><h2>${esc(ov.company_name || symbol)}</h2>
          <p class="co">NSE: ${esc(symbol)} · Sector cap: ${esc(q.cap_category || '—')}</p>
          <div class="metric-grid" style="margin-top:1rem">
            ${metric('Signal', esc(ov.recommendation || '—'))}
            ${metric('Market Cap', crore(q.market_cap))}
            ${metric('P/E', fmt(q.pe))}
            ${metric('Div Yield', q.dividend_yield ? fmt(q.dividend_yield) + '%' : '—')}
          </div>
          <p class="empty" style="text-align:left;padding-top:1rem">Full company profile, leadership and filings are available in the Arthika app.</p></div>`;
      default:
        return '<p class="empty">—</p>';
    }
  } catch {
    return '<p class="empty">This data is unavailable right now.</p>';
  }
}

async function attachAITeaser(root, symbol) {
  const el = root.querySelector('#ai-teaser');
  if (!el) return;
  try {
    const { data } = await api(`/api/ai/insight/${symbol}`);
    el.innerHTML = `<h3>✦ AI Read</h3><p>${esc(data?.insight || 'Not available.')}</p>`;
  } catch { el.innerHTML = '<p class="muted">AI insight unavailable.</p>'; }
}

function technicalsHTML(d) {
  const ind = d.indicators || {};
  const sma = ind.SMA || {};
  const periods = ['5', '10', '20', '50', '100', '200'];
  const smaCards = periods.filter((p) => sma[p] != null).map((p) => metric('SMA ' + p, fmt(sma[p]))).join('');
  // pick scalar indicators
  const scalars = Object.entries(ind)
    .filter(([k, v]) => k !== 'SMA' && (typeof v === 'number' || (typeof v === 'object' && v)))
    .slice(0, 12)
    .map(([k, v]) => {
      let val = v;
      if (v && typeof v === 'object') val = Object.values(v)[0];
      return metric(k.replace(/_/g, ' '), fmt(val));
    }).join('');
  if (!smaCards && !scalars) return '<p class="empty">No technical data.</p>';
  return `${smaCards ? '<div class="section-title">Moving Averages</div><div class="metric-grid">' + smaCards + '</div>' : ''}
    ${scalars ? '<div class="section-title">Indicators</div><div class="metric-grid">' + scalars + '</div>' : ''}`;
}

function shareholdingHTML(d) {
  const cols = d.columns || [];
  const rows = d.rows || [];
  if (!cols.length || !rows.length) return '<p class="empty">Shareholding data unavailable.</p>';
  const recent = cols.slice(-6);
  const startIdx = cols.length - recent.length;
  return `<div class="table-wrap"><table class="data"><thead><tr><th>Category</th>${
    recent.map((c) => `<th>${esc(c)}</th>`).join('')
  }</tr></thead><tbody>${
    rows.map((r) => `<tr><td>${esc(r.category_name || r.category)}</td>${
      recent.map((_, i) => `<td>${fmt((r.data || [])[startIdx + i])}%</td>`).join('')
    }</tr>`).join('')
  }</tbody></table></div>`;
}

function corpActionsHTML(d) {
  const actions = d.actions || {};
  const filings = d.filings || [];
  let html = '';
  const groups = ['dividend', 'split', 'bonus'];
  const all = groups.flatMap((g) => Array.isArray(actions[g]) ? actions[g].map((x) => ({ ...x, _g: g })) : []);
  if (all.length) {
    html += '<div class="section-title">Dividends, Splits & Bonus</div><div class="table-wrap"><table class="data"><thead><tr><th>Type</th><th>Detail</th><th>Ex-Date</th><th>Amount</th></tr></thead><tbody>' +
      all.map((a) => `<tr><td><span class="tag gold">${esc(a._g)}</span></td><td>${esc(a.subject || a.dividend_type || '—')}</td>
        <td>${dateShort(a.ex_date)}</td><td>${a.amount ? money(a.amount) : '—'}</td></tr>`).join('') +
      '</tbody></table></div>';
  }
  const fil = Array.isArray(filings) ? filings : (filings.corp_announcements || []);
  if (fil.length) {
    html += '<div class="section-title">Recent Filings</div>' + fil.slice(0, 15).map((f) =>
      `<div class="stock-row"><div><div class="sym">${esc(f.type || f.subject || 'Filing')}</div>
        <div class="co">${esc((f.description || f.attachment_name || f.headline || '').slice(0, 120))}</div></div>
        <div class="co">${dateShort(f.date || f.created_at || f.broadcast_date)}</div></div>`).join('');
  }
  return html || '<p class="empty">No corporate actions found.</p>';
}

/* ------------------------------------------------------------------ */
/* Global search                                                     */
/* ------------------------------------------------------------------ */
const searchBox = $('#search');
const searchResults = $('#search-results');
let searchTimer;
searchBox?.addEventListener('input', () => {
  clearTimeout(searchTimer);
  const q = searchBox.value.trim();
  if (q.length < 2) { searchResults.classList.add('hidden'); return; }
  searchTimer = setTimeout(async () => {
    try {
      const { data } = await api('/api/search?q=' + encodeURIComponent(q));
      if (!data || !data.length) { searchResults.classList.add('hidden'); return; }
      searchResults.innerHTML = data.slice(0, 12).map((s) =>
        `<div class="sr-item" data-go="/stocks/${esc((s.symbol || '').toLowerCase())}">
          <span><strong>${esc(s.symbol)}</strong><div class="sr-co">${esc(s.company_name || '')}</div></span>
          <span>${money(s.ltp)}</span></div>`).join('');
      searchResults.classList.remove('hidden');
      searchResults.querySelectorAll('[data-go]').forEach((r) =>
        r.addEventListener('click', () => { searchResults.classList.add('hidden'); searchBox.value = ''; go(r.dataset.go); }));
    } catch { searchResults.classList.add('hidden'); }
  }, 300);
});
document.addEventListener('click', (e) => {
  if (!e.target.closest('.search-wrap')) searchResults.classList.add('hidden');
});

/* ------------------------------------------------------------------ */
/* In-page install banner (app marketing)                            */
/* ------------------------------------------------------------------ */
const PLAY_URL = 'https://play.google.com/store/apps/details?id=com.gjam.arthika';
function mountInstallBanner() {
  try {
    const snoozed = Number(localStorage.getItem('arthika.install.snooze') || 0);
    if (snoozed && Date.now() < snoozed) return;
  } catch {}
  if (document.querySelector('.install-banner')) return;
  const bar = document.createElement('div');
  bar.className = 'install-banner';
  bar.innerHTML =
    `<div class="ib-icon">📈</div>` +
    `<div class="ib-text"><strong>Get the Arthika app</strong>` +
    `<span>Live NSE screener, alerts &amp; AI insights — free on Android</span></div>` +
    `<a class="ib-cta" href="${PLAY_URL}" target="_blank" rel="noopener">Install</a>` +
    `<button class="ib-close" aria-label="Dismiss">&times;</button>`;
  document.body.appendChild(bar);
  bar.querySelector('.ib-close').addEventListener('click', () => {
    bar.remove();
    try {
      localStorage.setItem('arthika.install.snooze', String(Date.now() + 7 * 864e5));
    } catch {}
  });
}

/* boot */
render();
mountInstallBanner();
