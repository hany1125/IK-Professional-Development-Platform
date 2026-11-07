/**
 * e2e.js — اختبارات شاملة للواجهة الحقيقية في متصفح Chromium (Playwright) عبر خادم التطوير وجسر google.script.run.
 * التشغيل: node tests/e2e.js   (يشغّل dev-server تلقائيًا على منفذ عشوائي)
 * المخرجات: tests/screenshots/*.png + tests/screenshots/certificate-browser.pdf + تقرير في المخرجات القياسية.
 */
'use strict';
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const PORT = 4300 + Math.floor(Math.random() * 500);
const BASE = 'http://localhost:' + PORT;
const SHOTS = path.join(__dirname, 'screenshots');
fs.mkdirSync(SHOTS, { recursive: true });
const results = [];
let failures = 0;
const dbgPages = [];
async function dumpPages() { for (const pg of dbgPages) { try { console.log('   [debug] url=' + pg.url() + ' main=' + JSON.stringify(await pg.evaluate(() => (document.querySelector('#main') || document.body).innerText.slice(0, 200)))); } catch (e) { } } }
function step(name, fn) { return Promise.resolve().then(fn).then(() => { results.push(['✔', name]); console.log('✔', name); }).catch(async (e) => { failures++; results.push(['✖', name + ' — ' + (e && e.message || e)]); console.log('✖', name, '\n   ', e && e.stack || e); await dumpPages(); }); }
function expect(cond, msg) { if (!cond) throw new Error(msg || 'expectation failed'); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function getJson(url, opts) { const r = await fetch(BASE + url, opts); return r.json(); }
async function mailCode(to) { const box = await getJson('/__mail'); const m = box.slice().reverse().find((x) => x.to === to); return m ? (m.html.match(/>(\d{6})</) || [])[1] : null; }
async function waitIdle(page) { await page.waitForFunction(() => !document.body.classList.contains('busy') && !document.querySelector('[aria-busy="true"]'), null, { timeout: 15000 }).catch(() => { }); }
async function fill(page, sel, val) { await page.fill(sel, ''); await page.fill(sel, val); }
/** انتظار تنبيه بنص محدد (لا نكتفي بأي toast حتى لا نلتقط تنبيهًا سابقًا) */
async function waitToast(pg, text) { await pg.waitForSelector('.toast:has-text("' + text + '")', { timeout: 15000 }); }
async function noOverflow(page) { return page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1); }
/** تنقّل داخل التطبيق عبر الموجّه (يعمل حتى لو كان الهاش هو نفسه، بخلاف page.goto) */
async function nav(pg, hash) { await pg.evaluate((h) => { if (typeof go === 'function') go(h); else location.hash = h; }, hash); }

(async () => {
  const srv = spawn(process.execPath, [path.join(__dirname, 'dev-server.js')], { env: Object.assign({}, process.env, { PORT: String(PORT), SEED: '0' }), stdio: ['ignore', 'pipe', 'pipe'] });
  srv.stdout.on('data', (d) => { if (process.env.VERBOSE) process.stdout.write('[srv] ' + d); });
  srv.stderr.on('data', (d) => process.stderr.write('[srv:err] ' + d));
  for (let i = 0; i < 50; i++) { try { await fetch(BASE + '/__state'); break; } catch (e) { await sleep(200); } }
  const browser = await chromium.launch();
  const consoleErrors = [];
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, locale: 'ar-QA', deviceScaleFactor: 1 });
  const page = await ctx.newPage(); dbgPages.push(page);
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + e.message));
  const state = await getJson('/__state');
  const creds = state.creds;

  try {
    /* ---------- 1) إعداد المدير الأول من الواجهة ---------- */
    await step('صفحة الإعداد الأول تظهر عند عدم وجود مدير وترفض الرمز الخاطئ', async () => {
      await page.goto(BASE + '/');
      await page.waitForSelector('#fSetup', { timeout: 15000 });
      expect(await page.locator('.brandbar img').count() === 1, 'الترويسة ظاهرة');
      expect(await page.locator('.footerbar img').count() === 1, 'التذييل ظاهر');
      await page.screenshot({ path: path.join(SHOTS, '01-setup.png'), fullPage: true });
      await fill(page, '#sToken', '00000000'); await fill(page, '#sName', 'هاني عبده محمود'); await fill(page, '#sEmail', creds.adminEmail); await fill(page, '#sPass', creds.password); await fill(page, '#sPass2', creds.password);
      await page.click('#fSetup button[type=submit]');
      await page.waitForSelector('#sToken_w.invalid', { timeout: 10000 });
    });
    await step('إنشاء المدير الأول بالرمز الصحيح والدخول للوحة الإدارة', async () => {
      await fill(page, '#sToken', creds.setupToken);
      await page.click('#fSetup button[type=submit]');
      await page.waitForURL(/#\/admin\/overview/, { timeout: 15000 });
      await page.waitForSelector('.kpi', { timeout: 15000 });
      await page.screenshot({ path: path.join(SHOTS, '02-admin-overview.png'), fullPage: true });
    });

    /* ---------- 2) إدارة الورش: المحرر، التحقق، المعاينة، JSON ---------- */
    await step('محرر الورشة: فتح الورشة الأولية، التحقق، المعاينة، حوار JSON، وتجميد التركيز في النافذة', async () => {
      await page.goto(BASE + '/#/admin/workshops'); await page.waitForSelector('table.tbl');
      await page.click('table.tbl a[href^="#/admin/ws/"]');
      await page.waitForSelector('#edRoot');
      expect((await page.locator('#edRoot .mod').count()) === 4, '4 وحدات');
      await page.click('#btnValidate');
      await page.waitForSelector('.modal .alert.ok');
      await page.keyboard.press('Escape');
      await page.waitForSelector('.modal', { state: 'detached' });
      await page.click('#btnPreview'); await page.waitForSelector('.modal.wide .content');
      await page.screenshot({ path: path.join(SHOTS, '03-admin-preview.png') });
      // focus trap: Tab يبقى داخل النافذة
      for (let i = 0; i < 25; i++) await page.keyboard.press('Tab');
      const inside = await page.evaluate(() => !!document.activeElement.closest('.modal'));
      expect(inside, 'التركيز داخل النافذة بعد 25 Tab');
      await page.keyboard.press('Escape'); await page.waitForSelector('.modal', { state: 'detached' });
      await page.click('#btnJson'); await page.waitForSelector('#jsonTa');
      await page.fill('#jsonTa', '{ bad json');
      await page.click('#jsonApply'); await page.waitForSelector('#jsonMsg .alert.err');
      await page.keyboard.press('Escape');
      // فتح الوحدة الأولى وتعديل سؤال ثم حفظ
      await page.click('#edRoot .mod .mh');
      await page.fill('#edRoot .mod.open .qed .qExp', 'توضيح معدّل من اختبار الواجهة');
      await page.click('#btnSave');
      await waitToast(page, 'تم الحفظ');
      await waitIdle(page);
      const versions = await getJson('/__rows?t=WorkshopVersions');
      expect(versions.length === 2, 'إصدار جديد لأن الورشة منشورة (عدد الإصدارات ' + versions.length + ')');
      await page.screenshot({ path: path.join(SHOTS, '04-admin-editor.png'), fullPage: true });
    });

    /* ---------- 3) الإعدادات والذكاء الاصطناعي ---------- */
    await step('الإعدادات: الحفظ، حالة المفتاح دون كشفه، وحفظ مفتاح Claude', async () => {
      await page.goto(BASE + '/#/admin/settings'); await page.waitForSelector('#fSet');
      await fill(page, '#sAdminMail', creds.adminEmail);
      await page.click('#fSet button[type=submit]');
      await waitToast(page, 'تم حفظ الإعدادات');
      await page.fill('#aiKeyIn', 'sk-ant-api03-E2E-TESTKEY-0123456789abcdefghij');
      await page.click('#aiKeySet'); await waitToast(page, 'تم حفظ المفتاح');
      await page.waitForSelector('#aiKeyDel');
      const html = await page.content();
      expect(!html.includes('E2E-TESTKEY'), 'المفتاح لا يظهر في الصفحة');
      await page.screenshot({ path: path.join(SHOTS, '05-admin-settings.png'), fullPage: true });
    });
    await step('معالج التوليد بالذكاء الاصطناعي: المراحل حتى الحفظ كمسودة (API محاكى)', async () => {
      await getJson('/__mock', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ claude: true }) });
      await page.goto(BASE + '/#/admin/workshops'); await page.waitForSelector('#btnAI');
      await page.click('#btnAI'); await page.waitForSelector('#aiForm');
      await page.fill('#aiTopic', 'استراتيجيات التعلم النشط في المرحلة الإعدادية');
      await page.fill('#aiN', '2');
      await page.click('#aiStart');
      await page.waitForSelector('#aiJobBox .chip.ok', { timeout: 20000 });
      await page.waitForFunction(() => document.querySelector('#aiJobBox') && /مكتملة/.test(document.querySelector('#aiJobBox').textContent), null, { timeout: 30000 });
      await page.screenshot({ path: path.join(SHOTS, '06-ai-wizard.png') });
      const stages = await page.locator('#aiJobBox .stage.done').count();
      expect(stages === 6, 'كل المراحل تمت (' + stages + ')');
      await page.click('#aiJobBox a.btn.ok');
      await page.waitForSelector('#edRoot');
      expect((await page.locator('#edRoot .mod').count()) === 2, 'ورشة بوحدتين');
      expect(await page.locator('.chip.warn', { hasText: 'مسودة' }).count() >= 1, 'الحالة مسودة');
    });
    await step('المسار اليدوي: نسخ الأمر، رفض JSON غير صالح، قبول JSON صالح', async () => {
      await page.goto(BASE + '/#/admin/workshops'); await page.waitForSelector('#btnAI');
      await page.click('#btnAI'); await page.click('.tabs button[data-t="manual"]');
      await page.fill('#mnTopic', 'إدارة الصف الفعّالة');
      await page.click('#mnPrompt'); await page.waitForSelector('#mnPromptBox:not([style*="display: none"])');
      await page.fill('#mnJson', '{"title": "x"}');
      await page.click('#mnCheck'); await page.waitForSelector('#mnMsg .alert.err');
      const rows = await getJson('/__rows?t=WorkshopVersions');
      const v = rows[0]; const content = JSON.parse(['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8', 'c9', 'c10'].map((k) => v[k] || '').join(''));
      await page.fill('#mnJson', JSON.stringify(Object.assign({ title: 'ورشة مستوردة من JSON', description: 'وصف' }, content)));
      await page.click('#mnCheck'); await page.waitForSelector('#mnMsg .alert.ok');
      await page.click('#mnImport'); await page.waitForSelector('#edRoot');
      await page.keyboard.press('Escape');
    });

    /* ---------- 4) تسجيل متدرب من الواجهة والتحقق من البريد ---------- */
    await ctx.clearCookies();
    const tctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, locale: 'ar-QA' });
    const tp = await tctx.newPage(); dbgPages.push(tp);
    tp.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
    tp.on('pageerror', (e) => consoleErrors.push('pageerror: ' + e.message));
    await step('التسجيل: رفض بريد خارج النطاق، ثم التسجيل والتفعيل برمز البريد', async () => {
      await tp.goto(BASE + '/#/register'); await tp.waitForSelector('#fReg');
      await tp.screenshot({ path: path.join(SHOTS, '07-register.png'), fullPage: true });
      await fill(tp, '#rName', 'أحمد محمد عبدالله المعلم'); await fill(tp, '#rEmail', 'ahmed@gmail.com');
      await tp.selectOption('#rJob', 'معلم'); await tp.selectOption('#rDept', 'الرياضيات');
      await fill(tp, '#rPass', creds.password); await fill(tp, '#rPass2', creds.password);
      await tp.click('#fReg button[type=submit]');
      await tp.waitForSelector('#rEmail_w.invalid');
      await fill(tp, '#rEmail', creds.traineeEmail);
      await tp.click('#fReg button[type=submit]');
      await tp.waitForURL(/#\/verify/);
      await tp.waitForSelector('#vCode');
      await fill(tp, '#vCode', '111111'); await tp.click('#fVer button[type=submit]');
      await tp.waitForSelector('#vCode_w.invalid');
      const code = await mailCode(creds.traineeEmail);
      expect(code, 'رمز التفعيل وصل بالبريد');
      await fill(tp, '#vCode', code); await tp.click('#fVer button[type=submit]');
      await tp.waitForURL(/#\/home/, { timeout: 15000 });
      await tp.waitForSelector('.ws-card');
      await tp.screenshot({ path: path.join(SHOTS, '08-home.png'), fullPage: true });
    });

    /* ---------- 5) رحلة المتدرب: الورشة، الوحدة، الاختبارات، النهائي، الشهادة ---------- */
    let wsId = null;
    await step('صفحة الورشة والوحدة: المحتوى منسق، الإقرار يُحفظ، النهائي مقفل', async () => {
      await tp.click('.ws-card');
      await tp.waitForSelector('.mod-item');
      wsId = (await tp.url()).split('#/ws/')[1];
      expect(await tp.locator('.alert.info', { hasText: 'يُفتح الاختبار النهائي' }).count() === 1, 'النهائي مقفل');
      await tp.screenshot({ path: path.join(SHOTS, '09-workshop.png'), fullPage: true });
      await tp.click('.mod-item');
      await tp.waitForSelector('.content');
      expect((await tp.locator('.content table').count()) >= 1, 'جدول معروض');
      expect((await tp.locator('.callout').count()) >= 3, 'تنبيهات معروضة');
      await tp.screenshot({ path: path.join(SHOTS, '10-module.png'), fullPage: true });
      await tp.click('#btnAck'); await tp.waitForSelector('.chip.ok', { hasText: 'تم الإقرار' });
    });
    // حل الاختبار من الواجهة بالاعتماد على مفتاح الإجابة المخزن (يحاكي متدربًا يعرف الإجابات)
    async function solveInUi(kind, moduleIndex, wrong) {
      await nav(tp, kind === 'final' ? '#/ws/' + wsId + '/final' : '#/ws/' + wsId + '/quiz/' + moduleIndex);
      await tp.waitForSelector('#fQuiz');
      const atts = await getJson('/__rows?t=Attempts');
      const open = atts.filter((a) => a.status === 'open').pop();
      const map = JSON.parse(open.answers);
      const vers = await getJson('/__rows?t=WorkshopVersions');
      const ver = vers.find((v) => v.id === open.versionId);
      const content = JSON.parse(['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8', 'c9', 'c10'].map((k) => ver[k] || '').join(''));
      const qs = kind === 'final' ? content.finalQuiz.questions : content.modules[moduleIndex].questions;
      for (let di = 0; di < map.q.length; di++) {
        const qi = map.q[di]; const correctDisplay = map.o[qi].indexOf(Number(qs[qi].answer));
        const pick = di < wrong ? (correctDisplay + 1) % 4 : correctDisplay;
        await tp.check('input[name="q' + di + '"][value="' + pick + '"]');
      }
      return map.q.length;
    }
    await step('اختبار الوحدة: التحذير من أسئلة غير مجاب عنها، ثم تسليم ناقص يُرسب، ثم اجتياز كامل', async () => {
      await nav(tp, '#/ws/' + wsId + '/quiz/0'); await tp.waitForSelector('#fQuiz');
      await tp.screenshot({ path: path.join(SHOTS, '11-quiz.png'), fullPage: true });
      await tp.click('#fQuiz button[type=submit]');
      await tp.waitForSelector('.modal');
      expect(await tp.locator('.q-card.unanswered').count() === 5, 'كل الأسئلة مميزة كغير مجاب عنها');
      await tp.click('.modal button[data-close]');
      await tp.waitForSelector('.modal', { state: 'detached' });
      await tp.check('input[name="q0"][value="0"]');
      await tp.click('#fQuiz button[type=submit]'); await tp.waitForSelector('.modal #cok'); await tp.click('#cok');
      await tp.waitForSelector('.score-ring');
      const txt = await tp.locator('.score-ring span').textContent();
      expect(/^(0|20)%$/.test(txt.trim()), 'نتيجة منخفضة ' + txt);
      await tp.screenshot({ path: path.join(SHOTS, '12-quiz-fail.png'), fullPage: true });
      for (let i = 0; i < 4; i++) {
        await solveInUi('module', i, 0);
        await tp.click('#fQuiz button[type=submit]');
        await tp.waitForSelector('.score-ring');
        const t = await tp.locator('.score-ring span').textContent();
        expect(t.trim() === '100%', 'وحدة ' + (i + 1) + ' نتيجة ' + t);
      }
      await tp.screenshot({ path: path.join(SHOTS, '13-quiz-pass.png'), fullPage: true });
    });
    await step('الاختبار النهائي: فشل مؤقت للبريد لا يمنع الاجتياز والشهادة، ثم عرض الشهادة وتنزيل PDF', async () => {
      await getJson('/__mock', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mailFailNext: 2 }) });
      await solveInUi('final', -1, 1);
      await tp.click('#fQuiz button[type=submit]');
      await tp.waitForSelector('.score-ring');
      expect((await tp.locator('.score-ring span').textContent()).trim() === '90%', 'نتيجة النهائي 90%');
      expect(await tp.locator('.alert.ok', { hasText: 'شهادة' }).count() === 1, 'رسالة إصدار الشهادة');
      await tp.screenshot({ path: path.join(SHOTS, '14-final-pass.png'), fullPage: true });
      await tp.click('.alert.ok a[href^="#/cert/"]');
      await tp.waitForSelector('#certView .cert');
      await tp.screenshot({ path: path.join(SHOTS, '15-certificate.png'), fullPage: true });
      const [dl] = await Promise.all([tp.waitForEvent('download', { timeout: 15000 }), tp.click('#btnPdf')]);
      expect(/\.pdf$/.test(dl.suggestedFilename()), 'ملف PDF ' + dl.suggestedFilename());
      // PDF من المتصفح (المسار الموثوق للخطوط العربية): طباعة الشهادة وحدها بحجم A4 أفقي
      const certHtml = await tp.evaluate(() => document.querySelector('#certView').innerHTML);
      const pp = await tctx.newPage();
      await pp.setContent('<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;800&display=swap" rel="stylesheet"><style>body{margin:0}</style></head><body>' + certHtml + '</body></html>', { waitUntil: 'networkidle' }).catch(() => { });
      await pp.pdf({ path: path.join(SHOTS, 'certificate-browser.pdf'), width: '297mm', height: '210mm', printBackground: true });
      await pp.setViewportSize({ width: 1123, height: 794 });
      await pp.screenshot({ path: path.join(SHOTS, '16-certificate-a4.png') });
      await pp.close();
      const certs = await getJson('/__rows?t=Certificates');
      expect(certs.length === 1, 'شهادة واحدة فقط');
      const mail = await getJson('/__rows?t=MailLog');
      expect(mail.filter((m) => m.status === 'failed').length === 2, 'رسالتان فاشلتان مسجلتان');
    });
    await step('شهاداتي وسجل المحاولات والملف الشخصي', async () => {
      await tp.goto(BASE + '/#/certs'); await tp.waitForSelector('.cert-thumb');
      await tp.goto(BASE + '/#/ws/' + wsId + '/history'); await tp.waitForSelector('table.tbl');
      expect((await tp.locator('table.tbl tbody tr').count()) >= 6, 'سجل المحاولات');
      await tp.goto(BASE + '/#/profile'); await tp.waitForSelector('#fProf');
      await fill(tp, '#cwCur', creds.password); await fill(tp, '#cwNew', 'NewPass1234'); await fill(tp, '#cwNew2', 'NewPass1234');
      await tp.click('#fPw button[type=submit]'); await waitToast(tp, 'تم تغيير كلمة المرور');
      await tp.goto(BASE + '/#/home'); await tp.waitForSelector('.ws-card');
      expect(await tp.locator('.chip.ok', { hasText: 'مجتازة' }).count() >= 1, 'الورشة مجتازة في الرئيسية');
    });

    /* ---------- 6) الإدارة: الشهادات، النتائج، السجلات، النسخ الاحتياطي، إعادة البريد ---------- */
    await step('الإدارة: النتائج وCSV والشهادات وإعادة إرسال البريد الفاشل والنسخ الاحتياطي', async () => {
      await page.goto(BASE + '/#/admin/results'); await page.waitForSelector('#resBody table.tbl');
      expect(await page.locator('.chip.ok', { hasText: 'اجتاز' }).count() >= 1, 'نتيجة اجتياز');
      const [csv] = await Promise.all([page.waitForEvent('download'), page.click('#btnCsv')]);
      expect(/\.csv$/.test(csv.suggestedFilename()), 'csv');
      await page.click('#btnReport'); await page.waitForSelector('.modal .kpi'); await page.keyboard.press('Escape');
      await page.screenshot({ path: path.join(SHOTS, '17-admin-results.png'), fullPage: true });
      await page.goto(BASE + '/#/admin/certs'); await page.waitForSelector('#certBody table.tbl');
      await page.screenshot({ path: path.join(SHOTS, '18-admin-certs.png'), fullPage: true });
      await page.click('.tabs button[data-t="tpl"]'); await page.waitForSelector('#fTpl');
      await page.click('#tplPrev'); await page.waitForSelector('#pvView .cert');
      await page.screenshot({ path: path.join(SHOTS, '19-cert-template-preview.png') });
      await page.keyboard.press('Escape');
      await page.goto(BASE + '/#/admin/logs'); await page.waitForSelector('#aBody table.tbl');
      await page.click('.tabs button[data-t="mail"]'); await page.waitForSelector('#mBody table.tbl');
      await page.click('#mRetryAll'); await waitToast(page, 'عولج');
      await waitIdle(page);
      const mail = await getJson('/__rows?t=MailLog');
      expect(mail.filter((m) => m.status === 'failed').length === 0, 'لا رسائل فاشلة بعد إعادة المحاولة');
      await page.click('.tabs button[data-t="backup"]'); await page.waitForSelector('#bkExport');
      const [bk] = await Promise.all([page.waitForEvent('download'), page.click('#bkExport')]);
      const bkPath = await bk.path();
      const json = JSON.parse(fs.readFileSync(bkPath, 'utf8'));
      expect(json.format === 'ikp-backup' && !json.tables.Sessions, 'نسخة احتياطية صالحة بلا جلسات');
      await page.setInputFiles('#bkFile', { name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{"format":"other"}') });
      await page.waitForSelector('#bkPreview .alert.err');
      await page.setInputFiles('#bkFile', { name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(json)) });
      await page.waitForSelector('#bkGo');
      await page.click('#bkGo'); await page.waitForSelector('#cok'); await page.click('#cok');
      await page.waitForSelector('#bkPreview .alert.ok');
      const users = await getJson('/__rows?t=Users');
      expect(users.length === 2, 'لا تكرار بعد الاستيراد (' + users.length + ')');
      await page.screenshot({ path: path.join(SHOTS, '20-admin-backup.png'), fullPage: true });
    });
    await step('إيقاف حساب المتدرب يُنهي جلسته القديمة فورًا في الواجهة', async () => {
      await page.goto(BASE + '/#/admin/results'); await page.waitForSelector('.tabs');
      await page.click('.tabs button[data-t="users"]'); await page.waitForSelector('#usersBody table.tbl');
      const row = page.locator('#usersBody tr', { hasText: creds.traineeEmail });
      await row.locator('button[data-uid]').click();
      await page.waitForSelector('#fEU'); await page.selectOption('#euStatus', 'suspended'); await page.click('#euSave');
      await waitToast(page, 'تم الحفظ');
      await tp.goto(BASE + '/#/certs');
      await tp.waitForURL(/#\/login/, { timeout: 15000 });
      await page.click('#usersBody tr:has-text("' + creds.traineeEmail + '") button[data-uid]');
      await page.waitForSelector('#fEU'); await page.selectOption('#euStatus', 'active'); await page.click('#euSave'); await waitToast(page, 'تم الحفظ');
    });

    /* ---------- 7) الهاتف ولوحة المفاتيح ---------- */
    await step('الهاتف (390px): الرئيسية والورشة والاختبار دون تمرير أفقي، وشريط تنقل سفلي', async () => {
      const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ar-QA', isMobile: true, hasTouch: true });
      const mp = await mctx.newPage();
      mp.on('pageerror', (e) => consoleErrors.push('pageerror(m): ' + e.message));
      await mp.goto(BASE + '/#/login'); await mp.waitForSelector('#fLogin');
      await mp.screenshot({ path: path.join(SHOTS, '21-mobile-login.png'), fullPage: true });
      await fill(mp, '#lEmail', creds.traineeEmail); await fill(mp, '#lPass', 'NewPass1234'); await mp.click('#fLogin button[type=submit]');
      await mp.waitForSelector('.ws-card', { timeout: 15000 });
      expect(await noOverflow(mp), 'لا تمرير أفقي في الرئيسية');
      expect(await mp.locator('.mobnav').isVisible(), 'شريط التنقل السفلي');
      await mp.screenshot({ path: path.join(SHOTS, '22-mobile-home.png'), fullPage: true });
      await mp.click('.ws-card'); await mp.waitForSelector('.mod-item');
      expect(await noOverflow(mp), 'لا تمرير أفقي في الورشة');
      await mp.screenshot({ path: path.join(SHOTS, '23-mobile-workshop.png'), fullPage: true });
      await mp.click('.mod-item'); await mp.waitForSelector('.content');
      expect(await noOverflow(mp), 'لا تمرير أفقي في الوحدة');
      await mp.screenshot({ path: path.join(SHOTS, '24-mobile-module.png'), fullPage: false });
      await mp.goto(BASE + '/#/admin'); await mp.waitForSelector('.toast.warn', { timeout: 10000 });
      await mctx.close();
    });
    await step('لوحة المفاتيح: التنقل بـ Tab في نموذج الدخول وإغلاق النافذة بـ Escape وزر تخطي المحتوى', async () => {
      const kctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
      const kp = await kctx.newPage();
      await kp.goto(BASE + '/#/login'); await kp.waitForSelector('#fLogin');
      await kp.keyboard.press('Tab');
      const first = await kp.evaluate(() => document.activeElement.className);
      expect(/skip-link/.test(first), 'أول عنصر هو رابط التخطي');
      await kp.focus('#lEmail'); await kp.keyboard.type(creds.adminEmail); await kp.keyboard.press('Tab'); await kp.keyboard.type(creds.password); await kp.keyboard.press('Enter');
      await kp.waitForSelector('.ws-card', { timeout: 15000 });
      const labels = await kp.evaluate(() => Array.from(document.querySelectorAll('input:not([type=hidden]):not([type=radio]):not([type=checkbox])')).every((i) => i.labels && i.labels.length || i.getAttribute('aria-label')));
      expect(labels, 'كل الحقول لها تسميات');
      await kp.goto(BASE + '/#/admin/workshops'); await kp.waitForSelector('#btnNew');
      await kp.click('#btnNew'); await kp.waitForSelector('.modal');
      await kp.keyboard.press('Escape'); await kp.waitForSelector('.modal', { state: 'detached' });
      await kctx.close();
    });
  } finally {
    await browser.close();
    srv.kill();
  }
  const realErrors = consoleErrors.filter((e) => !/favicon|ERR_INTERNET_DISCONNECTED|fonts\.g(oogle|static)/.test(e));
  console.log('\n===== ملخص E2E =====');
  results.forEach((r) => console.log(r.join(' ')));
  console.log('أخطاء وحدة التحكم في المتصفح:', realErrors.length ? realErrors : 'لا شيء');
  fs.writeFileSync(path.join(SHOTS, 'e2e-report.json'), JSON.stringify({ at: new Date().toISOString(), results, consoleErrors: realErrors }, null, 2));
  process.exit(failures || realErrors.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
