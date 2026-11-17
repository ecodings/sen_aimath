// ===== SenMart 대회 공통 도구 (학생 · 교사 화면 함께 사용) =====
const SEED = 555;
const OPEN = { 1: 2, 2: 4, 3: 6 };            // 라운드 → 진열을 받는 단계
const REVEAL = { 1: 3, 2: 5, 3: 7 };          // 라운드 → 결과 발표 단계
const QS = new URLSearchParams(location.search);
const API = (QS.get("api") || (typeof API_URL !== "undefined" ? API_URL : "") || "").trim();
const $ = id => document.getElementById(id);
const won = v => (v < 0 ? "−" : "") + Math.round(Math.abs(v)).toLocaleString("ko-KR") + "원";
const pct = v => (v * 100).toFixed(0) + "%";
const pct1 = v => (v * 100).toFixed(1) + "%";
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const storeName = n => `SenMart ${esc(n)}점`;
const roundOfOpen = ph => ({ 2: 1, 4: 2, 6: 3 }[ph] || 0);
const roundOfReveal = ph => ({ 3: 1, 5: 2, 7: 3 }[ph] || 0);
const revealedRounds = ph => [1, 2, 3].filter(r => ph >= REVEAL[r]);
const metricsOpen = ph => ph >= 4;           // 지지도·신뢰도·향상도 이름은 2라운드부터
const dataRound = ph => (ph >= 6 ? 3 : 1);   // 3라운드에는 이벤트 기간 영수증
const dispText = d => d ? d.pairs.map(p => PN[p[0]] + "+" + PN[p[1]]).join(", ") + (d.checkout != null ? ` | 계산대 옆 ${PN[d.checkout]}` : "") : "-";

// 오프라인 모드에서 학생이 다음 단계를 여는 3자리 열쇠 (교사 화면에 표시)
const offKey = ph => String(100 + hash(ph, 2026, 17) % 900);

async function api(params) {
  if (!API) throw new Error("서버 주소(API_URL)가 설정되지 않았어요.");
  const u = new URL(API);
  Object.entries(params).forEach(([k, v]) => { if (v != null && v !== "") u.searchParams.set(k, v); });
  const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), 15000);
  try {
    const r = await fetch(u.toString(), { cache: "no-store", signal: ctl.signal, redirect: "follow" });
    const j = await r.json();
    if (!j.ok) { const e = new Error(j.err || "서버 오류"); e.server = true; throw e; }
    return j;
  } finally { clearTimeout(to); }
}

// 점수 계산 (같은 진열이면 누구 기기에서 계산해도 같은 결과)
const _score = {};
function scoreOf(r, code) {
  const k = r + ":" + code;
  if (!(k in _score)) { const d = decD(code); _score[k] = d && d.pairs.length ? playRound(r, d, SEED) : null; }
  return _score[k];
}
// teams: [{id,name,h}], subs: {"1":{id:code}}, ph: 현재 단계
function boardRows(teams, subs, ph) {
  const rev = revealedRounds(ph), last = rev[rev.length - 1] || 0;
  const rows = teams.filter(t => !t.h).map(t => {
    const per = {};
    rev.forEach(r => { const c = subs[r] && subs[r][t.id]; const s = c ? scoreOf(r, c) : null; per[r] = s ? s.profit : 0; });
    const cum = rev.reduce((a, r) => a + per[r], 0), prev = rev.filter(r => r !== last).reduce((a, r) => a + per[r], 0);
    return { id: t.id, name: t.name, per, cum, prev, last: last ? per[last] : 0, joined: t.t || 0 };
  });
  const rank = (arr, key) => { const s = [...arr].sort((a, b) => b[key] - a[key] || a.joined - b.joined); s.forEach((x, i) => x[key + "Rank"] = i + 1); return s; };
  rank(rows, "prev");
  return { rows: rank(rows, "cum"), rev, last };
}

// 순위판 (위치가 바뀌면 부드럽게 이동)
function renderBoard(el, teams, subs, ph, opt) {
  opt = opt || {};
  const { rows, rev, last } = boardRows(teams, subs, ph);
  const H = opt.rowH || 64;
  const title = el.querySelector(".bsub");
  if (title) title.innerHTML = !rows.length ? "아직 입장한 지점이 없어요" : !rev.length ? `입장한 지점 ${rows.length}곳 · 1라운드 결과 발표 후 순위가 나와요` :
    `${rev.map(r => r + "라운드").join(" + ")} 누적 순이익 증가`;
  const list = el.querySelector(".blist");
  if (!rows.length) { list.innerHTML = ""; list.style.height = "0px"; return rows; }
  const mx = Math.max(1, ...rows.map(r => r.cum));
  const seen = new Set();
  rows.forEach((r, i) => {
    let row = list.querySelector(`[data-id="${r.id}"]`);
    const isNew = !row;
    if (isNew) { row = document.createElement("div"); row.className = "brow"; row.dataset.id = r.id; row.style.top = (rows.length * H) + "px"; list.appendChild(row); }
    seen.add(r.id);
    const mv = rev.length > 1 ? r.prevRank - r.cumRank : 0;
    row.classList.toggle("me", r.id === opt.me);
    row.classList.toggle("top", rev.length > 0 && i === 0);
    row.innerHTML = `<div class="rk">${rev.length ? i + 1 : "·"}</div>
      <div style="min-width:0"><div class="nm">${storeName(r.name)}</div><div class="sub">${last ? `${last}라운드 +${won(r.last)}` : "입장 완료"} ${mv > 0 ? `<span class="mv up">▲${mv}</span>` : mv < 0 ? `<span class="mv dn">▼${-mv}</span>` : ""}</div></div>
      <div class="sc">${rev.length ? won(r.cum) : ""}</div>
      ${rev.length ? `<div class="bar"><i style="width:${(r.cum / mx * 100).toFixed(1)}%"></i></div>` : ""}`;
    row.style.height = (H - 8) + "px";
    requestAnimationFrame(() => { row.style.top = (i * H) + "px"; });
  });
  list.querySelectorAll(".brow").forEach(x => { if (!seen.has(x.dataset.id)) x.remove(); });
  list.style.height = (rows.length * H) + "px";
  return rows;
}

function toast(t) {
  let el = $("toast"); if (!el) { el = document.createElement("div"); el.id = "toast"; el.className = "toast"; document.body.appendChild(el); }
  el.textContent = t; el.classList.add("on"); clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove("on"), 2200);
}
const mmss = ms => { ms = Math.max(0, ms); const s = Math.ceil(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
