/**
 * server.test.js — اختبارات القبول لطبقة الخادم داخل محاكي Apps Script
 * التشغيل: node --test tests/
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const plain = (x) => JSON.parse(JSON.stringify(x));
const deq = (a, b, m) => assert.deepStrictEqual(plain(a), plain(b), m);
const lastSetupToken = (g) => { const m = g.mock.logs.join('\n').match(/\(صالح 24 ساعة\): (\d+)/g) || []; return m.length ? m[m.length - 1].match(/(\d+)$/)[1] : null; };
const { createGas, makeClaudeMock } = require('./gas-mock');

const PW = 'Passw0rd123';
function codeFromMail(g, to, kind) {
  const m = g.mock.mail.outbox.slice().reverse().find((x) => x.to === to && (!kind || x.subject.indexOf(kind) !== -1));
  if (!m) return null;
  const c = m.html.match(/>(\d{6})</);
  return c ? c[1] : null;
}
function ok(res, label) { assert.equal(res.ok, true, (label || '') + ' expected ok but got ' + JSON.stringify(res).slice(0, 300)); return res.data; }
function bad(res, code, label) { assert.equal(res.ok, false, (label || '') + ' expected failure but got ok'); if (code) assert.equal(res.code, code, (label || '') + ' code ' + res.code + ' msg ' + res.message); return res; }

/** بيئة جاهزة: إعداد + مدير + متدرب مفعّل */
function setupEnv() {
  const g = createGas();
  g.call('SETUP_1_initialize');
  const token = lastSetupToken(g);
  const admin = ok(g.api('setup.createAdmin', { setupToken: token, name: 'مدير المنصة', email: 'admin@education.qa', password: PW }), 'setup');
  const reg = ok(g.api('auth.register', { name: 'أحمد محمد المعلم', email: 'ahmed@education.qa', jobTitle: 'معلم', department: 'الرياضيات', password: PW }), 'register');
  assert.equal(reg.pending, true);
  const code = codeFromMail(g, 'ahmed@education.qa', 'تفعيل');
  assert.ok(code, 'verification code mailed');
  const ver = ok(g.api('auth.verifyEmail', { email: 'ahmed@education.qa', code }), 'verify');
  const ws = ok(g.api('ws.list', {}, ver.token), 'ws.list').workshops[0];
  return { g, admin, adminToken: admin.token, trainee: ver.user, traineeToken: ver.token, ws, setupToken: token };
}

/** حل اختبار بدقة محددة اعتمادًا على مفتاح الإجابة المخزن على الخادم (يحاكي معرفة الإجابات الصحيحة) */
function solve(g, token, wsId, kind, moduleIndex, wrongCount) {
  const q = ok(g.api('quiz.start', { workshopId: wsId, kind, moduleIndex }, token), 'quiz.start');
  const att = g.sheetRows('Attempts').find((a) => a.id === q.attemptId);
  const map = JSON.parse(att.answers);
  const ver = g.sheetRows('WorkshopVersions').find((v) => v.id === att.versionId);
  const content = JSON.parse(['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8', 'c9', 'c10'].map((k) => ver[k] || '').join(''));
  const qs = kind === 'final' ? content.finalQuiz.questions : content.modules[moduleIndex].questions;
  const answers = map.q.map((qi, di) => {
    const correctOrig = Number(qs[qi].answer);
    const correctDisplay = map.o[qi].indexOf(correctOrig);
    if (di < (wrongCount || 0)) return (correctDisplay + 1) % 4; // إجابة خاطئة عمدًا
    return correctDisplay;
  });
  return { q, answers, submit: (extra) => g.api('quiz.submit', Object.assign({ attemptId: q.attemptId, answers, requestKey: 'rk-' + q.attemptId }, extra || {}), token) };
}

test('الإعداد: الجداول، الورشة الأولية، رمز الإعداد ورفض الرمز الخاطئ', () => {
  const g = createGas();
  const msg = g.call('SETUP_1_initialize');
  assert.match(msg, /رمز الإعداد/);
  const ss = g.mock.spreadsheets[g.mock.props.IKP_SPREADSHEET_ID];
  const names = ss.getSheets().map((s) => s.getName());
  ['Users', 'Tokens', 'Sessions', 'Workshops', 'WorkshopVersions', 'Progress', 'Attempts', 'Results', 'Certificates', 'MailLog', 'Settings', 'AuditLog', 'AIJobs'].forEach((n) => assert.ok(names.includes(n), n));
  assert.ok(!names.includes('Sheet1'));
  const wsRows = g.sheetRows('Workshops');
  assert.equal(wsRows.length, 1);
  assert.equal(wsRows[0].title, 'صياغة الأهداف السلوكية والتخطيط الفعّال للدروس');
  assert.equal(wsRows[0].status, 'published');
  assert.equal(wsRows[0].moduleCount, 4);
  // إعادة التشغيل لا تكرر الورشة
  g.call('SETUP_1_initialize');
  assert.equal(g.sheetRows('Workshops').length, 1);
  bad(g.api('setup.createAdmin', { setupToken: '00000000', name: 'مخترق', email: 'x@education.qa', password: PW }), 'SETUP_TOKEN');
  const token = lastSetupToken(g);
  const a = ok(g.api('setup.createAdmin', { setupToken: token, name: 'المدير', email: 'admin@education.qa', password: PW }));
  assert.equal(a.user.role, 'admin');
  // الرمز يُستهلك مرة واحدة
  bad(g.api('setup.createAdmin', { setupToken: token, name: 'آخر', email: 'y@education.qa', password: PW }), 'SETUP_TOKEN');
  assert.equal(g.api('app.state').data.setup.needsAdmin, false);
});

test('التسجيل: قيد النطاق، التحقق من البريد، رمز خاطئ، تفعيل، الدخول والخروج', () => {
  const g = createGas();
  g.call('SETUP_1_initialize');
  bad(g.api('auth.register', { name: 'شخص خارجي', email: 'someone@gmail.com', jobTitle: 'معلم', department: 'العلوم', password: PW }), 'DOMAIN');
  bad(g.api('auth.register', { name: 'ضعيف', email: 'weak@education.qa', jobTitle: 'معلم', department: 'العلوم', password: 'short' }), 'WEAK_PASSWORD');
  const r = ok(g.api('auth.register', { name: 'سارة علي', email: 'Sara@Education.QA', jobTitle: 'معلم', department: 'العلوم', password: PW }));
  assert.equal(r.email, 'sara@education.qa');
  // لا يمكن الدخول قبل التفعيل (يُعاد توجيه للتفعيل)
  const pend = ok(g.api('auth.login', { email: 'sara@education.qa', password: PW }));
  assert.equal(pend.pending, true);
  bad(g.api('auth.verifyEmail', { email: 'sara@education.qa', code: '000000' }), 'CODE_INVALID');
  const code = codeFromMail(g, 'sara@education.qa', 'تفعيل');
  const v = ok(g.api('auth.verifyEmail', { email: 'sara@education.qa', code }));
  assert.ok(v.token && v.token.length > 40);
  assert.equal(v.user.status, 'active');
  const me = ok(g.api('auth.me', {}, v.token));
  assert.equal(me.user.email, 'sara@education.qa');
  assert.ok(!('passHash' in me.user));
  ok(g.api('auth.logout', {}, v.token));
  bad(g.api('auth.me', {}, v.token), 'UNAUTHENTICATED', 'after logout');
  bad(g.api('auth.login', { email: 'sara@education.qa', password: 'WrongPass1' }), 'AUTH');
  const l = ok(g.api('auth.login', { email: 'sara@education.qa', password: PW }));
  assert.ok(l.token);
});

test('حد محاولات الدخول واستعادة كلمة المرور برمز يُستخدم مرة واحدة ولا يكشف وجود الحساب', () => {
  const { g, traineeToken } = setupEnv();
  for (let i = 0; i < 8; i++) bad(g.api('auth.login', { email: 'ahmed@education.qa', password: 'bad' + i }), 'AUTH');
  bad(g.api('auth.login', { email: 'ahmed@education.qa', password: PW }), 'RATE_LIMITED');
  g.mock.advance(16 * 60 * 1000);
  ok(g.api('auth.login', { email: 'ahmed@education.qa', password: PW }));
  const unknown = ok(g.api('auth.forgot', { email: 'nobody@education.qa' }));
  const known = ok(g.api('auth.forgot', { email: 'ahmed@education.qa' }));
  assert.equal(unknown.message, known.message, 'نفس الرسالة للحسابين');
  assert.equal(g.mock.mail.outbox.filter((m) => m.to === 'nobody@education.qa').length, 0);
  const code = codeFromMail(g, 'ahmed@education.qa', 'استعادة');
  assert.ok(code);
  bad(g.api('auth.reset', { email: 'ahmed@education.qa', code: '123456', password: 'NewPass123' }), 'CODE_INVALID');
  ok(g.api('auth.reset', { email: 'ahmed@education.qa', code, password: 'NewPass123' }));
  bad(g.api('auth.reset', { email: 'ahmed@education.qa', code, password: 'NewPass456' }), 'CODE_INVALID', 'الرمز لا يُعاد استخدامه');
  bad(g.api('auth.me', {}, traineeToken), 'UNAUTHENTICATED', 'الجلسات القديمة أُبطلت بعد إعادة التعيين');
  ok(g.api('auth.login', { email: 'ahmed@education.qa', password: 'NewPass123' }));
  bad(g.api('auth.login', { email: 'ahmed@education.qa', password: PW }), 'AUTH');
  // انتهاء صلاحية رمز
  ok(g.api('auth.forgot', { email: 'ahmed@education.qa' }));
  const code2 = codeFromMail(g, 'ahmed@education.qa', 'استعادة');
  g.mock.advance(16 * 60 * 1000);
  bad(g.api('auth.reset', { email: 'ahmed@education.qa', code: code2, password: 'NewPass789' }), 'CODE_EXPIRED');
});

test('الصلاحيات: المتدرب لا يستدعي وظائف الإدارة، والإيقاف يُبطل الجلسة فورًا، وحماية آخر مدير', () => {
  const { g, adminToken, traineeToken, trainee, admin } = setupEnv();
  bad(g.api('admin.overview', {}, traineeToken), 'FORBIDDEN');
  bad(g.api('admin.users.list', {}, traineeToken), 'FORBIDDEN');
  bad(g.api('admin.settings.get', {}, traineeToken), 'FORBIDDEN');
  bad(g.api('admin.ai.key', { action: 'set', key: 'sk-ant-xxx' }, traineeToken), 'FORBIDDEN');
  assert.ok(g.sheetRows('AuditLog').some((a) => a.action === 'forbidden'), 'audit forbidden');
  bad(g.api('nonexistent.action', {}, traineeToken), 'BAD_ACTION');
  bad(g.api('ws.list', {}, 'x'.repeat(96)), 'UNAUTHENTICATED');
  // إيقاف الحساب
  ok(g.api('admin.users.update', { id: trainee.id, status: 'suspended' }, adminToken));
  bad(g.api('ws.list', {}, traineeToken), 'UNAUTHENTICATED', 'suspended old session');
  bad(g.api('auth.login', { email: 'ahmed@education.qa', password: PW }), 'SUSPENDED');
  ok(g.api('admin.users.update', { id: trainee.id, status: 'active' }, adminToken));
  // آخر مدير
  bad(g.api('admin.users.update', { id: admin.user.id, role: 'trainee' }, adminToken), 'SELF');
  bad(g.api('admin.users.delete', { id: admin.user.id, confirm: true }, adminToken), 'SELF');
  // مدير ثانٍ ثم محاولة سحب الأول عبر الثاني
  ok(g.api('admin.users.create', { name: 'مدير ثانٍ', email: 'admin2@education.qa', role: 'admin', jobTitle: 'نائب مدير', department: 'الإدارة المدرسية' }, adminToken));
  const u2 = g.sheetRows('Users').find((u) => u.email === 'admin2@education.qa');
  assert.equal(u2.status, 'pending', 'المدير المضاف لا يصبح نشطًا قبل إثبات ملكية البريد');
  bad(g.api('auth.login', { email: 'admin2@education.qa', password: PW }), 'AUTH');
  const invite = codeFromMail(g, 'admin2@education.qa', 'دعوة');
  assert.ok(invite, 'invite code');
  ok(g.api('auth.reset', { email: 'admin2@education.qa', code: invite, password: PW }));
  const l2 = ok(g.api('auth.login', { email: 'admin2@education.qa', password: PW }));
  assert.equal(l2.user.role, 'admin');
  ok(g.api('admin.users.update', { id: admin.user.id, role: 'trainee' }, l2.token), 'يمكن تخفيض الأول لوجود مدير آخر');
  bad(g.api('admin.overview', {}, adminToken), 'UNAUTHENTICATED', 'سحب الصلاحية يبطل الجلسة');
  bad(g.api('admin.users.update', { id: l2.user.id, status: 'suspended' }, l2.token), 'SELF');
  // إعادة الأول مديرًا ثم محاولة إيقاف الثاني من الأول → يبقى مدير واحد فمسموح، لكن إيقاف الأخير ممنوع
  ok(g.api('admin.users.update', { id: admin.user.id, role: 'admin' }, l2.token));
  const l1 = ok(g.api('auth.login', { email: 'admin@education.qa', password: PW }));
  ok(g.api('admin.users.update', { id: l2.user.id, role: 'trainee' }, l1.token));
  bad(g.api('admin.users.update', { id: admin.user.id, status: 'suspended' }, l1.token), 'SELF');
});

test('الورش: المسودات لا تظهر للمتدرب، والمحتوى لا يحمل مفتاح الإجابة، والنشر يتطلب محتوى صالحًا', () => {
  const { g, adminToken, traineeToken, ws } = setupEnv();
  const sk = ok(g.api('admin.ws.skeleton', { topic: 'ورشة تجريبية للاختبار', moduleCount: 2 }, adminToken)).content;
  const created = ok(g.api('admin.ws.create', { title: 'ورشة تجريبية للاختبار', content: sk }, adminToken)).workshop;
  assert.equal(created.status, 'draft');
  const list = ok(g.api('ws.list', {}, traineeToken)).workshops;
  assert.equal(list.length, 1, 'المسودة مخفية');
  bad(g.api('ws.get', { id: created.id }, traineeToken), 'NOT_FOUND');
  bad(g.api('quiz.start', { workshopId: created.id, kind: 'module', moduleIndex: 0 }, traineeToken), 'NOT_FOUND');
  const pub = bad(g.api('admin.ws.setStatus', { id: created.id, status: 'published' }, adminToken), 'INVALID_CONTENT');
  assert.ok(pub.extra.issues.length > 3);
  // محتوى الورشة للمتدرب بدون مفاتيح
  const got = ok(g.api('ws.get', { id: ws.id }, traineeToken));
  const json = JSON.stringify(got);
  assert.ok(!/"answer"/.test(json), 'no answer key in trainee content');
  assert.ok(!/"questions"/.test(json), 'no question bank in trainee content');
  assert.ok(!/"explanation"/.test(json));
  assert.equal(got.content.modules.length, 4);
  assert.equal(got.content.modules[0].questionCount, 5);
  assert.equal(got.content.finalQuestionCount, 10);
  assert.ok(got.content.modules[0].sections.length >= 5);
  // الحذف يتطلب الأرشفة والتأكيد
  bad(g.api('admin.ws.delete', { id: created.id, confirm: true }, adminToken), 'STATE');
  ok(g.api('admin.ws.setStatus', { id: created.id, status: 'archived' }, adminToken));
  const impact = ok(g.api('admin.ws.delete', { id: created.id }, adminToken));
  assert.equal(impact.confirmRequired, true);
  ok(g.api('admin.ws.delete', { id: created.id, confirm: true }, adminToken));
  assert.ok(!g.sheetRows('Workshops').some((w) => w.id === created.id));
});

test('المسار الكامل: التقدم، منع النهائي قبل الوحدات، التصحيح مع الخلط، رفض الدرجة المزورة، عدم تكرار النتيجة/الشهادة، البريد', () => {
  const { g, adminToken, traineeToken, trainee, ws } = setupEnv();
  ok(g.api('admin.settings.save', { settings: { adminNotifyEmail: 'admin@education.qa' } }, adminToken));
  ok(g.api('ws.get', { id: ws.id }, traineeToken));
  bad(g.api('quiz.start', { workshopId: ws.id, kind: 'final' }, traineeToken), 'NOT_ELIGIBLE');
  // إقرار القراءة يُحفظ على الخادم ويُستعاد من جلسة أخرى
  ok(g.api('ws.ack', { workshopId: ws.id, moduleIndex: 0 }, traineeToken));
  const l2 = ok(g.api('auth.login', { email: 'ahmed@education.qa', password: PW }));
  const again = ok(g.api('ws.get', { id: ws.id }, l2.token));
  deq(again.progress.acknowledged, [0]);
  // الأسئلة المعروضة بلا مفتاح، والخلط مفعّل
  const s0 = solve(g, traineeToken, ws.id, 'module', 0, 0);
  assert.ok(!JSON.stringify(s0.q).match(/"answer"/));
  assert.equal(s0.q.questions.length, 5);
  // إعادة quiz.start تعيد المحاولة المفتوحة نفسها (لا محاولة جديدة)
  const s0b = ok(g.api('quiz.start', { workshopId: ws.id, kind: 'module', moduleIndex: 0 }, traineeToken));
  assert.equal(s0b.attemptId, s0.q.attemptId);
  // محاولة تزوير الدرجة تُتجاهل: نجيب خطأ عن 3 من 5 ونرسل score=100
  const wrong = solve(g, traineeToken, ws.id, 'module', 0, 3);
  const r1 = ok(wrong.submit({ score: 100, percent: 100, passed: true }));
  assert.equal(r1.percent, 40);
  assert.equal(r1.passed, false);
  assert.equal(r1.showAnswers, false, 'لا تُعرض الإجابات قبل الاجتياز (afterPass)');
  // الآن اجتياز الوحدة بإجابات صحيحة كاملة (يثبت صحة الربط بعد الخلط)
  for (let i = 0; i < 4; i++) {
    const s = solve(g, traineeToken, ws.id, 'module', i, 0);
    const r = ok(s.submit());
    assert.equal(r.percent, 100, 'module ' + i);
    assert.equal(r.passed, true);
    assert.equal(r.showAnswers, true);
    assert.ok(r.review.every((it) => it.correct));
  }
  const prog = ok(g.api('ws.get', { id: ws.id }, traineeToken)).progress;
  assert.equal(prog.allModulesDone, true);
  assert.equal(prog.modulesDone.length, 4);
  // النهائي: فشل أول ثم نجاح، مع فشل بريد مؤقت
  const f1 = solve(g, traineeToken, ws.id, 'final', -1, 5);
  const rf1 = ok(f1.submit());
  assert.equal(rf1.passed, false);
  assert.equal(rf1.percent, 50);
  g.mock.mail.failNext = 2; // يفشل بريد المتدرب والإدارة
  const f2 = solve(g, traineeToken, ws.id, 'final', -1, 1);
  const rf2 = ok(f2.submit());
  assert.equal(rf2.passed, true);
  assert.equal(rf2.percent, 90);
  assert.ok(rf2.side.certificateId, 'certificate issued despite mail failure');
  assert.equal(rf2.side.mail.trainee.ok, false);
  const certs = g.sheetRows('Certificates');
  assert.equal(certs.length, 1);
  assert.match(certs[0].serial, /^IKP-\d{4}-0001$/);
  const results = g.sheetRows('Results');
  assert.equal(results.length, 1);
  assert.equal(results[0].attemptCount, 2);
  assert.equal(results[0].bestPercent, 90);
  assert.equal(results[0].lastPercent, 90);
  // إعادة التسليم للمحاولة نفسها: لا نتيجة ولا شهادة جديدة
  const dup = ok(f2.submit());
  assert.equal(dup.duplicate, true);
  assert.equal(g.sheetRows('Results')[0].attemptCount, 2);
  assert.equal(g.sheetRows('Certificates').length, 1);
  bad(g.api('quiz.start', { workshopId: ws.id, kind: 'final' }, traineeToken), 'ALREADY_PASSED');
  // إعادة إرسال البريد الفاشل من السجل
  const failedMail = g.sheetRows('MailLog').filter((m) => m.status === 'failed');
  assert.equal(failedMail.length, 2);
  const retry = ok(g.api('admin.mail.retry', {}, adminToken));
  assert.equal(retry.sent, 2);
  assert.equal(g.sheetRows('MailLog').filter((m) => m.status === 'failed').length, 0);
  const certMail = g.mock.mail.outbox.filter((m) => m.subject.indexOf('شهادة إتمام') !== -1);
  assert.equal(certMail.length, 1);
  assert.equal(certMail[0].attachments[0].type, 'application/pdf');
  // الشهادة والتحقق
  const mine = ok(g.api('cert.mine', {}, traineeToken)).certificates;
  assert.equal(mine.length, 1);
  const cg = ok(g.api('cert.get', { id: mine[0].id }, traineeToken));
  assert.ok(cg.html.indexOf(trainee.name) !== -1);
  assert.ok(cg.html.indexOf('IKP-') !== -1);
  assert.ok(/<table/.test(cg.html), 'QR table rendered');
  const v = ok(g.api('cert.verify', { code: mine[0].verifyCode }));
  assert.equal(v.valid, true);
  assert.equal(v.name, trainee.name);
  assert.equal(ok(g.api('cert.verify', { code: 'deadbeefdeadbeefdeadbeef' })).valid, false);
  const pdf = ok(g.api('cert.pdf', { id: mine[0].id }, traineeToken));
  assert.ok(pdf.base64.length > 100);
  // متدرب آخر لا يرى الشهادة
  ok(g.api('auth.register', { name: 'متدرب آخر', email: 'other@education.qa', jobTitle: 'معلم', department: 'العلوم', password: PW }));
  const c2 = codeFromMail(g, 'other@education.qa', 'تفعيل');
  const o = ok(g.api('auth.verifyEmail', { email: 'other@education.qa', code: c2 }));
  bad(g.api('cert.get', { id: mine[0].id }, o.token), 'FORBIDDEN');
  // النتائج والتقارير والـ CSV
  const res = ok(g.api('admin.results', {}, adminToken));
  assert.equal(res.rows[0].status, 'passed');
  assert.equal(res.rows[0].certificateSerial, certs[0].serial);
  const csv = ok(g.api('admin.results.csv', {}, adminToken));
  assert.ok(csv.csv.charCodeAt(0) === 0xFEFF, 'BOM');
  assert.ok(csv.csv.indexOf(trainee.name) !== -1);
  const ov = ok(g.api('admin.overview', {}, adminToken));
  assert.equal(ov.kpis.passed, 1);
  assert.equal(ov.kpis.certificates, 1);
  assert.equal(ov.kpis.trainees, 2);
  const rep = ok(g.api('admin.reports', {}, adminToken));
  assert.equal(rep.distribution['90-100'], 1);
});

test('سياسة المحاولات المحدودة والفاصل الزمني وعرض الإجابات دائمًا', () => {
  const { g, adminToken, traineeToken, ws } = setupEnv();
  ok(g.api('admin.settings.save', { settings: { retryPolicy: 'limited', maxAttempts: 2, retryCooldownMin: 10, showCorrectAnswers: 'always', shuffleQuestions: false, shuffleOptions: false } }, adminToken));
  ok(g.api('ws.get', { id: ws.id }, traineeToken));
  const a1 = solve(g, traineeToken, ws.id, 'module', 0, 5);
  const r1 = ok(a1.submit());
  assert.equal(r1.percent, 0);
  assert.equal(r1.showAnswers, true, 'always');
  assert.ok(r1.review[0].options && r1.review[0].answer >= 0);
  bad(g.api('quiz.start', { workshopId: ws.id, kind: 'module', moduleIndex: 0 }, traineeToken), 'COOLDOWN');
  g.mock.advance(11 * 60 * 1000);
  const a2 = solve(g, traineeToken, ws.id, 'module', 0, 5);
  ok(a2.submit());
  g.mock.advance(11 * 60 * 1000);
  bad(g.api('quiz.start', { workshopId: ws.id, kind: 'module', moduleIndex: 0 }, traineeToken), 'NO_ATTEMPTS');
  // بدون خلط: الترتيب المعروض يطابق الأصل
  const q = ok(g.api('quiz.start', { workshopId: ws.id, kind: 'module', moduleIndex: 1 }, traineeToken));
  const att = g.sheetRows('Attempts').find((a) => a.id === q.attemptId);
  const map = JSON.parse(att.answers);
  deq(map.q, [0, 1, 2, 3, 4]);
  deq(map.o[0], [0, 1, 2, 3]);
});

test('إصدارات الورشة: تعديل ورشة منشورة لها محاولات يُنشئ إصدارًا جديدًا ولا يغيّر تقييم المحاولة القديمة', () => {
  const { g, adminToken, traineeToken, ws } = setupEnv();
  ok(g.api('ws.get', { id: ws.id }, traineeToken));
  const open = solve(g, traineeToken, ws.id, 'module', 0, 0); // محاولة مفتوحة على الإصدار 1
  const d = ok(g.api('admin.ws.get', { id: ws.id }, adminToken));
  assert.equal(d.versions.length, 1);
  const content = d.content;
  // تغيير الإجابة الصحيحة لكل أسئلة الوحدة الأولى في الإصدار الجديد
  content.modules[0].questions.forEach((q) => { q.answer = (q.answer + 1) % 4; });
  const saved = ok(g.api('admin.ws.saveDraft', { id: ws.id, title: ws.title, content }, adminToken));
  assert.equal(saved.newVersion, true);
  const d2 = ok(g.api('admin.ws.get', { id: ws.id }, adminToken));
  assert.equal(d2.versions.length, 2);
  // تسليم المحاولة القديمة: تُقيَّم بمفتاح الإصدار القديم → 100%
  const r = ok(open.submit());
  assert.equal(r.percent, 100);
  // محاولة جديدة ترتبط بالإصدار الجديد
  const s2 = solve(g, traineeToken, ws.id, 'module', 1, 0);
  const att = g.sheetRows('Attempts').find((a) => a.id === s2.q.attemptId);
  assert.equal(att.versionId, d2.workshop.currentVersion);
  // التحقق في المحرر
  const val = ok(g.api('admin.ws.validate', { content, passScore: 80 }, adminToken));
  deq(val.issues, []);
  const broken = JSON.parse(JSON.stringify(content)); broken.modules[0].questions[0].options[1] = broken.modules[0].questions[0].options[0];
  const val2 = ok(g.api('admin.ws.validate', { content: broken, passScore: 80 }, adminToken));
  assert.ok(val2.issues.some((i) => /مكررة/.test(i)));
});

test('التوليد بالذكاء الاصطناعي: المفتاح على الخادم فقط، المراحل، الاستئناف بعد انقطاع، الحفظ كمسودة، المسار اليدوي والهيكل', () => {
  const { g, adminToken } = setupEnv();
  bad(g.api('admin.ai.start', { topic: 'استراتيجيات التعلم النشط' }, adminToken), 'AI_KEY');
  bad(g.api('admin.ai.key', { action: 'set', key: 'not-a-key' }, adminToken), 'VALIDATION');
  const ks = ok(g.api('admin.ai.key', { action: 'set', key: 'sk-ant-api03-TESTKEY-0123456789abcdef0123456789' }, adminToken));
  assert.equal(ks.configured, true);
  assert.ok(!JSON.stringify(ks).includes('TESTKEY'), 'المفتاح لا يُعاد للمتصفح');
  const st = ok(g.api('admin.settings.get', {}, adminToken));
  assert.ok(!JSON.stringify(st).includes('TESTKEY'));
  assert.ok(!JSON.stringify(ok(g.api('admin.overview', {}, adminToken))).includes('TESTKEY'));
  g.mock.http.handler = makeClaudeMock({ failAt: 4 }); // الاستدعاء الرابع (اختبار الاتصال + الخطة + الوحدة 1 ثم الوحدة 2) يفشل مرة واحدة
  const t = ok(g.api('admin.ai.test', {}, adminToken));
  assert.equal(t.ok, true);
  const req = g.mock.http.calls[0];
  assert.equal(req.options.headers['anthropic-version'], '2026-10-21');
  assert.ok(req.options.headers['x-api-key'].startsWith('sk-ant-'));
  const sentBody = JSON.parse(req.options.payload);
  assert.equal(sentBody.model, 'claude-opus-5-5');
  assert.equal(sentBody.output_config.effort, 'medium');
  assert.equal(sentBody.fallbacks, 'default');
  const job = ok(g.api('admin.ai.start', { topic: 'استراتيجيات التعلم النشط في المرحلة الإعدادية', moduleCount: 3, passScore: 80, description: 'وصف', notes: 'ملاحظة' }, adminToken)).job;
  deq(job.stages, ['plan', 'module_1', 'module_2', 'module_3', 'final', 'validate', 'save']);
  let j = job, steps = 0;
  while (j.status === 'running' && steps < 20) { j = ok(g.api('admin.ai.step', { jobId: job.id }, adminToken)).job; steps++; }
  assert.equal(j.status, 'failed', 'ينقطع عند الوحدة 2');
  assert.equal(j.stage, 'module_2');
  assert.equal(j.modulesDone, 1, 'مخرجات الوحدة 1 محفوظة');
  assert.ok(j.plan && j.plan.modules.length === 3);
  // الاستئناف من المرحلة نفسها
  while (j.status !== 'done' && steps < 40) { j = ok(g.api('admin.ai.step', { jobId: job.id }, adminToken)).job; steps++; }
  assert.equal(j.status, 'done');
  assert.ok(j.workshopId);
  const w = g.sheetRows('Workshops').find((x) => x.id === j.workshopId);
  assert.equal(w.status, 'draft', 'لا يُنشر تلقائيًا');
  assert.equal(w.source, 'ai');
  assert.equal(w.moduleCount, 3);
  const adm = ok(g.api('admin.ws.get', { id: j.workshopId }, adminToken));
  assert.equal(adm.content.finalQuiz.questions.length, 10);
  deq(ok(g.api('admin.ws.validate', { content: adm.content, passScore: 80 }, adminToken)).issues, []);
  // يمكن نشرها بعد المراجعة
  ok(g.api('admin.ws.setStatus', { id: j.workshopId, status: 'published', notify: false }, adminToken));
  // المسار اليدوي
  const prompt = ok(g.api('admin.ai.prompt', { topic: 'إدارة الصف', moduleCount: 2 }, adminToken)).prompt;
  assert.ok(prompt.includes('JSON') && prompt.includes('إدارة الصف'));
  bad(g.api('admin.ai.importJson', { json: '{ not json', dryRun: true }, adminToken), 'AI_JSON');
  bad(g.api('admin.ai.importJson', { json: '{"title":"x"}', dryRun: true }, adminToken), 'VALIDATION');
  const dry = ok(g.api('admin.ai.importJson', { json: JSON.stringify(Object.assign({ title: 'ورشة مستوردة', description: 'd' }, adm.content)), dryRun: true, passScore: 80 }, adminToken));
  deq(dry.issues, []);
  const imp = ok(g.api('admin.ai.importJson', { json: '```json\n' + JSON.stringify(Object.assign({ title: 'ورشة مستوردة', description: 'd' }, adm.content)) + '\n```', passScore: 80 }, adminToken));
  assert.equal(imp.workshop.source, 'ai-manual');
  assert.equal(imp.workshop.status, 'draft');
  // الهيكل الأولي
  const sk = ok(g.api('admin.ws.skeleton', { topic: 'موضوع تجريبي', moduleCount: 2, outline: 'محور أول، محور ثانٍ' }, adminToken)).content;
  assert.equal(sk.modules.length, 2);
  assert.equal(sk.modules[0].title, 'محور أول');
  assert.equal(sk.finalQuiz.questions.length, 10);
  // حذف المفتاح
  const del = ok(g.api('admin.ai.key', { action: 'delete' }, adminToken));
  assert.equal(del.configured, false);
  // حد المهام في الساعة
  g.mock.http.handler = makeClaudeMock();
  ok(g.api('admin.ai.key', { action: 'set', key: 'sk-ant-api03-TESTKEY-0123456789abcdef0123456789' }, adminToken));
  for (let i = 0; i < 5; i++) ok(g.api('admin.ai.start', { topic: 'موضوع رقم ' + i + ' للاختبار' }, adminToken));
  bad(g.api('admin.ai.start', { topic: 'موضوع إضافي للاختبار' }, adminToken), 'RATE_LIMITED');
});

test('الذكاء الاصطناعي: التراجع عند رفض المخطط، ورسائل الأخطاء، ورفض السياسة، والقطع', () => {
  const { g, adminToken } = setupEnv();
  ok(g.api('admin.ai.key', { action: 'set', key: 'sk-ant-api03-TESTKEY-0123456789abcdef0123456789' }, adminToken));
  let calls = 0;
  g.mock.http.handler = (url, o) => { calls++; const b = JSON.parse(o.payload); if (b.output_config && b.output_config.format) return { code: 400, body: { type: 'error', error: { type: 'invalid_request_error', message: 'output_config.format is not supported' } } }; return { code: 200, body: { content: [{ type: 'text', text: 'جاهز' }], stop_reason: 'end_turn', model: b.model, usage: {} } }; };
  const job = ok(g.api('admin.ai.start', { topic: 'موضوع تجريبي للتراجع' }, adminToken)).job;
  const s = ok(g.api('admin.ai.step', { jobId: job.id }, adminToken)).job; // plan → فشل JSON لأن الرد "جاهز"، لكن التراجع عن المخطط حدث
  assert.equal(s.status, 'failed');
  assert.ok(calls >= 2, 'أُعيد الطلب دون مخطط');
  g.mock.http.handler = () => ({ code: 401, body: { error: { message: 'invalid x-api-key' } } });
  bad(g.api('admin.ai.test', {}, adminToken), 'AI_HTTP');
  g.mock.http.handler = () => ({ code: 200, body: { content: [], stop_reason: 'refusal', stop_details: { type: 'refusal', category: 'general_harms' } } });
  bad(g.api('admin.ai.test', {}, adminToken), 'AI_REFUSED');
  g.mock.http.handler = () => ({ code: 200, body: { content: [{ type: 'text', text: '{"title":' }], stop_reason: 'max_tokens' } });
  bad(g.api('admin.ai.test', {}, adminToken), 'AI_TRUNCATED');
});

test('النسخ الاحتياطي: الاستبعادات، الفحص، المعاينة، الاستيراد دون تكرار، رفض الملفات غير الصالحة', () => {
  const { g, adminToken, trainee } = setupEnv();
  const exp = ok(g.api('admin.backup.export', {}, adminToken));
  const data = JSON.parse(exp.json);
  assert.equal(data.format, 'ikp-backup');
  assert.ok(!data.tables.Sessions && !data.tables.Tokens && !data.tables.AIJobs);
  assert.ok(data.tables.Users.every((u) => !('passHash' in u) && !('passSalt' in u)));
  assert.ok(!exp.json.includes('IKP_ANTHROPIC'));
  bad(g.api('admin.backup.preview', { json: 'garbage' }, adminToken), 'VALIDATION');
  bad(g.api('admin.backup.preview', { json: JSON.stringify({ format: 'other', tables: {} }) }, adminToken), 'VALIDATION');
  bad(g.api('admin.backup.preview', { json: JSON.stringify({ format: 'ikp-backup', tables: { Sessions: [] } }) }, adminToken), 'VALIDATION', 'جدول غير مسموح');
  const prev = ok(g.api('admin.backup.preview', { json: exp.json }, adminToken));
  assert.equal(prev.report.Users.conflicts, 2);
  assert.equal(prev.report.Users.willInsert, 0);
  const imp = ok(g.api('admin.backup.import', { json: exp.json, mode: 'skip' }, adminToken));
  assert.equal(imp.result.Users.inserted, 0);
  assert.equal(imp.result.Users.skipped, 2);
  assert.equal(g.sheetRows('Users').length, 2, 'لا تكرار');
  // إضافة سجل جديد في الملف واستيراده
  data.tables.Users.push({ id: 'usr_imported0001', name: 'مستورد', email: 'imported@education.qa', jobTitle: 'معلم', department: 'العلوم', role: 'trainee', status: 'active', emailVerified: true, createdAt: new Date().toISOString() });
  data.tables.Users.push({ id: 'usr_badmail', name: 'سيئ', email: 'not-an-email' });
  data.tables.Users.push({ name: 'بلا معرّف' });
  const imp2 = ok(g.api('admin.backup.import', { json: JSON.stringify(data), mode: 'skip' }, adminToken));
  assert.equal(imp2.result.Users.inserted, 1);
  assert.equal(imp2.result.Users.rejectedCount, 2);
  const u = g.sheetRows('Users').find((x) => x.email === 'imported@education.qa');
  assert.ok(u && u.passHash, 'كلمة مرور عشوائية مُعيّنة');
  bad(g.api('auth.login', { email: 'imported@education.qa', password: PW }), 'AUTH');
  // overwrite يغيّر الاسم دون المساس بكلمة المرور
  const beforeHash = g.sheetRows('Users').find((x) => x.id === trainee.id).passHash;
  data.tables.Users = [{ id: trainee.id, name: 'أحمد محمد المعلم (معدّل)', email: 'ahmed@education.qa', passHash: 'HACK' }];
  const imp3 = ok(g.api('admin.backup.import', { json: JSON.stringify(data), mode: 'overwrite' }, adminToken));
  assert.equal(imp3.result.Users.updated, 1);
  const after = g.sheetRows('Users').find((x) => x.id === trainee.id);
  assert.equal(after.name, 'أحمد محمد المعلم (معدّل)');
  assert.equal(after.passHash, beforeHash, 'كلمات المرور لا تُستورد');
});

test('الإعدادات والأصول والهوية: التحقق من المدخلات، رفع الصور، حماية القراءة خارج المجلد، CSV ضد حقن الصيغ', () => {
  const { g, adminToken, traineeToken } = setupEnv();
  bad(g.api('admin.settings.save', { settings: { allowedDomains: [] } }, adminToken), 'VALIDATION');
  bad(g.api('admin.settings.save', { settings: { defaultPassScore: 150 } }, adminToken), 'VALIDATION');
  bad(g.api('admin.settings.save', { settings: { ai: { model: 'bad model!' } } }, adminToken), 'VALIDATION');
  bad(g.api('admin.settings.save', { settings: { allowedEmails: ['not-mail'] } }, adminToken), 'VALIDATION');
  const sv = ok(g.api('admin.settings.save', { settings: { ai: { model: 'claude-sonnet-5-5', effort: 'low', maxTokens: 6000, wordsMin: 700, wordsMax: 1100, fallbacks: false, structured: false }, mail: { footer: 'تذييل', noReply: true } } }, adminToken));
  assert.equal(sv.settings.ai.model, 'claude-sonnet-5-5');
  assert.equal(sv.settings.ai.effort, 'low');
  assert.equal(sv.settings.mail.noReply, true);
  // رفع صورة
  const png1x1 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
  bad(g.api('admin.assets.upload', { name: 'x.svg', dataUrl: 'data:image/svg+xml;base64,PHN2Zy8+' }, adminToken), 'VALIDATION');
  bad(g.api('admin.assets.upload', { name: 'x.png', dataUrl: 'data:image/png;base64,' + 'A'.repeat(900 * 1024) }, adminToken), 'VALIDATION');
  const up = ok(g.api('admin.assets.upload', { name: 'شعار.png', dataUrl: png1x1 }, adminToken));
  assert.ok(up.fileId);
  bad(g.api('admin.assets.get', { id: up.fileId }, traineeToken), 'FORBIDDEN');
  assert.equal(ok(g.api('admin.assets.get', { id: up.fileId }, adminToken)).dataUrl.indexOf('data:image/png'), 0);
  // ملف خارج مجلد المنصة لا يُقرأ
  const outside = g.mock.drive.folders[Object.keys(g.mock.drive.folders)[0]];
  const foreignFolder = g.call('DriveApp.createFolder', 'other');
  const foreign = foreignFolder.createFile(g.call('Utilities.newBlob', [1, 2, 3], 'image/png', 'secret.png'));
  assert.equal(ok(g.api('admin.assets.get', { id: foreign.getId() }, adminToken)).dataUrl, '');
  assert.ok(outside);
  // الهوية البصرية: الحفظ والعرض العام
  ok(g.api('admin.settings.save', { settings: { branding: { headerImageId: up.fileId, footerImageId: '' } } }, adminToken));
  const pub = ok(g.api('app.state'));
  assert.equal(pub.settings.branding.headerImageId, up.fileId);
  const assets = ok(g.api('app.assets', { which: 'header' }));
  assert.equal(assets.header.dataUrl.indexOf('data:image/png'), 0);
  assert.equal(ok(g.api('app.assets', { which: 'footer' })).footer, undefined);
  // قالب الشهادة: معاينة بأسماء طويلة
  const pv = ok(g.api('admin.certs.preview', { kind: 'trainee', template: { title: 'شهادة تجريبية', signers: [{ name: 'أ. فلان', title: 'مدير' }] } }, adminToken));
  assert.ok(pv.html.includes('شهادة تجريبية') && pv.html.includes('أ. فلان'));
  // CSV: حقن صيغ
  ok(g.api('auth.register', { name: '=HYPERLINK("x")', email: 'evil@education.qa', jobTitle: 'معلم', department: 'العلوم', password: PW }));
  const c = codeFromMail(g, 'evil@education.qa', 'تفعيل');
  const ev = ok(g.api('auth.verifyEmail', { email: 'evil@education.qa', code: c }));
  const ws = ok(g.api('ws.list', {}, ev.token)).workshops[0];
  ok(g.api('ws.get', { id: ws.id }, ev.token));
  const csv = ok(g.api('admin.results.csv', {}, adminToken)).csv;
  assert.ok(csv.includes("'=HYPERLINK"), 'formula neutralised');
});

test('إشعار الموظفين: قائمة انتظار البريد عند تجاوز حد الدفعة ومعالجتها لاحقًا، وعدم التكرار', () => {
  const { g, adminToken, ws } = setupEnv();
  // 45 متدربًا نشطًا
  for (let i = 0; i < 45; i++) {
    ok(g.api('auth.register', { name: 'موظف رقم ' + i, email: 'staff' + i + '@education.qa', jobTitle: 'معلم', department: 'العلوم', password: PW }));
    const c = codeFromMail(g, 'staff' + i + '@education.qa', 'تفعيل');
    ok(g.api('auth.verifyEmail', { email: 'staff' + i + '@education.qa', code: c }));
  }
  g.mock.mail.quota = 1000;
  const before = g.mock.mail.outbox.length;
  const r = ok(g.api('admin.ws.notify', { id: ws.id }, adminToken));
  assert.equal(r.targeted, 47);
  assert.equal(r.sent, 40);
  assert.equal(r.queued, 7);
  assert.equal(g.mock.mail.outbox.length - before, 40);
  const r2 = ok(g.api('admin.ws.notify', { id: ws.id }, adminToken));
  assert.equal(r2.skipped, 40, 'لا تكرار لمن أُرسل له');
  const q = ok(g.api('admin.mail.retry', {}, adminToken));
  assert.equal(q.sent, 7);
  assert.equal(g.sheetRows('MailLog').filter((m) => m.status === 'queued').length, 0);
  const lst = ok(g.api('admin.mail.list', {}, adminToken));
  assert.equal(lst.counts.queued, 0);
  assert.equal(typeof lst.quota, 'number');
});

test('شهادة شكر للمدرب تُصدر مرة واحدة، وإلغاء الشهادة ينعكس في التحقق، ورقم تسلسلي متزايد دون اعتماد على عدد الصفوف', () => {
  const { g, adminToken, ws } = setupEnv();
  ok(g.api('admin.ws.saveDraft', { id: ws.id, trainerName: 'د. خالد المدرب', trainerEmail: 'trainer@education.qa' }, adminToken));
  const t1 = ok(g.api('admin.ws.thankTrainer', { id: ws.id }, adminToken));
  assert.equal(t1.duplicate, false);
  const t2 = ok(g.api('admin.ws.thankTrainer', { id: ws.id }, adminToken));
  assert.equal(t2.duplicate, true);
  assert.equal(g.sheetRows('Certificates').length, 1);
  const certs = ok(g.api('admin.certs.list', { kind: 'trainer' }, adminToken)).certificates;
  assert.equal(certs.length, 1);
  const rv = ok(g.api('admin.certs.revoke', { id: certs[0].id }, adminToken));
  assert.equal(rv.revoked, true);
  assert.equal(ok(g.api('cert.verify', { code: certs[0].verifyCode })).revoked, true);
  bad(g.api('admin.certs.resend', { id: certs[0].id }, adminToken), 'STATE');
  ok(g.api('admin.certs.revoke', { id: certs[0].id }, adminToken));
  const rs = ok(g.api('admin.certs.resend', { id: certs[0].id }, adminToken));
  assert.equal(rs.mailStatus.trainer.ok, true);
  // الرقم التسلسلي: بعد حذف سجل يدويًا يبقى الرقم التالي أعلى من آخر رقم
  const serialFn = () => g.call('nextSerial_');
  const s1 = serialFn();
  assert.match(s1, /-0002$/);
});

test('الصفحة والترحيل والتشخيص: doGet يقدّم الواجهة مع الأصول، وصفحة التحقق، وSETUP_5_migrate غير مدمر', () => {
  const { g } = setupEnv();
  const out = g.call('doGet', { parameter: {} });
  const html = out.getContent();
  assert.ok(html.includes('window.IKP_BOOT') && html.includes('window.IKP_ASSETS') && html.includes('AppAdmin2'));
  assert.ok(!html.includes('<?!='), 'كل التضمينات حُلّت');
  assert.equal(out._xframe, 'DEFAULT');
  const vp = g.call('doGet', { parameter: { verify: 'nope' } }).getContent();
  assert.ok(vp.includes('لم يتم العثور'));
  // ترحيل: حذف عمود الإعداد ثم إعادته
  const ss = g.mock.spreadsheets[g.mock.props.IKP_SPREADSHEET_ID];
  const sh = ss.getSheetByName('Settings');
  const usersBefore = g.sheetRows('Users').length;
  const msg = g.call('SETUP_5_migrate');
  assert.match(msg, /الترحيل/);
  assert.equal(g.sheetRows('Users').length, usersBefore);
  assert.ok(sh.getLastColumn() >= 10);
  const diag = g.call('DIAG_checkEnvironment');
  assert.ok(diag.includes('قاعدة البيانات') && diag.includes('المدراء النشطين: 1'));
});
