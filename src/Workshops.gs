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
