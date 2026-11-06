// Arthika Learn — lesson content and the 3D model that stands on each right-hand page.
// Every model is built from primitives, so the book needs no asset downloads.
import * as THREE from 'three';

/* ---------- number formatting (Indian grouping, lakh / crore) ---------- */
const nf0 = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
const nf2 = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 2 });
export const inr = (n) => '₹' + nf0.format(Math.round(n));
export const inr2 = (n) => '₹' + nf2.format(n);
export function inrShort(n) {
  const a = Math.abs(n), s = n < 0 ? '−' : '';
  if (a >= 1e7) return `${s}₹${(a / 1e7).toFixed(a >= 1e9 ? 0 : 2)} Cr`;
  if (a >= 1e5) return `${s}₹${(a / 1e5).toFixed(2)} L`;
  return s + inr(a);
}
const pct = (n, d = 1) => `${n.toFixed(d)}%`;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));

/* ---------- small deterministic RNG ---------- */
function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function gauss(r) { let u = 0, v = 0; while (u === 0) u = r(); v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
const hash = (a, b) => { const r = rng(a * 7919 + b * 104729 + 17); return r(); };

/* ---------- shared materials & helpers ---------- */
const M = {
  gold: () => new THREE.MeshStandardMaterial({ color: 0xd9a63c, metalness: 0.85, roughness: 0.32 }),
  emerald: () => new THREE.MeshStandardMaterial({ color: 0x23a26f, metalness: 0.55, roughness: 0.38 }),
  ruby: () => new THREE.MeshStandardMaterial({ color: 0xcf4b45, metalness: 0.25, roughness: 0.5 }),
  ink: () => new THREE.MeshStandardMaterial({ color: 0x2b2a33, metalness: 0.1, roughness: 0.7 }),
  paper: () => new THREE.MeshStandardMaterial({ color: 0xf6efe0, roughness: 0.9 }),
  matte: (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.75, metalness: 0.05 }),
};
const COIN_T = 0.13;
const coinGeo = new THREE.CylinderGeometry(0.5, 0.5, COIN_T, 30);

/** Many coin stacks drawn as one InstancedMesh. */
class CoinStacks {
  constructor(maxStacks, maxPer, material) {
    this.maxPer = maxPer;
    this.mesh = new THREE.InstancedMesh(coinGeo, material, maxStacks * maxPer);
    this.mesh.castShadow = true; this.mesh.receiveShadow = true;
    this.mesh.count = 0;
    this.owner = new Int16Array(maxStacks * maxPer);
    this.o = new THREE.Object3D();
  }
  /** stacks: [{x, z, y0, h, r}] — h in world units, turned into whole coins. */
  layout(stacks) {
    let n = 0; const o = this.o;
    stacks.forEach((s, i) => {
      const coins = Math.min(this.maxPer, Math.round(Math.max(0, s.h) / COIN_T));
      for (let k = 0; k < coins; k++) {
        const jx = (hash(i, k) - 0.5) * 0.07 * s.r * 2, jz = (hash(k, i + 99) - 0.5) * 0.07 * s.r * 2;
        o.position.set(s.x + jx, s.y0 + COIN_T * (k + 0.5), s.z + jz);
        o.rotation.set(0, hash(i + 3, k) * Math.PI, 0);
        o.scale.set(s.r * 2, 1, s.r * 2);
        o.updateMatrix();
        this.mesh.setMatrixAt(n, o.matrix); this.owner[n] = i; n++;
      }
    });
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.computeBoundingSphere();
  }
}

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

/* =====================================================================
   LESSONS
   Each lesson: page copy (left), a figure caption + controls (right),
   readouts(state) and build(ctx) -> { group, update(state), tick(dt, t) }.
   ctx = { Y, A:{x0,x1,z0,z1}, label(n, text, pos), tag(html, pos, cls) }
   ===================================================================== */

export const LESSONS = [
/* ------------------------------------------------------------------ 1 */
{
  id: 'inflation', short: 'Inflation', title: 'Why ₹100 slowly shrinks',
  kicker: 'Lesson 1 · The silent tax',
  paras: [
    'Prices rise a little every year. That rise is <b>inflation</b>. The note in your wallet still says ₹100, but each year it buys a little less.',
    'So the real question is never “how many rupees do I have?” It is “<i>what can those rupees buy?</i>” Money parked at 0% loses ground every single year.',
  ],
  formula: { html: 'Real value = <span class="frac"><span>₹100</span><span>(1 + <i>i</i>)<sup><i>t</i></sup></span></span>', legend: ['<i>i</i> — inflation rate per year', '<i>t</i> — number of years'] },
  ideas: ['India’s consumer inflation has averaged roughly 5–6% a year over the last decade.', 'Rule of 72: prices double in about 72 ÷ <i>i</i> years.', 'To grow wealth, your return must beat inflation — after tax.'],
  quiz: { q: 'Inflation is 6%. Your savings account pays 3%. After a year, can your money buy more or less?', options: ['More', 'The same', 'Less'], correct: 2,
    explain: 'Less. You have more rupees, but prices rose faster. Real return = 1.03 ÷ 1.06 − 1 ≈ <b>−2.8%</b> a year.' },
  caption: 'Fig 1. ① a ₹100 note ② the basket it bought in year 0 ③ items it can no longer afford',
  hint: 'Slide the years forward and watch the basket empty.',
  controls: [
    { key: 'i', label: 'Inflation per year', min: 1, max: 12, step: 0.5, value: 6, fmt: (v) => pct(v) },
    { key: 't', label: 'Years from now', min: 0, max: 30, step: 1, value: 10, fmt: (v) => `${v} yrs` },
  ],
  readouts(s) {
    const f = Math.pow(1 + s.i / 100, s.t);
    return [['₹100 is really worth', inr(100 / f)], ['Today’s ₹100 basket will cost', inr(100 * f)], ['Prices double every', `≈ ${(72 / s.i).toFixed(1)} yrs`]];
  },
  build(ctx) {
    const { Y } = ctx, g = new THREE.Group();
    // the ₹100 note (lavender, like the current series)
    const noteTex = canvasTex(700, 330, (c, w, h) => {
      c.fillStyle = '#b7a2d4'; c.fillRect(0, 0, w, h);
      c.strokeStyle = '#7d63a8'; c.lineWidth = 10; c.strokeRect(14, 14, w - 28, h - 28);
      c.strokeStyle = 'rgba(80,50,120,.25)'; c.lineWidth = 2;
      for (let k = 0; k < 14; k++) { c.beginPath(); c.ellipse(500, 165, 40 + k * 9, 30 + k * 7, 0, 0, 7); c.stroke(); }
      c.fillStyle = '#3d2766'; c.font = '700 120px Fraunces, serif'; c.fillText('₹100', 44, 200);
      c.font = '600 26px "DM Sans", sans-serif'; c.fillText('ONE HUNDRED RUPEES', 50, 262);
      c.font = '600 22px "DM Sans", sans-serif'; c.fillText('ARTHIKA LEARN · SPECIMEN', 50, 296);
    });
    const note = new THREE.Mesh(new THREE.BoxGeometry(6.6, 0.06, 3.1), [M.matte(0xb7a2d4), M.matte(0xb7a2d4), new THREE.MeshStandardMaterial({ map: noteTex, roughness: 0.85 }), M.matte(0xa894c8), M.matte(0xb7a2d4), M.matte(0xb7a2d4)]);
    note.position.set(5.3, Y + 0.05, -7.5); note.rotation.y = 0.18; note.castShadow = true; g.add(note);
    const note2 = note.clone(); note2.position.set(5.0, Y + 0.12, -7.3); note2.rotation.y = 0.05; g.add(note2);

    // 20 groceries: sacks, milk, onions, soap, tea tins
    const kinds = [
      () => new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.7, 1.5, 14), M.matte(0xd8c49a)),        // rice sack
      () => new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.5, 0.8), M.matte(0xf2f2ee)),                   // milk
      () => new THREE.Mesh(new THREE.SphereGeometry(0.55, 18, 14), M.matte(0xa2425a)),                // onion
      () => new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.55, 0.7), M.matte(0x3fa7a0)),                  // soap
      () => new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1.1, 18), M.matte(0xc4572e)),         // tea tin
    ];
    const items = [];
    for (let k = 0; k < 20; k++) {
      const m = kinds[k % 5](); m.castShadow = true;
      m.material = m.material.clone(); m.material.transparent = true;
      m.geometry.computeBoundingBox(); const hgt = m.geometry.boundingBox.max.y - m.geometry.boundingBox.min.y;
      const col = k % 5, row = Math.floor(k / 5);
      m.userData = { base: Y + hgt / 2, op: 1, sink: 0 };
      m.position.set(10.2 + col * 1.9, Y + hgt / 2, -12 + row * 2.1);
      m.userData.tip = () => (k < this._n ? 'Still affordable' : 'Priced out by inflation');
      items.push(m); g.add(m);
    }
    const tray = new THREE.Mesh(new THREE.BoxGeometry(10.4, 0.12, 9.2), M.matte(0xe6dcc6)); tray.position.set(14, Y + 0.06, -7.85); tray.receiveShadow = true; g.add(tray);
    items.forEach((m) => { m.userData.base += 0.12; });

    g.add(ctx.label(1, 'a ₹100 note', new THREE.Vector3(3.2, Y + 0.5, -9.4)));
    g.add(ctx.label(2, 'the basket it bought in year 0', new THREE.Vector3(14, Y + 2.4, -12.8)));
    const l3 = ctx.label(3, 'what it can no longer buy', new THREE.Vector3(17.8, Y + 2.2, -3.6)); g.add(l3);
    const tag = ctx.tag('', new THREE.Vector3(5.3, Y + 2.6, -7.5), 'big'); g.add(tag.obj);
    const self = this;
    return {
      group: g,
      update(s) {
        const f = Math.pow(1 + s.i / 100, s.t), n = Math.round(20 / f);
        self._n = n;
        items.forEach((m, k) => { m.userData.op = k < n ? 1 : 0.13; m.userData.sink = k < n ? 0 : 0.35; });
        tag.set(`buys <b>${n} of 20</b> items<br><small>after ${s.t} yrs at ${pct(s.i)}</small>`);
        l3.visible = n < 20;
      },
      tick(dt, t) {
        items.forEach((m, k) => {
          m.material.opacity = damp(m.material.opacity, m.userData.op, 6, dt);
          m.material.depthWrite = m.material.opacity > 0.6;
          m.position.y = damp(m.position.y, m.userData.base - m.userData.sink, 6, dt);
          if (m.userData.op === 1) m.rotation.y = Math.sin(t * 0.8 + k) * 0.06;
        });
        note.position.y = Y + 0.05 + Math.sin(t * 1.3) * 0.02;
      },
    };
  },
},

/* ------------------------------------------------------------------ 2 */
{
  id: 'compounding', short: 'Compounding', title: 'Money that makes money',
  kicker: 'Lesson 2 · The eighth wonder',
  paras: [
    'Invest ₹1 lakh at 12% and in year one it earns ₹12,000. In year two it earns 12% on <b>₹1.12 lakh</b> — growth starts earning growth.',
    'Early on the curve looks flat. Then it bends upward. The single biggest ingredient isn’t the rate — it’s <i>time</i>.',
  ],
  formula: { html: '<i>A</i> = <i>P</i> × (1 + <i>r</i>)<sup><i>t</i></sup>', legend: ['<i>P</i> — the amount you invest', '<i>r</i> — yearly return', '<i>t</i> — years invested'] },
  ideas: ['Gold coins are your money; green coins are growth.', 'White dots show simple interest — growth on the original only.', 'Doubling time ≈ 72 ÷ rate.'],
  quiz: { q: 'At 12% a year, roughly how long does money take to double?', options: ['About 6 years', 'About 8 years', 'About 12 years'], correct: 0,
    explain: '72 ÷ 12 = <b>6 years</b>. The exact answer is ln 2 ÷ ln 1.12 ≈ 6.1 years.' },
  caption: 'Fig 2. One stack per year: ① your money ② growth on growth ③ simple interest, for comparison',
  hint: 'Stretch the years — the last few stacks grow fastest.',
  controls: [
    { key: 'P', label: 'You invest once', min: 10000, max: 1000000, step: 10000, value: 100000, fmt: inrShort },
    { key: 'r', label: 'Return per year', min: 1, max: 18, step: 0.5, value: 12, fmt: (v) => pct(v) },
    { key: 't', label: 'Years invested', min: 1, max: 40, step: 1, value: 20, fmt: (v) => `${v} yrs` },
  ],
  readouts(s) {
    const A = s.P * Math.pow(1 + s.r / 100, s.t);
    return [['Final value', inrShort(A)], ['Growth earned', inrShort(A - s.P)], ['Multiple', `${(A / s.P).toFixed(1)}×`], ['vs simple interest', inrShort(s.P * (1 + s.r / 100 * s.t))]];
  },
  build(ctx) {
    const { Y } = ctx, g = new THREE.Group();
    const gold = new CoinStacks(40, 80, M.gold()), green = new CoinStacks(40, 80, M.emerald());
    g.add(gold.mesh, green.mesh);
    const dots = []; const dotMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x777777, roughness: 0.4 });
    for (let k = 0; k < 40; k++) { const d = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), dotMat); g.add(d); dots.push(d); }
    const bars = Array.from({ length: 40 }, () => ({ x: 10, ph: 0, gh: 0, sh: 0, on: 0 }));
    let target = [];
    const l1 = ctx.label(1, 'your money', new THREE.Vector3()), l2 = ctx.label(2, 'growth on growth', new THREE.Vector3()), l3 = ctx.label(3, 'simple interest', new THREE.Vector3());
    g.add(l1, l2, l3);
    const tag = ctx.tag('', new THREE.Vector3(), 'big'); g.add(tag.obj);
    const Z = -6, H = 10.5;
    let st = null;
    gold.mesh.userData.tip = (id) => { const i = gold.owner[id]; return yearTip(i); };
    green.mesh.userData.tip = (id) => { const i = green.owner[id]; return yearTip(i); };
    function yearTip(i) { if (!st) return ''; const v = st.P * Math.pow(1 + st.r / 100, i + 1); return `Year ${i + 1}: <b>${inrShort(v)}</b> (growth ${inrShort(v - st.P)})`; }
    return {
      group: g,
      update(s) {
        st = s;
        const final = s.P * Math.pow(1 + s.r / 100, s.t);
        const span = 17.2, gap = Math.min(1.25, span / s.t), x0 = 1.9 + (span - gap * (s.t - 1)) / 2;
        target = bars.map((_, i) => {
          if (i >= s.t) return { x: x0 + gap * i, ph: 0, gh: 0, sh: 0, on: 0 };
          const v = s.P * Math.pow(1 + s.r / 100, i + 1), simple = s.P * (1 + s.r / 100 * (i + 1));
          return { x: x0 + gap * i, ph: (s.P / final) * H, gh: ((v - s.P) / final) * H, sh: (simple / final) * H, on: 1 };
        });
        this.r = Math.min(0.42, gap * 0.42);
        tag.set(`<b>${inrShort(final)}</b><br><small>after ${s.t} years</small>`);
      },
      tick(dt) {
        const r = this.r || 0.4;
        bars.forEach((b, i) => { const t = target[i]; if (!t) return; b.x = damp(b.x, t.x, 7, dt); b.ph = damp(b.ph, t.ph, 5, dt); b.gh = damp(b.gh, t.gh, 4 - i * 0.04, dt); b.sh = damp(b.sh, t.sh, 5, dt); b.on = t.on; });
        const live = bars.filter((b) => b.on);
        gold.layout(live.map((b) => ({ x: b.x, z: Z, y0: Y, h: b.ph, r })));
        green.layout(live.map((b) => ({ x: b.x, z: Z, y0: Y + Math.round(b.ph / COIN_T) * COIN_T, h: b.gh, r })));
        dots.forEach((d, i) => { const b = bars[i]; d.visible = !!b.on; d.position.set(b.x, Y + b.sh + 0.15, Z + r + 0.35); });
        if (live.length) {
          const f = live[0], l = live[live.length - 1];
          l1.position.set(f.x - 0.4, Y + f.ph * 0.5 + 0.3, Z + 1.6);
          l2.position.set(l.x - 1.4, Y + l.ph + l.gh * 0.55, Z - 1.4);
          const mid = live[Math.floor(live.length * 0.7)];
          l3.position.set(mid.x + 0.3, Y + mid.sh + 0.4, Z + 2.4);
          tag.obj.position.set(l.x - 0.6, Y + l.ph + l.gh + 1.2, Z);
        }
      },
    };
  },
},

/* ------------------------------------------------------------------ 3 */
{
  id: 'sip', short: 'SIP', title: 'SIPs and rupee-cost averaging',
  kicker: 'Lesson 3 · Investing on autopilot',
  paras: [
    'A <b>SIP</b> (systematic investment plan) invests a fixed amount every month, whatever the market is doing.',
    'When prices fall, the same ₹5,000 buys <i>more</i> units. When they rise, it buys fewer. So your average cost per unit ends up at or below the average price.',
  ],
  formula: { html: 'Units = <span class="frac"><span>SIP amount</span><span>Price that month</span></span>', legend: ['Average cost = total invested ÷ total units', 'This is a harmonic mean, never above the plain average price'] },
  ideas: ['Swings stop being scary: low months are discount months.', 'It removes the urge to time the market.', 'Averaging lowers your cost — it does not guarantee a profit.'],
  quiz: { q: 'Over the year, how does your average cost per unit compare with the average market price?', options: ['Higher', 'Lower or equal', 'Always identical'], correct: 1,
    explain: '<b>Lower or equal.</b> You bought more units in cheap months. They’re equal only if the price never moved.' },
  caption: 'Fig 3. ① the price each month ② units your SIP bought ③ your average cost ④ the average price',
  hint: 'Turn up the market swings, then press “New market”.',
  controls: [
    { key: 'sip', label: 'Monthly SIP', min: 500, max: 50000, step: 500, value: 5000, fmt: inr },
    { key: 'vol', label: 'Market swings (yearly)', min: 0, max: 45, step: 1, value: 22, fmt: (v) => pct(v, 0) },
    { key: 'seed', type: 'button', label: 'New market ↻', value: 7 },
  ],
  prices(s) {
    const r = rng(s.seed * 31 + 5), out = []; let p = 100; const mv = s.vol / 100 / Math.sqrt(12);
    for (let m = 0; m < 12; m++) { if (m) p = clamp(p * Math.exp(mv * gauss(r) - mv * mv / 2), 25, 300); out.push(p); }
    return out;
  },
  stats(s) {
    const p = this.prices(s), units = p.map((x) => s.sip / x), U = units.reduce((a, b) => a + b, 0), inv = s.sip * 12;
    return { p, units, U, inv, avgCost: inv / U, avgPrice: p.reduce((a, b) => a + b, 0) / 12, value: U * p[11] };
  },
  readouts(s) {
    const k = this.stats(s), pl = k.value - k.inv;
    return [['Invested', inr(k.inv)], ['Your average cost', inr2(k.avgCost)], ['Average price', inr2(k.avgPrice)], ['Value at month 12', `${inr(k.value)} <small class="${pl >= 0 ? 'up' : 'dn'}">${pl >= 0 ? '+' : ''}${inr(pl)}</small>`]];
  },
  build(ctx) {
    const { Y } = ctx, g = new THREE.Group(), L = this;
    const stacks = new CoinStacks(12, 70, M.gold()); g.add(stacks.mesh);
    const xs = Array.from({ length: 12 }, (_, m) => 2.6 + m * 1.48);
    const ZB = -3.2, ZP = -10.5;
    const lineMat = new THREE.MeshStandardMaterial({ color: 0x2f6fd6, roughness: 0.35, metalness: 0.2, emissive: 0x0d2a5a });
    let tube = null;
    const pts = xs.map(() => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 12), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 })); m.castShadow = true; g.add(m); return m; });
    const bar = (c) => { const m = new THREE.Mesh(new THREE.BoxGeometry(17.6, 0.08, 0.08), new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.35 })); g.add(m); return m; };
    const costLine = bar(0x18a36b), priceLine = bar(0x8a8a96);
    // faint back panel so the price chart reads as a chart
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(18.4, 9.6), new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, roughness: 1 }));
    panel.position.set(10.75, Y + 5.6, ZP - 0.6); g.add(panel);
    const months = 'JFMAMJJASOND';
    xs.forEach((x, m) => g.add(ctx.tag(months[m], new THREE.Vector3(x, Y + 0.05, ZB + 1.25), 'axis').obj));
    const l1 = ctx.label(1, 'price each month', new THREE.Vector3()), l2 = ctx.label(2, 'units bought', new THREE.Vector3(xs[0] - 0.9, Y + 1.2, ZB + 1.6));
    const l3 = ctx.label(3, 'your average cost', new THREE.Vector3()), l4 = ctx.label(4, 'average price', new THREE.Vector3());
    g.add(l1, l2, l3, l4);
    let cur = xs.map(() => 0), tgt = xs.map(() => 0), py = xs.map(() => Y + 5), pyT = xs.map(() => Y + 5), k = null;
    const yOf = (price, lo, hi) => Y + 1.6 + ((price - lo) / Math.max(1, hi - lo)) * 7.4;
    stacks.mesh.userData.tip = (id) => { const m = stacks.owner[id]; return k ? `${'Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split(' ')[m]}: price ${inr2(k.p[m])} → <b>${k.units[m].toFixed(1)} units</b>` : ''; };
    pts.forEach((p, m) => { p.userData.tip = () => (k ? `Price in ${'Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split(' ')[m]}: <b>${inr2(k.p[m])}</b>` : ''); });
    let lo = 60, hi = 140;
    return {
      group: g,
      update(s) {
        k = L.stats(s);
        const maxU = Math.max(...k.units);
        tgt = k.units.map((u) => (u / maxU) * 6.2);
        lo = Math.min(...k.p, k.avgCost) * 0.92; hi = Math.max(...k.p) * 1.06; if (hi - lo < 30) { const c = (hi + lo) / 2; lo = c - 15; hi = c + 15; }
        pyT = k.p.map((p) => yOf(p, lo, hi));
      },
      tick(dt) {
        cur = cur.map((c, m) => damp(c, tgt[m], 6, dt));
        stacks.layout(cur.map((h, m) => ({ x: xs[m], z: ZB, y0: Y, h, r: 0.5 })));
        py = py.map((v, m) => damp(v, pyT[m], 6, dt));
        const curve = new THREE.CatmullRomCurve3(xs.map((x, m) => new THREE.Vector3(x, py[m], ZP)));
        if (tube) { g.remove(tube); tube.geometry.dispose(); }
        tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 96, 0.11, 8), lineMat); tube.castShadow = true; g.add(tube);
        pts.forEach((p, m) => p.position.set(xs[m], py[m], ZP));
        if (k) {
          const yc = yOf(k.avgCost, lo, hi), yp = yOf(k.avgPrice, lo, hi);
          costLine.position.set(10.75, damp(costLine.position.y || yc, yc, 6, dt), ZP + 0.05);
          priceLine.position.set(10.75, damp(priceLine.position.y || yp, yp, 6, dt), ZP + 0.05);
          l3.position.set(19.6, costLine.position.y - 0.35, ZP);
          l4.position.set(19.6, priceLine.position.y + 0.45, ZP);
          const top = py.indexOf(Math.max(...py)); l1.position.set(xs[top], py[top] + 0.9, ZP);
        }
      },
    };
  },
},

/* ------------------------------------------------------------------ 4 */
{
  id: 'price', short: 'Share prices', title: 'Who decides a share’s price?',
  kicker: 'Lesson 4 · The order book',
  paras: [
    'A share is a small slice of a company. On the NSE, its price isn’t set by the company — it’s set by <b>buyers and sellers</b> placing orders.',
    'Buyers want low prices; sellers want high ones. The trade happens where <i>shares wanted</i> equals <i>shares offered</i>. Good news shifts the buyers, and the price moves to a new meeting point.',
  ],
  formula: { html: 'Price settles where <i>D</i>(<i>p</i>) = <i>S</i>(<i>p</i>)', legend: ['<i>D</i>(<i>p</i>) — shares buyers want at price <i>p</i>', '<i>S</i>(<i>p</i>) — shares sellers offer at price <i>p</i>'] },
  ideas: ['Green stacks fall as the price rises — fewer buyers at high prices.', 'Red stacks rise — more sellers are tempted.', 'News, results and mood shift whole stacks, not single orders.'],
  quiz: { q: 'Great quarterly results: many more people want to buy, and no new sellers appear. What happens?', options: ['Price falls', 'Price rises', 'Nothing changes'], correct: 1,
    explain: '<b>The price rises</b> until enough sellers are tempted to sell, at a new level where buying and selling quantities match again.' },
  caption: 'Fig 4. At each price: ① buyers wanting shares ② sellers offering shares ③ where they meet',
  hint: 'Make buyers eager, then make sellers nervous.',
  controls: [
    { key: 'd', label: 'Buyers’ mood', min: -4, max: 4, step: 0.5, value: 0, fmt: mood },
    { key: 's', label: 'Sellers’ mood', min: -4, max: 4, step: 0.5, value: 0, fmt: mood },
  ],
  eq(s) { const p = 100 + (8 * s.d - 8 * s.s) / 6; return { p, q: this.D(p, s) }; },
  D: (p, s) => Math.max(0, 60 + 8 * s.d - 3 * (p - 100)),
  S: (p, s) => Math.max(0, 60 + 8 * s.s + 3 * (p - 100)),
  readouts(s) { const e = this.eq(s); return [['Price settles at', inr2(e.p)], ['Shares traded', `${nf0.format(e.q * 1000)}`], ['Change from ₹100', `<span class="${e.p >= 100 ? 'up' : 'dn'}">${e.p >= 100 ? '+' : ''}${(e.p - 100).toFixed(2)}%</span>`]]; },
  build(ctx) {
    const { Y } = ctx, g = new THREE.Group(), L = this;
    const levels = Array.from({ length: 13 }, (_, k) => 88 + k * 2);
    const xOf = (p) => 2.4 + ((p - 88) / 24) * 16.6;
    const geo = new THREE.BoxGeometry(0.5, 1, 0.9); geo.translate(0, 0.5, 0);
    const mk = (mat, dx) => levels.map((p) => { const m = new THREE.Mesh(geo, mat); m.position.set(xOf(p) + dx, Y, -6); m.scale.y = 0.01; m.castShadow = true; m.receiveShadow = true; g.add(m); return m; });
    const greenM = new THREE.MeshStandardMaterial({ color: 0x1f9d6b, roughness: 0.45, metalness: 0.15 }), redM = new THREE.MeshStandardMaterial({ color: 0xd2524b, roughness: 0.45, metalness: 0.15 });
    const buy = mk(greenM, -0.3), sell = mk(redM, 0.3);
    let st = null;
    buy.forEach((m, k) => { m.userData.tip = () => (st ? `At ₹${levels[k]}: buyers want <b>${nf0.format(L.D(levels[k], st) * 1000)}</b> shares` : ''); });
    sell.forEach((m, k) => { m.userData.tip = () => (st ? `At ₹${levels[k]}: sellers offer <b>${nf0.format(L.S(levels[k], st) * 1000)}</b> shares` : ''); });
    levels.forEach((p, k) => { if (k % 2 === 0) g.add(ctx.tag(`₹${p}`, new THREE.Vector3(xOf(p), Y + 0.05, -4.6), 'axis').obj); });
    // the meeting point: a glowing pane + price tag
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 9), new THREE.MeshBasicMaterial({ color: 0xf2b53c, transparent: true, opacity: 0.9 }));
    pane.position.set(10, Y + 4.5, -6); g.add(pane);
    const halo = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 9), new THREE.MeshBasicMaterial({ color: 0xf2b53c, transparent: true, opacity: 0.12, depthWrite: false }));
    halo.position.copy(pane.position); g.add(halo);
    const tag = ctx.tag('', new THREE.Vector3(), 'big'); g.add(tag.obj);
    const l1 = ctx.label(1, 'buyers', new THREE.Vector3(xOf(88) - 0.6, Y + 6.6, -6)), l2 = ctx.label(2, 'sellers', new THREE.Vector3(xOf(112) + 0.6, Y + 6.6, -6)), l3 = ctx.label(3, 'price settles here', new THREE.Vector3());
    g.add(l1, l2, l3);
    let tb = [], ts = [], tx = 10;
    const scale = 0.072;
    return {
      group: g,
      update(s) {
        st = s; const e = L.eq(s);
        tb = levels.map((p) => L.D(p, s) * scale); ts = levels.map((p) => L.S(p, s) * scale); tx = xOf(clamp(e.p, 87, 113));
        tag.set(`<b>${inr2(e.p)}</b><br><small>${nf0.format(e.q * 1000)} shares change hands</small>`);
      },
      tick(dt, t) {
        buy.forEach((m, k) => { m.scale.y = Math.max(0.01, damp(m.scale.y, tb[k] || 0.01, 6, dt)); });
        sell.forEach((m, k) => { m.scale.y = Math.max(0.01, damp(m.scale.y, ts[k] || 0.01, 6, dt)); });
        pane.position.x = halo.position.x = damp(pane.position.x, tx, 5, dt);
        halo.material.opacity = 0.1 + Math.sin(t * 3) * 0.04;
        tag.obj.position.set(pane.position.x, Y + 9.6, -6);
        l3.position.set(pane.position.x + 0.2, Y + 0.5, -2.8);
      },
    };
  },
},

/* ------------------------------------------------------------------ 5 */
{
  id: 'pe', short: 'P/E ratio', title: 'Reading the price tag: P/E',
  kicker: 'Lesson 5 · Valuation',
  paras: [
    'A share price alone tells you little. ₹2,000 can be cheap and ₹50 can be expensive. What matters is what you get: the company’s <b>earnings</b>.',
    'The <b>P/E ratio</b> asks: how many years of today’s profit am I paying for? A P/E of 25 means the price equals 25 years of current earnings per share.',
  ],
  formula: { html: 'P/E = <span class="frac"><span>Share price</span><span>Earnings per share (EPS)</span></span>', legend: ['Earnings yield = EPS ÷ Price = 1 ÷ (P/E)', 'Compare P/E within the same industry'] },
  ideas: ['High P/E: the market expects fast growth (or is over-excited).', 'Low P/E: cheap, slow-growing — or in trouble.', 'P/E is a question to investigate, not a verdict.'],
  quiz: { q: 'Two shares both cost ₹500. A earns ₹50 a share, B earns ₹10. Which is cheaper on P/E?', options: ['A (P/E 10)', 'B (P/E 50)', 'Same — both cost ₹500'], correct: 0,
    explain: '<b>A</b>: 500 ÷ 50 = P/E 10, against B’s 50. But B could still be the better business if its earnings grow far faster.' },
  caption: 'Fig 5. ① the company earns EPS each year ② each coin is one year of today’s earnings ③ the price you pay',
  hint: 'Raise the P/E: you’re paying for more years of profit up front.',
  controls: [
    { key: 'eps', label: 'Earnings per share', min: 5, max: 200, step: 5, value: 40, fmt: inr },
    { key: 'pe', label: 'P/E the market pays', min: 4, max: 80, step: 1, value: 25, fmt: (v) => `${v}×` },
  ],
  readouts(s) { return [['Share price', inr(s.eps * s.pe)], ['Earnings yield', pct(100 / s.pe, 2)], ['Payback at today’s profit', `${s.pe} yrs`]]; },
  build(ctx) {
    const { Y } = ctx, g = new THREE.Group();
    // a small company building
    const bldg = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(3, 3.6, 2.6), M.matte(0xe9e1d0)); body.position.y = 1.8; body.castShadow = true;
    const roof = new THREE.Mesh(new THREE.ConeGeometry(2.4, 1.4, 4), M.matte(0x2f3e5c)); roof.position.y = 4.3; roof.rotation.y = Math.PI / 4; roof.castShadow = true;
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.3, 0.05), M.matte(0x2f3e5c)); door.position.set(0, 0.65, 1.31);
    bldg.add(body, roof, door);
    for (let w = 0; w < 4; w++) { const win = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.05), new THREE.MeshStandardMaterial({ color: 0xffd98a, emissive: 0xffb84a, emissiveIntensity: 0.6 })); win.position.set(-0.7 + (w % 2) * 1.4, 2.2 + Math.floor(w / 2) * 1.0, 1.31); bldg.add(win); }
    bldg.position.set(3.8, Y, -9.5); g.add(bldg);
    const coins = new THREE.InstancedMesh(coinGeo, M.gold(), 80); coins.castShadow = true; g.add(coins);
    const o = new THREE.Object3D();
    const flyer = new THREE.Mesh(coinGeo, M.gold()); flyer.castShadow = true; g.add(flyer);
    let n = 25, shown = 0, r = 0.45, st = null;
    coins.userData.tip = (id) => (st ? `Year ${id + 1} of today’s earnings: <b>${inr(st.eps)}</b>` : '');
    const tag = ctx.tag('', new THREE.Vector3(13.2, Y + 4.2, -7.5), 'big'); g.add(tag.obj);
    g.add(ctx.label(1, 'earns EPS every year', new THREE.Vector3(3.8, Y + 5.6, -9.5)));
    const l2 = ctx.label(2, 'one coin = one year', new THREE.Vector3(8.0, Y + 1, -0.9)); g.add(l2);
    const pos = (k) => new THREE.Vector3(8 + (k % 10) * 1.2, Y + COIN_T / 2, -12.4 + Math.floor(k / 10) * 1.25);
    let fly = 0;
    return {
      group: g,
      update(s) { st = s; n = s.pe; r = 0.3 + Math.min(1, s.eps / 200) * 0.25; tag.set(`Price <b>${inr(s.eps * s.pe)}</b><br><small>= ${s.pe} years × ${inr(s.eps)}</small>`); },
      tick(dt, t) {
        shown = damp(shown, n, 5, dt);
        const k = Math.round(shown);
        for (let i = 0; i < 80; i++) {
          const p = pos(i), lift = i < k ? 0 : -3;
          o.position.set(p.x, p.y + Math.max(0, Math.sin(t * 2 + i * 0.35)) * 0.04, p.z);
          o.scale.set(r * 2, 1, r * 2); o.rotation.set(0, i, 0); o.updateMatrix();
          coins.setMatrixAt(i, o.matrix);
          if (lift) { o.scale.set(0.0001, 0.0001, 0.0001); o.updateMatrix(); coins.setMatrixAt(i, o.matrix); }
        }
        coins.count = 80; coins.instanceMatrix.needsUpdate = true; coins.computeBoundingSphere();
        // a coin hops from the company to the next free slot, every ~1.6 s
        fly = (fly + dt / 1.6) % 1;
        const a = new THREE.Vector3(3.8, Y + 3.2, -8.2), b = pos(Math.max(0, k - 1)).add(new THREE.Vector3(0, 0.25, 0));
        const p = a.clone().lerp(b, fly); p.y += Math.sin(fly * Math.PI) * 4;
        flyer.position.copy(p); flyer.rotation.set(fly * 9, 0, fly * 4); flyer.scale.set(r * 2, 1, r * 2); flyer.visible = fly < 0.97;
        l2.position.set(8 + 0.2, Y + 0.6, Math.min(-1.2, -12.4 + Math.floor((k - 1) / 10) * 1.25 + 1.6));
      },
    };
  },
},

/* ------------------------------------------------------------------ 6 */
{
  id: 'diversify', short: 'Diversification', title: 'Don’t put all your eggs in one basket',
  kicker: 'Lesson 6 · Risk',
  paras: [
    'A single stock can swing ±30% in a year. Own many, and their bad days and good days partly cancel. Your <b>portfolio</b> moves like their average — far calmer.',
    'But only up to a point. Stocks that move together (high <b>correlation</b>, ρ) don’t cancel much. Some market-wide risk always remains.',
  ],
  formula: { html: 'σ<sub><i>p</i></sub> = σ × √(ρ + (1 − ρ) ÷ <i>N</i>)', legend: ['σ — swing of one stock (here 30% a year)', 'ρ — how much stocks move together, 0 to 1', '<i>N</i> — number of stocks, equally weighted'] },
  ideas: ['Going from 1 to 10 stocks removes most of the avoidable risk.', 'The floor, σ√ρ, is market risk — it can’t be diversified away.', 'Mix sectors and asset types to lower ρ.'],
  quiz: { q: 'You own 30 stocks — all private banks. Are you well diversified?', options: ['Yes, 30 is plenty', 'Not really', 'Only if they’re large-caps'], correct: 1,
    explain: '<b>Not really.</b> Banks move together (high ρ), so risk stays close to σ√ρ. Spread across sectors and assets.' },
  caption: 'Fig 6. ① each ball is one stock ② the gold ball is your portfolio, their average ③ its typical swing (±1σ) — the ring shows one stock’s',
  hint: 'Add stocks one by one, then raise the correlation.',
  controls: [
    { key: 'n', label: 'Stocks you own', min: 1, max: 30, step: 1, value: 1, fmt: (v) => `${v}` },
    { key: 'rho', label: 'Correlation ρ', min: 0, max: 1, step: 0.05, value: 0.3, fmt: (v) => v.toFixed(2) },
  ],
  sig: (s) => 30 * Math.sqrt(s.rho + (1 - s.rho) / s.n),
  readouts(s) { const sp = this.sig(s); return [['Portfolio swing σₚ', pct(sp)], ['One stock alone', '30.0%'], ['Floor (market risk)', pct(30 * Math.sqrt(s.rho))], ['Risk removed', pct((1 - sp / 30) * 100, 0)]]; },
  build(ctx) {
    const { Y } = ctx, g = new THREE.Group(), L = this;
    const AMP = 1.7, BASE = Y + 4.2, theta = 1.1, sStep = AMP * Math.sqrt(2 * theta);
    const stocks = [];
    for (let k = 0; k < 30; k++) {
      const col = k % 10, row = Math.floor(k / 10);
      const x = 2.6 + col * 1.75 + (row % 2) * 0.6, z = -12.6 + row * 1.9;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 8.4, 6), M.ink()); pole.position.set(x, Y + 4.2, z);
      const c = new THREE.Color().setHSL((k * 0.137) % 1, 0.55, 0.55);
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.32, 18, 14), new THREE.MeshStandardMaterial({ color: c, roughness: 0.35, metalness: 0.1 }));
      ball.castShadow = true; ball.position.set(x, BASE, z);
      const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.1, 14), M.ink()); foot.position.set(x, Y + 0.05, z);
      ball.userData.tip = () => `Stock ${k + 1}: ${(stocks[k].v / AMP * 30 >= 0 ? '+' : '')}${(stocks[k].v / AMP * 30).toFixed(0)}% vs its average`;
      g.add(pole, ball, foot); stocks.push({ v: gauss(rng(k + 1)) * AMP, ball, pole, foot, s: 0 });
    }
    // portfolio: big gold ball on its own post, with a ±1σ band and a single-stock ring for comparison
    const PX = 10.6, PZ = -3.2;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 9.2, 8), M.ink()); post.position.set(PX, Y + 4.6, PZ); g.add(post);
    const port = new THREE.Mesh(new THREE.SphereGeometry(0.7, 28, 20), M.gold()); port.castShadow = true; port.position.set(PX, BASE, PZ); g.add(port);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.15, 1, 40, 1, true), new THREE.MeshStandardMaterial({ color: 0xf2b53c, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }));
    band.position.set(PX, BASE, PZ); g.add(band);
    const ringGeo = new THREE.TorusGeometry(1.35, 0.03, 8, 48); const ringM = new THREE.MeshBasicMaterial({ color: 0xcf4b45 });
    const ringTop = new THREE.Mesh(ringGeo, ringM), ringBot = new THREE.Mesh(ringGeo, ringM);
    [ringTop, ringBot].forEach((r) => { r.rotation.x = Math.PI / 2; g.add(r); });
    ringTop.position.set(PX, BASE + AMP, PZ); ringBot.position.set(PX, BASE - AMP, PZ);
    port.userData.tip = () => `Portfolio: ${(pv / AMP * 30 >= 0 ? '+' : '')}${(pv / AMP * 30).toFixed(0)}% vs its average`;
    // a scrolling strip chart: portfolio (gold) vs stock 1 (red)
    const NPT = 140, mkLine = (c) => { const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NPT * 3), 3)); const l = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: c })); g.add(l); return l; };
    const lineS = mkLine(0xcf4b45), lineP = mkLine(0xb8860b);
    const histP = new Array(NPT).fill(0), histS = new Array(NPT).fill(0);
    const chartBg = new THREE.Mesh(new THREE.PlaneGeometry(13.6, 0.04), M.ink()); chartBg.rotation.x = -Math.PI / 2; chartBg.position.set(10.6, Y + 0.02, 1.4); g.add(chartBg);
    g.add(ctx.label(1, 'one stock', new THREE.Vector3(2.0, Y + 8.9, -12.6)));
    g.add(ctx.label(2, 'your portfolio', new THREE.Vector3(PX + 1.1, Y + 8.8, PZ)));
    const l3 = ctx.label(3, '±1σ swing', new THREE.Vector3()); g.add(l3);
    g.add(ctx.tag('<span style="color:#b8860b">━</span> portfolio <span style="color:#cf4b45">━</span> one stock', new THREE.Vector3(10.6, Y + 0.05, 2.3), 'axis').obj);
    let st = { n: 1, rho: 0.3 }, pv = 0, bandH = 2 * AMP, acc = 0;
    return {
      group: g,
      update(s) { st = s; stocks.forEach((k, i) => { k.on = i < s.n; }); },
      tick(dt, t) {
        acc += dt;
        const steps = Math.min(4, Math.floor(acc / (1 / 30))); acc -= steps / 30;
        const r = rng((t * 1000) | 0);
        for (let q = 0; q < steps; q++) {
          const h = 1 / 30, common = gauss(r);
          stocks.forEach((k) => { k.v += -theta * k.v * h + sStep * Math.sqrt(h) * (Math.sqrt(st.rho) * common + Math.sqrt(1 - st.rho) * gauss(r)); });
          const on = stocks.slice(0, st.n); pv = on.reduce((a, k) => a + k.v, 0) / on.length;
          histP.push(pv); histP.shift(); histS.push(stocks[0].v); histS.shift();
        }
        stocks.forEach((k) => {
          k.s = damp(k.s, k.on ? 1 : 0, 8, dt);
          const vis = k.s > 0.02; k.ball.visible = k.pole.visible = k.foot.visible = vis;
          k.ball.scale.setScalar(k.s); k.pole.scale.set(1, Math.max(0.01, k.s), 1); k.pole.position.y = Y + 4.2 * k.s;
          k.ball.position.y = BASE + k.v;
        });
        port.position.y = BASE + pv;
        bandH = damp(bandH, 2 * AMP * Math.sqrt(st.rho + (1 - st.rho) / st.n), 6, dt);
        band.scale.y = bandH; band.position.y = BASE;
        l3.position.set(PX + 1.3, BASE + bandH / 2, PZ);
        const write = (line, hist, sc) => { const a = line.geometry.attributes.position; for (let i = 0; i < NPT; i++) a.setXYZ(i, 3.8 + (i / (NPT - 1)) * 13.6, Y + 0.06, 1.4 - hist[i] * sc); a.needsUpdate = true; };
        write(lineS, histS, 0.42); write(lineP, histP, 0.42);
      },
    };
  },
},

/* ------------------------------------------------------------------ 7 */
{
  id: 'plan', short: 'Your plan', title: 'Cushion first, then growth',
  kicker: 'Lesson 7 · Putting it together',
  paras: [
    'First build an <b>emergency fund</b>: a few months of expenses, kept safe and instantly available — a savings account, sweep FD or liquid fund.',
    'Then split long-term money between <b>debt</b> for stability (FDs, PPF, bond funds) and <b>equity</b> for growth (index funds, stocks). A popular rule of thumb: equity ≈ 100 minus your age.',
  ],
  formula: { html: 'Cushion = monthly expenses × <i>months</i><br><span class="f2">Equity % ≈ 100 − age</span>', legend: ['3–6 months is typical; more if income is irregular', 'The age rule is a rough heuristic, not advice'] },
  ideas: ['Emergencies often arrive when markets are down — don’t be forced to sell.', 'Equity needs time: money for goals 5+ years away.', 'Rebalance once a year back to your chosen split.'],
  quiz: { q: 'Why keep the emergency fund out of the stock market?', options: ['Stocks are illegal for it', 'You may have to sell at a loss when you need it', 'Stocks never grow'], correct: 1,
    explain: 'Job losses and medical bills often coincide with market falls. A cushion means you <b>never have to sell low</b>.' },
  caption: 'Fig 7. ① emergency cushion — fill this first ② debt for stability ③ equity for long-term growth',
  hint: 'Set your expenses and age; watch the jars fill in order.',
  controls: [
    { key: 'exp', label: 'Monthly expenses', min: 10000, max: 200000, step: 5000, value: 40000, fmt: inrShort },
    { key: 'mo', label: 'Months of cushion', min: 3, max: 12, step: 1, value: 6, fmt: (v) => `${v} months` },
    { key: 'age', label: 'Your age', min: 20, max: 65, step: 1, value: 30, fmt: (v) => `${v}` },
  ],
  readouts(s) { const eq = 100 - s.age; return [['Emergency fund target', inr(s.exp * s.mo)], ['Equity share (rule of thumb)', pct(eq, 0)], ['Debt share', pct(100 - eq, 0)]]; },
  build(ctx) {
    const { Y } = ctx, g = new THREE.Group();
    const JH = 8.4, JR = 2.1;
    const glass = new THREE.MeshStandardMaterial({ color: 0xdfeef2, transparent: true, opacity: 0.2, roughness: 0.05, metalness: 0.1, side: THREE.DoubleSide, depthWrite: false });
    const rimM = new THREE.MeshStandardMaterial({ color: 0xbfd8de, roughness: 0.2, metalness: 0.3 });
    const jars = [
      { x: 4.9, c: 0x3a9cc9, name: 'Emergency' }, { x: 10.6, c: 0xd9a63c, name: 'Debt' }, { x: 16.3, c: 0x1f9d6b, name: 'Equity' },
    ].map((j, i) => {
      const z = -6.4;
      const shell = new THREE.Mesh(new THREE.CylinderGeometry(JR, JR, JH, 48, 1, true), glass); shell.position.set(j.x, Y + JH / 2, z);
      const bottom = new THREE.Mesh(new THREE.CylinderGeometry(JR, JR, 0.15, 48), rimM); bottom.position.set(j.x, Y + 0.075, z); bottom.receiveShadow = true;
      const rim = new THREE.Mesh(new THREE.TorusGeometry(JR, 0.07, 10, 60), rimM); rim.rotation.x = Math.PI / 2; rim.position.set(j.x, Y + JH, z);
      const lg = new THREE.CylinderGeometry(JR - 0.12, JR - 0.12, 1, 48); lg.translate(0, 0.5, 0);
      const liquid = new THREE.Mesh(lg, new THREE.MeshStandardMaterial({ color: j.c, roughness: 0.25, metalness: 0.05, transparent: true, opacity: 0.88 }));
      liquid.position.set(j.x, Y + 0.15, z); liquid.scale.y = 0.01; liquid.castShadow = true;
      const top = new THREE.Mesh(new THREE.CircleGeometry(JR - 0.12, 48), new THREE.MeshStandardMaterial({ color: new THREE.Color(j.c).offsetHSL(0, 0, 0.12), roughness: 0.15 }));
      top.rotation.x = -Math.PI / 2;
      g.add(shell, bottom, rim, liquid, top);
      const tag = ctx.tag('', new THREE.Vector3(j.x, Y + JH + 1.3, z), 'big'); g.add(tag.obj);
      liquid.userData.tip = () => j.tip || '';
      return { ...j, z, liquid, top, tag, fill: 0, target: 0 };
    });
    g.add(ctx.label(1, 'fill this first', new THREE.Vector3(4.9, Y + 0.6, -3.6)));
    g.add(ctx.label(2, 'stability', new THREE.Vector3(10.6, Y + 0.6, -3.6)));
    g.add(ctx.label(3, 'growth', new THREE.Vector3(16.3, Y + 0.6, -3.6)));
    // arrows between jars: the order of filling
    const arrowM = M.ink();
    [7.75, 13.45].forEach((x) => { const a = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.8, 12), arrowM); a.rotation.z = -Math.PI / 2; a.position.set(x, Y + 0.35, -6.4); g.add(a); });
    // a coin that drops into the emergency jar on a loop
    const coin = new THREE.Mesh(coinGeo, M.gold()); coin.scale.set(0.9, 1, 0.9); g.add(coin);
    return {
      group: g,
      update(s) {
        const eq = 100 - s.age;
        jars[0].target = s.mo / 12; jars[1].target = (100 - eq) / 100; jars[2].target = eq / 100;
        jars[0].tag.set(`<b>${inrShort(s.exp * s.mo)}</b><br><small>${s.mo} months</small>`);
        jars[1].tag.set(`<b>${100 - eq}%</b><br><small>debt</small>`);
        jars[2].tag.set(`<b>${eq}%</b><br><small>equity</small>`);
        jars[0].tip = `Emergency fund: ${inr(s.exp * s.mo)} (${s.mo} × ${inr(s.exp)})`;
        jars[1].tip = `Debt: ${100 - eq}% of long-term money`; jars[2].tip = `Equity: ${eq}% of long-term money`;
      },
      tick(dt, t) {
        jars.forEach((j, i) => {
          j.fill = damp(j.fill, j.target, 3 - i * 0.5, dt);
          const h = Math.max(0.01, j.fill * (JH - 0.5));
          j.liquid.scale.y = h;
          j.top.position.set(j.x, Y + 0.15 + h + Math.sin(t * 2.2 + i) * 0.03, j.z);
          j.top.rotation.z = Math.sin(t * 1.3 + i) * 0.03;
        });
        const p = (t % 2.4) / 2.4, j0 = jars[0];
        coin.position.set(j0.x + 0.3, Y + JH + 3 - p * p * (JH + 3 - (j0.fill * (JH - 0.5) + 0.3)), j0.z);
        coin.rotation.set(t * 3, 0, t * 2); coin.visible = p < 0.98;
      },
    };
  },
},
];

function mood(v) { return v === 0 ? 'neutral' : v > 0 ? `eager +${v}` : `nervous ${v}`; }
