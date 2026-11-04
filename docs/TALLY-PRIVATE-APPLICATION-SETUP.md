# Naxxramas — private application upload setup (DRAFT)

**Owner:** CosmicCuddle  
**Status (4 November 2026):** **Tally functional testing accepted and closed by CosmicCuddle.** Owner-confirmed: both dummy submissions in dashboard; an uploaded DOCX retrieved and its contents checked; automatic submission email received; customised Thank You message displayed. These are **owner-reported** results, not independent account access. Negative-file and deletion/Trash cases were not tested. Respect the owner's decision not to continue functional Tally testing; the approved 30-day/90-day retention policy remains in force. The blank Word download and inert Tally iframe are staged in draft PR #47; the live website and embedded intake are **not activated**.  
**Website:** Draft PR #47 on `draft/three-native-pages-faq-2026-11-03`  
**Original form:** Owner's approved 3-page, 17-field Word application (DOCX). Retain exact owner-authored form; never recreate its 17 questions as an online Tally questionnaire.

## 1. Scope: an upload-only Tally Free form

Use an **owner-controlled Tally account**. The account owner must create/sign in personally. Don't request or share account credentials.

Working Tally form title: **Naxxramas — Private Application Upload [TEST]**.

Suggested form text for owner review (this is a draft, not a live privacy notice):

> Please complete the official Naxxramas Word application before submitting. Upload **one completed .docx file** here. Do not include a password, real name, payment information or other sensitive details. Applications are read by the server owner for manual review and response. Your file and any contact details are held within the owner-controlled Tally account while being reviewed. Please read the approved privacy notice before submitting.

Use these blocks, in order:

1. **Instructions / notice (text)** — clear upload-only purpose and link back to the owner-approved, unanswered Word application, now staged at `apply/naxxramas-application.docx` in the draft website. A download link does not mean applications are open.
2. **File upload** — labelled `Completed Naxxramas Application (Word .docx)`, **required**, **single file**, allowed type **.docx only** for initial test, maximum **10 MB**. Check the actual file type control offers exact .docx; do not silently permit arbitrary file types.
3. **Required privacy confirmation** — consent/acknowledgement text and deletion/contact notice **must be owner approved** before any real applications. Do not copy the three server rules acknowledgements already included in the DOCX.
4. **Submit** — success message must say the file was submitted **only after Tally confirms a real submission**; submission does *not* mean acceptance or game-account creation.

**No duplicate personal questionnaire**: preferred account username, email address, optional Discord username and 17 numbered questions are all already in the DOCX. Avoid additional Tally email/contact fields unless genuinely needed and owner-approved.

### Owner-approved manual retention policy and draft applicant notice (3 Nov 2026)

**Confirmed owner decision:** the owner usually aims to review applications within **1–2 days** (an expectation, **not a guaranteed response deadline**). No application should remain **undecided longer than 90 days after submission**. Review any unresolved application before that deadline and either make a decision or close/delete it by day 90; do not store it indefinitely while awaiting a reply. For accepted or declined applications, delete the application **within 30 days after the decision**. The owner will manually remove Tally submissions and any local copies, then empty Tally Trash. Because Tally Free has no automatic retention enforcement, a private reminder or deletion log is needed. These are owner-approved rules, **not proof the live process has been implemented or tested**.

**Proposed Tally form privacy text — still requires owner's final wording review:**

> **Your Privacy**  
> Your application is submitted through Tally and reviewed privately by the Naxxramas server owner, solely to assess your request and contact you about its outcome. I normally aim to reply within 1–2 days, although this is not guaranteed. Applications still awaiting a decision will be reviewed and closed or deleted within 90 days of submission. After an acceptance or decline decision, the application and owner-held copies will be manually deleted within 30 days. Tally may retain backup data temporarily under its own deletion procedures. Please do not include passwords or unnecessary sensitive information.

### Applicant-facing privacy notice — improved working draft (NOT RELEASE-APPROVED)

> **How your application is handled**
>
> When you apply to join Naxxramas, you submit your completed Word application through **Tally**. The application asks for a preferred account username, email address, optional Discord username, and answers about your interests and plans. You decide what to share in the optional questions.
>
> I use this information only to review your request, contact you with a decision, and arrange the next steps if you are accepted. Applications are reviewed privately by the Naxxramas server owner, not published as a public list. Please do not include passwords or unnecessary sensitive personal information.
>
> Pending applications will be reviewed and decided or closed/deleted within **90 days of submission**. I normally aim to reply within **one or two days**, but this is not a guaranteed response time. After a decision to accept or decline, I will manually delete the Tally submission and any copies I hold within **30 days of that decision**, including clearing Tally's Trash. Tally may retain backup information temporarily in line with its own procedures, so deletion is not necessarily immediate across all backups.
>
> If you want to withdraw your application, ask about the personal information you provided, or request deletion of your application information, you may contact the owner **by email or by private Discord message**. Either method is acceptable. For email, use **naxxapplicationteam@gmail.com**. You may also privately message the owner on Discord if you can reach them there. This is the **general Naxxramas contact email** for questions, player support, application enquiries and privacy or withdrawal requests; **do not email completed applications**. Use the approved private upload when applications open. Never share passwords or completed forms in public Discord channels.
>
> You can read Tally's own privacy information at https://tally.so/help/gdpr.

**Contact channels confirmed (4 November 2026):** CosmicCuddle approved **either email or a private Discord message** for withdrawal/deletion requests; applicants may use either, not necessarily both. **Public contact address supplied (4 November 2026):** CosmicCuddle reports creating **naxxapplicationteam@gmail.com** as the dedicated Naxxramas application contact. It is the approved general Naxxramas email for player support, questions, application enquiries and withdrawal/deletion/privacy requests; applicants may instead send a private Discord message if an established way to reach the owner is available. **Email test owner-confirmed (4 November 2026):** CosmicCuddle states they have already tested the newly created mailbox by sending a message to it from another account and replying from the Naxxramas mailbox. Record this as a successful **owner-reported inbound/outbound test**, not an independently inspected mailbox or an actual Tally notification test. No public Discord handle or invitation has been verified, so the published email serves as the accessible pre-acceptance route. The wider privacy notice still requires owner review and must not be copied into live Tally without approval. Legal/privacy completeness and any exceptions to deletion promises require further owner review; don't present this text as a legal compliance guarantee. This is intended to replace the shorter proposed privacy text above **after final approval**, not to appear alongside it as a duplicate notice.

**Approval boundary:** This repository is public. Do not add private email addresses, applicant names, submitted documents or direct private download links to this file or GitHub Issues.

Keep the **existing required acknowledgement**: “I have read the privacy information above and understand how my application will be used” → “I understand and agree.” Provide accessible links to the final privacy notice and Tally's privacy information before launch. Do not claim that uploads are never transferred to or stored by Tally.

**Owner follow-up before real applications:** the maximum pending-review period is now set at **90 days**; email/Discord request channels are approved and the owner has supplied **naxxapplicationteam@gmail.com** as the public email destination. Owner reports inbound/outbound email delivery already tested. Finalise withdrawal handling and any applicable legal exceptions in the published privacy notice. Staff-only email alerts should contain no needless sensitive answers. The **website embed remains OFF**. CosmicCuddle reports a successful dummy-file test of the separate Tally form, and has now confirmed **both dummy submissions are visible in the Tally Submissions dashboard**. CosmicCuddle has also confirmed **one submitted Word document opened/downloaded successfully and its contents were correct, with no issues**. This is owner-reported validation for one dummy file, not independent file integrity or acceptance of all document types. **Tally's automatic submission-notification email was received (owner-confirmed 4 November 2026).** Confirmation screen, current Close form setting and permanent deletion remain unverified.


### Owner decision — recognised activity within one month after acceptance (3 November 2026, clarified)

**CONFIRMED by CosmicCuddle:** An accepted applicant does **not** have to reply to the acceptance email specifically. Any **one** of these can demonstrate that they intend to join: (1) replying to the acceptance email, (2) messaging the owner on Discord, (3) joining the Naxxramas Discord server, or (4) connecting to the WoW server. Only **if none of these occurs in a recognisable way within one calendar month after acceptance notification**, the owner may treat the onboarding request as **withdrawn / no response**. This is not an application refusal, ban or instruction to delete a character/account.

**Applicant-facing wording:** "If accepted, you have one calendar month to show you intend to join. You can reply to your acceptance email, message me on Discord, join the Naxxramas Discord server, or log in to the game server. Any one is enough as long as I can tell it's you. If I receive no contact and see no sign you've joined within that month, I'll assume you've changed your mind and close the onboarding request."

**Manual verification and privacy:** Do not assume Discord joins or game logins are automatically linked to Tally applications, or promise automatic recognition, monitoring or email reminders. When the owner cannot reasonably match a Discord/game account to the accepted applicant, manual confirmation may be needed. A record of acceptance notification and confirmed onboarding status can be kept privately with minimum necessary details.

**Preserve the existing data policy independently:** The application and owner-held copies are still due for deletion **within 30 days after the acceptance decision**, including manually clearing Tally Trash. One month to demonstrate joining **does not extend the document retention deadline**.

**Channels and published email identified:** Email or private Discord are both approved methods for withdrawal/deletion requests, and **naxxapplicationteam@gmail.com** is the owner-supplied pre-acceptance email contact. The owner has tested receiving and replying from the mailbox; no specific Discord destination has been confirmed. An acceptance-email reply remains one possible way to confirm joining, but it is not a substitute for public pre-acceptance privacy contact instructions. Do not invent a Discord handle, account auto-deletion or automated server action.

## 2. Tally settings

- Only the **owner/reviewer** should access submissions in the Tally dashboard. Do not grant edit, sharing, or export access to public collaborators.
- Start with a **closed or unpublished** form. For a private dummy-file test, activate briefly only when ready and close it again afterward. An unlisted link is **not** a privacy/access control.
- Turn on **Self email notifications** (available on Free) if the owner wants alerts. Do not forward notifications or upload links to public Discord, GitHub, spreadsheets, or support tickets.
- No public respondent emails are required until the owner reviews notification/privacy text. A successful on-screen receipt is sufficient for the initial test.
- **Retention — OWNER APPROVED (3 Nov 2026):** manually remove each completed application from Tally and any separately downloaded owner-held copies **within 30 days of the owner's acceptance or decline decision**. Empty the relevant items from Tally **Trash**, too; simply deleting a submission otherwise leaves it recoverable in Trash for up to **90 additional days**. The Free plan does not automatically enforce retention (automation is a **Business** feature). Tally's own backup deletion may take up to 90 days, so do not promise immediate removal from every provider backup. Keep decision dates and deletion due dates in a private owner-only record, without exposing applicant personal data to GitHub. **Also owner-approved:** a typical review turnaround of **1–2 days**, with a **90-day maximum pending period from submission**; unresolved applications must be decided or closed/deleted by then. Withdrawal requests and any applicable legal exceptions remain unresolved; do not claim those are approved.
- Check any file URL exported to third-party apps: Tally says such exports can carry a token that lets recipients open files **without logging into Tally**. Avoid integrations/exporting applicant data unless individually authorised.

## 3. Historical test checklist (Tally functional testing closed 4 November 2026)

**Owner decision:** Do not ask CosmicCuddle to continue Tally functional tests. The unchecked cases below are **historical unverified items**, not an active test request. Normal care with data and the already-approved manual deletion/Trash policy are still operational responsibilities.

- [ ] Create owner-controlled account and draft upload-only test form.
- [x] **Owner-confirmed (4 Nov 2026):** dummy Word submissions received in Tally; both visible in Submissions and one uploaded DOCX retrieved/opened with correct contents. Provider-account access and file integrity were not independently inspected.
- [ ] Verify the intended **10 MB** upload limit and exactly one required `.docx` through negative tests (missing file, wrong type, second file and oversize).
- [ ] Reject a missing file, the wrong type (such as .jpg or .exe), a second file, and a file larger than 10 MB.
- [ ] Check keyboard/mobile selection and accessible error messages.
- [x] **Owner-confirmed (4 Nov 2026):** the customised Thank You / success message appeared after the dummy submission. Failed-submission messaging was not separately tested.
- [x] **Owner-confirmed (4 Nov 2026):** Tally's automatic new-submission notification email arrived. Do not forward applicant details or private file links to public channels.
- [ ] Confirm an unauthenticated browser cannot access the private dashboard/file through ordinary account links; separately inspect any exported URL risks.
- [ ] Test manual deletion and emptying Trash **with dummy data** only.
- [ ] Return test form to CLOSED and record results. Do not put test form URL or submission data in public Issues.

### Confirmed Tally URL and staged native website integration (3 November 2026)

CosmicCuddle supplied the public Tally share link **`https://tally.so/r/q5Lqr8`**, which identifies form `q5Lqr8`. This is a **form link, not a secret credential or access-control mechanism**. The Tally server may accept submissions if its own **Close form** setting is OFF, even if the Naxxramas website has not linked to it.

The website **DRAFT PR #47** now stages a standard responsive iframe inside the existing native Apply to Join section, preserving the surrounding Resource Hub header, sidebar, approved three-step instructions and eight FAQs. Uses documented embed query options `alignLeft=1`, `hideTitle=1`, `transparentBackground=1`, `dynamicHeight=1`, framed by site-native CSS; a direct-link fallback is also present.

**Double safety gate:** the HTML iframe has **no `src`** and lives inside an initially hidden section. The existing native page renderer sets `var APPLICATION_EMBED_APPROVED = false;` and **does not load Tally's widget script or set the iframe src while false**. The current disabled-demo upload stays visible instead. The approved blank Word download is **already staged in the draft**. Only a future owner-approved **website/application activation change**, with completed privacy and functional checks, may enable the Tally switch. Merely publishing the separate Tally form does **not** open the application's embed on the Naxxramas Resource Hub. The draft code **contains the public Tally link** on a visible GitHub branch: don't treat obscurity of that link as privacy protection.

On authorised launch, separately confirm:
- The owner-created Tally form has been end-to-end tested and intentionally opened.
- A public **blank** official Word application is downloadable at the native Apply page with permission; no applicant data is in the repo.
- The site removes its **Applications closed** text and disabled-demo control and enables the iframe only once all requirements pass.
- Tally's theme and the iframe's transparent-background option are checked on desktop/mobile for contrast; current default Tally colours could clash with the dark Warcraft theme.
- The external direct-link fallback works and opens **the same form**.
- The Tally form's *actual* privacy notice includes the owner-supplied email **naxxapplicationteam@gmail.com** for privacy/withdrawal requests, the 30-day post-decision deletion and 90-day maximum pending period; the owner's inbound/outbound email test is recorded; Tally automatic notification receipt is owner-confirmed; finalise privacy/compliance wording before activation.
- No application claim of success occurs unless Tally confirms actual submission.

**Evidence boundary — updated 4 November 2026:** CosmicCuddle confirmed **both dummy submissions are visible in their Tally Submissions dashboard**. This confirms dashboard receipt **as reported by the owner**, not by independent account access. **One dummy attached DOCX was successfully opened and its contents checked by CosmicCuddle**, so do not request a repeat of that specific test. CosmicCuddle also confirmed receipt of an **automatic Tally new-submission email** (not independently inspected). The customised Thank You screen is **owner-confirmed as working**. Independently computed DOCX integrity, wrong-file rejection, permanent deletion/Trash clearing and current form Close status are **not verified**. The owner explicitly asked to stop further Tally functional tests. Never post submission contents or private upload links to GitHub.

## 4. Website integration — separate approval gate

1. **DONE (draft only, 3 Nov 2026):** Owner authorised public distribution of the blank DOCX; the checked, unanswered template is committed as `apply/naxxramas-application.docx` and linked in the draft Apply page. This is **not** permission to merge the website or open applications. No applicant-completed document is committed.
2. Owner approves the privacy notice, retention schedule, and final submit/confirmation wording.
3. After successful private dummy-file testing, use the **exact verified Tally form embed/link** from the owner. Embed in the existing **native Resource Hub** layout with standard/transparent Tally options as needed and an **external direct-link fallback**.
4. **Partly verified (4 Nov 2026):** native Node tests and locally served Chrome smoke checks have passed at 1440 px desktop and 390 px mobile widths, including original Home loading, desktop and mobile drawer navigation clicks to Rules, focus on native buttons, correct Word download bytes and disabled Tally embed ([Actions run #41807042749](https://github.com/CosmicCuddle/Naxxramas-Resource-Hub/actions/runs/41807042749)). **Since verified:** Chrome keyboard and screenshot tests passed in [run #41813886827](https://github.com/CosmicCuddle/Naxxramas-Resource-Hub/actions/runs/41813886827). The owner accepted Tally's demonstrated behaviour and ended further Tally testing. **Website release work remaining:** final content/privacy review, ensuring no applicant data appears on public GitHub Pages/commits/Issues, and separate explicit owner approvals for publication and accepting applications.
5. Owner explicitly approves merge/publication **separately** from opening applications; only then change site status from **Applications closed** to open.

## Sources checked 3 November 2026

- Tally file uploads, allowed types, free 10 MB cap and authenticated-dashboard access: https://tally.so/help/file-uploads
- Tally form settings and close form: https://tally.so/help/form-settings
- Tally Free self email notifications: https://tally.so/help/self-email-notifications
- Tally retention/Trash, Business-only automation: https://tally.so/help/submissions-data-retention
- Tally standard embedding: https://tally.so/help/embed-your-form

**Do not invent a Tally ID, URL, embed snippet, recipient address, credentials or a claim of completed testing.**


## Approved blank DOCX download — draft branch (3 November 2026)

CosmicCuddle separately approved publication of the original unanswered three-page Word application. The uploaded source file was verified to contain 17 questions, 26 unchecked Word checkboxes, and 12 placeholder text fields. Only the final submission instruction was updated to direct players to the private website upload, consistent with the previously approved process. Visual rendering confirmed all three pages are intact. The public-draft asset is `apply/naxxramas-application.docx`; the proposed Apply page includes the native-styled download link. This approval does **not** open Tally or authorise merging the draft to main. Application intake and the live website remain unchanged pending separate owner release approval and privacy/browser QA.
