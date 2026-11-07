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
