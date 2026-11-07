#!/usr/bin/env node
/**
 * يولّد src/Assets.html من الصور في assets/ (الترويسة والتذييل الرسميان + شعار المدرسة المقتطع).
 * الاستخدام: node tools/make-assets.js
 */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const read = (f, mime) => 'data:' + mime + ';base64,' + fs.readFileSync(path.join(root, 'assets', f)).toString('base64');
const header = read('header.jpg', 'image/jpeg');
const footer = read('footer.jpg', 'image/jpeg');
const emblem = read('emblem-160.png', 'image/png');
const out = `<script>
/* الأصول البصرية الافتراضية (ترويسة المدرسة الرسمية، التذييل: الرؤية والرسالة والقيم، شعار المدرسة)
   — يمكن استبدال الترويسة والتذييل من لوحة الإدارة > الإعدادات > الهوية البصرية.
   هذا الملف مولَّد آليًا بواسطة tools/make-assets.js من المجلد assets/ — لا تعدّله يدويًا. */
window.IKP_ASSETS = {
  header: '${header}',
  footer: '${footer}',
  emblem: '${emblem}'
};
</script>
`;
fs.writeFileSync(path.join(root, 'src', 'Assets.html'), out);
console.log('Assets.html written:', Math.round(out.length / 1024), 'KB');
