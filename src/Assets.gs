/**
 * Assets.gs — الأصول البصرية (الترويسة والتذييل والشعارات والتوقيعات والختم)
 * ------------------------------------------------------------
 * - الصور الافتراضية (ترويسة وتذييل المدرسة) مضمّنة في ملف Assets.html (أو index في نسخة الملف الواحد).
 * - الصور المرفوعة من الإدارة تُحفظ في مجلد Drive الخاص بالمنصة فقط، ولا يُقرأ أي ملف خارج هذا المجلد.
 * - app.assets (عام) يُعيد فقط الصور المضبوطة في إعدادات الهوية البصرية — لا يقبل معرّفات حرة.
 */

var __assetsCache = null;
function defaultAssets_() {
  if (__assetsCache) return __assetsCache;
  var out = { header: '', footer: '' };
  ['Assets', 'index'].some(function (name) {
    try {
      var html = HtmlService.createHtmlOutputFromFile(name).getContent();
      var mh = html.match(/header:\s*'(data:[^']+)'/); var mf = html.match(/footer:\s*'(data:[^']+)'/);
      if (mh) out.header = mh[1]; if (mf) out.footer = mf[1];
      return !!(mh || mf);
    } catch (e) { return false; }
  });
  __assetsCache = out;
  return out;
}
function driveFolder_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty(PROPS.DRIVE_FOLDER_ID);
  var f = null;
  if (id) { try { f = DriveApp.getFolderById(id); } catch (e) { f = null; } }
  if (!f) { f = DriveApp.createFolder('IKP - ملفات منصة ابن خلدون للتدريب'); props.setProperty(PROPS.DRIVE_FOLDER_ID, f.getId()); }
  return f;
}
/** هل الملف داخل مجلد المنصة؟ (حماية من قراءة ملفات Drive أخرى عبر معرّف مُخمَّن) */
function assetInFolder_(file) {
  try {
    var fid = driveFolder_().getId();
    var parents = file.getParents();
    while (parents.hasNext()) { if (parents.next().getId() === fid) return true; }
  } catch (e) { }
  return false;
}
/**
 * يُعيد صورة Drive كـ data URL. strict=true يفرض أن تكون داخل مجلد المنصة (للاستدعاءات القادمة من الواجهة).
 * الاستدعاءات الداخلية (قالب الشهادة/الهوية) تمر بمعرّفات حفظتها الإدارة عبر الرفع، وتُفحص أيضًا.
 */
function assetDataUrl_(fileId, strict) {
  if (!fileId) return '';
  fileId = String(fileId);
  if (fileId.indexOf('data:') === 0) return fileId;
  if (!/^[A-Za-z0-9_-]{10,}$/.test(fileId)) return '';
  try {
    var file = DriveApp.getFileById(fileId);
    if (!assetInFolder_(file)) return '';
    var blob = file.getBlob();
    var ct = blob.getContentType();
    if (!/^image\/(png|jpeg|jpg|webp)$/.test(ct)) return '';
    return 'data:' + ct + ';base64,' + Utilities.base64Encode(blob.getBytes());
  } catch (e) { return ''; }
}
/** رفع صورة من لوحة الإدارة (PNG/JPEG/WebP حتى 600KB) إلى مجلد المنصة */
function adminAssetUpload_(user, p) {
  var m = String(p.dataUrl || '').match(/^data:(image\/(png|jpeg|jpg|webp));base64,([A-Za-z0-9+\/=]+)$/);
  if (!m) fail('VALIDATION', 'الملف يجب أن يكون صورة PNG أو JPEG أو WebP.');
  var bytes;
  try { bytes = Utilities.base64Decode(m[3]); } catch (e) { fail('VALIDATION', 'بيانات الصورة غير صالحة.'); }
  if (!bytes.length) fail('VALIDATION', 'الصورة فارغة.');
  if (bytes.length > LIMITS.MAX_UPLOAD_BYTES) fail('VALIDATION', 'حجم الصورة يتجاوز ' + Math.round(LIMITS.MAX_UPLOAD_BYTES / 1024) + ' كيلوبايت.');
  var name = 'asset_' + cleanText_(p.name || 'image', 40).replace(/[^\w؀-ۿ.-]/g, '_') + '_' + Date.now();
  var file = driveFolder_().createFile(Utilities.newBlob(bytes, m[1], name));
  audit_(user, 'asset_upload', file.getId(), { name: name, bytes: bytes.length });
  return { fileId: file.getId(), dataUrl: p.dataUrl };
}
/** صور الهوية البصرية المضبوطة فقط (للجميع، بدون جلسة) — يُستدعى عند الإقلاع إن كانت مخصصة */
function brandingAssets_(p) {
  var b = getSettings_().branding || {};
  var which = String((p && p.which) || '');
  var out = {};
  if ((!which || which === 'header') && b.headerImageId) out.header = { id: b.headerImageId, dataUrl: assetDataUrl_(b.headerImageId, true) };
  if ((!which || which === 'footer') && b.footerImageId) out.footer = { id: b.footerImageId, dataUrl: assetDataUrl_(b.footerImageId, true) };
  return out;
}
