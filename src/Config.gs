/**
 * ============================================================
 *  منصة ابن خلدون للتدريب والتطوير المهني
 *  مدرسة ابن خلدون الإعدادية للبنين — دولة قطر
 * ------------------------------------------------------------
 *  Config.gs — الثوابت والإعدادات العامة
 * ============================================================
 *
 * ملاحظة أمنية: لا توجد أي كلمات مرور أو مفاتيح خدمات داخل الكود.
 * جميع الأسرار تُحفظ في Script Properties (إعدادات الخادم) فقط.
 */

var APP = {
  NAME: 'منصة ابن خلدون للتدريب والتطوير المهني',
  SCHOOL: 'مدرسة ابن خلدون الإعدادية للبنين',
  SCHOOL_EN: 'Ibn Khaldoon Preparatory School for Boys',
  MINISTRY: 'وزارة التربية والتعليم والتعليم العالي — دولة قطر',
  VISION: 'متعلم ريادي لتنمية مستدامة',
  VERSION: '3.0.0',
  SCHEMA_VERSION: 3,
  TIMEZONE: 'Asia/Qatar'
};

/** أسماء الجداول (أوراق Google Sheets) */
var SHEETS = {
  USERS: 'Users',
  TOKENS: 'Tokens',
  SESSIONS: 'Sessions',
  WORKSHOPS: 'Workshops',
  VERSIONS: 'WorkshopVersions',
  PROGRESS: 'Progress',
  ATTEMPTS: 'Attempts',
  RESULTS: 'Results',
  CERTIFICATES: 'Certificates',
  MAIL: 'MailLog',
  SETTINGS: 'Settings',
  AUDIT: 'AuditLog',
  AIJOBS: 'AIJobs'
};

/**
 * أعمدة كل جدول — الترتيب ثابت ويجب عدم تغييره بعد النشر.
 * الترحيل غير المدمر: تُضاف الأعمدة الجديدة في نهاية الجدول فقط (انظر headersOf_ ودليل الترحيل).
 * هذه البنية متوافقة مع قاعدة بيانات الإصدار 2.x دون تعديل.
 */
var SCHEMA = {
  Users: ['id', 'name', 'email', 'jobTitle', 'department', 'role', 'status', 'emailVerified',
    'passHash', 'passSalt', 'passIter', 'createdAt', 'updatedAt', 'lastLoginAt', 'notes'],
  Tokens: ['id', 'userId', 'type', 'tokenHash', 'expiresAt', 'attempts', 'usedAt', 'createdAt', 'meta'],
  Sessions: ['id', 'tokenHash', 'userId', 'createdAt', 'expiresAt', 'lastSeenAt', 'revokedAt', 'agent'],
  Workshops: ['id', 'title', 'description', 'audience', 'category', 'targetDepartments', 'passScore',
    'status', 'currentVersion', 'trainerName', 'trainerEmail', 'scheduledAt', 'durationMin', 'location',
    'createdBy', 'createdAt', 'updatedAt', 'publishedAt', 'notifiedAt', 'trainerThankedAt', 'moduleCount', 'source'],
  WorkshopVersions: ['id', 'workshopId', 'version', 'createdAt', 'createdBy', 'checksum', 'c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8', 'c9', 'c10'],
  Progress: ['id', 'userId', 'workshopId', 'versionId', 'modulesDone', 'acknowledged', 'lastModule',
    'percent', 'startedAt', 'completedAt', 'updatedAt'],
  Attempts: ['id', 'userId', 'workshopId', 'versionId', 'kind', 'moduleIndex', 'requestKey', 'score', 'total',
    'percent', 'passed', 'answers', 'startedAt', 'submittedAt', 'status'],
  Results: ['id', 'userId', 'workshopId', 'versionId', 'bestPercent', 'lastPercent', 'attemptCount', 'passed',
    'passedAt', 'certificateId', 'updatedAt'],
  Certificates: ['id', 'serial', 'verifyHash', 'userId', 'workshopId', 'resultId', 'kind', 'issuedAt', 'pdfFileId',
    'mailStatus', 'revokedAt', 's1', 's2', 's3', 's4'],
  MailLog: ['id', 'kind', 'refKey', 'to', 'subject', 'status', 'attempts', 'lastError', 'createdAt', 'sentAt', 'payloadRef'],
  Settings: ['key', 'updatedAt', 'c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8'],
  AuditLog: ['id', 'at', 'actorId', 'actorEmail', 'action', 'target', 'details'],
  AIJobs: ['id', 'workshopId', 'status', 'stage', 'stageIndex', 'error', 'createdBy', 'createdAt', 'updatedAt',
    'c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8', 'c9', 'c10']
};

/** الحد الأقصى لعدد الأحرف في الخلية الواحدة في Google Sheets هو 50,000 — نستخدم هامش أمان */
var CELL_CHUNK = 45000;

/** القيم الافتراضية للإعدادات القابلة للتعديل من لوحة الإدارة */
var DEFAULT_SETTINGS = {
  allowedDomains: ['education.qa', 'edu.gov.qa'],
  allowedEmails: [],              // عناوين مستثناة من قيد النطاق
  blockedEmails: [],
  adminNotifyEmail: '',           // البريد الإداري الذي تصله نسخ الشهادات
  senderName: 'منصة ابن خلدون للتدريب والتطوير المهني',
  defaultPassScore: 80,
  moduleQuestions: 5,
  finalQuestions: 10,
  retryPolicy: 'unlimited',       // unlimited | limited
  maxAttempts: 3,                 // عند retryPolicy = limited
  retryCooldownMin: 0,
  showCorrectAnswers: 'afterPass',// never | afterPass | always
  shuffleQuestions: true,
  shuffleOptions: true,
  sessionHours: 72,
  departments: ['اللغة العربية', 'اللغة الإنجليزية', 'الرياضيات', 'العلوم', 'التربية الإسلامية', 'الدراسات الاجتماعية',
    'الحاسوب', 'التربية البدنية', 'الفنون البصرية', 'الإدارة المدرسية', 'الإرشاد الأكاديمي', 'دعم التعلم', 'أخرى'],
  jobTitles: ['معلم', 'معلم أول', 'منسق مادة', 'أخصائي', 'مرشد أكاديمي', 'إداري', 'نائب مدير', 'مدير'],
  certificate: {
    title: 'شهادة إتمام برنامج تدريبي',
    intro: 'تشهد مدرسة ابن خلدون الإعدادية للبنين بأن',
    body: 'قد أتمّ بنجاح متطلبات الورشة التدريبية',
    outro: 'ضمن برنامج التطوير المهني للكادر المدرسي، متمنين له دوام التوفيق والنجاح.',
    trainerTitle: 'شهادة شكر وتقدير',
    trainerBody: 'تتقدم إدارة مدرسة ابن خلدون الإعدادية للبنين بخالص الشكر والتقدير إلى',
    trainerOutro: 'لتقديمه الورشة التدريبية ولما بذله من جهد في إثراء برنامج التطوير المهني بالمدرسة.',
    showScore: true,
    signers: [
      { name: '', title: 'مسؤول التطوير المهني', imageId: '' },
      { name: '', title: 'مدير المدرسة', imageId: '' }
    ],
    stampImageId: '',
    headerImageId: '',
    footerImageId: '',
    accent: '#7b1a2e'
  },
  /** الهوية البصرية للمنصة (ترويسة/تذييل الموقع) — فارغ = الصور الافتراضية المضمّنة */
  branding: { headerImageId: '', footerImageId: '' },
  ai: {
    model: 'claude-opus-5-5',
    effort: 'medium',             // low | medium | high — عمق التفكير وحجم الاستهلاك
    maxTokens: 8000,
    wordsMin: 800,
    wordsMax: 1200,
    fallbacks: true,              // استخدام البديل الخادمي عند رفض السياسة (fallbacks: "default")
    structured: true              // طلب JSON وفق مخطط (output_config.format) مع تراجع تلقائي عند عدم الدعم
  },
  mail: {
    footer: 'هذه رسالة آلية من منصة ابن خلدون للتدريب والتطوير المهني — يُرجى عدم الرد عليها.',
    noReply: false                // متاح لحسابات Google Workspace فقط
  }
};

/** مفاتيح إعدادات الخادم (Script Properties) — أسرار لا تُعاد للمتصفح إطلاقًا */
var PROPS = {
  SPREADSHEET_ID: 'IKP_SPREADSHEET_ID',
  DRIVE_FOLDER_ID: 'IKP_DRIVE_FOLDER_ID',
  ANTHROPIC_KEY: 'IKP_ANTHROPIC_API_KEY',
  ANTHROPIC_KEY_AT: 'IKP_ANTHROPIC_API_KEY_AT',
  SETUP_TOKEN_HASH: 'IKP_SETUP_TOKEN_HASH',
  SETUP_TOKEN_EXP: 'IKP_SETUP_TOKEN_EXP',
  PEPPER: 'IKP_PASSWORD_PEPPER',
  WEBAPP_URL: 'IKP_WEBAPP_URL',
  SCHEMA_VERSION: 'IKP_SCHEMA_VERSION'
};

/** حدود التشغيل */
var LIMITS = {
  PBKDF2_ITERATIONS: 4000,      // PBKDF2-HMAC-SHA256 (قابل للزيادة؛ يؤثر على زمن الدخول في Apps Script)
  LOGIN_MAX_PER_15MIN: 8,
  RESET_MAX_PER_HOUR: 4,
  VERIFY_CODE_MINUTES: 20,
  RESET_CODE_MINUTES: 15,
  CODE_MAX_ATTEMPTS: 5,
  AI_MAX_JOBS_PER_HOUR: 6,
  AI_STEP_LEASE_SEC: 300,       // منع تنفيذ المرحلة نفسها مرتين بالتوازي
  MAIL_MAX_PER_RUN: 40,         // رسائل لكل تنفيذ واحد (الباقي يُوضع في قائمة انتظار)
  MAX_UPLOAD_BYTES: 600 * 1024,
  MAX_JSON_IMPORT_BYTES: 4 * 1024 * 1024,
  LOCK_WAIT_MS: 20000,
  /** السماح بتضمين تطبيق الويب داخل مواقع أخرى (iframe). false = حماية من Clickjacking */
  ALLOW_EMBED: false
};

var ROLES = { ADMIN: 'admin', TRAINEE: 'trainee' };
var USER_STATUS = { PENDING: 'pending', ACTIVE: 'active', SUSPENDED: 'suspended' };
var WS_STATUS = { DRAFT: 'draft', PUBLISHED: 'published', UNPUBLISHED: 'unpublished', ARCHIVED: 'archived' };
var MAIL_STATUS = { SENT: 'sent', FAILED: 'failed', QUEUED: 'queued', EXPIRED: 'expired' };

/** خطأ تطبيقي يحمل رسالة عربية آمنة للمستخدم ورمزًا للواجهة */
function AppError(code, message, extra) {
  this.name = 'AppError';
  this.code = code || 'ERROR';
  this.message = message || 'حدث خطأ غير متوقع.';
  this.extra = extra || null;
}
AppError.prototype = Object.create(Error.prototype);

function fail(code, message, extra) { throw new AppError(code, message, extra); }
