const API = '';

async function fetchJSON(path) {
  const r = await fetch(API + path);
  if (!r.ok) throw new Error(r.statusText);
  return r.json();
}

function fmt(n) {
  if (n == null || n === '') return '—';
  const x = Number(n);
  if (Number.isNaN(x)) return String(n);
  return x.toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

function rowHTML(s) {
  const chg = Number(s.change_percent ?? 0);
  const cls = chg >= 0 ? 'up' : 'down';
  const sign = chg >= 0 ? '+' : '';
  return `<div class="stock-row" data-symbol="${s.symbol}">
    <div><div class="sym">${s.symbol}</div><div class="co">${s.company_name || ''}</div></div>
    <div><div>₹${fmt(s.ltp ?? s.close)}</div><div class="${cls}">${sign}${fmt(chg)}%</div></div>
  </div>`;
}

async function loadIndices() {
  const el = document.getElementById('indices');
  try {
    const { data } = await fetchJSON('/api/market/indices');
    el.innerHTML = (data || []).slice(0, 8).map((i) => {
      const chg = Number(i.change_percent ?? 0);
      const cls = chg >= 0 ? 'up' : 'down';
      return `<div class="index-card">
        <div class="name">${i.symbol_name || 'Index'}</div>
        <div class="price">${fmt(i.last_trade_price ?? i.close)}</div>
        <div class="${cls}">${chg >= 0 ? '+' : ''}${fmt(chg)}%</div>
      </div>`;
    }).join('');
  } catch (e) {
    el.innerHTML = '<p class="co">Indices unavailable</p>';
  }
}

async function loadMovers(type, id) {
  const el = document.getElementById(id);
  try {
    const { data } = await fetchJSON(`/api/market/movers?type=${type}`);
    el.innerHTML = (data || []).slice(0, 10).map(rowHTML).join('');
    bindRows(el);
  } catch (e) {
    el.innerHTML = '<p class="co">Data unavailable</p>';
  }
}

async function loadRecommend() {
  const el = document.getElementById('recommend');
  try {
    const { data } = await fetchJSON('/api/recommend');
    const buy = (data?.buy || []).slice(0, 8);
    el.innerHTML = buy.map(rowHTML).join('') || '<p class="co">No recommendations</p>';
    bindRows(el);
  } catch (e) {
    el.innerHTML = '<p class="co">Recommendations unavailable</p>';
  }
}

function bindRows(container) {
  container.querySelectorAll('.stock-row').forEach((row) => {
    row.addEventListener('click', () => showDetail(row.dataset.symbol));
  });
}

async function showDetail(symbol) {
  const panel = document.getElementById('detail');
  const title = document.getElementById('detail-title');
  const body = document.getElementById('detail-body');
  panel.classList.remove('hidden');
  title.textContent = symbol;
  body.innerHTML = '<p>Loading…</p>';

  try {
    const [overview, ai] = await Promise.all([
      fetchJSON(`/api/stock/${symbol}`),
      fetchJSON(`/api/ai/insight/${symbol}`),
    ]);
    const d = overview.data;
    const q = d.quote || {};
    body.innerHTML = `
      <p><strong>${d.company_name}</strong> · Signal: ${d.recommendation}</p>
      <p>₹${fmt(q.ltp)} <span class="${Number(q.change_percent) >= 0 ? 'up' : 'down'}">${fmt(q.change_percent)}%</span></p>
      <h3>AI Insight</h3>
      <p>${(ai.data?.insight || '').replace(/\n/g, '<br>')}</p>
      <p class="co" style="margin-top:1rem;font-size:0.85rem">Not investment advice. Get full AI in the Arthika app (Pro).</p>
    `;
    history.pushState({ symbol }, '', `/stocks/${symbol.toLowerCase()}`);
  } catch (e) {
    body.innerHTML = '<p>Failed to load stock.</p>';
  }
}

document.getElementById('back')?.addEventListener('click', () => {
  document.getElementById('detail').classList.add('hidden');
  history.pushState({}, '', '/');
});

document.getElementById('search')?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.value.trim()) {
    showDetail(e.target.value.trim().toUpperCase());
  }
});

const m = location.pathname.match(/\/stocks\/([a-z0-9]+)/i);
if (m) showDetail(m[1].toUpperCase());
else {
  loadIndices();
  loadMovers('gainers', 'gainers');
  loadMovers('losers', 'losers');
  loadRecommend();
}
