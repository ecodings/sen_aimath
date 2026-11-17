/**
 * SenMart 천하제일 알바대회 — 순위판 서버 (Google Apps Script)
 *
 * 설치: README.md의 "2. 순위판 서버 만들기" 참고
 *  1) script.google.com → 새 프로젝트 → 이 코드를 붙여넣기
 *  2) 배포 → 새 배포 → 유형: 웹 앱 / 실행: 나 / 액세스 권한: 모든 사용자
 *  3) 웹 앱 URL을 config.js 의 API_URL 에 붙여넣기
 *
 * 교사 코드를 바꾸려면: 프로젝트 설정 → 스크립트 속성 → HOST_KEY 추가
 */
var DEFAULT_HOST_KEY = 'sen2026';
var MAX_TEAMS = 40;
var OPEN_PHASE = { '1': 2, '2': 4, '3': 6 };   // 라운드 → 제출을 받는 단계
var LAST_PHASE = 7;
var KEEP_MS = 3 * 24 * 3600 * 1000;           // 3일 지난 게임은 정리

function doGet(e) {
  var p = (e && e.parameter) || {};
  var out;
  try { out = handle_(p); }
  catch (err) { out = { ok: false, err: String((err && err.message) || err) }; }
  var body = JSON.stringify(out);
  if (p.callback && /^[\w.$]+$/.test(p.callback)) {
    return ContentService.createTextOutput(p.callback + '(' + body + ')').setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(body).setMimeType(ContentService.MimeType.JSON);
}

function hostKey_() {
  return PropertiesService.getScriptProperties().getProperty('HOST_KEY') || DEFAULT_HOST_KEY;
}
function isHost_(p) { return String(p.key || '') === hostKey_(); }
function needHost_(p) { if (!isHost_(p)) throw new Error('교사 코드가 맞지 않아요.'); }

function load_(pin) {
  var k = 'G_' + pin, cache = CacheService.getScriptCache();
  var s = cache.get(k);
  if (!s) { s = PropertiesService.getScriptProperties().getProperty(k); if (s) cache.put(k, s, 21600); }
  return s ? JSON.parse(s) : null;
}
function save_(g) {
  var k = 'G_' + g.pin, s = JSON.stringify(g);
  PropertiesService.getScriptProperties().setProperty(k, s);
  CacheService.getScriptCache().put(k, s, 21600);
}
function withLock_(fn) {
  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try { return fn(); } finally { lock.releaseLock(); }
}
function mustGame_(pin) {
  pin = String(pin || '').replace(/\D/g, '');
  var g = load_(pin);
  if (!g) throw new Error('참여 코드 ' + pin + ' 게임을 찾을 수 없어요.');
  return g;
}
function cleanName_(s) {
  s = String(s || '').replace(/[<>&"'`\\]/g, '').replace(/\s+/g, ' ').trim();
  if (s.length < 1 || s.length > 12) throw new Error('지점 이름은 1~12글자로 정해 주세요.');
  return s;
}
function rid_() {
  var c = 'abcdefghjkmnpqrstuvwxyz23456789', s = '';
  for (var i = 0; i < 8; i++) s += c.charAt(Math.floor(Math.random() * c.length));
  return s;
}
function cleanup_() {
  var props = PropertiesService.getScriptProperties(), all = props.getProperties(), now = Date.now();
  Object.keys(all).forEach(function (k) {
    if (k.indexOf('G_') !== 0) return;
    try { if (now - JSON.parse(all[k]).created > KEEP_MS) props.deleteProperty(k); } catch (e) { props.deleteProperty(k); }
  });
}

function view_(g, p) {
  var host = isHost_(p), subs = {}, mine = {}, count = {};
  Object.keys(g.subs).forEach(function (r) {
    var closed = g.phase > OPEN_PHASE[r];
    count[r] = Object.keys(g.subs[r]).length;
    if (host || closed) subs[r] = g.subs[r];
    if (p.id && g.subs[r][p.id]) mine[r] = g.subs[r][p.id];
  });
  return {
    ok: true, pin: g.pin, phase: g.phase, deadline: g.deadline || 0, now: Date.now(), host: host,
    teams: g.teams.filter(function (t) { return host || !t.h || t.id === p.id; }),
    subs: subs, mine: mine, count: count
  };
}

function handle_(p) {
  var a = p.a || 'state';
  if (a === 'ping') return { ok: true, now: Date.now() };

  if (a === 'check') { needHost_(p); return { ok: true }; }

  if (a === 'create') {
    needHost_(p);
    return withLock_(function () {
      cleanup_();
      var pin;
      do { pin = String(1000 + Math.floor(Math.random() * 9000)); } while (load_(pin));
      var g = { pin: pin, created: Date.now(), phase: 0, deadline: 0, teams: [], subs: { '1': {}, '2': {}, '3': {} } };
      save_(g);
      return view_(g, p);
    });
  }

  if (a === 'state') return view_(mustGame_(p.pin), p);

  if (a === 'join') {
    return withLock_(function () {
      var g = mustGame_(p.pin), name = cleanName_(p.name);
      if (p.id) {   // 새로고침 등으로 다시 들어온 경우
        var me = g.teams.filter(function (t) { return t.id === p.id; })[0];
        if (me) return { ok: true, id: me.id, name: me.name };
      }
      var same = g.teams.filter(function (t) { return t.name.toLowerCase() === name.toLowerCase(); });
      if (same.length) throw new Error('이미 있는 지점 이름이에요. 다른 이름을 정해 주세요.');
      if (g.teams.length >= MAX_TEAMS) throw new Error('참가 지점이 너무 많아요.');
      var t = { id: rid_(), name: name, h: 0, t: Date.now() };
      g.teams.push(t); save_(g);
      return { ok: true, id: t.id, name: t.name };
    });
  }

  if (a === 'submit') {
    return withLock_(function () {
      var g = mustGame_(p.pin), r = String(p.r), d = String(p.d || '').toUpperCase();
      if (!OPEN_PHASE[r]) throw new Error('라운드 번호가 잘못됐어요.');
      if (g.phase !== OPEN_PHASE[r]) throw new Error('지금은 ' + r + '라운드 진열을 받는 시간이 아니에요.');
      if (!/^[A-U-]{7}$/.test(d)) throw new Error('진열 정보가 잘못됐어요.');
      if (!g.teams.some(function (t) { return t.id === p.id; })) throw new Error('입장 정보가 없어요. 다시 입장해 주세요.');
      g.subs[r][p.id] = d; save_(g);
      return { ok: true, r: r, d: d };
    });
  }

  // ---------- 교사용 ----------
  needHost_(p);
  return withLock_(function () {
    var g = mustGame_(p.pin);
    if (a === 'phase') {
      var v = Math.max(0, Math.min(LAST_PHASE, parseInt(p.v, 10) || 0));
      if (v !== g.phase) { g.phase = v; g.deadline = 0; }
    } else if (a === 'timer') {
      var sec = Math.max(0, Math.min(3600, parseInt(p.sec, 10) || 0));
      g.deadline = sec ? Date.now() + sec * 1000 : 0;
    } else if (a === 'hide') {
      g.teams.forEach(function (t) { if (t.id === p.id) t.h = t.h ? 0 : 1; });
    } else if (a === 'rename') {
      var nm = cleanName_(p.name);
      g.teams.forEach(function (t) { if (t.id === p.id) t.name = nm; });
    } else if (a === 'manual') {   // 기기 문제로 제출 못 한 지점: 결과 코드로 대신 입력
      var mn = cleanName_(p.name), r = String(p.r), d = String(p.d || '').toUpperCase();
      if (!OPEN_PHASE[r]) throw new Error('라운드 번호가 잘못됐어요.');
      if (!/^[A-U-]{7}$/.test(d)) throw new Error('결과 코드가 잘못됐어요.');
      var team = g.teams.filter(function (t) { return t.name.toLowerCase() === mn.toLowerCase(); })[0];
      if (!team) { team = { id: rid_(), name: mn, h: 0, t: Date.now() }; g.teams.push(team); }
      g.subs[r][team.id] = d;
    } else if (a === 'unsub') {
      var rr = String(p.r); if (g.subs[rr]) delete g.subs[rr][p.id];
    } else {
      throw new Error('알 수 없는 요청: ' + a);
    }
    save_(g);
    return view_(g, p);
  });
}
