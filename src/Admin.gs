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
