/**
 * ============================================================
 *  منصة ابن خلدون للتدريب والتطوير المهني — نسخة الملف الواحد (مولَّدة آليًا من src/ بواسطة tools/build.js)
 *  Code.gs  (كل كود الخادم في ملف واحد)
 * ------------------------------------------------------------
 *  التثبيت: الصق هذا الملف كاملًا في Code.gs، والصق dist/index.html في ملف HTML باسم index.
 *  ثم اختر الدالة SETUP_1_initialize من القائمة واضغط Run واتبع دليل التشغيل docs/01-setup-deploy.md.
 *  لا تعدّل هذا الملف مباشرة؛ عدّل الوحدات في src/ ثم أعد البناء.
 * ============================================================
 */


/* ######################## Config.gs ######################## */

/**
 * ============================================================
 *  منصة ابن خلدون للتدريب والتطوير المهني
 *  مدرسة ابن خلدون الإعدادية للبنين — دولة قطر
 * ------------------------------------------------------------
 *  Config.gs — الثوابت والإعدادات العامة
 * ============================================================
 *
 * ملاحظة أمنية: لا توجد أي كلمات مرور أو مفاتيح خدمات داخل الكود.
 * جميع الأسرار تُحفظ في Script Properties (إعدادات الخادم) فقط.
 */

var APP = {
  NAME: 'منصة ابن خلدون للتدريب والتطوير المهني',
  SCHOOL: 'مدرسة ابن خلدون الإعدادية للبنين',
  SCHOOL_EN: 'Ibn Khaldoon Preparatory School for Boys',
  MINISTRY: 'وزارة التربية والتعليم والتعليم العالي — دولة قطر',
  VISION: 'متعلم ريادي لتنمية مستدامة',
  VERSION: '3.0.0',
  SCHEMA_VERSION: 3,
  TIMEZONE: 'Asia/Qatar'
};

/** أسماء الجداول (أوراق Google Sheets) */
var SHEETS = {
  USERS: 'Users',
  TOKENS: 'Tokens',
  SESSIONS: 'Sessions',
  WORKSHOPS: 'Workshops',
  VERSIONS: 'WorkshopVersions',
  PROGRESS: 'Progress',
  ATTEMPTS: 'Attempts',
  RESULTS: 'Results',
  CERTIFICATES: 'Certificates',
  MAIL: 'MailLog',
  SETTINGS: 'Settings',
  AUDIT: 'AuditLog',
  AIJOBS: 'AIJobs'
};

/**
 * أعمدة كل جدول — الترتيب ثابت ويجب عدم تغييره بعد النشر.
 * الترحيل غير المدمر: تُضاف الأعمدة الجديدة في نهاية الجدول فقط (انظر headersOf_ ودليل الترحيل).
 * هذه البنية متوافقة مع قاعدة بيانات الإصدار 2.x دون تعديل.
 */
var SCHEMA = {
  Users: ['id', 'name', 'email', 'jobTitle', 'department', 'role', 'status', 'emailVerified',
    'passHash', 'passSalt', 'passIter', 'createdAt', 'updatedAt', 'lastLoginAt', 'notes'],
  Tokens: ['id', 'userId', 'type', 'tokenHash', 'expiresAt', 'attempts', 'usedAt', 'createdAt', 'meta'],
  Sessions: ['id', 'tokenHash', 'userId', 'createdAt', 'expiresAt', 'lastSeenAt', 'revokedAt', 'agent'],
  Workshops: ['id', 'title', 'description', 'audience', 'category', 'targetDepartments', 'passScore',
    'status', 'currentVersion', 'trainerName', 'trainerEmail', 'scheduledAt', 'durationMin', 'location',
    'createdBy', 'createdAt', 'updatedAt', 'publishedAt', 'notifiedAt', 'trainerThankedAt', 'moduleCount', 'source'],
  WorkshopVersions: ['id', 'workshopId', 'version', 'createdAt', 'createdBy', 'checksum', 'c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8', 'c9', 'c10'],
  Progress: ['id', 'userId', 'workshopId', 'versionId', 'modulesDone', 'acknowledged', 'lastModule',
    'percent', 'startedAt', 'completedAt', 'updatedAt'],
  Attempts: ['id', 'userId', 'workshopId', 'versionId', 'kind', 'moduleIndex', 'requestKey', 'score', 'total',
    'percent', 'passed', 'answers', 'startedAt', 'submittedAt', 'status'],
  Results: ['id', 'userId', 'workshopId', 'versionId', 'bestPercent', 'lastPercent', 'attemptCount', 'passed',
    'passedAt', 'certificateId', 'updatedAt'],
  Certificates: ['id', 'serial', 'verifyHash', 'userId', 'workshopId', 'resultId', 'kind', 'issuedAt', 'pdfFileId',
    'mailStatus', 'revokedAt', 's1', 's2', 's3', 's4'],
  MailLog: ['id', 'kind', 'refKey', 'to', 'subject', 'status', 'attempts', 'lastError', 'createdAt', 'sentAt', 'payloadRef'],
  Settings: ['key', 'updatedAt', 'c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8'],
  AuditLog: ['id', 'at', 'actorId', 'actorEmail', 'action', 'target', 'details'],
  AIJobs: ['id', 'workshopId', 'status', 'stage', 'stageIndex', 'error', 'createdBy', 'createdAt', 'updatedAt',
    'c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8', 'c9', 'c10']
};

/** الحد الأقصى لعدد الأحرف في الخلية الواحدة في Google Sheets هو 50,000 — نستخدم هامش أمان */
var CELL_CHUNK = 45000;

/** القيم الافتراضية للإعدادات القابلة للتعديل من لوحة الإدارة */
var DEFAULT_SETTINGS = {
  allowedDomains: ['education.qa', 'edu.gov.qa'],
  allowedEmails: [],              // عناوين مستثناة من قيد النطاق
  blockedEmails: [],
  adminNotifyEmail: '',           // البريد الإداري الذي تصله نسخ الشهادات
  senderName: 'منصة ابن خلدون للتدريب والتطوير المهني',
  defaultPassScore: 80,
  moduleQuestions: 5,
  finalQuestions: 10,
  retryPolicy: 'unlimited',       // unlimited | limited
  maxAttempts: 3,                 // عند retryPolicy = limited
  retryCooldownMin: 0,
  showCorrectAnswers: 'afterPass',// never | afterPass | always
  shuffleQuestions: true,
  shuffleOptions: true,
  sessionHours: 72,
  departments: ['اللغة العربية', 'اللغة الإنجليزية', 'الرياضيات', 'العلوم', 'التربية الإسلامية', 'الدراسات الاجتماعية',
    'الحاسوب', 'التربية البدنية', 'الفنون البصرية', 'الإدارة المدرسية', 'الإرشاد الأكاديمي', 'دعم التعلم', 'أخرى'],
  jobTitles: ['معلم', 'معلم أول', 'منسق مادة', 'أخصائي', 'مرشد أكاديمي', 'إداري', 'نائب مدير', 'مدير'],
  certificate: {
    title: 'شهادة إتمام برنامج تدريبي',
    intro: 'تشهد مدرسة ابن خلدون الإعدادية للبنين بأن',
    body: 'قد أتمّ بنجاح متطلبات الورشة التدريبية',
    outro: 'ضمن برنامج التطوير المهني للكادر المدرسي، متمنين له دوام التوفيق والنجاح.',
    trainerTitle: 'شهادة شكر وتقدير',
    trainerBody: 'تتقدم إدارة مدرسة ابن خلدون الإعدادية للبنين بخالص الشكر والتقدير إلى',
    trainerOutro: 'لتقديمه الورشة التدريبية ولما بذله من جهد في إثراء برنامج التطوير المهني بالمدرسة.',
    showScore: true,
    signers: [
      { name: '', title: 'مسؤول التطوير المهني', imageId: '' },
      { name: '', title: 'مدير المدرسة', imageId: '' }
    ],
    stampImageId: '',
    headerImageId: '',
    footerImageId: '',
    accent: '#7b1a2e'
  },
  /** الهوية البصرية للمنصة (ترويسة/تذييل الموقع) — فارغ = الصور الافتراضية المضمّنة */
  branding: { headerImageId: '', footerImageId: '' },
  ai: {
    model: 'claude-opus-5-5',
    effort: 'medium',             // low | medium | high — عمق التفكير وحجم الاستهلاك
    maxTokens: 8000,
    wordsMin: 800,
    wordsMax: 1200,
    fallbacks: true,              // استخدام البديل الخادمي عند رفض السياسة (fallbacks: "default")
    structured: true              // طلب JSON وفق مخطط (output_config.format) مع تراجع تلقائي عند عدم الدعم
  },
  mail: {
    footer: 'هذه رسالة آلية من منصة ابن خلدون للتدريب والتطوير المهني — يُرجى عدم الرد عليها.',
    noReply: false                // متاح لحسابات Google Workspace فقط
  }
};

/** مفاتيح إعدادات الخادم (Script Properties) — أسرار لا تُعاد للمتصفح إطلاقًا */
var PROPS = {
  SPREADSHEET_ID: 'IKP_SPREADSHEET_ID',
  DRIVE_FOLDER_ID: 'IKP_DRIVE_FOLDER_ID',
  ANTHROPIC_KEY: 'IKP_ANTHROPIC_API_KEY',
  ANTHROPIC_KEY_AT: 'IKP_ANTHROPIC_API_KEY_AT',
  SETUP_TOKEN_HASH: 'IKP_SETUP_TOKEN_HASH',
  SETUP_TOKEN_EXP: 'IKP_SETUP_TOKEN_EXP',
  PEPPER: 'IKP_PASSWORD_PEPPER',
  WEBAPP_URL: 'IKP_WEBAPP_URL',
  SCHEMA_VERSION: 'IKP_SCHEMA_VERSION'
};

/** حدود التشغيل */
var LIMITS = {
  PBKDF2_ITERATIONS: 4000,      // PBKDF2-HMAC-SHA256 (قابل للزيادة؛ يؤثر على زمن الدخول في Apps Script)
  LOGIN_MAX_PER_15MIN: 8,
  RESET_MAX_PER_HOUR: 4,
  VERIFY_CODE_MINUTES: 20,
  RESET_CODE_MINUTES: 15,
  CODE_MAX_ATTEMPTS: 5,
  AI_MAX_JOBS_PER_HOUR: 6,
  AI_STEP_LEASE_SEC: 300,       // منع تنفيذ المرحلة نفسها مرتين بالتوازي
  MAIL_MAX_PER_RUN: 40,         // رسائل لكل تنفيذ واحد (الباقي يُوضع في قائمة انتظار)
  MAX_UPLOAD_BYTES: 600 * 1024,
  MAX_JSON_IMPORT_BYTES: 4 * 1024 * 1024,
  LOCK_WAIT_MS: 20000,
  /** السماح بتضمين تطبيق الويب داخل مواقع أخرى (iframe). false = حماية من Clickjacking */
  ALLOW_EMBED: false
};

var ROLES = { ADMIN: 'admin', TRAINEE: 'trainee' };
var USER_STATUS = { PENDING: 'pending', ACTIVE: 'active', SUSPENDED: 'suspended' };
var WS_STATUS = { DRAFT: 'draft', PUBLISHED: 'published', UNPUBLISHED: 'unpublished', ARCHIVED: 'archived' };
var MAIL_STATUS = { SENT: 'sent', FAILED: 'failed', QUEUED: 'queued', EXPIRED: 'expired' };

/** خطأ تطبيقي يحمل رسالة عربية آمنة للمستخدم ورمزًا للواجهة */
function AppError(code, message, extra) {
  this.name = 'AppError';
  this.code = code || 'ERROR';
  this.message = message || 'حدث خطأ غير متوقع.';
  this.extra = extra || null;
}
AppError.prototype = Object.create(Error.prototype);

function fail(code, message, extra) { throw new AppError(code, message, extra); }


/* ######################## Db.gs ######################## */

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


/* ######################## Auth.gs ######################## */

/**
 * Auth.gs — الحسابات والمصادقة والجلسات
 * ------------------------------------------------------------
 * - كلمات المرور: PBKDF2-HMAC-SHA256 (RFC 8018) مع ملح عشوائي لكل مستخدم + "فلفل" خادمي (Script Properties).
 *   يُعاد تجزئة كلمة المرور تلقائيًا عند الدخول إذا تغيّر عدد التكرارات المعتمد.
 * - الجلسات: رمز عشوائي يُخزن مجزّأً (SHA-256)؛ قابلة للإبطال، وتُبطل عند الإيقاف أو إعادة تعيين كلمة المرور.
 * - رموز التحقق/الاستعادة: مجزّأة، محدودة الصلاحية والمحاولات، تُستخدم مرة واحدة.
 */

/* ---------- تجزئة كلمات المرور ---------- */
function pepper_() {
  var p = PropertiesService.getScriptProperties().getProperty(PROPS.PEPPER);
  if (!p) {
    p = randomToken_(32);
    PropertiesService.getScriptProperties().setProperty(PROPS.PEPPER, p);
  }
  return p;
}

/** PBKDF2-HMAC-SHA256 — كتلة واحدة (32 بايت) تكفي لكلمة المرور */
function pbkdf2_(password, saltHex, iterations) {
  var pw = Utilities.newBlob(password + pepper_()).getBytes();
  var saltBytes = hexToBytes_(saltHex);
  var block = saltBytes.concat([0, 0, 0, 1]);
  var u = Utilities.computeHmacSha256Signature(block, pw);
  var t = u.slice();
  for (var i = 1; i < iterations; i++) {
    u = Utilities.computeHmacSha256Signature(u, pw);
    for (var j = 0; j < t.length; j++) t[j] = t[j] ^ u[j];
  }
  return bytesToHex_(t);
}
function hexToBytes_(hex) {
  var out = [];
  for (var i = 0; i < hex.length; i += 2) {
    var b = parseInt(hex.substr(i, 2), 16);
    out.push(b > 127 ? b - 256 : b);
  }
  return out;
}
function hashPassword_(password) {
  var salt = randomToken_(16).substr(0, 32);
  var iter = LIMITS.PBKDF2_ITERATIONS;
  return { hash: pbkdf2_(password, salt, iter), salt: salt, iter: iter };
}
function verifyPassword_(password, user) {
  if (!user.passHash || !user.passSalt) return false;
  var h = pbkdf2_(password, String(user.passSalt), parseInt(user.passIter, 10) || LIMITS.PBKDF2_ITERATIONS);
  return constantEq_(h, String(user.passHash));
}
function constantEq_(a, b) {
  a = String(a); b = String(b);
  if (a.length !== b.length) return false;
  var r = 0;
  for (var i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
/** ترقية التجزئة عند الدخول إذا كانت بتكرارات أقل من المعتمد حاليًا */
function maybeRehash_(user, password) {
  if ((parseInt(user.passIter, 10) || 0) >= LIMITS.PBKDF2_ITERATIONS) return;
  try { var h = hashPassword_(password); updateRowAt_(SHEETS.USERS, user, { passHash: h.hash, passSalt: h.salt, passIter: h.iter }); } catch (e) { }
}

/* ---------- التحقق من المدخلات ---------- */
function normEmail_(e) { return String(e || '').trim().toLowerCase(); }
function isEmail_(e) { return /^[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$/i.test(String(e || '')); }
function cleanText_(s, max) {
  return String(s === undefined || s === null ? '' : s).replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().substr(0, max || 200);
}
function validatePassword_(p) {
  p = String(p || '');
  if (p.length < 8) fail('WEAK_PASSWORD', 'كلمة المرور يجب ألا تقل عن 8 أحرف.');
  if (!/[A-Za-z؀-ۿ]/.test(p) || !/[0-9]/.test(p)) fail('WEAK_PASSWORD', 'كلمة المرور يجب أن تحتوي على حروف وأرقام.');
  if (p.length > 128) fail('WEAK_PASSWORD', 'كلمة المرور طويلة جدًا.');
}
function emailAllowed_(email) {
  var s = getSettings_();
  if ((s.blockedEmails || []).map(normEmail_).indexOf(email) !== -1) return false;
  if ((s.allowedEmails || []).map(normEmail_).indexOf(email) !== -1) return true;
  var domain = email.split('@')[1] || '';
  return (s.allowedDomains || []).map(function (d) { return String(d).toLowerCase().replace(/^@/, ''); })
    .some(function (d) { return domain === d || domain.slice(-(d.length + 1)) === '.' + d; });
}

function publicUser_(u) {
  return {
    id: u.id, name: u.name, email: u.email, jobTitle: u.jobTitle, department: u.department,
    role: u.role, status: u.status, emailVerified: truthy_(u.emailVerified),
    createdAt: u.createdAt, lastLoginAt: u.lastLoginAt
  };
}

/* ---------- الرموز (تحقق / استعادة) ---------- */
function issueCode_(userId, type, minutes) {
  // إبطال الرموز السابقة من نفس النوع
  readTable_(SHEETS.TOKENS).filter(function (t) { return t.userId === userId && t.type === type && !t.usedAt; })
    .forEach(function (t) { updateRowAt_(SHEETS.TOKENS, t, { usedAt: nowIso_() }); });
  var code = numericCode_(6);
  insertRow_(SHEETS.TOKENS, {
    id: newId_('tok'), userId: userId, type: type, tokenHash: sha256Hex_(type + ':' + userId + ':' + code),
    expiresAt: new Date(Date.now() + minutes * 60000).toISOString(), attempts: 0, usedAt: '', createdAt: nowIso_(), meta: ''
  });
  return code;
}
function consumeCode_(userId, type, code) {
  var tok = findOne_(SHEETS.TOKENS, function (t) { return t.userId === userId && t.type === type && !t.usedAt; });
  if (!tok) fail('CODE_INVALID', 'الرمز غير صالح أو منتهي الصلاحية.');
  if (new Date(tok.expiresAt).getTime() < Date.now()) { updateRowAt_(SHEETS.TOKENS, tok, { usedAt: nowIso_() }); fail('CODE_EXPIRED', 'انتهت صلاحية الرمز. اطلب رمزًا جديدًا.'); }
  var attempts = (parseInt(tok.attempts, 10) || 0) + 1;
  if (attempts > LIMITS.CODE_MAX_ATTEMPTS) { updateRowAt_(SHEETS.TOKENS, tok, { usedAt: nowIso_(), attempts: attempts }); fail('CODE_LOCKED', 'تم تجاوز عدد المحاولات. اطلب رمزًا جديدًا.'); }
  var ok = constantEq_(sha256Hex_(type + ':' + userId + ':' + String(code || '').trim()), String(tok.tokenHash));
  if (!ok) {
    updateRowAt_(SHEETS.TOKENS, tok, { attempts: attempts });
    var left = LIMITS.CODE_MAX_ATTEMPTS - attempts;
    fail('CODE_INVALID', left > 0 ? 'الرمز غير صحيح. المحاولات المتبقية: ' + left : 'الرمز غير صحيح. اطلب رمزًا جديدًا.');
  }
  updateRowAt_(SHEETS.TOKENS, tok, { usedAt: nowIso_(), attempts: attempts });
  return true;
}

/* ---------- الجلسات ---------- */
function createSession_(user, agent) {
  var token = randomToken_(32);
  var hours = Number(getSettings_().sessionHours) || 72;
  var rec = {
    id: newId_('ses'), tokenHash: sha256Hex_(token), userId: user.id, createdAt: nowIso_(),
    expiresAt: new Date(Date.now() + hours * 3600000).toISOString(), lastSeenAt: nowIso_(), revokedAt: '', agent: cleanText_(agent, 120)
  };
  insertRow_(SHEETS.SESSIONS, rec);
  return token;
}
function revokeUserSessions_(userId) {
  readTable_(SHEETS.SESSIONS).filter(function (s) { return s.userId === userId && !s.revokedAt; })
    .forEach(function (s) { updateRowAt_(SHEETS.SESSIONS, s, { revokedAt: nowIso_() }); cacheDel_('ses:' + s.tokenHash); });
}
function revokeSessionByToken_(token) {
  var h = sha256Hex_(token);
  var s = findOne_(SHEETS.SESSIONS, function (r) { return r.tokenHash === h; });
  if (s) updateRowAt_(SHEETS.SESSIONS, s, { revokedAt: nowIso_() });
  cacheDel_('ses:' + h);
}
/** يُعيد المستخدم الحالي من رمز الجلسة، أو null. يُتحقق من حالة الحساب في كل طلب (الإيقاف يُبطل الجلسة فورًا) */
function userFromToken_(token) {
  if (!token || typeof token !== 'string' || token.length < 40) return null;
  var h = sha256Hex_(token);
  var cached = cacheGet_('ses:' + h);
  var s = cached ? parseJson_(cached, null) : null;
  if (!s) {
    s = findOne_(SHEETS.SESSIONS, function (r) { return r.tokenHash === h; });
    if (!s) return null;
    cachePut_('ses:' + h, JSON.stringify({ userId: s.userId, expiresAt: s.expiresAt, revokedAt: s.revokedAt }), 300);
  }
  if (s.revokedAt) return null;
  if (new Date(s.expiresAt).getTime() < Date.now()) return null;
  var user = findById_(SHEETS.USERS, s.userId);
  if (!user || user.status !== USER_STATUS.ACTIVE) { cacheDel_('ses:' + h); return null; }
  return user;
}

/* ---------- الإجراءات العامة (بدون جلسة) ---------- */
function authRegister_(p) {
  var name = cleanText_(p.name, 80), email = normEmail_(p.email), job = cleanText_(p.jobTitle, 60), dept = cleanText_(p.department, 60);
  if (name.length < 3) fail('VALIDATION', 'يُرجى إدخال الاسم الكامل.');
  if (!isEmail_(email)) fail('VALIDATION', 'البريد الإلكتروني غير صالح.');
  if (!emailAllowed_(email)) {
    var doms = (getSettings_().allowedDomains || []).map(function (d) { return '@' + d; }).join(' أو ');
    fail('DOMAIN', 'التسجيل متاح فقط للبريد الرسمي (' + doms + '). إن كان بريدك مستثنى فتواصل مع الإدارة.');
  }
  if (!job) fail('VALIDATION', 'يُرجى اختيار المسمى الوظيفي.');
  if (!dept) fail('VALIDATION', 'يُرجى اختيار القسم.');
  validatePassword_(p.password);
  rateLimit_('reg:' + email, 5, 3600);
  return withLock_(function () {
    var existing = findOne_(SHEETS.USERS, function (u) { return u.email === email; });
    var h = hashPassword_(p.password);
    var user;
    if (existing) {
      if (existing.status !== USER_STATUS.PENDING) fail('EXISTS', 'هذا البريد مسجل مسبقًا. يمكنك تسجيل الدخول أو استعادة كلمة المرور.');
      user = updateRowAt_(SHEETS.USERS, existing, { name: name, jobTitle: job, department: dept, passHash: h.hash, passSalt: h.salt, passIter: h.iter, updatedAt: nowIso_() });
    } else {
      user = insertRow_(SHEETS.USERS, {
        id: newId_('usr'), name: name, email: email, jobTitle: job, department: dept, role: ROLES.TRAINEE,
        status: USER_STATUS.PENDING, emailVerified: 'FALSE', passHash: h.hash, passSalt: h.salt, passIter: h.iter,
        createdAt: nowIso_(), updatedAt: nowIso_(), lastLoginAt: '', notes: ''
      });
    }
    var code = issueCode_(user.id, 'verify', LIMITS.VERIFY_CODE_MINUTES);
    var mail = sendVerificationMail_(user, code);
    audit_(null, 'register', user.id, { email: email });
    return { pending: true, email: email, mailSent: mail.ok, mailError: mail.ok ? '' : 'تعذر إرسال رسالة التحقق حاليًا. يمكنك طلب إعادة الإرسال.' };
  });
}

function authResendVerify_(p) {
  var email = normEmail_(p.email);
  rateLimit_('resend:' + email, 4, 3600);
  var user = findOne_(SHEETS.USERS, function (u) { return u.email === email; });
  // لا نكشف وجود الحساب
  if (user && user.status === USER_STATUS.PENDING) {
    var code = issueCode_(user.id, 'verify', LIMITS.VERIFY_CODE_MINUTES);
    sendVerificationMail_(user, code);
  }
  return { ok: true, message: 'إذا كان البريد مسجلًا وبانتظار التفعيل فسيصله رمز جديد.' };
}

function authVerifyEmail_(p) {
  var email = normEmail_(p.email);
  rateLimit_('verify:' + email, 12, 900);
  var user = findOne_(SHEETS.USERS, function (u) { return u.email === email; });
  if (!user) fail('CODE_INVALID', 'الرمز غير صالح أو منتهي الصلاحية.');
  if (user.status === USER_STATUS.ACTIVE && truthy_(user.emailVerified)) return { verified: true, already: true };
  if (user.status === USER_STATUS.SUSPENDED) fail('SUSPENDED', 'هذا الحساب موقوف. يُرجى التواصل مع مسؤول التطوير المهني.');
  consumeCode_(user.id, 'verify', p.code);
  updateRowAt_(SHEETS.USERS, user, { emailVerified: 'TRUE', status: USER_STATUS.ACTIVE, updatedAt: nowIso_(), lastLoginAt: nowIso_() });
  audit_(null, 'verify_email', user.id, {});
  var token = createSession_(user, p.agent);
  return { verified: true, token: token, user: publicUser_(user) };
}

function authLogin_(p) {
  var email = normEmail_(p.email);
  if (!isEmail_(email)) fail('AUTH', 'البريد الإلكتروني أو كلمة المرور غير صحيحة.');
  rateLimit_('login:' + email, LIMITS.LOGIN_MAX_PER_15MIN, 900);
  var user = findOne_(SHEETS.USERS, function (u) { return u.email === email; });
  var password = String(p.password || '');
  if (!user || !verifyPassword_(password, user)) fail('AUTH', 'البريد الإلكتروني أو كلمة المرور غير صحيحة.');
  if (user.status === USER_STATUS.PENDING) {
    // حساب لم يُفعَّل بعد: نرسل رمزًا جديدًا (بحد أقصى 4 في الساعة) ونوجّه لصفحة التفعيل
    try { rateLimit_('resend:' + email, 4, 3600); var code = issueCode_(user.id, 'verify', LIMITS.VERIFY_CODE_MINUTES); sendVerificationMail_(user, code); } catch (e) { }
    return { pending: true, email: email };
  }
  if (user.status === USER_STATUS.SUSPENDED) fail('SUSPENDED', 'هذا الحساب موقوف. يُرجى التواصل مع مسؤول التطوير المهني.');
  maybeRehash_(user, password);
  var token = createSession_(user, p.agent);
  updateRowAt_(SHEETS.USERS, user, { lastLoginAt: nowIso_() });
  audit_(user, 'login', user.id, {});
  return { token: token, user: publicUser_(user) };
}

function authForgot_(p) {
  var email = normEmail_(p.email);
  rateLimit_('forgot:' + email, LIMITS.RESET_MAX_PER_HOUR, 3600);
  var user = findOne_(SHEETS.USERS, function (u) { return u.email === email; });
  if (user && user.status !== USER_STATUS.SUSPENDED) {
    var code = issueCode_(user.id, 'reset', LIMITS.RESET_CODE_MINUTES);
    sendResetMail_(user, code);
  }
  return { ok: true, message: 'إذا كان البريد مسجلًا لدينا فسيصلك رمز استعادة خلال دقائق.' };
}

function authReset_(p) {
  var email = normEmail_(p.email);
  rateLimit_('reset:' + email, 10, 900);
  validatePassword_(p.password);
  var user = findOne_(SHEETS.USERS, function (u) { return u.email === email; });
  if (!user) fail('CODE_INVALID', 'الرمز غير صالح أو منتهي الصلاحية.');
  consumeCode_(user.id, 'reset', p.code);
  var h = hashPassword_(p.password);
  var patch = { passHash: h.hash, passSalt: h.salt, passIter: h.iter, updatedAt: nowIso_() };
  if (user.status === USER_STATUS.PENDING) { patch.status = USER_STATUS.ACTIVE; patch.emailVerified = 'TRUE'; }
  updateRowAt_(SHEETS.USERS, user, patch);
  revokeUserSessions_(user.id);
  audit_(user, 'password_reset', user.id, {});
  return { ok: true };
}

/* ---------- إجراءات المستخدم المسجّل ---------- */
function authMe_(user) {
  return { user: publicUser_(user), settings: publicSettings_() };
}
function authLogout_(user, token) { revokeSessionByToken_(token); audit_(user, 'logout', user.id, {}); return { ok: true }; }

function authUpdateProfile_(user, p) {
  var patch = { updatedAt: nowIso_() };
  if (p.name !== undefined) { var n = cleanText_(p.name, 80); if (n.length < 3) fail('VALIDATION', 'الاسم قصير جدًا.'); patch.name = n; }
  if (p.jobTitle !== undefined) patch.jobTitle = cleanText_(p.jobTitle, 60);
  if (p.department !== undefined) patch.department = cleanText_(p.department, 60);
  updateRowAt_(SHEETS.USERS, user, patch);
  audit_(user, 'profile_update', user.id, patch);
  return { user: publicUser_(user) };
}

function authChangePassword_(user, p, token) {
  if (!verifyPassword_(String(p.current || ''), user)) fail('AUTH', 'كلمة المرور الحالية غير صحيحة.');
  validatePassword_(p.password);
  var h = hashPassword_(p.password);
  updateRowAt_(SHEETS.USERS, user, { passHash: h.hash, passSalt: h.salt, passIter: h.iter, updatedAt: nowIso_() });
  revokeUserSessions_(user.id);
  var newToken = createSession_(user, p.agent);
  audit_(user, 'password_change', user.id, {});
  return { token: newToken };
}

/** الإعدادات التي يجوز إرسالها للمتصفح (بدون أسرار) */
function publicSettings_() {
  var s = getSettings_();
  return {
    departments: s.departments, jobTitles: s.jobTitles, allowedDomains: s.allowedDomains,
    defaultPassScore: s.defaultPassScore, retryPolicy: s.retryPolicy, maxAttempts: s.maxAttempts,
    showCorrectAnswers: s.showCorrectAnswers, app: APP, certificateAccent: s.certificate.accent,
    branding: { headerImageId: s.branding.headerImageId || '', footerImageId: s.branding.footerImageId || '' }
  };
}


/* ######################## Setup.gs ######################## */

/**
 * Setup.gs — الإعداد الأولي والترحيل والإدارة من محرر Apps Script
 * ------------------------------------------------------------
 * الخطوات (انظر دليل التشغيل docs/01-setup-deploy.md):
 *   1) SETUP_1_initialize()  → ينشئ الجداول ومجلد Drive ويزرع الورشة الأولى ويطبع «رمز الإعداد» في السجل.
 *   2) افتح تطبيق الويب → صفحة «إعداد المدير الأول» → أدخل رمز الإعداد والاسم والبريد وكلمة المرور.
 *   3) SETUP_2_setAnthropicKey('sk-ant-...') اختياريًا لتفعيل التوليد الآلي، أو من لوحة الإدارة > الإعدادات.
 *   4) SETUP_4_installMailRetryTrigger() لتثبيت مشغّل زمني يعالج قائمة انتظار البريد والرسائل الفاشلة.
 *   - SETUP_5_migrate() عند الترقية من إصدار سابق (غير مدمر: يضيف الأعمدة/الإعدادات الناقصة فقط).
 *   - DIAG_checkEnvironment() لفحص الإعداد دون أي تعديل.
 */

function SETUP_1_initialize() {
  var props = PropertiesService.getScriptProperties();
  var ss;
  var id = props.getProperty(PROPS.SPREADSHEET_ID);
  if (id) { try { ss = SpreadsheetApp.openById(id); } catch (e) { ss = null; } }
  if (!ss) ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    ss = SpreadsheetApp.create('IKP - قاعدة بيانات منصة ابن خلدون للتدريب');
  }
  props.setProperty(PROPS.SPREADSHEET_ID, ss.getId());
  __dbCache.ss = ss; __dbCache.sheets = {}; __dbCache.headers = {}; __dbCache.tables = {};

  Object.keys(SCHEMA).forEach(function (name) { getSheet_(name); headersOf_(name); });
  var def = ss.getSheetByName('Sheet1') || ss.getSheetByName('ورقة1');
  if (def && ss.getSheets().length > 1) { try { ss.deleteSheet(def); } catch (e) { } }

  // مجلد Drive للشهادات والأصول
  driveFolder_();
  pepper_();
  props.setProperty(PROPS.SCHEMA_VERSION, String(APP.SCHEMA_VERSION));

  // الورشة الأولى (لا تتكرر إذا كانت موجودة)
  seedInitialWorkshop_();

  // رمز الإعداد للمدير الأول (صالح 24 ساعة) — يُطبع في السجل فقط ولا يُخزن إلا مجزّأً
  var admins = readTable_(SHEETS.USERS).filter(function (u) { return u.role === ROLES.ADMIN && u.status === USER_STATUS.ACTIVE; });
  var msg = 'تم الإعداد بنجاح.\nقاعدة البيانات: ' + ss.getUrl();
  if (!admins.length) {
    var token = numericCode_(8);
    props.setProperty(PROPS.SETUP_TOKEN_HASH, sha256Hex_('setup:' + token));
    props.setProperty(PROPS.SETUP_TOKEN_EXP, String(Date.now() + 24 * 3600000));
    msg += '\n\nرمز الإعداد للمدير الأول (صالح 24 ساعة): ' + token +
      '\nافتح تطبيق الويب وأدخل هذا الرمز في صفحة «إعداد المدير الأول».';
  } else {
    msg += '\nيوجد مدير نشط بالفعل (' + admins.length + ') — لا حاجة لرمز إعداد.';
  }
  Logger.log(msg);
  return msg;
}

/** تحديد مفتاح Anthropic من المحرر (بديل عن لوحة الإدارة) */
function SETUP_2_setAnthropicKey(key) {
  if (!key || String(key).indexOf('sk-ant') !== 0) throw new Error('المفتاح غير صالح. مرّر المفتاح كمعامل: SETUP_2_setAnthropicKey("sk-ant-...")');
  var props = PropertiesService.getScriptProperties();
  props.setProperty(PROPS.ANTHROPIC_KEY, String(key).trim());
  props.setProperty(PROPS.ANTHROPIC_KEY_AT, nowIso_());
  Logger.log('تم حفظ مفتاح Anthropic على الخادم.');
}

/** توليد رمز إعداد جديد (مثلًا عند فقدان جميع حسابات المدراء) */
function SETUP_3_regenerateSetupToken() {
  var props = PropertiesService.getScriptProperties();
  var token = numericCode_(8);
  props.setProperty(PROPS.SETUP_TOKEN_HASH, sha256Hex_('setup:' + token));
  props.setProperty(PROPS.SETUP_TOKEN_EXP, String(Date.now() + 24 * 3600000));
  Logger.log('رمز الإعداد الجديد (صالح 24 ساعة): ' + token + '\nيُستخدم في صفحة «إعداد المدير الأول» أو لترقية حساب موجود إلى مدير من نفس الصفحة.');
  return token;
}

/** تثبيت مشغّل زمني لمعالجة قائمة انتظار البريد والرسائل الفاشلة كل ساعة */
function SETUP_4_installMailRetryTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'cronRetryMail') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('cronRetryMail').timeBased().everyHours(1).create();
  Logger.log('تم تثبيت المشغّل الزمني cronRetryMail (كل ساعة).');
}
function cronRetryMail() { try { mailRetryFailed_(null, { max: LIMITS.MAIL_MAX_PER_RUN }); } catch (e) { Logger.log(e); } }

/**
 * ترحيل غير مدمر من الإصدار 2.x إلى 3.x:
 * - يضيف الأعمدة الناقصة في نهاية كل جدول (دون نقل أو حذف).
 * - يدمج مفاتيح الإعدادات الجديدة (branding, ai.effort, mail.noReply…) مع الافتراضيات دون الكتابة فوق القيم الحالية.
 * - لا يلمس كلمات المرور أو الجلسات أو النتائج.
 */
function SETUP_5_migrate() {
  var props = PropertiesService.getScriptProperties();
  var from = props.getProperty(PROPS.SCHEMA_VERSION) || '2';
  var report = ['الترحيل من إصدار البنية ' + from + ' إلى ' + APP.SCHEMA_VERSION];
  __dbCache.headers = {}; __dbCache.tables = {};
  Object.keys(SCHEMA).forEach(function (name) {
    var before = getSheet_(name).getLastColumn();
    var hdr = headersOf_(name);
    if (hdr.length > before) report.push(name + ': أُضيفت ' + (hdr.length - before) + ' أعمدة جديدة');
  });
  var s = getSettings_();
  ['certificate', 'ai', 'mail', 'branding'].forEach(function (k) { setSetting_(k, s[k]); });
  if (!props.getProperty(PROPS.DRIVE_FOLDER_ID)) { driveFolder_(); report.push('أُنشئ مجلد Drive للملفات'); }
  props.setProperty(PROPS.SCHEMA_VERSION, String(APP.SCHEMA_VERSION));
  audit_(null, 'migrate', '', { from: from, to: APP.SCHEMA_VERSION });
  var msg = report.join('\n');
  Logger.log(msg);
  return msg;
}

/** فحص البيئة دون تعديل: الجداول، المجلد، البريد، المفتاح، المشغّل، الرابط */
function DIAG_checkEnvironment() {
  var props = PropertiesService.getScriptProperties();
  var out = [];
  try { var ss = getSpreadsheet_(); out.push('✔ قاعدة البيانات: ' + ss.getUrl()); } catch (e) { out.push('✖ قاعدة البيانات غير مضبوطة: ' + e.message); }
  try { Object.keys(SCHEMA).forEach(function (n) { out.push('  - ' + n + ': ' + readTable_(n).length + ' سجل'); }); } catch (e2) { }
  out.push((props.getProperty(PROPS.DRIVE_FOLDER_ID) ? '✔' : '✖') + ' مجلد Drive للملفات');
  out.push((props.getProperty(PROPS.PEPPER) ? '✔' : '✖') + ' مفتاح التجزئة الخادمي (pepper)');
  out.push((props.getProperty(PROPS.ANTHROPIC_KEY) ? '✔' : '○') + ' مفتاح Anthropic (اختياري)');
  try { out.push('✔ حصة البريد المتبقية اليوم: ' + MailApp.getRemainingDailyQuota()); } catch (e3) { out.push('✖ تعذر قراءة حصة البريد: ' + e3.message); }
  var trig = ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'cronRetryMail'; });
  out.push((trig ? '✔' : '○') + ' مشغّل إعادة إرسال البريد (اختياري)');
  var url = webAppUrl_();
  out.push((url ? '✔ رابط تطبيق الويب: ' + url : '○ لم يُنشر تطبيق الويب بعد'));
  var admins = 0; try { admins = readTable_(SHEETS.USERS).filter(function (u) { return u.role === ROLES.ADMIN && u.status === USER_STATUS.ACTIVE; }).length; } catch (e4) { }
  out.push((admins ? '✔' : '✖') + ' عدد المدراء النشطين: ' + admins);
  var msg = out.join('\n');
  Logger.log(msg);
  return msg;
}

/** هل النظام بحاجة لإعداد المدير الأول؟ */
function setupState_() {
  var props = PropertiesService.getScriptProperties();
  var hasDb = !!props.getProperty(PROPS.SPREADSHEET_ID);
  var admins = hasDb ? readTable_(SHEETS.USERS).filter(function (u) { return u.role === ROLES.ADMIN && u.status === USER_STATUS.ACTIVE; }).length : 0;
  var exp = parseInt(props.getProperty(PROPS.SETUP_TOKEN_EXP) || '0', 10);
  return { hasDb: hasDb, needsAdmin: admins === 0, setupTokenActive: !!props.getProperty(PROPS.SETUP_TOKEN_HASH) && exp > Date.now() };
}

/** إنشاء المدير الأول (أو ترقية حساب) عبر رمز الإعداد — إثبات ملكية المشروع */
function setupCreateAdmin_(p) {
  var props = PropertiesService.getScriptProperties();
  var hash = props.getProperty(PROPS.SETUP_TOKEN_HASH);
  var exp = parseInt(props.getProperty(PROPS.SETUP_TOKEN_EXP) || '0', 10);
  rateLimit_('setup', 6, 900);
  if (!hash || exp < Date.now()) fail('SETUP_TOKEN', 'رمز الإعداد غير مفعّل أو منتهي. شغّل SETUP_3_regenerateSetupToken من المحرر.');
  if (!constantEq_(sha256Hex_('setup:' + String(p.setupToken || '').trim()), hash)) fail('SETUP_TOKEN', 'رمز الإعداد غير صحيح.');
  var name = cleanText_(p.name, 80), email = normEmail_(p.email);
  if (name.length < 3 || !isEmail_(email)) fail('VALIDATION', 'يُرجى إدخال الاسم والبريد بشكل صحيح.');
  validatePassword_(p.password);
  return withLock_(function () {
    var s = getSettings_();
    var h = hashPassword_(p.password);
    var existing = findOne_(SHEETS.USERS, function (u) { return u.email === email; });
    var user;
    var patch = { role: ROLES.ADMIN, status: USER_STATUS.ACTIVE, emailVerified: 'TRUE', passHash: h.hash, passSalt: h.salt, passIter: h.iter, updatedAt: nowIso_(), name: name };
    if (existing) user = updateRowAt_(SHEETS.USERS, existing, patch);
    else user = insertRow_(SHEETS.USERS, Object.assign({
      id: newId_('usr'), email: email, jobTitle: cleanText_(p.jobTitle || 'نائب مدير', 60), department: cleanText_(p.department || 'الإدارة المدرسية', 60),
      createdAt: nowIso_(), lastLoginAt: '', notes: 'المدير الأول'
    }, patch));
    // استثناء بريد المدير من قيد النطاق + ضبط البريد الإداري إن لم يكن مضبوطًا
    if (!emailAllowed_(email)) { s.allowedEmails = (s.allowedEmails || []).concat([email]); setSetting_('allowedEmails', s.allowedEmails); }
    if (!s.adminNotifyEmail) setSetting_('adminNotifyEmail', email);
    props.deleteProperty(PROPS.SETUP_TOKEN_HASH); props.deleteProperty(PROPS.SETUP_TOKEN_EXP);
    audit_(user, 'setup_admin', user.id, { email: email });
    var token = createSession_(user, p.agent);
    return { token: token, user: publicUser_(user) };
  });
}


/* ######################## Api.gs ######################## */

/**
 * Api.gs — نقطة الدخول الوحيدة للواجهة (google.script.run.api) وصفحة الويب (doGet)
 * ------------------------------------------------------------
 * كل إجراء له مستوى صلاحية: public | user | admin — ويُتحقق منه هنا على الخادم دائمًا.
 * الواجهة تُقدَّم من تطبيق الويب نفسه؛ لا توجد قناة اتصال خارجية (doPost) في هذه النسخة.
 */

function doGet(e) {
  var params = (e && e.parameter) || {};
  if (params.verify) return renderVerifyPage_(String(params.verify));
  try { PropertiesService.getScriptProperties().setProperty(PROPS.WEBAPP_URL, ScriptApp.getService().getUrl() || ''); } catch (err) { }
  var t = HtmlService.createTemplateFromFile('index');
  t.bootstrap = JSON.stringify({ app: APP, version: APP.VERSION });
  var out = t.evaluate()
    .setTitle(APP.NAME)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover')
    .setSandboxMode(HtmlService.SandboxMode.IFRAME);
  out.setXFrameOptionsMode(LIMITS.ALLOW_EMBED ? HtmlService.XFrameOptionsMode.ALLOWALL : HtmlService.XFrameOptionsMode.DEFAULT);
  return out;
}

/** تضمين ملف HTML داخل القالب (النسخة المقسمة). في نسخة الملف الواحد لا تُستدعى. */
function include(name) { return HtmlService.createHtmlOutputFromFile(name).getContent(); }

function webAppUrl_() {
  var u = '';
  try { u = ScriptApp.getService().getUrl() || ''; } catch (e) { }
  if (!u) u = PropertiesService.getScriptProperties().getProperty(PROPS.WEBAPP_URL) || '';
  return u;
}

/** خريطة الإجراءات: [مستوى الصلاحية, الدالة] */
var ACTIONS = {
  // عام
  'app.state': ['public', function (u, p) { return { setup: setupState_(), settings: publicSettings_() }; }],
  'app.assets': ['public', function (u, p) { return brandingAssets_(p); }],
  'setup.createAdmin': ['public', function (u, p) { return setupCreateAdmin_(p); }],
  'auth.register': ['public', function (u, p) { return authRegister_(p); }],
  'auth.resendVerify': ['public', function (u, p) { return authResendVerify_(p); }],
  'auth.verifyEmail': ['public', function (u, p) { return authVerifyEmail_(p); }],
  'auth.login': ['public', function (u, p) { return authLogin_(p); }],
  'auth.forgot': ['public', function (u, p) { return authForgot_(p); }],
  'auth.reset': ['public', function (u, p) { return authReset_(p); }],
  'cert.verify': ['public', function (u, p) { return certVerify_(p.code); }],

  // مستخدم مسجّل
  'auth.me': ['user', function (u, p) { return authMe_(u); }],
  'auth.logout': ['user', function (u, p, t) { return authLogout_(u, t); }],
  'auth.updateProfile': ['user', function (u, p) { return authUpdateProfile_(u, p); }],
  'auth.changePassword': ['user', function (u, p, t) { return authChangePassword_(u, p, t); }],
  'ws.list': ['user', function (u, p) { return wsListForTrainee_(u); }],
  'ws.get': ['user', function (u, p) { return wsGetForTrainee_(u, p.id); }],
  'ws.ack': ['user', function (u, p) { return progressAcknowledge_(u, p); }],
  'quiz.start': ['user', function (u, p) { return quizStart_(u, p); }],
  'quiz.submit': ['user', function (u, p) { return quizSubmit_(u, p); }],
  'quiz.history': ['user', function (u, p) { return quizHistory_(u, p); }],
  'cert.mine': ['user', function (u, p) { return certMine_(u); }],
  'cert.get': ['user', function (u, p) { return certGet_(u, p.id); }],
  'cert.pdf': ['user', function (u, p) { return certPdf_(u, p.id); }],

  // إدارة
  'admin.overview': ['admin', function (u, p) { return adminOverview_(); }],
  'admin.users.list': ['admin', function (u, p) { return adminUsersList_(p); }],
  'admin.users.update': ['admin', function (u, p) { return adminUserUpdate_(u, p); }],
  'admin.users.create': ['admin', function (u, p) { return adminUserCreate_(u, p); }],
  'admin.users.delete': ['admin', function (u, p) { return adminUserDelete_(u, p); }],
  'admin.ws.list': ['admin', function (u, p) { return wsAdminList_(); }],
  'admin.ws.get': ['admin', function (u, p) { return wsAdminGet_(p.id); }],
  'admin.ws.create': ['admin', function (u, p) { return wsCreate_(u, p); }],
  'admin.ws.saveDraft': ['admin', function (u, p) { return wsSaveDraft_(u, p); }],
  'admin.ws.setStatus': ['admin', function (u, p) { return wsSetStatus_(u, p); }],
  'admin.ws.validate': ['admin', function (u, p) { return { issues: wsValidateContent_(sanitizeContent_(p.content), p.passScore) }; }],
  'admin.ws.delete': ['admin', function (u, p) { return wsDeleteForever_(u, p); }],
  'admin.ws.notify': ['admin', function (u, p) { return wsNotifyStaff_(u, p); }],
  'admin.ws.thankTrainer': ['admin', function (u, p) { return certIssueTrainer_(u, p.id, true); }],
  'admin.ws.skeleton': ['admin', function (u, p) { return { content: aiSkeleton_(p) }; }],
  'admin.results': ['admin', function (u, p) { return adminResults_(p); }],
  'admin.results.csv': ['admin', function (u, p) { return adminResultsCsv_(p); }],
  'admin.reports': ['admin', function (u, p) { return adminReports_(p); }],
  'admin.certs.list': ['admin', function (u, p) { return adminCertList_(p); }],
  'admin.certs.resend': ['admin', function (u, p) { return certResendMail_(u, p.id); }],
  'admin.certs.revoke': ['admin', function (u, p) { return certRevoke_(u, p.id); }],
  'admin.certs.preview': ['admin', function (u, p) { return { html: certPreviewHtml_(p) }; }],
  'admin.settings.get': ['admin', function (u, p) { return adminSettingsGet_(); }],
  'admin.settings.save': ['admin', function (u, p) { return adminSettingsSave_(u, p); }],
  'admin.assets.upload': ['admin', function (u, p) { return adminAssetUpload_(u, p); }],
  'admin.assets.get': ['admin', function (u, p) { return { dataUrl: assetDataUrl_(p.id, true) }; }],
  'admin.ai.key': ['admin', function (u, p) { return adminAiKey_(u, p); }],
  'admin.ai.test': ['admin', function (u, p) { return aiTestConnection_(); }],
  'admin.ai.start': ['admin', function (u, p) { return aiJobStart_(u, p); }],
  'admin.ai.step': ['admin', function (u, p) { return aiJobStep_(u, p.jobId); }],
  'admin.ai.get': ['admin', function (u, p) { return aiJobGet_(p.jobId); }],
  'admin.ai.list': ['admin', function (u, p) { return aiJobList_(); }],
  'admin.ai.cancel': ['admin', function (u, p) { return aiJobCancel_(u, p.jobId); }],
  'admin.ai.prompt': ['admin', function (u, p) { return { prompt: aiManualPrompt_(p) }; }],
  'admin.ai.importJson': ['admin', function (u, p) { return aiImportJson_(u, p); }],
  'admin.mail.list': ['admin', function (u, p) { return adminMailList_(p); }],
  'admin.mail.retry': ['admin', function (u, p) { return mailRetryFailed_(u, p); }],
  'admin.audit': ['admin', function (u, p) { return adminAudit_(p); }],
  'admin.backup.export': ['admin', function (u, p) { return backupExport_(u); }],
  'admin.backup.preview': ['admin', function (u, p) { return backupPreview_(p); }],
  'admin.backup.import': ['admin', function (u, p) { return backupImport_(u, p); }]
};

/**
 * نقطة الدخول: يستدعيها المتصفح عبر google.script.run.api({action, payload, token})
 * تُعيد دائمًا {ok:true,data} أو {ok:false,code,message}
 */
function api(req) {
  var started = Date.now();
  try {
    req = req || {};
    var action = String(req.action || '');
    var def = ACTIONS[action];
    if (!def) fail('BAD_ACTION', 'إجراء غير معروف.');
    var level = def[0];
    var payload = (req.payload && typeof req.payload === 'object') ? req.payload : {};
    var token = req.token ? String(req.token) : '';
    var user = null;
    if (level !== 'public') {
      user = userFromToken_(token);
      if (!user) fail('UNAUTHENTICATED', 'انتهت الجلسة. يُرجى تسجيل الدخول مجددًا.');
      if (level === 'admin' && user.role !== ROLES.ADMIN) {
        audit_(user, 'forbidden', action, {});
        fail('FORBIDDEN', 'لا تملك صلاحية تنفيذ هذا الإجراء.');
      }
    }
    var data = def[1](user, payload, token);
    return { ok: true, data: data === undefined ? null : data, ms: Date.now() - started };
  } catch (e) {
    if (e && e.name === 'AppError') return { ok: false, code: e.code, message: e.message, extra: e.extra };
    var msg = String(e && e.message || e);
    console.error('api(' + (req && req.action) + '): ' + msg + '\n' + (e && e.stack || ''));
    var friendly = 'حدث خطأ غير متوقع في الخادم. يُرجى المحاولة لاحقًا.';
    if (/exceeded maximum execution time/i.test(msg)) friendly = 'استغرقت العملية وقتًا أطول من المسموح. أعد المحاولة أو قسّم العملية.';
    if (/Service invoked too many times|quota/i.test(msg)) friendly = 'تم بلوغ حد الاستخدام اليومي لإحدى خدمات Google. حاول لاحقًا.';
    return { ok: false, code: 'SERVER', message: friendly };
  }
}

/** صفحة التحقق العامة من الشهادة: ?verify=CODE — أقل قدر من البيانات */
function renderVerifyPage_(code) {
  var r;
  try { r = certVerify_(code); } catch (e) { r = { valid: false }; }
  var esc = htmlEscape_;
  var body;
  if (r.valid) {
    body = '<div class="' + (r.revoked ? 'bad' : 'ok') + '">' + (r.revoked ? '⚠ شهادة صادرة عن المنصة لكنها ملغاة' : '✔ شهادة صحيحة وصادرة عن المنصة') + '</div>' +
      '<table><tr><th>الاسم</th><td>' + esc(r.name) + '</td></tr>' +
      '<tr><th>' + (r.kind === 'trainer' ? 'الورشة المقدَّمة' : 'الورشة') + '</th><td>' + esc(r.workshop) + '</td></tr>' +
      '<tr><th>تاريخ الإصدار</th><td dir="ltr">' + esc(r.issuedAt) + '</td></tr>' +
      '<tr><th>رقم الشهادة</th><td dir="ltr">' + esc(r.serial) + '</td></tr>' +
      '<tr><th>الحالة</th><td class="' + (r.revoked ? 'bad' : 'ok') + '">' + (r.revoked ? 'ملغاة' : 'سارية') + '</td></tr></table>';
  } else {
    body = '<div class="bad">✖ لم يتم العثور على شهادة بهذا الرمز.</div>';
  }
  var html = '<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>التحقق من الشهادة — ' + esc(APP.SCHOOL) + '</title><style>body{font-family:Tahoma,Arial,sans-serif;background:#f6f1ee;margin:0;padding:24px;color:#222}' +
    '.card{max-width:560px;margin:40px auto;background:#fff;border-top:6px solid #7b1a2e;border-radius:12px;padding:28px;box-shadow:0 8px 30px rgba(0,0,0,.08)}' +
    'h1{font-size:18px;color:#7b1a2e;margin:0 0 6px}h2{font-size:14px;color:#666;margin:0 0 18px;font-weight:normal}' +
    'table{width:100%;border-collapse:collapse}th,td{text-align:right;padding:8px;border-bottom:1px solid #eee}th{color:#7b1a2e;width:36%}' +
    '.ok{color:#1b7a3d;font-weight:bold;margin-bottom:14px}.bad{color:#b3261e;font-weight:bold;margin-bottom:14px}</style></head><body>' +
    '<div class="card"><h1>' + esc(APP.SCHOOL) + '</h1><h2>' + esc(APP.NAME) + ' — التحقق من صحة الشهادة</h2>' + body + '</div></body></html>';
  return HtmlService.createHtmlOutput(html).setTitle('التحقق من الشهادة').addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function htmlEscape_(s) {
  return String(s === undefined || s === null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}


/* ######################## Workshops.gs ######################## */

/**
 * Workshops.gs — إدارة الورش وإصداراتها وتقدّم المتدربين
 * ------------------------------------------------------------
 * بنية محتوى الإصدار (JSON):
 * {
 *   objectives: [..], modules: [ { title, summary, objectives:[], sections:[{type,title,body,items,rows}],
 *       resources:[{type,title,url}], questions:[{text,options[4],answer,explanation}] } ],
 *   finalQuiz: { questions:[...] }
 * }
 * أنواع الأقسام: text | list | table | example | tip | warning | remember | activity | steps
 * - كل تعديل على محتوى ورشة منشورة (أو لها محاولات) يُحفظ كإصدار جديد؛ المحاولات والنتائج تبقى مرتبطة بإصدارها.
 */

var SECTION_TYPES = ['text', 'list', 'table', 'example', 'tip', 'warning', 'remember', 'activity', 'steps'];

function wsPublic_(w) {
  return {
    id: w.id, title: w.title, description: w.description, audience: w.audience, category: w.category,
    targetDepartments: parseJson_(w.targetDepartments, []), passScore: Number(w.passScore) || 80, status: w.status,
    currentVersion: w.currentVersion, trainerName: w.trainerName, trainerEmail: w.trainerEmail,
    scheduledAt: w.scheduledAt, durationMin: Number(w.durationMin) || 0, location: w.location,
    createdAt: w.createdAt, updatedAt: w.updatedAt, publishedAt: w.publishedAt, notifiedAt: w.notifiedAt,
    trainerThankedAt: w.trainerThankedAt, moduleCount: Number(w.moduleCount) || 0, source: w.source
  };
}

function versionContent_(versionId) {
  var v = findById_(SHEETS.VERSIONS, versionId);
  if (!v) return null;
  return unpackChunks_(v, 'c', 10);
}
function currentContent_(w) { return w.currentVersion ? versionContent_(w.currentVersion) : null; }

function saveVersion_(user, workshopId, content, versionNo) {
  var rec = Object.assign({
    id: newId_('ver'), workshopId: workshopId, version: versionNo, createdAt: nowIso_(),
    createdBy: user ? user.id : 'system', checksum: sha256Hex_(JSON.stringify(content)).substr(0, 16)
  }, packChunks_(content, 'c', 10));
  insertRow_(SHEETS.VERSIONS, rec);
  return rec;
}

/* ---------- تنظيف المحتوى القادم من المتصفح (لا HTML ولا روابط غير http/https) ---------- */
function sanitizeContent_(raw) {
  raw = (raw && typeof raw === 'object') ? raw : {};
  var url = function (u) { u = String(u || '').trim(); return /^https?:\/\/[^\s<>"']+$/i.test(u) ? u.substr(0, 500) : ''; };
  var txt = function (s, n) { return String(s === undefined || s === null ? '' : s).replace(/<[^>]*>/g, '').replace(/\r\n?/g, '\n').trim().substr(0, n || 20000); };
  var arr = function (a) { return Array.isArray(a) ? a : []; };
  var q = function (qq) {
    qq = (qq && typeof qq === 'object') ? qq : {};
    var opts = arr(qq.options).slice(0, 4).map(function (o) { return txt(o, 300); });
    while (opts.length < 4) opts.push('');
    var ans = parseInt(qq.answer, 10);
    return { text: txt(qq.text, 600), options: opts, answer: (ans >= 0 && ans <= 3) ? ans : 0, explanation: txt(qq.explanation, 800) };
  };
  var sec = function (s) {
    s = (s && typeof s === 'object') ? s : {};
    var t = String(s.type || 'text');
    if (SECTION_TYPES.indexOf(t) === -1) t = 'text';
    var o = { type: t, title: txt(s.title, 200), body: txt(s.body, 12000) };
    if (t === 'list' || t === 'steps' || t === 'remember' || Array.isArray(s.items)) o.items = arr(s.items).map(function (i) { return txt(i, 600); }).filter(Boolean).slice(0, 40);
    if (t === 'table') o.rows = arr(s.rows).slice(0, 40).map(function (r) { return arr(r).slice(0, 8).map(function (c) { return txt(c, 400); }); }).filter(function (r) { return r.length; });
    return o;
  };
  return {
    objectives: arr(raw.objectives).map(function (o) { return txt(o, 300); }).filter(Boolean).slice(0, 12),
    modules: arr(raw.modules).slice(0, 20).map(function (m) {
      m = (m && typeof m === 'object') ? m : {};
      return {
        title: txt(m.title, 200),
        summary: txt(m.summary, 1000),
        objectives: arr(m.objectives).map(function (o) { return txt(o, 300); }).filter(Boolean).slice(0, 8),
        sections: arr(m.sections).slice(0, 40).map(sec),
        resources: arr(m.resources).slice(0, 15).map(function (r) {
          r = (r && typeof r === 'object') ? r : {};
          var ty = ['link', 'video', 'file'].indexOf(r.type) === -1 ? 'link' : r.type;
          return { type: ty, title: txt(r.title, 200), url: url(r.url) };
        }).filter(function (r) { return r.url; }),
        questions: arr(m.questions).slice(0, 15).map(q)
      };
    }),
    finalQuiz: { questions: arr(raw.finalQuiz && raw.finalQuiz.questions).slice(0, 40).map(q) }
  };
}

/** عدّ الكلمات فعليًا (فصل بالمسافات) — لا يُستبدل بعدّ الأحرف */
function wordCount_(s) { return String(s || '').split(/\s+/).filter(function (w) { return w.length > 0; }).length; }
function moduleWords_(m) {
  return ((m && m.sections) || []).reduce(function (a, s) {
    return a + wordCount_(s.body) + wordCount_((s.items || []).join(' ')) + wordCount_((s.rows || []).map(function (r) { return (r || []).join(' '); }).join(' '));
  }, 0);
}

/** التحقق من اكتمال المحتوى قبل النشر — يُعيد قائمة مشكلات (فارغة = صالح) */
function wsValidateContent_(content, passScore) {
  var issues = [];
  var s = getSettings_();
  content = content || {};
  var mods = content.modules || [];
  if (!mods.length) issues.push('لا توجد وحدات في الورشة.');
  var ps = Number(passScore);
  if (!(ps >= 1 && ps <= 100)) issues.push('نسبة النجاح يجب أن تكون بين 1 و100.');
  var checkQ = function (qs, label, min) {
    if (qs.length < min) issues.push(label + ': عدد الأسئلة ' + qs.length + ' والمطلوب ' + min + ' على الأقل.');
    qs.forEach(function (q, i) {
      var n = label + ' — السؤال ' + (i + 1);
      if (!q.text || q.text.length < 8) issues.push(n + ': نص السؤال ناقص.');
      if (!q.options || q.options.length !== 4) issues.push(n + ': يجب أن يحتوي على 4 خيارات.');
      else if (q.options.some(function (o) { return !o; })) issues.push(n + ': يوجد خيار فارغ.');
      else if (new Set(q.options).size !== 4) issues.push(n + ': توجد خيارات مكررة.');
      if (!(q.answer >= 0 && q.answer <= 3)) issues.push(n + ': مؤشر الإجابة الصحيحة غير صالح.');
    });
  };
  mods.forEach(function (m, i) {
    var label = 'الوحدة ' + (i + 1);
    if (!m.title) issues.push(label + ': العنوان فارغ.');
    if (!m.sections || !m.sections.length) issues.push(label + ': لا يوجد محتوى.');
    var words = moduleWords_(m);
    if (words < 150) issues.push(label + ': المحتوى قصير جدًا (' + words + ' كلمة).');
    if (!m.objectives || m.objectives.length < 1) issues.push(label + ': لا توجد أهداف.');
    checkQ(m.questions || [], label, Number(s.moduleQuestions) || 5);
  });
  var fq = (content.finalQuiz && content.finalQuiz.questions) || [];
  checkQ(fq, 'الاختبار النهائي', Number(s.finalQuestions) || 10);
  var modTexts = {};
  mods.forEach(function (m) { (m.questions || []).forEach(function (q) { if (q.text) modTexts[q.text] = 1; }); });
  var dup = fq.filter(function (q) { return modTexts[q.text]; }).length;
  if (dup) issues.push('الاختبار النهائي يكرر ' + dup + ' من أسئلة الوحدات حرفيًا.');
  return issues;
}

/* ---------- الإدارة ---------- */
function wsAdminList_() {
  var results = readTable_(SHEETS.RESULTS);
  var progress = readTable_(SHEETS.PROGRESS);
  return {
    workshops: readTable_(SHEETS.WORKSHOPS).map(function (w) {
      var o = wsPublic_(w);
      o.stats = {
        started: progress.filter(function (p) { return p.workshopId === w.id; }).length,
        passed: results.filter(function (r) { return r.workshopId === w.id && truthy_(r.passed); }).length
      };
      return o;
    }).sort(function (a, b) { return String(b.updatedAt).localeCompare(String(a.updatedAt)); })
  };
}
function wsAdminGet_(id) {
  var w = findById_(SHEETS.WORKSHOPS, id);
  if (!w) fail('NOT_FOUND', 'الورشة غير موجودة.');
  var attempts = readTable_(SHEETS.ATTEMPTS);
  var versions = readTable_(SHEETS.VERSIONS).filter(function (v) { return v.workshopId === id; })
    .map(function (v) { return { id: v.id, version: Number(v.version), createdAt: v.createdAt, checksum: v.checksum, current: v.id === w.currentVersion, attempts: attempts.filter(function (a) { return a.versionId === v.id; }).length }; })
    .sort(function (a, b) { return a.version - b.version; });
  return { workshop: wsPublic_(w), content: currentContent_(w) || { objectives: [], modules: [], finalQuiz: { questions: [] } }, versions: versions };
}

function wsMetaPatch_(p) {
  var patch = {};
  if (p.title !== undefined) patch.title = cleanText_(p.title, 200);
  if (p.description !== undefined) patch.description = String(p.description || '').replace(/<[^>]*>/g, '').trim().substr(0, 2000);
  if (p.audience !== undefined) patch.audience = cleanText_(p.audience, 200);
  if (p.category !== undefined) patch.category = cleanText_(p.category, 100);
  if (p.targetDepartments !== undefined) patch.targetDepartments = JSON.stringify((Array.isArray(p.targetDepartments) ? p.targetDepartments : []).map(function (d) { return cleanText_(d, 60); }).filter(Boolean).slice(0, 30));
  if (p.passScore !== undefined) { var ps = parseInt(p.passScore, 10); if (!(ps >= 1 && ps <= 100)) fail('VALIDATION', 'نسبة النجاح يجب أن تكون بين 1 و100.'); patch.passScore = ps; }
  if (p.trainerName !== undefined) patch.trainerName = cleanText_(p.trainerName, 100);
  if (p.trainerEmail !== undefined) { var te = normEmail_(p.trainerEmail); if (te && !isEmail_(te)) fail('VALIDATION', 'بريد المدرب غير صالح.'); patch.trainerEmail = te; }
  if (p.scheduledAt !== undefined) { var d = p.scheduledAt ? new Date(p.scheduledAt) : null; if (d && isNaN(d.getTime())) fail('VALIDATION', 'موعد الورشة غير صالح.'); patch.scheduledAt = d ? d.toISOString() : ''; }
  if (p.durationMin !== undefined) patch.durationMin = Math.max(0, parseInt(p.durationMin, 10) || 0);
  if (p.location !== undefined) patch.location = cleanText_(p.location, 200);
  return patch;
}

function wsCreate_(user, p) {
  if (!p.title || cleanText_(p.title, 200).length < 3) fail('VALIDATION', 'يُرجى إدخال عنوان الورشة.');
  var content = sanitizeContent_(p.content || { modules: [], finalQuiz: { questions: [] } });
  var source = ['manual', 'ai', 'ai-manual', 'seed', 'import'].indexOf(p.source) === -1 ? 'manual' : p.source;
  return withLock_(function () {
    var id = newId_('ws');
    var meta = wsMetaPatch_(p);
    var w = Object.assign({
      id: id, title: '', description: '', audience: 'المعلمون والكادر المدرسي', category: 'عام', targetDepartments: '[]',
      passScore: getSettings_().defaultPassScore || 80, status: WS_STATUS.DRAFT, currentVersion: '', trainerName: '', trainerEmail: '',
      scheduledAt: '', durationMin: 0, location: '', createdBy: user ? user.id : 'system', createdAt: nowIso_(), updatedAt: nowIso_(),
      publishedAt: '', notifiedAt: '', trainerThankedAt: '', moduleCount: content.modules.length, source: source
    }, meta);
    var v = saveVersion_(user, id, content, 1);
    w.currentVersion = v.id;
    insertRow_(SHEETS.WORKSHOPS, w);
    audit_(user, 'ws_create', id, { title: w.title, source: w.source });
    return { workshop: wsPublic_(w), content: content };
  });
}

function wsSaveDraft_(user, p) {
  var w0 = findById_(SHEETS.WORKSHOPS, p.id);
  if (!w0) fail('NOT_FOUND', 'الورشة غير موجودة.');
  if (w0.status === WS_STATUS.ARCHIVED) fail('STATE', 'لا يمكن تعديل ورشة مؤرشفة. أعد تفعيلها أولًا.');
  var patch = wsMetaPatch_(p);
  return withLock_(function () {
    var w = findById_(SHEETS.WORKSHOPS, p.id);
    patch.updatedAt = nowIso_();
    var content = null, newVersion = false;
    if (p.content) {
      content = sanitizeContent_(p.content);
      patch.moduleCount = content.modules.length;
      var cur = currentContent_(w);
      var changed = JSON.stringify(cur) !== JSON.stringify(content);
      if (changed) {
        var hasAttempts = readTable_(SHEETS.ATTEMPTS).some(function (a) { return a.versionId === w.currentVersion; });
        var versions = readTable_(SHEETS.VERSIONS).filter(function (v) { return v.workshopId === w.id; });
        var curV = versions.filter(function (v) { return v.id === w.currentVersion; })[0];
        if (hasAttempts || !curV || w.status === WS_STATUS.PUBLISHED) {
          // إصدار جديد حتى لا تتغير محاولات مرتبطة بإصدار سابق
          var maxNo = versions.reduce(function (m, v) { return Math.max(m, Number(v.version) || 0); }, 0);
          var nv = saveVersion_(user, w.id, content, maxNo + 1);
          patch.currentVersion = nv.id;
          newVersion = true;
        } else {
          updateRowAt_(SHEETS.VERSIONS, curV, Object.assign({ checksum: sha256Hex_(JSON.stringify(content)).substr(0, 16), createdAt: nowIso_() }, packChunks_(content, 'c', 10)));
        }
      }
    }
    updateRowAt_(SHEETS.WORKSHOPS, w, patch);
    audit_(user, 'ws_save', w.id, { fields: Object.keys(patch), newVersion: newVersion });
    return { workshop: wsPublic_(w), content: content || currentContent_(w), newVersion: newVersion };
  });
}

function wsSetStatus_(user, p) {
  var w = findById_(SHEETS.WORKSHOPS, p.id);
  if (!w) fail('NOT_FOUND', 'الورشة غير موجودة.');
  var target = String(p.status || '');
  if ([WS_STATUS.DRAFT, WS_STATUS.PUBLISHED, WS_STATUS.UNPUBLISHED, WS_STATUS.ARCHIVED].indexOf(target) === -1) fail('VALIDATION', 'حالة غير صالحة.');
  var patch = { status: target, updatedAt: nowIso_() };
  var notify = null;
  if (target === WS_STATUS.PUBLISHED) {
    var issues = wsValidateContent_(currentContent_(w), w.passScore);
    if (issues.length) fail('INVALID_CONTENT', 'لا يمكن النشر قبل معالجة المشكلات التالية.', { issues: issues });
    if (!w.publishedAt) patch.publishedAt = nowIso_();
  }
  updateRowAt_(SHEETS.WORKSHOPS, w, patch);
  audit_(user, 'ws_status', w.id, { status: target });
  if (target === WS_STATUS.PUBLISHED && p.notify !== false && !w.notifiedAt) {
    try { notify = wsNotifyStaff_(user, { id: w.id }); } catch (e) { notify = { error: e.message }; }
  }
  return { workshop: wsPublic_(w), notify: notify };
}

/** الحذف النهائي: يُعيد الأثر أولًا، ولا ينفّذ إلا مع confirm=true. النتائج والشهادات تبقى (تحمل نسخة بيانات مستقلة). */
function wsDeleteForever_(user, p) {
  var w = findById_(SHEETS.WORKSHOPS, p.id);
  if (!w) fail('NOT_FOUND', 'الورشة غير موجودة.');
  var impact = {
    attempts: readTable_(SHEETS.ATTEMPTS).filter(function (a) { return a.workshopId === w.id; }).length,
    results: readTable_(SHEETS.RESULTS).filter(function (r) { return r.workshopId === w.id; }).length,
    certificates: readTable_(SHEETS.CERTIFICATES).filter(function (c) { return c.workshopId === w.id; }).length,
    progress: readTable_(SHEETS.PROGRESS).filter(function (r) { return r.workshopId === w.id; }).length
  };
  if (!p.confirm) return { impact: impact, title: w.title, confirmRequired: true };
  if (w.status !== WS_STATUS.ARCHIVED) fail('STATE', 'يجب أرشفة الورشة أولًا قبل حذفها نهائيًا.');
  withLock_(function () {
    deleteRowsWhere_(SHEETS.VERSIONS, function (v) { return v.workshopId === w.id; });
    deleteRowsWhere_(SHEETS.PROGRESS, function (v) { return v.workshopId === w.id; });
    deleteRowsWhere_(SHEETS.AIJOBS, function (v) { return v.workshopId === w.id; });
    deleteRowById_(SHEETS.WORKSHOPS, w.id);
  });
  audit_(user, 'ws_delete', w.id, { title: w.title, impact: impact });
  return { deleted: true, kept: { results: impact.results, certificates: impact.certificates } };
}

/** إشعار الموظفين المعنيين بموعد الورشة (بحسب الأقسام المستهدفة أو الجميع) — ما يتجاوز حد الدفعة يُوضع في قائمة انتظار البريد */
function wsNotifyStaff_(user, p) {
  var w = findById_(SHEETS.WORKSHOPS, p.id);
  if (!w) fail('NOT_FOUND', 'الورشة غير موجودة.');
  if (w.status !== WS_STATUS.PUBLISHED) fail('STATE', 'يجب نشر الورشة قبل إرسال الإشعارات.');
  var targets = parseJson_(w.targetDepartments, []);
  var users = readTable_(SHEETS.USERS).filter(function (u) {
    return u.status === USER_STATUS.ACTIVE && (!targets.length || targets.indexOf(u.department) !== -1);
  });
  var res = sendWorkshopAnnouncement_(w, users, !!p.resend);
  updateRowAt_(SHEETS.WORKSHOPS, w, { notifiedAt: nowIso_() });
  audit_(user, 'ws_notify', w.id, res);
  return res;
}

/* ---------- المتدرب ---------- */
function progressFor_(userId, workshopId) {
  return findOne_(SHEETS.PROGRESS, function (p) { return p.userId === userId && p.workshopId === workshopId; });
}
function progressSummary_(w, prog, result) {
  var modCount = Number(w.moduleCount) || 0;
  var done = prog ? parseJson_(prog.modulesDone, []) : [];
  var passed = result && truthy_(result.passed);
  var pct = modCount ? Math.round((done.length / (modCount + 1)) * 100) : 0;
  if (passed) pct = 100;
  return {
    started: !!prog, modulesDone: done, acknowledged: prog ? parseJson_(prog.acknowledged, []) : [],
    lastModule: prog ? Number(prog.lastModule) || 0 : 0, percent: pct,
    allModulesDone: modCount > 0 && done.length >= modCount,
    passed: !!passed, bestPercent: result ? Number(result.bestPercent) || 0 : null,
    lastPercent: result ? Number(result.lastPercent) || 0 : null, attemptCount: result ? Number(result.attemptCount) || 0 : 0,
    certificateId: result ? result.certificateId : '', completedAt: prog ? prog.completedAt : ''
  };
}

function wsListForTrainee_(user) {
  var progress = readTable_(SHEETS.PROGRESS).filter(function (p) { return p.userId === user.id; });
  var results = readTable_(SHEETS.RESULTS).filter(function (r) { return r.userId === user.id; });
  var list = readTable_(SHEETS.WORKSHOPS).filter(function (w) { return w.status === WS_STATUS.PUBLISHED; }).map(function (w) {
    var o = wsPublic_(w);
    delete o.trainerEmail;
    var prog = progress.filter(function (p) { return p.workshopId === w.id; })[0];
    var res = results.filter(function (r) { return r.workshopId === w.id; })[0];
    o.progress = progressSummary_(w, prog, res);
    return o;
  }).sort(function (a, b) { return String(b.publishedAt || b.updatedAt).localeCompare(String(a.publishedAt || a.updatedAt)); });
  var certs = readTable_(SHEETS.CERTIFICATES).filter(function (c) { return c.userId === user.id && c.kind === 'trainee' && !c.revokedAt; }).length;
  return { workshops: list, certificates: certs };
}

/** محتوى الورشة للمتدرب — بدون مفاتيح الإجابات وبدون أسئلة */
function wsGetForTrainee_(user, id) {
  var w = findById_(SHEETS.WORKSHOPS, id);
  if (!w || w.status !== WS_STATUS.PUBLISHED) fail('NOT_FOUND', 'الورشة غير متاحة.');
  var content = currentContent_(w);
  if (!content) fail('NOT_FOUND', 'محتوى الورشة غير متاح.');
  var safe = {
    objectives: content.objectives,
    modules: content.modules.map(function (m) {
      return { title: m.title, summary: m.summary, objectives: m.objectives, sections: m.sections, resources: m.resources, questionCount: (m.questions || []).length };
    }),
    finalQuestionCount: (content.finalQuiz.questions || []).length
  };
  var prog = progressFor_(user.id, id);
  if (!prog) {
    prog = insertRow_(SHEETS.PROGRESS, {
      id: newId_('prg'), userId: user.id, workshopId: id, versionId: w.currentVersion, modulesDone: '[]', acknowledged: '[]',
      lastModule: 0, percent: 0, startedAt: nowIso_(), completedAt: '', updatedAt: nowIso_()
    });
  }
  var result = findOne_(SHEETS.RESULTS, function (r) { return r.userId === user.id && r.workshopId === id; });
  var o = wsPublic_(w); delete o.trainerEmail;
  var s = getSettings_();
  return { workshop: o, content: safe, progress: progressSummary_(w, prog, result), policy: { retryPolicy: s.retryPolicy, maxAttempts: s.maxAttempts, retryCooldownMin: s.retryCooldownMin, showCorrectAnswers: s.showCorrectAnswers } };
}

/** إقرار المتدرب بقراءة الوحدة (لا يُعدّ إثباتًا للفهم؛ الاختبار المرحلي هو شرط الإكمال) */
function progressAcknowledge_(user, p) {
  var w = findById_(SHEETS.WORKSHOPS, p.workshopId);
  if (!w || w.status !== WS_STATUS.PUBLISHED) fail('NOT_FOUND', 'الورشة غير متاحة.');
  var idx = parseInt(p.moduleIndex, 10);
  if (!(idx >= 0 && idx < (Number(w.moduleCount) || 0))) fail('VALIDATION', 'وحدة غير صالحة.');
  var prog = progressFor_(user.id, w.id);
  if (!prog) fail('STATE', 'ابدأ الورشة أولًا.');
  var ack = parseJson_(prog.acknowledged, []);
  if (ack.indexOf(idx) === -1) ack.push(idx);
  updateRowAt_(SHEETS.PROGRESS, prog, { acknowledged: JSON.stringify(ack), lastModule: idx, updatedAt: nowIso_() });
  var result = findOne_(SHEETS.RESULTS, function (r) { return r.userId === user.id && r.workshopId === w.id; });
  return { progress: progressSummary_(w, prog, result) };
}


/* ######################## Quizzes.gs ######################## */

/**
 * Quizzes.gs — الاختبارات المرحلية والنهائية (التقييم على الخادم فقط)
 * ------------------------------------------------------------
 * - المتصفح يستلم الأسئلة بدون مفتاح الإجابة، ويرسل عند التسليم: معرّف المحاولة + إجاباته فقط.
 *   أي حقول أخرى (score/percent/passed) تُتجاهل تمامًا.
 * - المحاولة مرتبطة بإصدار محدد من المحتوى (versionId) وبترتيب عشوائي محفوظ على الخادم.
 * - التسليم المتكرر لنفس المحاولة لا يُنشئ نتيجة جديدة (idempotent)، ولا يُصدر شهادة إضافية.
 * - إصدار الشهادة يتم داخل القفل (سجل فقط)؛ إرسال البريد يتم بعد تحرير القفل حتى لا يُعطّل بقية الطلبات،
 *   وفشل البريد لا يُفشل النجاح.
 */

function shuffleIdx_(n) {
  var a = []; for (var i = 0; i < n; i++) a.push(i);
  for (var j = a.length - 1; j > 0; j--) { var k = Math.floor(Math.random() * (j + 1)); var t = a[j]; a[j] = a[k]; a[k] = t; }
  return a;
}

function quizQuestions_(content, kind, moduleIndex) {
  if (kind === 'final') return (content.finalQuiz && content.finalQuiz.questions) || [];
  var m = content.modules[moduleIndex];
  return m ? (m.questions || []) : [];
}

function attemptsFor_(userId, workshopId, versionId, kind, moduleIndex) {
  return readTable_(SHEETS.ATTEMPTS).filter(function (a) {
    return a.userId === userId && a.workshopId === workshopId && a.versionId === versionId && a.kind === kind &&
      (kind === 'final' || Number(a.moduleIndex) === moduleIndex);
  });
}

function checkRetryPolicy_(submitted) {
  var s = getSettings_();
  var info = { attemptCount: submitted.length, remaining: null };
  if (s.retryPolicy === 'limited') {
    var max = Number(s.maxAttempts) || 3;
    info.remaining = Math.max(0, max - submitted.length);
    if (submitted.length >= max) fail('NO_ATTEMPTS', 'استنفدت عدد المحاولات المسموح لهذا الاختبار (' + max + ').');
  }
  var cd = Number(s.retryCooldownMin) || 0;
  if (cd > 0 && submitted.length) {
    var last = submitted.map(function (a) { return new Date(a.submittedAt).getTime(); }).sort(function (x, y) { return x - y; }).pop();
    var wait = last + cd * 60000 - Date.now();
    if (wait > 0) fail('COOLDOWN', 'يمكنك إعادة المحاولة بعد ' + Math.ceil(wait / 60000) + ' دقيقة.');
  }
  return info;
}

function quizStart_(user, p) {
  var w = findById_(SHEETS.WORKSHOPS, p.workshopId);
  if (!w || w.status !== WS_STATUS.PUBLISHED) fail('NOT_FOUND', 'الورشة غير متاحة.');
  var kind = p.kind === 'final' ? 'final' : 'module';
  var moduleIndex = kind === 'module' ? parseInt(p.moduleIndex, 10) : -1;
  var content = currentContent_(w);
  if (!content) fail('NOT_FOUND', 'محتوى الورشة غير متاح.');
  if (kind === 'module' && !(moduleIndex >= 0 && moduleIndex < content.modules.length)) fail('VALIDATION', 'وحدة غير صالحة.');
  var prog = progressFor_(user.id, w.id);
  if (!prog) fail('STATE', 'افتح الورشة أولًا قبل بدء الاختبار.');
  if (kind === 'final') {
    var done = parseJson_(prog.modulesDone, []);
    var missing = [];
    for (var i = 0; i < content.modules.length; i++) if (done.indexOf(i) === -1) missing.push(i + 1);
    if (missing.length) fail('NOT_ELIGIBLE', 'لا يمكن فتح الاختبار النهائي قبل اجتياز اختبارات جميع الوحدات. الوحدات المتبقية: ' + missing.join('، '));
    var res = findOne_(SHEETS.RESULTS, function (r) { return r.userId === user.id && r.workshopId === w.id; });
    if (res && truthy_(res.passed)) fail('ALREADY_PASSED', 'لقد اجتزت هذه الورشة بالفعل.');
  }
  var qs = quizQuestions_(content, kind, moduleIndex);
  if (!qs.length) fail('NOT_FOUND', 'لا توجد أسئلة لهذا الاختبار.');

  return withLock_(function () {
    var all = attemptsFor_(user.id, w.id, w.currentVersion, kind, moduleIndex);
    var open = all.filter(function (a) { return a.status === 'open'; })[0];
    var submitted = all.filter(function (a) { return a.status === 'submitted'; });
    var policy = checkRetryPolicy_(submitted);
    var s = getSettings_();
    var map;
    if (open) {
      map = parseJson_(open.answers, null);
      if (!map || !map.q || map.q.length !== qs.length) open = null;
    }
    if (!open) {
      map = {
        q: s.shuffleQuestions ? shuffleIdx_(qs.length) : shuffleIdx_(qs.length).sort(function (a, b) { return a - b; }),
        o: qs.map(function () { return s.shuffleOptions ? shuffleIdx_(4) : [0, 1, 2, 3]; })
      };
      open = insertRow_(SHEETS.ATTEMPTS, {
        id: newId_('att'), userId: user.id, workshopId: w.id, versionId: w.currentVersion, kind: kind, moduleIndex: moduleIndex,
        requestKey: '', score: '', total: qs.length, percent: '', passed: '', answers: JSON.stringify(map),
        startedAt: nowIso_(), submittedAt: '', status: 'open'
      });
    }
    // بناء الأسئلة المعروضة بحسب الترتيب المحفوظ — بدون مفتاح الإجابة ولا التوضيح
    var display = map.q.map(function (qi, di) {
      var q = qs[qi];
      return { n: di + 1, text: q.text, options: map.o[qi].map(function (oi) { return q.options[oi]; }) };
    });
    return {
      attemptId: open.id, kind: kind, moduleIndex: moduleIndex, questions: display, total: qs.length,
      passScore: Number(w.passScore) || 80, attemptCount: policy.attemptCount, remaining: policy.remaining,
      title: kind === 'final' ? 'الاختبار النهائي' : 'اختبار الوحدة ' + (moduleIndex + 1) + ': ' + content.modules[moduleIndex].title
    };
  });
}

function quizSubmit_(user, p) {
  var att0 = findById_(SHEETS.ATTEMPTS, String(p.attemptId || ''));
  if (!att0 || att0.userId !== user.id) fail('NOT_FOUND', 'المحاولة غير موجودة.');
  var given = Array.isArray(p.answers) ? p.answers : [];
  var pendingMail = null; // {certId} يُرسل بعد تحرير القفل
  var out = withLock_(function () {
    var att = findById_(SHEETS.ATTEMPTS, att0.id); // إعادة القراءة داخل القفل
    if (!att) fail('NOT_FOUND', 'المحاولة غير موجودة.');
    if (att.status === 'submitted') return buildFeedback_(user, att, true);
    var content = versionContent_(att.versionId);
    if (!content) fail('NOT_FOUND', 'إصدار المحتوى المرتبط بهذه المحاولة غير متاح.');
    var w = findById_(SHEETS.WORKSHOPS, att.workshopId);
    if (!w) fail('NOT_FOUND', 'الورشة غير موجودة.');
    var kind = att.kind, moduleIndex = Number(att.moduleIndex);
    var qs = quizQuestions_(content, kind, moduleIndex);
    var map = parseJson_(att.answers, null);
    if (!map || !map.q) fail('STATE', 'بيانات المحاولة تالفة. ابدأ محاولة جديدة.');
    // التصحيح: يُحوَّل اختيار المستخدم (بحسب الترتيب المعروض) إلى المؤشر الأصلي ثم يُقارن بمفتاح الإجابة
    var score = 0, detail = [];
    map.q.forEach(function (qi, di) {
      var q = qs[qi];
      var chosenDisplay = given[di];
      var cd = (chosenDisplay === null || chosenDisplay === undefined || chosenDisplay === '') ? NaN : parseInt(chosenDisplay, 10);
      var chosenOrig = (cd >= 0 && cd <= 3) ? map.o[qi][cd] : null;
      if (chosenOrig === undefined) chosenOrig = null;
      var correct = chosenOrig !== null && chosenOrig === Number(q.answer);
      if (correct) score++;
      detail.push({ qi: qi, chosen: chosenOrig, correct: correct });
    });
    var total = qs.length;
    var percent = total ? Math.round((score / total) * 1000) / 10 : 0;
    var passScore = Number(w.passScore) || 80;
    var passed = percent >= passScore;
    updateRowAt_(SHEETS.ATTEMPTS, att, {
      requestKey: cleanText_(p.requestKey, 64), score: score, total: total, percent: percent, passed: passed ? 'TRUE' : 'FALSE',
      answers: JSON.stringify({ q: map.q, o: map.o, given: detail.map(function (d) { return d.chosen; }) }),
      submittedAt: nowIso_(), status: 'submitted'
    });
    var prog = progressFor_(user.id, w.id);
    var side = {};
    if (kind === 'module') {
      if (passed && prog) {
        var done = parseJson_(prog.modulesDone, []);
        if (done.indexOf(moduleIndex) === -1) done.push(moduleIndex);
        var modCount = Number(w.moduleCount) || content.modules.length;
        updateRowAt_(SHEETS.PROGRESS, prog, { modulesDone: JSON.stringify(done), lastModule: moduleIndex, percent: Math.round(done.length / (modCount + 1) * 100), updatedAt: nowIso_() });
      }
    } else {
      var res = findOne_(SHEETS.RESULTS, function (r) { return r.userId === user.id && r.workshopId === w.id; });
      var wasPassed = res && truthy_(res.passed);
      var patch = {
        lastPercent: percent, attemptCount: (res ? Number(res.attemptCount) || 0 : 0) + 1,
        bestPercent: Math.max(percent, res ? Number(res.bestPercent) || 0 : 0), updatedAt: nowIso_()
      };
      if (passed && !wasPassed) { patch.passed = 'TRUE'; patch.passedAt = nowIso_(); patch.versionId = att.versionId; }
      if (res) res = updateRowAt_(SHEETS.RESULTS, res, patch);
      else res = insertRow_(SHEETS.RESULTS, Object.assign({ id: newId_('res'), userId: user.id, workshopId: w.id, versionId: att.versionId, passed: passed ? 'TRUE' : 'FALSE', passedAt: passed ? nowIso_() : '', certificateId: '' }, patch));
      if (passed && !wasPassed) {
        if (prog) updateRowAt_(SHEETS.PROGRESS, prog, { completedAt: nowIso_(), percent: 100, updatedAt: nowIso_() });
        // إصدار سجل الشهادة داخل القفل (منع الازدواج)؛ البريد لاحقًا خارج القفل
        try {
          var cert = certIssueTrainee_(user, w, res);
          side.certificateId = cert.id;
          if (!cert.duplicate) pendingMail = { certId: cert.id, trainerWorkshop: (!w.trainerThankedAt && w.trainerEmail) ? w.id : '' };
        } catch (e) { side.certificateError = 'تم تسجيل اجتيازك، لكن تعذر إصدار الشهادة آليًا. ستتم معالجة ذلك من الإدارة.'; console.error('cert issue: ' + e.message); }
      }
    }
    att = findById_(SHEETS.ATTEMPTS, att.id);
    var fb = buildFeedback_(user, att, false);
    fb.side = side;
    return fb;
  });
  if (pendingMail) {
    try { out.side.mail = certSendAll_(pendingMail.certId); } catch (e2) { out.side.mail = { trainee: { ok: false, error: 'تعذر الإرسال' } }; console.error('cert mail: ' + e2.message); }
    if (pendingMail.trainerWorkshop) { try { certIssueTrainer_(null, pendingMail.trainerWorkshop, false); } catch (e3) { console.error('trainer cert: ' + e3.message); } }
  }
  return out;
}

/** التغذية الراجعة بحسب سياسة العرض (never | afterPass | always) */
function buildFeedback_(user, att, duplicate) {
  var s = getSettings_();
  var content = versionContent_(att.versionId) || { modules: [], finalQuiz: { questions: [] } };
  var qs = quizQuestions_(content, att.kind, Number(att.moduleIndex));
  var map = parseJson_(att.answers, {}) || {};
  var passed = truthy_(att.passed);
  var show = s.showCorrectAnswers === 'always' || (s.showCorrectAnswers === 'afterPass' && passed);
  var review = [];
  if (map.q && map.o) {
    map.q.forEach(function (qi, di) {
      var q = qs[qi] || { options: [], answer: 0 };
      var chosenOrig = (map.given || [])[di];
      var item = { n: di + 1, text: q.text, chosen: chosenOrig === null || chosenOrig === undefined ? null : map.o[qi].indexOf(chosenOrig), correct: chosenOrig === Number(q.answer) };
      if (show) { item.answer = map.o[qi].indexOf(Number(q.answer)); item.explanation = q.explanation || ''; item.options = map.o[qi].map(function (oi) { return q.options[oi]; }); }
      review.push(item);
    });
  }
  var w = findById_(SHEETS.WORKSHOPS, att.workshopId);
  var prog = progressFor_(user.id, att.workshopId);
  var res = findOne_(SHEETS.RESULTS, function (r) { return r.userId === user.id && r.workshopId === att.workshopId; });
  return {
    attemptId: att.id, kind: att.kind, moduleIndex: Number(att.moduleIndex), score: Number(att.score), total: Number(att.total),
    percent: Number(att.percent), passed: passed, passScore: w ? Number(w.passScore) : 80, duplicate: !!duplicate,
    submittedAt: att.submittedAt, review: review, showAnswers: show,
    progress: w ? progressSummary_(w, prog, res) : null,
    side: duplicate && res && res.certificateId ? { certificateId: res.certificateId } : {}
  };
}

function quizHistory_(user, p) {
  var w = findById_(SHEETS.WORKSHOPS, p.workshopId);
  if (!w) fail('NOT_FOUND', 'الورشة غير موجودة.');
  var list = readTable_(SHEETS.ATTEMPTS).filter(function (a) { return a.userId === user.id && a.workshopId === w.id && a.status === 'submitted'; })
    .map(function (a) { return { id: a.id, kind: a.kind, moduleIndex: Number(a.moduleIndex), score: Number(a.score), total: Number(a.total), percent: Number(a.percent), passed: truthy_(a.passed), submittedAt: a.submittedAt, currentVersion: a.versionId === w.currentVersion }; })
    .sort(function (a, b) { return String(b.submittedAt).localeCompare(String(a.submittedAt)); });
  var res = findOne_(SHEETS.RESULTS, function (r) { return r.userId === user.id && r.workshopId === w.id; });
  return { attempts: list, result: res ? { bestPercent: Number(res.bestPercent), lastPercent: Number(res.lastPercent), attemptCount: Number(res.attemptCount), passed: truthy_(res.passed), passedAt: res.passedAt, certificateId: res.certificateId } : null };
}


/* ######################## Certificates.gs ######################## */

/**
 * Certificates.gs — الشهادات (إصدار، نسخة بيانات ثابتة، PDF، QR للتحقق، إرسال)
 * ------------------------------------------------------------
 * - تُصدر الشهادة من نتيجة معتمدة على الخادم فقط (Results.passed = TRUE) أو للمدرب من بيانات الورشة.
 * - تُحفظ نسخة بيانات (snapshot) للشهادة + القالب وقت الإصدار؛ تعديل الاسم أو القالب لاحقًا لا يغيّر الشهادات السابقة.
 * - رمز التحقق عشوائي غير قابل للتخمين (96 بت)، ويُخزن مجزّأً للبحث.
 * - الرقم التسلسلي IKP-YYYY-NNNN يُشتق من أعلى رقم موجود للسنة نفسها (لا يعتمد على عدد الصفوف).
 * - ملف PDF يُولَّد مرة واحدة ويُحفظ في Drive ويُعاد استخدامه (المحتوى ثابت بثبات النسخة).
 */

/* ---------- الإصدار ---------- */
function nextSerial_(existingRows) {
  var year = Utilities.formatDate(new Date(), APP.TIMEZONE, 'yyyy');
  var prefix = 'IKP-' + year + '-';
  var rows = existingRows || readTable_(SHEETS.CERTIFICATES);
  var max = 0;
  rows.forEach(function (c) {
    var s = String(c.serial || '');
    if (s.indexOf(prefix) === 0) { var n = parseInt(s.substr(prefix.length), 10); if (n > max) max = n; }
  });
  return prefix + ('0000' + (max + 1)).slice(-4);
}
function certSnapshot_(kind, name, email, w, extra) {
  var s = getSettings_();
  var t = s.certificate;
  var code = randomToken_(16).substr(0, 24);
  return {
    code: code, kind: kind, name: name, email: email, workshopTitle: w.title, workshopId: w.id,
    trainerName: w.trainerName || '', scheduledAt: w.scheduledAt || '', percent: extra.percent === undefined ? null : extra.percent,
    passedAt: extra.passedAt || '', issuedAt: nowIso_(), serial: '',
    template: {
      title: kind === 'trainer' ? t.trainerTitle : t.title,
      intro: kind === 'trainer' ? t.trainerBody : t.intro,
      body: kind === 'trainer' ? '' : t.body,
      outro: kind === 'trainer' ? t.trainerOutro : t.outro,
      showScore: kind === 'trainer' ? false : !!t.showScore,
      signers: (t.signers || []).filter(function (x) { return x && x.name; }),
      stampImageId: t.stampImageId || '', headerImageId: t.headerImageId || '', footerImageId: t.footerImageId || '', accent: t.accent || '#7b1a2e'
    }
  };
}

/**
 * إصدار شهادة إتمام للمتدرب من نتيجة معتمدة. يُستدعى داخل قفل من quizSubmit_.
 * لا يُرسل البريد (يتولاه المستدعي بعد تحرير القفل عبر certSendAll_).
 */
function certIssueTrainee_(user, w, res) {
  if (!truthy_(res.passed)) fail('STATE', 'لا يمكن إصدار شهادة دون نتيجة اجتياز معتمدة.');
  var certs = readTable_(SHEETS.CERTIFICATES);
  // منع الازدواج
  if (res.certificateId) { var ex = certs.filter(function (c) { return c.id === res.certificateId; })[0]; if (ex) return { id: ex.id, duplicate: true }; }
  var dupe = certs.filter(function (c) { return c.userId === user.id && c.workshopId === w.id && c.kind === 'trainee' && !c.revokedAt; })[0];
  if (dupe) { updateRowAt_(SHEETS.RESULTS, res, { certificateId: dupe.id }); return { id: dupe.id, duplicate: true }; }
  var snap = certSnapshot_('trainee', user.name, user.email, w, { percent: Number(res.bestPercent), passedAt: res.passedAt });
  snap.serial = nextSerial_(certs);
  var rec = Object.assign({
    id: newId_('crt'), serial: snap.serial, verifyHash: sha256Hex_('cert:' + snap.code), userId: user.id, workshopId: w.id, resultId: res.id,
    kind: 'trainee', issuedAt: snap.issuedAt, pdfFileId: '', mailStatus: '{}', revokedAt: ''
  }, packChunks_(snap, 's', 4));
  insertRow_(SHEETS.CERTIFICATES, rec);
  updateRowAt_(SHEETS.RESULTS, res, { certificateId: rec.id });
  audit_(user, 'cert_issue', rec.id, { serial: snap.serial, workshop: w.title });
  return { id: rec.id, duplicate: false };
}

/** شهادة شكر للمدرب — مرة واحدة لكل ورشة (force من الإدارة لإعادة الإرسال) */
function certIssueTrainer_(user, workshopId, force) {
  var w = findById_(SHEETS.WORKSHOPS, workshopId);
  if (!w) fail('NOT_FOUND', 'الورشة غير موجودة.');
  if (!w.trainerName || !w.trainerEmail) fail('VALIDATION', 'لم يتم تحديد اسم المدرب وبريده في بيانات الورشة.');
  var rec = withLock_(function () {
    var certs = readTable_(SHEETS.CERTIFICATES);
    var existing = certs.filter(function (c) { return c.workshopId === w.id && c.kind === 'trainer' && !c.revokedAt; })[0];
    if (existing) return { rec: existing, existed: true };
    var snap = certSnapshot_('trainer', w.trainerName, w.trainerEmail, w, {});
    snap.serial = nextSerial_(certs);
    var r = Object.assign({
      id: newId_('crt'), serial: snap.serial, verifyHash: sha256Hex_('cert:' + snap.code), userId: '', workshopId: w.id, resultId: '',
      kind: 'trainer', issuedAt: snap.issuedAt, pdfFileId: '', mailStatus: '{}', revokedAt: ''
    }, packChunks_(snap, 's', 4));
    insertRow_(SHEETS.CERTIFICATES, r);
    updateRowAt_(SHEETS.WORKSHOPS, w, { trainerThankedAt: nowIso_() });
    audit_(user, 'cert_trainer', r.id, { serial: snap.serial, trainer: w.trainerName });
    return { rec: r, existed: false };
  });
  if (rec.existed && !force) return { id: rec.rec.id, duplicate: true };
  var st = certSendOne_(rec.rec.id, 'cert_trainer', !!force);
  return { id: rec.rec.id, sent: st.ok, resent: rec.existed && st.ok, error: st.error, duplicate: rec.existed };
}

/* ---------- الإرسال ---------- */
/** إرسال شهادة المتدرب ونسخة للإدارة — ملف PDF واحد للمستلمَين، وحالة مستقلة لكل مستلم */
function certSendAll_(certId, force) {
  var c = findById_(SHEETS.CERTIFICATES, certId);
  if (!c) return { trainee: { ok: false, error: 'الشهادة غير موجودة' } };
  var snap = unpackChunks_(c, 's', 4);
  var pdf = null;
  try { pdf = certPdfBlob_(c, snap); } catch (e) { console.error('pdf: ' + e.message); }
  var st = {};
  st.trainee = certSendOne_(certId, 'cert_trainee', !!force, pdf);
  st.admin = certSendOne_(certId, 'cert_admin', !!force, pdf);
  return st;
}
/** إرسال شهادة لمستلم محدد بحسب النوع، مع تحديث حالة الإرسال المستقلة في سجل الشهادة */
function certSendOne_(certId, kind, force, pdfBlob) {
  var c = findById_(SHEETS.CERTIFICATES, certId);
  if (!c) return { ok: false, error: 'الشهادة غير موجودة' };
  var snap = unpackChunks_(c, 's', 4);
  var s = getSettings_();
  var to, subject, html, who;
  if (kind === 'cert_trainee') {
    who = 'trainee'; to = snap.email; subject = 'تهانينا! شهادة إتمام ورشة: ' + snap.workshopTitle;
    html = mailFrame_('اجتياز الورشة بنجاح', '<p>عزيزي/عزيزتي ' + htmlEscape_(snap.name) + '،</p><p>نبارك لك اجتياز الورشة التدريبية <b>«' + htmlEscape_(snap.workshopTitle) + '»</b>' + (snap.percent !== null ? ' بنسبة <b dir="ltr">' + htmlEscape_(snap.percent) + '%</b>' : '') + '.</p><p>تجد شهادة الإتمام مرفقة بهذه الرسالة، ويمكنك أيضًا تنزيلها من قسم «شهاداتي» في المنصة.</p><p>رقم الشهادة: <span dir="ltr">' + htmlEscape_(snap.serial) + '</span></p>');
  } else if (kind === 'cert_admin') {
    who = 'admin'; to = s.adminNotifyEmail; subject = 'إشعار اجتياز: ' + snap.name + ' — ' + snap.workshopTitle;
    html = mailFrame_('إشعار اجتياز ورشة', '<p>اجتاز الموظف <b>' + htmlEscape_(snap.name) + '</b> (<span dir="ltr">' + htmlEscape_(snap.email) + '</span>) الورشة التدريبية <b>«' + htmlEscape_(snap.workshopTitle) + '»</b>' + (snap.percent !== null ? ' بنسبة <b dir="ltr">' + htmlEscape_(snap.percent) + '%</b>' : '') + '.</p><p>نسخة من شهادة الإتمام مرفقة. رقم الشهادة: <span dir="ltr">' + htmlEscape_(snap.serial) + '</span></p>');
    if (!to) { certMarkMail_(c, 'admin', { ok: false, error: 'لم يُضبط البريد الإداري في الإعدادات' }); return { ok: false, error: 'لم يُضبط البريد الإداري' }; }
  } else if (kind === 'cert_trainer') {
    who = 'trainer'; to = snap.email; subject = 'شكر وتقدير — تقديم ورشة: ' + snap.workshopTitle;
    html = mailFrame_('شكر وتقدير', '<p>الأستاذ/ة الفاضل/ة ' + htmlEscape_(snap.name) + '،</p><p>تتقدم إدارة ' + htmlEscape_(APP.SCHOOL) + ' بخالص الشكر والتقدير لتقديمكم الورشة التدريبية <b>«' + htmlEscape_(snap.workshopTitle) + '»</b> ضمن برنامج التطوير المهني، ولما بذلتموه من جهد في إثراء خبرات الزملاء.</p><p>مرفق شهادة شكر وتقدير.</p>');
  } else return { ok: false, error: 'نوع غير معروف' };
  var attachments = [];
  if (!pdfBlob) { try { pdfBlob = certPdfBlob_(c, snap); } catch (e) { console.error('pdf: ' + e.message); } }
  if (pdfBlob) attachments.push(pdfBlob);
  var r = sendMail_({ kind: kind, to: to, refKey: kind + ':' + c.id, force: !!force, subject: subject, html: html, attachments: attachments, payloadRef: c.id });
  certMarkMail_(c, who, r);
  return r;
}
function certMarkMail_(c, who, r) {
  var ms = parseJson_(c.mailStatus, {}) || {};
  ms[who] = { status: r.ok ? 'sent' : 'failed', error: r.error || '', at: nowIso_(), skipped: !!r.skipped };
  updateRowAt_(SHEETS.CERTIFICATES, c, { mailStatus: JSON.stringify(ms) });
}

function certResendMail_(user, id) {
  var c = findById_(SHEETS.CERTIFICATES, id);
  if (!c) fail('NOT_FOUND', 'الشهادة غير موجودة.');
  if (c.revokedAt) fail('STATE', 'الشهادة ملغاة؛ أعد تفعيلها قبل إرسالها.');
  var st = c.kind === 'trainer' ? { trainer: certSendOne_(c.id, 'cert_trainer', true) } : certSendAll_(c.id, true);
  audit_(user, 'cert_resend', id, st);
  return { mailStatus: st };
}
function certRevoke_(user, id) {
  var c = findById_(SHEETS.CERTIFICATES, id);
  if (!c) fail('NOT_FOUND', 'الشهادة غير موجودة.');
  var revoking = !c.revokedAt;
  updateRowAt_(SHEETS.CERTIFICATES, c, { revokedAt: revoking ? nowIso_() : '' });
  audit_(user, revoking ? 'cert_revoke' : 'cert_unrevoke', id, {});
  return { revoked: revoking };
}

/* ---------- الاستعلام ---------- */
function certRow_(c) {
  var snap = unpackChunks_(c, 's', 4) || {};
  return { id: c.id, serial: c.serial, kind: c.kind, name: snap.name, email: snap.email, workshopTitle: snap.workshopTitle, workshopId: c.workshopId,
    percent: snap.percent === undefined ? null : snap.percent, issuedAt: c.issuedAt, revoked: !!c.revokedAt, mailStatus: parseJson_(c.mailStatus, {}) || {}, verifyCode: snap.code };
}
function certMine_(user) {
  return { certificates: readTable_(SHEETS.CERTIFICATES).filter(function (c) { return c.userId === user.id && c.kind === 'trainee'; }).map(certRow_)
    .sort(function (a, b) { return String(b.issuedAt).localeCompare(String(a.issuedAt)); }) };
}
function certAccess_(user, id) {
  var c = findById_(SHEETS.CERTIFICATES, id);
  if (!c) fail('NOT_FOUND', 'الشهادة غير موجودة.');
  if (user.role !== ROLES.ADMIN && c.userId !== user.id) fail('FORBIDDEN', 'لا تملك صلاحية عرض هذه الشهادة.');
  return c;
}
function certGet_(user, id) {
  var c = certAccess_(user, id);
  var snap = unpackChunks_(c, 's', 4);
  return { certificate: certRow_(c), html: certRenderHtml_(snap, false), verifyUrl: certVerifyUrl_(snap.code) };
}
function certPdf_(user, id) {
  var c = certAccess_(user, id);
  var snap = unpackChunks_(c, 's', 4);
  var blob = certPdfBlob_(c, snap);
  return { fileName: blob.getName(), base64: Utilities.base64Encode(blob.getBytes()), mime: 'application/pdf' };
}
function certVerify_(code) {
  code = String(code || '').replace(/[^a-f0-9]/gi, '').substr(0, 24);
  if (code.length < 16) return { valid: false };
  var h = sha256Hex_('cert:' + code);
  var c = findOne_(SHEETS.CERTIFICATES, function (r) { return r.verifyHash === h; });
  if (!c) return { valid: false };
  var snap = unpackChunks_(c, 's', 4) || {};
  return { valid: true, name: snap.name, workshop: snap.workshopTitle, issuedAt: fmtDate_(c.issuedAt), serial: c.serial, kind: c.kind, revoked: !!c.revokedAt };
}
function certVerifyUrl_(code) {
  var base = webAppUrl_();
  return base ? base + (base.indexOf('?') === -1 ? '?' : '&') + 'verify=' + code : 'verify:' + code;
}
function adminCertList_(p) {
  var list = readTable_(SHEETS.CERTIFICATES).map(certRow_).sort(function (a, b) { return String(b.issuedAt).localeCompare(String(a.issuedAt)); });
  if (p && p.q) { var q = String(p.q).toLowerCase(); list = list.filter(function (c) { return (c.name + ' ' + c.email + ' ' + c.workshopTitle + ' ' + c.serial).toLowerCase().indexOf(q) !== -1; }); }
  if (p && p.kind) list = list.filter(function (c) { return c.kind === p.kind; });
  return { certificates: list.slice(0, 500), total: list.length };
}

/* ---------- العرض (HTML / PDF) ---------- */
function qrTable_(text, cell) {
  try {
    var qr = qrcode(0, 'M'); qr.addData(text); qr.make();
    return qr.createTableTag(cell || 3, 0);
  } catch (e) { return ''; }
}
function certRenderHtml_(snap, forPdf) {
  var t = snap.template || {};
  var esc = htmlEscape_;
  var def = defaultAssets_();
  var header = t.headerImageId ? (assetDataUrl_(t.headerImageId) || def.header) : def.header;
  var footer = t.footerImageId ? (assetDataUrl_(t.footerImageId) || def.footer) : def.footer;
  var stamp = t.stampImageId ? assetDataUrl_(t.stampImageId) : '';
  var accent = /^#[0-9a-f]{6}$/i.test(t.accent || '') ? t.accent : '#7b1a2e';
  var verifyUrl = certVerifyUrl_(snap.code);
  var signers = (t.signers || []).map(function (sg) {
    var img = sg.imageId ? assetDataUrl_(sg.imageId) : '';
    return '<div class="sig">' + (img ? '<img class="sigimg" src="' + img + '" alt="">' : '<div class="sigline"></div>') +
      '<div class="signame">' + esc(sg.name || '') + '</div><div class="sigtitle">' + esc(sg.title || '') + '</div></div>';
  }).join('');
  var nameLen = String(snap.name || '').length, wsLen = String(snap.workshopTitle || '').length;
  var nameSize = nameLen > 60 ? 16 : nameLen > 40 ? 19 : 24;      // تصغير تدريجي للأسماء الطويلة بدل اقتصاصها
  var wsSize = wsLen > 90 ? 13 : wsLen > 60 ? 15 : 17;
  var scoreLine = t.showScore && snap.percent !== null && snap.percent !== undefined ? '<div class="score">نسبة الاجتياز: <span dir="ltr">' + esc(snap.percent) + '%</span></div>' : '';
  var dateLine = snap.kind === 'trainer' ? (snap.scheduledAt ? '<div class="meta">تاريخ الورشة: <span dir="ltr">' + esc(fmtDate_(snap.scheduledAt)) + '</span></div>' : '')
    : '<div class="meta">تاريخ الاجتياز: <span dir="ltr">' + esc(fmtDate_(snap.passedAt || snap.issuedAt)) + '</span></div>';
  var css = '@page{size:A4 landscape;margin:0}' +
    '.cert{direction:rtl;width:297mm;height:210mm;box-sizing:border-box;position:relative;background:#fff;font-family:"Cairo","Noto Naskh Arabic","Amiri","Tahoma","Arial",sans-serif;color:#222;overflow:hidden;padding:0;margin:0 auto}' +
    '.cert .frame{position:absolute;inset:8mm;border:1.2mm solid ' + accent + ';border-radius:4mm}.cert .frame2{position:absolute;inset:11mm;border:.4mm solid #c9a227;border-radius:3mm}' +
    '.cert .hdr{position:absolute;top:13mm;left:16mm;right:16mm;text-align:center}.cert .hdr img{max-width:100%;max-height:30mm}' +
    '.cert .ftr{position:absolute;bottom:12mm;left:16mm;right:16mm;text-align:center}.cert .ftr img{max-width:100%;max-height:26mm}' +
    '.cert .body{position:absolute;top:46mm;left:22mm;right:22mm;bottom:44mm;text-align:center}' +
    '.cert .title{font-size:26pt;font-weight:bold;color:' + accent + ';letter-spacing:.5px;margin:0 0 4mm}' +
    '.cert .intro{font-size:13pt;color:#444;margin:0 0 3mm}' +
    '.cert .name{font-size:' + nameSize + 'pt;font-weight:bold;color:#1e1e1e;margin:0 0 3mm;border-bottom:.6mm solid #c9a227;display:inline-block;padding:0 8mm 1.5mm;max-width:100%;word-wrap:break-word;line-height:1.5}' +
    '.cert .bodytxt{font-size:13pt;color:#444;margin:2mm 0}' +
    '.cert .ws{font-size:' + wsSize + 'pt;font-weight:bold;color:' + accent + ';margin:1mm 0 2mm;line-height:1.5;word-wrap:break-word}' +
    '.cert .outro{font-size:11.5pt;color:#555;margin:0 auto;max-width:200mm;line-height:1.7}' +
    '.cert .score,.cert .meta{font-size:11pt;color:#333;margin-top:1.5mm}' +
    '.cert .sigs{position:absolute;bottom:40mm;left:30mm;right:30mm;display:flex;justify-content:space-around;align-items:flex-end}' +
    '.cert .sig{text-align:center;min-width:50mm}.cert .sigline{border-top:.4mm solid #333;width:50mm;margin:0 auto 1.5mm}.cert .sigimg{max-height:16mm;max-width:50mm;display:block;margin:0 auto 1mm}' +
    '.cert .signame{font-weight:bold;font-size:11pt}.cert .sigtitle{font-size:9.5pt;color:#555}' +
    '.cert .stamp{position:absolute;bottom:40mm;left:50%;transform:translateX(-50%);max-height:30mm;max-width:30mm;opacity:.9}' +
    '.cert .qr{position:absolute;bottom:41mm;left:16mm;text-align:center;direction:ltr}.cert .qr table{border-collapse:collapse;margin:0 auto}.cert .qr td{padding:0}' +
    '.cert .serial{position:absolute;bottom:41mm;right:16mm;font-size:9pt;color:#666;direction:ltr;text-align:right}' +
    '.cert .vision{position:absolute;top:44mm;left:0;right:0;text-align:center;font-size:9.5pt;color:#c9a227}';
  var html = '<div class="cert"><div class="frame"></div><div class="frame2"></div>' +
    (header ? '<div class="hdr"><img src="' + header + '" alt=""></div>' : '<div class="hdr"><div style="font-weight:bold;color:' + accent + ';font-size:14pt">' + esc(APP.MINISTRY) + '<br>' + esc(APP.SCHOOL) + '</div></div>') +
    '<div class="vision">' + esc(APP.VISION) + '</div>' +
    '<div class="body"><div class="title">' + esc(t.title || '') + '</div><div class="intro">' + esc(t.intro || '') + '</div>' +
    '<div class="name">' + esc(snap.name) + '</div>' + (t.body ? '<div class="bodytxt">' + esc(t.body) + '</div>' : '') +
    '<div class="ws">«' + esc(snap.workshopTitle) + '»</div><div class="outro">' + esc(t.outro || '') + '</div>' + scoreLine + dateLine + '</div>' +
    (signers ? '<div class="sigs">' + signers + '</div>' : '') + (stamp ? '<img class="stamp" src="' + stamp + '" alt="">' : '') +
    '<div class="qr">' + qrTable_(verifyUrl, forPdf ? 3 : 2) + '<div style="font-size:7pt;color:#666;margin-top:1mm">التحقق</div></div>' +
    '<div class="serial">No. ' + esc(snap.serial) + '<br>' + esc(fmtDate_(snap.issuedAt)) + '</div>' +
    (footer ? '<div class="ftr"><img src="' + footer + '" alt=""></div>' : '') + '</div>';
  if (forPdf) return '<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><style>body{margin:0;padding:0}' + css + '</style></head><body>' + html + '</body></html>';
  return '<style>' + css + '</style>' + html;
}
/** ملف PDF للشهادة: يُعاد استخدام الملف المحفوظ في Drive إن وُجد، وإلا يُولَّد ويُحفظ */
function certPdfBlob_(c, snap) {
  var name = 'IKP-certificate-' + String(snap.serial || c.id) + '.pdf';
  if (c.pdfFileId) {
    try { var f0 = DriveApp.getFileById(c.pdfFileId); if (!f0.isTrashed()) return f0.getBlob().setName(name); } catch (e0) { }
  }
  var html = certRenderHtml_(snap, true);
  var pdf = Utilities.newBlob(html, 'text/html', 'cert.html').getAs('application/pdf').setName(name);
  try {
    var f = driveFolder_().createFile(pdf);
    updateRowAt_(SHEETS.CERTIFICATES, c, { pdfFileId: f.getId() });
  } catch (e2) { /* حفظ النسخة في Drive اختياري */ }
  return pdf;
}
/** معاينة في لوحة الإدارة بقالب مقترح قبل حفظه — بأسماء وعناوين طويلة لاختبار التنسيق */
function certPreviewHtml_(p) {
  var s = getSettings_();
  var tpl = Object.assign({}, s.certificate, (p && p.template) || {});
  var kind = p && p.kind === 'trainer' ? 'trainer' : 'trainee';
  var snap = {
    code: 'preview000000000000000000', kind: kind, name: kind === 'trainer' ? 'الأستاذ الدكتور عبدالرحمن بن محمد بن عبدالله آل ثاني الكواري' : 'محمد عبدالعزيز عبدالرحمن الكبيسي المهندي',
    email: '', workshopTitle: 'صياغة الأهداف السلوكية والتخطيط الفعّال للدروس وتوظيف استراتيجيات التعلم النشط', percent: 95, passedAt: nowIso_(), issuedAt: nowIso_(), serial: 'IKP-2026-0000',
    template: {
      title: kind === 'trainer' ? tpl.trainerTitle : tpl.title, intro: kind === 'trainer' ? tpl.trainerBody : tpl.intro, body: kind === 'trainer' ? '' : tpl.body,
      outro: kind === 'trainer' ? tpl.trainerOutro : tpl.outro, showScore: kind !== 'trainer' && !!tpl.showScore, signers: (tpl.signers || []).filter(function (x) { return x && x.name; }),
      stampImageId: tpl.stampImageId, headerImageId: tpl.headerImageId, footerImageId: tpl.footerImageId, accent: tpl.accent
    }
  };
  return certRenderHtml_(snap, false);
}


/* ######################## Assets.gs ######################## */

/**
 * Assets.gs — الأصول البصرية (الترويسة والتذييل والشعارات والتوقيعات والختم)
 * ------------------------------------------------------------
 * - الصور الافتراضية (ترويسة وتذييل المدرسة) مضمّنة في ملف Assets.html (أو index في نسخة الملف الواحد).
 * - الصور المرفوعة من الإدارة تُحفظ في مجلد Drive الخاص بالمنصة فقط، ولا يُقرأ أي ملف خارج هذا المجلد.
 * - app.assets (عام) يُعيد فقط الصور المضبوطة في إعدادات الهوية البصرية — لا يقبل معرّفات حرة.
 */

var __assetsCache = null;
function defaultAssets_() {
  if (__assetsCache) return __assetsCache;
  var out = { header: '', footer: '' };
  ['Assets', 'index'].some(function (name) {
    try {
      var html = HtmlService.createHtmlOutputFromFile(name).getContent();
      var mh = html.match(/header:\s*'(data:[^']+)'/); var mf = html.match(/footer:\s*'(data:[^']+)'/);
      if (mh) out.header = mh[1]; if (mf) out.footer = mf[1];
      return !!(mh || mf);
    } catch (e) { return false; }
  });
  __assetsCache = out;
  return out;
}
function driveFolder_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty(PROPS.DRIVE_FOLDER_ID);
  var f = null;
  if (id) { try { f = DriveApp.getFolderById(id); } catch (e) { f = null; } }
  if (!f) { f = DriveApp.createFolder('IKP - ملفات منصة ابن خلدون للتدريب'); props.setProperty(PROPS.DRIVE_FOLDER_ID, f.getId()); }
  return f;
}
/** هل الملف داخل مجلد المنصة؟ (حماية من قراءة ملفات Drive أخرى عبر معرّف مُخمَّن) */
function assetInFolder_(file) {
  try {
    var fid = driveFolder_().getId();
    var parents = file.getParents();
    while (parents.hasNext()) { if (parents.next().getId() === fid) return true; }
  } catch (e) { }
  return false;
}
/**
 * يُعيد صورة Drive كـ data URL. strict=true يفرض أن تكون داخل مجلد المنصة (للاستدعاءات القادمة من الواجهة).
 * الاستدعاءات الداخلية (قالب الشهادة/الهوية) تمر بمعرّفات حفظتها الإدارة عبر الرفع، وتُفحص أيضًا.
 */
function assetDataUrl_(fileId, strict) {
  if (!fileId) return '';
  fileId = String(fileId);
  if (fileId.indexOf('data:') === 0) return fileId;
  if (!/^[A-Za-z0-9_-]{10,}$/.test(fileId)) return '';
  try {
    var file = DriveApp.getFileById(fileId);
    if (!assetInFolder_(file)) return '';
    var blob = file.getBlob();
    var ct = blob.getContentType();
    if (!/^image\/(png|jpeg|jpg|webp)$/.test(ct)) return '';
    return 'data:' + ct + ';base64,' + Utilities.base64Encode(blob.getBytes());
  } catch (e) { return ''; }
}
/** رفع صورة من لوحة الإدارة (PNG/JPEG/WebP حتى 600KB) إلى مجلد المنصة */
function adminAssetUpload_(user, p) {
  var m = String(p.dataUrl || '').match(/^data:(image\/(png|jpeg|jpg|webp));base64,([A-Za-z0-9+\/=]+)$/);
  if (!m) fail('VALIDATION', 'الملف يجب أن يكون صورة PNG أو JPEG أو WebP.');
  var bytes;
  try { bytes = Utilities.base64Decode(m[3]); } catch (e) { fail('VALIDATION', 'بيانات الصورة غير صالحة.'); }
  if (!bytes.length) fail('VALIDATION', 'الصورة فارغة.');
  if (bytes.length > LIMITS.MAX_UPLOAD_BYTES) fail('VALIDATION', 'حجم الصورة يتجاوز ' + Math.round(LIMITS.MAX_UPLOAD_BYTES / 1024) + ' كيلوبايت.');
  var name = 'asset_' + cleanText_(p.name || 'image', 40).replace(/[^\w؀-ۿ.-]/g, '_') + '_' + Date.now();
  var file = driveFolder_().createFile(Utilities.newBlob(bytes, m[1], name));
  audit_(user, 'asset_upload', file.getId(), { name: name, bytes: bytes.length });
  return { fileId: file.getId(), dataUrl: p.dataUrl };
}
/** صور الهوية البصرية المضبوطة فقط (للجميع، بدون جلسة) — يُستدعى عند الإقلاع إن كانت مخصصة */
function brandingAssets_(p) {
  var b = getSettings_().branding || {};
  var which = String((p && p.which) || '');
  var out = {};
  if ((!which || which === 'header') && b.headerImageId) out.header = { id: b.headerImageId, dataUrl: assetDataUrl_(b.headerImageId, true) };
  if ((!which || which === 'footer') && b.footerImageId) out.footer = { id: b.footerImageId, dataUrl: assetDataUrl_(b.footerImageId, true) };
  return out;
}


/* ######################## Mail.gs ######################## */

/**
 * Mail.gs — البريد الإلكتروني (قوالب، سجل، قائمة انتظار، إعادة محاولة، منع التكرار)
 * ------------------------------------------------------------
 * - كل رسالة تُسجل في MailLog بحالة مستقلة (sent | failed | queued | expired) ومفتاح مرجعي refKey يمنع الإرسال المكرر.
 * - فشل البريد لا يُفشل العملية الأصلية أبدًا؛ يمكن إعادة المحاولة من لوحة الإدارة أو بمشغّل زمني (cronRetryMail).
 * - الحصة اليومية لـ MailApp محدودة (نحو 100 رسالة/يوم للحسابات الشخصية و1500 لحسابات Workspace)؛ عند نفادها
 *   تُسجل الرسالة failed بسبب «quota» وتُعالج لاحقًا.
 */

function mailFrame_(title, bodyHtml) {
  var s = getSettings_();
  var url = webAppUrl_();
  return '<div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;background:#f4efec;padding:24px">' +
    '<div style="max-width:620px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e6dcd8">' +
    '<div style="background:#7b1a2e;color:#fff;padding:18px 22px"><div style="font-size:12px;opacity:.85">' + htmlEscape_(APP.SCHOOL) + '</div>' +
    '<div style="font-size:18px;font-weight:bold;margin-top:4px">' + htmlEscape_(APP.NAME) + '</div></div>' +
    '<div style="padding:22px;color:#222;font-size:15px;line-height:1.9"><h2 style="color:#7b1a2e;font-size:17px;margin:0 0 12px">' + htmlEscape_(title) + '</h2>' + bodyHtml +
    (url ? '<p style="margin-top:20px"><a href="' + htmlEscape_(url) + '" style="background:#c9a227;color:#3a2a00;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:bold;display:inline-block">الدخول إلى المنصة</a></p>' : '') +
    '</div><div style="background:#faf7f5;color:#777;font-size:12px;padding:12px 22px;border-top:1px solid #eee">' + htmlEscape_(s.mail.footer) + '<br>' + htmlEscape_(APP.VISION) + '</div></div></div>';
}

function codeBox_(code) {
  return '<div style="text-align:center;margin:18px 0"><span dir="ltr" style="display:inline-block;font-size:30px;letter-spacing:8px;font-weight:bold;color:#7b1a2e;background:#f7eef0;padding:10px 22px;border-radius:10px;border:1px dashed #7b1a2e">' + htmlEscape_(code) + '</span></div>';
}

function mailQuota_() { try { return MailApp.getRemainingDailyQuota(); } catch (e) { return null; } }

/**
 * الإرسال الفعلي مع التسجيل. refKey فريد لكل (نوع + مستلم + مرجع) لمنع التكرار.
 * force=true يسمح بإعادة الإرسال رغم وجود سجل ناجح (مثلًا زر "إعادة الإرسال" في الإدارة).
 * queueOnly=true يسجل الرسالة في قائمة الانتظار دون إرسالها الآن.
 */
function sendMail_(opts) {
  var refKey = opts.refKey || (opts.kind + ':' + opts.to + ':' + (opts.ref || ''));
  var prev = findOne_(SHEETS.MAIL, function (m) { return m.refKey === refKey; });
  if (prev && prev.status === MAIL_STATUS.SENT && !opts.force) return { ok: true, skipped: true, logId: prev.id };
  var s = getSettings_();
  var rec = prev || { id: newId_('mail'), kind: opts.kind, refKey: refKey, to: opts.to, subject: opts.subject, status: '', attempts: 0, lastError: '', createdAt: nowIso_(), sentAt: '', payloadRef: opts.payloadRef || '' };
  if (opts.queueOnly) {
    var qp = { status: MAIL_STATUS.QUEUED, subject: opts.subject, payloadRef: opts.payloadRef || rec.payloadRef || '' };
    if (prev) updateRowAt_(SHEETS.MAIL, prev, qp); else insertRow_(SHEETS.MAIL, Object.assign(rec, qp));
    return { ok: false, queued: true, logId: rec.id };
  }
  var attempts = (parseInt(rec.attempts, 10) || 0) + 1;
  var status = MAIL_STATUS.SENT, err = '';
  try {
    if (!isEmail_(String(opts.to || ''))) throw new Error('عنوان بريد غير صالح');
    var quota = mailQuota_();
    if (quota !== null && quota <= 0) throw new Error('quota: نفدت حصة البريد اليومية');
    var msg = { to: opts.to, subject: opts.subject, htmlBody: opts.html, name: s.senderName || APP.NAME };
    if (s.mail && s.mail.noReply) msg.noReply = true;
    if (opts.attachments && opts.attachments.length) msg.attachments = opts.attachments;
    MailApp.sendEmail(msg);
  } catch (e) {
    status = MAIL_STATUS.FAILED; err = String(e && e.message || e).substr(0, 300);
    console.error('mail failed (' + opts.kind + ' → ' + opts.to + '): ' + err);
  }
  var patch = { status: status, attempts: attempts, lastError: err, sentAt: status === MAIL_STATUS.SENT ? nowIso_() : '', subject: opts.subject, payloadRef: opts.payloadRef || rec.payloadRef || '' };
  if (prev) updateRowAt_(SHEETS.MAIL, prev, patch); else insertRow_(SHEETS.MAIL, Object.assign(rec, patch));
  return { ok: status === MAIL_STATUS.SENT, error: err, logId: rec.id };
}

/* ---------- القوالب ---------- */
function sendVerificationMail_(user, code) {
  return sendMail_({
    kind: 'verify', to: user.email, refKey: 'verify:' + user.id + ':' + Date.now(), subject: 'رمز تفعيل حسابك — ' + APP.NAME,
    html: mailFrame_('تفعيل الحساب', '<p>مرحبًا ' + htmlEscape_(user.name) + '،</p><p>لإتمام إنشاء حسابك في المنصة، أدخل رمز التفعيل التالي (صالح لمدة ' + LIMITS.VERIFY_CODE_MINUTES + ' دقيقة):</p>' + codeBox_(code) + '<p>إذا لم تطلب إنشاء حساب، تجاهل هذه الرسالة.</p>')
  });
}
function sendResetMail_(user, code) {
  return sendMail_({
    kind: 'reset', to: user.email, refKey: 'reset:' + user.id + ':' + Date.now(), subject: 'رمز استعادة كلمة المرور — ' + APP.NAME,
    html: mailFrame_('استعادة كلمة المرور', '<p>مرحبًا ' + htmlEscape_(user.name) + '،</p><p>استخدم الرمز التالي لتعيين كلمة مرور جديدة (صالح لمدة ' + LIMITS.RESET_CODE_MINUTES + ' دقيقة ويُستخدم مرة واحدة):</p>' + codeBox_(code) + '<p>إذا لم تطلب ذلك، تجاهل هذه الرسالة وستبقى كلمة مرورك كما هي.</p>')
  });
}

function fmtDate_(iso, withTime) {
  if (!iso) return '';
  try {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso);
    return Utilities.formatDate(d, APP.TIMEZONE, withTime ? 'yyyy-MM-dd  HH:mm' : 'yyyy-MM-dd');
  } catch (e) { return String(iso); }
}
function arabicDay_(iso) {
  var days = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  try { var idx = parseInt(Utilities.formatDate(new Date(iso), APP.TIMEZONE, 'u'), 10) % 7; return days[idx]; } catch (e) { return ''; }
}

function announcementHtml_(w) {
  var when = w.scheduledAt ? '<tr><th style="text-align:right;padding:6px;color:#7b1a2e">الموعد</th><td style="padding:6px">' + htmlEscape_(arabicDay_(w.scheduledAt)) + ' <span dir="ltr">' + htmlEscape_(fmtDate_(w.scheduledAt, true)) + '</span></td></tr>' : '';
  return mailFrame_('دعوة لحضور ورشة تدريبية: ' + w.title,
    '<p>يسر إدارة المدرسة دعوتكم لحضور الورشة التدريبية التالية ضمن برنامج التطوير المهني:</p>' +
    '<table style="width:100%;border-collapse:collapse;background:#faf7f5;border-radius:8px">' +
    '<tr><th style="text-align:right;padding:6px;color:#7b1a2e">الورشة</th><td style="padding:6px"><b>' + htmlEscape_(w.title) + '</b></td></tr>' + when +
    (w.durationMin ? '<tr><th style="text-align:right;padding:6px;color:#7b1a2e">المدة</th><td style="padding:6px">' + htmlEscape_(w.durationMin) + ' دقيقة</td></tr>' : '') +
    (w.location ? '<tr><th style="text-align:right;padding:6px;color:#7b1a2e">المكان</th><td style="padding:6px">' + htmlEscape_(w.location) + '</td></tr>' : '') +
    (w.trainerName ? '<tr><th style="text-align:right;padding:6px;color:#7b1a2e">المدرب</th><td style="padding:6px">' + htmlEscape_(w.trainerName) + '</td></tr>' : '') +
    '</table><p style="margin-top:12px">' + htmlEscape_(w.description || '') + '</p><p>يُرجى الالتزام بالحضور وإتمام وحدات الورشة واختبارها النهائي عبر المنصة للحصول على شهادة الإتمام.</p>');
}

/** إرسال الدعوة للمستهدفين: الدفعة الأولى فورًا، والباقي في قائمة الانتظار (يعالجها المشغّل الزمني أو زر «معالجة قائمة الانتظار») */
function sendWorkshopAnnouncement_(w, users, resend) {
  var sent = 0, failed = 0, skipped = 0, queued = 0;
  var html = announcementHtml_(w);
  users.forEach(function (u, i) {
    var opts = { kind: 'announce', to: u.email, refKey: 'announce:' + w.id + ':' + u.id, force: !!resend, subject: 'دعوة لحضور ورشة: ' + w.title, html: html, payloadRef: w.id + '|' + u.id };
    if (i >= LIMITS.MAIL_MAX_PER_RUN) opts.queueOnly = true;
    var r = sendMail_(opts);
    if (r.queued) queued++; else if (r.skipped) skipped++; else if (r.ok) sent++; else failed++;
  });
  return { targeted: users.length, sent: sent, failed: failed, skipped: skipped, queued: queued };
}

/* ---------- قائمة الانتظار وإعادة المحاولة ---------- */
function mailRetryFailed_(user, p) {
  var max = Math.min(Number(p && p.max) || 30, LIMITS.MAIL_MAX_PER_RUN);
  var all = readTable_(SHEETS.MAIL);
  var pending = all.filter(function (m) { return (m.status === MAIL_STATUS.QUEUED || m.status === MAIL_STATUS.FAILED) && (!p || !p.id || m.id === p.id); });
  // قائمة الانتظار أولًا ثم الفاشلة
  pending.sort(function (a, b) { return (a.status === MAIL_STATUS.QUEUED ? 0 : 1) - (b.status === MAIL_STATUS.QUEUED ? 0 : 1); });
  pending = pending.slice(0, max);
  var out = { retried: 0, sent: 0, failed: 0, expired: 0, remaining: Math.max(0, all.filter(function (m) { return m.status === MAIL_STATUS.QUEUED || m.status === MAIL_STATUS.FAILED; }).length - pending.length) };
  pending.forEach(function (m) {
    out.retried++;
    var r;
    try {
      if (m.kind === 'verify' || m.kind === 'reset') { updateRowAt_(SHEETS.MAIL, m, { status: MAIL_STATUS.EXPIRED, lastError: 'رمز منتهي — يطلب المستخدم رمزًا جديدًا' }); out.expired++; return; }
      if (m.kind === 'announce') {
        var parts = String(m.payloadRef).split('|'); var w = findById_(SHEETS.WORKSHOPS, parts[0]);
        if (!w || w.status !== WS_STATUS.PUBLISHED) { updateRowAt_(SHEETS.MAIL, m, { status: MAIL_STATUS.EXPIRED, lastError: 'الورشة غير موجودة أو غير منشورة' }); out.expired++; return; }
        r = sendMail_({ kind: 'announce', to: m.to, refKey: m.refKey, subject: m.subject, html: announcementHtml_(w), payloadRef: m.payloadRef });
      } else if (String(m.kind).indexOf('cert_') === 0) {
        var cert = findById_(SHEETS.CERTIFICATES, m.payloadRef);
        if (!cert) { updateRowAt_(SHEETS.MAIL, m, { status: MAIL_STATUS.EXPIRED, lastError: 'الشهادة غير موجودة' }); out.expired++; return; }
        r = certSendOne_(m.payloadRef, m.kind, true);
      } else { updateRowAt_(SHEETS.MAIL, m, { status: MAIL_STATUS.EXPIRED, lastError: 'نوع غير قابل لإعادة الإرسال' }); out.expired++; return; }
      if (r && r.ok) out.sent++; else out.failed++;
    } catch (e) { out.failed++; }
  });
  if (user) audit_(user, 'mail_retry', '', out);
  return out;
}

function adminMailList_(p) {
  var all = readTable_(SHEETS.MAIL);
  var list = all.map(function (m) { return { id: m.id, kind: m.kind, to: m.to, subject: m.subject, status: m.status, attempts: Number(m.attempts) || 0, lastError: m.lastError, createdAt: m.createdAt, sentAt: m.sentAt }; })
    .sort(function (a, b) { return String(b.createdAt).localeCompare(String(a.createdAt)); });
  if (p && p.status) list = list.filter(function (m) { return m.status === p.status; });
  var counts = { failed: 0, queued: 0, sent: 0, expired: 0 };
  all.forEach(function (m) { if (counts[m.status] !== undefined) counts[m.status]++; });
  return { mail: list.slice(0, Number(p && p.limit) || 200), total: list.length, counts: counts, quota: mailQuota_() };
}


/* ######################## AI.gs ######################## */

/**
 * AI.gs — توليد الورش بالذكاء الاصطناعي (Claude) على مراحل قابلة للاستئناف
 * ------------------------------------------------------------
 * ثلاثة مسارات: (1) توليد آلي عبر Claude API  (2) مسار يدوي: نسخ الأمر ولصق JSON  (3) هيكل أولي بدون ذكاء اصطناعي.
 * - مفتاح API يُخزن في Script Properties فقط ولا يُعاد للمتصفح (تُعرض حالة وجوده وتاريخ ضبطه فقط).
 * - كل مهمة (AIJob) تحفظ مخرجات كل مرحلة؛ يمكن الإلغاء وإعادة المحاولة والاستئناف من آخر مرحلة ناجحة دون فقد المخرجات.
 * - الاستدعاء عبر HTTP مباشرة (لا توجد مكتبة Anthropic رسمية لبيئة Apps Script):
 *     POST https://api.anthropic.com/v1/messages ، anthropic-version: 2026-10-21
 *     النموذج الافتراضي claude-opus-5-5 (قابل للتغيير من الإعدادات)، التفكير التكيفي مفعّل تلقائيًا
 *     وعمقه يُضبط عبر output_config.effort، ومع البديل الخادمي عند رفض السياسة (fallbacks: "default").
 */

var ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
var ANTHROPIC_VERSION = '2026-10-21';
var ANTHROPIC_FALLBACK_BETA = 'server-side-fallback-2026-07-01';

function aiKey_() { return PropertiesService.getScriptProperties().getProperty(PROPS.ANTHROPIC_KEY) || ''; }
function aiKeyStatus_() {
  var props = PropertiesService.getScriptProperties();
  var k = props.getProperty(PROPS.ANTHROPIC_KEY);
  return { configured: !!k, setAt: k ? (props.getProperty(PROPS.ANTHROPIC_KEY_AT) || '') : '' };
}
function adminAiKey_(user, p) {
  var props = PropertiesService.getScriptProperties();
  if (p.action === 'delete') { props.deleteProperty(PROPS.ANTHROPIC_KEY); props.deleteProperty(PROPS.ANTHROPIC_KEY_AT); audit_(user, 'ai_key_delete', '', {}); }
  else if (p.action === 'set') {
    var k = String(p.key || '').trim();
    if (k.indexOf('sk-ant') !== 0 || k.length < 30 || /\s/.test(k)) fail('VALIDATION', 'صيغة المفتاح غير صحيحة (يبدأ بـ sk-ant).');
    props.setProperty(PROPS.ANTHROPIC_KEY, k); props.setProperty(PROPS.ANTHROPIC_KEY_AT, nowIso_()); audit_(user, 'ai_key_set', '', {});
  }
  return aiKeyStatus_();
}

/** مخطط JSON للمخرجات المنظمة (اختياري) */
function aiSchema_(kind) {
  var question = { type: 'object', additionalProperties: false, required: ['text', 'options', 'answer', 'explanation'],
    properties: { text: { type: 'string' }, options: { type: 'array', items: { type: 'string' } }, answer: { type: 'integer' }, explanation: { type: 'string' } } };
  if (kind === 'plan') return { type: 'object', additionalProperties: false, required: ['title', 'description', 'objectives', 'modules'],
    properties: { title: { type: 'string' }, description: { type: 'string' }, objectives: { type: 'array', items: { type: 'string' } },
      modules: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['title', 'focus'], properties: { title: { type: 'string' }, focus: { type: 'string' } } } } } };
  if (kind === 'final') return { type: 'object', additionalProperties: false, required: ['questions'], properties: { questions: { type: 'array', items: question } } };
  var section = { type: 'object', additionalProperties: false, required: ['type', 'title', 'body', 'items', 'rows'],
    properties: { type: { type: 'string', enum: SECTION_TYPES }, title: { type: 'string' }, body: { type: 'string' }, items: { type: 'array', items: { type: 'string' } }, rows: { type: 'array', items: { type: 'array', items: { type: 'string' } } } } };
  return { type: 'object', additionalProperties: false, required: ['title', 'summary', 'objectives', 'sections', 'questions'],
    properties: { title: { type: 'string' }, summary: { type: 'string' }, objectives: { type: 'array', items: { type: 'string' } }, sections: { type: 'array', items: section }, questions: { type: 'array', items: question } } };
}

/**
 * استدعاء Claude — يُعيد النص فقط. schemaKind اختياري لطلب JSON منظم؛ عند رفض الخادم للمعامل
 * (نموذج لا يدعمه) يُعاد الطلب تلقائيًا دون مخطط.
 */
function aiCall_(system, userMsg, maxTokens, schemaKind) {
  var key = aiKey_();
  if (!key) fail('AI_KEY', 'لم يتم ضبط مفتاح Anthropic على الخادم. استخدم لوحة الإدارة > الإعدادات > الذكاء الاصطناعي.');
  var s = getSettings_().ai;
  var body = { model: s.model || DEFAULT_SETTINGS.ai.model, max_tokens: maxTokens || Number(s.maxTokens) || 8000, system: system, messages: [{ role: 'user', content: userMsg }] };
  var effort = ['low', 'medium', 'high'].indexOf(s.effort) === -1 ? 'medium' : s.effort;
  body.output_config = { effort: effort };
  var headers = { 'x-api-key': key, 'anthropic-version': ANTHROPIC_VERSION };
  if (s.fallbacks !== false) { body.fallbacks = 'default'; headers['anthropic-beta'] = ANTHROPIC_FALLBACK_BETA; }
  if (schemaKind && s.structured !== false) body.output_config.format = { type: 'json_schema', schema: aiSchema_(schemaKind) };

  var attempt = function (b, h) {
    return UrlFetchApp.fetch(ANTHROPIC_URL, { method: 'post', contentType: 'application/json', muteHttpExceptions: true, headers: h, payload: JSON.stringify(b) });
  };
  var res = attempt(body, headers);
  var code = res.getResponseCode();
  var txt = res.getContentText();
  if (code === 400 && (body.output_config.format || body.fallbacks) && /output_config|format|fallbacks|anthropic-beta|unsupported/i.test(txt)) {
    // تراجع تدريجي: بدون مخطط ثم بدون البديل الخادمي
    var b2 = JSON.parse(JSON.stringify(body)); delete b2.output_config.format;
    var h2 = Object.assign({}, headers);
    if (/fallbacks|anthropic-beta/i.test(txt)) { delete b2.fallbacks; delete h2['anthropic-beta']; }
    res = attempt(b2, h2); code = res.getResponseCode(); txt = res.getContentText();
  }
  if (code >= 400) {
    var msg = 'فشل الاتصال بخدمة الذكاء الاصطناعي (HTTP ' + code + ').';
    if (code === 401) msg = 'مفتاح API غير صالح أو منتهي.';
    if (code === 403) msg = 'المفتاح لا يملك صلاحية الوصول لهذا النموذج.';
    if (code === 404) msg = 'النموذج المحدد في الإعدادات غير موجود (' + body.model + ').';
    if (code === 429) msg = 'تم تجاوز حد الاستخدام لدى الخدمة. أعد المحاولة بعد قليل.';
    if (code === 529 || code === 503 || code === 500) msg = 'الخدمة مشغولة حاليًا. أعد المحاولة بعد قليل.';
    if (code === 400) { var em = parseJson_(txt, {}); var detail = em && em.error && em.error.message ? String(em.error.message).substr(0, 140) : ''; msg = 'رفض الخادم الطلب (400)' + (detail ? ': ' + detail : '.'); }
    fail('AI_HTTP', msg);
  }
  var data = parseJson_(txt, null);
  if (!data || !data.content) fail('AI_BAD', 'استجابة غير متوقعة من الخدمة.');
  if (data.stop_reason === 'refusal') fail('AI_REFUSED', 'رفضت الخدمة إكمال هذا الطلب وفق سياساتها. عدّل الموضوع أو الملاحظات وأعد المحاولة.');
  var text = data.content.filter(function (c) { return c.type === 'text'; }).map(function (c) { return c.text; }).join('\n');
  if (data.stop_reason === 'max_tokens') fail('AI_TRUNCATED', 'تجاوزت الاستجابة الحد الأقصى للرموز وقُطعت. ارفع «الحد الأقصى للرموز» في الإعدادات أو قلّل عدد الكلمات المطلوبة.');
  aiCall_.lastUsage = data.usage || null;
  aiCall_.lastModel = data.model || body.model;
  return text;
}
function aiTestConnection_() {
  var t = aiCall_('أجب بكلمة واحدة فقط دون أي شرح.', 'اكتب كلمة: جاهز', 64);
  return { ok: true, reply: String(t).trim().substr(0, 40), model: aiCall_.lastModel || getSettings_().ai.model };
}

/** استخراج JSON من نص قد يحتوي على أسوار كود أو شرح */
function extractJson_(text) {
  var t = String(text || '').trim();
  var fence = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) t = fence[1].trim();
  var start = t.indexOf('{'), end = t.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) fail('AI_JSON', 'لم يتم العثور على JSON صالح في الاستجابة.');
  t = t.substring(start, end + 1);
  try { return JSON.parse(t); } catch (e) { fail('AI_JSON', 'تعذر تحليل JSON: ' + String(e.message).substr(0, 120)); }
}

/* ---------- الأوامر (Prompts) ---------- */
var AI_SYSTEM = 'أنت خبير تصميم تعليمي ومدرب تطوير مهني لمعلمي المرحلة الإعدادية في دولة قطر. تكتب بالعربية الفصحى الواضحة، بأسلوب مهني تطبيقي، وتلتزم حرفيًا بصيغة JSON المطلوبة دون أي نص خارجها. لا تختلق مراجع أو إحصاءات أو سياسات رسمية أو أسماء أشخاص. الرؤية المؤسسية: «متعلم ريادي لتنمية مستدامة».';

function aiInputText_(inp) {
  return 'موضوع الورشة: ' + inp.topic + '\nالوصف: ' + (inp.description || '—') + '\nالفئة المستهدفة: ' + (inp.audience || 'المعلمون والكادر المدرسي') +
    '\nعدد الوحدات: ' + inp.moduleCount + '\nالمحاور المقترحة: ' + (inp.outline || 'اقترحها أنت') + '\nنسبة النجاح: ' + inp.passScore + '%\nملاحظات المشرف: ' + (inp.notes || '—');
}
function aiPlanPrompt_(inp) {
  return aiInputText_(inp) + '\n\nالمطلوب: خطة الورشة بصيغة JSON فقط:\n{"title":"عنوان الورشة","description":"وصف من 2-3 جمل","objectives":["3-5 أهداف عامة قابلة للقياس"],"modules":[{"title":"عنوان الوحدة","focus":"جملة تصف محور الوحدة"}]}\nعدد عناصر modules يجب أن يساوي ' + inp.moduleCount + ' بالضبط.';
}
function aiModulePrompt_(inp, plan, i, expand) {
  var s = getSettings_();
  var m = plan.modules[i];
  return 'الورشة: ' + plan.title + '\nالفئة المستهدفة: ' + (inp.audience || 'المعلمون') + '\nالوحدة رقم ' + (i + 1) + ' من ' + plan.modules.length + ': ' + m.title + '\nمحورها: ' + m.focus +
    '\nعناوين بقية الوحدات (لتجنب التكرار): ' + plan.modules.map(function (x, j) { return j === i ? '' : x.title; }).filter(Boolean).join('، ') +
    (inp.notes ? '\nملاحظات المشرف: ' + inp.notes : '') +
    '\n\nاكتب محتوى الوحدة بالعربية بصيغة JSON فقط وفق البنية التالية (الحقول items وrows مصفوفات فارغة عند عدم الحاجة):\n' +
    '{"title":"...","summary":"ملخص من جملتين","objectives":["3 إلى 5 أهداف سلوكية قابلة للقياس تبدأ بفعل إجرائي"],' +
    '"sections":[{"type":"text","title":"مقدمة","body":"فقرات","items":[],"rows":[]},{"type":"text","title":"المفاهيم الأساسية","body":"...","items":[],"rows":[]},{"type":"steps","title":"خطوات التطبيق الصفي","body":"","items":["..."],"rows":[]},' +
    '{"type":"example","title":"مثال من المرحلة الإعدادية","body":"...","items":[],"rows":[]},{"type":"table","title":"جدول مقارنة أو تلخيص","body":"","items":[],"rows":[["عنوان1","عنوان2"],["...","..."]]},' +
    '{"type":"warning","title":"أخطاء شائعة","body":"...","items":[],"rows":[]},{"type":"remember","title":"نقاط للتذكر","body":"","items":["..."],"rows":[]},{"type":"activity","title":"نشاط تأملي","body":"...","items":[],"rows":[]}],' +
    '"questions":[{"text":"...","options":["أ","ب","ج","د"],"answer":0,"explanation":"..."}]}\n' +
    'الشروط: المحتوى الإجمالي بين ' + s.ai.wordsMin + ' و' + s.ai.wordsMax + ' كلمة' + (expand ? ' (المحاولة السابقة كانت أقصر من المطلوب — وسّع الشرح والأمثلة)' : '') +
    '، الفقرات مفصولة بسطر فارغ، ' + (Number(s.moduleQuestions) || 5) + ' أسئلة اختيار من متعدد بالضبط، لكل سؤال 4 خيارات مختلفة وإجابة صحيحة واحدة (answer مؤشر من 0 إلى 3)، الأسئلة مستمدة من المحتوى نفسه، ووزّع مواضع الإجابات الصحيحة.';
}
function aiFinalPrompt_(inp, plan, modules) {
  var s = getSettings_();
  var n = Number(s.finalQuestions) || 10;
  var existing = [];
  modules.forEach(function (m) { (m.questions || []).forEach(function (q) { existing.push(q.text); }); });
  return 'الورشة: ' + plan.title + '\nملخصات الوحدات:\n' + modules.map(function (m, i) { return (i + 1) + '. ' + m.title + ': ' + (m.summary || '') + ' | الأهداف: ' + (m.objectives || []).join('؛ '); }).join('\n') +
    '\n\nأسئلة الوحدات الموجودة (لا تكررها حرفيًا):\n- ' + existing.join('\n- ') +
    '\n\nاكتب الاختبار النهائي بصيغة JSON فقط: {"questions":[{"text":"...","options":["..","..","..",".."],"answer":0,"explanation":"..."}]}\n' +
    'الشروط: ' + n + ' أسئلة بالضبط تغطي جميع الوحدات، منها 4 أسئلة تطبيقية على الأقل تعرض موقفًا صفيًا وتطلب القرار الأنسب، 4 خيارات مختلفة لكل سؤال، إجابة صحيحة واحدة، وزّع مواضع الإجابات.';
}

/** المسار اليدوي: أمر كامل يُنسخ إلى Claude ثم يُلصق JSON الناتج */
function aiManualPrompt_(p) {
  var inp = aiNormalizeInput_(p);
  var s = getSettings_();
  return AI_SYSTEM + '\n\n' + aiInputText_(inp) + '\n\nالمطلوب: ورشة تدريبية كاملة بصيغة JSON واحدة فقط وفق البنية التالية:\n' +
    '{"title":"...","description":"...","objectives":["..."],"modules":[{"title":"...","summary":"...","objectives":["3-5 أهداف سلوكية"],' +
    '"sections":[{"type":"text|steps|example|table|warning|remember|activity|tip|list","title":"...","body":"...","items":["..."],"rows":[["..."]]}],' +
    '"questions":[{"text":"...","options":["..","..","..",".."],"answer":0,"explanation":"..."}]}],"finalQuiz":{"questions":[...]}}\n' +
    'الشروط: ' + inp.moduleCount + ' وحدات؛ محتوى كل وحدة بين ' + s.ai.wordsMin + ' و' + s.ai.wordsMax + ' كلمة يتضمن مفاهيم أساسية وخطوات تطبيق صفية ومثالًا من المرحلة الإعدادية وأخطاء شائعة ونقاطًا للتذكر ونشاطًا تأمليًا؛ ' +
    (Number(s.moduleQuestions) || 5) + ' أسئلة لكل وحدة و' + (Number(s.finalQuestions) || 10) + ' أسئلة للاختبار النهائي (4 تطبيقية على الأقل ولا تكرر أسئلة الوحدات)؛ 4 خيارات مختلفة لكل سؤال و"answer" مؤشر من 0 إلى 3. لا تكتب أي شيء خارج JSON.';
}

function aiNormalizeInput_(p) {
  p = p || {};
  var topic = cleanText_(p.topic, 200);
  if (topic.length < 5) fail('VALIDATION', 'يُرجى إدخال موضوع الورشة.');
  var n = parseInt(p.moduleCount, 10); if (!(n >= 1 && n <= 8)) n = 4;
  var ps = parseInt(p.passScore, 10); if (!(ps >= 1 && ps <= 100)) ps = getSettings_().defaultPassScore || 80;
  return { topic: topic, description: cleanText_(p.description, 1000), audience: cleanText_(p.audience, 200), moduleCount: n,
    outline: cleanText_(p.outline, 1500), passScore: ps, notes: cleanText_(p.notes, 1000),
    targetDepartments: Array.isArray(p.targetDepartments) ? p.targetDepartments.map(function (d) { return cleanText_(d, 60); }).filter(Boolean) : [] };
}

/* ---------- التحقق من مخرجات الذكاء الاصطناعي ---------- */
function aiValidateModule_(m, needQ) {
  var errs = [];
  if (!m || typeof m !== 'object') return ['الوحدة ليست كائن JSON.'];
  if (!m.title) errs.push('عنوان الوحدة مفقود.');
  if (!Array.isArray(m.objectives) || m.objectives.length < 3) errs.push('الأهداف أقل من 3.');
  if (!Array.isArray(m.sections) || !m.sections.length) errs.push('لا توجد أقسام محتوى.');
  var qs = Array.isArray(m.questions) ? m.questions : [];
  if (qs.length !== needQ) errs.push('عدد الأسئلة ' + qs.length + ' والمطلوب ' + needQ + '.');
  qs.forEach(function (q, i) {
    if (!q || !q.text) errs.push('السؤال ' + (i + 1) + ' بلا نص.');
    if (!q || !Array.isArray(q.options) || q.options.length !== 4) errs.push('السؤال ' + (i + 1) + ' لا يحتوي 4 خيارات.');
    else if (new Set(q.options.map(String)).size !== 4) errs.push('السؤال ' + (i + 1) + ' يحتوي خيارات مكررة.');
    if (!q || !(parseInt(q.answer, 10) >= 0 && parseInt(q.answer, 10) <= 3)) errs.push('السؤال ' + (i + 1) + ' مؤشر الإجابة غير صالح.');
  });
  return errs;
}

/* ---------- المهام ---------- */
function jobState_(rec) { return unpackChunks_(rec, 'c', 10) || {}; }
function jobSave_(rec, state, patch) {
  var p = Object.assign({ updatedAt: nowIso_() }, patch || {}, packChunks_(state, 'c', 10));
  return updateRowAt_(SHEETS.AIJOBS, rec, p);
}
function jobPublic_(rec) {
  var st = jobState_(rec);
  return { id: rec.id, workshopId: rec.workshopId, status: rec.status, stage: rec.stage, stageIndex: Number(rec.stageIndex) || 0,
    stages: st.stages || [], error: rec.error, input: st.input, plan: st.plan ? { title: st.plan.title, modules: st.plan.modules } : null,
    modulesDone: (st.modules || []).filter(Boolean).length, warnings: st.warnings || [], log: (st.log || []).slice(-30), usage: st.usage || null, createdAt: rec.createdAt, updatedAt: rec.updatedAt };
}
function aiJobStart_(user, p) {
  if (!aiKey_()) fail('AI_KEY', 'لم يتم ضبط مفتاح Anthropic. يمكنك استخدام المسار اليدوي أو الهيكل الأولي.');
  rateLimit_('aijob:' + user.id, LIMITS.AI_MAX_JOBS_PER_HOUR, 3600);
  var inp = aiNormalizeInput_(p);
  var stages = ['plan'];
  for (var i = 0; i < inp.moduleCount; i++) stages.push('module_' + (i + 1));
  stages.push('final', 'validate', 'save');
  var state = { input: inp, stages: stages, plan: null, modules: [], finalQuiz: null, warnings: [], log: [], usage: { input: 0, output: 0, calls: 0 } };
  var rec = Object.assign({ id: newId_('job'), workshopId: '', status: 'running', stage: stages[0], stageIndex: 0, error: '', createdBy: user.id, createdAt: nowIso_(), updatedAt: nowIso_() }, packChunks_(state, 'c', 10));
  insertRow_(SHEETS.AIJOBS, rec);
  audit_(user, 'ai_job_start', rec.id, { topic: inp.topic });
  return { job: jobPublic_(rec) };
}
function aiJobGet_(jobId) { var r = findById_(SHEETS.AIJOBS, jobId); if (!r) fail('NOT_FOUND', 'المهمة غير موجودة.'); return { job: jobPublic_(r) }; }
function aiJobList_() {
  return { jobs: readTable_(SHEETS.AIJOBS).map(jobPublic_).sort(function (a, b) { return String(b.createdAt).localeCompare(String(a.createdAt)); }).slice(0, 30) };
}
function aiJobCancel_(user, jobId) {
  var r = findById_(SHEETS.AIJOBS, jobId); if (!r) fail('NOT_FOUND', 'المهمة غير موجودة.');
  if (r.status === 'done') fail('STATE', 'المهمة مكتملة بالفعل.');
  updateRowAt_(SHEETS.AIJOBS, r, { status: 'cancelled', updatedAt: nowIso_() });
  audit_(user, 'ai_job_cancel', jobId, {});
  return { job: jobPublic_(r) };
}

function addUsage_(state) {
  var u = aiCall_.lastUsage; if (!u) return;
  state.usage = state.usage || { input: 0, output: 0, calls: 0 };
  state.usage.input += Number(u.input_tokens) || 0; state.usage.output += Number(u.output_tokens) || 0; state.usage.calls++;
}

/**
 * تنفيذ مرحلة واحدة (يستدعيها المتصفح تكرارًا). عند الفشل تبقى المهمة على نفس المرحلة لإعادة المحاولة،
 * وتبقى مخرجات المراحل السابقة محفوظة. عقد إيجار قصير (lease) يمنع تنفيذ المرحلة نفسها مرتين بالتوازي.
 */
function aiJobStep_(user, jobId) {
  var rec = findById_(SHEETS.AIJOBS, jobId);
  if (!rec) fail('NOT_FOUND', 'المهمة غير موجودة.');
  if (rec.status === 'done') return { job: jobPublic_(rec) };
  var leaseKey = 'ailease:' + jobId;
  if (cacheGet_(leaseKey)) fail('BUSY', 'هذه المرحلة قيد التنفيذ بالفعل. انتظر اكتمالها ثم تابع.');
  cachePut_(leaseKey, '1', LIMITS.AI_STEP_LEASE_SEC);
  try {
    var state = jobState_(rec);
    var idx = Number(rec.stageIndex) || 0;
    var stage = state.stages[idx];
    if (!stage) { updateRowAt_(SHEETS.AIJOBS, rec, { status: 'done', stage: 'done' }); return { job: jobPublic_(rec) }; }
    var s = getSettings_();
    var inp = state.input;
    state.log = state.log || [];
    try {
      updateRowAt_(SHEETS.AIJOBS, rec, { status: 'running', error: '' });
      if (stage === 'plan') {
        var plan = extractJson_(aiCall_(AI_SYSTEM, aiPlanPrompt_(inp), 4000, 'plan')); addUsage_(state);
        if (!plan.title || !Array.isArray(plan.modules) || !plan.modules.length) fail('AI_JSON', 'الخطة ناقصة (عنوان/وحدات).');
        plan.modules = plan.modules.slice(0, inp.moduleCount);
        while (plan.modules.length < inp.moduleCount) plan.modules.push({ title: 'وحدة ' + (plan.modules.length + 1), focus: inp.topic });
        state.plan = plan;
        state.log.push('✔ تم إعداد خطة الورشة: ' + plan.title);
      } else if (stage.indexOf('module_') === 0) {
        var i = parseInt(stage.split('_')[1], 10) - 1;
        var needQ = Number(s.moduleQuestions) || 5;
        var mod = extractJson_(aiCall_(AI_SYSTEM, aiModulePrompt_(inp, state.plan, i, false), null, 'module')); addUsage_(state);
        var errs = aiValidateModule_(mod, needQ);
        var words = moduleWords_(mod);
        if (!errs.length && words < (Number(s.ai.wordsMin) || 800) * 0.7) {
          state.log.push('⟳ الوحدة ' + (i + 1) + ' قصيرة (' + words + ' كلمة) — إعادة التوليد بتوسيع.');
          var mod2 = extractJson_(aiCall_(AI_SYSTEM, aiModulePrompt_(inp, state.plan, i, true), null, 'module')); addUsage_(state);
          var errs2 = aiValidateModule_(mod2, needQ);
          if (!errs2.length && moduleWords_(mod2) > words) { mod = mod2; words = moduleWords_(mod2); }
        }
        if (errs.length) fail('AI_JSON', 'الوحدة ' + (i + 1) + ': ' + errs.join(' '));
        if (words < (Number(s.ai.wordsMin) || 800)) state.warnings.push('الوحدة ' + (i + 1) + ': عدد الكلمات ' + words + ' أقل من الحد ' + s.ai.wordsMin + ' — راجعها يدويًا.');
        if (words > (Number(s.ai.wordsMax) || 1200) * 1.3) state.warnings.push('الوحدة ' + (i + 1) + ': عدد الكلمات ' + words + ' يتجاوز الحد ' + s.ai.wordsMax + ' بكثير — اختصرها عند المراجعة.');
        state.modules[i] = mod;
        state.log.push('✔ الوحدة ' + (i + 1) + ': ' + mod.title + ' (' + words + ' كلمة، ' + mod.questions.length + ' أسئلة)');
      } else if (stage === 'final') {
        var fq = extractJson_(aiCall_(AI_SYSTEM, aiFinalPrompt_(inp, state.plan, state.modules), 6000, 'final')); addUsage_(state);
        var qs = Array.isArray(fq.questions) ? fq.questions : [];
        var e2 = aiValidateModule_({ title: 'x', objectives: [1, 2, 3], sections: [1], questions: qs }, Number(s.finalQuestions) || 10);
        if (e2.length) fail('AI_JSON', 'الاختبار النهائي: ' + e2.join(' '));
        state.finalQuiz = { questions: qs };
        state.log.push('✔ الاختبار النهائي: ' + qs.length + ' أسئلة');
      } else if (stage === 'validate') {
        var content = sanitizeContent_({ objectives: state.plan.objectives, modules: state.modules, finalQuiz: state.finalQuiz });
        var issues = wsValidateContent_(content, inp.passScore);
        state.validated = content;
        if (issues.length) { state.warnings = state.warnings.concat(issues); state.log.push('⚠ التحقق أظهر ' + issues.length + ' ملاحظة — ستُحفظ كمسودة للمراجعة.'); }
        else state.log.push('✔ التحقق من البنية والمحتوى ناجح.');
      } else if (stage === 'save') {
        var created = wsCreate_(user, { title: state.plan.title, description: state.plan.description || inp.description, audience: inp.audience, passScore: inp.passScore,
          targetDepartments: inp.targetDepartments, content: state.validated, source: 'ai' });
        rec = updateRowAt_(SHEETS.AIJOBS, rec, { workshopId: created.workshop.id });
        state.log.push('✔ تم الحفظ كمسودة بانتظار المراجعة البشرية.');
      }
      idx++;
      var done = idx >= state.stages.length;
      rec = jobSave_(rec, state, { stageIndex: idx, stage: done ? 'done' : state.stages[idx], status: done ? 'done' : 'running', error: '' });
    } catch (e) {
      var msg = e && e.name === 'AppError' ? e.message : 'خطأ غير متوقع أثناء المرحلة.';
      if (!(e && e.name === 'AppError')) console.error('ai step: ' + (e && e.stack || e));
      state.log.push('✖ ' + stage + ': ' + msg);
      rec = jobSave_(rec, state, { status: 'failed', error: msg });
    }
    return { job: jobPublic_(rec) };
  } finally {
    cacheDel_(leaseKey);
  }
}

/** المسار اليدوي: استيراد JSON ورشة كاملة بعد فحصه (dryRun=true للفحص فقط) */
function aiImportJson_(user, p) {
  var raw = String(p.json || '');
  if (!raw.trim()) fail('VALIDATION', 'الصق JSON الورشة أولًا.');
  if (raw.length > LIMITS.MAX_JSON_IMPORT_BYTES) fail('VALIDATION', 'حجم JSON كبير جدًا.');
  var obj = extractJson_(raw);
  if (!obj || typeof obj !== 'object' || !obj.title || !Array.isArray(obj.modules)) fail('VALIDATION', 'JSON لا يحتوي على عنوان وقائمة وحدات.');
  var content = sanitizeContent_(obj);
  var ps = parseInt(p.passScore, 10) || getSettings_().defaultPassScore || 80;
  var issues = wsValidateContent_(content, ps);
  if (p.dryRun) return { issues: issues, summary: { title: cleanText_(obj.title, 200), modules: content.modules.length, finalQuestions: content.finalQuiz.questions.length, words: content.modules.map(moduleWords_) } };
  var created = wsCreate_(user, { title: obj.title, description: obj.description || '', audience: p.audience || obj.audience || '', passScore: ps, targetDepartments: p.targetDepartments || [], content: content, source: 'ai-manual' });
  return { workshop: created.workshop, issues: issues };
}

/** هيكل أولي قابل للتحرير بدون ذكاء اصطناعي */
function aiSkeleton_(p) {
  var inp = aiNormalizeInput_(p);
  var s = getSettings_();
  var outline = inp.outline ? inp.outline.split(/[،,\n;؛]+/).map(function (x) { return x.trim(); }).filter(Boolean) : [];
  var mods = [];
  for (var i = 0; i < inp.moduleCount; i++) {
    var t = outline[i] || ('الوحدة ' + (i + 1) + ': ' + inp.topic);
    var qs = []; for (var q = 0; q < (Number(s.moduleQuestions) || 5); q++) qs.push({ text: '', options: ['', '', '', ''], answer: 0, explanation: '' });
    mods.push({ title: t, summary: '', objectives: ['يحدد المتدرب ...', 'يطبق المتدرب ...', 'يميز المتدرب بين ...'],
      sections: [{ type: 'text', title: 'مقدمة', body: '' }, { type: 'text', title: 'المفاهيم الأساسية', body: '' }, { type: 'steps', title: 'خطوات التطبيق الصفي', items: [''] },
        { type: 'example', title: 'مثال من المرحلة الإعدادية', body: '' }, { type: 'warning', title: 'أخطاء شائعة', body: '' }, { type: 'remember', title: 'نقاط للتذكر', items: [''] }, { type: 'activity', title: 'نشاط تأملي', body: '' }],
      resources: [], questions: qs });
  }
  var fq = []; for (var k = 0; k < (Number(s.finalQuestions) || 10); k++) fq.push({ text: '', options: ['', '', '', ''], answer: 0, explanation: '' });
  return { title: inp.topic, description: inp.description, objectives: ['', '', ''], modules: mods, finalQuiz: { questions: fq } };
}


/* ######################## Admin.gs ######################## */

/**
 * Admin.gs — لوحة الإدارة: نظرة عامة، المستخدمون، النتائج، التقارير، الإعدادات، السجل
 * ------------------------------------------------------------
 * كل المؤشرات تُحسب من البيانات الفعلية في الجداول عند الطلب.
 */

/* ---------- نظرة عامة ---------- */
function adminOverview_() {
  var users = readTable_(SHEETS.USERS), ws = readTable_(SHEETS.WORKSHOPS), results = readTable_(SHEETS.RESULTS),
    certs = readTable_(SHEETS.CERTIFICATES), progress = readTable_(SHEETS.PROGRESS), mail = readTable_(SHEETS.MAIL), attempts = readTable_(SHEETS.ATTEMPTS);
  var active = users.filter(function (u) { return u.status === USER_STATUS.ACTIVE && u.role === ROLES.TRAINEE; });
  var published = ws.filter(function (w) { return w.status === WS_STATUS.PUBLISHED; });
  var passedResults = results.filter(function (r) { return truthy_(r.passed); });
  var wsMap = indexBy_(ws);
  var byWs = published.map(function (w) {
    var started = progress.filter(function (p) { return p.workshopId === w.id; }).length;
    var passed = passedResults.filter(function (r) { return r.workshopId === w.id; }).length;
    var ps = results.filter(function (r) { return r.workshopId === w.id; }).map(function (r) { return Number(r.bestPercent) || 0; });
    return { id: w.id, title: w.title, started: started, passed: passed, completion: started ? Math.round(passed / started * 100) : 0,
      avgBest: ps.length ? Math.round(ps.reduce(function (a, b) { return a + b; }, 0) / ps.length) : 0, scheduledAt: w.scheduledAt };
  });
  var userMap = indexBy_(users);
  var depts = {};
  active.forEach(function (u) { var d = u.department || 'غير محدد'; depts[d] = depts[d] || { department: d, staff: 0, participants: 0, passed: 0, certificates: 0 }; depts[d].staff++; });
  var participated = {};
  progress.forEach(function (p) { var u = userMap[p.userId]; if (!u) return; var d = u.department || 'غير محدد'; depts[d] = depts[d] || { department: d, staff: 0, participants: 0, passed: 0, certificates: 0 }; if (!participated[p.userId]) { participated[p.userId] = 1; depts[d].participants++; } });
  passedResults.forEach(function (r) { var u = userMap[r.userId]; if (!u) return; var d = u.department || 'غير محدد'; if (depts[d]) depts[d].passed++; });
  certs.forEach(function (c) { var u = userMap[c.userId]; if (!u || c.kind !== 'trainee' || c.revokedAt) return; var d = u.department || 'غير محدد'; if (depts[d]) depts[d].certificates++; });
  var recent = attempts.filter(function (a) { return a.status === 'submitted'; }).sort(function (a, b) { return String(b.submittedAt).localeCompare(String(a.submittedAt)); }).slice(0, 10)
    .map(function (a) { var u = userMap[a.userId] || {}; var w = wsMap[a.workshopId] || {}; return { name: u.name || '—', department: u.department || '', workshop: w.title || '—', kind: a.kind, moduleIndex: Number(a.moduleIndex), percent: Number(a.percent), passed: truthy_(a.passed), at: a.submittedAt }; });
  var uniqueParticipants = Object.keys(participated).length;
  return {
    kpis: {
      trainees: active.length, pendingUsers: users.filter(function (u) { return u.status === USER_STATUS.PENDING; }).length,
      suspendedUsers: users.filter(function (u) { return u.status === USER_STATUS.SUSPENDED; }).length,
      admins: users.filter(function (u) { return u.role === ROLES.ADMIN && u.status === USER_STATUS.ACTIVE; }).length,
      workshopsPublished: published.length, workshopsDraft: ws.filter(function (w) { return w.status === WS_STATUS.DRAFT; }).length,
      workshopsUnpublished: ws.filter(function (w) { return w.status === WS_STATUS.UNPUBLISHED; }).length,
      workshopsArchived: ws.filter(function (w) { return w.status === WS_STATUS.ARCHIVED; }).length,
      participants: uniqueParticipants, participationRate: active.length ? Math.round(uniqueParticipants / active.length * 100) : 0,
      passed: passedResults.length, certificates: certs.filter(function (c) { return c.kind === 'trainee' && !c.revokedAt; }).length,
      completionRate: progress.length ? Math.round(passedResults.length / progress.length * 100) : 0,
      mailFailed: mail.filter(function (m) { return m.status === MAIL_STATUS.FAILED; }).length,
      mailQueued: mail.filter(function (m) { return m.status === MAIL_STATUS.QUEUED; }).length,
      attempts: attempts.filter(function (a) { return a.status === 'submitted'; }).length
    },
    byWorkshop: byWs, byDepartment: Object.keys(depts).map(function (k) { return depts[k]; }).sort(function (a, b) { return b.staff - a.staff; }), recent: recent,
    aiKey: aiKeyStatus_(), mailQuota: mailQuota_(), version: APP.VERSION
  };
}

/* ---------- المستخدمون ---------- */
function adminUsersList_(p) {
  var results = readTable_(SHEETS.RESULTS);
  var list = readTable_(SHEETS.USERS).map(function (u) {
    var o = publicUser_(u);
    o.passedCount = results.filter(function (r) { return r.userId === u.id && truthy_(r.passed); }).length;
    o.notes = u.notes;
    return o;
  });
  if (p && p.q) { var q = String(p.q).toLowerCase(); list = list.filter(function (u) { return (u.name + ' ' + u.email + ' ' + u.department + ' ' + u.jobTitle).toLowerCase().indexOf(q) !== -1; }); }
  if (p && p.status) list = list.filter(function (u) { return u.status === p.status; });
  if (p && p.role) list = list.filter(function (u) { return u.role === p.role; });
  return { users: list.sort(function (a, b) { return String(b.createdAt).localeCompare(String(a.createdAt)); }) };
}
function assertNotLastAdmin_(target, willRemainAdmin) {
  if (target.role !== ROLES.ADMIN || target.status !== USER_STATUS.ACTIVE) return;
  if (willRemainAdmin) return;
  var others = readTable_(SHEETS.USERS).filter(function (u) { return u.id !== target.id && u.role === ROLES.ADMIN && u.status === USER_STATUS.ACTIVE; });
  if (!others.length) fail('LAST_ADMIN', 'لا يمكن إيقاف آخر مدير نشط أو حذفه أو سحب صلاحياته.');
}
function adminUserUpdate_(admin, p) {
  var u = findById_(SHEETS.USERS, p.id);
  if (!u) fail('NOT_FOUND', 'المستخدم غير موجود.');
  var patch = { updatedAt: nowIso_() };
  if (p.name !== undefined) { var n = cleanText_(p.name, 80); if (n.length < 3) fail('VALIDATION', 'الاسم قصير جدًا.'); patch.name = n; }
  if (p.jobTitle !== undefined) patch.jobTitle = cleanText_(p.jobTitle, 60);
  if (p.department !== undefined) patch.department = cleanText_(p.department, 60);
  if (p.notes !== undefined) patch.notes = cleanText_(p.notes, 500);
  if (p.role !== undefined) { if ([ROLES.ADMIN, ROLES.TRAINEE].indexOf(p.role) === -1) fail('VALIDATION', 'صلاحية غير صالحة.'); patch.role = p.role; }
  if (p.status !== undefined) { if ([USER_STATUS.ACTIVE, USER_STATUS.SUSPENDED, USER_STATUS.PENDING].indexOf(p.status) === -1) fail('VALIDATION', 'حالة غير صالحة.'); patch.status = p.status; if (p.status === USER_STATUS.ACTIVE) patch.emailVerified = 'TRUE'; }
  var remainsAdmin = (patch.role || u.role) === ROLES.ADMIN && (patch.status || u.status) === USER_STATUS.ACTIVE;
  if (u.id === admin.id && !remainsAdmin) fail('SELF', 'لا يمكنك سحب صلاحياتك أو إيقاف حسابك بنفسك.');
  assertNotLastAdmin_(u, remainsAdmin);
  if (p.resetPassword) { validatePassword_(p.resetPassword); var h = hashPassword_(p.resetPassword); patch.passHash = h.hash; patch.passSalt = h.salt; patch.passIter = h.iter; }
  updateRowAt_(SHEETS.USERS, u, patch);
  if (patch.status === USER_STATUS.SUSPENDED || patch.status === USER_STATUS.PENDING || p.resetPassword || (patch.role && patch.role !== ROLES.ADMIN)) revokeUserSessions_(u.id);
  audit_(admin, 'user_update', u.id, Object.keys(patch).filter(function (k) { return k.indexOf('pass') !== 0; }).reduce(function (o, k) { o[k] = patch[k]; return o; }, {}));
  return { user: publicUser_(u) };
}
/** إضافة مستخدم/مدير يدويًا من الإدارة — يصله رمز دعوة لتعيين كلمة مروره (لا صلاحية دون إثبات ملكية البريد) */
function adminUserCreate_(admin, p) {
  var email = normEmail_(p.email), name = cleanText_(p.name, 80);
  if (!isEmail_(email) || name.length < 3) fail('VALIDATION', 'يُرجى إدخال الاسم والبريد بشكل صحيح.');
  if (findOne_(SHEETS.USERS, function (u) { return u.email === email; })) fail('EXISTS', 'البريد مسجل مسبقًا.');
  var role = p.role === ROLES.ADMIN ? ROLES.ADMIN : ROLES.TRAINEE;
  var h = hashPassword_(randomToken_(16));
  var user = insertRow_(SHEETS.USERS, {
    id: newId_('usr'), name: name, email: email, jobTitle: cleanText_(p.jobTitle, 60), department: cleanText_(p.department, 60), role: role,
    status: USER_STATUS.PENDING, emailVerified: 'FALSE', passHash: h.hash, passSalt: h.salt, passIter: h.iter, createdAt: nowIso_(), updatedAt: nowIso_(), lastLoginAt: '', notes: cleanText_(p.notes, 500)
  });
  var s = getSettings_();
  if (!emailAllowed_(email)) { s.allowedEmails = (s.allowedEmails || []).concat([email]); setSetting_('allowedEmails', s.allowedEmails); }
  var code = issueCode_(user.id, 'reset', 60 * 24);
  var mail = sendMail_({
    kind: 'reset', to: email, refKey: 'invite:' + user.id + ':' + Date.now(), subject: 'دعوة للانضمام — ' + APP.NAME,
    html: mailFrame_('دعوة للانضمام إلى المنصة', '<p>مرحبًا ' + htmlEscape_(name) + '،</p><p>تمت إضافتك إلى المنصة بصفة <b>' + (role === ROLES.ADMIN ? 'مدير' : 'متدرب') + '</b>. لتفعيل حسابك: افتح المنصة، اختر «نسيت كلمة المرور»، أدخل بريدك ثم الرمز التالي (صالح 24 ساعة) وعيّن كلمة مرورك:</p>' + codeBox_(code))
  });
  audit_(admin, 'user_create', user.id, { email: email, role: role });
  return { user: publicUser_(user), mailSent: mail.ok };
}
function adminUserDelete_(admin, p) {
  var u = findById_(SHEETS.USERS, p.id);
  if (!u) fail('NOT_FOUND', 'المستخدم غير موجود.');
  if (u.id === admin.id) fail('SELF', 'لا يمكنك حذف حسابك.');
  assertNotLastAdmin_(u, false);
  var impact = { results: readTable_(SHEETS.RESULTS).filter(function (r) { return r.userId === u.id; }).length, certificates: readTable_(SHEETS.CERTIFICATES).filter(function (c) { return c.userId === u.id; }).length };
  if (!p.confirm) return { confirmRequired: true, impact: impact, name: u.name };
  withLock_(function () {
    revokeUserSessions_(u.id);
    deleteRowsWhere_(SHEETS.TOKENS, function (t) { return t.userId === u.id; });
    deleteRowsWhere_(SHEETS.PROGRESS, function (t) { return t.userId === u.id; });
    deleteRowById_(SHEETS.USERS, u.id);
  });
  audit_(admin, 'user_delete', u.id, { email: u.email, impact: impact });
  return { deleted: true, kept: impact };
}

/* ---------- النتائج والتقارير ---------- */
function adminResultsRows_(p) {
  p = p || {};
  var users = indexBy_(readTable_(SHEETS.USERS));
  var ws = indexBy_(readTable_(SHEETS.WORKSHOPS));
  var results = readTable_(SHEETS.RESULTS);
  var progress = readTable_(SHEETS.PROGRESS);
  var certs = {}; readTable_(SHEETS.CERTIFICATES).forEach(function (c) { if (c.kind === 'trainee') certs[c.id] = c; });
  var resMap = {}; results.forEach(function (r) { resMap[r.userId + '|' + r.workshopId] = r; });
  // الصفوف = سجلات التقدم + النتائج التي لا يقابلها سجل تقدم (مثلًا بعد حذف ورشة)
  var seen = {};
  progress.forEach(function (pr) { seen[pr.userId + '|' + pr.workshopId] = 1; });
  var base = progress.slice();
  results.forEach(function (r) { if (!seen[r.userId + '|' + r.workshopId]) base.push({ userId: r.userId, workshopId: r.workshopId, startedAt: r.updatedAt, modulesDone: '[]' }); });
  var rows = base.map(function (pr) {
    var u = users[pr.userId] || {}, w = ws[pr.workshopId] || {};
    var r = resMap[pr.userId + '|' + pr.workshopId];
    var c = r && r.certificateId ? certs[r.certificateId] : null;
    var snap = c ? (unpackChunks_(c, 's', 4) || {}) : {};
    return { userId: pr.userId, name: u.name || snap.name || '—', email: u.email || snap.email || '', department: u.department || '', jobTitle: u.jobTitle || '',
      workshopId: pr.workshopId, workshop: w.title || snap.workshopTitle || 'ورشة محذوفة', startedAt: pr.startedAt, modulesDone: parseJson_(pr.modulesDone, []).length, moduleCount: Number(w.moduleCount) || 0,
      attempts: r ? Number(r.attemptCount) || 0 : 0, bestPercent: r ? Number(r.bestPercent) || 0 : null, lastPercent: r ? Number(r.lastPercent) || 0 : null,
      status: r && truthy_(r.passed) ? 'passed' : (r ? 'failed' : 'inprogress'), passedAt: r ? r.passedAt : '', certificateSerial: c ? c.serial : '', certificateId: c ? c.id : '' };
  });
  if (p.q) { var q = String(p.q).toLowerCase(); rows = rows.filter(function (r) { return (r.name + ' ' + r.email + ' ' + r.workshop + ' ' + r.department).toLowerCase().indexOf(q) !== -1; }); }
  if (p.workshopId) rows = rows.filter(function (r) { return r.workshopId === p.workshopId; });
  if (p.department) rows = rows.filter(function (r) { return r.department === p.department; });
  if (p.status) rows = rows.filter(function (r) { return r.status === p.status; });
  if (p.from) rows = rows.filter(function (r) { return String(r.passedAt || r.startedAt).substr(0, 10) >= String(p.from).substr(0, 10); });
  if (p.to) rows = rows.filter(function (r) { return String(r.passedAt || r.startedAt).substr(0, 10) <= String(p.to).substr(0, 10); });
  return rows.sort(function (a, b) { return String(b.passedAt || b.startedAt).localeCompare(String(a.passedAt || a.startedAt)); });
}
function adminResults_(p) { var rows = adminResultsRows_(p); return { rows: rows.slice(0, Number(p && p.limit) || 1000), total: rows.length }; }

/** CSV بترميز UTF-8 مع BOM (يفتح في Excel بالعربية) وحماية من حقن الصيغ */
function csvCell_(v) {
  var s = String(v === null || v === undefined ? '' : v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  if (/[",\n\r]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
  return s;
}
function toCsv_(headers, rows) {
  var lines = [headers.map(csvCell_).join(',')];
  rows.forEach(function (r) { lines.push(r.map(csvCell_).join(',')); });
  return '﻿' + lines.join('\r\n');
}
function adminResultsCsv_(p) {
  var rows = adminResultsRows_(p);
  var statusAr = { passed: 'اجتاز', failed: 'لم يجتز', inprogress: 'قيد التقدم' };
  var csv = toCsv_(['الاسم', 'البريد', 'القسم', 'المسمى الوظيفي', 'الورشة', 'تاريخ البدء', 'الوحدات المكتملة', 'عدد الوحدات', 'عدد المحاولات', 'أفضل نتيجة %', 'آخر نتيجة %', 'الحالة', 'تاريخ الاجتياز', 'رقم الشهادة'],
    rows.map(function (r) { return [r.name, r.email, r.department, r.jobTitle, r.workshop, fmtDate_(r.startedAt, true), r.modulesDone, r.moduleCount, r.attempts, r.bestPercent === null ? '' : r.bestPercent, r.lastPercent === null ? '' : r.lastPercent, statusAr[r.status], fmtDate_(r.passedAt, true), r.certificateSerial]; }));
  return { fileName: 'IKP-results-' + fmtDate_(nowIso_()) + '.csv', csv: csv, count: rows.length };
}
function adminReports_(p) {
  var ov = adminOverview_();
  var rows = adminResultsRows_(p || {});
  var monthly = {};
  rows.forEach(function (r) { if (r.status === 'passed' && r.passedAt) { var k = String(r.passedAt).substr(0, 7); monthly[k] = (monthly[k] || 0) + 1; } });
  var dist = { '0-49': 0, '50-69': 0, '70-79': 0, '80-89': 0, '90-100': 0 };
  rows.forEach(function (r) { if (r.bestPercent === null) return; var b = r.bestPercent; dist[b < 50 ? '0-49' : b < 70 ? '50-69' : b < 80 ? '70-79' : b < 90 ? '80-89' : '90-100']++; });
  var byJob = {};
  rows.forEach(function (r) { var j = r.jobTitle || 'غير محدد'; byJob[j] = byJob[j] || { jobTitle: j, participants: 0, passed: 0 }; byJob[j].participants++; if (r.status === 'passed') byJob[j].passed++; });
  return { kpis: ov.kpis, byWorkshop: ov.byWorkshop, byDepartment: ov.byDepartment, monthly: Object.keys(monthly).sort().map(function (k) { return { month: k, passed: monthly[k] }; }),
    distribution: dist, byJobTitle: Object.keys(byJob).map(function (k) { return byJob[k]; }), generatedAt: nowIso_(), filtered: rows.length };
}

/* ---------- الإعدادات ---------- */
function adminSettingsGet_() {
  var s = getSettings_();
  return { settings: s, aiKey: aiKeyStatus_(), webAppUrl: webAppUrl_(), mailQuota: mailQuota_(),
    limits: { pbkdf2: LIMITS.PBKDF2_ITERATIONS, mailPerRun: LIMITS.MAIL_MAX_PER_RUN, uploadKb: Math.round(LIMITS.MAX_UPLOAD_BYTES / 1024), aiJobsPerHour: LIMITS.AI_MAX_JOBS_PER_HOUR }, version: APP.VERSION };
}
function adminSettingsSave_(admin, p) {
  var allowed = ['allowedDomains', 'allowedEmails', 'blockedEmails', 'adminNotifyEmail', 'senderName', 'defaultPassScore', 'moduleQuestions', 'finalQuestions',
    'retryPolicy', 'maxAttempts', 'retryCooldownMin', 'showCorrectAnswers', 'shuffleQuestions', 'shuffleOptions', 'sessionHours', 'departments', 'jobTitles', 'certificate', 'ai', 'mail', 'branding'];
  var s = (p && p.settings && typeof p.settings === 'object') ? p.settings : {};
  var saved = [];
  var fileId = function (v) { v = cleanText_(v, 80); return /^[A-Za-z0-9_-]*$/.test(v) ? v : ''; };
  allowed.forEach(function (k) {
    if (s[k] === undefined) return;
    var v = s[k];
    if (['allowedDomains', 'allowedEmails', 'blockedEmails', 'departments', 'jobTitles'].indexOf(k) !== -1) {
      if (!Array.isArray(v)) fail('VALIDATION', k + ' يجب أن يكون قائمة.');
      v = v.map(function (x) { return cleanText_(x, 80); }).filter(Boolean).slice(0, 100);
      if (k === 'allowedDomains') { v = v.map(function (d) { return d.toLowerCase().replace(/^@/, ''); }); if (!v.length) fail('VALIDATION', 'يجب أن يبقى نطاق واحد على الأقل.'); }
      if (k === 'allowedEmails' || k === 'blockedEmails') { v = v.map(normEmail_); var bad = v.filter(function (e) { return !isEmail_(e); }); if (bad.length) fail('VALIDATION', 'عناوين غير صالحة: ' + bad.join('، ')); }
    }
    if (k === 'adminNotifyEmail') { v = normEmail_(v); if (v && !isEmail_(v)) fail('VALIDATION', 'البريد الإداري غير صالح.'); }
    if (k === 'senderName') v = cleanText_(v, 80);
    if (['defaultPassScore', 'moduleQuestions', 'finalQuestions', 'maxAttempts', 'retryCooldownMin', 'sessionHours'].indexOf(k) !== -1) {
      v = parseInt(v, 10); if (isNaN(v) || v < 0) fail('VALIDATION', k + ' قيمة غير صالحة.');
      if (k === 'defaultPassScore' && !(v >= 1 && v <= 100)) fail('VALIDATION', 'نسبة النجاح يجب أن تكون بين 1 و100.');
      if ((k === 'moduleQuestions' || k === 'finalQuestions' || k === 'maxAttempts' || k === 'sessionHours') && v < 1) fail('VALIDATION', k + ' يجب أن يكون 1 على الأقل.');
      if (k === 'sessionHours' && v > 24 * 30) fail('VALIDATION', 'مدة الجلسة القصوى 720 ساعة.');
    }
    if (k === 'shuffleQuestions' || k === 'shuffleOptions') v = truthy_(v);
    if (k === 'retryPolicy' && ['unlimited', 'limited'].indexOf(v) === -1) fail('VALIDATION', 'سياسة إعادة المحاولة غير صالحة.');
    if (k === 'showCorrectAnswers' && ['never', 'afterPass', 'always'].indexOf(v) === -1) fail('VALIDATION', 'سياسة عرض الإجابات غير صالحة.');
    if (k === 'certificate') {
      var c = Object.assign({}, DEFAULT_SETTINGS.certificate, (v && typeof v === 'object') ? v : {});
      ['title', 'intro', 'body', 'outro', 'trainerTitle', 'trainerBody', 'trainerOutro'].forEach(function (f) { c[f] = cleanText_(c[f], 400); });
      c.signers = (Array.isArray(c.signers) ? c.signers : []).slice(0, 3).map(function (x) { x = x || {}; return { name: cleanText_(x.name, 80), title: cleanText_(x.title, 80), imageId: fileId(x.imageId) }; });
      ['stampImageId', 'headerImageId', 'footerImageId'].forEach(function (f) { c[f] = fileId(c[f]); });
      c.showScore = truthy_(c.showScore); if (!/^#[0-9a-f]{6}$/i.test(c.accent)) c.accent = DEFAULT_SETTINGS.certificate.accent;
      v = c;
    }
    if (k === 'branding') { v = (v && typeof v === 'object') ? v : {}; v = { headerImageId: fileId(v.headerImageId), footerImageId: fileId(v.footerImageId) }; }
    if (k === 'ai') {
      v = (v && typeof v === 'object') ? v : {};
      var model = cleanText_(v.model || DEFAULT_SETTINGS.ai.model, 60);
      if (!/^[a-z0-9.-]+$/i.test(model)) fail('VALIDATION', 'معرّف النموذج غير صالح.');
      v = { model: model, effort: ['low', 'medium', 'high'].indexOf(v.effort) === -1 ? DEFAULT_SETTINGS.ai.effort : v.effort,
        maxTokens: Math.min(32000, Math.max(1000, parseInt(v.maxTokens, 10) || 8000)), wordsMin: Math.max(100, parseInt(v.wordsMin, 10) || 800), wordsMax: Math.max(200, parseInt(v.wordsMax, 10) || 1200),
        fallbacks: v.fallbacks === undefined ? true : truthy_(v.fallbacks), structured: v.structured === undefined ? true : truthy_(v.structured) };
      if (v.wordsMax < v.wordsMin) fail('VALIDATION', 'الحد الأقصى للكلمات يجب أن يكون أكبر من الحد الأدنى.');
    }
    if (k === 'mail') { v = (v && typeof v === 'object') ? v : {}; v = { footer: cleanText_(v.footer, 300), noReply: truthy_(v.noReply) }; }
    setSetting_(k, v); saved.push(k);
  });
  audit_(admin, 'settings_save', '', { keys: saved });
  return adminSettingsGet_();
}

/* ---------- سجل العمليات ---------- */
function adminAudit_(p) {
  var list = readTable_(SHEETS.AUDIT).map(function (r) { return { id: r.id, at: r.at, actorEmail: r.actorEmail, action: r.action, target: r.target, details: r.details }; })
    .sort(function (a, b) { return String(b.at).localeCompare(String(a.at)); });
  if (p && p.q) { var q = String(p.q).toLowerCase(); list = list.filter(function (r) { return (r.actorEmail + ' ' + r.action + ' ' + r.target + ' ' + r.details).toLowerCase().indexOf(q) !== -1; }); }
  if (p && p.action) list = list.filter(function (r) { return r.action === p.action; });
  return { entries: list.slice(0, Number(p && p.limit) || 300), total: list.length };
}


/* ######################## Backup.gs ######################## */

/**
 * Backup.gs — النسخ الاحتياطي والاستعادة
 * ------------------------------------------------------------
 * النسخة تتضمن: المستخدمين (بدون كلمات المرور)، الورش وإصداراتها، التقدم، المحاولات، النتائج، الشهادات،
 * الإعدادات، سجل العمليات، سجل البريد.
 * النسخة تستبعد: كلمات المرور وأملاحها، الجلسات، رموز التحقق/الاستعادة، مفاتيح الخدمات (Script Properties)، مهام التوليد.
 * الاستيراد: فحص البنية ← معاينة (عدد السجلات والتعارضات) ← تنفيذ وفق سياسة (تجاهل المكرر | استبدال) ← تقرير.
 */

var BACKUP_TABLES = ['Users', 'Workshops', 'WorkshopVersions', 'Progress', 'Attempts', 'Results', 'Certificates', 'Settings', 'AuditLog', 'MailLog'];
var BACKUP_EXCLUDE = { Users: ['passHash', 'passSalt', 'passIter'] };

function backupExport_(admin) {
  var out = { format: 'ikp-backup', version: 2, app: APP.VERSION, schema: APP.SCHEMA_VERSION, exportedAt: nowIso_(), excludes: ['passwords', 'sessions', 'tokens', 'secrets', 'aijobs'], tables: {} };
  BACKUP_TABLES.forEach(function (t) {
    var ex = BACKUP_EXCLUDE[t] || [];
    out.tables[t] = readTable_(t).map(function (r) { var o = {}; Object.keys(r).forEach(function (k) { if (k !== '_row' && ex.indexOf(k) === -1) o[k] = r[k]; }); return o; });
  });
  audit_(admin, 'backup_export', '', { tables: BACKUP_TABLES.length });
  return { fileName: 'ikp-backup-' + fmtDate_(nowIso_()) + '.json', json: JSON.stringify(out) };
}
function backupParse_(json) {
  if (String(json || '').length > LIMITS.MAX_JSON_IMPORT_BYTES) fail('VALIDATION', 'حجم الملف يتجاوز الحد المسموح (4MB).');
  var data = parseJson_(json, null);
  if (!data || typeof data !== 'object' || data.format !== 'ikp-backup' || !data.tables || typeof data.tables !== 'object') fail('VALIDATION', 'الملف ليس نسخة احتياطية صالحة من هذه المنصة.');
  Object.keys(data.tables).forEach(function (t) {
    if (BACKUP_TABLES.indexOf(t) === -1) fail('VALIDATION', 'جدول غير معروف في الملف: ' + t);
    if (!Array.isArray(data.tables[t])) fail('VALIDATION', 'بنية الجدول ' + t + ' غير صالحة.');
  });
  return data;
}
function backupPreview_(p) {
  var data = backupParse_(p.json);
  var report = {};
  Object.keys(data.tables).forEach(function (t) {
    var keyField = t === 'Settings' ? 'key' : 'id';
    var existing = {}; readTable_(t).forEach(function (r) { existing[r[keyField]] = 1; });
    var rows = data.tables[t]; var dup = 0, invalid = 0, seenInFile = {};
    rows.forEach(function (r) {
      if (!r || typeof r !== 'object' || !r[keyField] || seenInFile[r[keyField]]) { invalid++; return; }
      seenInFile[r[keyField]] = 1;
      if (existing[r[keyField]]) dup++;
    });
    report[t] = { inFile: rows.length, existing: Object.keys(existing).length, conflicts: dup, invalid: invalid, willInsert: rows.length - dup - invalid };
  });
  return { exportedAt: data.exportedAt, app: data.app, report: report };
}
/** سياسة الاستيراد: mode = 'skip' (تجاهل المكرر — الافتراضي) | 'overwrite' (استبدال السجلات المطابقة بالمعرّف) */
function backupImport_(admin, p) {
  var data = backupParse_(p.json);
  var mode = p.mode === 'overwrite' ? 'overwrite' : 'skip';
  var result = {};
  withLock_(function () {
    Object.keys(data.tables).forEach(function (t) {
      var keyField = t === 'Settings' ? 'key' : 'id';
      var hdr = headersOf_(t);
      var existing = {}; readTable_(t).forEach(function (r) { existing[r[keyField]] = r; });
      var ins = [], upd = 0, skip = 0, rejected = [], seenInFile = {};
      data.tables[t].forEach(function (r, i) {
        if (!r || typeof r !== 'object' || !r[keyField]) { rejected.push('صف ' + (i + 1) + ': بلا معرّف'); return; }
        if (seenInFile[r[keyField]]) { rejected.push('صف ' + (i + 1) + ': معرّف مكرر داخل الملف'); return; }
        seenInFile[r[keyField]] = 1;
        var clean = {}; hdr.forEach(function (h) { if (r[h] !== undefined && r[h] !== null) clean[h] = (typeof r[h] === 'object') ? JSON.stringify(r[h]) : r[h]; });
        if (t === 'Users') {
          ['passHash', 'passSalt', 'passIter'].forEach(function (k) { delete clean[k]; });
          if (!isEmail_(String(clean.email || ''))) { rejected.push('صف ' + (i + 1) + ': بريد غير صالح'); return; }
          clean.email = normEmail_(clean.email);
          if ([ROLES.ADMIN, ROLES.TRAINEE].indexOf(clean.role) === -1) clean.role = ROLES.TRAINEE;
          if ([USER_STATUS.ACTIVE, USER_STATUS.PENDING, USER_STATUS.SUSPENDED].indexOf(clean.status) === -1) clean.status = USER_STATUS.PENDING;
        }
        if (existing[r[keyField]]) {
          if (mode === 'overwrite') { updateRowAt_(t, existing[r[keyField]], clean); upd++; } else skip++;
        } else {
          if (t === 'Users') { var h = hashPassword_(randomToken_(16)); clean.passHash = h.hash; clean.passSalt = h.salt; clean.passIter = h.iter; }
          ins.push(clean);
        }
      });
      insertRows_(t, ins);
      result[t] = { inserted: ins.length, updated: upd, skipped: skip, rejected: rejected.slice(0, 20), rejectedCount: rejected.length };
    });
    __settingsCache = null;
  });
  audit_(admin, 'backup_import', '', { mode: mode, summary: Object.keys(result).map(function (t) { return t + ':' + result[t].inserted + '/' + result[t].updated; }) });
  return { mode: mode, result: result, note: 'المستخدمون المستوردون بلا كلمات مرور — يستخدمون «نسيت كلمة المرور» لتعيينها.' };
}


/* ######################## Seed.gs ######################## */

/**
 * Seed.gs — المحتوى الأولي: ورشة «صياغة الأهداف السلوكية والتخطيط الفعّال للدروس»
 * ------------------------------------------------------------
 * تُزرع مرة واحدة عند الإعداد (لا تُكرر إذا كانت موجودة). المحتوى تعليمي حقيقي وليس بيانات وهمية،
 * وقد حُفظ من النسخة المرجعية كما هو بعد التحقق من اتساق الأسئلة مع المحتوى.
 */

var SEED_WORKSHOP_TITLE = 'صياغة الأهداف السلوكية والتخطيط الفعّال للدروس';

function seedInitialWorkshop_() {
  var exists = findOne_(SHEETS.WORKSHOPS, function (w) { return w.title === SEED_WORKSHOP_TITLE; });
  if (exists) return exists.id;
  var content = sanitizeContent_(seedWorkshopContent_());
  var issues = wsValidateContent_(content, 80);
  if (issues.length) throw new Error('محتوى الورشة الأولية غير صالح: ' + issues.join(' | '));
  var id = newId_('ws');
  var v = saveVersion_(null, id, content, 1);
  insertRow_(SHEETS.WORKSHOPS, {
    id: id, title: SEED_WORKSHOP_TITLE,
    description: 'ورشة تدريبية تطبيقية تمكّن المعلم من صياغة أهداف سلوكية قابلة للقياس وفق تصنيف بلوم، وبناء خطة درس فعّالة تربط الأهداف بالأنشطة والتقويم، مع نماذج من المرحلة الإعدادية.',
    audience: 'المعلمون والكادر المدرسي', category: 'التخطيط والتدريس', targetDepartments: '[]', passScore: 80, status: WS_STATUS.PUBLISHED,
    currentVersion: v.id, trainerName: '', trainerEmail: '', scheduledAt: '', durationMin: 120, location: 'قاعة التدريب — مدرسة ابن خلدون الإعدادية للبنين',
    createdBy: 'system', createdAt: nowIso_(), updatedAt: nowIso_(), publishedAt: nowIso_(), notifiedAt: '', trainerThankedAt: '', moduleCount: content.modules.length, source: 'seed'
  });
  audit_(null, 'seed_workshop', id, { title: SEED_WORKSHOP_TITLE });
  return id;
}

function seedWorkshopContent_() {
  return {
    objectives: [
      'يميّز المتدرب بين الأهداف العامة والأهداف السلوكية الخاصة.',
      'يصوغ المتدرب أهدافًا سلوكية مكتملة العناصر (السلوك، الشرط، المعيار) بأفعال إجرائية قابلة للملاحظة.',
      'يصنّف المتدرب الأهداف وفق مستويات تصنيف بلوم المعدّل في المجال المعرفي.',
      'يبني المتدرب خطة درس متكاملة تربط الأهداف بالأنشطة والتقويم والتغذية الراجعة.',
      'يقوّم المتدرب خطة درس جاهزة ويحدد مواطن القوة ومقترحات التحسين.'
    ],
    modules: [
      {
        title: 'مفهوم الهدف السلوكي وعناصره',
        summary: 'تعرض هذه الوحدة الفرق بين الغايات والأهداف العامة والأهداف السلوكية، وتشرح العناصر الثلاثة للهدف السلوكي المكتمل وكيفية التحقق منها.',
        objectives: [
          'يعرّف المتدرب الهدف السلوكي بلغته الخاصة.',
          'يميّز المتدرب بين الهدف العام والهدف السلوكي في أمثلة معطاة.',
          'يحدد المتدرب عناصر الهدف السلوكي الثلاثة في صياغات مختلفة.',
          'يحكم المتدرب على صياغة هدف معطى من حيث قابليته للملاحظة والقياس.'
        ],
        sections: [
          { type: 'text', title: 'مقدمة', body: 'يبدأ التدريس الفعّال بسؤال بسيط: ماذا أريد أن يكون طلابي قادرين على فعله في نهاية هذا الدرس؟ الإجابة عن هذا السؤال بدقة هي جوهر الهدف السلوكي. فالمعلم الذي يدخل الحصة بهدف واضح ومحدد يختار أنشطته بعناية، ويوزع وقته بحكمة، ويعرف بالضبط ما الذي سيقيسه في نهاية الدرس.\n\nالهدف السلوكي هو عبارة تصف بدقة الأداء الذي يُتوقع من الطالب إظهاره بعد مروره بخبرة تعليمية، بحيث يمكن ملاحظة هذا الأداء وقياسه. والكلمة المفتاحية هنا هي «الأداء»: فنحن لا نصف ما سيفعله المعلم، ولا ما «سيفهمه» الطالب في داخله، بل ما سيُظهره الطالب من سلوك يمكن رؤيته أو سماعه أو قراءته.' },
          { type: 'text', title: 'مستويات الأهداف: من الغاية إلى الهدف السلوكي', body: 'تتدرج الأهداف التربوية في ثلاثة مستويات. الغايات هي التوجهات الكبرى للنظام التعليمي، مثل «إعداد متعلم ريادي لتنمية مستدامة»، وهي عبارات واسعة تحتاج سنوات لتحقيقها. ثم تأتي الأهداف العامة على مستوى المقرر أو الوحدة الدراسية، مثل «أن يكتسب الطالب مهارات الكتابة الوظيفية». وأخيرًا تأتي الأهداف السلوكية الخاصة على مستوى الحصة الواحدة، مثل «أن يكتب الطالب رسالة رسمية من ثلاث فقرات مراعيًا عناصرها الخمسة».\n\nالفرق الجوهري بين المستويين الأخيرين أن الهدف العام يصف نتيجة واسعة قد تتحقق عبر دروس كثيرة، بينما الهدف السلوكي يصف أداءً محددًا يمكن التحقق منه في نهاية الحصة نفسها. والخطأ الشائع أن يكتب المعلم في خطة درسه أهدافًا عامة ثم يجد صعوبة في تقويمها.' },
          { type: 'text', title: 'العناصر الثلاثة للهدف السلوكي', body: 'يتكون الهدف السلوكي المكتمل من ثلاثة عناصر أساسية. أولها السلوك أو الأداء، وهو الفعل الإجرائي الذي يقوم به الطالب مثل: يكتب، يحل، يقارن، يصنف، يرسم. وثانيها الشرط أو الظرف، وهو الوضع الذي يُظهر فيه الطالب الأداء، مثل: «بعد قراءة النص»، «باستخدام الآلة الحاسبة»، «دون الرجوع إلى الكتاب». وثالثها المعيار أو مستوى الأداء المقبول، وهو الحد الأدنى الذي يُعد عنده الهدف متحققًا، مثل: «بنسبة صحة 80%»، «في مدة لا تتجاوز خمس دقائق»، «ذاكرًا ثلاثة أسباب على الأقل».\n\nليس شرطًا أن تُكتب العناصر الثلاثة صراحة في كل هدف يومي؛ فكثير من المدارس تكتفي بالسلوك والمحتوى، ويُفهم الشرط والمعيار من سياق الدرس وأداة التقويم. لكن المعلم الذي يتدرب على كتابة العناصر الثلاثة يكتسب دقة في التفكير تنعكس على جودة أسئلته وأنشطته.' },
          { type: 'table', title: 'مقارنة بين صياغات مقبولة وغير مقبولة', rows: [
            ['الصياغة', 'الحكم', 'السبب'],
            ['أن يفهم الطالب قانون نيوتن الثاني', 'غير مقبولة', '«يفهم» غير قابل للملاحظة المباشرة'],
            ['أن يحسب الطالب تسارع جسم معلومة قوته وكتلته بدقة تامة في ثلاث مسائل', 'مقبولة', 'سلوك واضح + شرط + معيار'],
            ['أن يشرح المعلم مفهوم الاستعارة', 'غير مقبولة', 'تصف عمل المعلم لا أداء الطالب'],
            ['أن يستخرج الطالب الاستعارة من النص ويبيّن طرفيها', 'مقبولة', 'أداء قابل للملاحظة مرتبط بالمحتوى'],
            ['أن يقدّر الطالب أهمية المحافظة على البيئة', 'تحتاج تعديلًا', 'هدف وجداني يحتاج مؤشر سلوكي مثل «يقترح ثلاث ممارسات»']
          ] },
          { type: 'example', title: 'مثال من المرحلة الإعدادية', body: 'في درس عن الكسور العشرية للصف السابع، كتب المعلم هدفًا أوليًا: «أن يتعلم الطالب الكسور العشرية». وبعد مراجعته أعاد صياغته إلى: «أن يحوّل الطالب كسرًا اعتياديًا إلى كسر عشري في خمسة تمارين، بنسبة صحة لا تقل عن 80%، مستخدمًا القسمة المطولة». لاحظ كيف أصبح الهدف الآن يحدد السلوك (يحوّل)، والشرط (مستخدمًا القسمة المطولة)، والمعيار (أربعة من خمسة). وفي نهاية الحصة صار بإمكان المعلم أن يعرف بوضوح من حقق الهدف ومن يحتاج دعمًا.' },
          { type: 'warning', title: 'أخطاء شائعة', body: 'من أكثر الأخطاء شيوعًا: استخدام أفعال غامضة مثل يعرف ويفهم ويدرك ويستوعب؛ ووصف نشاط المعلم بدلًا من أداء الطالب؛ وجمع أكثر من سلوك في هدف واحد مثل «يقرأ ويحلل ويقوّم»؛ وكتابة عدد كبير من الأهداف لحصة واحدة لا يمكن تحقيقها ولا قياسها في أربعين دقيقة. ومن الأخطاء أيضًا الخلط بين الهدف والنشاط، فعبارة «أن يشاهد الطالب فيديو عن البراكين» نشاط وليست هدفًا.' },
          { type: 'remember', title: 'نقاط للتذكر', items: [
            'الهدف السلوكي يصف أداء الطالب لا نشاط المعلم.',
            'الفعل الإجرائي يجب أن يكون قابلًا للملاحظة والقياس.',
            'العناصر الثلاثة: السلوك، الشرط، المعيار.',
            'هدف واحد = سلوك واحد.',
            'الهدف يحدد ما سيُقاس في نهاية الحصة.'
          ] },
          { type: 'activity', title: 'نشاط تأملي', body: 'اختر خطة درس كتبتها هذا الأسبوع، واقرأ أهدافها بعين الناقد: هل يمكنك أن تُثبت في نهاية الحصة أن كل هدف تحقق؟ أعد كتابة هدف واحد على الأقل بحيث يتضمن العناصر الثلاثة، ثم قارن بين الصياغتين ودوّن ما تغيّر في تصورك لأنشطة الدرس.' }
        ],
        resources: [],
        questions: [
          { text: 'أي العبارات التالية تُعد هدفًا سلوكيًا مقبولًا؟', options: ['أن يفهم الطالب مفهوم التمدد الحراري', 'أن يشرح المعلم مفهوم التمدد الحراري بالأمثلة', 'أن يفسّر الطالب سبب ترك فجوات بين قضبان السكك الحديدية مستندًا إلى مفهوم التمدد الحراري', 'أن يشاهد الطالب تجربة عن التمدد الحراري'], answer: 2, explanation: 'الخيار الصحيح يصف أداءً قابلًا للملاحظة يقوم به الطالب ويرتبط بالمحتوى.' },
          { text: 'العنصر الذي يحدد الحد الأدنى المقبول لأداء الطالب في الهدف السلوكي هو:', options: ['الشرط', 'المعيار', 'السلوك', 'المحتوى'], answer: 1, explanation: 'المعيار هو مستوى الأداء المقبول مثل نسبة الصحة أو الزمن أو العدد.' },
          { text: 'في الهدف: «أن يحل الطالب أربع مسائل على المعادلات الخطية دون استخدام الآلة الحاسبة»، عبارة «دون استخدام الآلة الحاسبة» تمثل:', options: ['المعيار', 'السلوك', 'الشرط', 'الهدف العام'], answer: 2, explanation: 'الشرط يصف الظرف الذي يُظهر فيه الطالب الأداء.' },
          { text: 'الفرق الجوهري بين الهدف العام والهدف السلوكي أن الهدف السلوكي:', options: ['يُكتب على مستوى المقرر الدراسي كاملًا', 'يصف أداءً محددًا يمكن التحقق منه في نهاية الحصة', 'يصف توجهات النظام التعليمي', 'لا يحتاج إلى تقويم'], answer: 1, explanation: 'الهدف السلوكي خاص بالحصة ويصف أداءً قابلًا للقياس في نهايتها.' },
          { text: 'عبارة «أن يقرأ الطالب النص ويحلله ويقوّمه» تُعد صياغة ضعيفة لأنها:', options: ['تستخدم أفعالًا غير إجرائية', 'تجمع أكثر من سلوك في هدف واحد', 'تصف نشاط المعلم', 'تفتقر إلى المحتوى'], answer: 1, explanation: 'القاعدة: هدف واحد لسلوك واحد حتى يمكن قياسه بدقة.' }
        ]
      },
      {
        title: 'تصنيف بلوم والأفعال الإجرائية',
        summary: 'تتناول هذه الوحدة المستويات الستة لتصنيف بلوم المعدّل في المجال المعرفي، والأفعال الإجرائية المناسبة لكل مستوى، وكيفية توزيع أهداف الدرس على مستويات التفكير المختلفة.',
        objectives: [
          'يرتّب المتدرب مستويات تصنيف بلوم المعدّل من الأدنى إلى الأعلى.',
          'يصنّف المتدرب أهدافًا معطاة وفق مستوياتها المعرفية.',
          'يختار المتدرب الفعل الإجرائي المناسب لكل مستوى من مستويات التصنيف.',
          'يصوغ المتدرب لدرس واحد أهدافًا تغطي ثلاثة مستويات معرفية على الأقل.'
        ],
        sections: [
          { type: 'text', title: 'لماذا نحتاج التصنيف؟', body: 'إذا راجعنا أهداف عدد كبير من خطط الدروس سنجد أن معظمها يتركز في مستوى التذكر: يعدد، يذكر، يسمي، يعرّف. وليس في ذلك عيب في حد ذاته، لكن الاقتصار عليه يعني أن الطالب يغادر الحصة دون أن يفكر، وأن الاختبار سيقيس الحفظ فقط. تصنيف بلوم أداة عملية تساعد المعلم على أن يسأل نفسه: في أي مستوى من التفكير أريد طلابي أن يعملوا اليوم؟\n\nنشر بنيامين بلوم وزملاؤه التصنيف الأصلي عام 1956، ثم أعاد أندرسون وكراثول تنقيحه عام 2001 بحيث أصبحت المستويات أفعالًا بدلًا من أسماء، وتبادل المستويان الأعليان موقعيهما، فصار «الإبداع» قمة الهرم.' },
          { type: 'table', title: 'المستويات الستة وأفعالها الإجرائية', rows: [
            ['المستوى', 'ما يفعله الطالب', 'أفعال إجرائية مقترحة'],
            ['التذكر', 'يسترجع المعلومات كما هي', 'يعدد، يذكر، يسمّي، يعرّف، يحدد'],
            ['الفهم', 'يبني معنى ويعبر بلغته', 'يشرح، يلخص، يعيد صياغة، يعطي مثالًا، يفسّر'],
            ['التطبيق', 'يستخدم ما تعلمه في موقف جديد', 'يحل، يحسب، ينفذ، يستخدم، يطبق'],
            ['التحليل', 'يفكك ويكتشف العلاقات', 'يقارن، يصنف، يميّز، يستنتج، يحلل'],
            ['التقويم', 'يصدر حكمًا وفق معايير', 'يحكم، ينقد، يبرر، يدافع عن، يرجّح'],
            ['الإبداع', 'ينتج شيئًا جديدًا', 'يصمم، يؤلف، يقترح، يبتكر، يخطط']
          ] },
          { type: 'text', title: 'كيف نوزّع أهداف الحصة على المستويات؟', body: 'القاعدة العملية أن يتضمن الدرس الواحد أهدافًا من مستويات متدرجة: هدف أو هدفان في المستويات الدنيا (التذكر والفهم) لبناء الأساس، وهدف في التطبيق، وهدف واحد على الأقل في المستويات العليا (التحليل أو التقويم أو الإبداع). هذا التدرج يجعل الحصة تبدأ بما يعرفه الطالب وتنتهي بما يتحداه.\n\nلا يعني ذلك أن كل درس يجب أن يصل إلى الإبداع؛ فطبيعة المحتوى وموقعه في الوحدة يحددان ذلك. لكن الأسبوع الدراسي كاملًا ينبغي أن يوفر للطالب فرصًا للعمل في المستويات العليا. ويمكن للمعلم أن يستخدم المصفوفة البسيطة التالية عند التخطيط: يكتب أهدافه في عمود، ثم يضع أمام كل هدف مستواه، ثم ينظر إلى التوزيع الكلي.' },
          { type: 'steps', title: 'خطوات صياغة هدف في مستوى محدد', items: [
            'حدد المفهوم أو المهارة الأساسية في الدرس.',
            'اسأل: ما الذي أريد أن يفعله الطالب بهذا المفهوم؟ (يتذكره؟ يشرحه؟ يستخدمه؟ يحلله؟)',
            'اختر فعلًا إجرائيًا من قائمة المستوى المناسب.',
            'أضف المحتوى والشرط إن لزم، ثم المعيار.',
            'تحقق: هل يمكن تصميم سؤال أو مهمة تقيس هذا الهدف تحديدًا؟'
          ] },
          { type: 'example', title: 'مثال من المرحلة الإعدادية', body: 'في درس اللغة العربية للصف الثامن عن أسلوب الشرط، وزّع المعلم أهدافه كالآتي: (التذكر) أن يعدد الطالب أدوات الشرط الجازمة؛ (الفهم) أن يشرح الطالب أثر أداة الشرط في فعلي الشرط والجواب بمثال من إنشائه؛ (التطبيق) أن يعرب الطالب جملة شرطية معطاة إعرابًا كاملًا؛ (التحليل) أن يميز الطالب بين أدوات الشرط الجازمة وغير الجازمة في فقرة من نص أدبي؛ (الإبداع) أن يكتب الطالب فقرة من خمس جمل شرطية عن دور الشباب في التنمية المستدامة. لاحظ أن الأهداف الخمسة تتدرج، وأن كل هدف يقود إلى نشاط وسؤال تقويمي مختلف.' },
          { type: 'warning', title: 'أخطاء شائعة', body: 'استخدام الفعل نفسه في كل الأهداف بغض النظر عن المستوى؛ والاعتقاد بأن المستويات العليا مناسبة للطلاب المتفوقين فقط، بينما الحقيقة أن جميع الطلاب يحتاجون فرصًا للتحليل والتقويم بمستويات دعم مختلفة؛ والخلط بين الفعل الإجرائي والمستوى، فالفعل «يكتب» مثلًا قد يكون في مستوى التذكر (يكتب التعريف) أو الإبداع (يكتب قصة قصيرة)، والحكم يعتمد على طبيعة المهمة لا الفعل وحده.' },
          { type: 'remember', title: 'نقاط للتذكر', items: [
            'المستويات الستة: تذكر، فهم، تطبيق، تحليل، تقويم، إبداع.',
            'الفعل وحده لا يحدد المستوى؛ طبيعة المهمة تحدده.',
            'درس واحد = مستويات متدرجة، وهدف واحد على الأقل في مستوى عالٍ.',
            'كل هدف يجب أن يقابله سؤال أو مهمة تقويم.'
          ] },
          { type: 'activity', title: 'نشاط تأملي', body: 'خذ أهداف آخر ثلاثة دروس درّستها، وصنّف كل هدف وفق مستواه في تصنيف بلوم. ما نسبة الأهداف في مستوى التذكر والفهم؟ إذا تجاوزت 70% ففكر في كيفية رفع هدف واحد في كل درس إلى مستوى التحليل أو التقويم دون تغيير المحتوى.' }
        ],
        resources: [],
        questions: [
          { text: 'الترتيب الصحيح لمستويات تصنيف بلوم المعدّل من الأدنى إلى الأعلى هو:', options: ['تذكر، فهم، تطبيق، تحليل، تقويم، إبداع', 'فهم، تذكر، تطبيق، تحليل، إبداع، تقويم', 'تذكر، تطبيق، فهم، تحليل، تقويم، إبداع', 'تذكر، فهم، تحليل، تطبيق، تقويم، إبداع'], answer: 0, explanation: 'في التصنيف المعدّل (2001) يحتل الإبداع القمة بعد التقويم.' },
          { text: 'الهدف «أن يقارن الطالب بين الخلية النباتية والخلية الحيوانية من حيث ثلاثة مكونات» يقع في مستوى:', options: ['التذكر', 'الفهم', 'التحليل', 'الإبداع'], answer: 2, explanation: 'المقارنة واكتشاف العلاقات والفروق من مهارات التحليل.' },
          { text: 'أي الأفعال التالية أنسب لهدف في مستوى التقويم؟', options: ['يعدد', 'يبرر', 'يحسب', 'يلخص'], answer: 1, explanation: 'التبرير يتطلب إصدار حكم ودعمه بمعايير أو أدلة.' },
          { text: 'الفعل «يكتب» في الهدف «أن يكتب الطالب قصة قصيرة من إنشائه تتضمن عناصر القصة» يدل على مستوى:', options: ['التذكر', 'التطبيق', 'الإبداع', 'الفهم'], answer: 2, explanation: 'إنتاج عمل جديد أصيل يقع في مستوى الإبداع؛ فالمستوى يتحدد بطبيعة المهمة لا بالفعل وحده.' },
          { text: 'التوزيع الأنسب لأهداف حصة واحدة وفق ما ورد في الوحدة هو:', options: ['جميع الأهداف في مستوى التذكر لضمان تحقيقها', 'أهداف متدرجة تشمل مستويات دنيا وتطبيقًا وهدفًا واحدًا على الأقل في مستوى عالٍ', 'جميع الأهداف في مستوى الإبداع', 'هدف واحد فقط في مستوى الفهم'], answer: 1, explanation: 'التدرج يبني الأساس ثم يتحدى الطالب في المستويات العليا.' }
        ]
      },
      {
        title: 'بناء خطة الدرس الفعّالة',
        summary: 'تقدم هذه الوحدة مكونات خطة الدرس المتكاملة، وتربط كل مكوّن بالأهداف السلوكية، وتشرح كيفية توزيع الزمن واختيار الاستراتيجيات ومراعاة الفروق الفردية.',
        objectives: [
          'يعدد المتدرب المكونات الأساسية لخطة الدرس.',
          'يربط المتدرب كل هدف سلوكي بنشاط تعليمي وأداة تقويم مناسبة.',
          'يوزع المتدرب زمن الحصة على مراحل الدرس بما يتناسب مع الأهداف.',
          'يصمم المتدرب خطة درس لحصة واحدة من مادته تراعي الفروق الفردية.'
        ],
        sections: [
          { type: 'text', title: 'الخطة بوصفها خريطة طريق', body: 'خطة الدرس ليست نموذجًا يُملأ لإرضاء المشرف، بل خريطة تفكير تسبق الحصة. المعلم الذي يخطط جيدًا لا يُفاجأ بانتهاء الوقت قبل الوصول إلى الفكرة الرئيسة، ولا يجد نفسه يرتجل نشاطًا لا يخدم الهدف. والمبدأ الحاكم للتخطيط الفعّال هو «الاتساق»: أن تتسق الأهداف مع الأنشطة، وتتسق الأنشطة مع التقويم، بحيث لو سألنا عن أي نشاط في الخطة «أي هدف يخدم هذا النشاط؟» وجدنا إجابة واضحة.\n\nيُعرف هذا المبدأ في أدبيات التصميم التعليمي بـ«الاتساق البنائي»، ويُقترح فيه أن يبدأ المعلم من الأهداف، ثم يحدد ما الذي سيقبله دليلًا على تحققها (التقويم)، ثم يصمم الأنشطة التي توصل الطالب إلى هذا الدليل. أي أن التقويم يُصمم قبل الأنشطة لا بعدها.' },
          { type: 'list', title: 'المكونات الأساسية لخطة الدرس', items: [
            'البيانات العامة: المادة، الصف، الوحدة، عنوان الدرس، التاريخ، عدد الحصص.',
            'معيار المنهج ومخرجات التعلم التي يخدمها الدرس.',
            'الأهداف السلوكية (3 إلى 5 أهداف لحصة واحدة عادة).',
            'المتطلبات السابقة: ما يجب أن يعرفه الطالب قبل الدرس وكيف سيتحقق المعلم منه.',
            'التهيئة: نشاط قصير يثير الانتباه ويربط بالخبرات السابقة.',
            'العرض والأنشطة: الاستراتيجيات والأنشطة مرتبة زمنيًا ومرتبطة بالأهداف.',
            'الوسائل والمصادر: ما يحتاجه المعلم والطالب.',
            'مراعاة الفروق الفردية: دعم للطلاب الذين يواجهون صعوبة وإثراء للمتقدمين.',
            'التقويم: تشخيصي في البداية، وتكويني أثناء الدرس، وختامي في نهايته.',
            'الغلق: تلخيص وربط بالهدف واستشراف الدرس القادم.',
            'الواجب والتأمل الذاتي للمعلم بعد التنفيذ.'
          ] },
          { type: 'table', title: 'نموذج توزيع زمن حصة مدتها 45 دقيقة', rows: [
            ['المرحلة', 'الزمن التقريبي', 'ما يحدث'],
            ['التهيئة والتحقق من المتطلبات السابقة', '5 دقائق', 'سؤال محفز، مراجعة سريعة، إعلان الأهداف'],
            ['العرض والنمذجة', '10 دقائق', 'شرح المفهوم الجديد مع مثال محلول'],
            ['الممارسة الموجهة', '12 دقيقة', 'عمل في مجموعات أو ثنائيات بمتابعة المعلم'],
            ['الممارسة المستقلة', '10 دقائق', 'مهمة فردية تقيس الهدف مباشرة'],
            ['الغلق والتقويم الختامي', '8 دقائق', 'بطاقة خروج، تلخيص، تمهيد للدرس القادم']
          ] },
          { type: 'text', title: 'الربط بين الهدف والنشاط والتقويم', body: 'الطريقة العملية لضمان الاتساق أن يُبنى جدول من ثلاثة أعمدة: الهدف، النشاط، أداة التقويم. فمثلًا: الهدف «أن يحسب الطالب مساحة المثلث في أربع مسائل بنسبة صحة 75%» يقابله نشاط «حل مسائل متدرجة في مجموعات ثم فرديًا» وأداة تقويم «ورقة عمل من أربع مسائل تُصحح في الحصة». وإذا وجد المعلم هدفًا بلا نشاط، أو نشاطًا بلا هدف، أو هدفًا بلا أداة تقويم، فالخطة تحتاج مراجعة.\n\nأما مراعاة الفروق الفردية فلا تعني كتابة عبارة عامة في نهاية الخطة، بل تخطيط ملموس: أسئلة متدرجة الصعوبة، ومهمة إثرائية جاهزة لمن ينهي مبكرًا، وبطاقة دعم أو مثال إضافي لمن يتعثر، وتوزيع مقصود للمجموعات.' },
          { type: 'example', title: 'مثال من المرحلة الإعدادية', body: 'خطط معلم العلوم للصف التاسع درسًا عن «الدوائر الكهربائية على التوالي والتوازي». بدأ بالتقويم: قرر أن بطاقة الخروج ستطلب من الطالب رسم دائرتين ووصف ما يحدث للمصابيح عند فك أحدها. ثم صاغ أهدافه: يميز بين نوعي التوصيل، ويرسم مخطط كل منهما، ويتنبأ بأثر فك مصباح. ثم صمم الأنشطة: تجربة عملية في مجموعات بمواد بسيطة، ثم رسم المخططات، ثم سؤال تنبؤي قبل التجربة الثانية. ولمراعاة الفروق أعدّ ورقة إثرائية عن حساب المقاومة الكلية للمتقدمين، وبطاقة مصورة للخطوات لمن يحتاج دعمًا. في التنفيذ تجاوز الوقت في التجربة الأولى، فدوّن في تأمله أن يقلص الشرح النظري في المرة القادمة.' },
          { type: 'warning', title: 'أخطاء شائعة', body: 'نسخ الخطة من العام الماضي دون مراجعة الأهداف والطلاب الجدد؛ وحشد أنشطة كثيرة جذابة لا تخدم الأهداف؛ وترك التقويم للنهاية فيُلغى عند ضيق الوقت؛ وكتابة «مراعاة الفروق الفردية» كعنوان دون إجراءات؛ وعدم تخصيص وقت للغلق فيغادر الطلاب دون تلخيص ما تعلموه.' },
          { type: 'remember', title: 'نقاط للتذكر', items: [
            'ابدأ من الأهداف، ثم صمم التقويم، ثم اختر الأنشطة.',
            'لكل هدف نشاط وأداة تقويم — والعكس صحيح.',
            'خصص زمنًا للتهيئة والغلق ولا تضحِّ بهما.',
            'الفروق الفردية إجراءات محددة لا عبارة عامة.',
            'التأمل بعد الحصة جزء من الخطة.'
          ] },
          { type: 'activity', title: 'نشاط تأملي', body: 'اختر درسًا ستدرّسه الأسبوع القادم وابنِ له جدول الاتساق (الهدف — النشاط — أداة التقويم). ثم راجع خطتك المعتادة: ما الأنشطة التي وجدت أنها لا تخدم هدفًا محددًا؟ وما الأهداف التي لا تملك لها أداة تقويم؟' }
        ],
        resources: [],
        questions: [
          { text: 'وفق مبدأ الاتساق البنائي، الترتيب الأنسب لخطوات التخطيط هو:', options: ['الأنشطة ثم الأهداف ثم التقويم', 'الأهداف ثم التقويم ثم الأنشطة', 'التقويم ثم الأنشطة ثم الأهداف', 'الأنشطة ثم التقويم ثم الأهداف'], answer: 1, explanation: 'نحدد الأهداف، ثم ما يُقبل دليلًا على تحققها، ثم الأنشطة الموصلة إليه.' },
          { text: 'وجد المعلم في خطته نشاط «مشاهدة فيديو عن الزلازل» ولم يجد هدفًا يخدمه. الإجراء الأنسب هو:', options: ['الإبقاء عليه لأنه جذاب للطلاب', 'حذفه أو تعديله ليخدم هدفًا محددًا', 'إضافة هدف «أن يشاهد الطالب الفيديو»', 'تحويله إلى واجب منزلي'], answer: 1, explanation: 'كل نشاط يجب أن يخدم هدفًا؛ والمشاهدة نشاط لا هدف.' },
          { text: 'أي الممارسات التالية تُعد مراعاة فعلية للفروق الفردية؟', options: ['كتابة عبارة «تُراعى الفروق الفردية» في نهاية الخطة', 'إعداد مهمة إثرائية لمن ينهي مبكرًا وبطاقة دعم لمن يتعثر', 'إعطاء جميع الطلاب الورقة نفسها والوقت نفسه', 'تأجيل دعم المتعثرين إلى حصة أخرى'], answer: 1, explanation: 'مراعاة الفروق إجراءات ملموسة داخل الحصة.' },
          { text: 'في حصة مدتها 45 دقيقة، المرحلة التي يُنصح بتخصيص نحو 8 دقائق لها ولا ينبغي التضحية بها عند ضيق الوقت هي:', options: ['التهيئة', 'الغلق والتقويم الختامي', 'العرض', 'الواجب المنزلي'], answer: 1, explanation: 'الغلق يثبت التعلم ويوفر دليل تحقق الأهداف.' },
          { text: 'جدول الاتساق في خطة الدرس يضم الأعمدة:', options: ['الهدف، النشاط، أداة التقويم', 'المادة، الصف، التاريخ', 'الوسائل، الواجب، الغلق', 'المعيار، الشرط، السلوك'], answer: 0, explanation: 'الجدول يتحقق من أن لكل هدف نشاطًا وأداة تقويم.' }
        ]
      },
      {
        title: 'التقويم المرتبط بالأهداف والتغذية الراجعة',
        summary: 'تشرح هذه الوحدة كيفية تصميم أدوات تقويم تقيس الأهداف السلوكية بدقة، وتوظيف التقويم التكويني والتغذية الراجعة الفعّالة، والتأمل في الخطة بعد تنفيذها.',
        objectives: [
          'يميّز المتدرب بين التقويم التشخيصي والتكويني والختامي من حيث التوقيت والغرض.',
          'يصمم المتدرب سؤال تقويم يقيس هدفًا سلوكيًا محددًا في مستواه المعرفي.',
          'يقدّم المتدرب تغذية راجعة محددة وقابلة للتنفيذ على أداء طالب.',
          'يقوّم المتدرب خطة درس بعد تنفيذها ويقترح تحسينات مبنية على أدلة.'
        ],
        sections: [
          { type: 'text', title: 'أنواع التقويم وتوقيتها', body: 'التقويم ليس حدثًا يقع في نهاية الوحدة فحسب، بل عملية مستمرة تبدأ قبل الدرس وتستمر خلاله وبعده. التقويم التشخيصي يسبق التعلم الجديد ويكشف ما يعرفه الطلاب وما يحملونه من مفاهيم خاطئة، ويكفي فيه سؤالان سريعان أو خريطة ذهنية جماعية. والتقويم التكويني يجري أثناء الدرس بأدوات خفيفة مثل لوحات الإجابة، والأسئلة الموجهة، وإشارات الإبهام، وبطاقات الخروج؛ وغرضه تعديل التدريس فورًا لا رصد درجة. أما التقويم الختامي فيأتي في نهاية الدرس أو الوحدة ليصدر حكمًا على مدى تحقق الأهداف.\n\nالمعلم الذي كتب أهدافًا سلوكية دقيقة في الوحدات السابقة سيجد أن تصميم التقويم صار أسهل بكثير: فالمعيار المذكور في الهدف هو نفسه محك النجاح في أداة التقويم.' },
          { type: 'table', title: 'مطابقة السؤال لمستوى الهدف', rows: [
            ['الهدف', 'سؤال غير مناسب', 'سؤال مناسب'],
            ['أن يفسّر الطالب سبب طفو السفينة رغم ثقلها', 'عرّف قوة الطفو', 'لماذا تطفو سفينة حديدية بينما يغرق مسمار من الحديد نفسه؟'],
            ['أن يقارن الطالب بين الحكم الملكي والجمهوري', 'اذكر تعريف الجمهورية', 'ما وجها الاختلاف والتشابه بين النظامين من حيث اختيار رئيس الدولة ومدة حكمه؟'],
            ['أن يحكم الطالب على صحة استدلال في نص', 'ما موضوع النص؟', 'هل الدليل الذي قدمه الكاتب كافٍ لدعم رأيه؟ برر إجابتك بمثالين من النص']
          ] },
          { type: 'text', title: 'التغذية الراجعة الفعّالة', body: 'تشير الدراسات التربوية بشكل متسق إلى أن التغذية الراجعة من أقوى العوامل تأثيرًا في تعلم الطلاب، بشرط أن تكون محددة وفي وقتها وموجهة نحو المهمة لا نحو شخص الطالب. فعبارة «ممتاز» أو «ضعيف» لا تخبر الطالب بما يفعله لاحقًا، بينما عبارة «حسابك للمساحة صحيح، لكنك نسيت كتابة الوحدة؛ أضف الوحدة في المسألتين التاليتين» تصف ما تحقق وما يجب فعله.\n\nيمكن تلخيص التغذية الراجعة الفعّالة في ثلاثة أسئلة يُجيب عنها المعلم للطالب: إلى أين تتجه؟ (الهدف)، أين أنت الآن؟ (الأداء الحالي مقارنة بالمعيار)، وما الخطوة التالية؟ (إجراء محدد). كما ينبغي أن تُعطى فرصة للطالب لتطبيق التغذية الراجعة، وإلا تحولت إلى تعليق يُقرأ ويُنسى.' },
          { type: 'steps', title: 'خطوات تصميم بطاقة خروج مرتبطة بالأهداف', items: [
            'اختر الهدف الأهم في الحصة (عادة هدف التطبيق أو التحليل).',
            'اكتب سؤالًا واحدًا أو مهمة قصيرة يستغرق حلها 3 إلى 5 دقائق ويقيس هذا الهدف تحديدًا.',
            'حدد معيار الإجابة المقبولة قبل الحصة.',
            'اجمع البطاقات وصنّفها سريعًا إلى ثلاث فئات: حقق الهدف، اقترب، يحتاج إعادة.',
            'ابدأ الحصة التالية بإجراء يعتمد على نتائج التصنيف.'
          ] },
          { type: 'example', title: 'مثال من المرحلة الإعدادية', body: 'في درس عن النسبة المئوية للصف الثامن، كان الهدف: «أن يحسب الطالب قيمة الخصم والسعر بعد الخصم في مسألتين بنسبة صحة تامة». صمم المعلم بطاقة خروج من مسألتين واقعيتين عن تخفيضات في متجر. وبعد الحصة وجد أن ثلث الطلاب حسبوا الخصم صحيحًا لكنهم كتبوه سعرًا نهائيًا. كانت التغذية الراجعة في الحصة التالية: «حسابكم للخصم صحيح، والخطوة الناقصة هي طرح الخصم من السعر الأصلي؛ حلوا هاتين المسألتين وراجعوا الخطوة الأخيرة تحديدًا». ثم عدّل خطته للعام القادم بإضافة مثال نمذجة يُبرز الفرق بين قيمة الخصم والسعر النهائي.' },
          { type: 'text', title: 'التأمل في الخطة بعد التنفيذ', body: 'الخطة الجيدة تنتهي بفقرة تأمل يكتبها المعلم بعد الحصة في دقيقتين: هل تحققت الأهداف وبأي دليل؟ ما الذي استغرق وقتًا أكثر من المتوقع؟ ما النشاط الذي لم يخدم الهدف؟ وما الذي سأغيره في المرة القادمة؟ هذه الملاحظات القصيرة هي الفرق بين معلم يكرر الخطة نفسها عشر سنوات ومعلم يحسّنها عشر مرات. ويمكن تحويل هذه التأملات إلى مادة للنقاش في اجتماعات القسم بوصفها ممارسة للتطوير المهني المستمر.' },
          { type: 'warning', title: 'أخطاء شائعة', body: 'قياس مستوى التذكر لهدف كُتب في مستوى التحليل؛ وتقديم تغذية راجعة عامة أو متأخرة أسبوعًا؛ والاكتفاء بالدرجة دون تعليق؛ وعدم استخدام نتائج التقويم التكويني لتعديل الدرس التالي؛ وترك التأمل في الخطة لأنه «لا يُطلب رسميًا».' },
          { type: 'remember', title: 'نقاط للتذكر', items: [
            'تشخيصي قبل، تكويني أثناء، ختامي بعد.',
            'سؤال التقويم يطابق مستوى الهدف ومعياره.',
            'التغذية الراجعة: محددة، في وقتها، موجهة للمهمة، تليها فرصة تطبيق.',
            'بطاقة الخروج تقيس الهدف الأهم في 3 إلى 5 دقائق.',
            'التأمل بعد الحصة يغذي الخطة القادمة.'
          ] },
          { type: 'activity', title: 'نشاط تأملي', body: 'راجع آخر ورقة اختبار قصير أعددتها: لكل سؤال، حدد الهدف الذي يقيسه ومستواه في تصنيف بلوم. هل توجد أهداف في خطتك لم يقسها أي سؤال؟ وهل توجد أسئلة لا تقيس أي هدف؟ ثم اكتب تغذية راجعة من ثلاث جمل لطالب واحد وفق الأسئلة الثلاثة: إلى أين؟ أين الآن؟ ما التالي؟' }
        ],
        resources: [],
        questions: [
          { text: 'نوع التقويم الذي يُجرى أثناء الدرس بهدف تعديل التدريس فورًا هو:', options: ['التشخيصي', 'التكويني', 'الختامي', 'المعياري'], answer: 1, explanation: 'التقويم التكويني يجري أثناء التعلم وغرضه تحسين التدريس لا رصد الدرجة.' },
          { text: 'الهدف «أن يفسّر الطالب سبب حدوث الفصول الأربعة». أي الأسئلة التالية يقيسه بشكل مناسب؟', options: ['عدد الفصول الأربعة', 'ما تعريف الفصل؟', 'لماذا يكون الصيف في نصف الكرة الشمالي حين يكون الشتاء في الجنوبي؟', 'متى يبدأ فصل الربيع؟'], answer: 2, explanation: 'السؤال يتطلب تفسيرًا سببيًا يطابق مستوى الهدف.' },
          { text: 'أي التغذيات الراجعة التالية أكثر فاعلية؟', options: ['ممتاز، واصل', 'إجابتك ضعيفة', 'فكرتك الرئيسة واضحة، لكن الفقرة الثانية بلا دليل؛ أضف مثالًا من النص يدعمها', 'راجع الدرس كاملًا'], answer: 2, explanation: 'التغذية الراجعة الفعّالة محددة وتصف ما تحقق وما يجب فعله لاحقًا.' },
          { text: 'الغرض الأساسي من بطاقة الخروج وفق ما ورد في الوحدة هو:', options: ['رصد درجة نهائية للطالب', 'قياس الهدف الأهم في الحصة وتوجيه الحصة التالية', 'شغل الدقائق الأخيرة من الحصة', 'تقييم سلوك الطلاب'], answer: 1, explanation: 'بطاقة الخروج أداة تكوينية تقيس الهدف الأهم وتُبنى عليها الحصة التالية.' },
          { text: 'الأسئلة الثلاثة التي تنظّم التغذية الراجعة الفعّالة هي:', options: ['من؟ متى؟ أين؟', 'إلى أين تتجه؟ أين أنت الآن؟ ما الخطوة التالية؟', 'ما الدرجة؟ ما الترتيب؟ ما التقدير؟', 'ماذا حفظت؟ ماذا نسيت؟ ماذا ستراجع؟'], answer: 1, explanation: 'هذه الأسئلة تربط الأداء الحالي بالهدف وتحدد الإجراء التالي.' }
        ]
      }
    ],
    finalQuiz: {
      questions: [
        { text: 'كتب معلم الهدف التالي: «أن يدرك الطالب أهمية الماء للكائنات الحية». التعديل الأنسب ليصبح هدفًا سلوكيًا هو:', options: ['أن يشرح المعلم أهمية الماء للكائنات الحية', 'أن يذكر الطالب ثلاث وظائف للماء في جسم الكائن الحي', 'أن يحب الطالب الماء', 'أن يشاهد الطالب فيلمًا عن الماء'], answer: 1, explanation: 'الصياغة الجديدة تستخدم فعلًا إجرائيًا قابلًا للملاحظة مع معيار عددي.' },
        { text: 'في الهدف «أن يرسم الطالب مخطط الدائرة الكهربائية على التوازي بعد إجراء التجربة رسمًا صحيحًا خاليًا من الأخطاء»، عبارة «بعد إجراء التجربة» تمثل:', options: ['السلوك', 'المعيار', 'الشرط', 'المستوى المعرفي'], answer: 2, explanation: 'الشرط يصف الظرف الذي يُظهر فيه الطالب الأداء.' },
        { text: 'هدف في مستوى التقويم من تصنيف بلوم لدرس عن مقال رأي هو:', options: ['أن يذكر الطالب عنوان المقال وكاتبه', 'أن يلخص الطالب فكرة المقال', 'أن يحكم الطالب على قوة حجج الكاتب مبررًا حكمه بدليلين', 'أن يقرأ الطالب المقال قراءة جهرية'], answer: 2, explanation: 'إصدار حكم مدعوم بمعايير وأدلة هو جوهر مستوى التقويم.' },
        { text: 'موقف صفي: لاحظ معلم الرياضيات أن أهداف خططه طوال الفصل كانت في مستويي التذكر والفهم فقط. الإجراء الأنسب هو:', options: ['الاستمرار لأن الطلاب يحققونها بسهولة', 'رفع هدف واحد على الأقل في كل درس إلى مستوى التطبيق أو ما فوقه مع تعديل النشاط والتقويم تبعًا لذلك', 'تحويل جميع الأهداف إلى مستوى الإبداع', 'إلغاء الأهداف من الخطة'], answer: 1, explanation: 'التدرج المطلوب أن يتضمن الدرس هدفًا في مستوى أعلى مع اتساق النشاط والتقويم معه.' },
        { text: 'موقف صفي: أعدّ معلم خطة تتضمن أربعة أهداف وثلاثة أنشطة جذابة، لكنه اكتشف أن أحد الأهداف لا يخدمه أي نشاط ولا يقيسه أي سؤال. وفق مبدأ الاتساق ينبغي أن:', options: ['يحذف الهدف أو يضيف له نشاطًا وأداة تقويم', 'يبقي الخطة كما هي لأن الأنشطة كافية', 'يضيف نشاطًا خامسًا غير مرتبط بالأهداف', 'يؤجل الهدف إلى الاختبار النهائي'], answer: 0, explanation: 'لكل هدف نشاط وأداة تقويم؛ وإلا فالخطة غير متسقة.' },
        { text: 'موقف صفي: في حصة مدتها 45 دقيقة استغرق العرض 30 دقيقة، فألغى المعلم بطاقة الخروج. الأثر المباشر لهذا القرار هو:', options: ['توفير الوقت دون أثر على التعلم', 'فقدان دليل تحقق الأهداف وتعذر توجيه الحصة التالية بناءً على الأداء', 'تحسين الانضباط الصفي', 'زيادة دافعية الطلاب'], answer: 1, explanation: 'التقويم الختامي/التكويني يوفر الدليل على تحقق الأهداف ويوجّه التخطيط اللاحق.' },
        { text: 'موقف صفي: كتب طالب حلًا صحيحًا لكنه أغفل وحدة القياس. التغذية الراجعة الأنسب هي:', options: ['«ضعيف، أعد الحل»', '«جيد»', '«الحساب صحيح، والناقص هو وحدة القياس؛ أضفها هنا وفي المسألتين التاليتين»', '«راجع الفصل كاملًا»'], answer: 2, explanation: 'تغذية راجعة محددة تصف ما تحقق وتحدد الخطوة التالية.' },
        { text: 'التقويم الذي يسبق تعليم مفهوم جديد ويكشف المفاهيم الخاطئة لدى الطلاب يُسمى:', options: ['ختاميًا', 'تشخيصيًا', 'تكوينيًا', 'معياريًا'], answer: 1, explanation: 'التقويم التشخيصي يكشف المعرفة السابقة والمفاهيم الخاطئة قبل التعلم.' },
        { text: 'أي المكونات التالية تُعد من مكونات خطة الدرس المرتبطة مباشرة بمراعاة الفروق الفردية؟', options: ['البيانات العامة للدرس', 'مهمة إثرائية جاهزة وبطاقة دعم للمتعثرين', 'عنوان الوحدة الدراسية', 'تاريخ تنفيذ الدرس'], answer: 1, explanation: 'مراعاة الفروق إجراءات محددة داخل الخطة.' },
        { text: 'الهدف «أن يصمم الطالب حملة توعوية من ثلاث لوحات عن ترشيد استهلاك الماء» يقع في مستوى:', options: ['التذكر', 'التطبيق', 'الإبداع', 'الفهم'], answer: 2, explanation: 'التصميم وإنتاج عمل جديد من مهارات مستوى الإبداع.' }
      ]
    }
  };
}


/* ######################## Lib_QRCode.gs ######################## */

/**
 * Lib_QRCode.gs — مكتبة توليد QR (qrcode-generator، رخصة MIT) — تُستخدم لرمز التحقق في الشهادة
 */
/**
 * مكتبة توليد رمز QR (QR Code Generator for JavaScript)
 * المؤلف: Kazuhiko Arase — ترخيص MIT — https://github.com/kazuhikoarase/qrcode-generator
 * مضمّنة كما هي لاستخدامها على الخادم عند توليد الشهادات (بدون أي خدمة خارجية).
 */
//---------------------------------------------------------------------
//
// QR Code Generator for JavaScript
//
// Copyright (c) 2009 Kazuhiko Arase
//
// URL: http://www.d-project.com/
//
// Licensed under the MIT license:
//  http://www.opensource.org/licenses/mit-license.php
//
// The word 'QR Code' is registered trademark of
// DENSO WAVE INCORPORATED
//  http://www.denso-wave.com/qrcode/faqpatent-e.html
//
//---------------------------------------------------------------------

var qrcode = function() {

  //---------------------------------------------------------------------
  // qrcode
  //---------------------------------------------------------------------

  /**
   * qrcode
   * @param typeNumber 1 to 40
   * @param errorCorrectionLevel 'L','M','Q','H'
   */
  var qrcode = function(typeNumber, errorCorrectionLevel) {

    var PAD0 = 0xEC;
    var PAD1 = 0x11;

    var _typeNumber = typeNumber;
    var _errorCorrectionLevel = QRErrorCorrectionLevel[errorCorrectionLevel];
    var _modules = null;
    var _moduleCount = 0;
    var _dataCache = null;
    var _dataList = [];

    var _this = {};

    var makeImpl = function(test, maskPattern) {

      _moduleCount = _typeNumber * 4 + 17;
      _modules = function(moduleCount) {
        var modules = new Array(moduleCount);
        for (var row = 0; row < moduleCount; row += 1) {
          modules[row] = new Array(moduleCount);
          for (var col = 0; col < moduleCount; col += 1) {
            modules[row][col] = null;
          }
        }
        return modules;
      }(_moduleCount);

      setupPositionProbePattern(0, 0);
      setupPositionProbePattern(_moduleCount - 7, 0);
      setupPositionProbePattern(0, _moduleCount - 7);
      setupPositionAdjustPattern();
      setupTimingPattern();
      setupTypeInfo(test, maskPattern);

      if (_typeNumber >= 7) {
        setupTypeNumber(test);
      }

      if (_dataCache == null) {
        _dataCache = createData(_typeNumber, _errorCorrectionLevel, _dataList);
      }

      mapData(_dataCache, maskPattern);
    };

    var setupPositionProbePattern = function(row, col) {

      for (var r = -1; r <= 7; r += 1) {

        if (row + r <= -1 || _moduleCount <= row + r) continue;

        for (var c = -1; c <= 7; c += 1) {

          if (col + c <= -1 || _moduleCount <= col + c) continue;

          if ( (0 <= r && r <= 6 && (c == 0 || c == 6) )
              || (0 <= c && c <= 6 && (r == 0 || r == 6) )
              || (2 <= r && r <= 4 && 2 <= c && c <= 4) ) {
            _modules[row + r][col + c] = true;
          } else {
            _modules[row + r][col + c] = false;
          }
        }
      }
    };

    var getBestMaskPattern = function() {

      var minLostPoint = 0;
      var pattern = 0;

      for (var i = 0; i < 8; i += 1) {

        makeImpl(true, i);

        var lostPoint = QRUtil.getLostPoint(_this);

        if (i == 0 || minLostPoint > lostPoint) {
          minLostPoint = lostPoint;
          pattern = i;
        }
      }

      return pattern;
    };

    var setupTimingPattern = function() {

      for (var r = 8; r < _moduleCount - 8; r += 1) {
        if (_modules[r][6] != null) {
          continue;
        }
        _modules[r][6] = (r % 2 == 0);
      }

      for (var c = 8; c < _moduleCount - 8; c += 1) {
        if (_modules[6][c] != null) {
          continue;
        }
        _modules[6][c] = (c % 2 == 0);
      }
    };

    var setupPositionAdjustPattern = function() {

      var pos = QRUtil.getPatternPosition(_typeNumber);

      for (var i = 0; i < pos.length; i += 1) {

        for (var j = 0; j < pos.length; j += 1) {

          var row = pos[i];
          var col = pos[j];

          if (_modules[row][col] != null) {
            continue;
          }

          for (var r = -2; r <= 2; r += 1) {

            for (var c = -2; c <= 2; c += 1) {

              if (r == -2 || r == 2 || c == -2 || c == 2
                  || (r == 0 && c == 0) ) {
                _modules[row + r][col + c] = true;
              } else {
                _modules[row + r][col + c] = false;
              }
            }
          }
        }
      }
    };

    var setupTypeNumber = function(test) {

      var bits = QRUtil.getBCHTypeNumber(_typeNumber);

      for (var i = 0; i < 18; i += 1) {
        var mod = (!test && ( (bits >> i) & 1) == 1);
        _modules[Math.floor(i / 3)][i % 3 + _moduleCount - 8 - 3] = mod;
      }

      for (var i = 0; i < 18; i += 1) {
        var mod = (!test && ( (bits >> i) & 1) == 1);
        _modules[i % 3 + _moduleCount - 8 - 3][Math.floor(i / 3)] = mod;
      }
    };

    var setupTypeInfo = function(test, maskPattern) {

      var data = (_errorCorrectionLevel << 3) | maskPattern;
      var bits = QRUtil.getBCHTypeInfo(data);

      // vertical
      for (var i = 0; i < 15; i += 1) {

        var mod = (!test && ( (bits >> i) & 1) == 1);

        if (i < 6) {
          _modules[i][8] = mod;
        } else if (i < 8) {
          _modules[i + 1][8] = mod;
        } else {
          _modules[_moduleCount - 15 + i][8] = mod;
        }
      }

      // horizontal
      for (var i = 0; i < 15; i += 1) {

        var mod = (!test && ( (bits >> i) & 1) == 1);

        if (i < 8) {
          _modules[8][_moduleCount - i - 1] = mod;
        } else if (i < 9) {
          _modules[8][15 - i - 1 + 1] = mod;
        } else {
          _modules[8][15 - i - 1] = mod;
        }
      }

      // fixed module
      _modules[_moduleCount - 8][8] = (!test);
    };

    var mapData = function(data, maskPattern) {

      var inc = -1;
      var row = _moduleCount - 1;
      var bitIndex = 7;
      var byteIndex = 0;
      var maskFunc = QRUtil.getMaskFunction(maskPattern);

      for (var col = _moduleCount - 1; col > 0; col -= 2) {

        if (col == 6) col -= 1;

        while (true) {

          for (var c = 0; c < 2; c += 1) {

            if (_modules[row][col - c] == null) {

              var dark = false;

              if (byteIndex < data.length) {
                dark = ( ( (data[byteIndex] >>> bitIndex) & 1) == 1);
              }

              var mask = maskFunc(row, col - c);

              if (mask) {
                dark = !dark;
              }

              _modules[row][col - c] = dark;
              bitIndex -= 1;

              if (bitIndex == -1) {
                byteIndex += 1;
                bitIndex = 7;
              }
            }
          }

          row += inc;

          if (row < 0 || _moduleCount <= row) {
            row -= inc;
            inc = -inc;
            break;
          }
        }
      }
    };

    var createBytes = function(buffer, rsBlocks) {

      var offset = 0;

      var maxDcCount = 0;
      var maxEcCount = 0;

      var dcdata = new Array(rsBlocks.length);
      var ecdata = new Array(rsBlocks.length);

      for (var r = 0; r < rsBlocks.length; r += 1) {

        var dcCount = rsBlocks[r].dataCount;
        var ecCount = rsBlocks[r].totalCount - dcCount;

        maxDcCount = Math.max(maxDcCount, dcCount);
        maxEcCount = Math.max(maxEcCount, ecCount);

        dcdata[r] = new Array(dcCount);

        for (var i = 0; i < dcdata[r].length; i += 1) {
          dcdata[r][i] = 0xff & buffer.getBuffer()[i + offset];
        }
        offset += dcCount;

        var rsPoly = QRUtil.getErrorCorrectPolynomial(ecCount);
        var rawPoly = qrPolynomial(dcdata[r], rsPoly.getLength() - 1);

        var modPoly = rawPoly.mod(rsPoly);
        ecdata[r] = new Array(rsPoly.getLength() - 1);
        for (var i = 0; i < ecdata[r].length; i += 1) {
          var modIndex = i + modPoly.getLength() - ecdata[r].length;
          ecdata[r][i] = (modIndex >= 0)? modPoly.getAt(modIndex) : 0;
        }
      }

      var totalCodeCount = 0;
      for (var i = 0; i < rsBlocks.length; i += 1) {
        totalCodeCount += rsBlocks[i].totalCount;
      }

      var data = new Array(totalCodeCount);
      var index = 0;

      for (var i = 0; i < maxDcCount; i += 1) {
        for (var r = 0; r < rsBlocks.length; r += 1) {
          if (i < dcdata[r].length) {
            data[index] = dcdata[r][i];
            index += 1;
          }
        }
      }

      for (var i = 0; i < maxEcCount; i += 1) {
        for (var r = 0; r < rsBlocks.length; r += 1) {
          if (i < ecdata[r].length) {
            data[index] = ecdata[r][i];
            index += 1;
          }
        }
      }

      return data;
    };

    var createData = function(typeNumber, errorCorrectionLevel, dataList) {

      var rsBlocks = QRRSBlock.getRSBlocks(typeNumber, errorCorrectionLevel);

      var buffer = qrBitBuffer();

      for (var i = 0; i < dataList.length; i += 1) {
        var data = dataList[i];
        buffer.put(data.getMode(), 4);
        buffer.put(data.getLength(), QRUtil.getLengthInBits(data.getMode(), typeNumber) );
        data.write(buffer);
      }

      // calc num max data.
      var totalDataCount = 0;
      for (var i = 0; i < rsBlocks.length; i += 1) {
        totalDataCount += rsBlocks[i].dataCount;
      }

      if (buffer.getLengthInBits() > totalDataCount * 8) {
        throw 'code length overflow. ('
          + buffer.getLengthInBits()
          + '>'
          + totalDataCount * 8
          + ')';
      }

      // end code
      if (buffer.getLengthInBits() + 4 <= totalDataCount * 8) {
        buffer.put(0, 4);
      }

      // padding
      while (buffer.getLengthInBits() % 8 != 0) {
        buffer.putBit(false);
      }

      // padding
      while (true) {

        if (buffer.getLengthInBits() >= totalDataCount * 8) {
          break;
        }
        buffer.put(PAD0, 8);

        if (buffer.getLengthInBits() >= totalDataCount * 8) {
          break;
        }
        buffer.put(PAD1, 8);
      }

      return createBytes(buffer, rsBlocks);
    };

    _this.addData = function(data, mode) {

      mode = mode || 'Byte';

      var newData = null;

      switch(mode) {
      case 'Numeric' :
        newData = qrNumber(data);
        break;
      case 'Alphanumeric' :
        newData = qrAlphaNum(data);
        break;
      case 'Byte' :
        newData = qr8BitByte(data);
        break;
      case 'Kanji' :
        newData = qrKanji(data);
        break;
      default :
        throw 'mode:' + mode;
      }

      _dataList.push(newData);
      _dataCache = null;
    };

    _this.isDark = function(row, col) {
      if (row < 0 || _moduleCount <= row || col < 0 || _moduleCount <= col) {
        throw row + ',' + col;
      }
      return _modules[row][col];
    };

    _this.getModuleCount = function() {
      return _moduleCount;
    };

    _this.make = function() {
      if (_typeNumber < 1) {
        var typeNumber = 1;

        for (; typeNumber < 40; typeNumber++) {
          var rsBlocks = QRRSBlock.getRSBlocks(typeNumber, _errorCorrectionLevel);
          var buffer = qrBitBuffer();

          for (var i = 0; i < _dataList.length; i++) {
            var data = _dataList[i];
            buffer.put(data.getMode(), 4);
            buffer.put(data.getLength(), QRUtil.getLengthInBits(data.getMode(), typeNumber) );
            data.write(buffer);
          }

          var totalDataCount = 0;
          for (var i = 0; i < rsBlocks.length; i++) {
            totalDataCount += rsBlocks[i].dataCount;
          }

          if (buffer.getLengthInBits() <= totalDataCount * 8) {
            break;
          }
        }

        _typeNumber = typeNumber;
      }

      makeImpl(false, getBestMaskPattern() );
    };

    _this.createTableTag = function(cellSize, margin) {

      cellSize = cellSize || 2;
      margin = (typeof margin == 'undefined')? cellSize * 4 : margin;

      var qrHtml = '';

      qrHtml += '<table style="';
      qrHtml += ' border-width: 0px; border-style: none;';
      qrHtml += ' border-collapse: collapse;';
      qrHtml += ' padding: 0px; margin: ' + margin + 'px;';
      qrHtml += '">';
      qrHtml += '<tbody>';

      for (var r = 0; r < _this.getModuleCount(); r += 1) {

        qrHtml += '<tr>';

        for (var c = 0; c < _this.getModuleCount(); c += 1) {
          qrHtml += '<td style="';
          qrHtml += ' border-width: 0px; border-style: none;';
          qrHtml += ' border-collapse: collapse;';
          qrHtml += ' padding: 0px; margin: 0px;';
          qrHtml += ' width: ' + cellSize + 'px;';
          qrHtml += ' height: ' + cellSize + 'px;';
          qrHtml += ' background-color: ';
          qrHtml += _this.isDark(r, c)? '#000000' : '#ffffff';
          qrHtml += ';';
          qrHtml += '"/>';
        }

        qrHtml += '</tr>';
      }

      qrHtml += '</tbody>';
      qrHtml += '</table>';

      return qrHtml;
    };

    _this.createSvgTag = function(cellSize, margin, alt, title) {

      var opts = {};
      if (typeof arguments[0] == 'object') {
        // Called by options.
        opts = arguments[0];
        // overwrite cellSize and margin.
        cellSize = opts.cellSize;
        margin = opts.margin;
        alt = opts.alt;
        title = opts.title;
      }

      cellSize = cellSize || 2;
      margin = (typeof margin == 'undefined')? cellSize * 4 : margin;

      // Compose alt property surrogate
      alt = (typeof alt === 'string') ? {text: alt} : alt || {};
      alt.text = alt.text || null;
      alt.id = (alt.text) ? alt.id || 'qrcode-description' : null;

      // Compose title property surrogate
      title = (typeof title === 'string') ? {text: title} : title || {};
      title.text = title.text || null;
      title.id = (title.text) ? title.id || 'qrcode-title' : null;

      var size = _this.getModuleCount() * cellSize + margin * 2;
      var c, mc, r, mr, qrSvg='', rect;

      rect = 'l' + cellSize + ',0 0,' + cellSize +
        ' -' + cellSize + ',0 0,-' + cellSize + 'z ';

      qrSvg += '<svg version="1.1" xmlns="http://www.w3.org/2000/svg"';
      qrSvg += !opts.scalable ? ' width="' + size + 'px" height="' + size + 'px"' : '';
      qrSvg += ' viewBox="0 0 ' + size + ' ' + size + '" ';
      qrSvg += ' preserveAspectRatio="xMinYMin meet"';
      qrSvg += (title.text || alt.text) ? ' role="img" aria-labelledby="' +
          escapeXml([title.id, alt.id].join(' ').trim() ) + '"' : '';
      qrSvg += '>';
      qrSvg += (title.text) ? '<title id="' + escapeXml(title.id) + '">' +
          escapeXml(title.text) + '</title>' : '';
      qrSvg += (alt.text) ? '<description id="' + escapeXml(alt.id) + '">' +
          escapeXml(alt.text) + '</description>' : '';
      qrSvg += '<rect width="100%" height="100%" fill="white" cx="0" cy="0"/>';
      qrSvg += '<path d="';

      for (r = 0; r < _this.getModuleCount(); r += 1) {
        mr = r * cellSize + margin;
        for (c = 0; c < _this.getModuleCount(); c += 1) {
          if (_this.isDark(r, c) ) {
            mc = c*cellSize+margin;
            qrSvg += 'M' + mc + ',' + mr + rect;
          }
        }
      }

      qrSvg += '" stroke="transparent" fill="black"/>';
      qrSvg += '</svg>';

      return qrSvg;
    };

    _this.createDataURL = function(cellSize, margin) {

      cellSize = cellSize || 2;
      margin = (typeof margin == 'undefined')? cellSize * 4 : margin;

      var size = _this.getModuleCount() * cellSize + margin * 2;
      var min = margin;
      var max = size - margin;

      return createDataURL(size, size, function(x, y) {
        if (min <= x && x < max && min <= y && y < max) {
          var c = Math.floor( (x - min) / cellSize);
          var r = Math.floor( (y - min) / cellSize);
          return _this.isDark(r, c)? 0 : 1;
        } else {
          return 1;
        }
      } );
    };

    _this.createImgTag = function(cellSize, margin, alt) {

      cellSize = cellSize || 2;
      margin = (typeof margin == 'undefined')? cellSize * 4 : margin;

      var size = _this.getModuleCount() * cellSize + margin * 2;

      var img = '';
      img += '<img';
      img += '\u0020src="';
      img += _this.createDataURL(cellSize, margin);
      img += '"';
      img += '\u0020width="';
      img += size;
      img += '"';
      img += '\u0020height="';
      img += size;
      img += '"';
      if (alt) {
        img += '\u0020alt="';
        img += escapeXml(alt);
        img += '"';
      }
      img += '/>';

      return img;
    };

    var escapeXml = function(s) {
      var escaped = '';
      for (var i = 0; i < s.length; i += 1) {
        var c = s.charAt(i);
        switch(c) {
        case '<': escaped += '&lt;'; break;
        case '>': escaped += '&gt;'; break;
        case '&': escaped += '&amp;'; break;
        case '"': escaped += '&quot;'; break;
        default : escaped += c; break;
        }
      }
      return escaped;
    };

    var _createHalfASCII = function(margin) {
      var cellSize = 1;
      margin = (typeof margin == 'undefined')? cellSize * 2 : margin;

      var size = _this.getModuleCount() * cellSize + margin * 2;
      var min = margin;
      var max = size - margin;

      var y, x, r1, r2, p;

      var blocks = {
        '██': '█',
        '█ ': '▀',
        ' █': '▄',
        '  ': ' '
      };

      var blocksLastLineNoMargin = {
        '██': '▀',
        '█ ': '▀',
        ' █': ' ',
        '  ': ' '
      };

      var ascii = '';
      for (y = 0; y < size; y += 2) {
        r1 = Math.floor((y - min) / cellSize);
        r2 = Math.floor((y + 1 - min) / cellSize);
        for (x = 0; x < size; x += 1) {
          p = '█';

          if (min <= x && x < max && min <= y && y < max && _this.isDark(r1, Math.floor((x - min) / cellSize))) {
            p = ' ';
          }

          if (min <= x && x < max && min <= y+1 && y+1 < max && _this.isDark(r2, Math.floor((x - min) / cellSize))) {
            p += ' ';
          }
          else {
            p += '█';
          }

          // Output 2 characters per pixel, to create full square. 1 character per pixels gives only half width of square.
          ascii += (margin < 1 && y+1 >= max) ? blocksLastLineNoMargin[p] : blocks[p];
        }

        ascii += '\n';
      }

      if (size % 2 && margin > 0) {
        return ascii.substring(0, ascii.length - size - 1) + Array(size+1).join('▀');
      }

      return ascii.substring(0, ascii.length-1);
    };

    _this.createASCII = function(cellSize, margin) {
      cellSize = cellSize || 1;

      if (cellSize < 2) {
        return _createHalfASCII(margin);
      }

      cellSize -= 1;
      margin = (typeof margin == 'undefined')? cellSize * 2 : margin;

      var size = _this.getModuleCount() * cellSize + margin * 2;
      var min = margin;
      var max = size - margin;

      var y, x, r, p;

      var white = Array(cellSize+1).join('██');
      var black = Array(cellSize+1).join('  ');

      var ascii = '';
      var line = '';
      for (y = 0; y < size; y += 1) {
        r = Math.floor( (y - min) / cellSize);
        line = '';
        for (x = 0; x < size; x += 1) {
          p = 1;

          if (min <= x && x < max && min <= y && y < max && _this.isDark(r, Math.floor((x - min) / cellSize))) {
            p = 0;
          }

          // Output 2 characters per pixel, to create full square. 1 character per pixels gives only half width of square.
          line += p ? white : black;
        }

        for (r = 0; r < cellSize; r += 1) {
          ascii += line + '\n';
        }
      }

      return ascii.substring(0, ascii.length-1);
    };

    _this.renderTo2dContext = function(context, cellSize) {
      cellSize = cellSize || 2;
      var length = _this.getModuleCount();
      for (var row = 0; row < length; row++) {
        for (var col = 0; col < length; col++) {
          context.fillStyle = _this.isDark(row, col) ? 'black' : 'white';
          context.fillRect(row * cellSize, col * cellSize, cellSize, cellSize);
        }
      }
    }

    return _this;
  };

  //---------------------------------------------------------------------
  // qrcode.stringToBytes
  //---------------------------------------------------------------------

  qrcode.stringToBytesFuncs = {
    'default' : function(s) {
      var bytes = [];
      for (var i = 0; i < s.length; i += 1) {
        var c = s.charCodeAt(i);
        bytes.push(c & 0xff);
      }
      return bytes;
    }
  };

  qrcode.stringToBytes = qrcode.stringToBytesFuncs['default'];

  //---------------------------------------------------------------------
  // qrcode.createStringToBytes
  //---------------------------------------------------------------------

  /**
   * @param unicodeData base64 string of byte array.
   * [16bit Unicode],[16bit Bytes], ...
   * @param numChars
   */
  qrcode.createStringToBytes = function(unicodeData, numChars) {

    // create conversion map.

    var unicodeMap = function() {

      var bin = base64DecodeInputStream(unicodeData);
      var read = function() {
        var b = bin.read();
        if (b == -1) throw 'eof';
        return b;
      };

      var count = 0;
      var unicodeMap = {};
      while (true) {
        var b0 = bin.read();
        if (b0 == -1) break;
        var b1 = read();
        var b2 = read();
        var b3 = read();
        var k = String.fromCharCode( (b0 << 8) | b1);
        var v = (b2 << 8) | b3;
        unicodeMap[k] = v;
        count += 1;
      }
      if (count != numChars) {
        throw count + ' != ' + numChars;
      }

      return unicodeMap;
    }();

    var unknownChar = '?'.charCodeAt(0);

    return function(s) {
      var bytes = [];
      for (var i = 0; i < s.length; i += 1) {
        var c = s.charCodeAt(i);
        if (c < 128) {
          bytes.push(c);
        } else {
          var b = unicodeMap[s.charAt(i)];
          if (typeof b == 'number') {
            if ( (b & 0xff) == b) {
              // 1byte
              bytes.push(b);
            } else {
              // 2bytes
              bytes.push(b >>> 8);
              bytes.push(b & 0xff);
            }
          } else {
            bytes.push(unknownChar);
          }
        }
      }
      return bytes;
    };
  };

  //---------------------------------------------------------------------
  // QRMode
  //---------------------------------------------------------------------

  var QRMode = {
    MODE_NUMBER :    1 << 0,
    MODE_ALPHA_NUM : 1 << 1,
    MODE_8BIT_BYTE : 1 << 2,
    MODE_KANJI :     1 << 3
  };

  //---------------------------------------------------------------------
  // QRErrorCorrectionLevel
  //---------------------------------------------------------------------

  var QRErrorCorrectionLevel = {
    L : 1,
    M : 0,
    Q : 3,
    H : 2
  };

  //---------------------------------------------------------------------
  // QRMaskPattern
  //---------------------------------------------------------------------

  var QRMaskPattern = {
    PATTERN000 : 0,
    PATTERN001 : 1,
    PATTERN010 : 2,
    PATTERN011 : 3,
    PATTERN100 : 4,
    PATTERN101 : 5,
    PATTERN110 : 6,
    PATTERN111 : 7
  };

  //---------------------------------------------------------------------
  // QRUtil
  //---------------------------------------------------------------------

  var QRUtil = function() {

    var PATTERN_POSITION_TABLE = [
      [],
      [6, 18],
      [6, 22],
      [6, 26],
      [6, 30],
      [6, 34],
      [6, 22, 38],
      [6, 24, 42],
      [6, 26, 46],
      [6, 28, 50],
      [6, 30, 54],
      [6, 32, 58],
      [6, 34, 62],
      [6, 26, 46, 66],
      [6, 26, 48, 70],
      [6, 26, 50, 74],
      [6, 30, 54, 78],
      [6, 30, 56, 82],
      [6, 30, 58, 86],
      [6, 34, 62, 90],
      [6, 28, 50, 72, 94],
      [6, 26, 50, 74, 98],
      [6, 30, 54, 78, 102],
      [6, 28, 54, 80, 106],
      [6, 32, 58, 84, 110],
      [6, 30, 58, 86, 114],
      [6, 34, 62, 90, 118],
      [6, 26, 50, 74, 98, 122],
      [6, 30, 54, 78, 102, 126],
      [6, 26, 52, 78, 104, 130],
      [6, 30, 56, 82, 108, 134],
      [6, 34, 60, 86, 112, 138],
      [6, 30, 58, 86, 114, 142],
      [6, 34, 62, 90, 118, 146],
      [6, 30, 54, 78, 102, 126, 150],
      [6, 24, 50, 76, 102, 128, 154],
      [6, 28, 54, 80, 106, 132, 158],
      [6, 32, 58, 84, 110, 136, 162],
      [6, 26, 54, 82, 110, 138, 166],
      [6, 30, 58, 86, 114, 142, 170]
    ];
    var G15 = (1 << 10) | (1 << 8) | (1 << 5) | (1 << 4) | (1 << 2) | (1 << 1) | (1 << 0);
    var G18 = (1 << 12) | (1 << 11) | (1 << 10) | (1 << 9) | (1 << 8) | (1 << 5) | (1 << 2) | (1 << 0);
    var G15_MASK = (1 << 14) | (1 << 12) | (1 << 10) | (1 << 4) | (1 << 1);

    var _this = {};

    var getBCHDigit = function(data) {
      var digit = 0;
      while (data != 0) {
        digit += 1;
        data >>>= 1;
      }
      return digit;
    };

    _this.getBCHTypeInfo = function(data) {
      var d = data << 10;
      while (getBCHDigit(d) - getBCHDigit(G15) >= 0) {
        d ^= (G15 << (getBCHDigit(d) - getBCHDigit(G15) ) );
      }
      return ( (data << 10) | d) ^ G15_MASK;
    };

    _this.getBCHTypeNumber = function(data) {
      var d = data << 12;
      while (getBCHDigit(d) - getBCHDigit(G18) >= 0) {
        d ^= (G18 << (getBCHDigit(d) - getBCHDigit(G18) ) );
      }
      return (data << 12) | d;
    };

    _this.getPatternPosition = function(typeNumber) {
      return PATTERN_POSITION_TABLE[typeNumber - 1];
    };

    _this.getMaskFunction = function(maskPattern) {

      switch (maskPattern) {

      case QRMaskPattern.PATTERN000 :
        return function(i, j) { return (i + j) % 2 == 0; };
      case QRMaskPattern.PATTERN001 :
        return function(i, j) { return i % 2 == 0; };
      case QRMaskPattern.PATTERN010 :
        return function(i, j) { return j % 3 == 0; };
      case QRMaskPattern.PATTERN011 :
        return function(i, j) { return (i + j) % 3 == 0; };
      case QRMaskPattern.PATTERN100 :
        return function(i, j) { return (Math.floor(i / 2) + Math.floor(j / 3) ) % 2 == 0; };
      case QRMaskPattern.PATTERN101 :
        return function(i, j) { return (i * j) % 2 + (i * j) % 3 == 0; };
      case QRMaskPattern.PATTERN110 :
        return function(i, j) { return ( (i * j) % 2 + (i * j) % 3) % 2 == 0; };
      case QRMaskPattern.PATTERN111 :
        return function(i, j) { return ( (i * j) % 3 + (i + j) % 2) % 2 == 0; };

      default :
        throw 'bad maskPattern:' + maskPattern;
      }
    };

    _this.getErrorCorrectPolynomial = function(errorCorrectLength) {
      var a = qrPolynomial([1], 0);
      for (var i = 0; i < errorCorrectLength; i += 1) {
        a = a.multiply(qrPolynomial([1, QRMath.gexp(i)], 0) );
      }
      return a;
    };

    _this.getLengthInBits = function(mode, type) {

      if (1 <= type && type < 10) {

        // 1 - 9

        switch(mode) {
        case QRMode.MODE_NUMBER    : return 10;
        case QRMode.MODE_ALPHA_NUM : return 9;
        case QRMode.MODE_8BIT_BYTE : return 8;
        case QRMode.MODE_KANJI     : return 8;
        default :
          throw 'mode:' + mode;
        }

      } else if (type < 27) {

        // 10 - 26

        switch(mode) {
        case QRMode.MODE_NUMBER    : return 12;
        case QRMode.MODE_ALPHA_NUM : return 11;
        case QRMode.MODE_8BIT_BYTE : return 16;
        case QRMode.MODE_KANJI     : return 10;
        default :
          throw 'mode:' + mode;
        }

      } else if (type < 41) {

        // 27 - 40

        switch(mode) {
        case QRMode.MODE_NUMBER    : return 14;
        case QRMode.MODE_ALPHA_NUM : return 13;
        case QRMode.MODE_8BIT_BYTE : return 16;
        case QRMode.MODE_KANJI     : return 12;
        default :
          throw 'mode:' + mode;
        }

      } else {
        throw 'type:' + type;
      }
    };

    _this.getLostPoint = function(qrcode) {

      var moduleCount = qrcode.getModuleCount();

      var lostPoint = 0;

      // LEVEL1

      for (var row = 0; row < moduleCount; row += 1) {
        for (var col = 0; col < moduleCount; col += 1) {

          var sameCount = 0;
          var dark = qrcode.isDark(row, col);

          for (var r = -1; r <= 1; r += 1) {

            if (row + r < 0 || moduleCount <= row + r) {
              continue;
            }

            for (var c = -1; c <= 1; c += 1) {

              if (col + c < 0 || moduleCount <= col + c) {
                continue;
              }

              if (r == 0 && c == 0) {
                continue;
              }

              if (dark == qrcode.isDark(row + r, col + c) ) {
                sameCount += 1;
              }
            }
          }

          if (sameCount > 5) {
            lostPoint += (3 + sameCount - 5);
          }
        }
      };

      // LEVEL2

      for (var row = 0; row < moduleCount - 1; row += 1) {
        for (var col = 0; col < moduleCount - 1; col += 1) {
          var count = 0;
          if (qrcode.isDark(row, col) ) count += 1;
          if (qrcode.isDark(row + 1, col) ) count += 1;
          if (qrcode.isDark(row, col + 1) ) count += 1;
          if (qrcode.isDark(row + 1, col + 1) ) count += 1;
          if (count == 0 || count == 4) {
            lostPoint += 3;
          }
        }
      }

      // LEVEL3

      for (var row = 0; row < moduleCount; row += 1) {
        for (var col = 0; col < moduleCount - 6; col += 1) {
          if (qrcode.isDark(row, col)
              && !qrcode.isDark(row, col + 1)
              &&  qrcode.isDark(row, col + 2)
              &&  qrcode.isDark(row, col + 3)
              &&  qrcode.isDark(row, col + 4)
              && !qrcode.isDark(row, col + 5)
              &&  qrcode.isDark(row, col + 6) ) {
            lostPoint += 40;
          }
        }
      }

      for (var col = 0; col < moduleCount; col += 1) {
        for (var row = 0; row < moduleCount - 6; row += 1) {
          if (qrcode.isDark(row, col)
              && !qrcode.isDark(row + 1, col)
              &&  qrcode.isDark(row + 2, col)
              &&  qrcode.isDark(row + 3, col)
              &&  qrcode.isDark(row + 4, col)
              && !qrcode.isDark(row + 5, col)
              &&  qrcode.isDark(row + 6, col) ) {
            lostPoint += 40;
          }
        }
      }

      // LEVEL4

      var darkCount = 0;

      for (var col = 0; col < moduleCount; col += 1) {
        for (var row = 0; row < moduleCount; row += 1) {
          if (qrcode.isDark(row, col) ) {
            darkCount += 1;
          }
        }
      }

      var ratio = Math.abs(100 * darkCount / moduleCount / moduleCount - 50) / 5;
      lostPoint += ratio * 10;

      return lostPoint;
    };

    return _this;
  }();

  //---------------------------------------------------------------------
  // QRMath
  //---------------------------------------------------------------------

  var QRMath = function() {

    var EXP_TABLE = new Array(256);
    var LOG_TABLE = new Array(256);

    // initialize tables
    for (var i = 0; i < 8; i += 1) {
      EXP_TABLE[i] = 1 << i;
    }
    for (var i = 8; i < 256; i += 1) {
      EXP_TABLE[i] = EXP_TABLE[i - 4]
        ^ EXP_TABLE[i - 5]
        ^ EXP_TABLE[i - 6]
        ^ EXP_TABLE[i - 8];
    }
    for (var i = 0; i < 255; i += 1) {
      LOG_TABLE[EXP_TABLE[i] ] = i;
    }

    var _this = {};

    _this.glog = function(n) {

      if (n < 1) {
        throw 'glog(' + n + ')';
      }

      return LOG_TABLE[n];
    };

    _this.gexp = function(n) {

      while (n < 0) {
        n += 255;
      }

      while (n >= 256) {
        n -= 255;
      }

      return EXP_TABLE[n];
    };

    return _this;
  }();

  //---------------------------------------------------------------------
  // qrPolynomial
  //---------------------------------------------------------------------

  function qrPolynomial(num, shift) {

    if (typeof num.length == 'undefined') {
      throw num.length + '/' + shift;
    }

    var _num = function() {
      var offset = 0;
      while (offset < num.length && num[offset] == 0) {
        offset += 1;
      }
      var _num = new Array(num.length - offset + shift);
      for (var i = 0; i < num.length - offset; i += 1) {
        _num[i] = num[i + offset];
      }
      return _num;
    }();

    var _this = {};

    _this.getAt = function(index) {
      return _num[index];
    };

    _this.getLength = function() {
      return _num.length;
    };

    _this.multiply = function(e) {

      var num = new Array(_this.getLength() + e.getLength() - 1);

      for (var i = 0; i < _this.getLength(); i += 1) {
        for (var j = 0; j < e.getLength(); j += 1) {
          num[i + j] ^= QRMath.gexp(QRMath.glog(_this.getAt(i) ) + QRMath.glog(e.getAt(j) ) );
        }
      }

      return qrPolynomial(num, 0);
    };

    _this.mod = function(e) {

      if (_this.getLength() - e.getLength() < 0) {
        return _this;
      }

      var ratio = QRMath.glog(_this.getAt(0) ) - QRMath.glog(e.getAt(0) );

      var num = new Array(_this.getLength() );
      for (var i = 0; i < _this.getLength(); i += 1) {
        num[i] = _this.getAt(i);
      }

      for (var i = 0; i < e.getLength(); i += 1) {
        num[i] ^= QRMath.gexp(QRMath.glog(e.getAt(i) ) + ratio);
      }

      // recursive call
      return qrPolynomial(num, 0).mod(e);
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // QRRSBlock
  //---------------------------------------------------------------------

  var QRRSBlock = function() {

    var RS_BLOCK_TABLE = [

      // L
      // M
      // Q
      // H

      // 1
      [1, 26, 19],
      [1, 26, 16],
      [1, 26, 13],
      [1, 26, 9],

      // 2
      [1, 44, 34],
      [1, 44, 28],
      [1, 44, 22],
      [1, 44, 16],

      // 3
      [1, 70, 55],
      [1, 70, 44],
      [2, 35, 17],
      [2, 35, 13],

      // 4
      [1, 100, 80],
      [2, 50, 32],
      [2, 50, 24],
      [4, 25, 9],

      // 5
      [1, 134, 108],
      [2, 67, 43],
      [2, 33, 15, 2, 34, 16],
      [2, 33, 11, 2, 34, 12],

      // 6
      [2, 86, 68],
      [4, 43, 27],
      [4, 43, 19],
      [4, 43, 15],

      // 7
      [2, 98, 78],
      [4, 49, 31],
      [2, 32, 14, 4, 33, 15],
      [4, 39, 13, 1, 40, 14],

      // 8
      [2, 121, 97],
      [2, 60, 38, 2, 61, 39],
      [4, 40, 18, 2, 41, 19],
      [4, 40, 14, 2, 41, 15],

      // 9
      [2, 146, 116],
      [3, 58, 36, 2, 59, 37],
      [4, 36, 16, 4, 37, 17],
      [4, 36, 12, 4, 37, 13],

      // 10
      [2, 86, 68, 2, 87, 69],
      [4, 69, 43, 1, 70, 44],
      [6, 43, 19, 2, 44, 20],
      [6, 43, 15, 2, 44, 16],

      // 11
      [4, 101, 81],
      [1, 80, 50, 4, 81, 51],
      [4, 50, 22, 4, 51, 23],
      [3, 36, 12, 8, 37, 13],

      // 12
      [2, 116, 92, 2, 117, 93],
      [6, 58, 36, 2, 59, 37],
      [4, 46, 20, 6, 47, 21],
      [7, 42, 14, 4, 43, 15],

      // 13
      [4, 133, 107],
      [8, 59, 37, 1, 60, 38],
      [8, 44, 20, 4, 45, 21],
      [12, 33, 11, 4, 34, 12],

      // 14
      [3, 145, 115, 1, 146, 116],
      [4, 64, 40, 5, 65, 41],
      [11, 36, 16, 5, 37, 17],
      [11, 36, 12, 5, 37, 13],

      // 15
      [5, 109, 87, 1, 110, 88],
      [5, 65, 41, 5, 66, 42],
      [5, 54, 24, 7, 55, 25],
      [11, 36, 12, 7, 37, 13],

      // 16
      [5, 122, 98, 1, 123, 99],
      [7, 73, 45, 3, 74, 46],
      [15, 43, 19, 2, 44, 20],
      [3, 45, 15, 13, 46, 16],

      // 17
      [1, 135, 107, 5, 136, 108],
      [10, 74, 46, 1, 75, 47],
      [1, 50, 22, 15, 51, 23],
      [2, 42, 14, 17, 43, 15],

      // 18
      [5, 150, 120, 1, 151, 121],
      [9, 69, 43, 4, 70, 44],
      [17, 50, 22, 1, 51, 23],
      [2, 42, 14, 19, 43, 15],

      // 19
      [3, 141, 113, 4, 142, 114],
      [3, 70, 44, 11, 71, 45],
      [17, 47, 21, 4, 48, 22],
      [9, 39, 13, 16, 40, 14],

      // 20
      [3, 135, 107, 5, 136, 108],
      [3, 67, 41, 13, 68, 42],
      [15, 54, 24, 5, 55, 25],
      [15, 43, 15, 10, 44, 16],

      // 21
      [4, 144, 116, 4, 145, 117],
      [17, 68, 42],
      [17, 50, 22, 6, 51, 23],
      [19, 46, 16, 6, 47, 17],

      // 22
      [2, 139, 111, 7, 140, 112],
      [17, 74, 46],
      [7, 54, 24, 16, 55, 25],
      [34, 37, 13],

      // 23
      [4, 151, 121, 5, 152, 122],
      [4, 75, 47, 14, 76, 48],
      [11, 54, 24, 14, 55, 25],
      [16, 45, 15, 14, 46, 16],

      // 24
      [6, 147, 117, 4, 148, 118],
      [6, 73, 45, 14, 74, 46],
      [11, 54, 24, 16, 55, 25],
      [30, 46, 16, 2, 47, 17],

      // 25
      [8, 132, 106, 4, 133, 107],
      [8, 75, 47, 13, 76, 48],
      [7, 54, 24, 22, 55, 25],
      [22, 45, 15, 13, 46, 16],

      // 26
      [10, 142, 114, 2, 143, 115],
      [19, 74, 46, 4, 75, 47],
      [28, 50, 22, 6, 51, 23],
      [33, 46, 16, 4, 47, 17],

      // 27
      [8, 152, 122, 4, 153, 123],
      [22, 73, 45, 3, 74, 46],
      [8, 53, 23, 26, 54, 24],
      [12, 45, 15, 28, 46, 16],

      // 28
      [3, 147, 117, 10, 148, 118],
      [3, 73, 45, 23, 74, 46],
      [4, 54, 24, 31, 55, 25],
      [11, 45, 15, 31, 46, 16],

      // 29
      [7, 146, 116, 7, 147, 117],
      [21, 73, 45, 7, 74, 46],
      [1, 53, 23, 37, 54, 24],
      [19, 45, 15, 26, 46, 16],

      // 30
      [5, 145, 115, 10, 146, 116],
      [19, 75, 47, 10, 76, 48],
      [15, 54, 24, 25, 55, 25],
      [23, 45, 15, 25, 46, 16],

      // 31
      [13, 145, 115, 3, 146, 116],
      [2, 74, 46, 29, 75, 47],
      [42, 54, 24, 1, 55, 25],
      [23, 45, 15, 28, 46, 16],

      // 32
      [17, 145, 115],
      [10, 74, 46, 23, 75, 47],
      [10, 54, 24, 35, 55, 25],
      [19, 45, 15, 35, 46, 16],

      // 33
      [17, 145, 115, 1, 146, 116],
      [14, 74, 46, 21, 75, 47],
      [29, 54, 24, 19, 55, 25],
      [11, 45, 15, 46, 46, 16],

      // 34
      [13, 145, 115, 6, 146, 116],
      [14, 74, 46, 23, 75, 47],
      [44, 54, 24, 7, 55, 25],
      [59, 46, 16, 1, 47, 17],

      // 35
      [12, 151, 121, 7, 152, 122],
      [12, 75, 47, 26, 76, 48],
      [39, 54, 24, 14, 55, 25],
      [22, 45, 15, 41, 46, 16],

      // 36
      [6, 151, 121, 14, 152, 122],
      [6, 75, 47, 34, 76, 48],
      [46, 54, 24, 10, 55, 25],
      [2, 45, 15, 64, 46, 16],

      // 37
      [17, 152, 122, 4, 153, 123],
      [29, 74, 46, 14, 75, 47],
      [49, 54, 24, 10, 55, 25],
      [24, 45, 15, 46, 46, 16],

      // 38
      [4, 152, 122, 18, 153, 123],
      [13, 74, 46, 32, 75, 47],
      [48, 54, 24, 14, 55, 25],
      [42, 45, 15, 32, 46, 16],

      // 39
      [20, 147, 117, 4, 148, 118],
      [40, 75, 47, 7, 76, 48],
      [43, 54, 24, 22, 55, 25],
      [10, 45, 15, 67, 46, 16],

      // 40
      [19, 148, 118, 6, 149, 119],
      [18, 75, 47, 31, 76, 48],
      [34, 54, 24, 34, 55, 25],
      [20, 45, 15, 61, 46, 16]
    ];

    var qrRSBlock = function(totalCount, dataCount) {
      var _this = {};
      _this.totalCount = totalCount;
      _this.dataCount = dataCount;
      return _this;
    };

    var _this = {};

    var getRsBlockTable = function(typeNumber, errorCorrectionLevel) {

      switch(errorCorrectionLevel) {
      case QRErrorCorrectionLevel.L :
        return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 0];
      case QRErrorCorrectionLevel.M :
        return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 1];
      case QRErrorCorrectionLevel.Q :
        return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 2];
      case QRErrorCorrectionLevel.H :
        return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 3];
      default :
        return undefined;
      }
    };

    _this.getRSBlocks = function(typeNumber, errorCorrectionLevel) {

      var rsBlock = getRsBlockTable(typeNumber, errorCorrectionLevel);

      if (typeof rsBlock == 'undefined') {
        throw 'bad rs block @ typeNumber:' + typeNumber +
            '/errorCorrectionLevel:' + errorCorrectionLevel;
      }

      var length = rsBlock.length / 3;

      var list = [];

      for (var i = 0; i < length; i += 1) {

        var count = rsBlock[i * 3 + 0];
        var totalCount = rsBlock[i * 3 + 1];
        var dataCount = rsBlock[i * 3 + 2];

        for (var j = 0; j < count; j += 1) {
          list.push(qrRSBlock(totalCount, dataCount) );
        }
      }

      return list;
    };

    return _this;
  }();

  //---------------------------------------------------------------------
  // qrBitBuffer
  //---------------------------------------------------------------------

  var qrBitBuffer = function() {

    var _buffer = [];
    var _length = 0;

    var _this = {};

    _this.getBuffer = function() {
      return _buffer;
    };

    _this.getAt = function(index) {
      var bufIndex = Math.floor(index / 8);
      return ( (_buffer[bufIndex] >>> (7 - index % 8) ) & 1) == 1;
    };

    _this.put = function(num, length) {
      for (var i = 0; i < length; i += 1) {
        _this.putBit( ( (num >>> (length - i - 1) ) & 1) == 1);
      }
    };

    _this.getLengthInBits = function() {
      return _length;
    };

    _this.putBit = function(bit) {

      var bufIndex = Math.floor(_length / 8);
      if (_buffer.length <= bufIndex) {
        _buffer.push(0);
      }

      if (bit) {
        _buffer[bufIndex] |= (0x80 >>> (_length % 8) );
      }

      _length += 1;
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // qrNumber
  //---------------------------------------------------------------------

  var qrNumber = function(data) {

    var _mode = QRMode.MODE_NUMBER;
    var _data = data;

    var _this = {};

    _this.getMode = function() {
      return _mode;
    };

    _this.getLength = function(buffer) {
      return _data.length;
    };

    _this.write = function(buffer) {

      var data = _data;

      var i = 0;

      while (i + 2 < data.length) {
        buffer.put(strToNum(data.substring(i, i + 3) ), 10);
        i += 3;
      }

      if (i < data.length) {
        if (data.length - i == 1) {
          buffer.put(strToNum(data.substring(i, i + 1) ), 4);
        } else if (data.length - i == 2) {
          buffer.put(strToNum(data.substring(i, i + 2) ), 7);
        }
      }
    };

    var strToNum = function(s) {
      var num = 0;
      for (var i = 0; i < s.length; i += 1) {
        num = num * 10 + chatToNum(s.charAt(i) );
      }
      return num;
    };

    var chatToNum = function(c) {
      if ('0' <= c && c <= '9') {
        return c.charCodeAt(0) - '0'.charCodeAt(0);
      }
      throw 'illegal char :' + c;
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // qrAlphaNum
  //---------------------------------------------------------------------

  var qrAlphaNum = function(data) {

    var _mode = QRMode.MODE_ALPHA_NUM;
    var _data = data;

    var _this = {};

    _this.getMode = function() {
      return _mode;
    };

    _this.getLength = function(buffer) {
      return _data.length;
    };

    _this.write = function(buffer) {

      var s = _data;

      var i = 0;

      while (i + 1 < s.length) {
        buffer.put(
          getCode(s.charAt(i) ) * 45 +
          getCode(s.charAt(i + 1) ), 11);
        i += 2;
      }

      if (i < s.length) {
        buffer.put(getCode(s.charAt(i) ), 6);
      }
    };

    var getCode = function(c) {

      if ('0' <= c && c <= '9') {
        return c.charCodeAt(0) - '0'.charCodeAt(0);
      } else if ('A' <= c && c <= 'Z') {
        return c.charCodeAt(0) - 'A'.charCodeAt(0) + 10;
      } else {
        switch (c) {
        case ' ' : return 36;
        case '$' : return 37;
        case '%' : return 38;
        case '*' : return 39;
        case '+' : return 40;
        case '-' : return 41;
        case '.' : return 42;
        case '/' : return 43;
        case ':' : return 44;
        default :
          throw 'illegal char :' + c;
        }
      }
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // qr8BitByte
  //---------------------------------------------------------------------

  var qr8BitByte = function(data) {

    var _mode = QRMode.MODE_8BIT_BYTE;
    var _data = data;
    var _bytes = qrcode.stringToBytes(data);

    var _this = {};

    _this.getMode = function() {
      return _mode;
    };

    _this.getLength = function(buffer) {
      return _bytes.length;
    };

    _this.write = function(buffer) {
      for (var i = 0; i < _bytes.length; i += 1) {
        buffer.put(_bytes[i], 8);
      }
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // qrKanji
  //---------------------------------------------------------------------

  var qrKanji = function(data) {

    var _mode = QRMode.MODE_KANJI;
    var _data = data;

    var stringToBytes = qrcode.stringToBytesFuncs['SJIS'];
    if (!stringToBytes) {
      throw 'sjis not supported.';
    }
    !function(c, code) {
      // self test for sjis support.
      var test = stringToBytes(c);
      if (test.length != 2 || ( (test[0] << 8) | test[1]) != code) {
        throw 'sjis not supported.';
      }
    }('\u53cb', 0x9746);

    var _bytes = stringToBytes(data);

    var _this = {};

    _this.getMode = function() {
      return _mode;
    };

    _this.getLength = function(buffer) {
      return ~~(_bytes.length / 2);
    };

    _this.write = function(buffer) {

      var data = _bytes;

      var i = 0;

      while (i + 1 < data.length) {

        var c = ( (0xff & data[i]) << 8) | (0xff & data[i + 1]);

        if (0x8140 <= c && c <= 0x9FFC) {
          c -= 0x8140;
        } else if (0xE040 <= c && c <= 0xEBBF) {
          c -= 0xC140;
        } else {
          throw 'illegal char at ' + (i + 1) + '/' + c;
        }

        c = ( (c >>> 8) & 0xff) * 0xC0 + (c & 0xff);

        buffer.put(c, 13);

        i += 2;
      }

      if (i < data.length) {
        throw 'illegal char at ' + (i + 1);
      }
    };

    return _this;
  };

  //=====================================================================
  // GIF Support etc.
  //

  //---------------------------------------------------------------------
  // byteArrayOutputStream
  //---------------------------------------------------------------------

  var byteArrayOutputStream = function() {

    var _bytes = [];

    var _this = {};

    _this.writeByte = function(b) {
      _bytes.push(b & 0xff);
    };

    _this.writeShort = function(i) {
      _this.writeByte(i);
      _this.writeByte(i >>> 8);
    };

    _this.writeBytes = function(b, off, len) {
      off = off || 0;
      len = len || b.length;
      for (var i = 0; i < len; i += 1) {
        _this.writeByte(b[i + off]);
      }
    };

    _this.writeString = function(s) {
      for (var i = 0; i < s.length; i += 1) {
        _this.writeByte(s.charCodeAt(i) );
      }
    };

    _this.toByteArray = function() {
      return _bytes;
    };

    _this.toString = function() {
      var s = '';
      s += '[';
      for (var i = 0; i < _bytes.length; i += 1) {
        if (i > 0) {
          s += ',';
        }
        s += _bytes[i];
      }
      s += ']';
      return s;
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // base64EncodeOutputStream
  //---------------------------------------------------------------------

  var base64EncodeOutputStream = function() {

    var _buffer = 0;
    var _buflen = 0;
    var _length = 0;
    var _base64 = '';

    var _this = {};

    var writeEncoded = function(b) {
      _base64 += String.fromCharCode(encode(b & 0x3f) );
    };

    var encode = function(n) {
      if (n < 0) {
        // error.
      } else if (n < 26) {
        return 0x41 + n;
      } else if (n < 52) {
        return 0x61 + (n - 26);
      } else if (n < 62) {
        return 0x30 + (n - 52);
      } else if (n == 62) {
        return 0x2b;
      } else if (n == 63) {
        return 0x2f;
      }
      throw 'n:' + n;
    };

    _this.writeByte = function(n) {

      _buffer = (_buffer << 8) | (n & 0xff);
      _buflen += 8;
      _length += 1;

      while (_buflen >= 6) {
        writeEncoded(_buffer >>> (_buflen - 6) );
        _buflen -= 6;
      }
    };

    _this.flush = function() {

      if (_buflen > 0) {
        writeEncoded(_buffer << (6 - _buflen) );
        _buffer = 0;
        _buflen = 0;
      }

      if (_length % 3 != 0) {
        // padding
        var padlen = 3 - _length % 3;
        for (var i = 0; i < padlen; i += 1) {
          _base64 += '=';
        }
      }
    };

    _this.toString = function() {
      return _base64;
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // base64DecodeInputStream
  //---------------------------------------------------------------------

  var base64DecodeInputStream = function(str) {

    var _str = str;
    var _pos = 0;
    var _buffer = 0;
    var _buflen = 0;

    var _this = {};

    _this.read = function() {

      while (_buflen < 8) {

        if (_pos >= _str.length) {
          if (_buflen == 0) {
            return -1;
          }
          throw 'unexpected end of file./' + _buflen;
        }

        var c = _str.charAt(_pos);
        _pos += 1;

        if (c == '=') {
          _buflen = 0;
          return -1;
        } else if (c.match(/^\s$/) ) {
          // ignore if whitespace.
          continue;
        }

        _buffer = (_buffer << 6) | decode(c.charCodeAt(0) );
        _buflen += 6;
      }

      var n = (_buffer >>> (_buflen - 8) ) & 0xff;
      _buflen -= 8;
      return n;
    };

    var decode = function(c) {
      if (0x41 <= c && c <= 0x5a) {
        return c - 0x41;
      } else if (0x61 <= c && c <= 0x7a) {
        return c - 0x61 + 26;
      } else if (0x30 <= c && c <= 0x39) {
        return c - 0x30 + 52;
      } else if (c == 0x2b) {
        return 62;
      } else if (c == 0x2f) {
        return 63;
      } else {
        throw 'c:' + c;
      }
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // gifImage (B/W)
  //---------------------------------------------------------------------

  var gifImage = function(width, height) {

    var _width = width;
    var _height = height;
    var _data = new Array(width * height);

    var _this = {};

    _this.setPixel = function(x, y, pixel) {
      _data[y * _width + x] = pixel;
    };

    _this.write = function(out) {

      //---------------------------------
      // GIF Signature

      out.writeString('GIF87a');

      //---------------------------------
      // Screen Descriptor

      out.writeShort(_width);
      out.writeShort(_height);

      out.writeByte(0x80); // 2bit
      out.writeByte(0);
      out.writeByte(0);

      //---------------------------------
      // Global Color Map

      // black
      out.writeByte(0x00);
      out.writeByte(0x00);
      out.writeByte(0x00);

      // white
      out.writeByte(0xff);
      out.writeByte(0xff);
      out.writeByte(0xff);

      //---------------------------------
      // Image Descriptor

      out.writeString(',');
      out.writeShort(0);
      out.writeShort(0);
      out.writeShort(_width);
      out.writeShort(_height);
      out.writeByte(0);

      //---------------------------------
      // Local Color Map

      //---------------------------------
      // Raster Data

      var lzwMinCodeSize = 2;
      var raster = getLZWRaster(lzwMinCodeSize);

      out.writeByte(lzwMinCodeSize);

      var offset = 0;

      while (raster.length - offset > 255) {
        out.writeByte(255);
        out.writeBytes(raster, offset, 255);
        offset += 255;
      }

      out.writeByte(raster.length - offset);
      out.writeBytes(raster, offset, raster.length - offset);
      out.writeByte(0x00);

      //---------------------------------
      // GIF Terminator
      out.writeString(';');
    };

    var bitOutputStream = function(out) {

      var _out = out;
      var _bitLength = 0;
      var _bitBuffer = 0;

      var _this = {};

      _this.write = function(data, length) {

        if ( (data >>> length) != 0) {
          throw 'length over';
        }

        while (_bitLength + length >= 8) {
          _out.writeByte(0xff & ( (data << _bitLength) | _bitBuffer) );
          length -= (8 - _bitLength);
          data >>>= (8 - _bitLength);
          _bitBuffer = 0;
          _bitLength = 0;
        }

        _bitBuffer = (data << _bitLength) | _bitBuffer;
        _bitLength = _bitLength + length;
      };

      _this.flush = function() {
        if (_bitLength > 0) {
          _out.writeByte(_bitBuffer);
        }
      };

      return _this;
    };

    var getLZWRaster = function(lzwMinCodeSize) {

      var clearCode = 1 << lzwMinCodeSize;
      var endCode = (1 << lzwMinCodeSize) + 1;
      var bitLength = lzwMinCodeSize + 1;

      // Setup LZWTable
      var table = lzwTable();

      for (var i = 0; i < clearCode; i += 1) {
        table.add(String.fromCharCode(i) );
      }
      table.add(String.fromCharCode(clearCode) );
      table.add(String.fromCharCode(endCode) );

      var byteOut = byteArrayOutputStream();
      var bitOut = bitOutputStream(byteOut);

      // clear code
      bitOut.write(clearCode, bitLength);

      var dataIndex = 0;

      var s = String.fromCharCode(_data[dataIndex]);
      dataIndex += 1;

      while (dataIndex < _data.length) {

        var c = String.fromCharCode(_data[dataIndex]);
        dataIndex += 1;

        if (table.contains(s + c) ) {

          s = s + c;

        } else {

          bitOut.write(table.indexOf(s), bitLength);

          if (table.size() < 0xfff) {

            if (table.size() == (1 << bitLength) ) {
              bitLength += 1;
            }

            table.add(s + c);
          }

          s = c;
        }
      }

      bitOut.write(table.indexOf(s), bitLength);

      // end code
      bitOut.write(endCode, bitLength);

      bitOut.flush();

      return byteOut.toByteArray();
    };

    var lzwTable = function() {

      var _map = {};
      var _size = 0;

      var _this = {};

      _this.add = function(key) {
        if (_this.contains(key) ) {
          throw 'dup key:' + key;
        }
        _map[key] = _size;
        _size += 1;
      };

      _this.size = function() {
        return _size;
      };

      _this.indexOf = function(key) {
        return _map[key];
      };

      _this.contains = function(key) {
        return typeof _map[key] != 'undefined';
      };

      return _this;
    };

    return _this;
  };

  var createDataURL = function(width, height, getPixel) {
    var gif = gifImage(width, height);
    for (var y = 0; y < height; y += 1) {
      for (var x = 0; x < width; x += 1) {
        gif.setPixel(x, y, getPixel(x, y) );
      }
    }

    var b = byteArrayOutputStream();
    gif.write(b);

    var base64 = base64EncodeOutputStream();
    var bytes = b.toByteArray();
    for (var i = 0; i < bytes.length; i += 1) {
      base64.writeByte(bytes[i]);
    }
    base64.flush();

    return 'data:image/gif;base64,' + base64;
  };

  //---------------------------------------------------------------------
  // returns qrcode function.

  return qrcode;
}();

// multibyte support
!function() {

  qrcode.stringToBytesFuncs['UTF-8'] = function(s) {
    // http://stackoverflow.com/questions/18729405/how-to-convert-utf8-string-to-byte-array
    function toUTF8Array(str) {
      var utf8 = [];
      for (var i=0; i < str.length; i++) {
        var charcode = str.charCodeAt(i);
        if (charcode < 0x80) utf8.push(charcode);
        else if (charcode < 0x800) {
          utf8.push(0xc0 | (charcode >> 6),
              0x80 | (charcode & 0x3f));
        }
        else if (charcode < 0xd800 || charcode >= 0xe000) {
          utf8.push(0xe0 | (charcode >> 12),
              0x80 | ((charcode>>6) & 0x3f),
              0x80 | (charcode & 0x3f));
        }
        // surrogate pair
        else {
          i++;
          // UTF-16 encodes 0x10000-0x10FFFF by
          // subtracting 0x10000 and splitting the
          // 20 bits of 0x0-0xFFFFF into two halves
          charcode = 0x10000 + (((charcode & 0x3ff)<<10)
            | (str.charCodeAt(i) & 0x3ff));
          utf8.push(0xf0 | (charcode >>18),
              0x80 | ((charcode>>12) & 0x3f),
              0x80 | ((charcode>>6) & 0x3f),
              0x80 | (charcode & 0x3f));
        }
      }
      return utf8;
    }
    return toUTF8Array(s);
  };

}();

(function (factory) {
  if (typeof define === 'function' && define.amd) {
      define([], factory);
  } else if (typeof exports === 'object') {
      module.exports = factory();
  }
}(function () {
    return qrcode;
}));
