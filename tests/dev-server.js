/**
 * dev-server.js — خادم تطوير/اختبار محلي يقدّم واجهة المنصة الحقيقية (index.html مع التضمينات)
 * ويحوّل استدعاءات google.script.run إلى طبقة الخادم المحاكاة (gas-mock).
 * ------------------------------------------------------------
 * - GET /            → doGet() مع حقن جسر google.script.run (fetch إلى /api)
 * - POST /api        → api(req)
 * - GET /__mail      → صندوق البريد الصادر المحاكى (للاختبارات)
 * - POST /__reset    → بيئة جديدة (+ إعداد تلقائي: مدير ومتدرب) ويُعيد بيانات الدخول
 * - POST /__mock     → ضبط المحاكاة: { mailFailNext, claude: true|false }
 * هذا الخادم لأغراض الاختبار المحلي فقط وليس بديلًا لنشر تطبيق الويب في Apps Script.
 */
'use strict';
const http = require('http');
const { createGas, makeClaudeMock } = require('./gas-mock');

const PORT = Number(process.env.PORT) || 4173;
let g = null;
let creds = null;

function fresh() {
  g = createGas();
  g.call('SETUP_1_initialize');
  const tokens = g.mock.logs.join('\n').match(/\(صالح 24 ساعة\): (\d+)/g) || [];
  const setupToken = tokens.length ? tokens[tokens.length - 1].match(/(\d+)$/)[1] : null;
  creds = { setupToken, adminEmail: 'admin@education.qa', traineeEmail: 'ahmed@education.qa', password: 'Passw0rd123' };
  return creds;
}
/** إعداد كامل: مدير + متدرب مفعّل (للاختبارات التي لا تختبر الإعداد نفسه) */
function seedAccounts() {
  const a = g.api('setup.createAdmin', { setupToken: creds.setupToken, name: 'هاني عبده محمود', email: creds.adminEmail, password: creds.password, jobTitle: 'نائب مدير للشؤون الأكاديمية' });
  if (!a.ok) throw new Error('seed admin failed: ' + a.message);
  g.api('admin.settings.save', { settings: { adminNotifyEmail: creds.adminEmail } }, a.data.token);
  g.api('auth.register', { name: 'أحمد محمد عبدالله المعلم', email: creds.traineeEmail, jobTitle: 'معلم', department: 'الرياضيات', password: creds.password });
  const m = g.mock.mail.outbox.slice().reverse().find((x) => x.to === creds.traineeEmail);
  const code = m && (m.html.match(/>(\d{6})</) || [])[1];
  g.api('auth.verifyEmail', { email: creds.traineeEmail, code });
  g.mock.mail.outbox.length = 0;
  g.mock.http.handler = makeClaudeMock();
  creds.seeded = true;
  return creds;
}

const BRIDGE = `<script>
window.google = { script: { run: (function () {
  function make() { var ok = null, fail = null; var o = {
    withSuccessHandler: function (f) { ok = f; return o; },
    withFailureHandler: function (f) { fail = f; return o; },
    api: function (req) { fetch('/api', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(req) }).then(function (r) { return r.json(); }).then(function (d) { if (ok) ok(d); }).catch(function (e) { if (fail) fail(e); }); }
  }; return o; }
  return { withSuccessHandler: function (f) { return make().withSuccessHandler(f); }, withFailureHandler: function (f) { return make().withFailureHandler(f); }, api: function (r) { return make().api(r); } };
})() } };
</script>`;

function readBody(req) { return new Promise((res) => { let b = ''; req.on('data', (c) => { b += c; }); req.on('end', () => res(b)); }); }

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (req.method === 'GET' && url.pathname === '/') {
      const params = {}; url.searchParams.forEach((v, k) => { params[k] = v; });
      const out = g.call('doGet', { parameter: params });
      let html = out.getContent();
      html = html.replace('</head>', BRIDGE + '</head>').replace('<base target="_top">', '');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(html); return;
    }
    if (req.method === 'POST' && url.pathname === '/api') {
      const body = JSON.parse((await readBody(req)) || '{}');
      const out = g.call('api', body);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(out)); return;
    }
    if (url.pathname === '/__mail') { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(g.mock.mail.outbox)); return; }
    if (url.pathname === '/__state') { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ creds, errors: g.mock.errors, logs: g.mock.logs.slice(-5), props: Object.keys(g.mock.props) })); return; }
    if (req.method === 'POST' && url.pathname === '/__reset') {
      const body = JSON.parse((await readBody(req)) || '{}');
      fresh(); if (body.seed !== false) seedAccounts();
      res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(creds)); return;
    }
    if (req.method === 'POST' && url.pathname === '/__mock') {
      const body = JSON.parse((await readBody(req)) || '{}');
      if (body.mailFailNext !== undefined) g.mock.mail.failNext = body.mailFailNext;
      if (body.claude === false) g.mock.http.handler = null; else if (body.claude) g.mock.http.handler = makeClaudeMock(body.claude === true ? {} : body.claude);
      if (body.advanceMs) g.mock.advance(body.advanceMs);
      res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{"ok":true}'); return;
    }
    if (url.pathname === '/__rows') { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(g.sheetRows(url.searchParams.get('t') || 'Users'))); return; }
    res.writeHead(404); res.end('not found');
  } catch (e) {
    res.writeHead(500, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: String(e && e.stack || e) }));
  }
});

fresh(); if (process.env.SEED !== '0') seedAccounts();
server.listen(PORT, () => { console.log('IKP dev server on http://localhost:' + PORT + ' (setup token: ' + creds.setupToken + ', seeded: ' + !!creds.seeded + ')'); });
