// ===== SenMart 천하제일 알바대회 — 학생 화면 =====
const LS = "senmart_cup_v1";
let S = loadS();
let G = null, offset = 0, lastKey = "", lastPhase = -1, netOk = true;

function loadS() { try { return JSON.parse(localStorage.getItem(LS)) || {}; } catch (e) { return {}; } }
function saveS() { try { localStorage.setItem(LS, JSON.stringify(S)); } catch (e) {} }
const offline = () => S.mode === "offline";
const ph = () => offline() ? S.off.phase : (G ? G.phase : 0);
function mySub(r) { if (offline()) return S.off.subs[r] || null; return (G && G.mine && G.mine[r]) || (G && G.subs && G.subs[r] && G.subs[r][S.id]) || null; }

// ---------- 입장 ----------
if (!API) { $("onlineFields").classList.add("hide"); $("offBtn").classList.add("hide"); $("joinMsg").style.color = "var(--muted)"; $("joinMsg").textContent = "순위판 서버가 설정되지 않아 오프라인 모드로 진행해요."; }
if (QS.get("pin")) $("inPin").value = QS.get("pin").replace(/\D/g, "").slice(0, 4);
$("inPin").oninput = () => { $("inPin").value = $("inPin").value.replace(/\D/g, "").slice(0, 4); };
$("inName").onkeydown = e => { if (e.key === "Enter") join(); };
$("joinBtn").onclick = () => join();
$("offBtn").onclick = () => { $("onlineFields").classList.toggle("hide"); const off = $("onlineFields").classList.contains("hide");
  $("offBtn").textContent = off ? "← 참여 코드로 입장하기" : "인터넷 순위판 없이 하기 (오프라인 모드)"; $("joinMsg").textContent = ""; };
async function join() {
  const name = $("inName").value.replace(/\s+/g, " ").trim().replace(/점$/, "");
  $("joinMsg").style.color = "var(--red)";
  if (!name) { $("joinMsg").textContent = "지점 이름을 정해 주세요."; return; }
  if (!API || $("onlineFields").classList.contains("hide")) {
    S = { mode: "offline", name, off: { phase: 1, subs: {} }, practice: null }; saveS(); start(); return;
  }
  const pin = $("inPin").value;
  if (pin.length !== 4) { $("joinMsg").textContent = "참여 코드 4자리를 입력하세요."; return; }
  $("joinBtn").disabled = true; $("joinMsg").style.color = "var(--muted)"; $("joinMsg").textContent = "입장 중…";
  try {
    const j = await api({ a: "join", pin, name });
    S = { mode: "online", pin, id: j.id, name: j.name, practice: null }; saveS(); start();
  } catch (e) { $("joinMsg").style.color = "var(--red)"; $("joinMsg").textContent = e.server ? e.message : "서버에 연결하지 못했어요. 인터넷을 확인하거나 오프라인 모드로 하세요."; }
  $("joinBtn").disabled = false;
}
function leave() { if (!confirm("이 기기의 입장 정보를 지울까요? (서버의 기록은 그대로 남아요)")) return; S = {}; saveS(); location.reload(); }

function start() {
  $("joinView").classList.add("hide"); $("gameView").classList.remove("hide");
  ["cStore", "cPhase"].forEach(id => $(id).classList.remove("hide"));
  $("cStore").innerHTML = `🏪 <b>${storeName(S.name)}</b>`;
  if (!offline()) { $("cNet").classList.remove("hide"); poll(); setInterval(poll, 3000); }
  renderAll();
}
async function poll() {
  try {
    const j = await api({ a: "state", pin: S.pin, id: S.id });
    offset = j.now - Date.now(); G = j; setNet(true);
    if (!j.teams.some(t => t.id === S.id)) { /* 교사가 숨긴 지점도 자기 화면은 계속 */ }
    renderAll();
  } catch (e) {
    setNet(false);
    if (e.server && /찾을 수 없어요/.test(e.message)) { alert(e.message + "\n다시 입장해 주세요."); S = {}; saveS(); location.reload(); }
  }
}
function setNet(ok) { netOk = ok; $("netDot").classList.toggle("off", !ok); $("netTxt").textContent = ok ? "연결됨" : "연결 끊김 · 다시 시도 중"; }
setInterval(() => {
  const dl = G && G.deadline, el = $("cTimer");
  if (!dl || offline()) { el.classList.add("hide"); return; }
  const left = dl - (Date.now() + offset); el.classList.remove("hide"); el.classList.toggle("warn", left < 60000);
  $("cTimerV").textContent = left > 0 ? mmss(left) : "시간 종료!";
}, 500);

// ---------- 탭 ----------
document.querySelectorAll(".tabs button[data-t]").forEach(b => b.onclick = () => {
  if (b.disabled) return;
  document.querySelectorAll(".tabs button[data-t]").forEach(x => x.classList.toggle("on", x === b));
  document.querySelectorAll(".tab").forEach(t => t.classList.toggle("on", t.id === "tab-" + b.dataset.t));
});
function go(t) { document.querySelector(`.tabs button[data-t="${t}"]`).click(); window.scrollTo(0, 0); }

// ---------- 매장 ----------
const prodOpts = () => `<option value="">— 상품 선택 —</option>` + PRODUCTS.map((p, i) => `<option value="${i}">${p[4]} ${p[0]} (${p[1].toLocaleString()}원)</option>`).join("");
function shelvesHTML(n, withCheckout) {
  let h = "";
  for (let k = 0; k < n; k++) h += `<div class="shelf"><div class="h">단짝 진열대 ${k + 1}</div><div class="row">
    <select data-p="${k}" data-s="0">${prodOpts()}</select><span class="plus">＋</span><select data-p="${k}" data-s="1">${prodOpts()}</select></div></div>`;
  if (withCheckout) h += `<div class="shelf checkout"><div class="h">🧾 계산대 옆 1칸 — 계산하다 ‘하나 더’ 집는 자리</div><div class="row"><select id="checkout">${prodOpts()}</select></div></div>`;
  return h;
}
function readDisplay() {
  const pairs = []; document.querySelectorAll("#storeBox .shelf:not(.checkout)").forEach((_, k) => {
    const a = document.querySelector(`select[data-p="${k}"][data-s="0"]`).value, b = document.querySelector(`select[data-p="${k}"][data-s="1"]`).value;
    if (a !== "" && b !== "") pairs.push([+a, +b]);
  });
  const c = $("checkout"); return { pairs, checkout: c && c.value !== "" ? +c.value : null };
}
function fillDisplay(d) {
  if (!d) return;
  d.pairs.forEach((p, k) => { const a = document.querySelector(`select[data-p="${k}"][data-s="0"]`), b = document.querySelector(`select[data-p="${k}"][data-s="1"]`); if (a && b) { a.value = p[0]; b.value = p[1]; } });
  if ($("checkout") && d.checkout != null) $("checkout").value = d.checkout;
}
function validMsg(d, need) {
  if (d.pairs.some(p => p[0] === p[1])) return "같은 상품끼리는 짝이 될 수 없어요.";
  const used = d.pairs.flat(); if (new Set(used).size !== used.length) return "한 상품은 진열대 한 곳에만 놓을 수 있어요.";
  if (d.pairs.length < need) return need === 1 ? "단짝 1쌍을 정하세요." : `단짝 진열대 ${need}쌍을 모두 정하세요.`;
  return "";
}

function renderStore() {
  const p = ph(), r = roundOfOpen(p), rv = roundOfReveal(p);
  const key = [p, r ? mySub(r) : "", rv ? mySub(rv) : "", S.practice ? S.practice.code : "", G ? G.teams.length : 0, rv && G ? JSON.stringify(G.subs) : ""].join("|");
  if (key === lastKey) return;
  // 진열 중이던 선택은 유지
  const keep = r && lastPhase === p && document.querySelector("#storeBox select") ? readDisplay() : null;
  lastKey = key;
  const box = $("storeBox");
  if (p === 0) {
    const names = G ? G.teams.map(t => `<span class="${t.id === S.id ? "me" : ""}">${storeName(t.name)}</span>`).join("") : "";
    box.innerHTML = `<div class="card wait"><div class="em">🏪</div><h3 style="font-size:22px">${storeName(S.name)} 입장 완료!</h3>
      <div class="muted">선생님이 시작하면 <b>연습 게임</b>이 열려요. 잠시 기다려 주세요.</div><div class="storechips">${names}</div></div>`;
  } else if (p === 1) renderPractice(box);
  else if (r) renderOpen(box, r, keep);
  else if (rv) renderReveal(box, rv);
  lastPhase = p;
}

function renderPractice(box) {
  const done = S.practice;
  box.innerHTML = `<div class="mission" style="margin-bottom:14px"><div class="t">연습 게임 · 순위에 들어가지 않아요</div>
    <div class="q">“영수증은 아직 안 보여 줄 거야. <b style="color:var(--yel)">감으로</b> 단짝 하나만 골라 봐!”</div>
    <div class="small" style="margin-top:6px;opacity:.9">어떤 두 상품을 나란히 두면 손님이 하나 더 집을까요? 연습 영업은 <b>1번</b>만 할 수 있어요.</div></div>
    <div class="grid g2"><div class="card"><h3>연습 진열 <span class="pill">일주일</span></h3>${shelvesHTML(1, false)}
      <div class="btnrow"><button class="btn y" id="pracBtn">🧪 연습 영업 시작</button></div><div class="small muted" id="pracHint" style="margin-top:6px"></div></div>
    <div id="pracRes">${done ? practiceResult() : `<div class="card"><h3>💡 진열 효과는 어떻게 생길까?</h3><div class="small"><p style="margin:0 0 6px">A와 B를 나란히 두면, <b>A를 사러 온 손님 중 B를 안 산 손님</b>이 B를 하나 더 집을 수 있어요.</p><p style="margin:0">결과를 보고, 어떤 단짝이 효과가 클지 생각해 보세요.</p></div></div>`}</div></div>
    ${offline() ? `<div class="note" style="margin-top:14px">연습이 끝나면 선생님 화면의 열쇠로 <b>1라운드</b>를 열어요. <button class="btn g" id="nextBtn" style="margin-left:6px;padding:6px 10px">🔑 1라운드 열기</button></div>` : ""}`;
  if (done) fillDisplay(decD(done.code));
  const upd = () => { const m = validMsg(readDisplay(), 1); $("pracBtn").disabled = !!m || !!done; $("pracHint").textContent = done ? "연습 영업을 이미 했어요. 1라운드를 기다려 주세요!" : m; };
  box.querySelectorAll("select").forEach(s => s.onchange = upd); upd();
  $("pracBtn").onclick = () => { const d = readDisplay(); if (validMsg(d, 1)) return;
    const res = playRound(0, d, SEED); S.practice = { code: encD(d) }; saveS();
    animate(res.nRec, "연습 영업 중… (일주일)", () => { lastKey = ""; renderAll(); }); };
  if ($("nextBtn")) $("nextBtn").onclick = () => askKey(2);
}
function practiceResult() {
  const d = decD(S.practice.code), res = playRound(0, d, SEED), row = res.pairRows[0];
  return `<div class="big-result"><div class="l">연습 결과 · ${PRODUCTS[row.a][4]} ${PN[row.a]} + ${PRODUCTS[row.b][4]} ${PN[row.b]}</div><div class="v">+${won(res.profit)}</div>
    <div class="r">${PN[row.b]} ${row.ab}개 · ${PN[row.a]} ${row.ba}개를 더 팔았어요</div></div>
    <div class="card"><h3>이렇게 계산됐어요</h3><div class="small">
    <p style="margin:0 0 6px">${PN[row.a]}를 산 손님 중 일부가 옆의 ${PN[row.b]}도 집었고(${row.ab}개), ${PN[row.b]}를 산 손님 중 일부가 ${PN[row.a]}도 집었어요(${row.ba}개).</p>
    <p style="margin:0 0 6px">더 판 매출 ${won(res.sales)} × 마진 30% = <b>순이익 증가 ${won(res.profit)}</b> → 이것이 대회 점수예요.</p>
    <p style="margin:0" class="muted">다른 모둠은 얼마나 나왔을까요? 효과가 큰 단짝과 작은 단짝은 무엇이 다를까요? 1라운드부터는 영수증을 분석해서 <b>3쌍</b>을 골라요.</p></div></div>`;
}

function renderOpen(box, r, keep) {
  const R = ROUNDS[r], sub = mySub(r), prev = [r - 1, r - 2].map(x => x > 0 ? mySub(x) : null).find(Boolean);
  const dl = !offline() && G && G.deadline ? G.deadline - (Date.now() + offset) : null;
  box.innerHTML = `${r === 3 ? `<div class="event"><div class="t">📢 특별 영업 · ${EVENT3.title}</div><ul>${EVENT3.lines.map(l => `<li>${l}</li>`).join("")}</ul>
      <div class="small" style="margin-top:6px">🧾 영수증 분석 탭의 데이터가 <b>${EVENT3.data}</b>로 바뀌었어요. 손님 구성이 바뀌면 좋은 단짝도 바뀔까요?</div></div>` : ""}
    <div class="mission" style="margin-bottom:14px"><div class="t">${R.name} · ${R.days}일 영업</div>
    <div class="q">${r === 1 ? "“이번엔 데이터를 보고 정해. 단짝 진열대 3곳을 맡길게!”" : r === 2 ? "“지표를 배웠으니 제대로! 이번엔 계산대 옆 1칸도 맡긴다.”" : "“열흘짜리 특별 영업이야. 역전의 기회!”"}</div>
    <div class="small" style="margin-top:6px;opacity:.9">선생님이 마감하기 전까지 몇 번이든 다시 제출할 수 있어요. 결과는 마감 후에 한꺼번에 발표해요.</div></div>
    <div class="grid g2"><div class="card"><h3>${R.name} 진열 계획 <span class="pill">단짝 ${R.pairs}쌍${R.checkout ? " + 계산대 옆" : ""}</span></h3>
      ${shelvesHTML(R.pairs, R.checkout)}
      <div class="btnrow"><button class="btn y" id="subBtn">✅ 이 진열로 제출</button></div>
      <div class="small muted" id="subHint" style="margin-top:6px"></div>
      <div id="subState" style="margin-top:10px"></div></div>
    <div>${r >= 2 ? `<div class="card" style="margin-bottom:14px"><h3>🎯 체크리스트</h3><div class="small">
        <p style="margin:0 0 6px">☐ <b>향상도</b>가 1보다 충분히 큰가?</p><p style="margin:0 0 6px">☐ <b>지지도</b>(함께 산 영수증 수)가 너무 작지 않은가?</p>
        <p style="margin:0 0 6px">☐ <b>신뢰도</b>는 방향마다 달라요. A→B와 B→A 모두 확인!</p><p style="margin:0">☐ 계산대 옆은 단짝이 아니라 <b>충동구매</b> 자리예요.</p></div></div>` :
      `<div class="card" style="margin-bottom:14px"><h3>🔎 이렇게 찾아보세요</h3><div class="small"><p style="margin:0 0 6px">🧾 영수증 분석 탭에서 상품 하나를 조건으로 고르면, 그 상품을 산 영수증에서 <b>함께 산 상품</b>이 나와요.</p>
        <p style="margin:0">‘함께 산 비율’과 ‘몇 배?’를 비교해 보세요. 손님 집단·시간대로 좁혀 볼 수도 있어요.</p></div></div>`}
      <div class="card"><h3>💡 진열 효과</h3><div class="small">A와 B를 나란히 두면, <b>A를 사러 온 손님 중 B를 안 산 손님</b>이 B를 하나 더 집을 수 있어요. 원래보다 <b>더</b> 함께 사는 단짝일수록 효과가 커요.</div></div></div></div>`;
  fillDisplay(keep || decD(sub) || (prev ? decD(prev) : null));
  const upd = () => {
    const d = readDisplay(), m = validMsg(d, R.pairs), code = encD(d);
    $("subBtn").disabled = !!m; $("subBtn").textContent = sub && code === sub ? "✅ 제출한 진열과 같아요" : sub ? "✅ 이 진열로 다시 제출" : "✅ 이 진열로 제출";
    if (sub && code === sub) $("subBtn").disabled = true;
    $("subHint").textContent = m || (!R.checkout ? "" : d.checkout == null ? "계산대 옆 칸을 비워 두면 그 자리 효과는 0이에요." : "");
  };
  box.querySelectorAll("select").forEach(s => s.onchange = upd); upd();
  $("subState").innerHTML = sub ? `<div class="done-badge">✔ 제출 완료</div> <span class="small muted">${dispText(decD(sub))}</span>` :
    `<span class="small muted">아직 제출하지 않았어요.${dl != null && dl < 0 ? " <b style='color:var(--red)'>시간이 끝났어요. 지금 바로 제출하세요!</b>" : ""}</span>`;
  $("subBtn").onclick = () => submit(r);
}
async function submit(r) {
  const d = readDisplay(), m = validMsg(d, ROUNDS[r].pairs); if (m) return;
  const code = encD(d);
  if (offline()) {
    if (!confirm(`${ROUNDS[r].name} 진열을 확정하고 영업할까요?\n(오프라인 모드에서는 바로 결과가 나와요)`)) return;
    S.off.subs[r] = code; S.off.phase = REVEAL[r]; saveS();
    animate(scoreOf(r, code).nRec, `${ROUNDS[r].name} 영업 중…`, () => { lastKey = ""; renderAll(); });
    return;
  }
  $("subBtn").disabled = true; $("subBtn").textContent = "제출 중…";
  try {
    await api({ a: "submit", pin: S.pin, id: S.id, r, d: code });
    G.mine = G.mine || {}; G.mine[r] = code; toast("제출 완료! 마감 전까지 다시 고칠 수 있어요.");
  } catch (e) { alert(e.server ? e.message : "제출하지 못했어요. 인터넷 연결을 확인하고 다시 눌러 주세요."); }
  lastKey = ""; renderAll();
}

function myRankInfo() {
  if (offline() || !G) return null;
  const { rows } = boardRows(G.teams, G.subs, ph());
  const i = rows.findIndex(x => x.id === S.id); return i < 0 ? null : { rank: i + 1, n: rows.length, row: rows[i] };
}
function renderReveal(box, r) {
  const code = mySub(r), res = code ? scoreOf(r, code) : null, info = myRankInfo(), p = ph();
  const nextTxt = r === 1 ? "이제 <b>지지도 · 신뢰도 · 향상도</b>를 배워요. 그 다음 2라운드가 열려요!" : r === 2 ? "다음은 <b>열흘짜리 특별 3라운드</b>! 역전의 기회예요." : "";
  let head;
  if (r === 3 && info) head = `<div class="big-result"><div class="l">🏁 천하제일 알바대회 최종 결과</div><div class="v">${info.rank}위</div>
      <div class="r">${storeName(S.name)} · 누적 순이익 증가 ${won(info.row.cum)}</div>${info.rank === 1 ? `<div style="margin-top:8px;font-size:20px">🏆 천하제일 알바왕!</div>` : ""}</div>`;
  else head = `<div class="big-result"><div class="l">${ROUNDS[r].name} 결과 · ${storeName(S.name)}</div><div class="v">${res ? "+" + won(res.profit) : "0원"}</div>
      <div class="r">${res ? "" : "이번 라운드에 제출한 진열이 없어요. "}${info ? `현재 ${info.rank}위 / ${info.n}지점 · 누적 ${won(info.row.cum)}` : offline() ? "순위는 선생님 화면에서 확인해요" : ""}</div></div>`;
  box.innerHTML = head + `<div class="grid g2"><div class="card"><h3>우리 지점 진열</h3>
      ${res ? `<table><thead><tr><th>단짝</th><th class="num">순이익 증가</th></tr></thead><tbody>${res.pairRows.map(x => `<tr><td>${PN[x.a]} + ${PN[x.b]}</td><td class="num">${won(x.profit)}</td></tr>`).join("")}
      ${res.coRow ? `<tr><td>🧾 계산대 옆: ${PN[res.coRow.i]}</td><td class="num">${won(res.coRow.profit)}</td></tr>` : ""}</tbody></table>` : `<div class="muted">제출한 진열이 없어요.</div>`}
      <div class="btnrow" style="margin-top:10px"><button class="btn g" id="toRep">📊 자세한 결과 보고서</button></div></div>
    <div class="card"><h3>${offline() ? "선생님께 알려 주세요" : "다음 단계"}</h3>
      ${offline() ? `<div class="small muted">결과 코드</div><div style="font-size:30px;margin:6px 0"><span class="code">${r}-${code || "-------"}</span></div>
        <div class="small muted">선생님이 이 코드를 순위판에 입력하면 점수가 똑같이 계산돼요.</div>` : `<div class="small">${nextTxt || "모두 수고했어요! 우리 지점이 고른 단짝의 근거(지표)를 발표해 봅시다."}</div>
        ${code ? `<div class="small muted" style="margin-top:10px">결과 코드 <span class="code">${r}-${code}</span></div>` : ""}`}
      ${offline() && r < 3 ? `<div class="btnrow" style="margin-top:12px"><button class="btn" id="nextBtn">🔑 ${ROUNDS[r + 1].name} 열기</button></div>` : ""}</div></div>`;
  $("toRep").onclick = () => { repSel = r; renderReport(); go("report"); };
  if ($("nextBtn")) $("nextBtn").onclick = () => askKey(OPEN[r + 1]);
}

// ---------- 오프라인 열쇠 ----------
let keyTarget = 0;
function askKey(target) { keyTarget = target; $("keyTitle").textContent = `🔑 ${PHASES[target][1]} 열기`; $("keyIn").value = ""; $("keyMsg").textContent = ""; $("keyOv").classList.add("on"); setTimeout(() => $("keyIn").focus(), 50); }
function keyOk() { if ($("keyIn").value.trim() !== offKey(keyTarget)) { $("keyMsg").textContent = "열쇠가 맞지 않아요."; return; }
  $("keyOv").classList.remove("on"); S.off.phase = keyTarget; saveS(); lastKey = ""; renderAll(); go("store"); }
$("keyOk").onclick = keyOk; $("keyIn").onkeydown = e => { if (e.key === "Enter") keyOk(); }; $("keyCancel").onclick = () => $("keyOv").classList.remove("on");

// ---------- 영업 애니메이션 ----------
function animate(n, title, done) {
  const ov = $("overlay"), st = $("street"), bar = $("progBar"); $("simTitle").textContent = title; ov.classList.add("on"); let stop = false; const total = 2400, t0 = performance.now();
  const faces = ["🧑‍🎓", "👩‍💼", "👴", "🧑", "🦉", "👩‍🎓", "👨‍💼", "👵"];
  const iv = setInterval(() => { const w = document.createElement("div"); w.className = "walker"; w.textContent = faces[Math.floor(Math.random() * faces.length)]; st.appendChild(w); setTimeout(() => w.remove(), 1150); }, 140);
  function fin() { if (stop) return; stop = true; clearInterval(iv); ov.classList.remove("on"); st.querySelectorAll(".walker").forEach(w => w.remove()); done(); }
  (function tick() { if (stop) return; const f = Math.min(1, (performance.now() - t0) / total); bar.style.width = (f * 100) + "%"; $("simCount").textContent = `손님 ${Math.round(f * n).toLocaleString()}명 계산 완료`;
    if (f < 1) requestAnimationFrame(tick); else setTimeout(fin, 250); })();
  $("skipBtn").onclick = fin;
}

// ---------- 보고서 ----------
let repSel = null;
function reportItems() {
  const items = [];
  if (S.practice) items.push({ r: 0, label: "연습", code: S.practice.code });
  revealedRounds(ph()).forEach(r => { const c = mySub(r); if (c) items.push({ r, label: ROUNDS[r].name, code: c }); });
  return items;
}
function renderReport() {
  const items = reportItems();
  $("emptyReport").classList.toggle("hide", items.length > 0); $("reportBox").classList.toggle("hide", !items.length);
  if (!items.length) return;
  if (repSel == null || !items.some(x => x.r === repSel)) repSel = items[items.length - 1].r;
  $("repPick").innerHTML = "보기: " + items.map(x => `<button data-r="${x.r}" class="${x.r === repSel ? "on" : ""}">${x.label}</button>`).join(" ");
  $("repPick").querySelectorAll("button").forEach(b => b.onclick = () => { repSel = +b.dataset.r; renderReport(); });
  const it = items.find(x => x.r === repSel), h = scoreOf(it.r, it.code), showM = metricsOpen(ph()) && it.r > 0, info = myRankInfo();
  const ST = pastFor(it.r === 0 ? 1 : it.r).st;
  const metric = (a, b) => ({ n: ST.co[a][b], sup: ST.co[a][b] / ST.N, cab: ST.co[a][b] / Math.max(1, ST.cnt[a]), cba: ST.co[a][b] / Math.max(1, ST.cnt[b]), lift: ST.co[a][b] * ST.N / Math.max(1, ST.cnt[a] * ST.cnt[b]) });
  $("kWeek").innerHTML = it.r === 0 ? '<span class="tag2 pr">연습</span>' : `${it.label} · ${ROUNDS[it.r].days}일`;
  $("kSales").textContent = won(h.sales); $("kProfit").textContent = won(h.profit);
  $("kRankL").textContent = offline() ? "결과 코드" : "현재 순위 (누적)";
  $("kRank").innerHTML = offline() ? `<span class="code" style="font-size:18px">${it.r}-${it.code}</span>` : info ? `${info.rank}위 · ${won(info.row.cum)}` : "-";
  $("itemTitle").textContent = `항목별 가상 매출 (${ROUNDS[it.r].days}일 · 영수증 ${h.nRec.toLocaleString()}장)`;
  const tot = PN.map((_, i) => h.baseSales[i] + h.extraSales[i]), mx = Math.max(...tot), order = PN.map((_, i) => i).sort((a, b) => tot[b] - tot[a]);
  $("bars").innerHTML = order.map(i => `<div class="r"><div>${PRODUCTS[i][4]} ${PN[i]}</div><div class="track"><div class="b1" style="width:${h.baseSales[i] / mx * 100}%"></div><div class="b2" style="width:${h.extraSales[i] / mx * 100}%"></div></div><div class="num">${won(tot[i])}</div></div>`).join("");
  const base = h.baseSales.reduce((a, b) => a + b, 0);
  $("totalLine").innerHTML = `전체 매출 <b>${won(base + h.sales)}</b> = 평소 ${won(base)} + 진열 효과 ${won(h.sales)}`;
  $("effHead").innerHTML = `<tr><th>단짝</th><th>A→B<br>더 판 개수</th><th>B→A<br>더 판 개수</th><th class="num">순이익 증가</th>${showM ? '<th>지지도</th><th>신뢰도<br>A→B / B→A</th><th>향상도</th>' : ''}</tr>`;
  $("effBody").innerHTML = h.pairRows.map(r => { const m = metric(r.a, r.b); return `<tr><td>${PN[r.a]} + ${PN[r.b]}</td><td class="ctr">${PN[r.b]} ${r.ab}개</td><td class="ctr">${PN[r.a]} ${r.ba}개</td><td class="num">${won(r.profit)}</td>
    ${showM ? `<td class="ctr">${pct1(m.sup)}<br><span class="small muted">${m.n}장</span></td><td class="ctr">${pct(m.cab)} / ${pct(m.cba)}</td><td class="ctr"><b style="color:${m.lift >= 1 ? 'var(--blue-d)' : 'var(--red)'}">${m.lift.toFixed(2)}</b></td>` : ''}</tr>`; }).join("") +
    (h.coRow ? `<tr><td>🧾 계산대 옆: ${PN[h.coRow.i]}</td><td class="ctr" colspan="2">${h.coRow.n}개 더 팖</td><td class="num">${won(h.coRow.profit)}</td>${showM ? '<td colspan="3" class="small muted ctr">충동구매 자리</td>' : ''}</tr>` : "");
  $("effNote").textContent = showM ? `지표는 ${it.r === 3 ? EVENT3.data : "지난 2주 영수증"} 기준이에요. 향상도·지지도가 큰 단짝일수록 효과가 컸나요?` : "효과가 큰 단짝과 작은 단짝은 무엇이 달랐을까요? (2라운드부터 지표가 함께 보여요)";
  $("histBody").innerHTML = items.map(x => { const s = scoreOf(x.r, x.code), d = decD(x.code); return `<tr><td>${x.r === 0 ? '<span class="tag2 pr">연습</span>' : `<span class="tag2">${x.label}</span>`}</td><td>${d.pairs.map(p => PN[p[0]] + "+" + PN[p[1]]).join(", ")}</td><td>${d.checkout != null ? PN[d.checkout] : "-"}</td><td class="num">${won(s.profit)}</td></tr>`; }).join("");
}

// ---------- 영수증 분석 ----------
const cond = new Set(); let sortKey = "conf", PAST = [], curDR = 0;
$("condTags").innerHTML = PRODUCTS.map((p, i) => `<button class="tagbtn" data-c="${i}">${p[4]} ${p[0]}</button>`).join("");
document.querySelectorAll("[data-c]").forEach(b => b.onclick = () => { const i = +b.dataset.c; cond.has(i) ? cond.delete(i) : cond.add(i); b.classList.toggle("on"); renderData(true); });
$("fGroup").innerHTML = `<option value="">전체</option>` + GROUPS.map((g, i) => `<option value="${i}">${g}</option>`).join("");
$("fSlot").innerHTML = `<option value="">전체</option>` + SLOTS.map(s => `<option>${s}</option>`).join("");
$("fGroup").onchange = $("fSlot").onchange = () => renderData(true);
$("clearBtn").onclick = () => { cond.clear(); document.querySelectorAll("[data-c]").forEach(b => b.classList.remove("on")); $("fGroup").value = ""; $("fSlot").value = ""; renderData(true); };
document.querySelectorAll(".sortbar button[data-s]").forEach(b => b.onclick = () => { sortKey = b.dataset.s; document.querySelectorAll(".sortbar button[data-s]").forEach(x => x.classList.toggle("on", x === b)); renderData(true); });
function universe() { const g = $("fGroup").value, s = $("fSlot").value; return PAST.filter(x => (g === "" || x.g === +g) && (s === "" || x.slot === s)); }
function filtered(U) { return U.filter(x => [...cond].every(i => x.q[i] > 0)); }
const amt = x => x.q.reduce((a, v, i) => a + v * PRODUCTS[i][1], 0);
let lastDataKey = "";
function renderData(force) {
  const p = ph(), locked = p < 2;
  $("dataLock").classList.toggle("hide", !locked); $("dataBox").classList.toggle("hide", locked);
  if (locked) return;
  const dr = dataRound(p), M = metricsOpen(p), k = dr + "|" + M;
  if (!force && k === lastDataKey) return; lastDataKey = k;
  if (dr !== curDR) { curDR = dr; PAST = pastFor(dr).recs; }
  $("dataTitle").textContent = dr === 3 ? `🧾 ${EVENT3.data} (${EVENT3.title})` : "🧾 지난 2주 영수증";
  $("nAll").textContent = `${PAST.length.toLocaleString()}장`;
  const U = universe(), F = filtered(U);
  const cname = [...cond].map(i => PN[i]).join(" + ");
  const scope = [$("fGroup").value !== "" ? GROUPS[+$("fGroup").value] : "", $("fSlot").value].filter(Boolean).join(" · ");
  $("resTitle").textContent = cond.size ? `조건 [${cname}] 영수증에서 함께 산 상품` : "상품별 판매 비율 (조건을 골라 보세요)";
  $("resDesc").innerHTML = `기준 영수증 ${U.length.toLocaleString()}장${scope ? ` (${scope})` : ""} 중 조건에 맞는 영수증 <b>${F.length.toLocaleString()}장</b>`;
  $("resHead").innerHTML = `<tr><th>상품 B</th><th>함께 산 영수증</th>${M ? '<th>지지도</th>' : ''}<th>함께 산 비율${M ? '<br><span class="small">(신뢰도)</span>' : ''}</th><th>전체 중 B 비율</th><th>몇 배?${M ? '<br><span class="small">(향상도)</span>' : ''}</th></tr>`;
  const rows = PN.map((_, j) => { if (cond.has(j)) return null; const n = F.filter(x => x.q[j] > 0).length, base = U.filter(x => x.q[j] > 0).length / Math.max(1, U.length);
    const conf = n / Math.max(1, F.length); return { j, n, conf, base, sup: n / Math.max(1, U.length), lift: base > 0 ? conf / base : 0 }; }).filter(Boolean);
  rows.sort((a, b) => b[sortKey] - a[sortKey]);
  const mxL = Math.max(1, ...rows.map(r => r.lift));
  $("resBody").innerHTML = rows.map(r => `<tr><td>${PRODUCTS[r.j][4]} ${PN[r.j]}</td><td class="ctr">${r.n}${cond.size && r.n < 10 ? ' <span class="pill warn" title="영수증이 적어 믿기 어려워요">⚠ 적음</span>' : ''}</td>
    ${M ? `<td class="ctr">${cond.size ? pct1(r.sup) : "-"}</td>` : ''}<td class="ctr">${cond.size ? pct(r.conf) : "-"}</td><td class="ctr">${pct(r.base)}</td><td>${cond.size ? `<b>${r.lift.toFixed(2)}</b>배<span class="liftbar" style="width:${Math.min(60, r.lift / mxL * 60)}px;background:${r.lift >= 1 ? 'var(--blue)' : 'var(--red)'}"></span>` : "-"}</td></tr>`).join("");
  $("nShow").textContent = `${F.length.toLocaleString()}장 중 앞 80장`;
  $("recBody").innerHTML = F.slice(0, 80).map(x => `<tr><td>${x.id}</td><td>${GROUPS[x.g]}</td><td>${x.slot}</td><td>${x.q.map((v, i) => v ? PN[i] + (v > 1 ? "×" + v : "") : "").filter(Boolean).join(", ")}</td><td class="num">${amt(x).toLocaleString()}</td></tr>`).join("");
}
$("xlsxBtn").onclick = () => {
  if (typeof XLSX === "undefined") { alert("엑셀 내보내기 도구를 불러오지 못했어요. 인터넷 연결을 확인해 주세요."); return; }
  const F = filtered(universe());
  const data = F.map(x => { const o = { "영수증 번호": x.id, "손님 번호": x.cid, "손님 집단": GROUPS[x.g], "시간대": x.slot }; PN.forEach((n, i) => o[n] = x.q[i] > 0 ? 1 : 0); o["금액(원)"] = amt(x); return o; });
  const ws = XLSX.utils.json_to_sheet(data), wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "영수증");
  XLSX.writeFile(wb, `SenMart_영수증_${curDR === 3 ? "특별기간_" : ""}${cond.size ? [...cond].map(i => PN[i]).join("+") : "전체"}.xlsx`);
};

// ---------- 순위판 · 전체 ----------
function renderSide() {
  if (offline()) {
    $("board").querySelector(".bsub").textContent = "오프라인 모드 · 전체 순위는 선생님 화면에서 확인해요";
    const items = [1, 2, 3].filter(r => S.off.subs[r]).map(r => ({ r, s: scoreOf(r, S.off.subs[r]) }));
    $("board").querySelector(".blist").style.height = "auto";
    $("board").querySelector(".blist").innerHTML = items.length ? `<table><tbody>${items.map(x => `<tr><td>${ROUNDS[x.r].name}</td><td class="num">${won(x.s.profit)}</td><td><span class="code">${x.r}-${S.off.subs[x.r]}</span></td></tr>`).join("")}
      <tr><td><b>합계</b></td><td class="num"><b>${won(items.reduce((a, x) => a + x.s.profit, 0))}</b></td><td></td></tr></tbody></table>` : `<div class="empty">아직 결과가 없어요.</div>`;
    return;
  }
  if (G) renderBoard($("board"), G.teams, G.subs, G.phase, { me: S.id });
}
function renderHeader() {
  const p = ph();
  $("cPhase").innerHTML = `<b>${PHASES[p][1]}</b>${!offline() && roundOfOpen(p) ? (mySub(roundOfOpen(p)) ? " · 제출 ✔" : " · 미제출") : ""}`;
  $("tabData").disabled = false;
  $("metricBox").classList.toggle("hide", !metricsOpen(p)); $("metricLock").textContent = metricsOpen(p) ? "" : "🔒 2라운드에서 열려요";
}
function renderAll() {
  const p = ph();
  if (p !== lastPhase && lastPhase !== -1) { go("store"); if (roundOfReveal(p)) setTimeout(() => { const b = document.querySelector(".big-result"); b && b.classList.add("flash"); }, 50); }
  renderHeader(); renderStore(); renderData(); renderReport(); renderSide();
}
// 규칙 탭에 '입장 정보 지우기'
document.querySelector("#tab-help .card").insertAdjacentHTML("beforeend", `<div style="margin-top:14px"><button class="btn g" id="leaveBtn" style="padding:7px 12px;font-size:13px">↩ 이 기기의 입장 정보 지우기</button></div>`);
$("leaveBtn").onclick = leave;

if (S.mode === "offline" || (S.mode === "online" && API && S.pin === (QS.get("pin") || S.pin))) start();
