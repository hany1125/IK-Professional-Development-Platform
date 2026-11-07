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
