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
