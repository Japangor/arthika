// Arthika Learn — "Money, Explained": an interactive 3D book.
// Scene: a lamp-lit desk, an open book, HTML pages laid onto the paper (CSS3D),
// and a live 3D model standing on every right-hand page.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS3DRenderer, CSS3DObject } from 'three/addons/renderers/CSS3DRenderer.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { LESSONS } from './lessons.js?v=1';

const $ = (s) => document.querySelector(s);
const stage = $('#stage');
const store = {
  get(k, d) { try { const v = localStorage.getItem('arthika-learn:' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('arthika-learn:' + k, JSON.stringify(v)); } catch { /* private mode */ } },
};

/* ---------------- book geometry (world units ≈ cm) ---------------- */
const PW = 21, PD = 28, COVER = 0.25, STACK = 1.2;
const Y = COVER + STACK;               // top of the paper
const PX = 40;                         // HTML px per world unit on the page
const AREA = { x0: 1.5, x1: 19.5, z0: -13, z1: 2.5 };

/* ---------------- renderers ---------------- */
let webgl = true;
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
} catch { webgl = false; }

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(34, innerWidth / innerHeight, 0.5, 600);
const css3d = new CSS3DRenderer();
const css2d = new CSS2DRenderer();
const cssScene = new THREE.Scene();

if (webgl) {
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  stage.appendChild(renderer.domElement);
}
css3d.setSize(innerWidth, innerHeight); css3d.domElement.className = 'css3d'; stage.appendChild(css3d.domElement);
css2d.setSize(innerWidth, innerHeight); css2d.domElement.className = 'css2d'; stage.appendChild(css2d.domElement);

const controls = new OrbitControls(camera, webgl ? renderer.domElement : css3d.domElement);
controls.enableDamping = true; controls.dampingFactor = 0.08;
controls.minDistance = 14; controls.maxDistance = 220;
controls.minPolarAngle = 0.12; controls.maxPolarAngle = 1.32;
controls.screenSpacePanning = true;

/* ---------------- textures drawn on canvas ---------------- */
function tex(w, h, draw, repeat) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  if (webgl) t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); }
  return t;
}
const woodTex = tex(1024, 1024, (c, w, h) => {
  const planks = 5, ph = h / planks;
  for (let p = 0; p < planks; p++) {
    const base = [[104, 66, 38], [112, 72, 41], [98, 61, 35], [109, 69, 40], [101, 64, 37]][p];
    c.fillStyle = `rgb(${base})`; c.fillRect(0, p * ph, w, ph);
    for (let k = 0; k < 140; k++) {
      const y = p * ph + Math.random() * ph, a = 0.04 + Math.random() * 0.09;
      c.strokeStyle = Math.random() < 0.5 ? `rgba(40,22,10,${a})` : `rgba(170,120,75,${a * 0.7})`;
      c.lineWidth = 0.6 + Math.random() * 2.2; c.beginPath();
      const f = 0.004 + Math.random() * 0.01, amp = 1 + Math.random() * 5, ph0 = Math.random() * 9;
      for (let x = 0; x <= w; x += 8) c.lineTo(x, y + Math.sin(x * f + ph0) * amp);
      c.stroke();
    }
    c.fillStyle = 'rgba(25,12,5,.55)'; c.fillRect(0, p * ph, w, 2.5);
  }
}, [3, 2]);
function paperTex(spineOnRight) {
  return tex(512, 683, (c, w, h) => {
    c.fillStyle = '#f4ecdb'; c.fillRect(0, 0, w, h);
    const img = c.getImageData(0, 0, w, h), d = img.data;
    for (let i = 0; i < d.length; i += 4) { const n = (Math.random() - 0.5) * 9; d[i] += n; d[i + 1] += n; d[i + 2] += n * 0.8; }
    c.putImageData(img, 0, 0);
    const gx = spineOnRight ? w : 0, g = c.createLinearGradient(gx, 0, spineOnRight ? w - 70 : 70, 0);
    g.addColorStop(0, 'rgba(90,60,30,.32)'); g.addColorStop(0.35, 'rgba(90,60,30,.10)'); g.addColorStop(1, 'rgba(90,60,30,0)');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    const e = c.createRadialGradient(w / 2, h / 2, h * 0.35, w / 2, h / 2, h * 0.8);
    e.addColorStop(0, 'rgba(0,0,0,0)'); e.addColorStop(1, 'rgba(110,80,40,.12)');
    c.fillStyle = e; c.fillRect(0, 0, w, h);
  });
}
const edgeTex = tex(64, 256, (c, w, h) => {
  c.fillStyle = '#eadfc8'; c.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 2) { c.fillStyle = `rgba(120,95,60,${0.08 + Math.random() * 0.1})`; c.fillRect(0, y, w, 1); }
});
function drawCover(c, w, h) {
  const g = c.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#1b2b4a'); g.addColorStop(1, '#0f1a30');
  c.fillStyle = g; c.fillRect(0, 0, w, h);
  const img = c.getImageData(0, 0, w, h), d = img.data;
  for (let i = 0; i < d.length; i += 4) { const n = (Math.random() - 0.5) * 14; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
  c.putImageData(img, 0, 0);
  c.strokeStyle = '#d6a945'; c.lineWidth = 6; c.strokeRect(54, 54, w - 108, h - 108);
  c.lineWidth = 2; c.strokeRect(74, 74, w - 148, h - 148);
  c.fillStyle = '#e2b955'; c.textAlign = 'center';
  c.font = '600 34px "DM Sans", sans-serif'; c.fillText('A R T H I K A   L E A R N', w / 2, 230);
  c.font = '800 128px Fraunces, Georgia, serif'; c.fillText('Money,', w / 2, 520); c.fillText('Explained', w / 2, 660);
  c.font = 'italic 500 44px Fraunces, Georgia, serif'; c.fillText('Volume I · Foundations of Investing', w / 2, 760);
  // emblem: a stack of coins and a rising line
  c.save(); c.translate(w / 2, 1000); c.lineWidth = 5;
  for (let k = 0; k < 5; k++) { c.beginPath(); c.ellipse(-90, 60 - k * 22, 70, 20, 0, 0, Math.PI * 2); c.stroke(); }
  c.beginPath(); c.moveTo(10, 80); c.lineTo(70, 10); c.lineTo(110, 40); c.lineTo(190, -70); c.stroke();
  c.beginPath(); c.moveTo(160, -70); c.lineTo(190, -70); c.lineTo(190, -40); c.stroke();
  c.restore();
  c.font = '600 30px "DM Sans", sans-serif'; c.fillText('SEVEN INTERACTIVE LESSONS', w / 2, h - 150);
}
const coverTex = tex(1024, 1365, drawCover);
const endTex = tex(512, 683, (c, w, h) => {
  c.fillStyle = '#1d2f52'; c.fillRect(0, 0, w, h);
  c.strokeStyle = 'rgba(214,169,69,.35)'; c.lineWidth = 2;
  for (let y = -40; y < h + 40; y += 46) for (let x = -40; x < w + 40; x += 46) { c.beginPath(); c.arc(x + ((y / 46) % 2) * 23, y, 14, 0, 7); c.stroke(); }
});

/* ---------------- desk, lamp, props ---------------- */
scene.background = new THREE.Color(0x120c08);
// soft studio reflections so gold, brass and glass read as metal instead of black
if (webgl) { const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; pm.dispose(); }
const ENV = 0.45;   // how much of that studio light reaches materials (lamp stays the key light)
function tameEnv(root) { root.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => { if ('envMapIntensity' in m && !m.userData.envSet) { m.envMapIntensity = ENV; m.userData.envSet = true; } }); }); }
scene.fog = new THREE.Fog(0x120c08, 110, 260);

const desk = new THREE.Mesh(new THREE.PlaneGeometry(220, 140), new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.62, metalness: 0.02 }));
desk.rotation.x = -Math.PI / 2; desk.receiveShadow = true; scene.add(desk);

const hemi = new THREE.HemisphereLight(0xffe9cf, 0x2a1a10, 0.55); scene.add(hemi);
const fill = new THREE.DirectionalLight(0xc9d8ff, 0.35); fill.position.set(60, 50, 60); scene.add(fill);
const sun = new THREE.DirectionalLight(0xfff3df, 0); sun.position.set(-40, 90, 50); sun.castShadow = true;
Object.assign(sun.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, far: 220 }); sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0004;
scene.add(sun);

// an articulated brass desk lamp, back-left of the book
const lamp = new THREE.Group();
const brass = new THREE.MeshStandardMaterial({ color: 0xb48a3c, metalness: 0.9, roughness: 0.28 });
const darkM = new THREE.MeshStandardMaterial({ color: 0x1e2a1f, metalness: 0.4, roughness: 0.4 });
const base = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.8, 1.1, 48), darkM); base.position.y = 0.55; base.castShadow = true;
const j1 = new THREE.Vector3(0, 1.1, 0), j2 = new THREE.Vector3(4, 21, 4), head = new THREE.Vector3(13, 25, 10);
function rod(a, b, r) { const d = b.clone().sub(a), m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, d.length(), 14), brass); m.position.copy(a).add(b).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); m.castShadow = true; return m; }
const knuckle = new THREE.Mesh(new THREE.SphereGeometry(0.8, 18, 14), brass); knuckle.position.copy(j2);
const shadeGeo = new THREE.CylinderGeometry(1.4, 5.2, 6.5, 40, 1, true);
const shade = new THREE.Mesh(shadeGeo, new THREE.MeshStandardMaterial({ color: 0x1f4d36, metalness: 0.35, roughness: 0.35, side: THREE.DoubleSide }));
shade.castShadow = true;
const bulb = new THREE.Mesh(new THREE.SphereGeometry(1.25, 20, 16), new THREE.MeshStandardMaterial({ color: 0xfff1cf, emissive: 0xffd88a, emissiveIntensity: 2.2 }));
lamp.add(base, rod(j1, j2, 0.38), knuckle, rod(j2, head, 0.32));
const headGrp = new THREE.Group(); headGrp.position.copy(head); headGrp.add(shade, bulb); bulb.position.y = -1.6; lamp.add(headGrp);
lamp.position.set(-30, 0, -21); scene.add(lamp);
// aim the shade at the book
const lampTarget = new THREE.Vector3(2, 0, 2);
{ const hw = head.clone().add(lamp.position), dir = lampTarget.clone().sub(hw).normalize(); headGrp.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir); }
const spot = new THREE.SpotLight(0xffd9a0, 3.2, 0, 0.62, 0.55, 0);
spot.position.copy(head).add(lamp.position); spot.target.position.copy(lampTarget);
spot.castShadow = true; spot.shadow.mapSize.set(2048, 2048); spot.shadow.bias = -0.0003; spot.shadow.camera.near = 5; spot.shadow.camera.far = 140;
scene.add(spot, spot.target);
const glow = new THREE.PointLight(0xffc477, 1.4, 34, 1.4); glow.position.copy(spot.position); scene.add(glow);

// a cup of chai, a pencil, a few loose coins
{
  const mug = new THREE.Group();
  const cer = new THREE.MeshStandardMaterial({ color: 0xb4583a, roughness: 0.45 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(3.1, 2.8, 7.4, 40, 1, true), cer); body.position.y = 3.7;
  const inner = new THREE.Mesh(new THREE.CylinderGeometry(2.85, 2.6, 7.2, 40, 1, true), new THREE.MeshStandardMaterial({ color: 0xe9dccb, side: THREE.BackSide, roughness: 0.5 })); inner.position.y = 3.8;
  const bottom = new THREE.Mesh(new THREE.CircleGeometry(2.8, 40), cer); bottom.rotation.x = -Math.PI / 2; bottom.position.y = 0.05;
  const chai = new THREE.Mesh(new THREE.CircleGeometry(2.85, 40), new THREE.MeshStandardMaterial({ color: 0xb98552, roughness: 0.2 })); chai.rotation.x = -Math.PI / 2; chai.position.y = 6.2;
  const handle = new THREE.Mesh(new THREE.TorusGeometry(1.7, 0.42, 14, 30, Math.PI * 1.2), cer); handle.position.set(3.1, 3.9, 0); handle.rotation.z = -Math.PI * 0.6;
  [body, handle].forEach((m) => { m.castShadow = true; });
  mug.add(body, inner, bottom, chai, handle); mug.position.set(33, 0, 9); scene.add(mug);
  const pencil = new THREE.Group();
  const wood = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 17, 6), new THREE.MeshStandardMaterial({ color: 0xf0b631, roughness: 0.5 }));
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.5, 6), new THREE.MeshStandardMaterial({ color: 0xe6c79c })); tip.position.y = 9.25;
  const lead = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.45, 6), darkM); lead.position.y = 10.05;
  [wood, tip].forEach((m) => { m.castShadow = true; });
  pencil.add(wood, tip, lead); pencil.rotation.set(Math.PI / 2, 0, 1.15); pencil.position.set(29, 0.42, -12); scene.add(pencil);
  const cg = new THREE.CylinderGeometry(1.1, 1.1, 0.22, 36), gm = new THREE.MeshStandardMaterial({ color: 0xd9a63c, metalness: 0.9, roughness: 0.3 });
  [[25, 16, 0], [26.8, 17.3, 0.22], [25.6, 16.6, 0.44], [-26, 15, 0], [-24.2, 17.4, 0]].forEach(([x, z, y], k) => { const m = new THREE.Mesh(cg, gm); m.position.set(x, 0.11 + y, z); m.rotation.y = k; m.castShadow = true; scene.add(m); });
}

/* ---------------- the book ---------------- */
const book = new THREE.Group(); scene.add(book);
const coverSide = new THREE.MeshStandardMaterial({ color: 0x14223d, roughness: 0.6 });
const backCover = new THREE.Mesh(new THREE.BoxGeometry(PW + 0.7, COVER, PD + 1), [coverSide, coverSide, new THREE.MeshStandardMaterial({ map: endTex, roughness: 0.7 }), coverSide, coverSide, coverSide]);
backCover.position.set((PW + 0.7) / 2, COVER / 2, 0); backCover.castShadow = backCover.receiveShadow = true; book.add(backCover);
const spine = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, PD + 1, 24, 1, false, Math.PI / 2, Math.PI), coverSide);
spine.rotation.x = Math.PI / 2; spine.position.set(0, 0.25, 0); book.add(spine);

const edgeM = new THREE.MeshStandardMaterial({ map: edgeTex, roughness: 0.9 });
const paperR = new THREE.MeshStandardMaterial({ map: paperTex(false), roughness: 0.92 });
const paperL = new THREE.MeshStandardMaterial({ map: paperTex(true), roughness: 0.92 });
const stackGeo = new THREE.BoxGeometry(PW, STACK, PD);
const rightStack = new THREE.Mesh(stackGeo, [edgeM, edgeM, paperR, edgeM, edgeM, edgeM]);
rightStack.position.set(PW / 2, COVER + STACK / 2, 0); rightStack.castShadow = rightStack.receiveShadow = true; book.add(rightStack);
const leftStack = new THREE.Mesh(stackGeo, [edgeM, edgeM, paperL, edgeM, edgeM, edgeM]);
leftStack.position.set(-PW / 2, COVER + STACK / 2, 0); leftStack.castShadow = leftStack.receiveShadow = true; book.add(leftStack);

// front cover on a hinge at the spine: closed = lying on the right stack, open = on the desk at left
const hinge = new THREE.Group(); book.add(hinge);
const frontCover = new THREE.Mesh(new THREE.BoxGeometry(PW + 0.7, COVER, PD + 1), [coverSide, coverSide, new THREE.MeshStandardMaterial({ map: coverTex, roughness: 0.55, metalness: 0.1 }), new THREE.MeshStandardMaterial({ map: endTex, roughness: 0.7 }), coverSide, coverSide]);
frontCover.position.set((PW + 0.7) / 2, COVER / 2, 0); frontCover.castShadow = true; hinge.add(frontCover);
function setCover(p) {          // p: 0 closed → 1 open
  const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
  hinge.rotation.z = e * Math.PI;
  hinge.position.y = THREE.MathUtils.lerp(Y, COVER, e) + Math.sin(e * Math.PI) * 0.6;
  const s = THREE.MathUtils.clamp((p - 0.55) / 0.45, 0, 1);
  leftStack.scale.y = Math.max(0.001, s); leftStack.position.y = COVER + (STACK * s) / 2; leftStack.visible = s > 0.002;
}

// the page that turns: a curled plane, rebuilt from a bend each frame
const SEG = 30;
const flipGeo = new THREE.PlaneGeometry(PW, PD, SEG, 1);
const flipBase = flipGeo.attributes.position.array.slice();
const flipMat = new THREE.MeshStandardMaterial({ map: paperTex(false), roughness: 0.92, side: THREE.DoubleSide });
const flip = new THREE.Mesh(flipGeo, flipMat); flip.castShadow = true; flip.visible = false; book.add(flip);
function bendPage(theta) {       // theta 0 = lying right, π = lying left
  const a = flipGeo.attributes.position, curl = Math.sin(theta) * 1.1;
  const xs = [0], ys = [0]; const ds = PW / SEG;
  for (let i = 1; i <= SEG; i++) {
    const u = (i - 0.5) / SEG, phi = theta + curl * u * u * (theta < Math.PI / 2 ? -1 : 1) * 0.9;
    xs.push(xs[i - 1] + Math.cos(phi) * ds); ys.push(ys[i - 1] + Math.sin(phi) * ds);
  }
  for (let v = 0; v < a.count; v++) {
    const ox = flipBase[v * 3] + PW / 2, i = Math.round(ox / ds), z = -flipBase[v * 3 + 1];
    a.setXYZ(v, xs[i], Y + 0.03 + ys[i], z);
  }
  a.needsUpdate = true; flipGeo.computeVertexNormals();
}

/* ---------------- HTML pages laid on the paper ---------------- */
function pageObject(x) {
  const el = document.createElement('div'); el.className = 'page';
  el.style.width = PW * PX + 'px'; el.style.height = PD * PX + 'px';
  const o = new CSS3DObject(el); o.position.set(x, Y + 0.02, 0); o.rotation.x = -Math.PI / 2; o.scale.setScalar(1 / PX);
  cssScene.add(o); return { el, o };
}
const leftPage = pageObject(-PW / 2), rightPage = pageObject(PW / 2);

/* ---------------- lesson state & rendering ---------------- */
const tip = $('#tip'), toast = $('#toast');
let idx = -1, model = null, state = {}, opened = false, busy = false, readMode = false;
const visited = new Set(store.get('visited', [])), answered = store.get('answered', {});

const ctx = {
  Y, A: AREA,
  label(n, text, pos) {
    const el = document.createElement('div'); el.className = 'lbl'; el.innerHTML = `<b>${n}</b><span>${text}</span>`;
    const o = new CSS2DObject(el); o.position.copy(pos); return o;
  },
  tag(html, pos, cls = '') {
    const el = document.createElement('div'); el.className = 'tag ' + cls; el.innerHTML = html;
    const o = new CSS2DObject(el); o.position.copy(pos);
    return { obj: o, set(h) { if (el.innerHTML !== h) el.innerHTML = h; } };
  },
};

function leftHTML(L, i) {
  const q = L.quiz, ans = answered[L.id];
  return `
  <header class="runhead"><span>Money, Explained</span><span>${L.kicker}</span></header>
  <h2 class="title">${L.title}</h2>
  ${L.paras.map((p) => `<p>${p}</p>`).join('')}
  <div class="formula"><div class="f">${L.formula.html}</div><ul>${L.formula.legend.map((x) => `<li>${x}</li>`).join('')}</ul></div>
  <ul class="ideas">${L.ideas.map((x) => `<li>${x}</li>`).join('')}</ul>
  <div class="predict">
    <p class="pq"><span>Predict</span>${q.q}</p>
    <div class="opts">${q.options.map((o, k) => `<button class="opt${ans != null ? (k === q.correct ? ' right' : k === ans ? ' wrong' : '') : ''}" data-k="${k}">${o}</button>`).join('')}</div>
    <div class="flapwrap"><div class="answer">${q.explain}</div><button class="flap${ans != null ? ' up' : ''}"><b>Lift the flap</b><span>to see the answer — or make a prediction first</span></button></div>
  </div>
  <footer class="folio">${i * 2 + 1}</footer>`;
}
function rightHTML(L, i) {
  return `
  <header class="runhead r"><span>${L.short}</span><span>Arthika Learn</span></header>
  <div class="figure">
    <p class="cap">${L.caption}</p>
    <p class="hint">${L.hint}</p>
    <div class="cols">
      <div class="ctrls">${L.controls.map((c) => c.type === 'button'
        ? `<button class="ctl-btn" data-key="${c.key}">${c.label}</button>`
        : `<label class="ctl"><span class="cl">${c.label}<output data-out="${c.key}"></output></span><input type="range" min="${c.min}" max="${c.max}" step="${c.step}" value="${state[c.key]}" data-key="${c.key}" aria-label="${c.label}"></label>`).join('')}</div>
      <dl class="reads" data-reads></dl>
    </div>
  </div>
  <footer class="folio">${i * 2 + 2}</footer>`;
}

function bind(root, L) {
  root.querySelectorAll('input[type=range]').forEach((inp) => {
    const key = inp.dataset.key;
    const paint = () => { const c = L.controls.find((x) => x.key === key); const p = (inp.value - c.min) / (c.max - c.min) * 100; inp.style.setProperty('--p', p + '%'); };
    paint();
    inp.addEventListener('input', () => { state[key] = +inp.value; paint(); refresh(); });
    ['pointerdown', 'wheel'].forEach((ev) => inp.addEventListener(ev, (e) => e.stopPropagation()));
  });
  root.querySelectorAll('.ctl-btn').forEach((b) => b.addEventListener('click', () => { state[b.dataset.key] = (state[b.dataset.key] * 1103515245 + 12345) % 2147483647; refresh(); }));
  root.querySelectorAll('.opt').forEach((b) => b.addEventListener('click', () => {
    const k = +b.dataset.k; answered[L.id] = k; store.set('answered', answered);
    root.querySelectorAll('.opt').forEach((o, j) => { o.classList.toggle('right', j === L.quiz.correct); o.classList.toggle('wrong', j === k && k !== L.quiz.correct); });
    root.querySelector('.flap').classList.add('up');
    renderToc();
  }));
  const flapBtn = root.querySelector('.flap');
  if (flapBtn) flapBtn.addEventListener('click', () => flapBtn.classList.toggle('up'));
}

function refresh() {
  const L = LESSONS[idx];
  L.controls.forEach((c) => { document.querySelectorAll(`[data-out="${c.key}"]`).forEach((o) => { o.textContent = c.fmt ? c.fmt(state[c.key]) : state[c.key]; }); });
  const rows = L.readouts(state).map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
  document.querySelectorAll('[data-reads]').forEach((d) => { d.innerHTML = rows; });
  if (model) model.update(state);
}

const sheet = $('#sheet'), sheetBody = $('#sheet-body');
let sheetTab = 'read';
function renderPages() {
  const L = LESSONS[idx];
  if (readMode) {
    leftPage.el.innerHTML = rightPage.el.innerHTML = '';
    sheetBody.innerHTML = `<div class="sp sp-read"${sheetTab === 'read' ? '' : ' hidden'}>${leftHTML(L, idx)}</div><div class="sp sp-play"${sheetTab === 'play' ? '' : ' hidden'}>${rightHTML(L, idx)}</div>`;
    bind(sheetBody, L);
  } else {
    leftPage.el.innerHTML = leftHTML(L, idx); rightPage.el.innerHTML = rightHTML(L, idx);
    bind(leftPage.el, L); bind(rightPage.el, L);
  }
  refresh();
}

const lessonRoot = new THREE.Group(); scene.add(lessonRoot);
function mountModel(i) {
  if (model) { lessonRoot.remove(model.group); disposeGroup(model.group); }
  const L = LESSONS[i];
  state = Object.fromEntries(L.controls.map((c) => [c.key, c.value]));
  model = L.build(ctx); model.group.scale.setScalar(0.001); lessonRoot.add(model.group); tameEnv(model.group);
  model.update(state); model.grow = 0;
}
function disposeGroup(g) {
  g.traverse((o) => { if (o.isCSS2DObject && o.element.parentNode) o.element.remove(); if (o.geometry && o.geometry !== flipGeo) o.geometry.dispose?.(); });
}

/* ---------------- navigation ---------------- */
const pillKicker = $('#pill-kicker'), pillTitle = $('#pill-title'), toc = $('#toc'), tocBtn = $('#toc-btn');
function renderToc() {
  toc.innerHTML = `<p class="toc-h">Volume I · Foundations of Investing</p>` + LESSONS.map((L, i) =>
    `<button data-i="${i}" class="${i === idx ? 'cur' : ''}"><span class="n">${i + 1}</span><span class="t">${L.title}</span><span class="s">${answered[L.id] != null ? '✓' : visited.has(L.id) ? '•' : ''}</span></button>`).join('');
  toc.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => { closeToc(); go(+b.dataset.i); }));
}
function closeToc() { toc.hidden = true; tocBtn.setAttribute('aria-expanded', 'false'); }
tocBtn.addEventListener('click', () => { const open = toc.hidden; renderToc(); toc.hidden = !open; tocBtn.setAttribute('aria-expanded', String(open)); });
document.addEventListener('click', (e) => { if (!e.target.closest('#toc, #toc-btn')) closeToc(); });
$('#prev').addEventListener('click', () => go(idx - 1));
$('#next').addEventListener('click', () => go(idx + 1));
addEventListener('keydown', (e) => {
  if (e.target.closest('input, textarea')) return;
  if (e.key === 'ArrowRight') go(idx + 1); else if (e.key === 'ArrowLeft') go(idx - 1); else if (e.key === 'Escape') closeToc();
});

const tweens = [];
function tween(dur, fn, done) { const tw = { t: 0, dur, fn, done }; tweens.push(tw); return tw; }

function setPill() {
  const L = LESSONS[idx];
  pillKicker.textContent = `Lesson ${idx + 1} of ${LESSONS.length}`;
  pillTitle.textContent = L.title;
  $('#prev').disabled = idx <= 0; $('#next').disabled = idx >= LESSONS.length - 1;
  document.title = `${L.title} — Money, Explained | Arthika Learn`;
  history.replaceState(null, '', `#${L.id}`);
  visited.add(L.id); store.set('visited', [...visited]); store.set('last', idx);
}
function fadePages(on) { [leftPage.el, rightPage.el, sheetBody].forEach((el) => el.classList.toggle('fade', !on)); }

function go(i, instant = false) {
  if (!opened || busy || i < 0 || i >= LESSONS.length || i === idx) return;
  const forward = i > idx, first = idx < 0;
  if (instant || first || readMode || !webgl) {
    idx = i; setPill(); mountModel(i); renderPages(); fadePages(true); return;
  }
  busy = true; fadePages(false);
  const old = model;
  tween(0.35, (p) => { old.group.scale.setScalar(Math.max(0.001, 1 - p)); }, () => {
    flip.visible = true; bendPage(forward ? 0 : Math.PI);
    flipMat.map = forward ? paperR.map : paperL.map; flipMat.needsUpdate = true;
    let swapped = false;
    tween(0.95, (p) => {
      const e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
      bendPage(forward ? e * Math.PI : (1 - e) * Math.PI);
      if (!swapped && p > 0.5) { swapped = true; idx = i; setPill(); mountModel(i); renderPages(); fadePages(false); }
    }, () => { flip.visible = false; fadePages(true); busy = false; });
  });
}

/* ---------------- opening the book ---------------- */
const coverUI = $('#cover-ui');
function openBook() {
  if (opened) return;
  coverUI.classList.add('gone');
  tween(1.6, (p) => setCover(p), () => {
    opened = true;
    if (readMode) sheet.hidden = false;
    const start = Math.min(LESSONS.length - 1, Math.max(0, LESSONS.findIndex((L) => '#' + L.id === location.hash)));
    go(location.hash ? start : 0, true);
    flyTo(readingView(), 1.4);
  });
  flyTo({ pos: new THREE.Vector3(0, 52, 34), target: new THREE.Vector3(0, 0, 1) }, 1.6);
}
$('#open-btn').addEventListener('click', openBook);
setCover(0);

/* ---------------- camera framing ---------------- */
function readingView() {
  const aspect = innerWidth / innerHeight;
  if (readMode) {
    // fit the right-page model (≈ 20 wide, 14 tall) into what the sheet leaves visible
    const visW = innerWidth < 820 ? aspect : aspect * 0.6, visH = innerWidth < 820 ? 0.5 : 1;
    const vfov = THREE.MathUtils.degToRad(camera.fov), half = Math.tan(vfov / 2);
    const d = Math.max(10.5 / (half * visW), 8 / (half * visH)) * (innerWidth < 820 ? 1.4 : 1.12);
    return { pos: new THREE.Vector3(10.5, Y + 3 + d * 0.62, -5.5 + d * 0.78), target: new THREE.Vector3(10.5, Y + 3, -5.5) };
  }
  // fit the open book (≈ 44 × 30) to the viewport
  const vfov = THREE.MathUtils.degToRad(camera.fov), hfov = 2 * Math.atan(Math.tan(vfov / 2) * aspect);
  const pitch = THREE.MathUtils.degToRad(51);
  const needW = 46 / (2 * Math.tan(hfov / 2)), needH = (31 * Math.sin(pitch) + 9) / (2 * Math.tan(vfov / 2));
  const d = Math.max(needW, needH) * 1.05;
  return { pos: new THREE.Vector3(0, 3 + Math.sin(pitch) * d, Math.cos(pitch) * d), target: new THREE.Vector3(0, 3, 0) };
}
let camTween = null;
function flyTo(v, dur = 1.2) {
  const p0 = camera.position.clone(), t0 = controls.target.clone();
  if (camTween) { const k = tweens.indexOf(camTween); if (k >= 0) tweens.splice(k, 1); }
  camTween = tween(dur, (p) => { const e = 1 - Math.pow(1 - p, 3); camera.position.lerpVectors(p0, v.pos, e); controls.target.lerpVectors(t0, v.target, e); });
}
const coverView = () => (innerWidth / innerHeight < 0.8
  ? { pos: new THREE.Vector3(10, 78, 72), target: new THREE.Vector3(10, 0, -6) }      // portrait phones: further back, book in the upper half
  : { pos: new THREE.Vector3(8, 44, 50), target: new THREE.Vector3(6, 0, 0) });
camera.position.set(-36, 30, 62); controls.target.set(4, 0, 0);
flyTo(coverView(), 2.6);

/* ---------------- tools ---------------- */
let lampOn = true;
function applyLight() {
  spot.intensity = lampOn ? 3.2 : 0; glow.intensity = lampOn ? 1.4 : 0;
  bulb.material.emissiveIntensity = lampOn ? 2.2 : 0.05;
  hemi.intensity = lampOn ? 0.55 : 1.0; sun.intensity = lampOn ? 0 : 1.6; fill.intensity = lampOn ? 0.35 : 0.5;
  scene.background.set(lampOn ? 0x120c08 : 0x2a2018); scene.fog.color.copy(scene.background);
  document.body.classList.toggle('day', !lampOn);
}
$('#btn-lamp').addEventListener('click', () => { lampOn = !lampOn; applyLight(); });
$('#btn-view').addEventListener('click', () => flyTo(opened ? readingView() : coverView()));
$('#btn-full').addEventListener('click', () => { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen?.(); });
$('#btn-read').addEventListener('click', () => setReadMode(!readMode));
sheet.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => {
  sheetTab = b.dataset.tab;
  sheet.querySelectorAll('[data-tab]').forEach((x) => x.setAttribute('aria-selected', String(x === b)));
  sheetBody.querySelector('.sp-read').hidden = sheetTab !== 'read'; sheetBody.querySelector('.sp-play').hidden = sheetTab !== 'play';
}));

function setReadMode(on) {
  readMode = on;
  document.body.classList.toggle('reading', on);
  sheet.hidden = !on || !opened; css3d.domElement.style.display = on ? 'none' : '';
  $('#btn-read').classList.toggle('on', on);
  if (on && innerWidth >= 820) sheetTab = 'read';
  sheet.querySelectorAll('[data-tab]').forEach((x) => x.setAttribute('aria-selected', String(x.dataset.tab === sheetTab)));
  applyViewOffset();
  if (idx >= 0) renderPages();
  if (opened) flyTo(readingView(), 0.9);
}
function applyViewOffset() {
  const w = innerWidth, h = innerHeight;
  if (readMode && w < 820) camera.setViewOffset(w, h, 0, h * 0.22, w, h);       // model sits in the top half
  else if (readMode) camera.setViewOffset(w, h, w * 0.2, 0, w, h);              // model sits left of the side panel
  else camera.clearViewOffset();
  camera.updateProjectionMatrix();
}

/* ---------------- hover tooltips on the 3D model ---------------- */
const ray = new THREE.Raycaster(), mouse = new THREE.Vector2();
let hoverAt = null;
addEventListener('pointermove', (e) => { hoverAt = { x: e.clientX, y: e.clientY, t: e.target }; });
addEventListener('pointerleave', () => { hoverAt = null; });
function updateTip() {
  if (!hoverAt || !model || !webgl || hoverAt.t.closest?.('.page button, .page input, .hud, .sheet')) { tip.hidden = true; return; }
  mouse.set((hoverAt.x / innerWidth) * 2 - 1, -(hoverAt.y / innerHeight) * 2 + 1);
  ray.setFromCamera(mouse, camera);
  const hits = ray.intersectObjects(model.group.children, true);
  for (const h of hits) {
    let o = h.object, fn = null;
    while (o && !fn) { fn = o.userData?.tip; o = o.parent; }
    if (fn) {
      const html = fn(h.instanceId);
      if (html) { tip.innerHTML = html; tip.hidden = false; tip.style.transform = `translate(${hoverAt.x + 14}px, ${hoverAt.y + 14}px)`; return; }
    }
  }
  tip.hidden = true;
}

/* ---------------- resize, quality, loop ---------------- */
function onResize() {
  camera.aspect = innerWidth / innerHeight;
  if (webgl) renderer.setSize(innerWidth, innerHeight);
  css3d.setSize(innerWidth, innerHeight); css2d.setSize(innerWidth, innerHeight);
  applyViewOffset();
  const phone = innerWidth < 820 || innerHeight < 520;
  if (phone && !readMode && opened) setReadMode(true);
}
addEventListener('resize', onResize);

let slowFrames = 0, quality = 2;
function showToast(msg, ms = 6000) { toast.textContent = msg; toast.hidden = false; clearTimeout(showToast.t); showToast.t = setTimeout(() => { toast.hidden = true; }, ms); }
function degrade() {
  if (quality === 2) { renderer.setPixelRatio(1); spot.shadow.mapSize.set(1024, 1024); spot.shadow.map?.dispose(); spot.shadow.map = null; quality = 1; showToast('Switched to a lighter mode for smoother motion. For full quality, turn on hardware acceleration in your browser settings.'); }
  else if (quality === 1) { renderer.setPixelRatio(0.75); renderer.shadowMap.enabled = false; scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => { m.needsUpdate = true; }); }); quality = 0; }
}

const clock = new THREE.Clock();
function loop() {
  const dt = Math.min(clock.getDelta(), 0.1), t = clock.elapsedTime;
  for (let k = tweens.length - 1; k >= 0; k--) {
    const tw = tweens[k]; tw.t += dt; const p = Math.min(1, tw.t / tw.dur); tw.fn(p);
    if (p >= 1) { tweens.splice(k, 1); tw.done?.(); }
  }
  if (model) {
    if (model.grow < 1 && !busy) model.grow = Math.min(1, model.grow + dt * 2.2);
    if (!busy || flip.visible) { const g = model.grow, e = 1 - Math.pow(1 - g, 3) + Math.sin(g * Math.PI) * 0.08; model.group.scale.setScalar(Math.max(0.001, e)); }
    model.tick(dt, t);
  }
  // the lesson model grows from the right page, so scale about the page centre
  lessonRoot.position.set(0, 0, 0);
  controls.update();
  if (webgl) {
    renderer.render(scene, camera);
    if (t > 4 && quality > 0) { slowFrames = dt > 0.045 ? slowFrames + 1 : Math.max(0, slowFrames - 0.5); if (slowFrames > 60) { slowFrames = 0; degrade(); } }
  }
  if (!readMode) css3d.render(cssScene, camera);
  css2d.render(scene, camera);
  updateTip();
  requestAnimationFrame(loop);
}

/* ---------------- boot ---------------- */
tameEnv(scene);
applyLight();
renderToc();
if (!webgl) {
  stage.classList.add('nogl');
  showToast('3D needs WebGL (graphics acceleration). Showing the text version.', 9000);
}
if (innerWidth < 820 || innerHeight < 520 || !webgl) setReadMode(true);
if (location.hash && LESSONS.some((L) => '#' + L.id === location.hash)) openBook();
// canvas text needs the web fonts loaded first: repaint the cover once they arrive
Promise.all(['800 128px Fraunces', 'italic 500 44px Fraunces', '600 30px "DM Sans"'].map((f) => document.fonts?.load(f)))
  .then(() => { const c = coverTex.image; drawCover(c.getContext('2d'), c.width, c.height); coverTex.needsUpdate = true; })
  .catch(() => {});
loop();
