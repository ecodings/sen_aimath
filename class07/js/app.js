import { N, SCENE, prepareSample, colorOf, COCO_KO } from './data.js';
import { loadModel, detect, iou, nms } from './detector.js';

/* =========================================================
   공통
   ========================================================= */
const $ = id => document.getElementById(id);
const FONT = '"GmarketSans", "Malgun Gothic", sans-serif';
const BFONT = '"GmarketSansBold", "GmarketSans", "Malgun Gothic", sans-serif';
const C = { navy: '#1B2A41', bl: '#2F5FB3', blD: '#244A8E', blT: '#E3EBF8', yel: '#F2A93B', yelD: '#9A6508', co: '#D9604F',
  cy: '#00A6C8', cyD: '#00758D', ice: '#F3F6F9', muted: '#4A5A6B', muted2: '#6B7A8A', line: '#D5DEE5', gray: '#9AA5B1' };
const r2 = v => Math.round(v * 100) / 100;
const fmt = v => String(r2(v));
const STORE = 'yololab.samples.v1';
const VEIL = 0.42;

const imgCache = new Map();
function loadImg(src) {
  if (imgCache.has(src)) return imgCache.get(src);
  const p = new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error('그림을 열 수 없어요')); im.src = src; });
  imgCache.set(src, p);
  p.catch(() => imgCache.delete(src));
  return p;
}

// 사용자가 고른 파일 → 그림 (JPG·PNG·WEBP 등). 실패하면 이유를 담은 오류
async function fileToImage(f) {
  if (f.type && !f.type.startsWith('image/')) throw new Error('사진 파일이 아니에요.');
  const url = URL.createObjectURL(f);
  try {
    return await new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = url; });
  } catch { /* 아래 방법으로 한 번 더 */ }
  try {
    const bmp = await createImageBitmap(f);
    const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height;
    c.getContext('2d').drawImage(bmp, 0, 0);
    return c;
  } catch { /* 열 수 없음 */ }
  const heic = /\.(heic|heif)$/i.test(f.name) || /hei[cf]/i.test(f.type);
  throw new Error(heic ? '아이폰 HEIC 사진은 브라우저에서 열 수 없어요. JPG로 바꿔서 올려 주세요.' : '이 파일은 열 수 없어요. JPG·PNG 사진인지 확인해 주세요.');
}

function font(ctx, size, bold) { ctx.font = `${bold ? '700 ' : ''}${size}px ${bold ? BFONT : FONT}`; }
function rgba(hex, a) { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; }

function rect(ctx, x0, y0, x1, y1, color, lw = 3, dash = null, fill = null) {
  ctx.save();
  if (fill) { ctx.fillStyle = fill; ctx.fillRect(x0, y0, x1 - x0, y1 - y0); }
  ctx.strokeStyle = color; ctx.lineWidth = lw;
  if (dash) ctx.setLineDash(dash);
  ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
  ctx.restore();
}
function dot(ctx, x, y, color, r = 8) {
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = color; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = '#fff'; ctx.stroke();
}
// 고른 칸만 남기고 나머지를 흰 막으로 덮기
function veil(ctx, x, y, w, h, hole = null, a = VEIL) {
  ctx.save(); ctx.fillStyle = `rgba(255,255,255,${a})`; ctx.beginPath(); ctx.rect(x, y, w, h);
  if (hole) ctx.rect(hole[0], hole[1], hole[2] - hole[0], hole[3] - hole[1]);
  ctx.fill('evenodd'); ctx.restore();
}
// 고른 칸: 흰 테두리 + 굵은 청록 테두리
function selCell(ctx, x0, y0, x1, y1) { rect(ctx, x0, y0, x1, y1, '#fff', 14); rect(ctx, x0, y0, x1, y1, C.cy, 8); }
// 고른 상자: 흰 테두리 + 원래 색 굵게
function selBox(ctx, x0, y0, x1, y1, col, lw = 7) { rect(ctx, x0, y0, x1, y1, '#fff', lw + 4); rect(ctx, x0, y0, x1, y1, col, lw); }
function faintBox(ctx, x0, y0, x1, y1, col) { rect(ctx, x0, y0, x1, y1, rgba(col, 0.6), 2.5, [9, 7]); }

// 이름표: 서로 겹치지 않는 자리를 골라 그리기 (상자 위 → 상자 안 → 오른쪽 → 아래)
function placeTags(ctx, items, bx = [0, 0, ctx.canvas.width, ctx.canvas.height]) {
  const placed = [];
  const hit = a => placed.some(b => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y);
  for (const it of items) {
    const size = it.size || 20;
    font(ctx, size, true);
    const w = ctx.measureText(it.text).width + 16, h = size + 12;
    const clamp = (x, y) => ({ x: Math.max(bx[0], Math.min(bx[2] - w, x)), y: Math.max(bx[1], Math.min(bx[3] - h, y)), w, h });
    const tries = [[it.x0, it.y0 - h], [it.x0 + 4, it.y0 + 4], [it.x1 - w, it.y0 - h], [it.x1 - w - 4, it.y0 + 4], [it.x0 + 4, it.y1 - h - 4], [it.x0, it.y1]];
    let r = null;
    for (const [x, y] of tries) { const c = clamp(x, y); if (!hit(c)) { r = c; break; } }
    if (!r) { r = clamp(it.x0, it.y0 + 4); let g = 30; while (hit(r) && g--) r.y += h + 2; }
    placed.push(r);
    ctx.fillStyle = it.color; ctx.fillRect(r.x, r.y, w, h);
    ctx.fillStyle = '#fff'; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    font(ctx, size, true); ctx.fillText(it.text, r.x + 8, r.y + h / 2 + 1);
  }
}

/* =========================================================
   예시 사진 목록
   ========================================================= */
let samples = [SCENE];
let cur = SCENE;
let tryList = [];

function userSamples() { try { return JSON.parse(localStorage.getItem(STORE) || '[]'); } catch { return []; } }
function saveUserSamples(list) { try { localStorage.setItem(STORE, JSON.stringify(list)); return true; } catch { alert('브라우저 저장 공간이 부족해요. 파일로 내보내 보관해 주세요.'); return false; } }

async function loadSamples() {
  const bundled = [];
  try {
    const idx = await (await fetch('samples/index.json', { cache: 'no-store' })).json();
    tryList = idx.try || [];
    for (const f of idx.samples || []) {
      try { const s = await (await fetch('samples/' + f)).json(); s.bundled = true; bundled.push(s); } catch { /* 건너뜀 */ }
    }
  } catch { /* 폴더가 없어도 동작 */ }
  samples = [SCENE, ...bundled, ...userSamples()].map(prepareSample);
  fillSampleSel(); fillTryPick(); fillMinePick();
}

function fillSampleSel() {
  const sel = $('sampleSel');
  sel.innerHTML = samples.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
  if (!samples.find(s => s.id === cur.id)) cur = samples[0];
  sel.value = cur.id;
}
$('sampleSel').addEventListener('change', e => {
  cur = samples.find(s => s.id === e.target.value) || samples[0];
  resetForSample();
  renderPage();
});

// 장면 캔버스: 예시 사진을 그리고 격자 단위(0~7) → 픽셀 변환을 돌려준다. pad = 눈금 숫자용 여백
async function scene(cv, opts = {}) {
  const im = await loadImg(cur.src);
  const pad = opts.pad || 0;
  const W = (opts.W || 800), H = Math.round(W * im.height / im.width);
  if (cv.width !== W + pad) cv.width = W + pad;
  if (cv.height !== H + pad) cv.height = H + pad;
  const ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, cv.width, cv.height);
  if (pad) { ctx.fillStyle = C.ice; ctx.fillRect(0, 0, cv.width, cv.height); }
  ctx.drawImage(im, pad, pad, W, H);
  const n = opts.n || N;
  const X = g => pad + g / N * W, Y = g => pad + g / N * H;
  if (opts.grid !== false) {
    ctx.save(); ctx.strokeStyle = opts.gridColor || 'rgba(255,255,255,0.95)'; ctx.lineWidth = opts.gridW || 2;
    for (let k = 0; k <= n; k++) {
      ctx.beginPath(); ctx.moveTo(pad + k / n * W, pad); ctx.lineTo(pad + k / n * W, pad + H); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(pad, pad + k / n * H); ctx.lineTo(pad + W, pad + k / n * H); ctx.stroke();
    }
    ctx.restore();
  }
  cv._m = { pad, W, H };
  return { ctx, W, H, X, Y, im, pad };
}
// 캔버스를 누른 곳 → 격자 단위 좌표 (0~7)
function gridPt(cv, e) {
  const rc = cv.getBoundingClientRect(), m = cv._m || { pad: 0, W: cv.width, H: cv.height };
  const px = (e.clientX - rc.left) / rc.width * cv.width - m.pad, py = (e.clientY - rc.top) / rc.height * cv.height - m.pad;
  return [px / m.W * N, py / m.H * N];
}
function boxAt(gx, gy) {
  let best = -1, area = 1e9;
  cur.boxes.forEach((b, i) => { if (gx >= b.x0 && gx <= b.x1 && gy >= b.y0 && gy <= b.y1) { const a = (b.x1 - b.x0) * (b.y1 - b.y0); if (a < area) { area = a; best = i; } } });
  return best;
}

function boxPx(b, X, Y) { return [X(b.x0), Y(b.y0), X(b.x1), Y(b.y1)]; }
const center = b => [(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2];
const cellOfPt = (x, y) => [Math.max(0, Math.min(N - 1, Math.floor(x))), Math.max(0, Math.min(N - 1, Math.floor(y)))];
const chipLab = (label, extra = '') => `<span class="dot" style="background:${colorOf(label)}"></span>${label}${extra}`;

/* =========================================================
   메뉴 (1단: 원리 · 체험 · 내 사진 / 2단: 원리의 ①~⑦)
   ========================================================= */
const PRINCIPLE = ['s1', 's2', 's3', 's4', 's5', 'iou', 'nms'];
const PAGES = ['home', 'try', ...PRINCIPLE, 'mine'];
const SHOW_PICK = new Set(['s1', 's2', 's3', 's4', 's5', 'nms']);
const DESC = {
  home: '수학·정보 융합형 프로그램(고등) 7차시 · 한 번만 보고 모두 찾아낸다 — 객체 탐지 모델 YOLO의 수학',
  try: '사진을 올리거나 웹캠을 켜면, 일상 사물 80종을 배운 실제 YOLO 모델(YOLOv5n)이 브라우저 안에서 물체를 찾아요.',
  mine: '직접 찍은 사진(또는 예제 사진)에 정답 상자를 그려 원리 ①~⑤·⑦의 예시로 쓰고, 상자 표기법을 비교해요.',
};
let page = 'home', lastPr = 's1';
function go(p) {
  if (!PAGES.includes(p)) p = 'home';
  page = p;
  const pr = PRINCIPLE.includes(p);
  if (pr) lastPr = p;
  document.querySelectorAll('.t1').forEach(t => t.classList.toggle('on', t.dataset.g === (pr ? 'pr' : p)));
  document.querySelectorAll('.t2').forEach(t => t.classList.toggle('on', t.dataset.p === p));
  $('nav2pr').style.display = pr ? '' : 'none';
  $('nav2desc').style.display = pr ? 'none' : '';
  $('nav2desc').textContent = DESC[p] || '';
  $('samplePick').style.visibility = SHOW_PICK.has(p) ? 'visible' : 'hidden';
  document.querySelectorAll('.page').forEach(s => s.classList.toggle('on', s.id === 'p-' + p));
  if (location.hash !== '#' + p) history.replaceState(null, '', '#' + p);
  $('app').classList.toggle('on-home', p === 'home');
  renderPage();
}
document.querySelectorAll('.t1').forEach(t => t.addEventListener('click', () => go(t.dataset.g === 'pr' ? lastPr : t.dataset.g)));
document.querySelectorAll('.t2').forEach(t => t.addEventListener('click', () => go(t.dataset.p)));
document.querySelectorAll('[data-go]').forEach(el => el.addEventListener('click', () => go(el.dataset.go)));

function renderPage() {
  ({ home: renderHome, try: renderTry, s1: renderS1, s2: renderS2, s3: renderS3, s4: renderS4, s5: renderS5, iou: renderIoU, nms: renderNMS, mine: renderMine })[page]();
}

/* =========================================================
   처음
   ========================================================= */
async function renderHome() {
  const cv = $('homeCv'), ctx = cv.getContext('2d');
  const im = await loadImg('img/drive.jpg');
  ctx.drawImage(im, 0, 0, cv.width, cv.height);
  const W = cv.width, H = cv.height;
  const items = [[0.163, 0.30, 0.34, 0.584, '#2E7D32', '자전거'], [0.368, 0.305, 0.594, 0.586, '#1B2A41', '자동차'], [0.659, 0.293, 0.765, 0.584, '#0070C0', '보행자']];
  items.forEach(([a, b, c, d, col]) => rect(ctx, a * W, b * H, c * W, d * H, col, 6));
  placeTags(ctx, items.map(([a, b, c, d, col, lab]) => ({ x0: a * W, y0: b * H, x1: c * W, y1: d * H, text: lab, color: col, size: 28 })));
}

/* =========================================================
   ① 격자 · 중심 칸
   ========================================================= */
let s1n = 7, s1sel = 0;
const S1PAD = 44;
$('s1Grid').innerHTML = [3, 5, 7, 9, 13].map(n => `<button class="chip${n === 7 ? ' on' : ''}" data-n="${n}">${n} × ${n}</button>`).join('');
$('s1Grid').addEventListener('click', e => { const b = e.target.closest('[data-n]'); if (!b) return; s1n = +b.dataset.n; renderS1(); });
$('s1Box').addEventListener('change', () => renderS1());
$('s1Num').addEventListener('change', () => renderS1());
$('s1Cv').addEventListener('click', e => { const i = boxAt(...gridPt($('s1Cv'), e)); if (i >= 0) { s1sel = i; renderS1(); } });

async function renderS1() {
  document.querySelectorAll('#s1Grid .chip').forEach(c => c.classList.toggle('on', +c.dataset.n === s1n));
  if (s1sel >= cur.boxes.length) s1sel = 0;
  const cv = $('s1Cv');
  const { ctx, W, H, X, Y, pad } = await scene(cv, { n: s1n, pad: S1PAD });
  const k = s1n / N, cw = W / s1n, ch = H / s1n;
  const cellOf = b => { const [cx, cy] = center(b); return [Math.min(s1n - 1, Math.floor(cx * k)), Math.min(s1n - 1, Math.floor(cy * k))]; };
  const cellPx = ([c, r]) => [pad + c * cw, pad + r * ch, pad + (c + 1) * cw, pad + (r + 1) * ch];
  // 다른 물체가 맡은 칸
  cur.boxes.forEach((b, i) => { if (i !== s1sel) rect(ctx, ...cellPx(cellOf(b)), colorOf(b.label), 4); });
  const hole = cellPx(cellOf(cur.boxes[s1sel]));
  veil(ctx, pad, pad, W, H, hole);
  const show = $('s1Box').checked;
  if (show) cur.boxes.forEach((b, i) => { if (i !== s1sel) faintBox(ctx, ...boxPx(b, X, Y), colorOf(b.label)); });
  if (show) selBox(ctx, ...boxPx(cur.boxes[s1sel], X, Y), colorOf(cur.boxes[s1sel].label));
  selCell(ctx, ...hole);
  cur.boxes.forEach((b, i) => { const [cx, cy] = center(b); dot(ctx, X(cx), Y(cy), colorOf(b.label), i === s1sel ? 11 : 8); });
  if (show) {
    const order = [s1sel, ...cur.boxes.map((_, i) => i).filter(i => i !== s1sel)];
    placeTags(ctx, order.map(i => { const b = cur.boxes[i], [a, bb, c, d] = boxPx(b, X, Y); return { x0: a, y0: bb, x1: c, y1: d, text: b.label, color: colorOf(b.label), size: i === s1sel ? 22 : 18 }; }), [pad, pad, pad + W, pad + H]);
  }
  // 눈금 숫자: 그림 바깥 여백에
  if ($('s1Num').checked) {
    const fs = s1n > 9 ? 17 : 21;
    font(ctx, fs, true); ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
    const [sc, sr] = cellOf(cur.boxes[s1sel]);
    for (let i = 0; i < s1n; i++) {
      ctx.fillStyle = i === sc ? C.cyD : C.navy; ctx.fillText(String(i + 1), pad + (i + 0.5) * cw, pad / 2 + 1);
      ctx.fillStyle = i === sr ? C.cyD : C.navy; ctx.fillText(String(i + 1), pad / 2, pad + (i + 0.5) * ch + 1);
    }
    ctx.textAlign = 'left';
  }
  // 표
  $('s1Tbl').innerHTML = '<tr><th>물체</th><th>중심 좌표</th><th>맡는 칸</th></tr>' + cur.boxes.map((b, i) => {
    const [cx, cy] = center(b).map(v => v * k);
    return `<tr class="clickable${i === s1sel ? ' sel' : ''}" data-i="${i}"><td style="text-align:left;padding-left:14px">${chipLab(b.label)}</td><td>(${fmt(cx)}, ${fmt(cy)})</td><td><b>${Math.min(s1n, Math.floor(cx) + 1)}열 ${Math.min(s1n, Math.floor(cy) + 1)}행</b></td></tr>`;
  }).join('');
  $('s1Tbl').querySelectorAll('tr[data-i]').forEach(tr => tr.addEventListener('click', () => { s1sel = +tr.dataset.i; renderS1(); }));
  const b = cur.boxes[s1sel];
  const q = v => fmt(v * k);
  const [cx, cy] = center(b).map(v => v * k);
  $('s1Calc').innerHTML = `<h3>${chipLab(b.label)}의 중심 칸 <span class="muted">(${s1n} × ${s1n} 격자)</span></h3>
    <div class="calc"><span class="k">①</span><span class="m">상자의 두 꼭짓점</span><span class="f">왼쪽 위 (${q(b.x0)}, ${q(b.y0)}) · 오른쪽 아래 (${q(b.x1)}, ${q(b.y1)})</span></div>
    <div class="calc"><span class="k">②</span><span class="m">두 점의 중점</span><span class="f">((${q(b.x0)}+${q(b.x1)})÷2, (${q(b.y0)}+${q(b.y1)})÷2) = <b>(${fmt(cx)}, ${fmt(cy)})</b></span></div>
    <div class="calc"><span class="k">③</span><span class="m">정수 부분 + 1</span><span class="f">${Math.floor(cx)} + 1, ${Math.floor(cy)} + 1 → <b>${Math.min(s1n, Math.floor(cx) + 1)}열 ${Math.min(s1n, Math.floor(cy) + 1)}행</b></span></div>`;
}

/* =========================================================
   ② 존재 확률 + 시그모이드
   ========================================================= */
let s2cell = null;
$('s2Thr').addEventListener('input', () => renderS2());
$('s2Cv').addEventListener('click', e => { s2cell = cellOfPt(...gridPt($('s2Cv'), e)); renderS2(); });
async function renderS2() {
  const thr = +$('s2Thr').value / 100;
  $('s2V').textContent = r2(thr);
  const { ctx, W, H } = await scene($('s2Cv'), { gridColor: 'rgba(27,42,65,0.9)', gridW: 1.5 });
  const cw = W / N, ch = H / N;
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    const v = cur.prob[r][c];
    ctx.fillStyle = v >= thr && v > 0 ? 'rgba(242,169,59,0.82)' : 'rgba(255,255,255,0.55)';
    ctx.fillRect(c * cw + 1, r * ch + 1, cw - 2, ch - 2);
  }
  if (s2cell) { const [c, r] = s2cell; veil(ctx, 0, 0, W, H, [c * cw, r * ch, (c + 1) * cw, (r + 1) * ch]); }
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    const v = cur.prob[r][c];
    font(ctx, v ? 26 : 19, true); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = v ? C.navy : C.muted2;
    ctx.fillText(String(v), c * cw + cw / 2, r * ch + ch / 2 + 1);
  }
  ctx.textAlign = 'left';
  if (s2cell) {
    const [c, r] = s2cell;
    selCell(ctx, c * cw, r * ch, (c + 1) * cw, (r + 1) * ch);
    const v = cur.prob[r][c];
    $('s2Cell').innerHTML = `<div class="lab">고른 칸: ${c + 1}열 ${r + 1}행</div><div class="big">물체가 있을 확률 ${v} → ${v >= thr && v > 0 ? '있을 가능성이 크다' : v > 0 ? '있을 가능성이 작다' : '없다고 본다'}</div>`;
  } else $('s2Cell').innerHTML = '<div class="lab">고른 칸</div><div class="big">사진의 칸을 눌러 보세요</div>';
  $('s2Note').textContent = cur.generated ? '※ 직접 그린 상자를 바탕으로 만든 학습용 예시 값이에요.' : '※ 7차시 PPT·학습지와 같은 학습용 예시 값이에요.';
  drawSigmoid();
}
$('zIn').addEventListener('input', drawSigmoid);
const SL = 40, SR = 540; // 그래프의 z = −6, 6 위치 (슬라이더와 맞춤)
function drawSigmoid() {
  const cv = $('sigCv'), ctx = cv.getContext('2d'), W = cv.width, H = cv.height;
  const z = +$('zIn').value / 10, s = 1 / (1 + Math.exp(-z));
  $('zV').textContent = z.toFixed(1); $('sigV').textContent = s.toFixed(2);
  ctx.clearRect(0, 0, W, H);
  const T = 14, B = H - 30;
  const px = v => SL + (v + 6) / 12 * (SR - SL), py = v => B - v * (B - T);
  // 가로 눈금선 0.5, 1
  ctx.strokeStyle = C.line; ctx.lineWidth = 1; ctx.setLineDash([5, 5]);
  [0.5, 1].forEach(v => { ctx.beginPath(); ctx.moveTo(SL, py(v)); ctx.lineTo(SR, py(v)); ctx.stroke(); });
  ctx.setLineDash([]);
  // 축
  ctx.strokeStyle = C.muted2; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(SL, B); ctx.lineTo(SR, B); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(px(0), B); ctx.lineTo(px(0), T - 4); ctx.stroke();
  // x 눈금 −6 … 6
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  for (let v = -6; v <= 6; v++) {
    ctx.strokeStyle = C.muted2; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(px(v), B); ctx.lineTo(px(v), B + 5); ctx.stroke();
    font(ctx, v === 0 ? 15 : 13, v === 0); ctx.fillStyle = v === 0 ? C.navy : C.muted2;
    ctx.fillText(String(v).replace('-', '−'), px(v), B + 8);
  }
  // y 눈금 0, 0.5, 1
  ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; font(ctx, 13, false); ctx.fillStyle = C.muted2;
  [0, 0.5, 1].forEach(v => ctx.fillText(String(v), SL - 8, py(v)));
  ctx.textAlign = 'left';
  // 곡선
  ctx.strokeStyle = C.bl; ctx.lineWidth = 4; ctx.beginPath();
  for (let i = 0; i <= 120; i++) { const v = -6 + i / 10; const y = py(1 / (1 + Math.exp(-v))); i ? ctx.lineTo(px(v), y) : ctx.moveTo(px(v), y); }
  ctx.stroke();
  ctx.strokeStyle = C.yel; ctx.lineWidth = 2; ctx.setLineDash([4, 4]);
  ctx.beginPath(); ctx.moveTo(px(z), B); ctx.lineTo(px(z), py(s)); ctx.lineTo(SL, py(s)); ctx.stroke(); ctx.setLineDash([]);
  dot(ctx, px(z), py(s), C.cy, 8);
  // 슬라이더 아래 눈금
  const tc = $('sigTick'), tx = tc.getContext('2d');
  tx.clearRect(0, 0, tc.width, tc.height); tx.strokeStyle = C.muted2;
  for (let v = -6; v <= 6; v++) { tx.lineWidth = v === 0 ? 2.5 : 1.2; tx.beginPath(); tx.moveTo(px(v), 0); tx.lineTo(px(v), v === 0 ? 12 : 7); tx.stroke(); }
}

/* =========================================================
   ③ (x, y, w, h)
   ========================================================= */
let s3sel = 0;
$('s3Quiz').addEventListener('change', () => renderS3());
$('s3Cv').addEventListener('click', e => { const i = boxAt(...gridPt($('s3Cv'), e)); if (i >= 0) { s3sel = i; renderS3(); } });
$('s3Pick').addEventListener('click', e => { const el = e.target.closest('[data-i]'); if (el) { s3sel = +el.dataset.i; renderS3(); } });
async function renderS3() {
  if (s3sel >= cur.boxes.length) s3sel = 0;
  $('s3Pick').innerHTML = cur.boxes.map((b, i) => `<button class="chip${i === s3sel ? ' on' : ''}" data-i="${i}">${chipLab(b.label, cur.boxes.filter(o => o.label === b.label).length > 1 ? ' ' + (cur.boxes.slice(0, i + 1).filter(o => o.label === b.label).length) : '')}</button>`).join('');
  const b = cur.boxes[s3sel], col = colorOf(b.label);
  const { ctx, W, H, X, Y, im } = await scene($('s3Cv'));
  const [cx, cy] = center(b), [cc, cr] = cellOfPt(cx, cy);
  const hole = [X(cc), Y(cr), X(cc + 1), Y(cr + 1)];
  veil(ctx, 0, 0, W, H, hole);
  cur.boxes.forEach((o, i) => { if (i !== s3sel) faintBox(ctx, ...boxPx(o, X, Y), colorOf(o.label)); });
  const [a, bb, c, d] = boxPx(b, X, Y);
  selBox(ctx, a, bb, c, d, col);
  selCell(ctx, ...hole);
  dot(ctx, X(cx), Y(cy), C.cy, 11);
  placeTags(ctx, [{ x0: a, y0: bb, x1: c, y1: d, text: `${b.label} · 너비 ${fmt(b.x1 - b.x0)}칸 · 높이 ${fmt(b.y1 - b.y0)}칸`, color: col, size: 20 }]);
  // 확대 그림
  const z = $('s3Zoom'), zc = z.getContext('2d'); zc.clearRect(0, 0, z.width, z.height);
  const S = 290, ox = 58, oy = 48;
  const sx = cc / N * im.width, sy = cr / N * im.height, sw = im.width / N, sh = im.height / N;
  zc.drawImage(im, sx, sy, sw, sh, ox, oy, S, S);
  zc.fillStyle = 'rgba(255,255,255,0.45)'; zc.fillRect(ox, oy, S, S);
  zc.strokeStyle = 'rgba(0,117,141,0.35)'; zc.lineWidth = 1;
  for (let q = 1; q < 10; q++) { zc.beginPath(); zc.moveTo(ox + S * q / 10, oy); zc.lineTo(ox + S * q / 10, oy + S); zc.moveTo(ox, oy + S * q / 10); zc.lineTo(ox + S, oy + S * q / 10); zc.stroke(); }
  rect(zc, ox, oy, ox + S, oy + S, C.cy, 6);
  const fx = cx - cc, fy = cy - cr, dx = ox + fx * S, dy = oy + fy * S;
  zc.strokeStyle = C.yelD; zc.lineWidth = 3;
  zc.beginPath(); zc.moveTo(ox, dy); zc.lineTo(dx, dy); zc.moveTo(dx, oy); zc.lineTo(dx, dy); zc.stroke();
  dot(zc, dx, dy, C.cy, 10);
  font(zc, 20, true); zc.fillStyle = C.yelD; zc.textBaseline = 'alphabetic';
  zc.textAlign = 'center'; zc.fillText(`x = ${fmt(fx)}`, ox + fx * S / 2, dy - 10);
  zc.textAlign = 'left'; zc.fillText(`y = ${fmt(fy)}`, dx + 10, oy + Math.max(24, fy * S / 2 + 8));
  font(zc, 15, false); zc.fillStyle = C.muted2;
  zc.fillText('(0, 0)', ox - 44, oy - 12); zc.fillText('(1, 1)', ox + S - 18, oy + S + 24);
  // 오른쪽: 사진 전체에 대한 크기 (h는 가로 글씨)
  const ph0 = 260, P = Math.min(124, ph0 * im.width / im.height), ph = P * im.height / im.width;
  const px0 = 380, py0 = oy + 20 + (ph0 - ph) / 2;
  zc.drawImage(im, px0, py0, P, ph);
  zc.fillStyle = 'rgba(255,255,255,0.45)'; zc.fillRect(px0, py0, P, ph);
  zc.strokeStyle = C.navy; zc.lineWidth = 2; zc.strokeRect(px0, py0, P, ph);
  const bx = px0 + b.x0 / N * P, by = py0 + b.y0 / N * ph, bw = (b.x1 - b.x0) / N * P, bh = (b.y1 - b.y0) / N * ph;
  zc.strokeStyle = col; zc.lineWidth = 4; zc.strokeRect(bx, by, bw, bh);
  font(zc, 19, true); zc.fillStyle = C.navy;
  zc.textAlign = 'center'; zc.fillText(`w = ${fmt((b.x1 - b.x0) / N)}`, px0 + P / 2, py0 - 12);
  zc.textAlign = 'left'; zc.textBaseline = 'middle'; zc.fillText(`h = ${fmt((b.y1 - b.y0) / N)}`, px0 + P + 10, py0 + ph / 2);
  zc.textBaseline = 'alphabetic'; font(zc, 15, false); zc.fillStyle = C.muted2;
  zc.textAlign = 'center'; zc.fillText('사진 전체 = 1', px0 + P / 2, py0 + ph + 24); zc.textAlign = 'left';
  $('s3CellLab').textContent = `${cc + 1}열 ${cr + 1}행 · 왼쪽 위 꼭짓점 (${cc}, ${cr})`;
  // 계산
  const rows = [
    ['x', `${fmt(cx)} − ${cc}`, r2(cx - cc), '칸 안 가로 위치'],
    ['y', `${fmt(cy)} − ${cr}`, r2(cy - cr), '칸 안 세로 위치'],
    ['w', `${fmt(b.x1 - b.x0)} ÷ ${N}`, r2((b.x1 - b.x0) / N), '사진 너비에 대한 비율'],
    ['h', `${fmt(b.y1 - b.y0)} ÷ ${N}`, r2((b.y1 - b.y0) / N), '사진 높이에 대한 비율'],
  ];
  const quiz = $('s3Quiz').checked;
  $('s3Calc').innerHTML = rows.map(([k, f, v, m], i) => `<div class="calc"><span class="k">${k}</span><span class="m">${m}</span><span class="f">${f} = ${quiz ? `<input class="num" data-i="${i}" inputmode="decimal" placeholder="?">` : `<b>${v}</b>`}</span></div>`).join('');
  const result = `(x, y, w, h) = (${rows.map(r => r[2]).join(', ')})`;
  const showRes = () => { $('s3ResLab').textContent = b.label + '의 상자'; $('s3Res').textContent = result; };
  if (!quiz) showRes();
  else {
    $('s3ResLab').textContent = '네 칸을 모두 맞히면 결과가 나타나요'; $('s3Res').textContent = '(x, y, w, h) = (?, ?, ?, ?)';
    const inputs = [...$('s3Calc').querySelectorAll('input')];
    inputs.forEach(inp => inp.addEventListener('input', () => {
      const v = parseFloat(inp.value.replace(',', '.'));
      const ok = !isNaN(v) && Math.abs(v - rows[+inp.dataset.i][2]) < 0.051;
      inp.classList.toggle('ok', ok); inp.classList.toggle('bad', inp.value !== '' && !ok);
      if (inputs.every(x => x.classList.contains('ok'))) showRes();
    }));
  }
}

/* =========================================================
   ④ 클래스
   ========================================================= */
let s4cell = null;
$('s4Cv').addEventListener('click', e => { s4cell = cellOfPt(...gridPt($('s4Cv'), e)).join(','); renderS4(); });
$('s4Pick').addEventListener('click', e => { const el = e.target.closest('[data-k]'); if (el) { s4cell = el.dataset.k; renderS4(); } });
async function renderS4() {
  const keys = Object.keys(cur.cls);
  if (!s4cell) s4cell = keys[0];
  $('s4Pick').innerHTML = keys.map(k => { const [c, r] = k.split(',').map(Number); return `<button class="chip${k === s4cell ? ' on' : ''}" data-k="${k}">${c + 1}열 ${r + 1}행</button>`; }).join('');
  const { ctx, W, H, X, Y } = await scene($('s4Cv'));
  const [c, r] = s4cell.split(',').map(Number);
  const hole = [X(c), Y(r), X(c + 1), Y(r + 1)];
  veil(ctx, 0, 0, W, H, hole);
  keys.forEach(k => { const [kc, kr] = k.split(',').map(Number); dot(ctx, X(kc + 0.5), Y(kr + 0.5), C.bl, 9); });
  selCell(ctx, ...hole);
  const probs = cur.cls[s4cell];
  $('s4Title').textContent = `${c + 1}열 ${r + 1}행 칸의 클래스 확률`;
  if (!probs) {
    $('s4Bars').innerHTML = `<div style="font-size:19px">이 칸은 물체가 있을 확률이 ${cur.prob[r][c]}이에요. 파란 점이 있는 칸을 눌러 보세요.</div>`;
    $('s4Ans').innerHTML = '';
  } else {
    const mx = Math.max(...probs);
    $('s4Bars').innerHTML = cur.classes.map((n, i) => `<div class="b${probs[i] === mx ? ' max' : ''}"><span class="nm">${n}</span><div class="track"><div class="fill" style="width:${probs[i] * 100}%"></div></div><span class="v">${probs[i].toFixed(2)}</span></div>`).join('');
    $('s4Ans').innerHTML = `<span class="pill">가장 큰 확률 ${mx.toFixed(2)} → ${cur.classes[probs.indexOf(mx)]}</span>`;
  }
  $('s4Note').textContent = (cur.generated ? '※ 학습용 예시 값이에요.' : '※ 7차시 PPT·학습지와 같은 학습용 예시 값이에요.') + ' 실제 YOLO는 80가지 정도의 클래스를 구분해요.';
}

/* =========================================================
   ⑤ 신뢰도
   ========================================================= */
$('s5Thr').addEventListener('input', () => renderS5());
function confRows() {
  return cur.confCells.map(k => {
    const [c, r] = k.split(',').map(Number);
    const p = cur.prob[r][c], probs = cur.cls[k] || [];
    const mx = Math.max(...probs), ci = probs.indexOf(mx), label = cur.classes[ci];
    const gt = cur.boxes.find(b => { const [x, y] = cellOfPt(...center(b)); return x === c && y === r; });
    const box = gt || { x0: c - 1, y0: r - 0.6, x1: c + 2, y1: r + 1.6 };
    return { k, c, r, p, label, mx, conf: r2(p * mx), box, hypo: !gt };
  });
}
async function renderS5() {
  const thr = +$('s5Thr').value / 100;
  $('s5V').textContent = thr.toFixed(2);
  const rows = confRows();
  $('s5Tbl').innerHTML = '<tr><th>칸</th><th>② 존재 확률</th><th>④ 클래스 확률</th><th>⑤ 신뢰도</th><th>결과</th></tr>' + rows.map(o => {
    const ok = o.conf >= thr;
    return `<tr class="${ok ? '' : 'dropped'}"><td>${o.c + 1}열 ${o.r + 1}행</td><td>${o.p}</td><td>× ${chipLab(o.label)} ${o.mx.toFixed(2)}</td><td><b>${o.conf.toFixed(2)}</b></td><td>${ok ? '<span class="keep">남긴다</span>' : '<span class="drop">버린다</span>'}</td></tr>`;
  }).join('');
  const { ctx, W, H, X, Y } = await scene($('s5Cv'), { grid: false });
  veil(ctx, 0, 0, W, H, null, 0.5);
  rows.filter(o => o.conf < thr).forEach(o => rect(ctx, ...boxPx(o.box, X, Y), C.gray, 3, [10, 7]));
  const kept = rows.filter(o => o.conf >= thr).sort((a, b) => b.conf - a.conf);
  kept.forEach(o => selBox(ctx, ...boxPx(o.box, X, Y), colorOf(o.label)));
  placeTags(ctx, kept.map(o => { const [a, b, c, d] = boxPx(o.box, X, Y); return { x0: a, y0: b, x1: c, y1: d, text: `${o.label} ${o.conf.toFixed(2)}`, color: colorOf(o.label), size: 22 }; }));
  $('s5Note').textContent = '회색 점선 상자는 문턱을 넘지 못해 버린 상자예요.' + (cur.generated ? ' (학습용 예시 값)' : '');
}

/* =========================================================
   ⑥ IoU 실험실
   ========================================================= */
const IU = 90, IW = 10, IH = 7;
const PRESET = {
  ppt: [[1, 1, 5, 4], [2, 2, 6, 5]], ws: [[1, 1, 6, 4], [3, 2, 7, 6]],
  same: [[2, 1, 6, 5], [2, 1, 6, 5]], apart: [[1, 1, 4, 4], [5, 3, 9, 6]],
};
let iouBoxes = PRESET.ppt.map(a => ({ x0: a[0], y0: a[1], x1: a[2], y1: a[3] }));
let iouPreset = 'ppt';
let drag = null;
document.querySelectorAll('[data-preset]').forEach(b => b.addEventListener('click', () => { iouPreset = b.dataset.preset; iouBoxes = PRESET[iouPreset].map(a => ({ x0: a[0], y0: a[1], x1: a[2], y1: a[3] })); renderIoU(); }));
function iouPt(e) { const cv = $('iouCv'), rc = cv.getBoundingClientRect(); return [(e.clientX - rc.left) / rc.width * IW, (e.clientY - rc.top) / rc.height * IH]; }
$('iouCv').addEventListener('pointerdown', e => {
  const [x, y] = iouPt(e), tol = 0.25;
  for (const i of [1, 0]) {
    const b = iouBoxes[i];
    for (const [cx, cy, kx, ky] of [[b.x0, b.y0, 'x0', 'y0'], [b.x1, b.y0, 'x1', 'y0'], [b.x0, b.y1, 'x0', 'y1'], [b.x1, b.y1, 'x1', 'y1']]) {
      if (Math.abs(x - cx) < tol && Math.abs(y - cy) < tol) { drag = { i, mode: 'corner', kx, ky }; $('iouCv').setPointerCapture(e.pointerId); return; }
    }
  }
  for (const i of [1, 0]) {
    const b = iouBoxes[i];
    if (x > b.x0 && x < b.x1 && y > b.y0 && y < b.y1) { drag = { i, mode: 'move', sx: x, sy: y, orig: { ...b } }; $('iouCv').setPointerCapture(e.pointerId); return; }
  }
});
$('iouCv').addEventListener('pointermove', e => {
  const [x, y] = iouPt(e);
  if (!drag) {
    const tol = 0.25; let cursor = 'default';
    iouBoxes.forEach(b => { if (x > b.x0 && x < b.x1 && y > b.y0 && y < b.y1) cursor = 'move'; [[b.x0, b.y0], [b.x1, b.y0], [b.x0, b.y1], [b.x1, b.y1]].forEach(([cx, cy]) => { if (Math.abs(x - cx) < tol && Math.abs(y - cy) < tol) cursor = 'nwse-resize'; }); });
    $('iouCv').style.cursor = cursor; return;
  }
  iouPreset = null;
  const snap = $('iouSnap').checked ? v => Math.round(v) : v => Math.round(v * 10) / 10;
  const b = iouBoxes[drag.i];
  if (drag.mode === 'move') {
    const w = drag.orig.x1 - drag.orig.x0, h = drag.orig.y1 - drag.orig.y0;
    let nx = snap(drag.orig.x0 + x - drag.sx), ny = snap(drag.orig.y0 + y - drag.sy);
    nx = Math.max(0, Math.min(IW - w, nx)); ny = Math.max(0, Math.min(IH - h, ny));
    b.x0 = nx; b.y0 = ny; b.x1 = nx + w; b.y1 = ny + h;
  } else {
    const vx = Math.max(0, Math.min(IW, snap(x))), vy = Math.max(0, Math.min(IH, snap(y)));
    if (drag.kx === 'x0') b.x0 = Math.min(vx, b.x1 - 1); else b.x1 = Math.max(vx, b.x0 + 1);
    if (drag.ky === 'y0') b.y0 = Math.min(vy, b.y1 - 1); else b.y1 = Math.max(vy, b.y0 + 1);
  }
  renderIoU();
});
['pointerup', 'pointercancel'].forEach(ev => $('iouCv').addEventListener(ev, () => { drag = null; }));
const gcd = (a, b) => b ? gcd(b, a % b) : a;
function renderIoU() {
  document.querySelectorAll('[data-preset]').forEach(b => b.classList.toggle('on', b.dataset.preset === iouPreset));
  const cv = $('iouCv'), ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, cv.width, cv.height);
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.strokeStyle = '#E1E7EC'; ctx.lineWidth = 1.5;
  for (let i = 0; i <= IW; i++) { ctx.beginPath(); ctx.moveTo(i * IU, 0); ctx.lineTo(i * IU, IH * IU); ctx.stroke(); }
  for (let j = 0; j <= IH; j++) { ctx.beginPath(); ctx.moveTo(0, j * IU); ctx.lineTo(IW * IU, j * IU); ctx.stroke(); }
  const [A, B] = iouBoxes;
  const P = b => [b.x0 * IU, b.y0 * IU, b.x1 * IU, b.y1 * IU];
  ctx.fillStyle = 'rgba(220,229,245,0.9)'; ctx.fillRect(A.x0 * IU, A.y0 * IU, (A.x1 - A.x0) * IU, (A.y1 - A.y0) * IU);
  ctx.fillStyle = 'rgba(234,226,250,0.7)'; ctx.fillRect(B.x0 * IU, B.y0 * IU, (B.x1 - B.x0) * IU, (B.y1 - B.y0) * IU);
  const ix0 = Math.max(A.x0, B.x0), iy0 = Math.max(A.y0, B.y0), ix1 = Math.min(A.x1, B.x1), iy1 = Math.min(A.y1, B.y1);
  const iw = Math.max(0, ix1 - ix0), ih = Math.max(0, iy1 - iy0);
  if (iw > 0 && ih > 0) { ctx.fillStyle = 'rgba(242,169,59,0.9)'; ctx.fillRect(ix0 * IU, iy0 * IU, iw * IU, ih * IU); }
  rect(ctx, ...P(B), '#7A4FD0', 5); rect(ctx, ...P(A), C.navy, 5);
  [[A, C.navy, 'A'], [B, '#7A4FD0', 'B']].forEach(([b, col, n]) => {
    [[b.x0, b.y0], [b.x1, b.y0], [b.x0, b.y1], [b.x1, b.y1]].forEach(([x, y]) => { ctx.fillStyle = '#fff'; ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.fillRect(x * IU - 8, y * IU - 8, 16, 16); ctx.strokeRect(x * IU - 8, y * IU - 8, 16, 16); });
    font(ctx, 32, true); ctx.fillStyle = col; ctx.textBaseline = 'top';
    ctx.fillText(n, b.x0 * IU + 14, b.y0 * IU + 12);
  });
  const wA = r2(A.x1 - A.x0), hA = r2(A.y1 - A.y0), wB = r2(B.x1 - B.x0), hB = r2(B.y1 - B.y0);
  const aA = r2(wA * hA), aB = r2(wB * hB), inter = r2(r2(iw) * r2(ih)), uni = r2(aA + aB - inter), v = uni ? inter / uni : 0;
  const isInt = [aA, aB, inter, uni].every(x => Number.isInteger(x));
  let frac = '';
  if (isInt && inter > 0) { const g = gcd(inter, uni); if (g > 1) frac = ` = ${inter / g}/${uni / g}`; }
  const rows = [
    ['A의 넓이', `${wA} × ${hA} = ${aA}`, ''], ['B의 넓이', `${wB} × ${hB} = ${aB}`, ''],
    ['겹친 넓이 (교집합)', `${r2(iw)} × ${r2(ih)} = ${inter}`, 'yel'], ['합친 넓이 (합집합)', `${aA} + ${aB} − ${inter} = ${uni}`, ''],
  ];
  $('iouRows').innerHTML = rows.map(([k, f, c]) => `<div class="card${c ? ' yel' : ''}" style="padding:14px 22px;display:grid;grid-template-columns:220px 1fr;align-items:center;font-size:22px;margin-bottom:12px"><b style="color:var(--navy);font-size:20px">${k}</b><span>${f}</span></div>`).join('') +
    `<div class="solid" style="display:grid;grid-template-columns:220px 1fr;align-items:center"><span class="lab" style="margin:0;font-size:20px">IoU</span><span class="big" style="font-size:30px">${inter} ÷ ${uni}${frac} ≈ ${v.toFixed(2)}</span></div>` +
    `<div class="card" style="margin-top:12px;font-size:19px">${v >= 0.5 ? '<b style="color:var(--co-d)">IoU ≥ 0.5</b> → NMS라면 같은 물체로 보고 신뢰도가 낮은 상자를 지운다.' : '<b class="keep">IoU &lt; 0.5</b> → NMS라면 다른 물체로 보고 두 상자를 모두 남긴다.'}</div>`;
}

/* =========================================================
   ⑦ NMS
   ========================================================= */
let nmsState = null;
function resetNMS() {
  const list = [...cur.candidates].sort((a, b) => b.conf - a.conf).map(c => ({ ...c, st: 'wait', iouRef: null }));
  nmsState = { list, ref: null, log: '아직 시작하지 않았어요. <b>한 단계 진행</b>을 눌러 보세요. 상자는 이미 신뢰도가 높은 순서로 줄 서 있어요.', done: false };
}
function nmsStep() {
  if (!nmsState) resetNMS();
  const thr = +$('nmsT').value / 100;
  const pend = nmsState.list.filter(c => c.st === 'wait');
  if (!pend.length) { nmsState.log = '<b>끝!</b> 더 이상 비교할 상자가 없어요. 남은 상자가 최종 결과예요.'; nmsState.done = true; return; }
  const top = pend[0];
  top.st = 'keep';
  nmsState.list.forEach(c => { c.iouRef = null; });
  const parts = [];
  pend.slice(1).forEach(c => {
    const v = iou(top, c); c.iouRef = v;
    if (v >= thr) { c.st = 'drop'; parts.push(`<b>${c.id}</b> ${v.toFixed(2)} ≥ ${thr.toFixed(2)} → <span class="x">지움</span>`); }
    else parts.push(`<b>${c.id}</b> ${v.toFixed(2)} → 유지`);
  });
  nmsState.ref = top.id;
  nmsState.log = `<b>${top.id}</b>(${top.label} ${top.conf.toFixed(2)})를 남겼어요.<br>${parts.length ? 'IoU 비교: ' + parts.join(' · ') : '더 비교할 상자가 없어요.'}`;
}
$('nmsStep').addEventListener('click', () => { nmsStep(); renderNMS(); });
$('nmsAll').addEventListener('click', () => { if (!nmsState) resetNMS(); let guard = 50; while (nmsState.list.some(c => c.st === 'wait') && guard--) nmsStep(); nmsState.ref = null; nmsState.list.forEach(c => { c.iouRef = null; }); nmsState.log = '<b>끝!</b> ' + nmsState.list.filter(c => c.st === 'keep').map(c => c.id).join(', ') + '만 남았어요.'; renderNMS(); });
$('nmsReset').addEventListener('click', () => { resetNMS(); renderNMS(); });
$('nmsT').addEventListener('input', () => { $('nmsTV').textContent = (+$('nmsT').value / 100).toFixed(2); resetNMS(); renderNMS(); });
async function renderNMS() {
  if (!nmsState) resetNMS();
  $('nmsTV').textContent = (+$('nmsT').value / 100).toFixed(2);
  const { ctx, W, H, X, Y } = await scene($('nmsCv'), { grid: false });
  veil(ctx, 0, 0, W, H, null, 0.5);
  const L = nmsState.list;
  L.filter(c => c.st === 'drop').forEach(c => rect(ctx, ...boxPx(c, X, Y), C.gray, 3, [10, 7]));
  [...L].reverse().filter(c => c.st === 'wait').forEach(c => rect(ctx, ...boxPx(c, X, Y), colorOf(c.label), 3));
  L.filter(c => c.st === 'keep').forEach(c => selBox(ctx, ...boxPx(c, X, Y), colorOf(c.label), c.id === nmsState.ref ? 8 : 7));
  const ref = L.find(c => c.id === nmsState.ref);
  if (ref) rect(ctx, ...boxPx(ref, X, Y).map((v, i) => v + (i < 2 ? -9 : 9)), C.cy, 4);
  const shown = [...L.filter(c => c.st === 'keep'), ...L.filter(c => c.st === 'wait')];
  placeTags(ctx, shown.map(c => { const [a, b, cc, d] = boxPx(c, X, Y); return { x0: a, y0: b, x1: cc, y1: d, text: `${c.id} ${c.conf.toFixed(2)}`, color: c.st === 'keep' ? colorOf(c.label) : rgba(colorOf(c.label), 0.8), size: c.st === 'keep' ? 22 : 17 }; }));
  $('nmsTbl').innerHTML = `<tr><th>상자</th><th>이름표</th><th>신뢰도</th><th>방금 남긴 상자(${nmsState.ref || '—'})와의 IoU</th><th>결과</th></tr>` + L.map(c => {
    const st = c.st === 'keep' ? '<span class="keep">남김</span>' : c.st === 'drop' ? '<span class="drop">지움</span>' : '<span class="wait">대기</span>';
    return `<tr class="${c.st === 'drop' ? 'dropped' : ''}${c.id === nmsState.ref ? ' sel' : ''}"><td><b>${c.id}</b></td><td>${chipLab(c.label)}</td><td>${c.conf.toFixed(2)}</td><td>${c.iouRef == null ? '—' : c.iouRef.toFixed(2)}</td><td>${st}</td></tr>`;
  }).join('');
  $('nmsLog').innerHTML = nmsState.log;
  $('nmsNote').textContent = cur.realCandidates ? '※ 실제 탐지 모델(YOLOv5n)이 이 사진에서 낸 NMS 전 후보 상자예요. 신뢰도 = 존재 확률 × 클래스 확률.'
    : cur.generated ? '※ 정답 상자를 조금씩 움직여 만든 학습용 후보 상자예요.' : '※ 7차시 PPT와 같은 학습용 후보 상자예요.';
}

/* =========================================================
   체험 (실제 탐지)
   ========================================================= */
const tryCv = $('tryCv'), tctx = tryCv.getContext('2d');
let lastList = 0;
let src = null, srcW = 0, srcH = 0, result = null, video = null, stream = null, busy = false, selDet = -1, live = false;
const PAL = ['#2F5FB3', '#D9604F', '#2E7D32', '#F2A93B', '#7A4FD0', '#0070C0', '#B5473A', '#0E7C8A', '#9A6508', '#1B2A41'];
const colCls = c => PAL[c % PAL.length];
function setStatus(t, err) { $('tryStatus').textContent = t; $('tryStatus').classList.toggle('err', !!err); }
['thr', 'nmsThr'].forEach(id => $(id).addEventListener('input', () => { $('thrV').textContent = (+$('thr').value / 100).toFixed(2); $('nmsV').textContent = (+$('nmsThr').value / 100).toFixed(2); selDet = -1; drawTry(); }));
['showCand', 'showGrid'].forEach(id => $(id).addEventListener('change', () => drawTry()));

function sizeTry(w, h) { srcW = w; srcH = h; tryCv.width = 960; tryCv.height = Math.round(960 * h / w); $('tryMsg').style.display = 'none'; }

async function runOnce() {
  try {
    setStatus('찾는 중…');
    result = await detect(src, srcW, srcH);
    setStatus('');
    $('tryMs').textContent = `${Math.round(result.ms)}ms`;
    selDet = -1; drawTry();
  } catch (e) { console.error(e); setStatus('탐지에 실패했어요: ' + e.message, true); }
}
async function useTryImage(im) {
  stopCam();
  src = im; sizeTry(im.width, im.height);
  tctx.drawImage(im, 0, 0, tryCv.width, tryCv.height);
  try { await loadModel(setStatus); } catch (err) { setStatus('모델을 불러오지 못했어요: ' + err.message, true); return; }
  await runOnce();
}
async function tryFromFile(f) {
  if (!f) return;
  try { const im = await fileToImage(f); $('tryPick').value = ''; await useTryImage(im); }
  catch (err) { setStatus(err.message, true); }
}
$('tryFile').addEventListener('change', async e => { await tryFromFile(e.target.files[0]); e.target.value = ''; });
dropZone($('tryStage'), tryFromFile);
function fillTryPick() {
  $('tryPick').innerHTML = '<option value="">예시 사진 고르기…</option>' + tryList.map((t, i) => `<option value="${i}">${t.name}</option>`).join('');
}
$('tryPick').addEventListener('change', async e => {
  if (e.target.value === '') return;
  try { await useTryImage(await loadImg('samples/' + tryList[+e.target.value].file)); }
  catch (err) { setStatus(err.message, true); }
});
$('camBtn').addEventListener('click', async () => {
  if (live) { stopCam(); return; }
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 960 }, height: { ideal: 720 } }, audio: false });
  } catch (e) { setStatus('웹캠을 켤 수 없어요. 브라우저의 카메라 권한(또는 https/localhost 접속)을 확인해 주세요.', true); return; }
  video = document.createElement('video'); video.srcObject = stream; video.muted = true; video.playsInline = true;
  await video.play();
  src = video; sizeTry(video.videoWidth, video.videoHeight);
  live = true; $('camBtn').textContent = '웹캠 끄기'; $('tryPick').value = '';
  try { await loadModel(setStatus); } catch (err) { setStatus('모델을 불러오지 못했어요: ' + err.message, true); }
  loop();
});
function stopCam() {
  live = false; $('camBtn').textContent = '웹캠 켜기';
  if (stream) stream.getTracks().forEach(t => t.stop());
  stream = null; video = null;
}
async function loop() {
  if (!live) return;
  if (!busy) {
    busy = true;
    detect(video, srcW, srcH).then(r => { result = r; $('tryMs').textContent = `${Math.round(r.ms)}ms`; }).catch(() => {}).finally(() => { busy = false; });
  }
  drawTry();
  requestAnimationFrame(loop);
}

function currentSets() {
  if (!result) return { cands: [], keep: [] };
  const thr = +$('thr').value / 100, nt = +$('nmsThr').value / 100;
  const cands = result.cands.filter(c => c.conf >= thr);
  return { cands, keep: nms(cands, nt) };
}
function drawTry() {
  if (!src) return;
  const W = tryCv.width, H = tryCv.height, s = W / srcW;
  tctx.drawImage(src, 0, 0, W, H);
  const { cands, keep } = currentSets();
  if (selDet >= keep.length) selDet = -1;
  $('nCand').textContent = cands.length; $('nKeep').textContent = keep.length;
  if (result && $('showGrid').checked) {
    const { r, px, py } = result.letterbox;
    for (let gy = 0; gy < 20; gy++) for (let gx = 0; gx < 20; gx++) {
      const x0 = (gx * 32 - px) / r * s, y0 = (gy * 32 - py) / r * s, cs = 32 / r * s;
      if (x0 + cs < 0 || y0 + cs < 0 || x0 > W || y0 > H) continue;
      const v = result.objMap[gy][gx];
      if (v > 0.05) { tctx.fillStyle = `rgba(242,169,59,${Math.min(0.75, v * 0.9)})`; tctx.fillRect(x0, y0, cs, cs); }
      tctx.strokeStyle = 'rgba(255,255,255,0.55)'; tctx.lineWidth = 1; tctx.strokeRect(x0, y0, cs, cs);
    }
  }
  const bp = c => [c.x0 * s, c.y0 * s, c.x1 * s, c.y1 * s];
  if (selDet >= 0 && result) {
    const c = keep[selDet], { r, px, py } = result.letterbox, cell = c.cell;
    const x0 = (cell.col * cell.stride - px) / r * s, y0 = (cell.row * cell.stride - py) / r * s, cs = cell.stride / r * s;
    const hole = [x0, y0, x0 + cs, y0 + cs];
    veil(tctx, 0, 0, W, H, hole);
    keep.forEach((o, i) => { if (i !== selDet) faintBox(tctx, ...bp(o), colCls(o.cls)); });
    selBox(tctx, ...bp(c), colCls(c.cls));
    selCell(tctx, ...hole);
    placeTags(tctx, [{ x0: c.x0 * s, y0: c.y0 * s, x1: c.x1 * s, y1: c.y1 * s, text: `${COCO_KO[c.cls]} ${Math.round(c.conf * 100)}%`, color: colCls(c.cls), size: 22 }]);
  } else {
    if ($('showCand').checked) cands.forEach(c => rect(tctx, ...bp(c), 'rgba(255,255,255,0.9)', 1.5, [5, 4]));
    keep.forEach(c => { rect(tctx, ...bp(c), '#fff', 9); rect(tctx, ...bp(c), colCls(c.cls), 5); });
    placeTags(tctx, keep.map(c => ({ x0: c.x0 * s, y0: c.y0 * s, x1: c.x1 * s, y1: c.y1 * s, text: `${COCO_KO[c.cls]} ${Math.round(c.conf * 100)}%`, color: colCls(c.cls), size: 20 })));
  }
  const now = performance.now();
  if (!live || now - lastList > 500) { lastList = now; renderDetList(keep); }
}
function renderDetList(keep) {
  const el = $('detList');
  if (!keep.length) { el.innerHTML = `<div class="muted">${src ? '문턱을 넘은 물체가 없어요. 문턱을 낮춰 보세요.' : '아직 찾은 물체가 없어요.'}</div>`; return; }
  el.innerHTML = keep.map((c, i) => `<div class="det${i === selDet ? ' sel' : ''}" data-i="${i}"><span class="sw" style="background:${colCls(c.cls)}"></span><div><span class="nm">${COCO_KO[c.cls]}</span><span class="pc">${Math.round(c.conf * 100)}%</span><div class="f">존재 확률 ${c.obj.toFixed(2)} × 클래스 확률 ${c.clsProb.toFixed(2)} = 신뢰도 ${c.conf.toFixed(2)}</div>${i === selDet ? `<div class="f cell">${c.cell.grid}×${c.cell.grid} 격자의 ${c.cell.col + 1}열 ${c.cell.row + 1}행 칸이 찾았어요</div>` : ''}</div><span class="muted">${i + 1}</span></div>`).join('');
  el.querySelectorAll('.det').forEach(d => d.addEventListener('click', () => { selDet = +d.dataset.i === selDet ? -1 : +d.dataset.i; drawTry(); renderDetList(currentSets().keep); }));
}
function renderTry() { if (src && !live) drawTry(); }

// 끌어다 놓기
function dropZone(el, onFile) {
  ['dragenter', 'dragover'].forEach(ev => el.addEventListener(ev, e => { e.preventDefault(); el.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(ev => el.addEventListener(ev, e => { e.preventDefault(); el.classList.remove('over'); }));
  el.addEventListener('drop', e => { const f = e.dataTransfer && e.dataTransfer.files[0]; if (f) onFile(f); });
}
// 창 밖에 떨어뜨려도 브라우저가 사진을 열어 버리지 않도록
['dragover', 'drop'].forEach(ev => window.addEventListener(ev, e => e.preventDefault()));

/* =========================================================
   내 사진 (상자 그리기)
   ========================================================= */
const mCv = $('mCv'), mctx = mCv.getContext('2d');
let mImg = null, mBoxes = [], mLabels = ['자동차', '보행자', '자전거', '신호등', '표지판'], mLabel = '자동차', mSel = -1, mDrag = null;
function mStatus(t, err) { $('mStatus').textContent = t; $('mStatus').classList.toggle('err', !!err); }
function renderLabels() {
  $('mLabels').innerHTML = mLabels.map(l => `<button class="chip${l === mLabel ? ' on' : ''}" data-l="${l}">${chipLab(l)}</button>`).join('');
}
$('mLabels').addEventListener('click', e => {
  const b = e.target.closest('[data-l]'); if (!b) return;
  mLabel = b.dataset.l;
  if (mSel >= 0) mBoxes[mSel].label = mLabel;
  renderMine();
});
$('mAddLabel').addEventListener('click', () => { const v = $('mNewLabel').value.trim(); if (v && !mLabels.includes(v)) { mLabels.push(v); mLabel = v; } $('mNewLabel').value = ''; renderMine(); });
function setMineImage(im, name = '') {
  mImg = im; mBoxes = []; mSel = -1;
  mCv.width = 800; mCv.height = Math.round(800 * im.height / im.width);
  $('mMsg').style.display = 'none';
  if (name && !$('mName').value) $('mName').value = name;
  mStatus('물체를 끌어서 상자를 그려 보세요. 이름표를 먼저 고르면 그 이름으로 그려져요.');
  renderMine();
}
async function mineFromFile(f) {
  if (!f) return;
  try { setMineImage(await fileToImage(f)); $('mPick').value = ''; }
  catch (err) { mStatus(err.message, true); }
}
$('mFile').addEventListener('change', async e => { await mineFromFile(e.target.files[0]); e.target.value = ''; });
dropZone($('mStage'), mineFromFile);
function fillMinePick() {
  const pr = samples.filter(s => s.bundled);
  $('mPick').innerHTML = '<option value="">예제 사진 고르기…</option>' +
    (pr.length ? `<optgroup label="원리 예시 사진">${pr.map(s => `<option value="p:${s.id}">${s.name}</option>`).join('')}</optgroup>` : '') +
    (tryList.length ? `<optgroup label="체험 사진">${tryList.map((t, i) => `<option value="t:${i}">${t.name}</option>`).join('')}</optgroup>` : '');
}
$('mPick').addEventListener('change', async e => {
  const v = e.target.value; if (!v) return;
  try {
    if (v.startsWith('p:')) { const s = samples.find(x => x.id === v.slice(2)); setMineImage(await loadImg(s.src), s.name.replace(/\s*\(.*\)$/, '') + ' (내가 그린 상자)'); }
    else { const t = tryList[+v.slice(2)]; setMineImage(await loadImg('samples/' + t.file), t.name.replace(/\s*\(.*\)$/, '') + ' (내가 그린 상자)'); }
  } catch (err) { mStatus(err.message, true); }
});
function mPt(e) { const rc = mCv.getBoundingClientRect(); return [(e.clientX - rc.left) / rc.width * mCv.width, (e.clientY - rc.top) / rc.height * mCv.height]; }
mCv.addEventListener('pointerdown', e => { if (!mImg) return; const [x, y] = mPt(e); mDrag = { x0: x, y0: y, x1: x, y1: y }; mCv.setPointerCapture(e.pointerId); });
mCv.addEventListener('pointermove', e => { if (!mDrag) return; const [x, y] = mPt(e); mDrag.x1 = x; mDrag.y1 = y; renderMine(); });
mCv.addEventListener('pointerup', () => {
  if (!mDrag) return;
  const d = mDrag; mDrag = null;
  const x0 = Math.max(0, Math.min(d.x0, d.x1)), x1 = Math.min(mCv.width, Math.max(d.x0, d.x1));
  const y0 = Math.max(0, Math.min(d.y0, d.y1)), y1 = Math.min(mCv.height, Math.max(d.y0, d.y1));
  if (x1 - x0 > 8 && y1 - y0 > 8) {
    const k = mImg.width / mCv.width;
    mBoxes.push({ label: mLabel, x: Math.round(x0 * k), y: Math.round(y0 * k), w: Math.round((x1 - x0) * k), h: Math.round((y1 - y0) * k) });
    mSel = mBoxes.length - 1;
  }
  renderMine();
});
function renderMine() {
  renderLabels();
  mctx.clearRect(0, 0, mCv.width, mCv.height);
  if (mImg) mctx.drawImage(mImg, 0, 0, mCv.width, mCv.height);
  const k = mImg ? mCv.width / mImg.width : 1;
  const bp = b => [b.x * k, b.y * k, (b.x + b.w) * k, (b.y + b.h) * k];
  if (mImg && mSel >= 0) veil(mctx, 0, 0, mCv.width, mCv.height, bp(mBoxes[mSel]), 0.3);
  mBoxes.forEach((b, i) => { if (i !== mSel) rect(mctx, ...bp(b), colorOf(b.label), 4); });
  if (mSel >= 0) selBox(mctx, ...bp(mBoxes[mSel]), colorOf(mBoxes[mSel].label));
  const order = mSel >= 0 ? [mSel, ...mBoxes.map((_, i) => i).filter(i => i !== mSel)] : mBoxes.map((_, i) => i);
  placeTags(mctx, order.map(i => { const b = mBoxes[i], [a, bb, c, d] = bp(b); return { x0: a, y0: bb, x1: c, y1: d, text: `${i + 1} ${b.label}`, color: colorOf(b.label), size: 18 }; }));
  if (mDrag) rect(mctx, mDrag.x0, mDrag.y0, mDrag.x1, mDrag.y1, colorOf(mLabel), 3, [6, 4]);
  $('mTbl').innerHTML = '<tr><th>#</th><th>이름표</th><th>COCO [x, y, w, h] (픽셀)</th><th></th></tr>' + (mBoxes.length ? mBoxes.map((b, i) => `<tr class="clickable${i === mSel ? ' sel' : ''}" data-i="${i}"><td>${i + 1}</td><td>${chipLab(b.label)}</td><td>[${b.x}, ${b.y}, ${b.w}, ${b.h}]</td><td><button class="chip" data-del="${i}">지우기</button></td></tr>`).join('') : '<tr><td colspan="4" class="muted">아직 그린 상자가 없어요.</td></tr>');
  $('mTbl').querySelectorAll('tr[data-i]').forEach(tr => tr.addEventListener('click', e => {
    if (e.target.dataset.del !== undefined) { mBoxes.splice(+e.target.dataset.del, 1); mSel = -1; }
    else { mSel = +tr.dataset.i; mLabel = mBoxes[mSel].label; }
    renderMine();
  }));
  const b = mBoxes[mSel];
  if (b && mImg) {
    const W = mImg.width, H = mImg.height, f = v => v.toFixed(3);
    $('mFmt').innerHTML = `<span class="muted">사진 크기: ${W} × ${H} 픽셀 · ${mSel + 1}번 상자</span><br>
      <b>COCO</b> [왼쪽 위 x, y, 너비, 높이] = [${b.x}, ${b.y}, ${b.w}, ${b.h}]<br>
      <b>YOLO</b> 중심 x, 중심 y, 너비, 높이 (비율) = ${f((b.x + b.w / 2) / W)}, ${f((b.y + b.h / 2) / H)}, ${f(b.w / W)}, ${f(b.h / H)}<br>
      <b>꼭짓점</b> (x0, y0, x1, y1) = (${b.x}, ${b.y}, ${b.x + b.w}, ${b.y + b.h})`;
  } else $('mFmt').innerHTML = '<span class="muted">상자를 하나 고르면 COCO(픽셀) · YOLO(비율) · 꼭짓점 표기를 비교할 수 있어요.</span>';
}
function toSample(name) {
  const max = 1000, sc = Math.min(1, max / Math.max(mImg.width, mImg.height));
  const c = document.createElement('canvas'); c.width = Math.round(mImg.width * sc); c.height = Math.round(mImg.height * sc);
  c.getContext('2d').drawImage(mImg, 0, 0, c.width, c.height);
  const W = mImg.width, H = mImg.height;
  return {
    id: 'u' + Date.now(), name, src: c.toDataURL('image/jpeg', 0.85),
    classes: [...new Set(mBoxes.map(b => b.label))],
    boxes: mBoxes.map(b => ({ label: b.label, x0: r2(b.x / W * N), y0: r2(b.y / H * N), x1: r2((b.x + b.w) / W * N), y1: r2((b.y + b.h) / H * N) })),
  };
}
$('mSave').addEventListener('click', () => {
  if (!mImg || !mBoxes.length) { mStatus('사진을 올리고 상자를 하나 이상 그려 주세요.', true); return; }
  const name = $('mName').value.trim() || '내 사진 ' + new Date().toLocaleString('ko-KR');
  const s = toSample(name);
  const list = userSamples(); list.push(s);
  if (!saveUserSamples(list)) return;
  samples.push(prepareSample(s)); cur = samples[samples.length - 1]; fillSampleSel(); resetForSample();
  mStatus(`‘${name}’을(를) 예시로 저장했어요. 원리 화면 오른쪽 위 ‘예시 사진’ 목록에서 고를 수 있어요.`);
});
$('mExport').addEventListener('click', () => {
  let s;
  if (mImg && mBoxes.length) s = toSample($('mName').value.trim() || '내 사진');
  else if (cur.id.startsWith('u')) { const { prob, cls, candidates, confCells, generated, ...rest } = cur; s = rest; }
  else { mStatus('내보낼 사진이 없어요. 사진에 상자를 그린 뒤 눌러 주세요.', true); return; }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(s)], { type: 'application/json' }));
  a.download = (s.name || 'sample').replace(/[\\/:*?"<>|]/g, '_') + '.json'; a.click();
});
$('mImport').addEventListener('change', async e => {
  const f = e.target.files[0]; if (!f) return;
  try {
    const data = JSON.parse(await f.text());
    const arr = Array.isArray(data.samples) ? data.samples : [data];
    const list = userSamples();
    let n = 0;
    arr.forEach(s => { if (s.src && s.boxes) { s.id = 'u' + Date.now() + Math.round(Math.random() * 1e6); delete s.bundled; list.push(s); samples.push(prepareSample(s)); n++; } });
    saveUserSamples(list); fillSampleSel();
    mStatus(`${n}개의 예시를 불러왔어요.`);
  } catch { mStatus('예시 파일을 읽을 수 없어요.', true); }
  e.target.value = '';
});
$('mDel').addEventListener('click', () => {
  if (!confirm('이 브라우저에 저장한 예시를 모두 지울까요?')) return;
  saveUserSamples([]); samples = samples.filter(s => !s.id.startsWith('u')); cur = samples[0]; fillSampleSel(); resetForSample();
  mStatus('저장한 예시를 지웠어요.');
});

/* ========================================================= */
function resetForSample() { s1sel = 0; s2cell = null; s3sel = 0; s4cell = null; nmsState = null; }

// FHD 고정 화면 맞추기
function fit() {
  const app = $('app');
  const mobile = window.innerWidth < 900 && window.innerWidth < window.innerHeight;
  document.body.classList.toggle('mobile', mobile);
  if (mobile) { app.style.transform = ''; return; }
  const k = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
  const x = (window.innerWidth - 1920 * k) / 2, y = (window.innerHeight - 1080 * k) / 2;
  app.style.transform = `translate(${x}px, ${y}px) scale(${k})`;
}
window.addEventListener('resize', fit);
fit();

loadSamples().then(() => go((location.hash || '#home').slice(1)));
document.fonts && document.fonts.ready.then(() => renderPage());
