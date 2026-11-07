/**
 * Auth.gs — الحسابات والمصادقة والجلسات
 * ------------------------------------------------------------
 * - كلمات المرور: PBKDF2-HMAC-SHA256 (RFC 8018) مع ملح عشوائي لكل مستخدم + "فلفل" خادمي (Script Properties).
 *   يُعاد تجزئة كلمة المرور تلقائيًا عند الدخول إذا تغيّر عدد التكرارات المعتمد.
 * - الجلسات: رمز عشوائي يُخزن مجزّأً (SHA-256)؛ قابلة للإبطال، وتُبطل عند الإيقاف أو إعادة تعيين كلمة المرور.
 * - رموز التحقق/الاستعادة: مجزّأة، محدودة الصلاحية والمحاولات، تُستخدم مرة واحدة.
 */

/* ---------- تجزئة كلمات المرور ---------- */
function pepper_() {
  var p = PropertiesService.getScriptProperties().getProperty(PROPS.PEPPER);
  if (!p) {
    p = randomToken_(32);
    PropertiesService.getScriptProperties().setProperty(PROPS.PEPPER, p);
  }
  return p;
}

/** PBKDF2-HMAC-SHA256 — كتلة واحدة (32 بايت) تكفي لكلمة المرور */
function pbkdf2_(password, saltHex, iterations) {
  var pw = Utilities.newBlob(password + pepper_()).getBytes();
  var saltBytes = hexToBytes_(saltHex);
  var block = saltBytes.concat([0, 0, 0, 1]);
  var u = Utilities.computeHmacSha256Signature(block, pw);
  var t = u.slice();
  for (var i = 1; i < iterations; i++) {
    u = Utilities.computeHmacSha256Signature(u, pw);
    for (var j = 0; j < t.length; j++) t[j] = t[j] ^ u[j];
  }
  return bytesToHex_(t);
}
function hexToBytes_(hex) {
  var out = [];
  for (var i = 0; i < hex.length; i += 2) {
    var b = parseInt(hex.substr(i, 2), 16);
    out.push(b > 127 ? b - 256 : b);
  }
  return out;
}
function hashPassword_(password) {
  var salt = randomToken_(16).substr(0, 32);
  var iter = LIMITS.PBKDF2_ITERATIONS;
  return { hash: pbkdf2_(password, salt, iter), salt: salt, iter: iter };
}
function verifyPassword_(password, user) {
  if (!user.passHash || !user.passSalt) return false;
  var h = pbkdf2_(password, String(user.passSalt), parseInt(user.passIter, 10) || LIMITS.PBKDF2_ITERATIONS);
  return constantEq_(h, String(user.passHash));
}
function constantEq_(a, b) {
  a = String(a); b = String(b);
  if (a.length !== b.length) return false;
  var r = 0;
  for (var i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
/** ترقية التجزئة عند الدخول إذا كانت بتكرارات أقل من المعتمد حاليًا */
function maybeRehash_(user, password) {
  if ((parseInt(user.passIter, 10) || 0) >= LIMITS.PBKDF2_ITERATIONS) return;
  try { var h = hashPassword_(password); updateRowAt_(SHEETS.USERS, user, { passHash: h.hash, passSalt: h.salt, passIter: h.iter }); } catch (e) { }
}

/* ---------- التحقق من المدخلات ---------- */
function normEmail_(e) { return String(e || '').trim().toLowerCase(); }
function isEmail_(e) { return /^[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$/i.test(String(e || '')); }
function cleanText_(s, max) {
  return String(s === undefined || s === null ? '' : s).replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().substr(0, max || 200);
}
function validatePassword_(p) {
  p = String(p || '');
  if (p.length < 8) fail('WEAK_PASSWORD', 'كلمة المرور يجب ألا تقل عن 8 أحرف.');
  if (!/[A-Za-z؀-ۿ]/.test(p) || !/[0-9]/.test(p)) fail('WEAK_PASSWORD', 'كلمة المرور يجب أن تحتوي على حروف وأرقام.');
  if (p.length > 128) fail('WEAK_PASSWORD', 'كلمة المرور طويلة جدًا.');
}
function emailAllowed_(email) {
  var s = getSettings_();
  if ((s.blockedEmails || []).map(normEmail_).indexOf(email) !== -1) return false;
  if ((s.allowedEmails || []).map(normEmail_).indexOf(email) !== -1) return true;
  var domain = email.split('@')[1] || '';
  return (s.allowedDomains || []).map(function (d) { return String(d).toLowerCase().replace(/^@/, ''); })
    .some(function (d) { return domain === d || domain.slice(-(d.length + 1)) === '.' + d; });
}

function publicUser_(u) {
  return {
    id: u.id, name: u.name, email: u.email, jobTitle: u.jobTitle, department: u.department,
    role: u.role, status: u.status, emailVerified: truthy_(u.emailVerified),
    createdAt: u.createdAt, lastLoginAt: u.lastLoginAt
  };
}

/* ---------- الرموز (تحقق / استعادة) ---------- */
function issueCode_(userId, type, minutes) {
  // إبطال الرموز السابقة من نفس النوع
  readTable_(SHEETS.TOKENS).filter(function (t) { return t.userId === userId && t.type === type && !t.usedAt; })
    .forEach(function (t) { updateRowAt_(SHEETS.TOKENS, t, { usedAt: nowIso_() }); });
  var code = numericCode_(6);
  insertRow_(SHEETS.TOKENS, {
    id: newId_('tok'), userId: userId, type: type, tokenHash: sha256Hex_(type + ':' + userId + ':' + code),
    expiresAt: new Date(Date.now() + minutes * 60000).toISOString(), attempts: 0, usedAt: '', createdAt: nowIso_(), meta: ''
  });
  return code;
}
function consumeCode_(userId, type, code) {
  var tok = findOne_(SHEETS.TOKENS, function (t) { return t.userId === userId && t.type === type && !t.usedAt; });
  if (!tok) fail('CODE_INVALID', 'الرمز غير صالح أو منتهي الصلاحية.');
  if (new Date(tok.expiresAt).getTime() < Date.now()) { updateRowAt_(SHEETS.TOKENS, tok, { usedAt: nowIso_() }); fail('CODE_EXPIRED', 'انتهت صلاحية الرمز. اطلب رمزًا جديدًا.'); }
  var attempts = (parseInt(tok.attempts, 10) || 0) + 1;
  if (attempts > LIMITS.CODE_MAX_ATTEMPTS) { updateRowAt_(SHEETS.TOKENS, tok, { usedAt: nowIso_(), attempts: attempts }); fail('CODE_LOCKED', 'تم تجاوز عدد المحاولات. اطلب رمزًا جديدًا.'); }
  var ok = constantEq_(sha256Hex_(type + ':' + userId + ':' + String(code || '').trim()), String(tok.tokenHash));
  if (!ok) {
    updateRowAt_(SHEETS.TOKENS, tok, { attempts: attempts });
    var left = LIMITS.CODE_MAX_ATTEMPTS - attempts;
    fail('CODE_INVALID', left > 0 ? 'الرمز غير صحيح. المحاولات المتبقية: ' + left : 'الرمز غير صحيح. اطلب رمزًا جديدًا.');
  }
  updateRowAt_(SHEETS.TOKENS, tok, { usedAt: nowIso_(), attempts: attempts });
  return true;
}

/* ---------- الجلسات ---------- */
function createSession_(user, agent) {
  var token = randomToken_(32);
  var hours = Number(getSettings_().sessionHours) || 72;
  var rec = {
    id: newId_('ses'), tokenHash: sha256Hex_(token), userId: user.id, createdAt: nowIso_(),
    expiresAt: new Date(Date.now() + hours * 3600000).toISOString(), lastSeenAt: nowIso_(), revokedAt: '', agent: cleanText_(agent, 120)
  };
  insertRow_(SHEETS.SESSIONS, rec);
  return token;
}
function revokeUserSessions_(userId) {
  readTable_(SHEETS.SESSIONS).filter(function (s) { return s.userId === userId && !s.revokedAt; })
    .forEach(function (s) { updateRowAt_(SHEETS.SESSIONS, s, { revokedAt: nowIso_() }); cacheDel_('ses:' + s.tokenHash); });
}
function revokeSessionByToken_(token) {
  var h = sha256Hex_(token);
  var s = findOne_(SHEETS.SESSIONS, function (r) { return r.tokenHash === h; });
  if (s) updateRowAt_(SHEETS.SESSIONS, s, { revokedAt: nowIso_() });
  cacheDel_('ses:' + h);
}
/** يُعيد المستخدم الحالي من رمز الجلسة، أو null. يُتحقق من حالة الحساب في كل طلب (الإيقاف يُبطل الجلسة فورًا) */
function userFromToken_(token) {
  if (!token || typeof token !== 'string' || token.length < 40) return null;
  var h = sha256Hex_(token);
  var cached = cacheGet_('ses:' + h);
  var s = cached ? parseJson_(cached, null) : null;
  if (!s) {
    s = findOne_(SHEETS.SESSIONS, function (r) { return r.tokenHash === h; });
    if (!s) return null;
    cachePut_('ses:' + h, JSON.stringify({ userId: s.userId, expiresAt: s.expiresAt, revokedAt: s.revokedAt }), 300);
  }
  if (s.revokedAt) return null;
  if (new Date(s.expiresAt).getTime() < Date.now()) return null;
  var user = findById_(SHEETS.USERS, s.userId);
  if (!user || user.status !== USER_STATUS.ACTIVE) { cacheDel_('ses:' + h); return null; }
  return user;
}

/* ---------- الإجراءات العامة (بدون جلسة) ---------- */
function authRegister_(p) {
  var name = cleanText_(p.name, 80), email = normEmail_(p.email), job = cleanText_(p.jobTitle, 60), dept = cleanText_(p.department, 60);
  if (name.length < 3) fail('VALIDATION', 'يُرجى إدخال الاسم الكامل.');
  if (!isEmail_(email)) fail('VALIDATION', 'البريد الإلكتروني غير صالح.');
  if (!emailAllowed_(email)) {
    var doms = (getSettings_().allowedDomains || []).map(function (d) { return '@' + d; }).join(' أو ');
    fail('DOMAIN', 'التسجيل متاح فقط للبريد الرسمي (' + doms + '). إن كان بريدك مستثنى فتواصل مع الإدارة.');
  }
  if (!job) fail('VALIDATION', 'يُرجى اختيار المسمى الوظيفي.');
  if (!dept) fail('VALIDATION', 'يُرجى اختيار القسم.');
  validatePassword_(p.password);
  rateLimit_('reg:' + email, 5, 3600);
  return withLock_(function () {
    var existing = findOne_(SHEETS.USERS, function (u) { return u.email === email; });
    var h = hashPassword_(p.password);
    var user;
    if (existing) {
      if (existing.status !== USER_STATUS.PENDING) fail('EXISTS', 'هذا البريد مسجل مسبقًا. يمكنك تسجيل الدخول أو استعادة كلمة المرور.');
      user = updateRowAt_(SHEETS.USERS, existing, { name: name, jobTitle: job, department: dept, passHash: h.hash, passSalt: h.salt, passIter: h.iter, updatedAt: nowIso_() });
    } else {
      user = insertRow_(SHEETS.USERS, {
        id: newId_('usr'), name: name, email: email, jobTitle: job, department: dept, role: ROLES.TRAINEE,
        status: USER_STATUS.PENDING, emailVerified: 'FALSE', passHash: h.hash, passSalt: h.salt, passIter: h.iter,
        createdAt: nowIso_(), updatedAt: nowIso_(), lastLoginAt: '', notes: ''
      });
    }
    var code = issueCode_(user.id, 'verify', LIMITS.VERIFY_CODE_MINUTES);
    var mail = sendVerificationMail_(user, code);
    audit_(null, 'register', user.id, { email: email });
    return { pending: true, email: email, mailSent: mail.ok, mailError: mail.ok ? '' : 'تعذر إرسال رسالة التحقق حاليًا. يمكنك طلب إعادة الإرسال.' };
  });
}

function authResendVerify_(p) {
  var email = normEmail_(p.email);
  rateLimit_('resend:' + email, 4, 3600);
  var user = findOne_(SHEETS.USERS, function (u) { return u.email === email; });
  // لا نكشف وجود الحساب
  if (user && user.status === USER_STATUS.PENDING) {
    var code = issueCode_(user.id, 'verify', LIMITS.VERIFY_CODE_MINUTES);
    sendVerificationMail_(user, code);
  }
  return { ok: true, message: 'إذا كان البريد مسجلًا وبانتظار التفعيل فسيصله رمز جديد.' };
}

function authVerifyEmail_(p) {
  var email = normEmail_(p.email);
  rateLimit_('verify:' + email, 12, 900);
  var user = findOne_(SHEETS.USERS, function (u) { return u.email === email; });
  if (!user) fail('CODE_INVALID', 'الرمز غير صالح أو منتهي الصلاحية.');
  if (user.status === USER_STATUS.ACTIVE && truthy_(user.emailVerified)) return { verified: true, already: true };
  if (user.status === USER_STATUS.SUSPENDED) fail('SUSPENDED', 'هذا الحساب موقوف. يُرجى التواصل مع مسؤول التطوير المهني.');
  consumeCode_(user.id, 'verify', p.code);
  updateRowAt_(SHEETS.USERS, user, { emailVerified: 'TRUE', status: USER_STATUS.ACTIVE, updatedAt: nowIso_(), lastLoginAt: nowIso_() });
  audit_(null, 'verify_email', user.id, {});
  var token = createSession_(user, p.agent);
  return { verified: true, token: token, user: publicUser_(user) };
}

function authLogin_(p) {
  var email = normEmail_(p.email);
  if (!isEmail_(email)) fail('AUTH', 'البريد الإلكتروني أو كلمة المرور غير صحيحة.');
  rateLimit_('login:' + email, LIMITS.LOGIN_MAX_PER_15MIN, 900);
  var user = findOne_(SHEETS.USERS, function (u) { return u.email === email; });
  var password = String(p.password || '');
  if (!user || !verifyPassword_(password, user)) fail('AUTH', 'البريد الإلكتروني أو كلمة المرور غير صحيحة.');
  if (user.status === USER_STATUS.PENDING) {
    // حساب لم يُفعَّل بعد: نرسل رمزًا جديدًا (بحد أقصى 4 في الساعة) ونوجّه لصفحة التفعيل
    try { rateLimit_('resend:' + email, 4, 3600); var code = issueCode_(user.id, 'verify', LIMITS.VERIFY_CODE_MINUTES); sendVerificationMail_(user, code); } catch (e) { }
    return { pending: true, email: email };
  }
  if (user.status === USER_STATUS.SUSPENDED) fail('SUSPENDED', 'هذا الحساب موقوف. يُرجى التواصل مع مسؤول التطوير المهني.');
  maybeRehash_(user, password);
  var token = createSession_(user, p.agent);
  updateRowAt_(SHEETS.USERS, user, { lastLoginAt: nowIso_() });
  audit_(user, 'login', user.id, {});
  return { token: token, user: publicUser_(user) };
}

function authForgot_(p) {
  var email = normEmail_(p.email);
  rateLimit_('forgot:' + email, LIMITS.RESET_MAX_PER_HOUR, 3600);
  var user = findOne_(SHEETS.USERS, function (u) { return u.email === email; });
  if (user && user.status !== USER_STATUS.SUSPENDED) {
    var code = issueCode_(user.id, 'reset', LIMITS.RESET_CODE_MINUTES);
    sendResetMail_(user, code);
  }
  return { ok: true, message: 'إذا كان البريد مسجلًا لدينا فسيصلك رمز استعادة خلال دقائق.' };
}

function authReset_(p) {
  var email = normEmail_(p.email);
  rateLimit_('reset:' + email, 10, 900);
  validatePassword_(p.password);
  var user = findOne_(SHEETS.USERS, function (u) { return u.email === email; });
  if (!user) fail('CODE_INVALID', 'الرمز غير صالح أو منتهي الصلاحية.');
  consumeCode_(user.id, 'reset', p.code);
  var h = hashPassword_(p.password);
  var patch = { passHash: h.hash, passSalt: h.salt, passIter: h.iter, updatedAt: nowIso_() };
  if (user.status === USER_STATUS.PENDING) { patch.status = USER_STATUS.ACTIVE; patch.emailVerified = 'TRUE'; }
  updateRowAt_(SHEETS.USERS, user, patch);
  revokeUserSessions_(user.id);
  audit_(user, 'password_reset', user.id, {});
  return { ok: true };
}

/* ---------- إجراءات المستخدم المسجّل ---------- */
function authMe_(user) {
  return { user: publicUser_(user), settings: publicSettings_() };
}
function authLogout_(user, token) { revokeSessionByToken_(token); audit_(user, 'logout', user.id, {}); return { ok: true }; }

function authUpdateProfile_(user, p) {
  var patch = { updatedAt: nowIso_() };
  if (p.name !== undefined) { var n = cleanText_(p.name, 80); if (n.length < 3) fail('VALIDATION', 'الاسم قصير جدًا.'); patch.name = n; }
  if (p.jobTitle !== undefined) patch.jobTitle = cleanText_(p.jobTitle, 60);
  if (p.department !== undefined) patch.department = cleanText_(p.department, 60);
  updateRowAt_(SHEETS.USERS, user, patch);
  audit_(user, 'profile_update', user.id, patch);
  return { user: publicUser_(user) };
}

function authChangePassword_(user, p, token) {
  if (!verifyPassword_(String(p.current || ''), user)) fail('AUTH', 'كلمة المرور الحالية غير صحيحة.');
  validatePassword_(p.password);
  var h = hashPassword_(p.password);
  updateRowAt_(SHEETS.USERS, user, { passHash: h.hash, passSalt: h.salt, passIter: h.iter, updatedAt: nowIso_() });
  revokeUserSessions_(user.id);
  var newToken = createSession_(user, p.agent);
  audit_(user, 'password_change', user.id, {});
  return { token: newToken };
}

/** الإعدادات التي يجوز إرسالها للمتصفح (بدون أسرار) */
function publicSettings_() {
  var s = getSettings_();
  return {
    departments: s.departments, jobTitles: s.jobTitles, allowedDomains: s.allowedDomains,
    defaultPassScore: s.defaultPassScore, retryPolicy: s.retryPolicy, maxAttempts: s.maxAttempts,
    showCorrectAnswers: s.showCorrectAnswers, app: APP, certificateAccent: s.certificate.accent,
    branding: { headerImageId: s.branding.headerImageId || '', footerImageId: s.branding.footerImageId || '' }
  };
}
