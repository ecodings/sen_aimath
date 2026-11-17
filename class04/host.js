// ===== SenMart 천하제일 알바대회 — 교사 진행 화면 =====
const LSH = "senmart_cup_host_v1";
let H = (() => { try { return JSON.parse(localStorage.getItem(LSH)) || {}; } catch (e) { return {}; } })();
const saveH = () => { try { localStorage.setItem(LSH, JSON.stringify(H)); } catch (e) {} };
let G = null, offset = 0, lastStage = "", busy = false;
const offline = () => H.mode === "offline";
function D() {   // 온라인/오프라인 공통 데이터
  if (offline()) return { phase: H.off.phase, teams: H.off.teams, subs: H.off.subs, deadline: H.off.deadline || 0 };
  return G ? { phase: G.phase, teams: G.teams, subs: G.subs, deadline: G.deadline } : null;
}
const nowS = () => Date.now() + (offline() ? 0 : offset);

// ---------- 시작 화면 ----------
if (!API) { ["newBtn", "resumeBtn"].forEach(id => $(id).disabled = true); $("setupMsg").style.color = "var(--muted)";
  $("setupMsg").innerHTML = "config.js에 서버 주소(API_URL)가 없어요. <b>오프라인 모드</b>로 진행하거나 README의 서버 설정을 해 주세요."; }
if (H.key) $("inKey").value = H.key;
if (H.pin) $("inPin").value = H.pin;
$("newBtn").onclick = async () => {
  const key = $("inKey").value.trim(); if (!key) { setMsg("교사 코드를 입력하세요."); return; }
  if (H.pin && !confirm("새 게임을 만들까요? (지금 게임 " + H.pin + "은 그대로 남아 있어 '이어하기'로 다시 열 수 있어요)")) return;
  try { const j = await api({ a: "create", key }); H = { mode: "online", key, pin: j.pin }; saveH(); G = j; enter(); }
  catch (e) { setMsg(e.server ? e.message : "서버에 연결하지 못했어요."); }
};
$("resumeBtn").onclick = async () => {
  const key = $("inKey").value.trim(), pin = $("inPin").value.replace(/\D/g, "");
  if (!key || pin.length !== 4) { setMsg("교사 코드와 참여 코드 4자리를 입력하세요."); return; }
  try { const j = await api({ a: "state", key, pin }); if (!j.host) { setMsg("교사 코드가 맞지 않아요."); return; } H = { mode: "online", key, pin }; saveH(); G = j; enter(); }
  catch (e) { setMsg(e.server ? e.message : "서버에 연결하지 못했어요."); }
};
$("offBtn").onclick = () => {
  if (H.mode === "offline" && H.off && H.off.teams.length && confirm("지난 오프라인 기록을 이어서 할까요? (취소를 누르면 새로 시작)")) { enter(); return; }
  H = { mode: "offline", off: { phase: 1, teams: [], subs: { 1: {}, 2: {}, 3: {} }, deadline: 0 } }; saveH(); enter();
};
function setMsg(t) { $("setupMsg").style.color = "var(--red)"; $("setupMsg").textContent = t; }
$("quitBtn").onclick = () => { if (confirm("처음 화면으로 돌아갈까요? (게임 기록은 남아 있어요)")) location.reload(); };

let pollT = null;
function enter() {
  $("setupView").classList.add("hide"); $("mainView").classList.remove("hide");
  if (!offline()) { $("cPin").classList.remove("hide"); $("cPinV").textContent = H.pin; $("cNet").classList.remove("hide"); poll(); clearInterval(pollT); pollT = setInterval(poll, 2500); }
  else { $("cNet").classList.remove("hide"); $("netDot").classList.add("off"); $("netTxt").textContent = "오프라인 모드"; }
  render();
}
async function poll() {
  if (busy) return;
  try { const j = await api({ a: "state", key: H.key, pin: H.pin }); offset = j.now - Date.now(); G = j; setNet(true); render(); }
  catch (e) { setNet(false); }
}
function setNet(ok) { $("netDot").classList.toggle("off", !ok); $("netTxt").textContent = ok ? "연결됨" : "연결 끊김 · 다시 시도 중"; }
async function hostCall(params) {
  if (offline()) return;
  busy = true;
  try { const j = await api(Object.assign({ key: H.key, pin: H.pin }, params)); G = j; offset = j.now - Date.now(); setNet(true); }
  catch (e) { alert(e.server ? e.message : "서버에 연결하지 못했어요. 다시 눌러 주세요."); }
  busy = false; render();
}

// ---------- 단계 진행 ----------
const NEXT = ["연습 게임 시작 ▶", "1라운드 시작 ▶", "진열 마감 · 1주차 결과 발표 ▶", "2라운드 시작 ▶", "진열 마감 · 2주차 결과 발표 ▶", "특별 3라운드 시작 ▶", "진열 마감 · 최종 결과 발표 ▶", "대회 끝!"];
async function setPhase(v) {
  if (offline()) { H.off.phase = v; H.off.deadline = 0; saveH(); render(); return; }
  await hostCall({ a: "phase", v });
}
$("nextBtn").onclick = () => {
  const d = D(); if (!d || d.phase >= 7) return;
  const r = roundOfOpen(d.phase);
  if (r && !offline()) {
    const vis = d.teams.filter(t => !t.h), miss = vis.filter(t => !(d.subs[r] && d.subs[r][t.id]));
    if (miss.length && !confirm(`아직 제출하지 않은 지점이 ${miss.length}곳 있어요.\n(${miss.map(t => t.name).join(", ")})\n마감하고 결과를 발표할까요? 미제출 지점은 이번 라운드 0원이에요.`)) return;
  }
  if (r && offline()) {
    if (!confirm("결과 발표 단계로 넘어갈까요? 학생들의 결과 코드는 '🛠 지점 관리 · 결과 코드 입력'에서 입력하세요.")) return;
  }
  setPhase(d.phase + 1);
};
$("prevBtn").onclick = () => { const d = D(); if (!d || d.phase <= 0) return; if (confirm(`'${PHASES[d.phase - 1][1]}' 단계로 되돌릴까요?`)) setPhase(d.phase - 1); };
async function setTimer(sec) {
  if (offline()) { H.off.deadline = sec ? Date.now() + sec * 1000 : 0; saveH(); render(); return; }
  await hostCall({ a: "timer", sec });
}

// ---------- 화면 ----------
function studentURL() {
  const u = new URL("index.html", location.href); u.search = "";
  if (!offline()) u.searchParams.set("pin", H.pin);
  if (QS.get("api")) u.searchParams.set("api", QS.get("api"));
  return u.toString();
}
let qrFor = "";
function render() {
  const d = D(); if (!d) return;
  const p = d.phase;
  $("steps").innerHTML = PHASES.map((x, i) => `<div class="${i === p ? "on" : i < p ? "done" : ""}">${i < p ? "✔ " : ""}${x[1]}</div>`).join("");
  $("prevBtn").disabled = p <= 0 || (offline() && p <= 1);
  $("nextBtn").disabled = p >= 7; $("nextBtn").textContent = NEXT[p];
  const r = roundOfOpen(p), rv = roundOfReveal(p);
  $("timerCtl").innerHTML = (p === 1 || r) ? `${[3, 5, 10, 15].map(m => `<button class="tbtn" data-m="${m}">${m}분</button>`).join(" ")} <button class="tbtn" data-m="0">⏹ 정지</button>` : "";
  $("timerCtl").querySelectorAll("button").forEach(b => b.onclick = () => setTimer(+b.dataset.m * 60));
  renderBoard($("board"), d.teams, d.subs, p, { rowH: 70 });
  const vis = d.teams.filter(t => !t.h);
  const key = JSON.stringify([p, vis.map(t => t.id + t.name), r ? Object.keys(d.subs[r] || {}).sort() : 0, rv ? d.subs : 0, !!d.deadline, offline()]);
  if (key === lastStage) return; lastStage = key;
  const st = $("stage");
  const keyBox = ph => offline() ? `<div class="keybox">🔑 학생 화면에서 <b style="font-size:inherit;letter-spacing:0;margin:0;color:inherit">‘${PHASES[ph][1]}’ 열기</b>를 누르고 열쇠 입력 <b>${offKey(ph)}</b></div>` : "";
  const timer = `<div id="tbox" class="${d.deadline ? "" : "hide"}" style="margin-top:12px"><span class="small muted">남은 시간</span> <span class="timerbig" id="tbig"></span></div>`;
  const chips = rr => `<div class="storechips" style="justify-content:flex-start">${vis.map(t => { const ok = rr && d.subs[rr] && d.subs[rr][t.id]; return `<span class="${ok ? "ok" : ""}">${ok ? "✔ " : rr ? "⏳ " : ""}${storeName(t.name)}</span>`; }).join("") || '<span>아직 없음</span>'}</div>`;
  if (p === 0) {
    st.innerHTML = `<div class="ttl">🏆 천하제일 알바대회 · 입장</div><div class="ins">모둠별로 <b>SenMart 지점 이름</b>을 정해서 입장하세요!</div>
      <div class="joinbox"><div id="qr"></div><div><div class="small muted">접속 주소</div><div class="url">${esc(studentURL())}</div>
      <div style="margin-top:10px;font-size:20px">참여 코드 <span class="code" style="font-size:30px">${H.pin}</span></div></div></div>
      <h3 style="margin:18px 0 6px;color:var(--navy)">입장한 지점 ${vis.length}곳</h3>${chips(0)}`;
    qrFor = "";
    if (typeof QRCode !== "undefined") { try { new QRCode($("qr"), { text: studentURL(), width: 160, height: 160 }); } catch (e) {} } else $("qr").classList.add("hide");
  } else if (p === 1) {
    st.innerHTML = `<div class="ttl">🧪 연습 게임</div><div class="ins">영수증은 아직 비밀! <b>감으로</b> 단짝 1쌍을 골라 연습 영업을 1번 해 보세요.<br>
      <span class="muted" style="font-size:16px">→ 몇 모둠에게 결과를 물어보고, “효과가 큰 단짝과 작은 단짝은 무엇이 달랐을까?”로 1라운드를 엽니다.</span></div>${timer}
      ${offline() ? `<div class="keybox">오프라인: 학생은 지점 이름만 입력하고 시작해요. 다음 단계 열쇠는 1라운드 때 보여 줘요.</div>` : `<h3 style="margin:18px 0 6px;color:var(--navy)">참가 지점 ${vis.length}곳</h3>${chips(0)}`}`;
  } else if (r) {
    const n = vis.filter(t => d.subs[r] && d.subs[r][t.id]).length;
    st.innerHTML = `<div class="ttl">${ROUNDS[r].name} · 진열 중</div>
      ${r === 3 ? `<div class="event" style="margin-top:10px;font-size:18px"><div class="t">📢 특별 영업 · ${EVENT3.title}</div><ul>${EVENT3.lines.map(l => `<li>${l}</li>`).join("")}</ul><div class="small">영수증 분석 탭의 데이터가 ‘${EVENT3.data}’로 바뀌어요.</div></div>` : ""}
      <div class="ins">${r === 1 ? "🧾 영수증을 분석해서 <b>단짝 진열대 3쌍</b>을 정하고 제출하세요." : r === 2 ? "지지도 · 신뢰도 · 향상도를 근거로 <b>단짝 3쌍 + 계산대 옆 1칸</b>을 제출하세요." : "새 영수증을 다시 분석해서 <b>단짝 3쌍 + 계산대 옆 1칸</b>을 제출하세요. 열흘 영업이라 점수가 커요!"}
      <br><span class="muted" style="font-size:16px">${offline() ? "오프라인: 학생이 제출하면 바로 결과와 결과 코드가 나와요. 결과 발표 단계에서 코드를 입력하세요." : "마감 전까지 몇 번이든 다시 제출할 수 있어요."}</span></div>${timer}${keyBox(p)}
      ${offline() ? "" : `<h3 style="margin:18px 0 6px;color:var(--navy)">제출 현황 ${n} / ${vis.length}</h3>${chips(r)}`}`;
  } else if (rv) {
    st.innerHTML = rv === 3 ? finalStage(d) : revealStage(d, rv);
  }
}
function topOfRound(d, r) {
  return d.teams.filter(t => !t.h && d.subs[r] && d.subs[r][t.id]).map(t => ({ t, code: d.subs[r][t.id], s: scoreOf(r, d.subs[r][t.id]) }))
    .filter(x => x.s).sort((a, b) => b.s.profit - a.s.profit);
}
function revealStage(d, r) {
  const top = topOfRound(d, r).slice(0, 3);
  return `<div class="ttl">📣 ${r}주차 결과 발표</div>
    <div class="ins">${r === 1 ? "오른쪽 순위를 보고, <b>1위 지점은 어떤 단짝을 골랐는지</b> 이야기해 봅시다. 그 다음 <b>지지도 · 신뢰도 · 향상도</b>를 배워요!" : "순위가 어떻게 바뀌었나요? 지표를 근거로 고른 단짝이 효과가 컸나요? 다음은 <b>열흘짜리 특별 3라운드</b>!"}</div>
    <h3 style="margin:16px 0 0;color:var(--navy)">${ROUNDS[r].name} 이번 주 TOP 3</h3>
    <div class="topcards">${top.map((x, i) => `<div class="c"><div class="n">${["🥇", "🥈", "🥉"][i]} ${storeName(x.t.name)}</div><div class="d">${dispText(decD(x.code))}</div><div style="font-weight:800;color:var(--blue-d);margin-top:4px">+${won(x.s.profit)}</div></div>`).join("") || '<div class="muted">제출한 지점이 없어요.</div>'}</div>
    ${offline() ? `<div class="keybox" style="font-size:16px">오프라인: 학생들의 결과 코드를 <b style="font-size:inherit;letter-spacing:0;margin:0;color:inherit">🛠 지점 관리 · 결과 코드 입력</b>에서 넣으면 순위가 나와요.</div>` : ""}`;
}
function finalStage(d) {
  const { rows } = boardRows(d.teams, d.subs, 7), t3 = rows.slice(0, 3), order = [1, 0, 2].filter(i => t3[i]);
  const hgt = [150, 110, 80];
  return `<div class="ttl">🏁 천하제일 알바대회 최종 결과</div><div class="ins">세 라운드 누적 순이익 증가로 정한 순위예요. 1위 지점은 <b>천하제일 알바왕</b>!</div>
    <div class="podium">${order.map(i => `<div class="p"><div class="nm">${["🏆", "🥈", "🥉"][i]} ${storeName(t3[i].name)}</div><div class="small muted" style="margin-bottom:6px">${won(t3[i].cum)}</div><div class="blk" style="height:${hgt[i]}px">${i + 1}</div></div>`).join("")}</div>
    <div class="ins" style="font-size:16px;margin-top:14px">발표: “○○ 옆에 ○○를 놓았다. 향상도 ○배, 함께 산 영수증 ○장이 근거다.” 3라운드에서 손님 구성이 바뀌었을 때 진열을 바꿨나요?</div>`;
}
setInterval(() => {
  const d = D(), el = $("tbig"), box = $("tbox"); if (!d || !el) return;
  if (!d.deadline) { box && box.classList.add("hide"); return; }
  box.classList.remove("hide"); const left = d.deadline - nowS();
  el.textContent = left > 0 ? mmss(left) : "시간 종료!"; el.classList.toggle("warn", left < 60000);
}, 300);

// ---------- 지점 관리 · 결과 코드 ----------
$("manBtn").onclick = () => { renderMan(); $("manOv").classList.add("on"); };
$("manClose").onclick = () => $("manOv").classList.remove("on");
function renderMan() {
  const d = D();
  $("manBody").innerHTML = d.teams.map(t => `<tr style="${t.h ? "opacity:.45" : ""}"><td><b>${storeName(t.name)}</b>${t.h ? " (숨김)" : ""}</td>
    ${[1, 2, 3].map(r => { const c = d.subs[r] && d.subs[r][t.id]; const s = c && scoreOf(r, c); return `<td class="small">${c ? `<span class="code">${r}-${c}</span><br>${s ? won(s.profit) : ""}` : "-"}</td>`; }).join("")}
    <td style="white-space:nowrap"><button class="tbtn" data-ren="${t.id}">이름</button> <button class="tbtn" data-hide="${t.id}">${t.h ? "보이기" : "숨기기"}</button></td></tr>`).join("") || `<tr><td colspan="5" class="muted">지점이 없어요.</td></tr>`;
  $("manBody").querySelectorAll("[data-hide]").forEach(b => b.onclick = async () => {
    if (offline()) { const t = H.off.teams.find(x => x.id === b.dataset.hide); t.h = t.h ? 0 : 1; saveH(); render(); } else await hostCall({ a: "hide", id: b.dataset.hide });
    lastStage = ""; render(); renderMan(); });
  $("manBody").querySelectorAll("[data-ren]").forEach(b => b.onclick = async () => {
    const t = D().teams.find(x => x.id === b.dataset.ren), nm = prompt("새 지점 이름 (12글자 이내)", t.name); if (!nm) return;
    const clean = nm.replace(/\s+/g, " ").trim().replace(/점$/, "").slice(0, 12);
    if (offline()) { t.name = clean; saveH(); } else await hostCall({ a: "rename", id: t.id, name: clean });
    lastStage = ""; render(); renderMan(); });
}
$("mAdd").onclick = async () => {
  const name = $("mName").value.replace(/\s+/g, " ").trim().replace(/점$/, ""), m = $("mCode").value.trim().toUpperCase().match(/^([123])\s*[-·.]?\s*([A-U-]{7})$/);
  $("mMsg").style.color = "var(--red)";
  if (!name) { $("mMsg").textContent = "지점 이름을 입력하세요."; return; }
  if (!m) { $("mMsg").textContent = "결과 코드 형식: 라운드-7글자 (예: 2-FKMOIPN)"; return; }
  const r = +m[1], code = m[2], dd = decD(code);
  if (!dd || !dd.pairs.length) { $("mMsg").textContent = "코드를 읽을 수 없어요."; return; }
  if (offline()) {
    let t = H.off.teams.find(x => x.name.toLowerCase() === name.toLowerCase());
    if (!t) { t = { id: "o" + Date.now().toString(36), name: name.slice(0, 12), h: 0, t: Date.now() }; H.off.teams.push(t); }
    H.off.subs[r][t.id] = code; saveH();
  } else await hostCall({ a: "manual", name, r, d: code });
  $("mMsg").style.color = "#1E7A45"; $("mMsg").textContent = `${name}점 ${r}라운드: ${dispText(dd)} → ${won(scoreOf(r, code).profit)}`;
  $("mCode").value = ""; $("mName").focus(); lastStage = ""; render(); renderMan();
};
$("mCode").onkeydown = e => { if (e.key === "Enter") $("mAdd").click(); };

// ---------- 결과 CSV ----------
$("csvBtn").onclick = () => {
  const d = D(), { rows, rev } = boardRows(d.teams, d.subs, d.phase);
  const head = ["순위", "지점"].concat(...[1, 2, 3].map(r => [`${r}라운드 진열`, `${r}라운드 순이익 증가`]), ["누적"]);
  const lines = [head].concat(rows.map((x, i) => [rev.length ? i + 1 : "", `SenMart ${x.name}점`].concat(...[1, 2, 3].map(r => { const c = d.subs[r] && d.subs[r][x.id]; return [c ? dispText(decD(c)) : "", rev.includes(r) ? Math.round(x.per[r]) : ""]; }), [Math.round(x.cum)])));
  const csv = "﻿" + lines.map(l => l.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\r\n");
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); a.download = `SenMart_대회결과_${offline() ? "오프라인" : H.pin}.csv`; a.click();
};

// ---------- 모범답안 ----------
let ansR = 1;
$("ansBtn").onclick = () => { const d = D(); ansR = Math.max(1, roundOfOpen(d.phase) || roundOfReveal(d.phase) || 1); renderAns(); $("ansOv").classList.add("on"); };
$("ansClose").onclick = () => $("ansOv").classList.remove("on");
function renderAns() {
  $("ansPick").innerHTML = [[0, "연습"], [1, "1라운드"], [2, "2라운드"], [3, "3라운드"]].map(([r, l]) => `<button data-r="${r}" class="${r === ansR ? "on" : ""}">${l}</button>`).join(" ");
  $("ansPick").querySelectorAll("button").forEach(b => b.onclick = () => { ansR = +b.dataset.r; renderAns(); });
  const A = ANSWER[ansR], nm = p => `${PN[p.a]} + ${PN[p.b]}`;
  const row = p => `<tr><td>${nm(p)}</td><td class="ctr">${p.n}장 (${pct1(p.sup)})</td><td class="ctr">${pct(p.cab)} / ${pct(p.cba)}</td><td class="ctr"><b>${p.lift.toFixed(2)}</b></td><td class="num">${won(p.v)}</td></tr>`;
  const tbl = arr => `<table><thead><tr><th>단짝</th><th>지지도 (함께 산 영수증)</th><th>신뢰도 A→B / B→A</th><th>향상도</th><th class="num">${ROUNDS[ansR].days}일 순이익</th></tr></thead><tbody>${arr.map(row).join("")}</tbody></table>`;
  const disp = b => b.pairs.map(p => PN[p[0]] + " + " + PN[p[1]]).join(" · ") + (b.checkout != null ? ` / 계산대 옆: ${PN[b.checkout]}` : "");
  if (ansR === 0) { $("ansBody").innerHTML = `<h4>연습 게임: 단짝 1쌍 효과 순위 (일주일)</h4><div class="small muted" style="margin-bottom:6px">연습 게임은 순위에 들어가지 않아요. 학생들이 ‘감’으로 고른 단짝과 비교해 보세요.</div>${tbl(A.pairs)}`; return; }
  const b = A.best[0];
  $("ansBody").innerHTML = `
    <h4>1. 최고 진열 (${ROUNDS[ansR].days}일 순이익 증가 ${won(b.v)})</h4>
    <div class="note"><b>${disp(b)}</b></div>
    <div class="small muted" style="margin-top:4px">비슷한 점수의 다른 답: ${A.best.slice(1).map(x => `${disp(x)} (${won(x.v)})`).join(" / ")}</div>
    ${ansR === 3 ? `<div class="note" style="margin-top:8px">2라운드 최고 진열(샌드위치+커피 · 젤리·과자+에너지음료 · 이온음료+샐러드 / 아이스크림)을 그대로 내면 <b>${won(A.prevBest)}</b> (최고의 ${Math.round(A.prevBest / b.v * 100)}%).
      직장인 손님이 줄어 커피·샌드위치 손님이 적어지니 <b>샌드위치+커피</b>의 효과가 작아지고, 학생 손님이 늘어 탄산음료 손님이 많아지니 <b>탄산음료+즉석 야식</b>이, 학생이 좋아하는 <b>젤리·과자</b>가 계산대 옆에서 더 좋아져요. → ‘A 손님 수’(지지도)가 바뀌면 좋은 단짝도 바뀐다!</div>` :
      ansR === 2 ? `<div class="small muted" style="margin-top:6px">1·2라운드는 같은 주의 손님이 오므로 단짝 효과는 같아요. 2라운드에서는 계산대 옆 칸만큼 점수가 더해져요. (해설 슬라이드의 숫자와 같아요)</div>` : ""}
    <h4>2. 단짝 하나만 놓았을 때 효과 순위 (${ansR === 3 ? EVENT3.data : "지난 2주 영수증"} 기준 지표)</h4>${tbl(A.pairs)}
    <h4>3. 학생들이 자주 고르는 단짝 (비교용)</h4>${tbl(A.traps)}
    <div class="small muted" style="margin-top:4px">‘뻔한 단짝’ 진열(컵라면+삼각김밥, 단팥빵+우유, 커피+도시락${ROUNDS[ansR].checkout ? ", 계산대 옆 젤리·과자" : ""}): ${won(A.obvious)}</div>
    ${A.checkout ? `<h4>4. 계산대 옆 1칸 효과 순위</h4><div>${A.checkout.map((c, k) => `${k + 1}. ${PN[c.i]} ${won(c.v)}`).join(" · ")}</div>` : ""}`;
}

if (H.mode === "online" && H.pin && H.key && API && QS.get("resume") !== "0") { /* 새로고침해도 이어서 */ $("inKey").value = H.key; $("inPin").value = H.pin; $("resumeBtn").click(); }
else if (H.mode === "offline" && H.off) { /* 오프라인은 처음 화면에서 선택 */ }
