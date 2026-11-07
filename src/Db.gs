/**
 * Db.gs — طبقة الوصول إلى البيانات (Google Sheets)
 * ------------------------------------------------------------
 * - قراءة الجداول دفعة واحدة وتحويلها إلى كائنات، مع تخزين مؤقت لمدة التنفيذ الواحد
 *   (يُلغى عند أي إدراج/حذف وعند الحصول على القفل) لتقليل استدعاءات Sheets المتكررة.
 * - كتابة مجمعة (batch) قدر الإمكان، وقفل (LockService) للعمليات الحساسة.
 * - تخزين JSON الطويل موزعًا على عدة خلايا (c1..cN) لتجاوز حد 50,000 حرف للخلية.
 */

var __dbCache = { ss: null, sheets: {}, headers: {}, tables: {} };

function dbInvalidate_(name) {
  if (name) delete __dbCache.tables[name]; else __dbCache.tables = {};
}

function getSpreadsheet_() {
  if (__dbCache.ss) return __dbCache.ss;
  var id = PropertiesService.getScriptProperties().getProperty(PROPS.SPREADSHEET_ID);
  var ss = null;
  if (id) {
    try { ss = SpreadsheetApp.openById(id); } catch (e) { ss = null; }
  }
  if (!ss) ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) fail('SETUP_REQUIRED', 'لم يتم إعداد قاعدة البيانات بعد. شغّل دالة SETUP_1_initialize من محرر Apps Script.');
  __dbCache.ss = ss;
  return ss;
}

function getSheet_(name) {
  if (__dbCache.sheets[name]) return __dbCache.sheets[name];
  var ss = getSpreadsheet_();
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    var headers = SCHEMA[name];
    if (headers) {
      sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
      sh.setFrozenRows(1);
    }
  }
  __dbCache.sheets[name] = sh;
  return sh;
}

/** عناوين الأعمدة الفعلية في الورقة (مع إضافة الأعمدة الناقصة في النهاية فقط — ترحيل غير مدمر) */
function headersOf_(name) {
  if (__dbCache.headers[name]) return __dbCache.headers[name];
  var sh = getSheet_(name);
  var lastCol = sh.getLastColumn();
  var hdr = lastCol === 0 ? [] : sh.getRange(1, 1, 1, lastCol).getValues()[0].map(function (h) { return String(h || '').trim(); });
  var expected = SCHEMA[name] || [];
  var missing = expected.filter(function (h) { return hdr.indexOf(h) === -1; });
  if (missing.length) {
    sh.getRange(1, hdr.length + 1, 1, missing.length).setValues([missing]).setFontWeight('bold');
    hdr = hdr.concat(missing);
  }
  __dbCache.headers[name] = hdr;
  return hdr;
}

function cellToValue_(v) {
  if (v instanceof Date) return v.toISOString();
  if (v === '' || v === null || v === undefined) return '';
  return v;
}

/** قراءة كل صفوف الجدول ككائنات، مع رقم الصف (_row) لكل سجل */
function readTable_(name) {
  if (__dbCache.tables[name]) return __dbCache.tables[name];
  var sh = getSheet_(name);
  var hdr = headersOf_(name);
  var lastRow = sh.getLastRow();
  var out = [];
  if (lastRow >= 2) {
    var values = sh.getRange(2, 1, lastRow - 1, hdr.length).getValues();
    for (var i = 0; i < values.length; i++) {
      var row = values[i];
      if (row.every(function (c) { return c === '' || c === null; })) continue;
      var obj = { _row: i + 2 };
      for (var j = 0; j < hdr.length; j++) obj[hdr[j]] = cellToValue_(row[j]);
      out.push(obj);
    }
  }
  __dbCache.tables[name] = out;
  return out;
}

function findRows_(name, pred) { return readTable_(name).filter(pred); }
function findOne_(name, pred) { var r = readTable_(name).filter(pred); return r.length ? r[0] : null; }
function findById_(name, id) { return findOne_(name, function (r) { return r.id === id; }); }
/** فهرس سريع {id: rec} لجدول */
function indexBy_(rows, key) { var m = {}; rows.forEach(function (r) { m[r[key || 'id']] = r; }); return m; }

function objToRow_(hdr, obj) {
  return hdr.map(function (h) {
    var v = obj[h];
    if (v === undefined || v === null) return '';
    if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
    if (typeof v === 'object') return JSON.stringify(v);
    return v;
  });
}

function insertRow_(name, obj) {
  var sh = getSheet_(name);
  var hdr = headersOf_(name);
  sh.appendRow(objToRow_(hdr, obj));
  obj._row = sh.getLastRow();
  dbInvalidate_(name);
  return obj;
}

function insertRows_(name, objs) {
  if (!objs || !objs.length) return;
  var sh = getSheet_(name);
  var hdr = headersOf_(name);
  var rows = objs.map(function (o) { return objToRow_(hdr, o); });
  sh.getRange(sh.getLastRow() + 1, 1, rows.length, hdr.length).setValues(rows);
  dbInvalidate_(name);
}

/** تحديث سجل بحسب id — يُعيد السجل بعد التعديل */
function updateRow_(name, id, patch) {
  var rec = findById_(name, id);
  if (!rec) fail('NOT_FOUND', 'السجل غير موجود.');
  return updateRowAt_(name, rec, patch);
}

/** تحديث سجل بحسب رقم الصف مباشرة (السجل القادم من readTable_ يبقى متسقًا مع الكاش لأنه يُعدَّل في مكانه) */
function updateRowAt_(name, rec, patch) {
  var sh = getSheet_(name);
  var hdr = headersOf_(name);
  Object.keys(patch).forEach(function (k) { rec[k] = patch[k]; });
  sh.getRange(rec._row, 1, 1, hdr.length).setValues([objToRow_(hdr, rec)]);
  return rec;
}

function deleteRowById_(name, id) {
  var rec = findById_(name, id);
  if (!rec) return false;
  getSheet_(name).deleteRow(rec._row);
  dbInvalidate_(name);
  return true;
}

function deleteRowsWhere_(name, pred) {
  var sh = getSheet_(name);
  var rows = readTable_(name).filter(pred).map(function (r) { return r._row; }).sort(function (a, b) { return b - a; });
  rows.forEach(function (r) { sh.deleteRow(r); });
  if (rows.length) dbInvalidate_(name);
  return rows.length;
}

/* ---------- JSON موزع على خلايا ---------- */
function packChunks_(obj, prefix, count) {
  var s = JSON.stringify(obj === undefined ? null : obj);
  if (s.length > CELL_CHUNK * count) fail('TOO_LARGE', 'حجم المحتوى يتجاوز السعة المسموحة للتخزين (' + Math.round(CELL_CHUNK * count / 1000) + ' ألف حرف).');
  var out = {};
  for (var i = 0; i < count; i++) out[prefix + (i + 1)] = s.substr(i * CELL_CHUNK, CELL_CHUNK);
  return out;
}
function unpackChunks_(rec, prefix, count) {
  var s = '';
  for (var i = 0; i < count; i++) s += (rec[prefix + (i + 1)] || '');
  if (!s) return null;
  try { return JSON.parse(s); } catch (e) { return null; }
}

/* ---------- أدوات عامة ---------- */
function nowIso_() { return new Date().toISOString(); }
function newId_(prefix) {
  return (prefix || 'id') + '_' + Utilities.getUuid().replace(/-/g, '').substr(0, 20);
}
/**
 * رمز عشوائي بطول 96 حرفًا سداسيًا. Math.random في Apps Script ليس مصدرًا تشفيريًا، لذلك
 * يُمزج مع معرّفات UUID (مصدر عشوائي للمنصة) وطابع زمني ثم يُجزّأ — لا يُستخدم الرمز الخام مباشرة.
 */
function randomToken_(bytes) {
  var b = [];
  for (var i = 0; i < (bytes || 32); i++) b.push(Math.floor(Math.random() * 256));
  var mix = b.join(',') + '|' + Utilities.getUuid() + '|' + Utilities.getUuid() + '|' + new Date().getTime();
  return sha256Hex_(mix) + sha256Hex_(Utilities.getUuid() + mix).substr(0, 32);
}
function sha256Hex_(s) {
  var raw = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s, Utilities.Charset.UTF_8);
  return bytesToHex_(raw);
}
function bytesToHex_(bytes) {
  var hex = '';
  for (var i = 0; i < bytes.length; i++) {
    var b = (bytes[i] + 256) % 256;
    hex += (b < 16 ? '0' : '') + b.toString(16);
  }
  return hex;
}
function truthy_(v) { return v === true || v === 'TRUE' || v === 'true' || v === 1 || v === '1'; }
function parseJson_(s, fallback) {
  if (s === '' || s === null || s === undefined) return fallback;
  if (typeof s === 'object') return s;
  try { return JSON.parse(s); } catch (e) { return fallback; }
}
function numericCode_(digits) {
  var s = '';
  var seed = randomToken_(16);
  for (var i = 0; i < digits; i++) s += String(parseInt(seed.substr(i * 2, 2), 16) % 10);
  return s;
}

/** تنفيذ دالة داخل قفل خادمي؛ يُلغى كاش الجداول بعد الحصول على القفل لضمان قراءة أحدث البيانات */
function withLock_(fn) {
  var lock = LockService.getScriptLock();
  var ok = lock.tryLock(LIMITS.LOCK_WAIT_MS);
  if (!ok) fail('BUSY', 'النظام مشغول حاليًا، يُرجى إعادة المحاولة بعد لحظات.');
  dbInvalidate_();
  try { return fn(); } finally { lock.releaseLock(); }
}

/* ---------- الإعدادات ---------- */
var __settingsCache = null;
function getSettings_() {
  if (__settingsCache) return __settingsCache;
  var rows = readTable_(SHEETS.SETTINGS);
  var merged = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
  rows.forEach(function (r) {
    var v = unpackChunks_(r, 'c', 8);
    if (r.key && v !== null) merged[r.key] = v;
  });
  // دمج الكائنات الفرعية مع الافتراضيات حتى لا تضيع مفاتيح جديدة بعد التحديث
  ['certificate', 'ai', 'mail', 'branding'].forEach(function (k) {
    merged[k] = Object.assign({}, DEFAULT_SETTINGS[k], (merged[k] && typeof merged[k] === 'object') ? merged[k] : {});
  });
  __settingsCache = merged;
  return merged;
}
function setSetting_(key, value) {
  var rec = findOne_(SHEETS.SETTINGS, function (r) { return r.key === key; });
  var packed = packChunks_(value, 'c', 8);
  packed.updatedAt = nowIso_();
  if (rec) updateRowAt_(SHEETS.SETTINGS, rec, packed);
  else { packed.key = key; insertRow_(SHEETS.SETTINGS, packed); }
  __settingsCache = null;
}

/* ---------- سجل العمليات ---------- */
function audit_(actor, action, target, details) {
  try {
    insertRow_(SHEETS.AUDIT, {
      id: newId_('log'), at: nowIso_(),
      actorId: actor ? actor.id : 'system', actorEmail: actor ? actor.email : 'system',
      action: action, target: target || '', details: details ? JSON.stringify(details).substr(0, 4000) : ''
    });
  } catch (e) { /* لا يجوز أن يُفشل السجل العملية الأصلية */ }
}

/* ---------- كاش قصير الأمد ---------- */
function cacheGet_(k) { try { return CacheService.getScriptCache().get(k); } catch (e) { return null; } }
function cachePut_(k, v, sec) { try { CacheService.getScriptCache().put(k, v, sec || 600); } catch (e) { } }
function cacheDel_(k) { try { CacheService.getScriptCache().remove(k); } catch (e) { } }

/** عدّاد بسيط لحدود المحاولات (Rate limiting) */
function rateLimit_(key, max, windowSec) {
  var k = 'rl:' + key;
  var n = parseInt(cacheGet_(k) || '0', 10) + 1;
  cachePut_(k, String(n), windowSec);
  if (n > max) fail('RATE_LIMITED', 'تم تجاوز عدد المحاولات المسموح. يُرجى المحاولة لاحقًا.');
}
