# KIU QSF Verification & Submission Portal

Kampala International University, School of Mathematics and Computing (SOMAC).

> **Apps Script note:** in the Apps Script editor, the HTML file must be named exactly `Index` (capital I). Paste the contents of `index.html` from this repository into it.

> **GitHub Pages note:** the GitHub Pages copy can verify forms only. Submitting and the Admin tab work only through the deployed Google Apps Script `/exec` link.

```
KIU QSF VERIFICATION & SUBMISSION PORTAL - Google Apps Script web app
=====================================================================

Two tabs on one link:

LECTURER: VERIFY & SUBMIT
  1. Choose the completed Question Submission Form (.docx). It is checked in the browser.
  2. Fix any errors shown, then tick the two Head of Department moderation boxes.
  3. Press "Submit to the Question Bank" (unlocks only when the form passes every check
     and both boxes are ticked). An optional email can be recorded.
  4. A submission reference (e.g. KIU-QSF-20261104-120301-4821) is shown as a receipt.

ADMIN: SUBMISSIONS (password protected)
  * Totals, search, department filter, latest-only / all-versions filter.
  * Download one form, tick several and download them as one ZIP, or download the list as CSV.
  * Links to the Google Drive folder and the Google Sheet log.
  * If the same Course Code + Academic Year + Semester is submitted again, the newer one is
    "Latest" and the older one becomes "Superseded" (both are kept).

Where the data lives (in the Google account that deploys the app):
  * Drive folder  "KIU QSF Submissions"      - every submitted .docx
  * Google Sheet  "KIU QSF Submissions Log"  - one row per submission (inside that folder)

Verification rules
  * Word .docx made from the template (.doc: Save As .docx first)
  * Section A: all 11 fields filled
  * At least 9 complete topics and at least "Total Topics Covered" (more allowed, fewer not)
  * Each topic: a name, no duplicate names, exactly 5 questions, Q1 labelled "(Compulsory)",
    marks on every question, no placeholder text, no question repeated word-for-word
  * Both HoD moderation boxes ticked
  To change the numbers, edit CONFIG at the top of the <script> in Index.html.

SET-UP (about 5 minutes)
------------------------
1. Go to https://script.google.com > New project. Name it "KIU QSF Portal".
   Use the KIU / admin Google account that should own the submissions.
2. Replace everything in Code.gs with the contents of Code.gs from this folder.
3. Files "+" > HTML, name it exactly:  Index   and paste in Index.html. Save (Ctrl+S).
4. Set the admin password:
   Project Settings (gear icon) > Script properties > Add script property
       Property:  ADMIN_PASSWORD
       Value:     <choose a strong password>
5. Back in the editor, choose the function "setup" in the toolbar and click Run.
   Approve the permissions (Drive and Sheets). The log prints the folder and sheet links.
6. Deploy > New deployment > gear icon > Web app
       Execute as:      Me
       Who has access:  Anyone   (lecturers need no Google account)
                        or "Anyone within <KIU domain>" if all lecturers use KIU Google accounts
   Deploy, then copy the Web app URL (ends in /exec). Share that one link:
   lecturers use the first tab, admins use the "Admin: Submissions" tab.

Updating later: edit the files, then Deploy > Manage deployments > pencil icon >
Version: "New version" > Deploy. The link stays the same.

Changing the admin password: edit ADMIN_PASSWORD in Script properties (takes effect at once;
admins already signed in stay signed in for up to 6 hours).

Security notes
  * Submitted papers are stored privately in the owner's Drive; they are not shared publicly.
  * Admin downloads only work for files inside the submissions folder, and only after sign-in.
  * Anyone with the link can submit a file. The server re-checks that it is a real .docx,
    that both HoD boxes were ticked, and that it is under 15 MB.
```
