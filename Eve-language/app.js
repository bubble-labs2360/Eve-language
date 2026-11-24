/* Eve-language — app logic. Plain browser JS, no build step. */
(() => {
'use strict';

const G = window.EVE_GLYPHS;
const KEYS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const $ = (s, r = document) => r.querySelector(s);
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const abs = (p) => new URL(p, location.href).href;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const store = {
  get(k, d) { try { const v = localStorage.getItem('evego:' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('evego:' + k, JSON.stringify(v)); } catch { /* storage unavailable */ } },
};

/* ================= glyph metrics & rendering ================= */
const EM_TOP = 30, EM_H = 540, PAD = 60, SPACE_ADV = 300;
const PATHS = {};
for (const k of KEYS) PATHS[k] = new Path2D(G[k].d);
const glyphBox = (k) => { const g = G[k]; return { vx: g.x0 - PAD, vw: g.x1 - g.x0 + PAD * 2 }; };

const SVGNS = 'http://www.w3.org/2000/svg';
function glyphSVG(k, { stroke = true } = {}) {
  const { vx, vw } = glyphBox(k);
  const svg = document.createElementNS(SVGNS, 'svg');
  svg.setAttribute('viewBox', `${vx} ${EM_TOP} ${vw} ${EM_H}`);
  svg.setAttribute('aria-hidden', 'true');
  svg.style.aspectRatio = `${vw} / ${EM_H}`;
  if (stroke) {
    const s = document.createElementNS(SVGNS, 'path');
    s.setAttribute('d', G[k].d); s.setAttribute('class', 'gs'); s.setAttribute('pathLength', '1');
    svg.appendChild(s);
  }
  const f = document.createElementNS(SVGNS, 'path');
  f.setAttribute('d', G[k].d); f.setAttribute('class', 'gf'); f.setAttribute('fill-rule', 'evenodd');
  svg.appendChild(f);
  return svg;
}

/* Render a romanized string into Eve glyph DOM: words → glyph cells (with ruby letters). */
function renderEve(container, text, { ruby = true, hl = '' } = {}) {
  container.textContent = '';
  const words = text.split(/\s+/).filter(Boolean);
  let i = 0;
  for (const w of words) {
    const wEl = document.createElement('span'); wEl.className = 'ew';
    for (const ch of w) {
      const up = ch.toUpperCase();
      const cell = document.createElement('span');
      if (G[up]) {
        cell.className = up === hl ? 'gc hl' : 'gc';
        const svg = glyphSVG(up); svg.style.setProperty('--d', Math.min(i * 0.05, 0.9).toFixed(2) + 's');
        cell.appendChild(svg);
        if (ruby) { const rb = document.createElement('span'); rb.className = 'rb'; rb.textContent = up; cell.appendChild(rb); }
        i++;
      } else {
        cell.className = /[.,!?'"\-:;、。！？]/.test(ch) ? 'gc punct' : 'gc raw';
        cell.textContent = ch;
      }
      wEl.appendChild(cell);
    }
    container.appendChild(wEl);
  }
  container.setAttribute('aria-label', 'Eve語: ' + text.toUpperCase());
  return i;
}

/* Lay out glyphs for canvas drawing. Returns items with x positions in em units and total width. */
function layoutLine(text) {
  const items = []; let x = 0;
  for (const ch of text) {
    const up = ch.toUpperCase();
    if (ch === ' ') { x += SPACE_ADV; continue; }
    if (G[up]) { const { vx, vw } = glyphBox(up); items.push({ k: up, x, vx }); x += vw; }
  }
  return { items, width: x };
}
function drawLine(ctx, line, left, top, height) {
  const s = height / EM_H;
  for (const it of line.items) {
    ctx.save();
    ctx.translate(left + it.x * s - it.vx * s, top - EM_TOP * s);
    ctx.scale(s, s);
    ctx.fill(PATHS[it.k], 'evenodd');
    ctx.restore();
  }
}

/* ================= Japanese → romaji ================= */
const toHira = (s) => s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
const KANA = {
  あ:'a',い:'i',う:'u',え:'e',お:'o',か:'ka',き:'ki',く:'ku',け:'ke',こ:'ko',さ:'sa',し:'shi',す:'su',せ:'se',そ:'so',
  た:'ta',ち:'chi',つ:'tsu',て:'te',と:'to',な:'na',に:'ni',ぬ:'nu',ね:'ne',の:'no',は:'ha',ひ:'hi',ふ:'fu',へ:'he',ほ:'ho',
  ま:'ma',み:'mi',む:'mu',め:'me',も:'mo',や:'ya',ゆ:'yu',よ:'yo',ら:'ra',り:'ri',る:'ru',れ:'re',ろ:'ro',わ:'wa',ゐ:'i',ゑ:'e',を:'o',ん:'n',
  が:'ga',ぎ:'gi',ぐ:'gu',げ:'ge',ご:'go',ざ:'za',じ:'ji',ず:'zu',ぜ:'ze',ぞ:'zo',だ:'da',ぢ:'ji',づ:'zu',で:'de',ど:'do',
  ば:'ba',び:'bi',ぶ:'bu',べ:'be',ぼ:'bo',ぱ:'pa',ぴ:'pi',ぷ:'pu',ぺ:'pe',ぽ:'po',ゔ:'vu',
  ぁ:'a',ぃ:'i',ぅ:'u',ぇ:'e',ぉ:'o',ゃ:'ya',ゅ:'yu',ょ:'yo',ゎ:'wa',
  きゃ:'kya',きゅ:'kyu',きょ:'kyo',しゃ:'sha',しゅ:'shu',しょ:'sho',ちゃ:'cha',ちゅ:'chu',ちょ:'cho',にゃ:'nya',にゅ:'nyu',にょ:'nyo',
  ひゃ:'hya',ひゅ:'hyu',ひょ:'hyo',みゃ:'mya',みゅ:'myu',みょ:'myo',りゃ:'rya',りゅ:'ryu',りょ:'ryo',ぎゃ:'gya',ぎゅ:'gyu',ぎょ:'gyo',
  じゃ:'ja',じゅ:'ju',じょ:'jo',ぢゃ:'ja',ぢゅ:'ju',ぢょ:'jo',びゃ:'bya',びゅ:'byu',びょ:'byo',ぴゃ:'pya',ぴゅ:'pyu',ぴょ:'pyo',
  しぇ:'she',ちぇ:'che',じぇ:'je',てぃ:'ti',でぃ:'di',とぅ:'tu',どぅ:'du',ふぁ:'fa',ふぃ:'fi',ふぇ:'fe',ふぉ:'fo',
  うぃ:'wi',うぇ:'we',うぉ:'wo',ゔぁ:'va',ゔぃ:'vi',ゔぇ:'ve',ゔぉ:'vo',つぁ:'tsa',つぇ:'tse',つぉ:'tso',いぇ:'ye',
};
const PUNCT = { '、': ',', '。': '.', '！': '!', '？': '?', '・': ' ', '「': '"', '」': '"', '『': '"', '』': '"', '　': ' ', '〜': '-', '～': '-' };
function kanaToRomaji(src) {
  const s = toHira(src); let out = ''; let sokuon = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === 'っ') { sokuon = true; continue; }
    if (c === 'ー') { const m = out.match(/[aeiou]$/); if (m) out += m[0]; continue; }
    let r = KANA[s.slice(i, i + 2)];
    if (r) i++; else r = KANA[c];
    if (r == null) r = PUNCT[c] != null ? PUNCT[c] : c;
    if (sokuon) { if (/^[a-z]/.test(r)) out += r.startsWith('ch') ? 't' : r[0]; sokuon = false; }
    out += r;
  }
  return out;
}
const HAS_JA = /[぀-ヿ㐀-鿿豈-﫿々〆ヶ]/;
const HAS_KANJI = /[㐀-鿿豈-﫿々〆ヶ]/;

let tokenizerP = null;
function getTokenizer(onWait) {
  if (!tokenizerP) {
    onWait && onWait();
    tokenizerP = new Promise((res, rej) => {
      if (!window.kuromoji) return rej(new Error('kuromoji missing'));
      window.kuromoji.builder({ dicPath: window.EVE_CDN ? 'https://cdn.jsdelivr.net/npm/kuromoji@0.1.2/dict/' : 'vendor/dict/' }).build((err, t) => (err ? rej(err) : res(t)));
    }).catch((e) => { tokenizerP = null; throw e; });
  }
  return tokenizerP;
}

/* Turn any text into a romanized string ready for Eve glyphs. */
async function romanize(text, { onWait } = {}) {
  text = text.normalize('NFKC');
  if (!HAS_JA.test(text)) return text.replace(/\s+/g, ' ').trim();
  let tk = null;
  try { tk = await getTokenizer(onWait); } catch (e) { console.warn('dictionary unavailable', e); }
  if (!tk) return kanaToRomaji(text).replace(/\s+/g, ' ').trim();   // kana still works; kanji stay as-is
  const toks = tk.tokenize(text);
  let out = '';
  for (const t of toks) {
    const surf = t.surface_form;
    let r;
    if (t.pos === '助詞' && (surf === 'は' || surf === 'へ' || surf === 'を')) r = { は: 'wa', へ: 'e', を: 'o' }[surf];
    else if (t.pos === '記号' || !HAS_JA.test(surf)) r = surf.split('').map((c) => PUNCT[c] ?? c).join('');
    else r = kanaToRomaji(t.reading && t.reading !== '*' ? t.reading : surf);
    const glue = t.pos === '助動詞' || t.pos_detail_1 === '接続助詞' || t.pos_detail_1 === '接尾' || t.pos_detail_1 === '非自立' || t.pos === '記号' || !out;
    out += (glue ? '' : ' ') + r;
  }
  return out.replace(/\s+([,.!?])/g, '$1').replace(/\s+/g, ' ').trim();
}

/* romaji → hiragana (best guess, for the reverse decoder) */
const ROMA = Object.entries(KANA).filter(([k]) => !/^[ぁぃぅぇぉゃゅょゎゐゑ]$/.test(k) && k !== 'を' && k !== 'ぢ' && k !== 'づ' && !k.startsWith('ぢ'))
  .map(([k, v]) => [v, k]).sort((a, b) => b[0].length - a[0].length);
const ROMA_EXTRA = [['si', 'し'], ['ti', 'ち'], ['tu', 'つ'], ['hu', 'ふ'], ['zi', 'じ'], ['wo', 'を'], ['jya', 'じゃ'], ['jyu', 'じゅ'], ['jyo', 'じょ'], ['sya', 'しゃ'], ['syu', 'しゅ'], ['syo', 'しょ'], ['tya', 'ちゃ'], ['tyu', 'ちゅ'], ['tyo', 'ちょ'], ['la', 'ら'], ['li', 'り'], ['lu', 'る'], ['le', 'れ'], ['lo', 'ろ'], ['ca', 'か'], ['cu', 'く'], ['co', 'こ']];
function romajiToKana(src) {
  const s = src.toLowerCase(); let out = '';
  for (let i = 0; i < s.length;) {
    const c = s[i];
    if (c === ' ') { out += ' '; i++; continue; }
    if (/[0-9]/.test(c)) { out += c; i++; continue; }
    if (c === 'n' && (i + 1 >= s.length || !/[aiueoy]/.test(s[i + 1]))) { out += 'ん'; i++; if (s[i] === "'") i++; continue; }
    if (/[bcdfghjklmprstvwz]/.test(c) && s[i + 1] === c) { out += 'っ'; i++; continue; }
    if (c === 't' && s.startsWith('tch', i)) { out += 'っ'; i++; continue; }
    let hit = null;
    for (const [r, k] of ROMA_EXTRA.concat(ROMA)) { if (s.startsWith(r, i)) { if (!hit || r.length > hit[0].length) hit = [r, k]; } }
    if (hit) { out += hit[1]; i += hit[0].length; } else { out += c; i++; }
  }
  return out;
}

/* ================= sound ================= */
let soundOn = store.get('sound', true);
let actx = null;
function chime(kind = 'cast') {
  if (!soundOn) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    const now = actx.currentTime;
    const master = actx.createGain(); master.gain.value = 0.12; master.connect(actx.destination);
    const notes = kind === 'ok' ? [880, 1318.5] : kind === 'ng' ? [330, 262] : kind === 'charge' ? [440] : [523.25, 659.25, 783.99, 1046.5, 1318.5, 1567.98];
    notes.forEach((f, i) => {
      const o = actx.createOscillator(); const g = actx.createGain();
      o.type = kind === 'ng' ? 'triangle' : 'sine'; o.frequency.value = f;
      const t = now + i * (kind === 'cast' ? 0.09 : 0.11);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.9, t + 0.02); g.gain.exponentialRampToValueAtTime(0.001, t + (kind === 'cast' ? 1.4 : 0.5));
      o.connect(g); g.connect(master); o.start(t); o.stop(t + 1.5);
    });
  } catch { /* audio unavailable */ }
}

/* ================= the magic layer (particles + magic circle) ================= */
class Magic {
  constructor(canvas) { this.c = canvas; this.ctx = canvas.getContext('2d'); this.parts = []; this.circle = null; this.raf = 0; this.dpr = 1; }
  fit() {
    const r = this.c.getBoundingClientRect(); this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.w = r.width; this.h = r.height;
    this.c.width = Math.max(1, Math.round(r.width * this.dpr)); this.c.height = Math.max(1, Math.round(r.height * this.dpr));
  }
  showCircle({ x, y, r, keys }) {
    this.circle = { x, y, r, keys: (keys && keys.length ? keys : ['E', 'V', 'E']).slice(0, 18), a: 0, target: 1, spin: 0, t0: performance.now() };
    this.start();
  }
  hideCircle() { if (this.circle) this.circle.target = 0; }
  morph(src, dst, { dur = 1700 } = {}) {
    return new Promise((resolve) => {
      if (!dst.length) { resolve(); return; }
      const N = Math.min(1500, Math.max(260, src.length, dst.length));
      const pick = (arr, n) => { const out = []; for (let i = 0; i < n; i++) out.push(arr[Math.floor((i / n) * arr.length + Math.random() * (arr.length / n))] || arr[arr.length - 1]); return out; };
      const S = (src.length ? pick(src, N) : pick(dst, N).map((p) => ({ x: p.x + (Math.random() - .5) * 120, y: p.y + 60 + Math.random() * 60 })));
      const D = pick(dst, N);
      S.sort((a, b) => a.x - b.x); D.sort((a, b) => a.x - b.x);
      let minX = Infinity, maxX = -Infinity; for (const p of D) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); }
      const span = Math.max(1, maxX - minX);
      const cx = this.circle ? this.circle.x : this.w / 2, cy = this.circle ? this.circle.y : this.h / 2;
      const t0 = performance.now();
      for (let i = 0; i < N; i++) {
        const a = S[i], b = D[i];
        const ang = Math.random() * Math.PI * 2, rad = 30 + Math.random() * Math.min(this.w, this.h) * .35;
        this.parts.push({
          ax: a.x + (Math.random() - .5) * 2, ay: a.y + (Math.random() - .5) * 2, bx: b.x, by: b.y,
          cx: cx + Math.cos(ang) * rad, cy: cy + Math.sin(ang) * rad - 20,
          d: ((b.x - minX) / span) * 0.35 + Math.random() * 0.08, t0, dur, hue: 165 + Math.random() * 40, s: 0.8 + Math.random() * 1.4,
        });
      }
      this.onDone = resolve; this.morphEnd = t0 + dur * 1.45;
      this.start();
    });
  }
  start() { if (!this.raf) this.raf = requestAnimationFrame((t) => this.frame(t)); }
  frame(now) {
    this.raf = 0;
    const { ctx, dpr } = this;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // fade previous frame for trails
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = 'rgba(0,0,0,0.32)'; ctx.fillRect(0, 0, this.w, this.h);
    ctx.globalCompositeOperation = 'lighter';
    let alive = false;
    const C = this.circle;
    if (C) {
      C.a += (C.target - C.a) * 0.08; C.spin = (now - C.t0) / 1000;
      if (C.target === 0 && C.a < 0.02) this.circle = null; else { alive = true; this.drawCircle(C); }
    }
    if (this.parts.length) {
      alive = true;
      const keep = [];
      for (const p of this.parts) {
        const lt = Math.min(1, Math.max(0, ((now - p.t0) / p.dur - p.d) / 0.62));
        const e = lt < .5 ? 4 * lt * lt * lt : 1 - Math.pow(-2 * lt + 2, 3) / 2;
        const u = 1 - e;
        const x = u * u * p.ax + 2 * u * e * p.cx + e * e * p.bx;
        const y = u * u * p.ay + 2 * u * e * p.cy + e * e * p.by;
        const mid = Math.sin(Math.PI * e);
        const hue = p.hue + mid * 150;
        ctx.fillStyle = `hsla(${hue},95%,${70 + (lt >= 1 ? 25 : mid * 10)}%,${lt >= 1 ? 0.55 : 0.9})`;
        const sz = p.s * (1 + mid * 1.2);
        ctx.fillRect(x - sz / 2, y - sz / 2, sz, sz);
        if (now < this.morphEnd) keep.push(p);
      }
      this.parts = keep;
      if (!keep.length && this.onDone) { const f = this.onDone; this.onDone = null; f(); }
    }
    if (alive) this.start();
    else { ctx.globalCompositeOperation = 'source-over'; ctx.clearRect(0, 0, this.w, this.h); }
  }
  drawCircle(C) {
    const { ctx } = this; const { x, y, r } = C; const a = C.a;
    ctx.save(); ctx.translate(x, y);
    ctx.lineWidth = 1.2;
    const ring = (rr, alpha, dash) => { ctx.beginPath(); ctx.setLineDash(dash || []); ctx.arc(0, 0, rr, 0, Math.PI * 2); ctx.strokeStyle = `rgba(95,201,184,${alpha * a})`; ctx.stroke(); };
    ctx.rotate(C.spin * 0.35);
    ring(r, 0.55); ring(r * 0.86, 0.35, [2, 7]); ring(r * 0.56, 0.4);
    // hexagram
    ctx.setLineDash([]); ctx.strokeStyle = `rgba(255,143,190,${0.35 * a})`;
    for (let k = 0; k < 2; k++) {
      ctx.beginPath();
      for (let i = 0; i <= 3; i++) { const t = (i / 3) * Math.PI * 2 + k * Math.PI / 3 - Math.PI / 2; const px = Math.cos(t) * r * 0.84, py = Math.sin(t) * r * 0.84; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
      ctx.stroke();
    }
    // glyph ring (counter-rotating)
    ctx.rotate(-C.spin * 0.8);
    const n = Math.max(8, C.keys.length);
    const gs = Math.min(34, r * 0.17) / EM_H;
    ctx.fillStyle = `rgba(238,240,255,${0.5 * a})`;
    for (let i = 0; i < n; i++) {
      const k = C.keys[i % C.keys.length]; const t = (i / n) * Math.PI * 2;
      ctx.save(); ctx.rotate(t); ctx.translate(0, -r * 0.71); ctx.scale(gs, gs); ctx.translate(-300, -300); ctx.fill(PATHS[k], 'evenodd'); ctx.restore();
    }
    ctx.restore();
  }
}

/* sample opaque pixels drawn by fn into an offscreen canvas of w×h (CSS px) */
function samplePoints(w, h, fn, step = 2, test) {
  const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h));
  const x = c.getContext('2d', { willReadFrequently: true }); fn(x);
  const d = x.getImageData(0, 0, c.width, c.height).data; const pts = [];
  for (let yy = 0; yy < c.height; yy += step) for (let xx = 0; xx < c.width; xx += step) {
    const i = (yy * c.width + xx) * 4;
    if (test ? test(d, i) : d[i + 3] > 110) pts.push({ x: xx, y: yy });
  }
  return pts;
}

/* ================= toast ================= */
let toastT = 0;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 2200); }

/* ================= saving images ================= */
let downloadsP = null;
async function saveBlob(blob, filename) {
  try {
    if (window.claude && window.claude.use) {
      downloadsP = downloadsP || window.claude.use('downloads');
      const dl = await downloadsP;
      if (dl) { await dl.save({ filename, data: blob }); toast('保存しました'); return; }
    }
  } catch (e) {
    if (e && e.code === 'declined') return;
    if (e && e.code === 'host_unavailable') { toast('このアプリでは保存できません。ブラウザで開いてください'); return; }
  }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

function wrapWords(words, maxW, measure) {
  const lines = []; let cur = [];
  for (const w of words) { const test = cur.concat(w); if (cur.length && measure(test.join(' ')) > maxW) { lines.push(cur); cur = [w]; } else cur = test; }
  if (cur.length) lines.push(cur);
  return lines;
}
function cardImage(romaji, original) {
  const W = 1080, padX = 90, gh = 110;
  const words = romaji.split(' ').filter(Boolean);
  const meas = (s) => layoutLine(s).width * (gh / EM_H);
  const lines = wrapWords(words, W - padX * 2, meas);
  const H = Math.max(1080, 300 + lines.length * (gh + 70) + 200);
  const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
  const bg = x.createLinearGradient(0, 0, W, H); bg.addColorStop(0, '#191b40'); bg.addColorStop(1, '#0b0c1f'); x.fillStyle = bg; x.fillRect(0, 0, W, H);
  const glow = x.createRadialGradient(W * .8, 0, 0, W * .8, 0, W); glow.addColorStop(0, 'rgba(95,201,184,.18)'); glow.addColorStop(1, 'rgba(95,201,184,0)'); x.fillStyle = glow; x.fillRect(0, 0, W, H);
  x.strokeStyle = 'rgba(95,201,184,.25)'; x.lineWidth = 2; x.beginPath(); x.arc(W / 2, H / 2, Math.min(W, H) * .44, 0, Math.PI * 2); x.stroke();
  x.fillStyle = '#a3a6cf'; x.font = '500 34px "Zen Maru Gothic", sans-serif'; x.textAlign = 'center';
  x.fillText(original.length > 30 ? original.slice(0, 30) + '…' : original, W / 2, 150);
  let y = (H - lines.length * (gh + 70)) / 2 + 10;
  for (const ln of lines) {
    const s = ln.join(' '); const L = layoutLine(s); const w = L.width * (gh / EM_H);
    x.fillStyle = '#eef0ff'; drawLine(x, L, (W - w) / 2, y, gh);
    x.fillStyle = '#5fc9b8'; x.font = '500 30px "DM Mono", monospace'; x.fillText(s.toUpperCase(), W / 2, y + gh + 46);
    y += gh + 70;
  }
  x.fillStyle = 'rgba(163,166,207,.8)'; x.font = '500 24px "Zen Maru Gothic", sans-serif'; x.fillText('Eve-language（非公式ファンメイド）', W / 2, H - 60);
  return new Promise((r) => c.toBlob(r, 'image/png'));
}

/* ================= CONVERT view ================= */
const stage = $('#stage'), srcLayer = $('#srcLayer'), outLayer = $('#outLayer'), eveOut = $('#eveOut'), romajiOut = $('#romajiOut'), stageStatus = $('#stageStatus');
const stageMagic = new Magic($('#stageFx'));
let lastRomaji = '', lastOriginal = '', casting = false;

function applyRuby() { eveOut.classList.toggle('no-ruby', !$('#rubyToggle').checked); }
$('#rubyToggle').checked = store.get('ruby', true); applyRuby();
$('#rubyToggle').addEventListener('change', () => { store.set('ruby', $('#rubyToggle').checked); applyRuby(); });

function sizeClass(romaji) { const n = romaji.replace(/\s/g, '').length; eveOut.classList.toggle('small', n > 14 && n <= 40); eveOut.classList.toggle('tiny', n > 40); }

async function cast() {
  const text = $('#src').value.trim();
  if (!text) { toast('ことばを入力してください'); $('#src').focus(); return; }
  if (casting) return; casting = true; $('#cast').disabled = true;
  try {
    // 1) show the source words on the stage
    srcLayer.textContent = text; srcLayer.classList.remove('gone');
    outLayer.style.visibility = 'hidden'; eveOut.classList.remove('reveal');
    stageMagic.fit();
    const sr = stage.getBoundingClientRect();
    stageMagic.showCircle({ x: sr.width / 2, y: sr.height / 2, r: Math.min(sr.width, sr.height) * 0.46, keys: [...text.normalize('NFKC').toUpperCase()].filter((c) => G[c]) });
    chime('charge');
    // 2) romanize (may load the dictionary — the circle keeps charging meanwhile)
    const t0 = performance.now();
    const romaji = await romanize(text, { onWait: () => { stageStatus.textContent = '魔力をためています…（漢字の辞書を読み込み中。初回だけ少し時間がかかります）'; } });
    stageStatus.textContent = '';
    if (!REDUCED) await sleep(Math.max(0, 650 - (performance.now() - t0)));
    // 3) prepare result layout invisibly
    sizeClass(romaji);
    const count = renderEve(eveOut, romaji); applyRuby();
    romajiOut.textContent = romaji.toUpperCase();
    if (!count) { romajiOut.textContent = 'Eve文字にできる文字がありませんでした（アルファベット・数字・かなに対応）'; }
    stageMagic.fit();
    const base = stage.getBoundingClientRect();
    const keysInResult = [...romaji.toUpperCase()].filter((c) => G[c]);
    if (stageMagic.circle) stageMagic.circle.keys = keysInResult.length ? keysInResult : stageMagic.circle.keys;
    if (stageMagic.circle) { stageMagic.circle.x = base.width / 2; stageMagic.circle.y = base.height / 2; stageMagic.circle.r = Math.min(base.width, base.height) * 0.46; }
    if (REDUCED) { srcLayer.classList.add('gone'); outLayer.style.visibility = ''; eveOut.classList.add('reveal'); stageMagic.hideCircle(); }
    else {
      // 4) sample source characters
      const font = getComputedStyle(srcLayer).font;
      const src = samplePoints(base.width, base.height, (x) => {
        x.font = font; x.textBaseline = 'middle'; x.fillStyle = '#fff';
        const node = srcLayer.firstChild; if (!node) return;
        const range = document.createRange();
        for (let i = 0; i < node.length; i++) {
          range.setStart(node, i); range.setEnd(node, i + 1);
          const r = range.getClientRects()[0]; if (!r) continue;
          x.fillText(node.data[i], r.left - base.left, r.top - base.top + r.height / 2);
        }
      }, 2);
      // 5) sample destination glyph outlines
      const dst = samplePoints(base.width, base.height, (x) => {
        x.fillStyle = '#fff';
        eveOut.querySelectorAll('svg').forEach((svg) => {
          const r = svg.getBoundingClientRect(); const vb = svg.viewBox.baseVal; const s = r.width / vb.width;
          x.save(); x.translate(r.left - base.left - vb.x * s, r.top - base.top - vb.y * s); x.scale(s, s);
          x.fill(new Path2D(svg.lastChild.getAttribute('d')), 'evenodd'); x.restore();
        });
      }, 2);
      chime('cast');
      srcLayer.classList.add('gone');
      const p = stageMagic.morph(src, dst, { dur: 1700 });
      await sleep(1700 * 0.9);
      outLayer.style.visibility = ''; eveOut.classList.add('reveal');
      stageMagic.hideCircle();
      await p;
    }
    outLayer.style.visibility = '';
    lastRomaji = romaji; lastOriginal = text;
  } catch (e) {
    console.error(e); toast('うまく変換できませんでした。もう一度試してください');
    srcLayer.classList.add('gone'); outLayer.style.visibility = '';
  } finally { casting = false; $('#cast').disabled = false; }
}
$('#cast').addEventListener('click', cast);
$('#src').addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) cast(); });

$('#copyRomaji').addEventListener('click', () => {
  const t = (lastRomaji || '').toUpperCase(); if (!t) return;
  const fallback = () => { const ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); toast('コピーしました'); } catch { toast(t); } ta.remove(); };
  try { navigator.clipboard.writeText(t).then(() => toast('コピーしました'), fallback); } catch { fallback(); }
});
$('#saveImg').addEventListener('click', async () => {
  if (!lastRomaji) return;
  const blob = await cardImage(lastRomaji, lastOriginal);
  saveBlob(blob, 'eve-go.png');
});

/* initial resting state: show the example already converted */
(function initial() {
  const ex = $('#src').value;
  const r = kanaToRomaji(ex.normalize('NFKC'));
  sizeClass(r); renderEve(eveOut, r); applyRuby(); romajiOut.textContent = r.toUpperCase();
  lastRomaji = r; lastOriginal = ex;
})();

/* ---- direction toggle & reverse keyboard ---- */
function setDir(rev) {
  $('#dirFwd').setAttribute('aria-pressed', String(!rev)); $('#dirRev').setAttribute('aria-pressed', String(rev));
  $('#fwd').hidden = rev; $('#rev').hidden = !rev;
}
$('#dirFwd').addEventListener('click', () => setDir(false));
$('#dirRev').addEventListener('click', () => setDir(true));

let revText = 'yume';
function updateRev() {
  renderEve($('#revOut'), revText, { ruby: false });
  $('#revPh').hidden = !!revText;
  $('#revLatin').textContent = revText ? revText.toUpperCase() : '—';
  const kana = romajiToKana(revText);
  $('#revKana').textContent = revText && /[぀-ゟ]/.test(kana) ? kana : '—';
}
const kb = $('#keyboard');
for (const k of KEYS) {
  const b = document.createElement('button'); b.type = 'button'; b.className = 'key'; b.setAttribute('aria-label', k);
  b.appendChild(glyphSVG(k, { stroke: false }));
  b.addEventListener('click', () => { if (revText.length < 80) { revText += k.toLowerCase(); updateRev(); } });
  kb.appendChild(b);
}
$('#kSpace').addEventListener('click', () => { if (revText && !revText.endsWith(' ')) { revText += ' '; updateRev(); } });
$('#kBack').addEventListener('click', () => { revText = revText.slice(0, -1); updateRev(); });
$('#kClear').addEventListener('click', () => { revText = ''; updateRev(); });
updateRev();

/* ================= CAMERA view ================= */
const video = $('#video'), photo = $('#photo'), camMagic = new Magic($('#camFx'));
let stream = null, ocrLang = 'jpn', camBusy = false, camState = 'empty';
const workers = {};
function camStatus(msg) { const s = $('#camStatus'); s.hidden = !msg; s.textContent = msg || ''; }
function setCamState(st) {
  camState = st;
  $('#camEmpty').hidden = st !== 'empty';
  video.hidden = st !== 'live';
  photo.hidden = !(st === 'photo' || st === 'done');
  $('#reticle').hidden = !(st === 'live' || st === 'photo');
  $('#camCast').hidden = !(st === 'live' || st === 'photo');
  $('#camRetry').hidden = !(st === 'photo' || st === 'done' || st === 'live');
  $('#camSave').hidden = st !== 'done';
}
function setOcrLang(l) { ocrLang = l; $('#ocrJa').setAttribute('aria-pressed', String(l === 'jpn')); $('#ocrEn').setAttribute('aria-pressed', String(l === 'eng')); }
$('#ocrJa').addEventListener('click', () => setOcrLang('jpn'));
$('#ocrEn').addEventListener('click', () => setOcrLang('eng'));

async function startCamera() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { toast('この画面ではカメラを使えません。「写真を撮る・選ぶ」を使ってください'); return; }
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
    video.srcObject = stream; await video.play(); setCamState('live');
  } catch (e) {
    console.warn(e); toast('カメラを起動できませんでした。「写真を撮る・選ぶ」から撮影できます');
  }
}
function stopCamera() { if (stream) { stream.getTracks().forEach((t) => t.stop()); stream = null; } }
$('#camStart').addEventListener('click', startCamera);

function loadToPhoto(src) { // src: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement
  const sw = src.videoWidth || src.naturalWidth || src.width, sh = src.videoHeight || src.naturalHeight || src.height;
  const sc = Math.min(1, 1600 / Math.max(sw, sh));
  photo.width = Math.round(sw * sc); photo.height = Math.round(sh * sc);
  photo.getContext('2d').drawImage(src, 0, 0, photo.width, photo.height);
}
$('#fileIn').addEventListener('change', (e) => {
  const f = e.target.files && e.target.files[0]; if (!f) return;
  const img = new Image(); img.onload = () => { stopCamera(); loadToPhoto(img); URL.revokeObjectURL(img.src); setCamState('photo'); $('#camResults').textContent = ''; camStatus('「魔法をかける」を押してください'); };
  img.onerror = () => toast('画像を読み込めませんでした');
  img.src = URL.createObjectURL(f); e.target.value = '';
});

function makeSample() {
  const c = document.createElement('canvas'); c.width = 1200; c.height = 800; const x = c.getContext('2d');
  // a chalkboard café sign
  const g = x.createLinearGradient(0, 0, 0, 800); g.addColorStop(0, '#6d5a46'); g.addColorStop(1, '#4b3d30'); x.fillStyle = g; x.fillRect(0, 0, 1200, 800);
  x.fillStyle = '#25302b'; x.fillRect(110, 90, 980, 620);
  for (let i = 0; i < 2500; i++) { x.fillStyle = `rgba(255,255,255,${Math.random() * .04})`; x.fillRect(110 + Math.random() * 980, 90 + Math.random() * 620, 2, 2); }
  x.fillStyle = '#f3efe2'; x.textAlign = 'center';
  if (ocrLang === 'jpn') {
    x.font = '700 120px "Zen Maru Gothic", "Hiragino Sans", "Noto Sans JP", sans-serif'; x.fillText('ほしぞら', 600, 300);
    x.font = '700 92px "Zen Maru Gothic", "Hiragino Sans", "Noto Sans JP", sans-serif'; x.fillText('カフェ', 600, 450);
    x.font = '500 70px "Zen Maru Gothic", "Hiragino Sans", "Noto Sans JP", sans-serif'; x.fillText('OPEN 18:00', 600, 590);
  } else {
    x.font = '700 130px "DM Mono", monospace'; x.fillText('MOON', 600, 300);
    x.font = '700 100px "DM Mono", monospace'; x.fillText('CAFE', 600, 450);
    x.font = '500 72px "DM Mono", monospace'; x.fillText('OPEN 18:00', 600, 590);
  }
  return c;
}
$('#sampleBtn').addEventListener('click', () => { stopCamera(); loadToPhoto(makeSample()); setCamState('photo'); $('#camResults').textContent = ''; camStatus('見本の写真です。「魔法をかける」を押してください'); });
$('#camRetry').addEventListener('click', () => { camMagic.parts = []; camMagic.hideCircle(); $('#camResults').textContent = ''; camStatus(''); if (stream) setCamState('live'); else setCamState('empty'); });

function getWorker(lang) {
  if (!workers[lang]) {
    // OCR model data ships base64-encoded as .txt (see the patch note at the top of vendor/worker.min.js).
    // window.EVE_CDN (GitHub Pages build): worker, core and model come from jsDelivr instead of ./vendor
    const paths = window.EVE_CDN
      ? { langPath: `https://cdn.jsdelivr.net/npm/@tesseract.js-data/${lang}@1.0.0/4.0.0_best_int` }
      : { workerPath: abs('vendor/worker.min.js'), corePath: abs('vendor/core'), langPath: abs('vendor/lang') };
    workers[lang] = window.Tesseract.createWorker(lang, 1, {
      ...paths,
      gzip: true, cacheMethod: 'none',
      logger: (m) => { if (m.status && typeof m.progress === 'number' && camBusy) camStatus(ocrStatusText(m)); },
    })
      .catch((e) => { delete workers[lang]; throw e; });
  }
  return workers[lang];
}
function ocrStatusText(m) {
  const p = Math.round(m.progress * 100);
  if (/loading|initializ/.test(m.status)) return `魔力をためています…（読み取りデータ ${p}%）`;
  if (/recogniz/.test(m.status)) return `文字を読みとっています… ${p}%`;
  return '準備中…';
}

function analyzeBox(ctx, b) {
  const w = b.x1 - b.x0, h = b.y1 - b.y0;
  const d = ctx.getImageData(b.x0, b.y0, w, h).data;
  const lum = (i) => 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
  const border = [];
  for (let x = 0; x < w; x += 2) { border.push((x) * 4, ((h - 1) * w + x) * 4); }
  for (let y = 0; y < h; y += 2) { border.push((y * w) * 4, (y * w + w - 1) * 4); }
  border.sort((a, c) => lum(a) - lum(c));
  const bi = border[Math.floor(border.length / 2)];
  const bg = [d[bi], d[bi + 1], d[bi + 2]], bgL = lum(bi);
  let r = 0, g = 0, bb = 0, n = 0;
  for (let i = 0; i < d.length; i += 4 * 3) { if (Math.abs(lum(i) - bgL) > 70) { r += d[i]; g += d[i + 1]; bb += d[i + 2]; n++; } }
  const ink = n ? [r / n, g / n, bb / n] : (bgL > 128 ? [20, 20, 30] : [240, 240, 250]);
  return { bg, ink, bgL };
}

async function camCast() {
  if (camBusy) return;
  camBusy = true; $('#camCast').disabled = true;
  try {
    if (camState === 'live') { loadToPhoto(video); stopCamera(); setCamState('photo'); }
    const pctx = photo.getContext('2d', { willReadFrequently: true });
    camMagic.fit();
    const fr = $('#camFx').getBoundingClientRect(), pr = photo.getBoundingClientRect();
    const ox = pr.left - fr.left, oy = pr.top - fr.top, sc = pr.width / photo.width;
    camMagic.showCircle({ x: ox + pr.width / 2, y: oy + pr.height / 2, r: Math.min(pr.width, pr.height) * 0.42, keys: ['E', 'V', 'E'] });
    chime('charge');
    camStatus('魔力をためています…');
    if (!window.Tesseract) throw new Error('ocr-missing');
    const worker = await getWorker(ocrLang);
    camStatus('文字を読みとっています…');
    const { data } = await worker.recognize(photo);
    let lines = (data.lines || []).map((l) => ({ text: l.text.trim(), bbox: l.bbox, conf: l.confidence }))
      .filter((l) => l.text && l.conf > 35 && (l.bbox.x1 - l.bbox.x0) > 8 && (l.bbox.y1 - l.bbox.y0) > 8);
    lines.forEach((l) => { if (ocrLang === 'jpn') l.text = l.text.replace(/(?<=[^\x00-\x7f])\s+(?=[^\x00-\x7f])/g, '').replace(/\s+/g, ' '); });
    if (!lines.length) { camMagic.hideCircle(); camStatus('文字が見つかりませんでした。文字を大きく・明るくうつしてもう一度'); setCamState('photo'); return; }
    camStatus('魔法をかけています…');
    const results = [];
    for (const l of lines) results.push({ ...l, romaji: await romanize(l.text, { onWait: () => camStatus('漢字の辞書を読み込み中…（初回だけ）') }) });
    const keys = results.flatMap((r) => [...r.romaji.toUpperCase()].filter((c) => G[c]));
    if (camMagic.circle && keys.length) camMagic.circle.keys = keys;

    // sample source ink pixels & plan glyph placement in photo coordinates
    const plans = results.map((r) => {
      const b = { x0: Math.max(0, r.bbox.x0 - 2), y0: Math.max(0, r.bbox.y0 - 2), x1: Math.min(photo.width, r.bbox.x1 + 2), y1: Math.min(photo.height, r.bbox.y1 + 2) };
      const info = analyzeBox(pctx, b);
      const L = layoutLine(r.romaji);
      const bw = b.x1 - b.x0, bh = b.y1 - b.y0;
      let gh = bh * 1.0; let w = L.width * gh / EM_H;
      if (w > bw * 1.25) { gh *= (bw * 1.25) / w; w = L.width * gh / EM_H; }
      gh = Math.max(gh, Math.min(bh, 14)); w = L.width * gh / EM_H;
      const left = b.x0 + (bw - w) / 2, top = b.y0 + (bh - gh) / 2;
      return { r, b, info, L, gh, left, top };
    });
    const src = [], dst = [];
    for (const p of plans) {
      const { b, info } = p; const bw = b.x1 - b.x0, bh = b.y1 - b.y0;
      const img = pctx.getImageData(b.x0, b.y0, bw, bh).data; const step = Math.max(2, Math.round(bh / 22));
      for (let y = 0; y < bh; y += step) for (let x = 0; x < bw; x += step) {
        const i = (y * bw + x) * 4; const L = 0.299 * img[i] + 0.587 * img[i + 1] + 0.114 * img[i + 2];
        if (Math.abs(L - info.bgL) > 70) src.push({ x: ox + (b.x0 + x) * sc, y: oy + (b.y0 + y) * sc });
      }
      const pts = samplePoints(photo.width, photo.height, (x) => { x.fillStyle = '#fff'; drawLine(x, p.L, p.left, p.top, p.gh); }, Math.max(2, Math.round(p.gh / 26)));
      for (const q of pts) dst.push({ x: ox + q.x * sc, y: oy + q.y * sc });
    }
    // erase original text
    for (const p of plans) {
      const { b, info } = p; const c = `rgb(${info.bg.map(Math.round).join(',')})`;
      pctx.save(); pctx.fillStyle = c; pctx.filter = 'blur(4px)'; pctx.fillRect(b.x0 - 4, b.y0 - 4, b.x1 - b.x0 + 8, b.y1 - b.y0 + 8); pctx.restore();
      pctx.fillStyle = c; pctx.fillRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
    }
    chime('cast');
    const done = REDUCED ? Promise.resolve() : camMagic.morph(src, dst, { dur: 1900 });
    if (!REDUCED) await sleep(1900 * 0.95);
    for (const p of plans) { pctx.fillStyle = `rgb(${p.info.ink.map(Math.round).join(',')})`; drawLine(pctx, p.L, p.left, p.top, p.gh); }
    camMagic.hideCircle();
    await done;
    setCamState('done'); camStatus('');
    // list results
    const list = $('#camResults'); list.textContent = '';
    for (const r of results) {
      const it = document.createElement('div'); it.className = 'item';
      const o = document.createElement('div'); o.className = 'orig'; o.textContent = r.text;
      const rm = document.createElement('div'); rm.className = 'rom'; rm.textContent = r.romaji.toUpperCase();
      const e = document.createElement('div'); e.className = 'eve-out tiny'; renderEve(e, r.romaji, { ruby: false });
      it.append(o, rm, e); list.appendChild(it);
    }
  } catch (e) {
    console.error(e); camMagic.hideCircle();
    camStatus(''); toast(String(e && e.message) === 'ocr-missing' ? '読み取り機能を読み込めませんでした' : '読み取りに失敗しました。もう一度試してください');
  } finally { camBusy = false; $('#camCast').disabled = false; }
}
$('#camCast').addEventListener('click', camCast);
$('#camSave').addEventListener('click', () => photo.toBlob((b) => b && saveBlob(b, 'eve-go-photo.png'), 'image/png'));

/* ================= LEARN view ================= */
/* Eveにまつわる言葉（曲名・アルバム名）。r は変換タブと同じ方式のローマ字。 */
const WORDS = [
  { t: 'Eve', r: 'eve', kind: 'アーティスト名' },
  { t: '廻廻奇譚', r: 'kaikai kitan', kind: '曲' },
  { t: 'ドラマツルギー', r: 'doramatsurugii', kind: '曲' },
  { t: '心予報', r: 'kokoro yohou', kind: '曲' },
  { t: 'お気に召すまま', r: 'oki ni mesu mama', kind: '曲' },
  { t: '群青讃歌', r: 'gunjou sanka', kind: '曲' },
  { t: '平行線', r: 'heikousen', kind: '曲' },
  { t: '花嵐', r: 'hana arashi', kind: '曲' },
  { t: '蒼のワルツ', r: 'ao no warutsu', kind: '曲' },
  { t: '夜は仄か', r: 'yoru wa honoka', kind: '曲' },
  { t: '闇夜', r: 'yamiyo', kind: '曲' },
  { t: '杪夏', r: 'byouka', kind: '曲' },
  { t: 'ぼくらの', r: 'bokura no', kind: '曲' },
  { t: 'アウトサイダー', r: 'autosaidaa', kind: '曲' },
  { t: 'ナンセンス文学', r: 'nansensu bungaku', kind: '曲' },
  { t: '君に世界', r: 'kimi ni sekai', kind: '曲' },
  { t: '会心劇', r: 'kaishingeki', kind: '曲' },
  { t: 'ファイトソング', r: 'faito songu', kind: '曲' },
  { t: 'レーゾンデートル', r: 'reezon deetoru', kind: '曲' },
  { t: 'sister', r: 'sister', kind: '曲' },
  { t: 'Bubble', r: 'bubble', kind: '曲' },
  { t: '文化', r: 'bunka', kind: 'アルバム' },
  { t: 'おとぎ', r: 'otogi', kind: 'アルバム' },
  { t: 'Smile', r: 'smile', kind: 'アルバム' },
  { t: '廻人', r: 'kaijin', kind: 'アルバム' },
  { t: 'harapeco', r: 'harapeco', kind: 'Eve用語' },
  { t: 'ボカロP', r: 'bokaro p', kind: 'Eve用語' },
  { t: 'ZINGAI', r: 'zingai', kind: 'Eve用語' },
];
const chart = $('#chart'); let selected = 'E'; const exampleTurn = {};
function showDetail(k) {
  selected = k;
  chart.querySelectorAll('.cell').forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.k === k)));
  const d = $('#detail'); d.textContent = '';
  const big = document.createElement('div'); big.className = 'big reveal'; big.appendChild(glyphSVG(k));
  const info = document.createElement('div');
  const h = document.createElement('h3'); h.textContent = 'Eve文字'; const sp = document.createElement('span'); sp.textContent = k; h.appendChild(sp);
  const p = document.createElement('p');
  const isNum = /[0-9]/.test(k);
  p.textContent = isNum ? `数字の「${k}」です。` : `アルファベットの「${k}」（小文字 ${k.toLowerCase()}）です。`;
  info.append(h, p);
  const hits = WORDS.filter((w) => w.r.toUpperCase().includes(k));
  const ex = document.createElement('div'); ex.className = 'ex';
  if (hits.length) {
    // rotate through the matching titles each time the letter is opened
    hits.sort((a, b) => a.r.replace(/ /g, '').length - b.r.replace(/ /g, '').length);
    exampleTurn[k] = ((exampleTurn[k] ?? -1) + 1) % hits.length;
    const shown = [hits[exampleTurn[k]]];
    const exl = document.createElement('span'); exl.className = 'note'; exl.textContent = 'Eveの言葉で見てみよう';
    ex.appendChild(exl);
    for (const w of shown) {
      const row = document.createElement('div'); row.className = 'ex-item';
      const ttl = document.createElement('span'); ttl.className = 'ex-title'; ttl.textContent = w.t;
      const kd = document.createElement('span'); kd.className = 'ex-kind'; kd.textContent = w.kind;
      ttl.appendChild(kd);
      const exe = document.createElement('div'); exe.className = 'eve-out tiny'; renderEve(exe, w.r, { ruby: true, hl: k });
      row.append(ttl, exe); ex.appendChild(row);
    }
    if (hits.length > 1) {
      const more = document.createElement('button'); more.type = 'button'; more.className = 'btn ex-more'; more.textContent = `ほかの例（${exampleTurn[k] + 1} / ${hits.length}）`;
      more.addEventListener('click', () => showDetail(k)); ex.appendChild(more);
    }
  } else {
    const exl = document.createElement('span'); exl.className = 'note';
    exl.textContent = isNum ? '数字は日付や数を書くときに使います。' : 'レア文字！Eveの言葉にはほぼ出てきません。';
    ex.appendChild(exl);
  }
  info.appendChild(ex);
  d.append(big, info);
}
for (const k of KEYS) {
  const b = document.createElement('button'); b.type = 'button'; b.className = 'cell'; b.dataset.k = k; b.setAttribute('aria-label', 'Eve文字 ' + k);
  b.appendChild(glyphSVG(k, { stroke: false }));
  const l = document.createElement('span'); l.className = 'lt'; l.textContent = k; b.appendChild(l);
  b.addEventListener('click', () => showDetail(k));
  chart.appendChild(b);
}
showDetail('E');

function setLearn(q) { $('#lChart').setAttribute('aria-pressed', String(!q)); $('#lQuiz').setAttribute('aria-pressed', String(q)); $('#chartPane').hidden = q; $('#quizPane').hidden = !q; if (q && !quiz.qs) newRound(); }
$('#lChart').addEventListener('click', () => setLearn(false));
$('#lQuiz').addEventListener('click', () => setLearn(true));

const quiz = { mode: 'char', qs: null, i: 0, score: 0, locked: false };
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
function makeQs() {
  const qs = [];
  for (let n = 0; n < 10; n++) {
    if (quiz.mode === 'char') {
      const pool = n < 6 ? KEYS.slice(0, 26) : KEYS;
      const ans = pool[Math.floor(Math.random() * pool.length)];
      const opts = shuffle([ans, ...shuffle(pool.split('').filter((c) => c !== ans)).slice(0, 3)]);
      qs.push({ type: n % 2 ? 'letter2glyph' : 'glyph2letter', ans, opts });
    } else {
      const pool = WORDS.filter((w) => w.r.replace(/ /g, '').length <= 11 && !qs.some((q) => q.ans === w));
      const ans = pool[Math.floor(Math.random() * pool.length)];
      const opts = shuffle([ans, ...shuffle(WORDS.filter((w) => w !== ans)).slice(0, 3)]);
      qs.push({ type: 'word', ans, opts });
    }
  }
  return qs;
}
function newRound() { quiz.qs = makeQs(); quiz.i = 0; quiz.score = 0; renderQ(); }
function setQuizMode(m) { quiz.mode = m; $('#qmChar').setAttribute('aria-pressed', String(m === 'char')); $('#qmWord').setAttribute('aria-pressed', String(m === 'word')); newRound(); }
$('#qmChar').addEventListener('click', () => setQuizMode('char'));
$('#qmWord').addEventListener('click', () => setQuizMode('word'));

function renderQ() {
  const box = $('#quiz'); box.textContent = ''; quiz.locked = false;
  if (quiz.i >= quiz.qs.length) return renderEnd();
  const q = quiz.qs[quiz.i];
  const head = document.createElement('div'); head.className = 'qhead';
  const a = document.createElement('span'); a.textContent = `第${quiz.i + 1}問 / ${quiz.qs.length}`;
  const b = document.createElement('span'); b.textContent = `正解 ${quiz.score}`;
  head.append(a, b);
  const prompt = document.createElement('div'); prompt.className = 'prompt';
  const ask = document.createElement('p'); ask.className = 'ask';
  if (q.type === 'glyph2letter') { prompt.appendChild(glyphSVG(q.ans, { stroke: false })); ask.textContent = 'このEve文字はどれ？'; }
  else if (q.type === 'letter2glyph') { const s = document.createElement('span'); s.className = 'q-letter'; s.textContent = q.ans; prompt.appendChild(s); ask.textContent = 'このアルファベットのEve文字はどれ？'; }
  else { const e = document.createElement('div'); e.className = 'eve-out'; renderEve(e, q.ans.r, { ruby: false }); prompt.appendChild(e); ask.textContent = 'なんて書いてある？'; }
  const opts = document.createElement('div'); opts.className = 'opts';
  const fb = document.createElement('div'); fb.className = 'feedback'; fb.setAttribute('aria-live', 'polite');
  q.opts.forEach((o) => {
    const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'opt';
    if (q.type === 'letter2glyph') { btn.appendChild(glyphSVG(o, { stroke: false })); btn.setAttribute('aria-label', '選択肢'); }
    else if (q.type === 'word') { btn.classList.add('opt-title'); const t = document.createElement('span'); t.textContent = o.t; const r = document.createElement('small'); r.textContent = o.r.toUpperCase(); btn.append(t, r); }
    else btn.textContent = o.toUpperCase();
    btn.addEventListener('click', () => {
      if (quiz.locked) return; quiz.locked = true;
      const ok = o === q.ans;
      if (ok) { quiz.score++; chime('ok'); fb.textContent = q.type === 'word' ? `正解！「${q.ans.t}」` : '正解！'; fb.style.color = 'var(--gold)'; }
      else { chime('ng'); fb.textContent = q.type === 'word' ? `正解は「${q.ans.t}」` : `正解は ${q.ans.toUpperCase()}`; fb.style.color = 'var(--danger)'; btn.classList.add('ng'); }
      [...opts.children].forEach((c, idx) => { if (q.opts[idx] === q.ans) c.classList.add('ok'); });
      b.textContent = `正解 ${quiz.score}`;
      setTimeout(() => { quiz.i++; renderQ(); }, ok ? 700 : 1400);
    });
    opts.appendChild(btn);
  });
  box.append(head, prompt, ask, opts, fb);
}
function renderEnd() {
  const box = $('#quiz');
  const key = 'best-' + quiz.mode; const best = Math.max(store.get(key, 0), quiz.score); store.set(key, best);
  const end = document.createElement('div'); end.className = 'end';
  const sc = document.createElement('div'); sc.className = 'score'; sc.textContent = String(quiz.score); const sm = document.createElement('small'); sm.textContent = ` / ${quiz.qs.length}`; sc.appendChild(sm);
  const msg = document.createElement('p'); msg.className = 'note';
  msg.textContent = (quiz.score === quiz.qs.length ? 'パーフェクト！Eve語マスターです。' : quiz.score >= 7 ? 'あと少しで全問正解です。' : '文字表を見ながらもう一度挑戦してみましょう。') + `（自己ベスト ${best}）`;
  const again = document.createElement('button'); again.type = 'button'; again.className = 'cast'; again.textContent = 'もう一度';
  again.addEventListener('click', newRound);
  end.append(sc, msg, again); box.appendChild(end);
  if (quiz.score >= 7) chime('cast');
}

/* ================= tabs / routing / header ================= */
const VIEWS = ['convert', 'camera', 'learn'];
function route() {
  const v = VIEWS.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'convert';
  for (const n of VIEWS) $('#v-' + n).hidden = n !== v;
  document.querySelectorAll('nav.tabs a').forEach((a) => { if (a.dataset.view === v) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  if (v !== 'camera') { stopCamera(); if (camState === 'live') setCamState('empty'); }
  store.set('view', v);
}
window.addEventListener('hashchange', route);
route();

const logo = $('#logoMark'); for (const k of 'EVE') logo.appendChild(glyphSVG(k, { stroke: false }));
function paintSound() {
  $('#soundBtn').setAttribute('aria-pressed', String(soundOn));
  $('#soundBtn .on').toggleAttribute('hidden', !soundOn); $('#soundBtn .off').toggleAttribute('hidden', soundOn);
  $('#soundBtn').setAttribute('aria-label', soundOn ? '効果音をオフにする' : '効果音をオンにする');
}
$('#soundBtn').addEventListener('click', () => { soundOn = !soundOn; store.set('sound', soundOn); paintSound(); if (soundOn) chime('ok'); });
paintSound();

window.addEventListener('resize', () => { stageMagic.fit(); camMagic.fit(); });
})();
