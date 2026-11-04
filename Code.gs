/**
 * KIU Question Submission Form (QSF) Verifier & Submission Portal — Google Apps Script web app.
 *
 * Lecturer tab : checks the filled-in QSF (.docx) in the browser, asks for the two HoD moderation
 *                confirmations, then submits the file. The file is saved in a Google Drive folder and
 *                a row is written to a Google Sheet (the "database").
 * Admin tab    : password-protected list of every submission, with single-file download,
 *                "download all as ZIP" and "download list as CSV".
 *
 * SET-UP (once):
 *   1. Paste Code.gs and Index.html (file name: Index) into a new Apps Script project.
 *   2. Project Settings (gear) > Script properties > Add:  ADMIN_PASSWORD = <a strong password>
 *   3. Run the function  setup  once from the editor (authorise when asked). It creates the
 *      Drive folder and the Google Sheet and prints their links in the execution log.
 *   4. Deploy > New deployment > Web app > Execute as: Me > Who has access: Anyone > Deploy.
 *
 * Files are stored in YOUR Drive (the account that deploys). Lecturers do not need a Google account.
 */

const FOLDER_NAME = 'KIU QSF Submissions';
const SHEET_NAME = 'KIU QSF Submissions Log';
const MAX_BYTES = 15 * 1024 * 1024;                 // largest .docx accepted (15 MB)
const ADMIN_SESSION_SECONDS = 6 * 60 * 60;          // admin stays signed in for 6 hours
const HEADERS = ['Reference', 'Submitted At', 'Status', 'Course Code', 'Course Title', 'Programme', 'Department',
  'School', 'Academic Year', 'Semester', 'Level', 'Lecturer', 'Lecturer Email', 'Topics', 'Questions',
  'HoD Moderated Unit', 'HoD Moderated Questions', 'Original File Name', 'Stored File Name', 'File ID', 'File Link'];

function doGet() {
  // the HTML file may be named "Index" or "index" in the Apps Script editor
  let page;
  try { page = HtmlService.createHtmlOutputFromFile('Index'); }
  catch (e) { page = HtmlService.createHtmlOutputFromFile('index'); }
  return page
    .setTitle('KIU QSF Verifier & Submission')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/* ---------------- storage ---------------- */
function setup() {
  const f = folder_(), s = sheet_();
  Logger.log('Drive folder: ' + f.getUrl());
  Logger.log('Google Sheet: ' + s.getParent().getUrl());
  if (!PropertiesService.getScriptProperties().getProperty('ADMIN_PASSWORD'))
    Logger.log('WARNING: set the script property ADMIN_PASSWORD (Project Settings > Script properties).');
}

function folder_() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('FOLDER_ID');
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) { /* deleted: recreate */ } }
  const f = DriveApp.createFolder(FOLDER_NAME);
  props.setProperty('FOLDER_ID', f.getId());
  return f;
}

function sheet_() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('SHEET_ID');
  let ss = null;
  if (id) { try { ss = SpreadsheetApp.openById(id); } catch (e) { ss = null; } }
  if (!ss) {
    ss = SpreadsheetApp.create(SHEET_NAME);
    props.setProperty('SHEET_ID', ss.getId());
    try { DriveApp.getFileById(ss.getId()).moveTo(folder_()); } catch (e) { /* keep in My Drive */ }
  }
  const sh = ss.getSheets()[0];
  if (sh.getLastRow() === 0) {
    sh.appendRow(HEADERS);
    sh.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold').setBackground('#0a1f4d').setFontColor('#ffffff');
    sh.setFrozenRows(1);
  }
  return sh;
}

// stop spreadsheet formula injection and trim long values
function clean_(v, max) {
  let s = String(v == null ? '' : v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim();
  if (max && s.length > max) s = s.slice(0, max);
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return s;
}
function safeName_(s) { return String(s || '').replace(/[\\\/:*?"<>|#%\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80); }

/* ---------------- lecturer: submit ---------------- */
function submitForm(payload) {
  if (!payload || typeof payload !== 'object') throw new Error('Nothing was received. Please try again.');
  const m = payload.meta || {};
  if (payload.verified !== true) throw new Error('This form has not passed verification. Fix the errors and check it again.');
  if (payload.hodUnit !== true || payload.hodBank !== true) throw new Error('Both Head of Department moderation boxes must be ticked before submitting.');
  if (!/\.docx$/i.test(payload.fileName || '')) throw new Error('Only Word .docx files can be submitted.');
  const email = String(payload.email || '').trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('The email address does not look right.');
  ['code', 'title', 'lecturer'].forEach(k => { if (!String(m[k] || '').trim()) throw new Error('Course details are incomplete (' + k + ').'); });

  const bytes = Utilities.base64Decode(String(payload.base64 || ''));
  if (!bytes.length) throw new Error('The file arrived empty. Please try again.');
  if (bytes.length > MAX_BYTES) throw new Error('The file is larger than ' + (MAX_BYTES / 1048576) + ' MB.');
  // server-side sanity check: it really is a Word document
  let ok = false;
  try { ok = Utilities.unzip(Utilities.newBlob(bytes, 'application/zip', 'f.zip')).some(b => b.getName() === 'word/document.xml'); } catch (e) { ok = false; }
  if (!ok) throw new Error('The file is not a valid Word .docx document.');

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sh = sheet_();
    const tz = Session.getScriptTimeZone() || 'Africa/Kampala';
    const now = new Date();
    const ref = 'KIU-QSF-' + Utilities.formatDate(now, tz, 'yyyyMMdd-HHmmss') + '-' + Math.floor(1000 + Math.random() * 9000);
    const stored = [safeName_(m.code), safeName_(m.title), safeName_(m.lecturer), ref].filter(Boolean).join(' - ') + '.docx';
    const file = folder_().createFile(Utilities.newBlob(bytes, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', stored));
    file.setDescription('QSF submission ' + ref + ' | ' + (m.code || '') + ' | ' + (m.lecturer || ''));

    // an earlier submission for the same course, year and semester becomes "Superseded"
    const key = [m.code, m.academicYear, m.semester].map(x => String(x || '').toLowerCase().replace(/\s+/g, '')).join('|');
    const last = sh.getLastRow();
    if (last > 1) {
      const vals = sh.getRange(2, 1, last - 1, HEADERS.length).getValues();
      vals.forEach((r, i) => {
        const k = [r[3], r[8], r[9]].map(x => String(x || '').replace(/^'/, '').toLowerCase().replace(/\s+/g, '')).join('|');
        if (k === key && r[2] === 'Latest') sh.getRange(i + 2, 3).setValue('Superseded');
      });
    }
    sh.appendRow([ref, now, 'Latest', clean_(m.code, 40), clean_(m.title, 200), clean_(m.programme, 200), clean_(m.department, 200),
      clean_(m.school, 200), clean_(m.academicYear, 40), clean_(m.semester, 40), clean_(m.level, 40), clean_(m.lecturer, 200),
      clean_(email, 200), Number(m.topics) || 0, Number(m.questions) || 0, 'Yes', 'Yes', clean_(payload.fileName, 200), stored,
      file.getId(), file.getUrl()]);
    return { ref: ref, at: Utilities.formatDate(now, tz, 'dd MMM yyyy, HH:mm'), storedName: stored };
  } finally {
    lock.releaseLock();
  }
}

/* ---------------- admin ---------------- */
function adminLogin(password) {
  const real = PropertiesService.getScriptProperties().getProperty('ADMIN_PASSWORD');
  if (!real) throw new Error('No admin password has been set. In the Apps Script editor add the script property ADMIN_PASSWORD.');
  Utilities.sleep(400);                                   // slows down password guessing
  if (String(password || '') !== real) throw new Error('Incorrect password.');
  const token = Utilities.getUuid();
  CacheService.getScriptCache().put('adm_' + token, '1', ADMIN_SESSION_SECONDS);
  return token;
}
function adminLogout(token) { CacheService.getScriptCache().remove('adm_' + token); return true; }
function checkAdmin_(token) {
  if (!token || CacheService.getScriptCache().get('adm_' + token) !== '1') throw new Error('Your admin session has expired. Please sign in again.');
}

function adminList(token) {
  checkAdmin_(token);
  const sh = sheet_();
  const last = sh.getLastRow();
  const tz = Session.getScriptTimeZone() || 'Africa/Kampala';
  const out = { rows: [], sheetUrl: sh.getParent().getUrl(), folderUrl: folder_().getUrl() };
  if (last < 2) return out;
  const vals = sh.getRange(2, 1, last - 1, HEADERS.length).getValues();
  out.rows = vals.map(r => {
    const o = {};
    HEADERS.forEach((h, i) => { let v = r[i]; if (v instanceof Date) v = Utilities.formatDate(v, tz, 'yyyy-MM-dd HH:mm'); o[h] = typeof v === 'string' ? v.replace(/^'/, '') : v; });
    return o;
  }).reverse();                                           // newest first
  return out;
}

function adminDownload(token, fileId) {
  checkAdmin_(token);
  const f = DriveApp.getFileById(String(fileId));
  if (!isOurs_(f)) throw new Error('That file is not part of the submissions folder.');
  const b = f.getBlob();
  return { name: f.getName(), mime: b.getContentType(), base64: Utilities.base64Encode(b.getBytes()) };
}

function adminDownloadZip(token, fileIds) {
  checkAdmin_(token);
  if (!Array.isArray(fileIds) || !fileIds.length) throw new Error('No files selected.');
  const used = {};
  const blobs = fileIds.map(id => {
    const f = DriveApp.getFileById(String(id));
    if (!isOurs_(f)) throw new Error('A selected file is not part of the submissions folder.');
    let n = f.getName(); while (used[n]) n = n.replace(/(\.docx)?$/, ' (copy)$1'); used[n] = 1;
    return f.getBlob().setName(n);
  });
  const tz = Session.getScriptTimeZone() || 'Africa/Kampala';
  const zip = Utilities.zip(blobs, 'KIU_QSF_Submissions_' + Utilities.formatDate(new Date(), tz, 'yyyyMMdd_HHmm') + '.zip');
  return { name: zip.getName(), mime: 'application/zip', base64: Utilities.base64Encode(zip.getBytes()) };
}

function isOurs_(file) {
  const fid = folder_().getId();
  const ps = file.getParents();
  while (ps.hasNext()) if (ps.next().getId() === fid) return true;
  return false;
}
