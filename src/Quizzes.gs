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
