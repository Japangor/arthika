/**
 * In-app purchase verification for Arthika (Google Play Billing).
 *
 * The Flutter app sends the Play purchaseToken; we verify it server-side with
 * the Google Play Developer API so a device can't fake the lifetime "Pro"
 * unlock. Verifying products (one-time) uses purchases.products.get.
 *
 * Service account (must have Play Console access to com.gjam.arthika):
 *   PLAY_SA_B64  (base64 JSON — set on host)  OR
 *   PLAY_SA_FILE / GOOGLE_APPLICATION_CREDENTIALS (path)  OR
 *   ../tools/playstore/service_account.json (local repo)
 */
const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

const PACKAGE = 'com.gjam.arthika';
const PRO_PRODUCT = 'com.gjam.arthika.pro';
const SCOPE = 'https://www.googleapis.com/auth/androidpublisher';

let _sa;
let _client;

function resolveSA() {
  if (_sa !== undefined) return _sa;
  _sa = null;
  const b64 = process.env.PLAY_SA_B64;
  if (b64) {
    try {
      _sa = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
      return _sa;
    } catch (e) {
      console.error('[iap] SA b64 decode failed:', e.message);
    }
  }
  const candidates = [
    process.env.PLAY_SA_FILE,
    process.env.GOOGLE_APPLICATION_CREDENTIALS,
    path.join(__dirname, '..', 'tools', 'playstore', 'service_account.json'),
  ].filter(Boolean);
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        _sa = JSON.parse(fs.readFileSync(p, 'utf8'));
        break;
      }
    } catch (e) {
      console.error('[iap] read SA failed:', p, e.message);
    }
  }
  return _sa;
}

async function publisher() {
  if (_client) return _client;
  const sa = resolveSA();
  if (!sa) return null;
  const auth = new google.auth.GoogleAuth({ credentials: sa, scopes: [SCOPE] });
  _client = google.androidpublisher({ version: 'v3', auth });
  return _client;
}

/**
 * Verify a one-time product purchase.
 * @returns {Promise<{valid:boolean, reason?:string, purchaseState?:number, raw?:object}>}
 */
async function verifyProduct(productId, purchaseToken) {
  if (!productId || !purchaseToken) {
    return { valid: false, reason: 'missing_params' };
  }
  const ap = await publisher();
  if (!ap) return { valid: false, reason: 'no_service_account' };
  try {
    const r = await ap.purchases.products.get({
      packageName: PACKAGE,
      productId,
      token: purchaseToken,
    });
    const d = r.data || {};
    // purchaseState: 0 = purchased, 1 = canceled, 2 = pending
    const valid = d.purchaseState === 0;
    return { valid, purchaseState: d.purchaseState, raw: d };
  } catch (e) {
    const code = e && e.code;
    return { valid: false, reason: `play_api_error_${code || 'unknown'}`, message: e.message };
  }
}

function registerIapRoutes(app) {
  app.post('/api/iap/verify', async (req, res) => {
    try {
      const { productId, purchaseToken } = req.body || {};
      const result = await verifyProduct(productId || PRO_PRODUCT, purchaseToken);
      res.json({ status: result.valid ? 1 : 0, ...result });
    } catch (e) {
      res.status(500).json({ status: 0, valid: false, error: e.message });
    }
  });
  app.get('/api/iap/health', (_req, res) => {
    res.json({ ok: true, package: PACKAGE, product: PRO_PRODUCT, saConfigured: !!resolveSA() });
  });
  console.log('💳 Arthika IAP verify route mounted at /api/iap/verify');
}

module.exports = { registerIapRoutes, verifyProduct };
