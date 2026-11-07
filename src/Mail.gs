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
