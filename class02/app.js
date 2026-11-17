// ===== SenMall 데이터 탐정단 =====
const $ = id => document.getElementById(id);
const r2 = v => (Math.round(v * 100) / 100).toFixed(2);
const r3 = v => (Math.round(v * 1000) / 1000).toFixed(3);
const NS = "http://www.w3.org/2000/svg";
const LS = "senmall_v1";
const fresh = () => ({ c1: { cs: "A", unit: 1, guess: {}, sel: null, comp: {}, rec: {}, sent: {}, me: { age: 17, spend: 10 } }, c2: { step: 1, picks: [], sent: false, showD: false, showC: false, sort: "name", cur: null, sel2: null } });
let S = (() => { try { return Object.assign(fresh(), JSON.parse(localStorage.getItem(LS)) || {}); } catch (e) { return fresh(); } })();
const save = () => { try { localStorage.setItem(LS, JSON.stringify(S)); } catch (e) {} };

// ---------- 탭 ----------
document.querySelectorAll(".tabs button").forEach(b => b.onclick = () => {
  document.querySelectorAll(".tabs button").forEach(x => x.classList.toggle("on", x === b));
  document.querySelectorAll(".tab").forEach(t => t.classList.toggle("on", t.id === "tab-" + b.dataset.t));
  if (b.dataset.t === "lab") drawLab();
});

// ---------- SVG 도구 ----------
function el(tag, attrs, text) { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (text != null) e.textContent = text; return e; }
function mapper(box, xr, yr) {   // 가로·세로 같은 비율(거리가 그림에서도 정확하도록)
  const s = Math.min(box.w / (xr[1] - xr[0]), box.h / (yr[1] - yr[0]));
  const w = (xr[1] - xr[0]) * s, h = (yr[1] - yr[0]) * s, ox = box.x + (box.w - w) / 2, oy = box.y + (box.h - h) / 2;
  return { X: v => ox + (v - xr[0]) * s, Y: v => oy + h - (v - yr[0]) * s, s, ox, oy, w, h, xr, yr };
}
function axes(svg, M, xstep, ystep, xlab, ylab, fmt) {
  fmt = fmt || (v => v);
  for (let v = Math.ceil(M.xr[0] / xstep) * xstep; v <= M.xr[1] + 1e-9; v += xstep) {
    svg.appendChild(el("line", { x1: M.X(v), y1: M.oy, x2: M.X(v), y2: M.oy + M.h, class: "grid" }));
    if (xstep * M.s >= 24 || v === Math.ceil(M.xr[0] / xstep) * xstep || v + xstep > M.xr[1] + 1e-9) svg.appendChild(el("text", { x: M.X(v), y: M.oy + M.h + 16, class: "tick", "text-anchor": "middle" }, fmt(v)));
  }
  for (let v = Math.ceil(M.yr[0] / ystep) * ystep; v <= M.yr[1] + 1e-9; v += ystep) {
    svg.appendChild(el("line", { x1: M.ox, y1: M.Y(v), x2: M.ox + M.w, y2: M.Y(v), class: "grid" }));
    if (ystep * M.s >= 14) svg.appendChild(el("text", { x: M.ox - 6, y: M.Y(v) + 4, class: "tick", "text-anchor": "end" }, fmt(v)));
  }
  svg.appendChild(el("line", { x1: M.ox, y1: M.oy + M.h, x2: M.ox + M.w, y2: M.oy + M.h, class: "axis" }));
  svg.appendChild(el("line", { x1: M.ox, y1: M.oy, x2: M.ox, y2: M.oy + M.h, class: "axis" }));
  svg.appendChild(el("text", { x: M.ox + M.w, y: M.oy + M.h + 34, class: "alabel", "text-anchor": "end" }, xlab));
  svg.appendChild(el("text", { x: M.ox + 4, y: M.oy - 8, class: "alabel" }, ylab));
}
function star(cx, cy, r) { let p = ""; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; p += `${cx + rr * Math.cos(a)},${cy + rr * Math.sin(a)} `; } return el("polygon", { points: p, class: "tgt" }); }
function arrow(svg, x1, y1, x2, y2, cls, w) {
  svg.appendChild(el("line", { x1, y1, x2, y2, class: cls }));
  const a = Math.atan2(y2 - y1, x2 - x1), L = w || 10;
  svg.appendChild(el("polygon", { points: `${x2},${y2} ${x2 - L * Math.cos(a - 0.4)},${y2 - L * Math.sin(a - 0.4)} ${x2 - L * Math.cos(a + 0.4)},${y2 - L * Math.sin(a + 0.4)}`, class: cls, style: "fill:currentColor;stroke:none" }));
}

// =================== 사건 1 ===================
const CASES = NEWCOMERS.concat([{ key: "M", name: "나라면?", me: true, story: "‘이런 고객이 가입한다면?’ 나이와 월 소비를 가정해 넣고, 닮은 회원을 찾아보세요." }]);
const curCase = () => CASES.find(c => c.key === S.c1.cs);
const tgt1 = () => { const c = curCase(); return c.me ? { age: +S.c1.me.age || 0, spend: +S.c1.me.spend || 0 } : c; };
const d1 = m => { const t = tgt1(), u = S.c1.unit; return Math.hypot(m.age - t.age, (m.spend - t.spend) * u); };
const ranked1 = () => MEMBERS.map(m => ({ m, d: d1(m) })).sort((a, b) => a.d - b.d);
const compKey = () => S.c1.cs + "_" + S.c1.unit;
const computed = () => !!S.c1.comp[compKey()] || (S.c1.cs === "M" && !!S.c1.comp["M_" + S.c1.unit]);
function calcText(m) {
  const t = tgt1(), u = S.c1.unit, da = t.age - m.age, ds = (t.spend - m.spend) * u, sq = da * da + ds * ds;
  const sp = v => v * u;
  return `<span class="f">√( (${t.age} − ${m.age})² + (${sp(t.spend)} − ${sp(m.spend)})² )</span><br><span class="f">= √( ${da * da} + ${ds * ds} ) = √${sq}</span> ≈ <b class="r">${r2(Math.sqrt(sq))}</b>`;
}
function renderCases() {
  $("c1cases").innerHTML = CASES.map(c => { const ok = S.c1.sent[c.key]; return `<button class="cchip ${c.key === S.c1.cs ? "on" : ""}" data-c="${c.key}">${c.me ? "🙋 " : "🧾 "}${c.name}${ok ? ` <span class="ok">${ok === "ok" ? "✔" : "✘"}</span>` : ""}</button>`; }).join("");
  $("c1cases").querySelectorAll("button").forEach(b => b.onclick = () => { S.c1.cs = b.dataset.c; S.c1.sel = null; save(); render1(); });
}
function renderPlot1() {
  const svg = $("plot1"); svg.innerHTML = "";
  const u = S.c1.unit, t = tgt1(), comp = computed(), R = ranked1(), top = new Set(comp ? R.slice(0, 3).map(x => x.m.name) : []);
  const M = mapper({ x: 60, y: 30, w: 560, h: 440 }, [10, 70], [0, 50 * u]);
  axes(svg, M, 10, 10 * u, "나이 (세)", u === 1 ? "월 소비 (만 원)" : "월 소비 (천 원)");
  const P = m => [M.X(m.age), M.Y(m.spend * u)];
  const [tx, ty] = P(t);
  if (comp) svg.appendChild(el("circle", { cx: tx, cy: ty, r: R[2].d * M.s, class: "ring" }));
  const sel = MEMBERS.find(m => m.name === S.c1.sel);
  if (sel) {
    const [mx, my] = P(sel);
    svg.appendChild(el("line", { x1: tx, y1: ty, x2: mx, y2: ty, class: "leg" }));
    svg.appendChild(el("line", { x1: mx, y1: ty, x2: mx, y2: my, class: "leg" }));
    svg.appendChild(el("line", { x1: tx, y1: ty, x2: mx, y2: my, class: "hyp" }));
    svg.appendChild(el("text", { x: (tx + mx) / 2 + 8, y: (ty + my) / 2 - 8, class: "hlab" }, "d = " + r2(d1(sel))));
  }
  const crowd = u !== 1;   // 천 원 단위에서는 이름이 겹치므로 Top 3와 선택만 표시
  MEMBERS.forEach(m => {
    const [x, y] = P(m), g = S.c1.guess[S.c1.cs] === m.name;
    const c = el("circle", { cx: x, cy: y, r: 8, class: "pt" + (top.has(m.name) ? " top" : "") + (sel === m ? " sel" : "") + (g ? " guess" : "") });
    c.onclick = () => clickMember(m); svg.appendChild(c);
    if (!crowd || top.has(m.name) || sel === m) svg.appendChild(el("text", { x: x + 11, y: y - 9, class: "pname" }, m.name + (g ? " (예상)" : "")));
  });
  svg.appendChild(star(tx, ty, 13));
  svg.appendChild(el("text", { x: tx + 15, y: ty + 20, class: "tname" }, (curCase().me ? "나" : "?") + ` (${t.age}, ${t.spend * u})`));
}
function clickMember(m) {
  if (!S.c1.guess[S.c1.cs]) { S.c1.guess[S.c1.cs] = m.name; }
  S.c1.sel = m.name; save(); render1();
}
function render1() {
  renderCases();
  const c = curCase(), u = S.c1.unit, comp = computed(), R = ranked1(), t = tgt1();
  $("c1title").textContent = c.me ? "🙋 나라면?" : `🧾 ${c.name}`;
  $("c1story").innerHTML = c.story + (c.me ? "" : ` <b>무엇을 추천해야 첫 구매로 이어질까?</b>`);
  $("meBox").classList.toggle("hide", !c.me);
  document.querySelectorAll("#unitSw button").forEach(b => b.classList.toggle("on", +b.dataset.u === u));
  const g = S.c1.guess[c.key];
  $("s1").classList.toggle("done", !!g);
  $("s1t").innerHTML = g ? `내 예상: <b>${g}</b>${comp ? ` → 실제 거리 순위 <b>${R.findIndex(x => x.m.name === g) + 1}위</b>` : " · 이제 거리를 계산해서 확인해 봐요."}` : "계산하기 전에, 가장 닮았을 것 같은 회원을 그래프에서 하나 눌러 보세요.";
  const sel = MEMBERS.find(m => m.name === S.c1.sel);
  $("s2").classList.toggle("done", comp);
  $("s2t").innerHTML = sel ? `<div class="calc">${c.me ? "나" : "신규 고객"} ↔ <b>${sel.name}</b><br>${calcText(sel)}</div>` : `<span class="muted">회원 점을 누르면 계산 과정이 나와요.</span>`;
  $("calcAll").disabled = comp;
  $("s3").classList.toggle("done", comp);
  $("s3t").innerHTML = comp ? R.slice(0, 3).map((x, i) => `${["🥇", "🥈", "🥉"][i]} <b>${x.m.name}</b> (${x.m.age}세, ${x.m.spend * u}${u === 1 ? "만" : "천"} 원) 거리 ${r2(x.d)} · ${ITEM_EMOJI[x.m.item]} ${x.m.item}`).join("<br>") : `<span class="muted">모든 회원과 거리를 계산하면 나타나요.</span>`;
  // 추천
  const items = Object.keys(ITEM_EMOJI), rec = S.c1.rec[c.key], sent = S.c1.sent[c.key];
  $("prodBtns").innerHTML = c.me ? "" : items.map(i => `<button data-i="${i}" class="${rec === i ? "on" : ""}" ${!comp || sent ? "disabled" : ""}>${ITEM_EMOJI[i]} ${i}</button>`).join("");
  $("prodBtns").querySelectorAll("button").forEach(b => b.onclick = () => { S.c1.rec[c.key] = b.dataset.i; save(); render1(); });
  $("sendRec").classList.toggle("hide", !!c.me);
  $("sendRec").disabled = !comp || !rec || !!sent;
  $("s4").classList.toggle("done", !!sent);
  $("s4t").innerHTML = c.me ? (comp ? `나와 닮은 회원들이 많이 산 상품: <b>${[...new Set(R.slice(0, 3).map(x => ITEM_EMOJI[x.m.item] + " " + x.m.item))].join(", ")}</b><br><span class="muted">이것이 ‘유사도 기반 추천’의 원리예요.</span>` : `<span class="muted">거리를 계산하면 나와 닮은 회원들이 산 상품이 보여요.</span>`)
    : `<span class="muted">Top 3 회원이 많이 산 상품을 보고 추천을 정해요.</span>`;
  $("verdict1").innerHTML = sent ? (sent === "ok" ? `<div class="verdict ok">✔ 한 달 뒤, ${c.name}은(는) ${ITEM_EMOJI[c.buy]} <b>${c.buy}</b>를 샀어요! 추천 성공!</div>` :
    `<div class="verdict no">✘ 한 달 뒤, ${c.name}은(는) ${ITEM_EMOJI[c.buy]} <b>${c.buy}</b>를 샀어요. 닮은 회원 Top 3를 다시 살펴볼까요?</div>`) : "";
  // 단위 경고
  const w = $("unitWarn");
  if (u !== 1 && comp) {
    const R1 = MEMBERS.map(m => ({ m, d: Math.hypot(m.age - t.age, m.spend - t.spend) })).sort((a, b) => a.d - b.d).slice(0, 3).map(x => x.m.name).join(", ");
    const R10 = R.slice(0, 3).map(x => `${x.m.name}(${x.m.age}세)`).join(", ");
    w.classList.remove("hide"); w.innerHTML = `단위만 ‘천 원’으로 바꿨는데 Top 3가 달라졌어요! 만 원: ${R1} → 천 원: ${R10}<br><span style="font-weight:600">월 소비 1천 원 차이가 나이 1살 차이와 같은 크기로 계산되기 때문이에요. 이 문제는 3차시에서 다시 만나요.</span>`;
  } else w.classList.add("hide");
  // 표
  $("c1count").textContent = `${MEMBERS.length}명`;
  const rows = comp ? R : MEMBERS.map(m => ({ m, d: d1(m) }));
  const top = new Set(comp ? R.slice(0, 3).map(x => x.m.name) : []);
  $("c1table").innerHTML = rows.map((x, i) => { const show = comp || S.c1.sel === x.m.name; const da = t.age - x.m.age, ds = (t.spend - x.m.spend) * u;
    return `<tr class="pick ${S.c1.sel === x.m.name ? "cur" : ""}" data-n="${x.m.name}"><td class="ctr">${comp ? (top.has(x.m.name) ? `<b style="color:var(--yel-d)">${i + 1}</b>` : i + 1) : "-"}</td><td><b>${x.m.name}</b></td><td class="ctr">${x.m.age}세</td><td class="ctr">${x.m.spend * u}${u === 1 ? "만" : "천"} 원</td>
    <td class="small">${show ? `√(${da * da} + ${ds * ds})` : '<span class="hid">?</span>'}</td><td class="num">${show ? `<b>${r2(x.d)}</b>` : '<span class="hid">?</span>'}</td><td>${ITEM_EMOJI[x.m.item]} ${x.m.item}</td></tr>`; }).join("");
  $("c1table").querySelectorAll("tr").forEach(tr => tr.onclick = () => clickMember(MEMBERS.find(m => m.name === tr.dataset.n)));
  $("hdr1").textContent = `${["A", "B", "C"].filter(k => S.c1.sent[k] === "ok").length} / 3`;
  renderPlot1();
}
$("calcAll").onclick = () => { S.c1.comp[compKey()] = true; S.c1.comp["M_" + S.c1.unit] = S.c1.comp["M_" + S.c1.unit] || S.c1.cs === "M"; save(); render1(); };
$("sendRec").onclick = () => { const c = curCase(); S.c1.sent[c.key] = S.c1.rec[c.key] === c.buy ? "ok" : "no"; save(); render1(); };
document.querySelectorAll("#unitSw button").forEach(b => b.onclick = () => { S.c1.unit = +b.dataset.u; save(); render1(); });
["meAge", "meSpend"].forEach(id => $(id).oninput = () => { S.c1.me.age = Math.max(10, Math.min(70, +$("meAge").value || 10)); S.c1.me.spend = Math.max(0, Math.min(50, +$("meSpend").value || 0)); save(); render1(); });
$("meAge").value = S.c1.me.age; $("meSpend").value = S.c1.me.spend;

// =================== 사건 2 ===================
const norm = v => Math.hypot(...v);
const unit = v => { const n = norm(v); return v.map(x => x / n); };
const dist = (a, b) => Math.hypot(...a.map((x, i) => x - b[i]));
const cosv = (a, b) => 1 - dist(unit(a), unit(b)) ** 2 / 2;
const fmtv = v => "(" + v.join(", ") + ")";
const fmtu = v => "(" + v.map(x => x.toFixed(2)).join(", ") + ")";
function cosSteps(a, b, nameA, nameB) {
  const ua = unit(a), ub = unit(b), d = dist(ua, ub), c = 1 - d * d / 2;
  return `<b>① 길이 구하기</b><br><span class="f">|${nameA}| = √(${a.map(x => x + "²").join(" + ")}) ≈ ${r2(norm(a))}</span><br><span class="f">|${nameB}| = √(${b.map(x => x + "²").join(" + ")}) ≈ ${r2(norm(b))}</span>
  <br><b>② 길이를 1로 맞추기</b> (각 성분 ÷ 길이)<br><span class="f">${nameA} → ${fmtu(ua)}</span><br><span class="f">${nameB} → ${fmtu(ub)}</span>
  <br><b>③ 두 끝 사이의 거리</b> <span class="f">d ≈ ${r3(d)}</span>
  <br><b>④ cos θ = 1 − d² ÷ 2</b> ≈ <b class="r">${r3(c)}</b> <span class="muted">(θ ≈ ${Math.round(Math.acos(Math.min(1, Math.max(-1, c))) * 180 / Math.PI)}°)</span>`;
}
document.querySelectorAll("[data-st]").forEach(b => b.onclick = () => { S.c2.step = +b.dataset.st; save(); render2(); });
["tArrow", "tRay", "tUnit"].forEach(id => $(id).onchange = renderPlot2);
function renderPlot2() {
  const svg = $("plot2"); svg.innerHTML = "";
  const U = $("tUnit").checked;
  const M = U ? mapper({ x: 60, y: 30, w: 560, h: 390 }, [0, 1.15], [0, 1.15]) : mapper({ x: 60, y: 30, w: 560, h: 390 }, [0, 16], [0, 9]);
  axes(svg, M, U ? 0.2 : 2, U ? 0.2 : 1, U ? "책·문구 (길이 1로 맞춤)" : "책·문구 (만 원)", U ? "음료 (길이 1로 맞춤)" : "음료 (만 원)", v => U ? (+v).toFixed(1) : v);
  const p2 = v => [v[2], v[1]], pos = v => { const q = p2(v); if (!U) return q; const n = Math.hypot(...q); return [q[0] / n, q[1] / n]; };
  if (U) { const r = M.s; svg.appendChild(el("path", { d: `M ${M.X(1)} ${M.Y(0)} A ${r} ${r} 0 0 0 ${M.X(0)} ${M.Y(1)}`, class: "ucirc" })); }
  const vp = pos(VIP.v);
  if ($("tRay").checked) { const k = U ? 1.12 : Math.min(16 / vp[0], 9 / vp[1]); svg.appendChild(el("line", { x1: M.X(0), y1: M.Y(0), x2: M.X(vp[0] * k), y2: M.Y(vp[1] * k), class: "ray" })); }
  // 같은 좌표에 있는 고객은 이름을 묶어서
  const groups = {};
  CUSTOMERS.forEach(c => { const q = p2(c.v), k = q.join(","); (groups[k] = groups[k] || []).push(c); });
  const selName = S.c2.sel2;
  Object.values(groups).forEach(g => {
    const [x, y] = pos(g[0].v), X = M.X(x), Y = M.Y(y), isSel = g.some(c => c.name === selName);
    if ($("tArrow").checked) { const a = el("g", { style: "color:#9FC4E0" }); svg.appendChild(a); arrow(a, M.X(0), M.Y(0), X, Y, "vec", 8); a.firstChild.setAttribute("style", "stroke:#B9D3E6;stroke-width:1.5"); }
    const c = el("circle", { cx: X, cy: Y, r: 7, class: "pt" + (isSel ? " sel" : "") }); c.onclick = () => { S.c2.sel2 = g[g.findIndex(q => q.name === selName) + 1 < g.length && isSel ? g.findIndex(q => q.name === selName) + 1 : 0].name; save(); renderPlot2(); renderDet2(); }; svg.appendChild(c);
    svg.appendChild(el("text", { x: X + 9, y: Y - 8, class: "pname" }, g.map(q => q.name).join("·")));
  });
  const a = el("g", { style: "color:#C98A1E" }); svg.appendChild(a); arrow(a, M.X(0), M.Y(0), M.X(vp[0]), M.Y(vp[1]), "vec t", 11);
  svg.appendChild(star(M.X(vp[0]), M.Y(vp[1]), 12));
  svg.appendChild(el("text", { x: M.X(vp[0]) + 14, y: M.Y(vp[1]) + 20, class: "tname" }, "지민 (8, 4)"));
  if (selName) { const c = CUSTOMERS.find(q => q.name === selName), [x, y] = pos(c.v);
    svg.appendChild(el("line", { x1: M.X(vp[0]), y1: M.Y(vp[1]), x2: M.X(x), y2: M.Y(y), class: "hyp" })); }
}
function renderDet2() {
  const c = CUSTOMERS.find(q => q.name === S.c2.sel2);
  if (!c) { $("c2d2title").textContent = "고객을 눌러 보세요"; $("c2d2").innerHTML = "—"; return; }
  const a = [VIP.v[2], VIP.v[1]], b = [c.v[2], c.v[1]], same = CUSTOMERS.filter(q => q.v[2] === c.v[2] && q.v[1] === c.v[1]).map(q => q.name);
  $("c2d2title").textContent = `지민 (8, 4) ↔ ${c.name} ${fmtv(b)}`;
  $("c2d2").classList.remove("muted");
  $("c2d2").innerHTML = `<b>거리</b> <span class="f">√((8 − ${b[0]})² + (4 − ${b[1]})²) = √${(8 - b[0]) ** 2 + (4 - b[1]) ** 2}</span> ≈ <b class="r">${r2(dist(a, b))}</b><hr style="border:0;border-top:1px solid var(--line)">${cosSteps(a, b, "지민", c.name)}
    ${same.length > 1 ? `<div class="note" style="margin-top:8px">${same.join(" · ")}는 두 가지만 보면 같은 점이에요. 네 가지를 모두 보면 어떨까요? → ②</div>` : ""}`;
}
// 4차원 표
const D2 = c => dist(VIP.v, c.v), C2 = c => cosv(VIP.v, c.v), BUY = c => C2(c) >= BUY_COS;
$("catLegend").innerHTML = CATS.map((c, i) => `<span><i style="background:${CAT_COLORS[i]}"></i>${c}</span>`).join("") + `<span class="muted">· 막대는 한 달 지출 중 각 항목의 비율</span>`;
const mixBar = v => { const s = v.reduce((a, b) => a + b, 0); return `<div class="mix">${v.map((x, i) => `<i style="width:${x / s * 100}%;background:${CAT_COLORS[i]}"></i>`).join("")}</div>`; };
function render2() {
  document.querySelectorAll("[data-st]").forEach(b => b.classList.toggle("on", +b.dataset.st === S.c2.step));
  $("c2s1").classList.toggle("hide", S.c2.step !== 1); $("c2s2").classList.toggle("hide", S.c2.step !== 2);
  renderPlot2(); renderDet2();
  let rows = CUSTOMERS.slice();
  if (S.c2.sort === "d") rows.sort((a, b) => D2(a) - D2(b)); else if (S.c2.sort === "c") rows.sort((a, b) => C2(b) - C2(a));
  document.querySelectorAll("#c2s2 .sortbar button").forEach(b => { b.classList.toggle("on", b.dataset.s === S.c2.sort); b.disabled = (b.dataset.s === "d" && !S.c2.showD) || (b.dataset.s === "c" && !S.c2.showC); });
  const sent = S.c2.sent;
  $("buyH").classList.toggle("hide", !sent);
  const vipRow = `<tr style="background:var(--yel-t)"><td></td><td><b style="color:var(--yel-d)">⭐ 지민 (기준)</b></td>${VIP.v.map(x => `<td class="ctr">${x}</td>`).join("")}<td class="ctr">${VIP.v.reduce((a, b) => a + b, 0)}</td><td>${mixBar(VIP.v)}</td><td class="num">-</td><td class="num">-</td>${sent ? "<td></td>" : ""}</tr>`;
  $("c2table").innerHTML = vipRow + rows.map(c => { const pk = S.c2.picks.includes(c.name);
    return `<tr class="pick ${S.c2.cur === c.name ? "cur" : ""}" data-n="${c.name}"><td class="ctr"><input type="checkbox" data-p="${c.name}" ${pk ? "checked" : ""} ${sent ? "disabled" : ""}></td><td><b>${c.name}</b></td>${c.v.map(x => `<td class="ctr">${x}</td>`).join("")}<td class="ctr">${c.v.reduce((a, b) => a + b, 0)}</td><td>${mixBar(c.v)}</td>
    <td class="num">${S.c2.showD ? r2(D2(c)) : '<span class="hid">?</span>'}</td><td class="num">${S.c2.showC ? `<b>${r3(C2(c))}</b>` : '<span class="hid">?</span>'}</td>
    ${sent ? `<td class="ctr">${BUY(c) ? "🛍 구매" : '<span class="muted">-</span>'}</td>` : ""}</tr>`; }).join("");
  $("c2table").querySelectorAll("tr.pick").forEach(tr => tr.onclick = e => { if (e.target.tagName === "INPUT") return; S.c2.cur = tr.dataset.n; save(); render2(); });
  $("c2table").querySelectorAll("input[data-p]").forEach(cb => cb.onchange = () => {
    const n = cb.dataset.p, P = S.c2.picks;
    if (cb.checked) { if (P.length >= 5) { cb.checked = false; alert("쿠폰은 5장뿐이에요."); return; } P.push(n); } else S.c2.picks = P.filter(x => x !== n);
    save(); render2(); });
  $("pickN").textContent = `${S.c2.picks.length} / 5`;
  $("sendCp").disabled = sent || S.c2.picks.length !== 5;
  $("showD").disabled = S.c2.showD; $("showC").disabled = S.c2.showC;
  const cur = CUSTOMERS.find(c => c.name === S.c2.cur);
  if (cur) {
    $("c2detT").textContent = `지민 ${fmtv(VIP.v)} ↔ ${cur.name} ${fmtv(cur.v)}`;
    $("c2det").classList.remove("muted");
    $("c2det").innerHTML = `<b>거리</b><br><span class="f">√(${VIP.v.map((x, i) => `(${x} − ${cur.v[i]})²`).join(" + ")})</span><br><span class="f">= √${VIP.v.reduce((s, x, i) => s + (x - cur.v[i]) ** 2, 0)}</span> ≈ <b class="r">${r2(D2(cur))}</b><hr style="border:0;border-top:1px solid var(--line)">${cosSteps(VIP.v, cur.v, "지민", cur.name)}`;
  } else { $("c2detT").textContent = "고객 행을 누르면 계산 과정이 나와요"; $("c2det").innerHTML = "—"; }
  if (sent) {
    const hit = S.c2.picks.filter(n => BUY(CUSTOMERS.find(c => c.name === n))).length;
    const dTop = CUSTOMERS.slice().sort((a, b) => D2(a) - D2(b)).slice(0, 5), cTop = CUSTOMERS.slice().sort((a, b) => C2(b) - C2(a)).slice(0, 5);
    const h = arr => arr.filter(BUY).length;
    $("verdict2").innerHTML = `<div class="verdict ${hit >= 4 ? "ok" : "no"}">한 달 뒤… 쿠폰 5장 중 <b>${hit}장</b>이 신상품 구매로 이어졌어요! ${hit === 5 ? "🎉 완벽한 탐정!" : ""}</div>
      <div class="calc small" style="margin-top:8px">· 거리가 가까운 5명(${dTop.map(c => c.name).join(", ")})에게 보냈다면 → <b>${h(dTop)}장</b><br>· cos θ가 큰 5명(${cTop.map(c => c.name).join(", ")})에게 보냈다면 → <b>${h(cTop)}장</b><br><span class="muted">신상품은 ‘얼마나 많이 쓰나’보다 ‘무엇에 쓰나(취향)’와 관련이 있었어요.</span></div>`;
    $("hdr2").textContent = `${hit} / 5 성공`;
  } else { $("verdict2").innerHTML = ""; $("hdr2").textContent = "미해결"; }
}
$("showD").onclick = () => { S.c2.showD = true; save(); render2(); };
$("showC").onclick = () => { S.c2.showC = true; save(); render2(); };
document.querySelectorAll("#c2s2 .sortbar button").forEach(b => b.onclick = () => { S.c2.sort = b.dataset.s; save(); render2(); });
$("sendCp").onclick = () => { if (S.c2.picks.length !== 5) return; S.c2.sent = true; save(); render2(); };
$("resetCp").onclick = () => { S.c2.picks = []; S.c2.sent = false; save(); render2(); };

// =================== 실험실 ===================
const LAB = { a: [6, 2], b: [3, 6] };
["lDist", "lAng", "lUnit", "lShadow"].forEach(id => $(id).onchange = drawLab);
let dragKey = null;
function drawLab() {
  const svg = $("plot3"); svg.innerHTML = "";
  const M = mapper({ x: 50, y: 20, w: 490, h: 490 }, [0, 10], [0, 10]);
  axes(svg, M, 1, 1, "x", "y");
  const A = LAB.a, B = LAB.b, nA = norm(A), nB = norm(B), uA = unit(A), uB = unit(B), d = dist(A, B), du = dist(uA, uB), cs = 1 - du * du / 2;
  const ang = v => Math.atan2(v[1], v[0]), th = Math.abs(ang(A) - ang(B));
  const Rv = 4;   // 길이 1을 4칸으로 확대해서 그림
  if ($("lUnit").checked || $("lShadow").checked) {
    svg.appendChild(el("path", { d: `M ${M.X(Rv)} ${M.Y(0)} A ${Rv * M.s} ${Rv * M.s} 0 0 0 ${M.X(0)} ${M.Y(Rv)}`, class: "ucirc" }));
    svg.appendChild(el("text", { x: M.X(Rv) + 4, y: M.Y(0) - 6, class: "tick" }, "1"));
  }
  if ($("lAng").checked) {
    const r = 1.4 * M.s, a1 = ang(A), a2 = ang(B), lo = Math.min(a1, a2), hi = Math.max(a1, a2);
    svg.appendChild(el("path", { d: `M ${M.X(0)} ${M.Y(0)} L ${M.X(0) + r * Math.cos(lo)} ${M.Y(0) - r * Math.sin(lo)} A ${r} ${r} 0 0 0 ${M.X(0) + r * Math.cos(hi)} ${M.Y(0) - r * Math.sin(hi)} Z`, class: "arc" }));
    const mid = (lo + hi) / 2; svg.appendChild(el("text", { x: M.X(0) + (r + 14) * Math.cos(mid), y: M.Y(0) - (r + 14) * Math.sin(mid) + 4, class: "hlab", style: "fill:#9A6508" }, "θ"));
  }
  const ga = el("g", { style: "color:#1F7BC6" }), gb = el("g", { style: "color:#C98A1E" }); svg.appendChild(ga); svg.appendChild(gb);
  arrow(ga, M.X(0), M.Y(0), M.X(A[0]), M.Y(A[1]), "vec", 12); arrow(gb, M.X(0), M.Y(0), M.X(B[0]), M.Y(B[1]), "vec t", 12);
  if ($("lDist").checked) {
    svg.appendChild(el("line", { x1: M.X(A[0]), y1: M.Y(A[1]), x2: M.X(B[0]), y2: M.Y(B[1]), class: "hyp", "stroke-dasharray": "6 4" }));
    svg.appendChild(el("text", { x: M.X((A[0] + B[0]) / 2) + 8, y: M.Y((A[1] + B[1]) / 2) - 8, class: "hlab" }, "d = " + r2(d)));
  }
  if ($("lUnit").checked) {
    [uA, uB].forEach((u, i) => svg.appendChild(el("circle", { cx: M.X(u[0] * Rv), cy: M.Y(u[1] * Rv), r: 5, fill: i ? "#C98A1E" : "#1F7BC6" })));
    svg.appendChild(el("line", { x1: M.X(uA[0] * Rv), y1: M.Y(uA[1] * Rv), x2: M.X(uB[0] * Rv), y2: M.Y(uB[1] * Rv), stroke: "#2B3A6B", "stroke-width": 2.5 }));
    svg.appendChild(el("text", { x: M.X((uA[0] + uB[0]) / 2 * Rv) - 70, y: M.Y((uA[1] + uB[1]) / 2 * Rv) + 18, class: "hlab", style: "fill:#2B3A6B" }, "d₁ = " + r3(du)));
  }
  if ($("lShadow").checked) {
    const sx = uA[0] * cs * Rv, sy = uA[1] * cs * Rv;
    svg.appendChild(el("line", { x1: M.X(0), y1: M.Y(0), x2: M.X(sx), y2: M.Y(sy), class: "shadow" }));
    svg.appendChild(el("line", { x1: M.X(uB[0] * Rv), y1: M.Y(uB[1] * Rv), x2: M.X(sx), y2: M.Y(sy), class: "leg" }));
    svg.appendChild(el("circle", { cx: M.X(uB[0] * Rv), cy: M.Y(uB[1] * Rv), r: 4, fill: "#C98A1E" }));
  }
  [["a", A, "#1F7BC6", "A"], ["b", B, "#C98A1E", "B"]].forEach(([k, v, col, lab]) => {
    const h = el("circle", { cx: M.X(v[0]), cy: M.Y(v[1]), r: 11, fill: col, stroke: "#fff", "stroke-width": 3, class: "drag" });
    h.addEventListener("pointerdown", e => { dragKey = k; h.setPointerCapture(e.pointerId); });
    h.addEventListener("pointermove", e => { if (dragKey !== k) return; const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY; const p = pt.matrixTransform(svg.getScreenCTM().inverse());
      let x = Math.round((p.x - M.ox) / M.s), y = Math.round((M.oy + M.h - p.y) / M.s); x = Math.max(0, Math.min(10, x)); y = Math.max(0, Math.min(10, y));
      if (x === 0 && y === 0) return; if (x !== LAB[k][0] || y !== LAB[k][1]) { LAB[k] = [x, y]; drawLab(); } });
    h.addEventListener("pointerup", () => { dragKey = null; });
    svg.appendChild(h);
    svg.appendChild(el("text", { x: M.X(v[0]) + 14, y: M.Y(v[1]) - 12, class: "pname", style: `fill:${col}` }, `${lab} (${v[0]}, ${v[1]})`));
  });
  $("labOut").innerHTML = [["A의 길이 |A|", r2(nA)], ["B의 길이 |B|", r2(nB)], ["거리 d", r2(d)], ["끼인각 θ", Math.round(th * 180 / Math.PI) + "°"], ["cos θ", r3(Math.cos(th))], ["길이 1로 맞춘 뒤 거리 d₁", r3(du)]]
    .map(([l, v]) => `<div><div class="l">${l}</div><div class="v">${v}</div></div>`).join("");
  $("labWhy").innerHTML = `<p style="margin:0 0 6px"><b>그림자로 읽기</b> 길이 1인 B를 A 방향으로 비추면 그림자 길이가 <b>${r3(Math.cos(th))}</b> = cos θ</p>
    <p style="margin:0"><b>거리로 읽기</b> 길이를 1로 맞춘 두 끝 사이 거리 d₁ = ${r3(du)} → 1 − d₁² ÷ 2 = <b>${r3(cs)}</b> = cos θ</p>`;
}

$("resetAll").onclick = () => { if (!confirm("이 기기의 사건 기록을 모두 지우고 처음부터 할까요?")) return; S = fresh(); save(); $("meAge").value = 17; $("meSpend").value = 10; render1(); render2(); };
render1(); render2(); drawLab();
