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
