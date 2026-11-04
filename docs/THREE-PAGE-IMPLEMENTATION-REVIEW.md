# Three Native Resource Hub Pages — DRAFT Implementation Review

**Owner:** CosmicCuddle — final approval required.
**Planning:** https://github.com/CosmicCuddle/Naxxramas-Resource-Hub/issues/46
**Status:** Scoped review branch only. No merge, deployment, application uploads or player accounts activated.

## Latest owner decisions and publication preparation — 4 November 2026

**Step 1 — CONTENT ACCEPTED FOR THIS DRAFT:** CosmicCuddle said "I think 1. is done, so lets move onto 2. and then 3." in response to the final Rules, New Player Guide and FAQ review. Record this as approval of the **current page wording** for the planned website release: all 12 always-expanded rules, 38 New Player Guide FAQs, 35 Rules FAQs, and 8 Apply FAQs. Earlier notes below saying "FAQ awaiting exact wording approval" are historical, not current. This content sign-off is **not** approval to merge or activate applications, and does not independently establish unverified server configuration facts as deployed.

**Step 2 — PRIVACY NOTICE DRAFT STAGED, OWNER REVIEW PENDING:** The native Apply page now has an always-visible, linked `#privacy` card **before the private upload**, explaining controller identity/contact, categories/purposes, manual decisions, proposed legitimate-interests basis, Tally/email processing, 90-day pending limit, 30-day after-decision deletion and clearing Trash, provider-backup caveats, rights and owner contact/ICO route. The earlier competing notice drafts were consolidated in `docs/TALLY-PRIVATE-APPLICATION-SETUP.md`. The **legal basis is a proposal requiring confirmation/assessment**, and this is **not an independent UK GDPR compliance certification**. Final owner wording/legal review is needed before intake opens. No privacy promises were altered without owner direction.

**Step 3 — PUBLICATION PREPARED, NOT AUTHORISED:**

- **Release A — pages only:** with separate explicit owner consent, merge PR #47 to add New Player Guide, Server Rules and Apply pages; **leave the application upload CLOSED** and Tally `APPLICATION_EMBED_APPROVED = false`. The approved empty DOCX remains downloadable, but no upload receiver is enabled by the website.
- **Release B — applications open (separate decision):** only after privacy text/lawful basis and contact instructions are approved and available on the live page, intentionally open the owner-controlled Tally form and separately approve the site embed/status activation. Tally's own Close form state is independent of the website flag; the owner has asked us **not to repeat Tally functional tests**. Normal deletion/Trash handling remains a live operational obligation, not a request for more tests.
- **Before Release A:** obtain a clean automated run for the latest commit; review the completed privacy page and the one remaining proposed legal-basis statement; check unchanged original website navigation/legacy routes; obtain the owner's explicit merge/publication approval. A local test or draft screenshot is **not** proof that production was deployed.
- **After Release A (only if approved):** verify the actual website shows all 3 pages in native navigation, the blank DOCX downloads, the privacy section is readable and applications remain closed. If something breaks, revert the focused PR changes rather than replacing the original Resource Hub site.
- **Information boundaries:** the current Tally workflow is owner-accepted based on successful dummy upload, correct attached Word file, notification email and Thank You screen. No claim is made that missing-file, file-size/type failure, deletion/Trash, provider Close form status, separate Admin sign-in or every legacy route was independently tested. Do not add private submissions, secrets or confidential connection files to GitHub.

**Do not treat the headings "Step 1 complete" or "Release prepared" as permission to publish anything. CosmicCuddle remains the release approver.**

## Design feedback incorporated — 3 November 2026

After viewing the offline screenshot, the owner confirmed the overall layout was acceptable but pointed out **non-native menu icons** and a **large empty gap** in the hero/header area.

- The earlier offline screenshot generator used temporary Unicode glyphs (sparkle, pencil, envelope) and **was not accurate for sidebar icon appearance**. The draft's real navigation script has now been explicitly tied to three Warcraft icon-image assets confirmed in the original site's own HTML (book for New Players, note for Server Rules, key for Apply to Join), using the site's original `nav-icon-image` class and native size.
- `assets/naxx-three-pages.css` now collapses the native `170px` artwork column only for the three new pages, where large banner emblems were intentionally removed. It also tightens excess header padding. The original native banner and images on every other Resource Hub page are unaffected.
- Asset versions bumped to `v=2` in the root and subpage loaders; tests verify the icon assets exist in original site source and the empty column is removed.
- **The previous screenshots predate these corrections**. Do not present those old images as proof of this revised layout. A real connected browser review is still required for full Warcraft icon rendering and the final visual appearance before owner merge approval.

## Included for review

- `new-players/` — detailed New Player Guide, character-based Individual Progression, client build 12340, verified patch release links, private post-acceptance configuration, Playerbots, altbots, Auction House, loot and 38 detailed FAQ answers balanced across Vanilla, TBC and Wrath.
- `rules/` — twelve full, permanently visible rule cards, examples, group etiquette, ticket help, enforcement and 35 practical Getting Started FAQ questions grouped into five topic sections about client setup, IP tiers, Playerbots and altbots.
- `apply/` — short Download → Complete and Save → Upload and Submit flow, disabled uploader, manual owner-review/reply explanation and eight practical FAQ questions after removing two redundant preview/account questions.
- `assets/naxx-three-pages.js` — adds exactly three native-styled links immediately after Home in both original sidebar and mobile drawer; leaves all original groups, search, breadcrumbs, existing Admin controls and resources intact.
- `assets/naxx-three-page-bootstrap.js` — loads the **same native ~31MB source** and the exact existing root overlay scripts for the new permanent URLs. Does not use the visual preview as code.
- `assets/naxx-three-pages.css` — new-page-card-only styles, matching native black/deep-red/gold; avoids modifying sitewide sidebar dimensions, search, breadcrumbs and general site CSS.

The root `index.html` remains a lightweight loader with only two new asset references. `site-content.html` must remain bit-for-bit unchanged during this feature draft. Existing talent fixes, raids timers, patch notes, Change Notes, modules, other menus and Admin are not replaced.

## Owner's FAQ direction — 3 November 2026 (awaiting wording approval)

The owner reviewed the original Rules FAQ and requested **more practical questions**, especially how to set up the client, what Individual Progression does, what each tier means, how a player determines their tier, what Playerbots do, and whether bots complete their own quests.

The draft Rules page FAQ was expanded to **35 Getting Started Q&As**, with 5 topic headings and jump links. The twelve already approved rules and the approved Vanilla group etiquette, ticket guide and enforcement sections are unchanged. The New Player Guide remains the detailed source, linked from these short FAQ answers. The FAQ text itself is **proposed for owner review, not yet approved**.

Grounding:
- The required 3.3.5a client and two patch filenames, character-based Individual Progression and permissible altbot levelling come from the existing reviewed guide and the owner's recorded rules.
- [The owner's Grimfeather IP fork](https://github.com/CosmicCuddle/mod-individual-progression/blob/master/src/IndividualProgression.h) has internal completed-milestone state values 0–7 for early Vanilla, Molten Core, Onyxia, Blackwing Lair, AQ preparation/war, AQ and Naxxramas; these are **not character levels**. It does not establish a public-facing player tier lookup. Its [`ip get` chat command](https://github.com/CosmicCuddle/mod-individual-progression/blob/master/src/cs_individualProgression.cpp) is restricted to `SEC_GAMEMASTER`, so the public page **does not instruct normal players to use it**.
- Upstream Playerbots can quest independently depending on settings, but the owner's **deployed** autonomous quest and group quest syncing options are not yet confirmed. The FAQ makes this caveat explicit.
- A targeted verification request has been filed with Maintenance at [Coordination Issue #34](https://github.com/CosmicCuddle/Naxxramas-Server-Coordination/issues/34). Update the two provisional answers once actual live capabilities are established.

**No merge or publication authorised.** This is a draft content edit only.

### Owner request: substantially larger but readable FAQ

CosmicCuddle asked for **many more questions and answers**, with useful detail that remains easy to read. The draft FAQ has been extended to **35 questions**, grouped by Client Setup & Joining (7), Individual Progression & Tiers (11), Playerbots & Altbots (10), Loot, Trading & Everyday Play (4), and Help & Troubleshooting (3). Short topic links allow navigation without collapsing any answer. Each answer stays to a few sentences and points to the full New Player Guide or the relevant rule when more detail is needed.

**Content status:** proposed for owner review; do not interpret this drafting action as approval of the FAQ or as authority to merge. The 12 individually approved rules, group etiquette, in-game ticket instructions, and ban enforcement sections are unchanged. The server-specific tier display and installed bot quest behaviour are still awaiting verification from Maintenance ([Issue #34](https://github.com/CosmicCuddle/Naxxramas-Server-Coordination/issues/34)).

### Owner clarification: starting Individual Progression stage (3 November 2026)

CosmicCuddle accepted the expanded onboarding FAQ direction and clarified: **most freshly created characters begin at Individual Progression Tier 0, except Blood Elf, Draenei and Death Knight characters**, which have separate starting progression rules. Both the Rules FAQ and New Player Guide now state this; the earlier overbroad claim that *all* characters start in Vanilla has been corrected.

**Important technical boundary:** The owner’s other documented F14 requirement that **positively identified Blood Elf/Draenei random bots** have a Tier 8 TBC floor is **rndbot-specific** ([Coordination #10](https://github.com/CosmicCuddle/Naxxramas-Server-Coordination/issues/10)). It does not establish an identical numerical starting tier for all human Blood Elves/Draenei or player-controlled altbots. The fork's Death Knight starting behaviour is configurable. Therefore the public FAQ intentionally **does not invent numerical tiers** for those three exceptional categories. Installed effective settings still require verification.

No change to the 12 approved rules, acceptance or application state, nor to the live website. No new owner approval to publish has been requested or implied.

### New Player Guide FAQ — owner-requested expansion coverage (3 November 2026)

CosmicCuddle approved all **six main New Player Guide sections**, then requested that its FAQ be **more detailed and give TBC and WotLK comparable coverage to Vanilla**. Draft `new-players/content.html` now includes **38 questions in seven visible topic groups**: Getting Started & Client Setup (5), Understanding Individual Progression (5), Vanilla (5), The Burning Crusade (6), Wrath of the Lich King (6), Playerbots (6), and Loot/Trading/Help (5). The answers average **44 words** (range 36–53), with short source-grounded explanations and topic jump links; nothing is hidden behind expand/collapse UI. **The six approved main sections are unchanged**.

Source qualification:
- Owner [IP fork enum](https://github.com/CosmicCuddle/mod-individual-progression/blob/master/src/IndividualProgression.h): Vanilla 0–7; principal TBC stages 8–12 with stage 11 skipped/commented; stage 13 is a historical boundary; Wrath content milestones 14–18. These are **module/source references**, not confirmed current live permissions for a specific character.
- [Coordination #18](https://github.com/CosmicCuddle/Naxxramas-Server-Coordination/issues/18): the owner's **earned final boss → eligible to purchase → paid expansion passage** rule for Chronomancer Vezrath is a confirmed *design requirement*, **not yet proof of a deployed purchase gate**. FAQ labels this planned, not active. Vanilla ending relates to original level-60 Kel'Thuzad; TBC ending to Kil'jaeden. Do not tell players stage 13 alone confers Wrath entitlement.
- [Maintenance read-only reply in #34](https://github.com/CosmicCuddle/Naxxramas-Server-Coordination/issues/34): published `.ip get` is GM-only; normal-player tier interface and actual installed config are not verified. Playerbots has underlying real quest actions, but deployed autonomous questing and group sync are not validated. FAQ distinguishes these source capabilities from unverified live behaviour.
- The owner clarified that fresh characters **generally** start at Tier 0, with Blood Elf, Draenei and Death Knight exceptions. No numeric default is asserted for those exceptional cases.
- The client connection remains private to the acceptance email; no credentials or realm address added to the guide.

**Approval status:** New Player Guide main sections 1–6 owner-approved; **expanded 38-answer FAQ is a draft awaiting exact text review**. Rules page has its own separate 35-answer FAQ and 12 owner-approved rules. Application remains disabled, and Draft PR #47 has **no merge/publication permission**.

## Native runtime regression work — 3 November 2026

The initial screenshots showed only the intended design. An additional source-level review of the original site's JavaScript revealed that the native Resource Hub may **re-render `#resourceGrid` after the new page is mounted**. The initial one-time data attribute would have prevented remounting, and a displayed guide could disappear.

- `assets/naxx-three-pages.js` now caches each route's fetched HTML once and observes **only the content grid** for native redraws. When the native page renderer replaces the guide content, the new-page article is restored from memory without another network request or a repeated mutation loop.
- The original Resource Hub's other pages are not intercepted; the observer is installed only for these new guide routes. Any handbook-only height/grid classes are cleared on these routes.
- The page's native heading, breadcrumb and contextual banner text are reapplied when remounted. The Apply demo remains disabled.
- `assets/tests/native-three-pages-behavior.test.cjs` provides a dependency-free mock DOM test for all three page load/re-render paths, one fetch per route, a disabled Apply upload, and a genuine error state when a page cannot be fetched.
- `assets/tests/native-three-pages-navigation.test.cjs` tests native desktop/mobile buttons, placement after Home, link activation, route-selected state, native rebuild recovery and no duplicates.
- `assets/tests/native-three-pages.test.cjs` additionally checks **root and subpage JS/CSS asset parity** so future site features are not accidentally left out on nested guide URLs.
- In-session execution of the production navigation and mounting logic with isolated DOM simulations passed for Home and Rules navigation/rebuild and for New Players, Rules and Apply guide redraw/recovery. These are **simulated checks**, not proof of actual deployed browser integration.
- Full connected-browser QA and screenshots that show the real CDN icons are still required; do not portray earlier mock screenshots as final browser evidence.

## Public Game Clients correction incorporated — 3 November 2026

**Resolved in the current website source:** CosmicCuddle approved the separate targeted Game Clients sanitisation, merged into `main` via [PR #48](https://github.com/CosmicCuddle/Naxxramas-Resource-Hub/pull/48). This draft branch has now incorporated that merge, retaining the original Resource Hub source file **after** the approved single-field redaction. Exact source Git blob: `71ab9f2bf4cf12282fcbe135f7ec787805715b62`.

The public site no longer gives new applicants the old connection-setting line; it explains that approved connection instructions are supplied privately as an acceptance-email attachment. Existing client and custom patch information remain intact. The draft test now requires the sanitized content hash, so the old source must not be reintroduced by accident.

**Historical exposure is a separate issue:** Earlier public commits, cached files and previous downloads cannot be erased by an ordinary merge. Maintenance is assessing whether the historic information is still sensitive via [Coordination Issue #33](https://github.com/CosmicCuddle/Naxxramas-Server-Coordination/issues/33). Do not reproduce the historical address or file contents in public tickets, PRs or new documents.

**Still outstanding before publication:** owner approval of full page text and raid-only loot details, real-browser desktop/mobile QA, and review of the closed application state. The private Tally upload remains disabled and requires a separate owner-approved activation process.

## Publication gates — owner decisions needed

- Confirm final Rules Draft 1.0 wording, especially the separate raid-only Master Looter setup; the exact approved raid workflow and automation status have **not** been independently verified.
- Confirm any final player account onboarding/registration sequence, application access model and how future tier access is actually enabled in game. No assumed race restrictions, automatic whitelist or paid expansion services are claimed.
- Verify required patch releases remain current immediately before publication (checked 3 Nov 2026: main v1.0.6.8.4 includes `patch-V.mpq`; v1.0.6.7 supplies `patch-Z.mpq`).
- **DONE for draft:** The owner approved the existing three-page editable DOCX (17 questions, 26 interactive checkboxes and 12 blank answer fields) and separately authorised offering the unanswered template as a public download. The file and a working download link are now staged in `apply/`. A PDF remains optional/unselected. **This does not authorise merging the PR or opening Tally submissions.**
- Approve a privacy notice, retention/deletion schedule, contact email handling, reviewer access, spam/rate limits and permitted reapplications/withdrawals.
- Review desktop/mobile visual QA, header/footer, three new links, keyboard navigation, original site content and all anticipated FAQ answers.
- Confirm the only publicly displayed application state is **closed** until genuine end-to-end tests and explicit owner activation approval.

## Existing owner application DOCX — preserved as source of truth (3 November 2026)

**Owner-provided private source:** `Naxxramas Application.docx`, **three pages**, **17 numbered questions/fields**, 3 final agreement boxes, owner welcome and detailed server overview. Page 1 requests preferred future **account username**, email and optional Discord username; Page 2 covers WoW experience, expansion progression, play style, faction and Playerbots; Page 3 covers interests, feedback, available play times, questions and agreement to rules.

CosmicCuddle asked us to continue from that existing form, not replace it with an assistant-invented seven-question form. A separate **working review copy** `Naxxramas-Application-Website-Review.docx` was created locally from the user's private upload with **one text-only instruction change**: save the Word document, and when applications open, submit it through the website's private upload area. The owner document's 17 fields, layout and rules acknowledgements were preserved. All three pages rendered and were visually inspected; no overflow or lost fields were observed. The final owner-approved **blank** copy is now staged as `apply/naxxramas-application.docx` in the public draft branch; only the unanswered template was committed. The former private review copy remains historical context, not a second website download.

Draft `apply/content.html` was aligned with the **preferred account username** wording (instead of the earlier invented community nickname) and clarifies that the owner creates accounts manually after acceptance. The already approved three-step **download → complete/save → private upload** workflow is unchanged. The draft Apply page now offers an official blank DOCX download; the private Tally upload remains **disabled**. Downloading a template is not submission, acceptance or account creation. Do not create a fake public form or leak private applications.

**Owner document approval:** CosmicCuddle confirmed on 3 November 2026 that the revised DOCX is satisfactory. A subsequent direct OOXML check confirmed that all **26 checkboxes are already genuine Word checkbox controls**, with **12 editable text content controls**; no checkbox redesign was necessary. **Remaining release decisions:** whether to offer an optional PDF, final privacy/withdrawal contact and notice approval, browser and private Tally verification, and explicit owner permission to merge/activate applications. Blank DOCX publishing permission is already recorded and implemented in this draft. The draft website remains unmerged and applications closed.

### Tally Free owner approval to prepare (3 November 2026)

CosmicCuddle agreed to proceed with a private **Tally Free** upload flow after approving the existing 3-page DOCX. The exact setup and dummy-file acceptance checklist are now tracked in [`docs/TALLY-PRIVATE-APPLICATION-SETUP.md`](TALLY-PRIVATE-APPLICATION-SETUP.md), based on Tally's current help documentation.

**Decision scope:** Prepare an **upload-only** test form; collect a single **DOCX, up to 10 MB**, using the already-approved application with all 17 fields and no duplicated online questionnaire. Owner creates/manages the Tally account; no credentials supplied here. The public Apply page now labels Tally as planned and keeps its example field disabled. The owner has supplied the exact Tally form URL; the hidden, gated embed is prepared in this draft and the owner reports a successful dummy upload. **Privacy/withdrawal contact, actual submission/dashboard/email/deletion verification, and activation approval remain pending.** Never treat an owner-reported dummy test as proof of every production acceptance check.

**Contact-method decision (4 Nov 2026):** CosmicCuddle approved **email or private Discord message** for applicant withdrawal/deletion requests. CosmicCuddle subsequently created **naxxapplicationteam@gmail.com** and supplied it for public application/privacy contact. CosmicCuddle further confirmed the address is for **all Naxxramas enquiries and player support**, not only applications or privacy requests. This is the approved email route. **CosmicCuddle confirmed on 4 November 2026 that they already tested both receiving a message sent from another account and replying from the new mailbox.** This is owner-reported email delivery verification; it is separate from Tally's email notification settings; **CosmicCuddle subsequently confirmed an automatic Tally new-submission email arrived on 4 November 2026** (owner-reported, not independently inspected). A public Discord contact route is optional and remains unspecified.

**Privacy caution:** Tally Free does not offer automated submission retention; a manual policy and deletion/Trash check are required. File links exported via integrations can become accessible without Tally login if the recipient has the tokenised URL. Avoid applicant-data exports and public links. No live applicant submissions until approved.

### Owner-approved application retention (3 November 2026)

CosmicCuddle expressly approved **manual deletion of completed applications within 30 days after an acceptance or decline decision**. This is **not** a 30-day-after-submission deadline. On Tally Free the owner must manually delete the submission, also empty the relevant Tally Trash, and delete any locally downloaded copies. Tally Trash normally keeps deleted submissions recoverable for up to 90 days unless permanently emptied; provider backups may have a different deletion lag. Guidance, concise proposed privacy notice and a test checklist are in [`TALLY-PRIVATE-APPLICATION-SETUP.md`](TALLY-PRIVATE-APPLICATION-SETUP.md). CosmicCuddle also approved a **90-day maximum undecided period after submission**, with applications normally reviewed within **1–2 days** (usual practice, not a promised turnaround). Any still-pending application must be decided or closed/deleted by day 90; the 30-day post-decision removal deadline still applies to applications actually accepted or declined. Withdrawal/deletion requests and the full privacy notice still need final review before release.

Owner-supplied screenshots previously showed a single required DOCX upload (10 MB), a privacy acknowledgement, a custom thank-you page and reported self-email notifications. The owner supplied the Tally URL and subsequently **confirmed that two dummy uploads appear in the owner dashboard, one uploaded Word file opened with correct content, and the automatic Tally notification email arrived**. These findings are **owner-confirmed**, not independently accessed. The owner also **confirmed the customised Thank You screen appeared exactly as expected**, and directed that **no additional Tally functional testing is needed**. Wrong-file/size, deletion/Trash and Tally Close form state were not checked; do not present them as verified or continue requesting tests. Do not misstate the earlier screenshots as present-day account-side verification. No website activation/merge is approved. Keep the distinction between **user-reported settings**, a visual preview, and **verified test delivery**.

### Owner-supplied Tally link and release-gated embed (3 November 2026)

The owner supplied **https://tally.so/r/q5Lqr8** for the published Tally test form and reported that a dummy Word upload worked. The form is still an independently accessible public Tally URL whenever its own *Close form* option is OFF. Do **not** confuse this with approved public applications on the Naxxramas website.

In Draft PR #47, the existing `apply/content.html` now holds a **hidden/inert Standard Tally iframe** for that exact form and an equally hidden direct-link fallback. The native page JS includes **`var APPLICATION_EMBED_APPROVED = false;`**, so **the iframe has no `src`**, the external widget library does not load, and the public page continues to show the disabled closed-application preview. Scoped CSS maintains the Resource Hub style and accessible mobile width. Activation is a **separate later owner approval and code change**; do not flip this flag until the official blank DOCX, full privacy notice, actual Tally submission/notification/deletion checks, and visual QA pass.

Owner confirmed the two dummy uploads in the dashboard, correct Word file contents from one submission, and an automatically received Tally email. These checks are **owner-reported, not independently inspected**. **The customised Thank You view is owner-confirmed as working.** Negative upload tests, Trash clearing and current Close form setting remain unverified. The owner has accepted the Tally flow and does not want further functional tests. The exact Tally form ID is stored on the **public draft branch**, so treat the link as publicly discoverable, not a secret. See [`TALLY-PRIVATE-APPLICATION-SETUP.md`](TALLY-PRIVATE-APPLICATION-SETUP.md) for the separate provider and website release checklist.

## Tally Free integration — prepared in draft, NOT active on the website

The owner supplied `https://tally.so/r/q5Lqr8` and an upload-only form is prepared behind an OFF-by-default website release gate. **Tally's own form open/closed setting is a separate control.** Official references:
- https://tally.so/help/file-uploads — free file upload supports max **10 MB per file**, with allowed file types.
- https://tally.so/help/embed-your-form — embed with transparent background, dynamic sizing and direct-form fallback link once an owner-controlled test form exists.
- https://tally.so/help/self-email-notifications — notifications are supported on Free. Uploaded files are linked rather than attached to emails.
- https://tally.so/help/submissions-data-retention — scheduled automatic retention requires **Business**, not Free; Free needs a **manual deletion policy**, with deleted submissions otherwise retained in Trash for up to 90 days unless permanently emptied.

**Owner controls the Tally account; do not request credentials.** For release verification, check that the real form accepts exactly one `.docx` up to 10 MB, using the existing Word template's account/email/optional Discord fields; do not silently add PDF or an additional contact questionnaire. Do not request an unnecessary duplicate questionnaire or public account credentials. Restrict submissions to the owner/reviewer; verify that uploaded file links do not expose data to unauthenticated third parties. Validate mobile and keyboard file selection, wrong extension, large file, missing file, lost connection, duplicate submit and real server-confirmed success. Use dummy documents only.

The standard iframe and fallback link are already staged and inert in the Apply page. **Only after separate owner activation approval** should the disabled upload preview be replaced with the live Tally embed. A real success message must appear only after Tally confirms persistence; a failure must not claim successful delivery. Owner email notification is separate from an acceptance decision. Never put uploaded applications, contact details or secrets in GitHub Pages, repository commits, Issues or public previews.

### Owner decision — confirmation of joining after acceptance (3 November 2026)

An accepted applicant has **one calendar month from the acceptance notification** to demonstrate that they still intend to join. CosmicCuddle has confirmed that **any one** of these recognisable actions counts:

- Replying to the acceptance email
- Sending the owner a Discord message
- Joining the Naxxramas Discord server
- Logging into the WoW server

A person should **not** be marked withdrawn simply because they did not reply by email if the owner can identify them through another channel. If no recognisable contact or joining activity occurs within the month, the owner may close the **onboarding request as withdrawn/no response**, not as a rejection or ban. No automatic email/Discord/game-account matching is claimed.

This **does not extend the approved 30-day post-acceptance decision deadline** to remove the original application document and owner-held copies. A minimal private onboarding status record can be kept separately. **Approved public pre-acceptance email contact:** naxxapplicationteam@gmail.com handles support, applications and privacy/deletion requests; the owner confirmed receiving and replying works. Private Discord enquiries are also acceptable when reachable. Final public privacy wording still needs review.

### Readiness: verified versus outstanding

**Confirmed in the draft source:** approved blank Word download, 12 always-visible rules, 38 New Player + 35 Rules + 8 Apply FAQs, existing native navigation reuse, and an OFF-gated Tally iframe. The root source remains unchanged; no production merge or application activation is approved.

**Native automation now verified (4 November 2026):** GitHub Actions [run #41807042749](https://github.com/CosmicCuddle/Naxxramas-Resource-Hub/actions/runs/41807042749) completed **successfully**, running four real Node test scripts (the restored Game Clients connection-safety regression, native page/content/hash and closed Tally checks, navigation rebuild checks, and render/error recovery checks). The workflow has read-only repository permissions and no deploy step.

**Actual browser smoke checks also passed:** Headless Chrome served the draft on a loopback-only static server and ran **six scenarios**: original Home at **1440 px and 390 px**, Apply at **1440 px and 390 px**, Rules at **390 px**, and New Player Guide at **1440 px**. These confirmed the native Home and existing menu controls remain present, 38/35/8 FAQs and all 12 rules render, no horizontal overflow, the blank Word download works, and Tally remains inert. A real desktop sidebar click navigated from Apply to Rules; at mobile width the browser clicked the original **Menu** control, focused the mobile **Server Rules** button and clicked through to the Rules page. The approved DOCX was also fetched by local HTTP and matched its expected SHA-256. This is real executed browser QA, **not** screenshot/pixel-level or physical keyboard testing.

**Baseline A/B comparison completed (4 November 2026):** [GitHub Actions run #41811224763](https://github.com/CosmicCuddle/Naxxramas-Resource-Hub/actions/runs/41811224763) loaded the unchanged `main` site and draft side by side in separate local Chrome scenarios. The original Home-page **“Mage” search**, followed by **Game Clients navigation**, succeeded on **both** sites and reached the correct Game Clients heading. An earlier blank document was a **test-server routing error**: the original website uses its public GitHub Pages root `/Naxxramas-Resource-Hub/`, which the initial local harness didn't serve. After fixing the local harness, both sites passed. **No game-client code fix was needed.**

**Computed visual-style parity verified:** The same A/B test confirmed **exactly matching computed CSS** for six original Home-page controls/regions: Home sidebar button, sidebar container, search field, main page heading, content grid and context title. Properties compared include fonts, colours, padding, borders, display and line height. This supports original Home theme preservation but **does not** prove pixel-perfect screenshots of every new page.

**Not yet validated:** human screenshot and pixel-level review of the *new* Guide/Rules/Apply pages against the native site, complete physical keyboard Tab/Enter testing, genuine Admin login or all other legacy-section workflows, Tally functional checks accepted by owner (dashboard/DOCX/email/Thank You confirmed; other cases unverified and no further Tally tests requested), final Rules copy, final public privacy wording and separate owner website-merge and application-opening permissions. The browser tests use locally served draft files, not a production deployment or a live Tally integration test.

## Regression and manual checks

Run `node assets/tests/native-three-pages.test.cjs`. It checks the exact three routes, preserved lightweight loader, unchanged original source SHA, native nav integration, all 12 visible rules, the 38/35/8 FAQ groups, no accordions and inactive application receiver.

On desktop and mobile:
1. Verify Home → New Players → Server Rules → Apply to Join appears **under Home** with the existing navigation icon sizing; Class Handbooks and every other native item remain in place.
2. Verify the search bar, native breadcrumb strip, original banner/card styling, Admin access and native site footer.
3. Verify the 12 rule blocks all show fully, and FAQs display question/answer text without click-to-expand.
4. Verify original Home, Class and Dungeon Handbooks, Talent Sets, Talent Calculator, Module Information, Game Clients, Temporary Banned, Patches and Change Notes still work.
5. Verify Apply has **no working submit**, no upload endpoint, no live embed and no false confirmation.
6. Inspect at desktop around 1440×900 and mobile 390×844 for overflow, clipped labels and tab navigation.

**Rollback:** Revert this draft PR if later merged; it adds a small set of files and two root loader references. Do not reset `main`; retain the original large content asset. This PR is deliberately not approved for merge.
