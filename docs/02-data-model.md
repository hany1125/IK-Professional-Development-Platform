# بنية البيانات (Google Sheets) — الإصدار 3.0

جدول بيانات واحد باسم «IKP - قاعدة بيانات منصة ابن خلدون للتدريب» يضم 13 ورقة. الصف الأول عناوين الأعمدة (مجمّد). **الترتيب ثابت**؛ أي عمود جديد في الإصدارات القادمة يُضاف في النهاية فقط، وتضيفه الدالة `headersOf_` تلقائيًا (ترحيل غير مدمر). القيم الزمنية بصيغة ISO 8601 (UTC). القيم المنطقية `TRUE/FALSE`. القوائم والكائنات تُخزَّن JSON داخل الخلية، والمحتوى الطويل يُوزَّع على خلايا `c1..cN` (كل خلية حتى 45,000 حرف احترامًا لحد Sheets البالغ 50,000).

| الورقة | الأعمدة | ملاحظات |
|---|---|---|
| **Users** | id, name, email, jobTitle, department, role, status, emailVerified, passHash, passSalt, passIter, createdAt, updatedAt, lastLoginAt, notes | `role`: admin \| trainee (صلاحية تقنية مستقلة عن المسمى الوظيفي). `status`: pending \| active \| suspended. كلمة المرور PBKDF2-HMAC-SHA256 (ملح لكل مستخدم + pepper خادمي، 4000 تكرار افتراضيًا مع ترقية تلقائية عند الدخول). البريد يُخزَّن بأحرف صغيرة. |
| **Tokens** | id, userId, type, tokenHash, expiresAt, attempts, usedAt, createdAt, meta | رموز التفعيل (`verify`، 20 دقيقة) والاستعادة/الدعوة (`reset`، 15 دقيقة / 24 ساعة للدعوة). الرمز 6 أرقام يُخزَّن مجزّأً، 5 محاولات، يُستخدم مرة واحدة، وإصدار رمز جديد يُبطل السابق. |
| **Sessions** | id, tokenHash, userId, createdAt, expiresAt, lastSeenAt, revokedAt, agent | رمز الجلسة (96 حرفًا) يُخزَّن مجزّأً SHA-256. تُبطل عند الخروج، إعادة التعيين، تغيير كلمة المرور، الإيقاف، أو سحب الصلاحية. |
| **Workshops** | id, title, description, audience, category, targetDepartments(JSON), passScore, status, currentVersion, trainerName, trainerEmail, scheduledAt, durationMin, location, createdBy, createdAt, updatedAt, publishedAt, notifiedAt, trainerThankedAt, moduleCount, source | `status`: draft \| published \| unpublished \| archived. `source`: seed \| manual \| ai \| ai-manual. |
| **WorkshopVersions** | id, workshopId, version, createdAt, createdBy, checksum, c1..c10 | المحتوى الكامل (أهداف، وحدات بأقسامها ومواردها وأسئلتها، الاختبار النهائي) JSON موزعًا حتى 450 ألف حرف. أي تعديل على ورشة منشورة أو لها محاولات يُنشئ إصدارًا جديدًا. |
| **Progress** | id, userId, workshopId, versionId, modulesDone(JSON), acknowledged(JSON), lastModule, percent, startedAt, completedAt, updatedAt | سجل واحد لكل (متدرب، ورشة). `modulesDone` فهارس الوحدات التي اجتاز اختبارها؛ `acknowledged` إقرارات القراءة (لا تُعدّ إكمالًا). |
| **Attempts** | id, userId, workshopId, versionId, kind, moduleIndex, requestKey, score, total, percent, passed, answers(JSON), startedAt, submittedAt, status | `kind`: module \| final. `answers` = `{q:[ترتيب الأسئلة], o:[[ترتيب الخيارات]...], given:[الإجابات الأصلية]}`. `status`: open \| submitted. مرتبطة بإصدار محدد. |
| **Results** | id, userId, workshopId, versionId, bestPercent, lastPercent, attemptCount, passed, passedAt, certificateId, updatedAt | نتيجة الاختبار النهائي لكل (متدرب، ورشة): أفضل نتيجة وآخر نتيجة وعدد المحاولات. |
| **Certificates** | id, serial, verifyHash, userId, workshopId, resultId, kind, issuedAt, pdfFileId, mailStatus(JSON), revokedAt, s1..s4 | `kind`: trainee \| trainer. `serial` = `IKP-YYYY-NNNN`. `verifyHash` تجزئة رمز التحقق (24 حرفًا سداسيًا عشوائيًا). `s1..s4` نسخة البيانات والقالب وقت الإصدار (الاسم، العنوان، النسبة، النصوص، الموقّعون، معرّفات الصور) فلا تتأثر الشهادة بتغييرات لاحقة. `mailStatus` حالة مستقلة لكل مستلم `{trainee|admin|trainer: {status, error, at}}`. |
| **MailLog** | id, kind, refKey, to, subject, status, attempts, lastError, createdAt, sentAt, payloadRef | `status`: sent \| failed \| queued \| expired. `refKey` فريد يمنع التكرار (مثل `announce:<ws>:<user>` أو `cert_trainee:<cert>`). |
| **Settings** | key, updatedAt, c1..c8 | كل إعداد صف: allowedDomains, allowedEmails, blockedEmails, adminNotifyEmail, senderName, defaultPassScore, moduleQuestions, finalQuestions, retryPolicy, maxAttempts, retryCooldownMin, showCorrectAnswers, shuffleQuestions, shuffleOptions, sessionHours, departments, jobTitles, certificate, branding, ai, mail. القيم الناقصة تُدمج مع الافتراضيات. |
| **AuditLog** | id, at, actorId, actorEmail, action, target, details | سجل العمليات (دخول، تعديل، نشر، إصدار، محاولات وصول مرفوضة…). لا يحوي أسرارًا أو رموزًا. |
| **AIJobs** | id, workshopId, status, stage, stageIndex, error, createdBy, createdAt, updatedAt, c1..c10 | مهام التوليد: المدخلات والخطة والوحدات المولَّدة والاختبار النهائي وسجل المراحل والتحذيرات واستهلاك الرموز. `status`: running \| failed \| cancelled \| done. |

## بنية محتوى الورشة (JSON داخل WorkshopVersions)
```json
{
  "objectives": ["هدف عام 1", "..."],
  "modules": [
    {
      "title": "عنوان الوحدة", "summary": "ملخص",
      "objectives": ["هدف سلوكي 1", "..."],
      "sections": [
        { "type": "text|list|steps|table|example|tip|warning|remember|activity", "title": "...", "body": "فقرات مفصولة بسطر فارغ، **غامق** مسموح", "items": ["..."], "rows": [["رأس1","رأس2"],["..","..."]] }
      ],
      "resources": [{ "type": "link|video|file", "title": "...", "url": "https://..." }],
      "questions": [{ "text": "...", "options": ["أ","ب","ج","د"], "answer": 0, "explanation": "..." }]
    }
  ],
  "finalQuiz": { "questions": [ { "text": "...", "options": ["..","..","..",".."], "answer": 2, "explanation": "..." } ] }
}
```
- يُنظَّف كل محتوى قادم من المتصفح على الخادم (`sanitizeContent_`): إزالة أي HTML، قبول روابط http/https فقط، حدود أطوال، 4 خيارات بالضبط، `answer` بين 0 و3.
- لا يُرسَل للمتدرب أبدًا حقل `questions` أو `answer` أو `explanation`؛ الاختبار يُجلب عبر `quiz.start` بلا مفتاح.

## الأصول (Drive)
مجلد «IKP - ملفات منصة ابن خلدون للتدريب» يحوي الصور المرفوعة من الإدارة (`asset_*`) وملفات PDF للشهادات (`IKP-certificate-<serial>.pdf`). الخادم لا يقرأ أي ملف خارج هذا المجلد حتى لو عُرف معرّفه.

## حدود السعة العملية
- Google Sheets: 10 ملايين خلية لكل جدول؛ بحجم مدرسة (مئات المستخدمين، عشرات الورش، آلاف المحاولات) الاستهلاك بعيد عن الحد.
- زمن الاستجابة يتأثر بحجم الأوراق الكبيرة (Attempts, AuditLog, MailLog)؛ تُقرأ كل ورقة مرة واحدة لكل طلب (كاش داخل التنفيذ). عند تجاوز عشرات الآلاف من الصفوف يُنصح بأرشفة ورقة AuditLog القديمة بنسخها إلى جدول آخر وحذف الصفوف.
- الخلية الواحدة 50,000 حرف؛ محتوى الورشة موزع على 10 خلايا (حتى 450 ألف حرف ≈ 20 وحدة مفصّلة).
