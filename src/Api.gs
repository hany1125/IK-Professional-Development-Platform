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
