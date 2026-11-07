/**
 * gas-mock.js — محاكي خدمات Google Apps Script لتشغيل كود الخادم (src/*.gs) داخل Node.js لأغراض الاختبار.
 * ------------------------------------------------------------
 * يحاكي: SpreadsheetApp (أوراق في الذاكرة مع تحويل تلقائي للقيم كما تفعل Sheets: TRUE/FALSE، الأرقام، التواريخ)،
 * PropertiesService، CacheService (مع انتهاء صلاحية)، LockService، Utilities (SHA-256، HMAC، Base64، UUID، formatDate)،
 * MailApp (صندوق صادر + حصة + إمكانية إجبار الفشل)، UrlFetchApp (معالج قابل للبرمجة)، DriveApp (ملفات ومجلدات في الذاكرة)،
 * HtmlService (قوالب مع <?!= ?>)، ScriptApp، Logger.
 * ما لا يُحاكى بدقة: تحويل HTML إلى PDF (يُعاد ملف PDF بسيط صالح)، حدود زمن التنفيذ، التزامن الحقيقي.
 */
'use strict';
const vm = require('vm');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SRC_DIR = path.join(__dirname, '..', 'src');
const GS_ORDER = ['Config', 'Db', 'Auth', 'Setup', 'Api', 'Workshops', 'Quizzes', 'Certificates', 'Assets', 'Mail', 'AI', 'Admin', 'Backup', 'Seed', 'Lib_QRCode'];

function toSigned(buf) { return Array.from(buf, (b) => (b > 127 ? b - 256 : b)); }
function toBuf(v) {
  if (typeof v === 'string') return Buffer.from(v, 'utf8');
  if (Buffer.isBuffer(v)) return v;
  return Buffer.from(v.map((b) => (b + 256) % 256));
}
const MIN_PDF = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 842 595]>>endobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000052 00000 n \n0000000101 00000 n \ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n160\n%%EOF\n');

class Blob {
  constructor(bytes, contentType, name) { this._bytes = toBuf(bytes); this._ct = contentType || 'application/octet-stream'; this._name = name || 'blob'; }
  getBytes() { return toSigned(this._bytes); }
  getContentType() { return this._ct; }
  getName() { return this._name; }
  setName(n) { this._name = n; return this; }
  setContentType(c) { this._ct = c; return this; }
  getDataAsString() { return this._bytes.toString('utf8'); }
  getAs(mime) { if (mime === 'application/pdf') return new Blob(MIN_PDF, 'application/pdf', this._name.replace(/\.\w+$/, '') + '.pdf'); return new Blob(this._bytes, mime, this._name); }
  copyBlob() { return new Blob(this._bytes, this._ct, this._name); }
}

/* ---------- Sheets ---------- */
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
function coerceCell(v) {
  if (v === undefined || v === null) return '';
  if (v instanceof Date) return new Date(v.getTime());
  if (typeof v === 'boolean' || typeof v === 'number') return v;
  const s = String(v);
  if (s === 'TRUE') return true;
  if (s === 'FALSE') return false;
  if (/^-?\d+(\.\d+)?$/.test(s) && s.length < 16) return Number(s);
  if (ISO_RE.test(s)) return new Date(s);
  return s;
}
class Range {
  constructor(sheet, row, col, nr, nc) { this.s = sheet; this.r = row; this.c = col; this.nr = nr; this.nc = nc; }
  getValues() { const out = []; for (let i = 0; i < this.nr; i++) { const row = this.s.data[this.r - 1 + i] || []; const o = []; for (let j = 0; j < this.nc; j++) { const v = row[this.c - 1 + j]; o.push(v === undefined ? '' : (v instanceof Date ? new Date(v.getTime()) : v)); } out.push(o); } return out; }
  setValues(vals) { for (let i = 0; i < this.nr; i++) { const ri = this.r - 1 + i; while (this.s.data.length <= ri) this.s.data.push([]); const row = this.s.data[ri]; for (let j = 0; j < this.nc; j++) row[this.c - 1 + j] = coerceCell(vals[i][j]); } return this; }
  getValue() { return this.getValues()[0][0]; }
  setValue(v) { return this.setValues([[v]]); }
  setFontWeight() { return this; }
  setNumberFormat() { return this; }
}
class Sheet {
  constructor(ss, name) { this.ss = ss; this.name = name; this.data = []; this.frozen = 0; }
  getName() { return this.name; }
  getLastRow() { let last = 0; for (let i = 0; i < this.data.length; i++) if (this.data[i].some((c) => c !== '' && c !== undefined && c !== null)) last = i + 1; return last; }
  getLastColumn() { let max = 0; this.data.forEach((row) => { for (let j = row.length - 1; j >= 0; j--) { if (row[j] !== '' && row[j] !== undefined && row[j] !== null) { if (j + 1 > max) max = j + 1; break; } } }); return max; }
  getRange(r, c, nr, nc) { if (nr === undefined) nr = 1; if (nc === undefined) nc = 1; if (r < 1 || c < 1 || nr < 1 || nc < 1) throw new Error('Range invalid: ' + [r, c, nr, nc].join(',')); return new Range(this, r, c, nr, nc); }
  appendRow(arr) { const lr = this.getLastRow(); this.data.length = lr; this.data.push(arr.map(coerceCell)); return this; }
  deleteRow(r) { if (r < 1 || r > this.data.length) throw new Error('deleteRow out of range: ' + r); this.data.splice(r - 1, 1); return this; }
  setFrozenRows(n) { this.frozen = n; return this; }
  getMaxRows() { return Math.max(this.data.length, 1000); }
}
class Spreadsheet {
  constructor(id, name) { this.id = id; this.name = name; this.sheets = [new Sheet(this, 'Sheet1')]; }
  getId() { return this.id; }
  getUrl() { return 'https://docs.google.com/spreadsheets/d/' + this.id + '/edit'; }
  getName() { return this.name; }
  getSheetByName(n) { return this.sheets.find((s) => s.name === n) || null; }
  insertSheet(n) { const s = new Sheet(this, n); this.sheets.push(s); return s; }
  getSheets() { return this.sheets.slice(); }
  deleteSheet(s) { this.sheets = this.sheets.filter((x) => x !== s); }
}

/* ---------- Drive ---------- */
class DriveFile {
  constructor(id, blob, parent) { this.id = id; this.blob = blob; this.parent = parent; this.trashed = false; }
  getId() { return this.id; }
  getName() { return this.blob.getName(); }
  getBlob() { return this.blob.copyBlob(); }
  setTrashed(b) { this.trashed = !!b; return this; }
  isTrashed() { return this.trashed; }
  getParents() { const arr = this.parent ? [this.parent] : []; let i = 0; return { hasNext: () => i < arr.length, next: () => arr[i++] }; }
  getUrl() { return 'https://drive.google.com/file/d/' + this.id; }
}
class DriveFolder {
  constructor(drive, id, name) { this.drive = drive; this.id = id; this.name = name; }
  getId() { return this.id; }
  getName() { return this.name; }
  createFile(blob) { const f = new DriveFile('file_' + crypto.randomBytes(12).toString('hex'), blob.copyBlob(), this); this.drive.files[f.id] = f; return f; }
  getFiles() { const arr = Object.values(this.drive.files).filter((f) => f.parent === this); let i = 0; return { hasNext: () => i < arr.length, next: () => arr[i++] }; }
}

/* ---------- HTML template evaluation ---------- */
function evaluateTemplate(ctx, html, vars) {
  return html.replace(/<\?(!?)=\s*([\s\S]*?)\?>/g, (m, raw, expr) => {
    const fn = vm.runInContext('(function(__t){ with(__t){ return (' + expr + '); } })', ctx);
    const v = fn(vars);
    if (raw === '!') return String(v);
    return String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }).replace(/<\?\s*([\s\S]*?)\?>/g, '');
}

function formatDate(date, tz, pattern) {
  const parts = {};
  const dtf = new Intl.DateTimeFormat('en-US', { timeZone: tz || 'UTC', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, weekday: 'short' });
  dtf.formatToParts(date).forEach((p) => { parts[p.type] = p.value; });
  const wd = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }[parts.weekday] || 1;
  const hh = parts.hour === '24' ? '00' : parts.hour;
  return pattern.replace(/yyyy/g, parts.year).replace(/MM/g, parts.month).replace(/dd/g, parts.day).replace(/HH/g, hh).replace(/mm/g, parts.minute).replace(/ss/g, parts.second).replace(/u/g, String(wd));
}

/**
 * ينشئ بيئة GAS محاكاة ويحمّل ملفات الخادم. يُعيد { ctx, call, mock }.
 */
function createGas(opts) {
  opts = opts || {};
  const srcDir = opts.srcDir || SRC_DIR;
  const mock = {
    clock: { offset: 0 },
    props: {},
    cache: {},
    spreadsheets: {},
    drive: { files: {}, folders: {} },
    mail: { outbox: [], quota: 100, sent: 0, failNext: 0, failFor: null },
    http: { calls: [], handler: null },
    triggers: [],
    logs: [],
    errors: [],
    webAppUrl: 'https://script.google.com/macros/s/TEST_DEPLOYMENT/exec',
    htmlFiles: {},
    advance(ms) { this.clock.offset += ms; }
  };
  const now = () => Date.now() + mock.clock.offset;

  const sandbox = {
    console: { log: (...a) => { if (opts.verbose) console.log(...a); }, error: (...a) => { mock.errors.push(a.map(String).join(' ')); if (opts.verbose) console.error(...a); }, warn: (...a) => { if (opts.verbose) console.warn(...a); }, info: () => { } },
    Logger: { log: (m) => { mock.logs.push(String(m)); if (opts.verbose) console.log('[Logger]', m); } },
    __clock: mock.clock,
    SpreadsheetApp: {
      create(name) { const id = 'ss_' + crypto.randomBytes(8).toString('hex'); const ss = new Spreadsheet(id, name); mock.spreadsheets[id] = ss; return ss; },
      openById(id) { const ss = mock.spreadsheets[id]; if (!ss) throw new Error('Spreadsheet not found: ' + id); return ss; },
      getActiveSpreadsheet() { return null; },
      flush() { }
    },
    PropertiesService: { getScriptProperties() { return { getProperty: (k) => (mock.props[k] === undefined ? null : mock.props[k]), setProperty(k, v) { mock.props[k] = String(v); return this; }, deleteProperty(k) { delete mock.props[k]; return this; }, getProperties: () => Object.assign({}, mock.props) }; } },
    CacheService: { getScriptCache() { return { get(k) { const e = mock.cache[k]; if (!e) return null; if (e.exp < now()) { delete mock.cache[k]; return null; } return e.v; }, put(k, v, sec) { mock.cache[k] = { v: String(v), exp: now() + (sec || 600) * 1000 }; }, remove(k) { delete mock.cache[k]; } }; } },
    LockService: { getScriptLock() { return { tryLock: () => true, waitLock: () => true, releaseLock: () => { }, hasLock: () => true }; } },
    Utilities: {
      getUuid: () => crypto.randomUUID(),
      DigestAlgorithm: { SHA_256: 'SHA_256', MD5: 'MD5' },
      Charset: { UTF_8: 'UTF_8', US_ASCII: 'US_ASCII' },
      computeDigest(alg, value) { return toSigned(crypto.createHash(alg === 'MD5' ? 'md5' : 'sha256').update(toBuf(value)).digest()); },
      computeHmacSha256Signature(value, key) { return toSigned(crypto.createHmac('sha256', toBuf(key)).update(toBuf(value)).digest()); },
      base64Encode(v) { return toBuf(v).toString('base64'); },
      base64Decode(s) { if (!/^[A-Za-z0-9+/=\s]*$/.test(s)) throw new Error('Invalid base64'); return toSigned(Buffer.from(s, 'base64')); },
      newBlob(data, ct, name) { return new Blob(data, ct, name); },
      formatDate: (d, tz, p) => formatDate(d, tz, p),
      sleep() { }
    },
    MailApp: {
      sendEmail(msg) {
        if (mock.mail.failNext > 0) { mock.mail.failNext--; throw new Error('Mail service unavailable (simulated)'); }
        if (mock.mail.failFor && mock.mail.failFor(msg)) throw new Error('Mail rejected (simulated)');
        if (mock.mail.quota - mock.mail.sent <= 0) throw new Error('Service invoked too many times for one day: email');
        mock.mail.sent++;
        mock.mail.outbox.push({ to: msg.to, subject: msg.subject, html: msg.htmlBody || '', name: msg.name, noReply: !!msg.noReply, attachments: (msg.attachments || []).map((b) => ({ name: b.getName(), type: b.getContentType(), bytes: b.getBytes().length })), at: new Date(now()).toISOString() });
      },
      getRemainingDailyQuota() { return mock.mail.quota - mock.mail.sent; }
    },
    UrlFetchApp: {
      fetch(url, o) {
        mock.http.calls.push({ url, options: o });
        if (!mock.http.handler) throw new Error('UrlFetchApp: no handler configured (network disabled in tests)');
        const r = mock.http.handler(url, o) || { code: 500, body: '' };
        return { getResponseCode: () => r.code, getContentText: () => (typeof r.body === 'string' ? r.body : JSON.stringify(r.body)), getHeaders: () => r.headers || {} };
      }
    },
    DriveApp: {
      createFolder(name) { const f = new DriveFolder(mock.drive, 'folder_' + crypto.randomBytes(8).toString('hex'), name); mock.drive.folders[f.id] = f; return f; },
      getFolderById(id) { const f = mock.drive.folders[id]; if (!f) throw new Error('Folder not found: ' + id); return f; },
      getFileById(id) { const f = mock.drive.files[id]; if (!f) throw new Error('File not found: ' + id); return f; }
    },
    HtmlService: {
      XFrameOptionsMode: { ALLOWALL: 'ALLOWALL', DEFAULT: 'DEFAULT' },
      SandboxMode: { IFRAME: 'IFRAME' },
      _output(content) { const o = { _content: content, _title: '', _meta: [], _xframe: 'DEFAULT', setTitle(t) { this._title = t; return this; }, addMetaTag(n, c) { this._meta.push([n, c]); return this; }, setXFrameOptionsMode(m) { this._xframe = m; return this; }, setSandboxMode() { return this; }, setFaviconUrl() { return this; }, getContent() { return this._content; }, append(s) { this._content += s; return this; } }; return o; },
      createHtmlOutput(html) { return this._output(html || ''); },
      createHtmlOutputFromFile(name) { const p = path.join(srcDir, name + '.html'); if (!fs.existsSync(p)) throw new Error('No HTML file named ' + name); return this._output(fs.readFileSync(p, 'utf8')); },
      createTemplateFromFile(name) {
        const p = path.join(srcDir, name + '.html'); if (!fs.existsSync(p)) throw new Error('No HTML file named ' + name);
        const html = fs.readFileSync(p, 'utf8'); const self = this;
        const t = { evaluate() { const vars = Object.assign({}, t); delete vars.evaluate; return self._output(evaluateTemplate(ctx, html, vars)); } };
        return t;
      }
    },
    ScriptApp: {
      getService() { return { getUrl: () => mock.webAppUrl }; },
      getProjectTriggers() { return mock.triggers.slice(); },
      deleteTrigger(t) { mock.triggers = mock.triggers.filter((x) => x !== t); },
      newTrigger(fn) { return { timeBased() { return this; }, everyHours() { return this; }, everyMinutes() { return this; }, create() { const t = { getHandlerFunction: () => fn }; mock.triggers.push(t); return t; } }; }
    },
    Session: { getScriptTimeZone: () => 'Asia/Qatar', getActiveUser: () => ({ getEmail: () => '' }) }
  };
  const ctx = vm.createContext(sandbox);
  // ساعة قابلة للتقديم: تُستبدل Date داخل السياق بنسخة تعتمد على الإزاحة
  vm.runInContext('var __RealDate = Date; Date = class extends __RealDate { constructor(...a) { if (!a.length) super(__RealDate.now() + __clock.offset); else super(...a); } static now() { return __RealDate.now() + __clock.offset; } };', ctx);
  const files = (opts.files || GS_ORDER).map((n) => path.join(srcDir, n + '.gs'));
  files.forEach((f) => { vm.runInContext(fs.readFileSync(f, 'utf8'), ctx, { filename: path.basename(f) }); });
  const call = (name, ...args) => { const fn = vm.runInContext(name, ctx); if (typeof fn !== 'function') throw new Error('Not a function: ' + name); return fn(...args); };
  const api = (action, payload, token) => call('api', { action, payload: payload || {}, token: token || '' });
  const sheetRows = (name) => { const id = mock.props.IKP_SPREADSHEET_ID; const ss = mock.spreadsheets[id]; const sh = ss && ss.getSheetByName(name); if (!sh) return []; const hdr = sh.data[0] || []; return sh.data.slice(1).map((r) => { const o = {}; hdr.forEach((h, i) => { o[h] = r[i]; }); return o; }); };
  return { ctx, call, api, mock, sheetRows };
}

/** معالج HTTP محاكٍ لـ Claude API يُنتج JSON صالحًا بحسب نوع الطلب (خطة/وحدة/اختبار نهائي/اختبار اتصال) */
function makeClaudeMock(options) {
  options = options || {};
  const state = { calls: 0, failAt: options.failAt || null, failed: false };
  const words = (n, seed) => { const base = 'يتناول هذا القسم مفهومًا أساسيًا في التدريس الفعّال ويوضّح كيف يطبّقه المعلم داخل الصف مع طلاب المرحلة الإعدادية بخطوات عملية واضحة. '; let s = ''; while (s.split(/\s+/).length < n) s += base.replace('مفهومًا', 'مفهومًا ' + seed); return s; };
  return function handler(url, o) {
    state.calls++;
    const body = JSON.parse(o.payload);
    const msg = body.messages[0].content;
    if (state.failAt && state.calls === state.failAt && !state.failed) { state.failed = true; return { code: 529, body: { type: 'error', error: { type: 'overloaded_error', message: 'Overloaded' } } }; }
    let out;
    if (/اكتب كلمة: جاهز/.test(msg)) out = 'جاهز';
    else if (/خطة الورشة بصيغة JSON/.test(msg)) {
      const n = parseInt((msg.match(/يساوي (\d+) بالضبط/) || [])[1], 10) || 4;
      const mods = []; for (let i = 0; i < n; i++) mods.push({ title: 'الوحدة التجريبية رقم ' + (i + 1), focus: 'محور تجريبي ' + (i + 1) });
      out = JSON.stringify({ title: 'ورشة مولَّدة للاختبار: التعلم النشط', description: 'وصف تجريبي للورشة المولَّدة ضمن اختبارات المنصة.', objectives: ['يطبق المتدرب استراتيجية تعلم نشط.', 'يصمم المتدرب نشاطًا صفيًا.', 'يقوّم المتدرب أثر الاستراتيجية.'], modules: mods });
    } else if (/اكتب محتوى الوحدة/.test(msg)) {
      const idx = (msg.match(/الوحدة رقم (\d+)/) || [])[1] || '1';
      const qs = []; for (let i = 0; i < 5; i++) qs.push({ text: 'سؤال الوحدة ' + idx + ' رقم ' + (i + 1) + ': ما الإجراء الأنسب في هذا الموقف الصفي؟', options: ['خيار أ' + i, 'خيار ب' + i, 'خيار ج' + i, 'خيار د' + i], answer: i % 4, explanation: 'توضيح تجريبي.' });
      out = JSON.stringify({ title: 'الوحدة التجريبية رقم ' + idx, summary: 'ملخص الوحدة التجريبية.', objectives: ['يحدد المتدرب المفهوم.', 'يطبق المتدرب الخطوات.', 'يميز المتدرب بين الحالات.'],
        sections: [{ type: 'text', title: 'مقدمة', body: words(300, 'أ'), items: [], rows: [] }, { type: 'text', title: 'المفاهيم الأساسية', body: words(320, 'ب'), items: [], rows: [] }, { type: 'steps', title: 'خطوات التطبيق الصفي', body: '', items: ['الخطوة الأولى', 'الخطوة الثانية', 'الخطوة الثالثة'], rows: [] }, { type: 'example', title: 'مثال من المرحلة الإعدادية', body: words(120, 'ج'), items: [], rows: [] }, { type: 'table', title: 'جدول', body: '', items: [], rows: [['أ', 'ب'], ['1', '2']] }, { type: 'warning', title: 'أخطاء شائعة', body: words(60, 'د'), items: [], rows: [] }, { type: 'remember', title: 'نقاط للتذكر', body: '', items: ['نقطة 1', 'نقطة 2'], rows: [] }, { type: 'activity', title: 'نشاط تأملي', body: words(50, 'هـ'), items: [], rows: [] }],
        questions: qs });
    } else if (/اكتب الاختبار النهائي/.test(msg)) {
      const n = parseInt((msg.match(/الشروط: (\d+) أسئلة بالضبط/) || [])[1], 10) || 10;
      const qs = []; for (let i = 0; i < n; i++) qs.push({ text: 'سؤال نهائي تطبيقي رقم ' + (i + 1) + ': موقف صفي يتطلب قرارًا مناسبًا من المعلم.', options: ['قرار أ' + i, 'قرار ب' + i, 'قرار ج' + i, 'قرار د' + i], answer: (i + 1) % 4, explanation: 'توضيح.' });
      out = JSON.stringify({ questions: qs });
    } else out = '{}';
    return { code: 200, body: { id: 'msg_test', type: 'message', role: 'assistant', model: body.model, content: [{ type: 'text', text: out }], stop_reason: 'end_turn', usage: { input_tokens: 500, output_tokens: 1200 } } };
  };
}

module.exports = { createGas, makeClaudeMock, GS_ORDER, SRC_DIR };
