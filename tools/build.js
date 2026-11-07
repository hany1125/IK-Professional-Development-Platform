#!/usr/bin/env node
/**
 * build.js — يبني نسخة «الملف الواحد» الجاهزة للصق في محرر Apps Script:
 *   dist/Code.gs        ← جميع وحدات الخادم بالترتيب مع فواصل واضحة
 *   dist/index.html     ← الواجهة مع حلّ كل التضمينات <?!= include('...') ?> (يبقى <?!= bootstrap ?> فقط)
 *   dist/appsscript.json
 * الاستخدام: node tools/build.js
 * (النسخة المقسمة في src/ تبقى صالحة للنشر عبر clasp كما هي.)
 */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const src = path.join(root, 'src');
const dist = path.join(root, 'dist');
const ORDER = ['Config', 'Db', 'Auth', 'Setup', 'Api', 'Workshops', 'Quizzes', 'Certificates', 'Assets', 'Mail', 'AI', 'Admin', 'Backup', 'Seed', 'Lib_QRCode'];
fs.mkdirSync(dist, { recursive: true });

const header = `/**
 * ============================================================
 *  منصة ابن خلدون للتدريب والتطوير المهني — نسخة الملف الواحد (مولَّدة آليًا من src/ بواسطة tools/build.js)
 *  Code.gs  (كل كود الخادم في ملف واحد)
 * ------------------------------------------------------------
 *  التثبيت: الصق هذا الملف كاملًا في Code.gs، والصق dist/index.html في ملف HTML باسم index.
 *  ثم اختر الدالة SETUP_1_initialize من القائمة واضغط Run واتبع دليل التشغيل docs/01-setup-deploy.md.
 *  لا تعدّل هذا الملف مباشرة؛ عدّل الوحدات في src/ ثم أعد البناء.
 * ============================================================
 */
`;
let code = header;
ORDER.forEach((n) => {
  const body = fs.readFileSync(path.join(src, n + '.gs'), 'utf8');
  code += '\n\n/* ######################## ' + n + '.gs ######################## */\n\n' + body.trim() + '\n';
});
fs.writeFileSync(path.join(dist, 'Code.gs'), code);

let html = fs.readFileSync(path.join(src, 'index.html'), 'utf8');
html = html.replace(/<\?!=\s*include\('([A-Za-z0-9_]+)'\)\s*\?>/g, (m, name) => {
  const p = path.join(src, name + '.html');
  if (!fs.existsSync(p)) throw new Error('include not found: ' + name);
  return '\n<!-- ======== ' + name + '.html ======== -->\n' + fs.readFileSync(p, 'utf8').trim() + '\n';
});
if (/<\?!=\s*include/.test(html)) throw new Error('unresolved include');
fs.writeFileSync(path.join(dist, 'index.html'), html);
fs.copyFileSync(path.join(src, 'appsscript.json'), path.join(dist, 'appsscript.json'));

// فحص صياغة
new Function(code);
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]).filter((s) => !/IKP_BOOT/.test(s));
scripts.forEach((s, i) => { try { new Function(s); } catch (e) { throw new Error('syntax error in inline script #' + i + ': ' + e.message); } });
const kb = (f) => Math.round(fs.statSync(path.join(dist, f)).size / 1024) + ' KB';
console.log('dist/Code.gs ' + kb('Code.gs') + ' · dist/index.html ' + kb('index.html') + ' · scripts checked: ' + scripts.length);
