// 로컬 테스트용: Code.gs를 그대로 실행하는 가짜 Apps Script 서버 + 정적 파일 서버
// 사용: node dev/server.js  → http://localhost:8080/ (API: /api)
const http = require('http'), fs = require('fs'), path = require('path'), vm = require('vm'), url = require('url');
const ROOT = path.join(__dirname, '..');
const props = {}, cache = {};
const ctx = {
  PropertiesService: { getScriptProperties: () => ({
    getProperty: k => (k in props ? props[k] : null), setProperty: (k, v) => { if (String(v).length > 9000) throw new Error('property too big ' + String(v).length); props[k] = String(v); },
    deleteProperty: k => { delete props[k]; }, getProperties: () => ({ ...props }) }) },
  CacheService: { getScriptCache: () => ({ get: k => (k in cache ? cache[k] : null), put: (k, v) => { cache[k] = v; }, remove: k => { delete cache[k]; } }) },
  LockService: { getScriptLock: () => ({ waitLock: () => {}, releaseLock: () => {} }) },
  ContentService: { MimeType: { JSON: 'json', JAVASCRIPT: 'js' }, createTextOutput: s => ({ s, setMimeType(m) { this.m = m; return this; } }) },
  Date, Math, JSON, String, Object, parseInt, Error,
};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'apps-script/Code.gs'), 'utf8'), ctx);
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.md': 'text/plain; charset=utf-8' };
const DELAY = +process.env.DELAY || 0;
http.createServer((req, res) => {
  const u = url.parse(req.url, true);
  if (u.pathname === '/api') {
    setTimeout(() => {
      const out = ctx.doGet({ parameter: u.query });
      res.writeHead(200, { 'Content-Type': out.m === 'js' ? 'text/javascript' : 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(out.s);
    }, DELAY);
    return;
  }
  let f = path.join(ROOT, decodeURIComponent(u.pathname));
  if (u.pathname.endsWith('/')) f = path.join(f, 'index.html');
  if (!f.startsWith(ROOT) || !fs.existsSync(f)) { res.writeHead(404); res.end('not found'); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
  res.end(fs.readFileSync(f));
}).listen(+process.env.PORT || 8080, () => console.log('SenMart dev server on', +process.env.PORT || 8080));
