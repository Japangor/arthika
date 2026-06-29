/**
 * FCM push + cron-driven engagement for Arthika (CommonJS).
 *
 * Targets Firebase project `learntocode-47c09`, topic `com.gjam.arthika`
 * (the Flutter app subscribes to this on launch).
 *
 * Service account resolved from, in order:
 *   FCM_SA_LEARNTOCODE_47C09_B64  (base64 JSON — set this on Vercel/host)
 *   FCM_SA_B64                    (base64 JSON, generic)
 *   GOOGLE_APPLICATION_CREDENTIALS / FCM_SA_FILE  (path)
 *   ../tools/firebase/learntocode-47c09_service_account.json (local repo)
 *
 * Cron endpoints (set these up on cron-job.org):
 *   GET /api/cron/notify/market-open    Mon–Fri 09:15 IST
 *   GET /api/cron/notify/market-close   Mon–Fri 15:35 IST
 *   GET /api/cron/notify/news           a few times daily (e.g. 08:30,12:30,18:30 IST)
 *   GET /api/cron/seo-refresh           daily — IndexNow + Google Indexing API
 *   GET /api/cron/indexnow              legacy IndexNow-only ping
 *   GET /api/cron/notify                discovery (no send)
 * Add ?force=1 to bypass quiet-hours/dedup for manual testing.
 */
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { google } = require('googleapis');

const stock = require('./stockData');
const { getNews } = require('./news');

const PROJECT = 'learntocode-47c09';
const TOPIC = 'com.gjam.arthika';
const FCM_SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';

let _sa;
let _token = { value: '', exp: 0 };

function resolveSA() {
  if (_sa !== undefined) return _sa;
  _sa = null;
  const b64 = process.env.FCM_SA_LEARNTOCODE_47C09_B64 || process.env.FCM_SA_B64;
  if (b64) {
    try {
      _sa = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
      return _sa;
    } catch (e) {
      console.error('[notify] SA b64 decode failed:', e.message);
    }
  }
  const candidates = [
    process.env.FCM_SA_FILE,
    process.env.GOOGLE_APPLICATION_CREDENTIALS,
    path.join(__dirname, '..', 'tools', 'firebase', 'learntocode-47c09_service_account.json'),
  ].filter(Boolean);
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        _sa = JSON.parse(fs.readFileSync(p, 'utf8'));
        break;
      }
    } catch (e) {
      console.error('[notify] read SA failed:', p, e.message);
    }
  }
  return _sa;
}

async function accessToken(sa) {
  if (_token.value && _token.exp > Date.now() + 60_000) return _token.value;
  const auth = new google.auth.GoogleAuth({ credentials: sa, scopes: [FCM_SCOPE] });
  const client = await auth.getClient();
  const tok = await client.getAccessToken();
  const value = typeof tok === 'string' ? tok : tok.token;
  _token = { value, exp: Date.now() + 50 * 60_000 };
  return value;
}

function strData(d = {}) {
  const out = {};
  for (const k of Object.keys(d)) if (d[k] != null) out[k] = String(d[k]);
  return out;
}

async function sendToTopic({ title, body, data = {}, channelId = 'engagement', image = '' }) {
  const sa = resolveSA();
  if (!sa) return { ok: false, skipped: true, reason: `no FCM service account for ${PROJECT}` };
  let token;
  try {
    token = await accessToken(sa);
  } catch (e) {
    return { ok: false, error: `auth failed: ${e.message}` };
  }
  const notification = { title, body };
  if (image) notification.image = image;
  const payload = {
    message: {
      topic: TOPIC,
      notification,
      data: { source: 'arthika_cron', ...(image ? { image } : {}), ...strData(data) },
      android: { priority: 'high', notification: { sound: 'default', channel_id: channelId } },
    },
  };
  const url = `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`;
  const res = await axios.post(url, payload, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json; UTF-8' },
    timeout: 30_000,
    validateStatus: false,
  });
  if (res.status === 200) return { ok: true, topic: TOPIC, name: res.data && res.data.name };
  return { ok: false, status: res.status, error: res.data };
}

// --- Quiet hours + dedup --------------------------------------------------
const STATE_FILE = path.join(require('os').tmpdir(), 'arthika_notify_state.json');

function readState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) || {};
  } catch (_) {
    return {};
  }
}
function writeState(s) {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(s));
  } catch (_) {
    /* read-only fs */
  }
}
function istClock() {
  const d = new Date(Date.now() + 5.5 * 3600 * 1000);
  return { hour: d.getUTCHours(), minute: d.getUTCMinutes() };
}
function inQuietHours(endH = 6, endM = 30) {
  const { hour, minute } = istClock();
  return hour < endH || (hour === endH && minute < endM);
}

function fmtPct(v) {
  const n = Number(v) || 0;
  return `${n >= 0 ? '▲' : '▼'} ${Math.abs(n).toFixed(2)}%`;
}

// --- Message builders ------------------------------------------------------
async function buildMarketOpen() {
  let sub = 'Live NSE prices, screeners & movers are live now.';
  try {
    const idx = await stock.getIndices();
    const nifty = (idx || []).find((i) => /nifty 50/i.test(i.symbol_name || ''));
    if (nifty) sub = `NIFTY 50 ${nifty.last_trade_price} ${fmtPct(nifty.change_percent)}. Track movers & screeners live.`;
  } catch (_) { /* fall back to generic */ }
  return {
    title: '🔔 Markets are open',
    body: sub,
    channelId: 'market_alerts',
    data: { screen: 'markets', type: 'market_open' },
    dedupKey: `open:${new Date().toISOString().slice(0, 10)}`,
  };
}

async function buildMarketClose() {
  let body = 'See today’s closing levels, top gainers & losers.';
  try {
    const [idx, mv] = await Promise.all([
      stock.getIndices().catch(() => []),
      stock.getTopGainerLoser().catch(() => ({ gainers: [], losers: [] })),
    ]);
    const nifty = (idx || []).find((i) => /nifty 50/i.test(i.symbol_name || ''));
    const g = (mv.gainers || [])[0];
    const l = (mv.losers || [])[0];
    const parts = [];
    if (nifty) parts.push(`NIFTY ${nifty.last_trade_price} ${fmtPct(nifty.change_percent)}`);
    if (g) parts.push(`Top ${g.symbol} ${fmtPct(g.change_percent)}`);
    if (l) parts.push(`${l.symbol} ${fmtPct(l.change_percent)}`);
    if (parts.length) body = parts.join(' • ');
  } catch (_) { /* generic */ }
  return {
    title: '📉 Market close',
    body,
    channelId: 'market_alerts',
    data: { screen: 'markets', type: 'market_close' },
    dedupKey: `close:${new Date().toISOString().slice(0, 10)}`,
  };
}

function clipPlain(s, max) {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

async function buildNews() {
  const items = await getNews(15).catch(() => []);
  const top = (items || []).find((it) => it && it.title && !/^https?:\/\//i.test(it.title));
  if (!top) {
    return {
      title: '📰 Markets & money news',
      body: 'Catch up on the latest stock market headlines in Arthika.',
      channelId: 'news',
      data: { screen: 'news', type: 'news' },
      dedupKey: 'news:fallback',
    };
  }
  const excerpt = clipPlain(top.excerpt, 140);
  const body = excerpt && !/^https?:\/\//i.test(excerpt)
    ? `${excerpt} — Tap to read in Arthika.`
    : `${top.source || 'Markets'} • Tap to read the full story in Arthika.`;
  return {
    title: clipPlain(`📰 ${top.title}`, 90),
    body: clipPlain(body, 170),
    channelId: 'news',
    image: top.image || '',
    data: { screen: 'news', type: 'news', link: top.link || '' },
    dedupKey: `news:${top.link || top.title}`,
  };
}

const BUILDERS = {
  'market-open': buildMarketOpen,
  'market-close': buildMarketClose,
  news: buildNews,
};

async function runNotify(kind, opts = {}) {
  const build = BUILDERS[kind];
  if (!build) return { ok: false, error: `unknown kind "${kind}"`, kinds: Object.keys(BUILDERS) };
  const force = opts.force === true || opts.force === '1' || opts.force === 1;

  if (!force && inQuietHours()) {
    const { hour, minute } = istClock();
    return { skipped: true, reason: 'quiet_hours_ist', istTime: `${hour}:${String(minute).padStart(2, '0')}` };
  }

  const msg = await build();
  const DEDUP_MS = Number(process.env.NOTIFY_DEDUP_MS || 5 * 3600 * 1000);
  const now = Date.now();
  const state = readState();
  const prev = state[kind];
  if (!force && prev && prev.key === msg.dedupKey && now - (prev.at || 0) < DEDUP_MS) {
    return { skipped: true, reason: 'duplicate', key: msg.dedupKey };
  }

  const result = await sendToTopic({
    title: msg.title,
    body: msg.body,
    data: msg.data,
    channelId: msg.channelId,
    image: msg.image || '',
  });
  if (result && result.ok) {
    state[kind] = { key: msg.dedupKey, at: now };
    writeState(state);
  }
  console.log(`[notify] ${kind}:`, JSON.stringify({ title: msg.title, result }));
  return { kind, sentAt: new Date().toISOString(), message: { title: msg.title, body: msg.body }, result };
}

function registerNotifyRoutes(app) {
  const handler = async (req, res) => {
    try {
      const kind = req.params.kind;
      const force = String(req.query.force || (req.body && req.body.force) || '') === '1';
      res.json(await runNotify(kind, { force }));
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  };
  app.get('/api/cron/notify/:kind', handler);
  app.post('/api/cron/notify/:kind', handler);
  app.get('/api/cron/notify', (_req, res) => {
    res.json({
      project: PROJECT,
      topic: TOPIC,
      kinds: Object.keys(BUILDERS),
      usage: {
        marketOpen: 'GET /api/cron/notify/market-open  (Mon–Fri 09:15 IST)',
        marketClose: 'GET /api/cron/notify/market-close (Mon–Fri 15:35 IST)',
        news: 'GET /api/cron/notify/news (e.g. 08:30, 12:30, 18:30 IST)',
        force: 'append ?force=1 to bypass quiet-hours + dedup',
      },
      saConfigured: !!resolveSA(),
    });
  });
  console.log('🔔 Arthika notify routes mounted at /api/cron/notify/:kind');
}

module.exports = { registerNotifyRoutes, runNotify, sendToTopic };
