# Naxxramas — private application upload setup (DRAFT)

**Owner:** CosmicCuddle  
**Status:** configuration plan approved to prepare; **not implemented, not tested, not public, not activated**  
**Website:** Draft PR #47 on `draft/three-native-pages-faq-2026-11-03`  
**Original form:** Owner's approved 3-page, 17-field Word application (DOCX). Retain exact owner-authored form; never recreate its 17 questions as an online Tally questionnaire.

## 1. Scope: an upload-only Tally Free form

Use an **owner-controlled Tally account**. The account owner must create/sign in personally. Don't request or share account credentials.

Working Tally form title: **Naxxramas — Private Application Upload [TEST]**.

Suggested form text for owner review (this is a draft, not a live privacy notice):

> Please complete the official Naxxramas Word application before submitting. Upload **one completed .docx file** here. Do not include a password, real name, payment information or other sensitive details. Applications are read by the server owner for manual review and response. Your file and any contact details are held within the owner-controlled Tally account while being reviewed. Please read the approved privacy notice before submitting.

Use these blocks, in order:

1. **Instructions / notice (text)** — clear upload-only purpose and link back to the approved blank Word file once the owner explicitly authorises publishing it.
2. **File upload** — labelled `Completed Naxxramas Application (Word .docx)`, **required**, **single file**, allowed type **.docx only** for initial test, maximum **10 MB**. Check the actual file type control offers exact .docx; do not silently permit arbitrary file types.
3. **Required privacy confirmation** — consent/acknowledgement text and deletion/contact notice **must be owner approved** before any real applications. Do not copy the three server rules acknowledgements already included in the DOCX.
4. **Submit** — success message must say the file was submitted **only after Tally confirms a real submission**; submission does *not* mean acceptance or game-account creation.

**No duplicate personal questionnaire**: preferred account username, email address, optional Discord username and 17 numbered questions are all already in the DOCX. Avoid additional Tally email/contact fields unless genuinely needed and owner-approved.

### Owner-approved manual retention policy and draft applicant notice (3 Nov 2026)

**Confirmed owner decision:** delete completed applications **within 30 days after accepting or declining** the applicant. This clock begins on the **decision date**, not when the application was first submitted. The owner will manually remove Tally submissions and any locally saved copies, then empty Tally Trash. Because Tally Free offers no automatic deletion, a private reminder or deletion log is needed. **This is an approved duration, not proof the process has been tested or implemented.**

**Proposed Tally form privacy text — still requires owner's final wording review:**

> **Your Privacy**  
> Your application is submitted through Tally and reviewed privately by the Naxxramas server owner. The information is used to review your application and contact you about the outcome. Applications and owner-held copies will be deleted within 30 days after an acceptance or decline decision, using a manual deletion process. Tally may keep backup data for longer under its own deletion practices. Do not include passwords or unnecessary sensitive information.

Keep the **existing required acknowledgement**: “I have read the privacy information above and understand how my application will be used” → “I understand and agree.” Provide accessible links to the final privacy notice and Tally's privacy information before launch. Do not claim that uploads are never transferred to or stored by Tally.

**Owner follow-up before real applications:** set a maximum period for *undecided* applications and withdrawal handling; ensure this is covered in the published privacy notice. Staff-only email alerts should contain no needless sensitive answers. For now, the form is CLOSED and untested.

## 2. Tally settings

- Only the **owner/reviewer** should access submissions in the Tally dashboard. Do not grant edit, sharing, or export access to public collaborators.
- Start with a **closed or unpublished** form. For a private dummy-file test, activate briefly only when ready and close it again afterward. An unlisted link is **not** a privacy/access control.
- Turn on **Self email notifications** (available on Free) if the owner wants alerts. Do not forward notifications or upload links to public Discord, GitHub, spreadsheets, or support tickets.
- No public respondent emails are required until the owner reviews notification/privacy text. A successful on-screen receipt is sufficient for the initial test.
- **Retention — OWNER APPROVED (3 Nov 2026):** manually remove each completed application from Tally and any separately downloaded owner-held copies **within 30 days of the owner's acceptance or decline decision**. Empty the relevant items from Tally **Trash**, too; simply deleting a submission otherwise leaves it recoverable in Trash for up to **90 additional days**. The Free plan does not automatically enforce retention (automation is a **Business** feature). Tally's own backup deletion may take up to 90 days, so do not promise immediate removal from every provider backup. Keep decision dates and deletion due dates in a private owner-only record, without exposing applicant personal data to GitHub. Unresolved: a maximum retention period for applications still awaiting a decision, withdrawal requests, and any legal exceptions; do not claim these have been approved.
- Check any file URL exported to third-party apps: Tally says such exports can carry a token that lets recipients open files **without logging into Tally**. Avoid integrations/exporting applicant data unless individually authorised.

## 3. Safe test checklist (do not use real applicants)

- [ ] Create owner-controlled account and draft upload-only test form.
- [ ] Validate **one .docx** within 10 MB: selection, submission, owner-dashboard receipt and downloaded file content.
- [ ] Reject a missing file, the wrong type (such as .jpg or .exe), a second file, and a file larger than 10 MB.
- [ ] Check keyboard/mobile selection and accessible error messages.
- [ ] Confirm confirmation text appears **only after** Tally records the submission.
- [ ] Confirm owner email alert if enabled, without leaking applicant details via forwarding/exports.
- [ ] Confirm an unauthenticated browser cannot access the private dashboard/file through ordinary account links; separately inspect any exported URL risks.
- [ ] Test manual deletion and emptying Trash **with dummy data** only.
- [ ] Return test form to CLOSED and record results. Do not put test form URL or submission data in public Issues.

## 4. Website integration — separate approval gate

1. Owner approves the exact public blank DOCX and gives explicit permission to commit/publish that **blank template**. The private DOCX supplied in chat must not be uploaded to the public repository without this approval.
2. Owner approves the privacy notice, retention schedule, and final submit/confirmation wording.
3. After successful private dummy-file testing, use the **exact verified Tally form embed/link** from the owner. Embed in the existing **native Resource Hub** layout with standard/transparent Tally options as needed and an **external direct-link fallback**.
4. Before any website launch, run desktop/mobile/keyboard tests, test submission success/failure, and check no personal application data is in GitHub Pages, source commits, GitHub Issues or public previews.
5. Owner explicitly approves merge/publication **separately** from opening applications; only then change site status from **Applications closed** to open.

## Sources checked 3 November 2026

- Tally file uploads, allowed types, free 10 MB cap and authenticated-dashboard access: https://tally.so/help/file-uploads
- Tally form settings and close form: https://tally.so/help/form-settings
- Tally Free self email notifications: https://tally.so/help/self-email-notifications
- Tally retention/Trash, Business-only automation: https://tally.so/help/submissions-data-retention
- Tally standard embedding: https://tally.so/help/embed-your-form

**Do not invent a Tally ID, URL, embed snippet, recipient address, credentials or a claim of completed testing.**
