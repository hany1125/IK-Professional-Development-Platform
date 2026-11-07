#!/usr/bin/env node
/**
 * check.js — فحوص ثابتة قبل التسليم:
 *  - صياغة كل ملفات .gs والسكربتات المضمنة في HTML
 *  - كل إجراء في ACTIONS له دالة موجودة، وكل استدعاء api('...') في الواجهة يقابله إجراء على الخادم
 *  - لا أسرار (مفاتيح sk-ant / كلمات مرور ثابتة / بريد شخصي) داخل الكود
 *  - لا مرجع لحقل answer في البيانات المرسلة للمتدرب (فحص ثابت تكميلي للاختبارات)
 */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const src = path.join(root, 'src');
let problems = 0;
const warn = (m) => { problems++; console.log('✖ ' + m); };
const gs = fs.readdirSync(src).filter((f) => f.endsWith('.gs'));
const html = fs.readdirSync(src).filter((f) => f.endsWith('.html'));
let server = '';
gs.forEach((f) => { const c = fs.readFileSync(path.join(src, f), 'utf8'); server += c + '\n'; try { new Function(c); } catch (e) { warn(f + ': ' + e.message); } });
let client = '';
html.forEach((f) => { const c = fs.readFileSync(path.join(src, f), 'utf8'); client += c + '\n'; [...c.matchAll(/<script>([\s\S]*?)<\/script>/g)].forEach((m) => { if (/IKP_BOOT/.test(m[1])) return; try { new Function(m[1]); } catch (e) { warn(f + ' inline script: ' + e.message); } }); });

// إجراءات الخادم مقابل استدعاءات الواجهة
const actions = new Set([...server.matchAll(/^\s*'([a-z]+(?:\.[A-Za-z]+)+)':\s*\['(public|user|admin)'/gm)].map((m) => m[1]));
const calls = new Set([...client.matchAll(/api\('([a-z]+(?:\.[A-Za-z]+)+)'/g)].map((m) => m[1]));
calls.forEach((c) => { if (!actions.has(c)) warn('الواجهة تستدعي إجراءً غير موجود على الخادم: ' + c); });
actions.forEach((a) => { if (!calls.has(a) && !['cert.verify', 'admin.ai.get'].includes(a)) console.log('ℹ إجراء خادمي لا تستدعيه الواجهة (قد يكون مقصودًا): ' + a); });
// دوال مستدعاة من ACTIONS موجودة
const fnNames = new Set([...server.matchAll(/^function\s+([A-Za-z0-9_]+)\s*\(/gm)].map((m) => m[1]));
[...server.matchAll(/return\s+([a-zA-Z0-9_]+_)\(/g)].forEach((m) => { if (!fnNames.has(m[1])) warn('دالة غير معرّفة: ' + m[1]); });
// أسرار
if (/sk-ant-api\d{2}-[A-Za-z0-9_-]{20,}/.test(server + client)) warn('مفتاح API حقيقي داخل الكود');
if (/@gmail\.com/.test(server + client)) warn('بريد شخصي داخل الكود');
if (/password\s*[:=]\s*'[^']{6,}'/i.test(server)) warn('كلمة مرور ثابتة داخل كود الخادم');
// بيانات المتدرب
const wsGet = server.match(/function wsGetForTrainee_[\s\S]*?\n}\n/);
if (!wsGet || /answer/.test(wsGet[0].replace(/questionCount|finalQuestionCount/g, ''))) warn('wsGetForTrainee_ قد يسرّب مفتاح الإجابة');
console.log(problems ? problems + ' مشكلة' : '✔ كل الفحوص الثابتة ناجحة — ' + gs.length + ' ملف خادم، ' + html.length + ' ملف واجهة، ' + actions.size + ' إجراء');
process.exit(problems ? 1 : 0);
