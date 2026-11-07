# Original Admin: keyboard-only opening and dismissal investigation

**7 November 2026 — Stage 7 preparation. Private, offline, no credentials or production writes.**

Our previous Chrome trial used the original visible Admin entry button with a tightly vetted, no-login click, then sent **Tab, Shift+Tab and Escape** on the open password panel.

**Observed at both 1440px and 390px:** Tab moved focus away from the password field, Shift+Tab returned it, but Escape left the password panel open and did not return focus to the visitor Admin button. The field remained empty, original hidden edit controls remained hidden and visitors never acquired administrator privileges.

These observations **do not prove a defect**. The original password panel was not detected as a native/ARIA modal, so Escape may not be an intended dismissal action. A visible close control was also not found *inside the inspected field container*, which does not prove no other original dismissal control exists.

## Second, independent trial — keyboard-only entry

New `editor/tools/private-admin-keyboard-entry-probe.cjs` and the existing disposable Chrome harness now:

1. Reload the original website at its root **with the password panel closed**, separately for desktop and mobile.
2. Identify exactly one **visible, non-disabled, non-submitting, non-form visitor Admin button** using the same restricted accessible-label rules as the established no-login visitor-entry test. Any ambiguous or unsafe trigger prevents Enter.
3. Inspect without DOM focus changes: detect the existing button's Tab eligibility and whether it exposes `aria-expanded` or `aria-controls` metadata. Never report the button's label or HTML.
4. Send actual Chrome **Tab key presses**, at most **80**, checking the true focused element after each press. No JavaScript `.focus()` shortcut is permitted. If the button cannot be reached within the bound, record that outcome instead of force-focusing or activating another control.
5. **Only if actual Tab navigation has focused the exact vetted button**, send a single real Chrome **Enter key**. Observe whether it opens the password panel and places focus in the password input.
6. Check the password is still empty, editing controls remain hidden, visitor privileges remain off and the root route is unchanged throughout. Refuse any form submission or nonlocal browser response.
7. Output only Boolean observations and the bounded Tab count, then discard the temporary website and browser profile.

### Key-event calibration

The **first** private Chrome trial at commit `2d32394` reached the visitor Admin button after **17 Tab presses on desktop** and **2 on mobile**, but an Enter dispatched as `rawKeyDown` (with no control character) did **not** open the panel at either width. This is **not sufficient evidence** that the original UI refuses keyboard activation, because Chromium distinguishes `rawKeyDown` from `keyDown`, and Puppeteer's standard `Keyboard.press('Enter')` sends `keyDown` with the carriage-return (CR) control character.

The follow-up retest uses the Chromium/Puppeteer-compatible **Enter control key** only on the one already focused, verified, non-form visitor Admin button. CR is not printable password text; the test still requires the password to remain empty and all privileges to remain off. We must use the follow-up real-Chrome outcome rather than treat the first raw-key result as a verified accessibility defect.

**Further test result:** the first standard-Enter run at `c4408cc` reached the post-activation observation but was rejected by a broad safety assertion requiring the original visitor Admin button to remain visible and uniquely named **after opening**. That requirement is not necessarily valid: the original UI may replace or hide the visitor button when the password panel appears. It did **not** yet identify which Boolean failed, so do not infer that the original button definitely disappeared or that any credential or privilege was exposed.

The follow-up verifier requires the visitor entry to be unique and visible **before Enter**, while allowing only the entry's *post-activation appearance* to change. It still strictly refuses a nonempty password, exposed editing controls, visitor privilege escalation or navigation, and now reports only the name of any failed Boolean safety invariant (never source text or credentials). A passing focused unit test is not a substitute for the next real-Chrome result.

**Diagnosed with the next run:** The failed Boolean names were `unambiguousSafeEntry` and `entryVisible` **only**, after the standard Enter event; the empty-password, protected-editor, visitor-privilege and route invariants did not trigger. The actual mistake was in the Chrome harness wrapper: it still called the **pre-activation snapshot validator** on the post-Enter observation, before the new lifecycle-aware summarizer could evaluate it. The wrapper now explicitly applies `afterActivation:true` **only for the post-Enter snapshot**, and a focused regression test checks the wiring. No original Admin code or safety requirement was removed. The next complete real-Chrome trial must verify whether the password panel actually opened.

References: https://chromedevtools.github.io/devtools-protocol/tot/Input/ and https://github.com/puppeteer/puppeteer/blob/main/packages/puppeteer-core/src/common/USKeyboardLayout.ts .

This is a real keyboard interaction test in an isolated browser, not a claim of full keyboard accessibility. A button outside the first 80 Tab presses is a **bounded negative observation**, not proof of complete keyboard inaccessibility.

## Release and accessibility questions still open

- Is the original login panel deliberately an **inline panel** or intended as a dialog? Its semantics must be established before suggesting Escape dismissal.
- Does the intended experience require an explicit close button, another press of the Admin entry, clicking outside the panel, or another safe dismissal method? The current trial does not guess or trigger unknown controls.
- Does the full keyboard focus order work from all visitor positions, including Shift+Tab after entry and error or validation messages? A bounded entry test is not a complete keyboard audit.
- Should focus return to the entry button when the panel is closed by its **intended** method? This has not been tested.
- Would any visual or semantic change preserve the original custom Admin features, mobile layout and security? **CosmicCuddle must approve any change.**
- Authenticated editing, form validation, Save/reload, owner-held recovery backup and the 415-versus-418 source layout are **not decided or tested here**.

The test forbids passwords, Enter on any non-vetted control, live requests, login submissions, screenshot capture, GitHub writes, merges and deployment. The source content and original administrator implementation are unchanged.

## Original return action and private keyboard-only exit (Part 11)

**Source-only finding at the exact preserved original `site-content.html` blob `71ab9f2`:** The locked administrator panel has a **Back to Website** button whose original inline handler is `closeAdmin()`. That function hides `adminArea`, shows `publicSite` and `siteFooter`, then calls `showSection(currentSection)`. This is a normal screen transition, **not a claim of logout** and not evidence that the panel is a modal dialog. `closeAdmin()` itself does not clear credentials or reset the `unlocked` state. No credentials should be entered during this investigation.

The earlier real Chrome **Escape** trial left the password panel visible at desktop and mobile widths. That observation is consistent with the site having an explicit return button, but does **not** prove Escape was intentionally excluded; the original design intention still needs owner review.

A new **no-password, protected-branch-only** browser diagnostic checks the original return button at 1440px and 390px. It verifies the exact labelled `closeAdmin()` action is unique, outside all forms, not a submit control, visible and Tab eligible. It starts only after the previous no-login keyboard trial has opened the login screen. The original trial proposed up to 16 real Tab keys followed by Enter on that precisely vetted return button. **This activation path is now suspended** after an unexpected isolated-browser navigation. The current test sends **Tab only**, records whether that exact control receives focus, and never activates either Back to Website or Unlock Admin.

The original *proposed* post-activation checks described the expected public site/footer restoration, hidden admin area, unchanged route, empty password, hidden protected editor, no visitor privilege, no form submission and no nonlocal network response. The current Tab-only check can verify safe focus and visitor isolation, **not restoration or logout**. An unreachable button is recorded as a bounded observation; this **does not** certify full accessibility, secure logout or actual Admin Save. Tests are in `editor/tools/private-admin-return-entry-probe.cjs` and `editor/tests/private-admin-return-browser-probe.test.cjs`.

**No original source, Admin UI, published website, database, credentials, merge or deployment is changed.** Browser outcome must be checked on the exact pushed commit before claiming the keyboard exit has passed. Stage 6/9 and Stage 7 owner approval gates remain open.

## Part 11 follow-up — conservative Tab-only return diagnostic

In isolated Chrome on `c23c074` and `08425c7`, test-only Enter on the Tab-reached original return button produced an **unexpected page transition**. The after-state no longer contained the expected password field, protected editor element or original root pathname. No password was submitted or live website file changed. Because `closeAdmin()` and `showSection()` have no explicit navigation instruction, the transition has **not yet been explained**; do not call this a confirmed website bug, successful exit or logout.

**Safety decision:** The protected browser QA now sends **Tab only**, never Enter, for this specific return-button test. It records whether focus reaches the uniquely vetted non-form `Back to Website` control at 1440px/390px. Even on success, the report says `activationWithheldForSafety: true` and `returnRestoredPublicSite: false`. The actual original return still needs a separately reviewed test. This is an intentionally limited Stage 7 finding, not release approval. The follow-up safety correction also removes Enter from the return-probe key inventory and makes activation **disabled by default**; synthetic positive-close tests must request it explicitly. Neither QA safeguard authorises a real browser Enter.

No changes were made to `site-content.html`, the original administrator JavaScript/CSS, production assets, passwords, GitHub publishing or the server.

## Part 11 source-neutral navigation triage — no button activation

The unexpected return-button navigation remains unexplained. The current browser-only return observer now adds **three Boolean-only diagnostics** before any further experiment: whether the vetted return button is nested inside a link/role-link element; whether an ancestor has an inline click or keyboard handler; and whether the button itself has an inline keyboard handler. It never returns the handler code, link, label, DOM, source text or URL, and it does not dispatch Enter or click. These observations may help narrow hypotheses; they **cannot** establish what caused the earlier navigation. Dynamically registered handlers and browser defaults remain outside this limited probe.

The probe defaults to **activation disabled**; its allowed keyboard inventory contains Tab only. The associated synthetic positive-closure test must opt in explicitly to a fake activated snapshot, which is **not** an instruction for the Chrome harness to activate the original control. If none of these flags explains the transition, retain the fail-closed policy and consider a separate source-only event-path analysis before any further real activation request.

This diagnostic remains Stage 7 pre-acceptance only. No original Admin code, resources, visitor form, credentials, deployment or production writer was changed.

## Part 12 — confirmed isolated-root mismatch (7 November 2026)

**Source-backed explanation, not a public website defect.** The preserved original `site-content.html` blob (`71ab9f2bf4cf12282fcbe135f7ec787805715b62`) has `closeAdmin()`, which calls `showSection(currentSection)`. Its later original `<script id="naxx-multipage-routing-v1">` sets `ROOT = "/Naxxramas-Resource-Hub/"` and wraps `window.showSection` with a path check. Outside that expected root, the wrapper calls `location.assign(routeUrl(section))`. The private Chrome harness currently opens its local `/` path and requires the same `/` route after the button action. Therefore, a return triggered at the synthetic `/` route can navigate to the repository-prefixed route, whereas the published GitHub Pages root does not take that redirect. This is consistent with the owner's successful mouse and focused Tab→Enter manual return.

**Limits:** The source proves the conditional redirect and the test-root mismatch. It does not independently prove whether the earlier missing DOM elements were due to asynchronous loading of the 31 MB page after navigation; that remains a reasonable but unverified timing hypothesis. Do not infer a leaked password, privilege escalation, broken original Admin button, authenticated logout or full accessibility acceptance.

The new `editor/tests/private-admin-return-browser-probe.test.cjs` test reads the preserved source without modifying it and executes only the bounded original routing IIFE in a synthetic, network-free VM with mock `window`, `location` and `document`. It checks that a simulated `showSection('Home')` redirects when at `/`, but stays in the original handler when at `/Naxxramas-Resource-Hub/`. It also verifies that the real browser harness still withholds Return Enter. No real button activation, login, form submit, external browser requests, source export, live Save, merge or production change is authorised or performed.

**Next safe gate:** Review a harness design that faithfully models the repository-prefixed public root, while preserving all existing original-source SHA, password-empty, admin-privilege, no-form, fail-closed URL and external-network safeguards. Do not simply weaken `routeUnchanged` or re-enable the real Chrome Enter test until the revised model and acceptance policy are reviewed.


## Part 12 — proposed canonical-path Chrome acceptance contract (review only)

**Status: design proposal, NOT an authorised real Enter test.** The preserved original site's multipage router expects `/Naxxramas-Resource-Hub/`; the earlier browser harness used `/`. The source-only regression proved this difference matters, but the original 31 MB page's loading state immediately after a redirect was not independently diagnosed. Do not modify `site-content.html`, the published site's route handling or original Admin button to compensate for a test-only mismatch.

### Independent, fail-closed prefixed-route rehearsal

1. Keep the existing synthetic-root, return-Tab-only smoke test unchanged as a regression for its original assumptions. Build a **separate** disposable headless-Chrome scenario that starts at exactly `<127.0.0.1 isolated origin>/Naxxramas-Resource-Hub/` and makes no outbound request. The private HTTP handler must serve this prefixed route from the already verified temporary snapshot, not a different file or a public website.
2. Before opening Admin, require the exact prefixed pathname, empty query, expected document readiness and original source fingerprints. Record only fixed Boolean flags and bounded counts, not the origin URL, DOM text, browser cookies, credentials or resource contents. Any unexpected redirect, fetch, missing element, browser exception or route mismatch **fails closed**.
3. Open the same **visitor-only**, vetted non-form Admin entry using the existing no-login safety procedure. Verify the original password field is visible and empty; `.wh-pro-admin` remains hidden; visitor administrator state remains OFF; zero form submissions and zero nonlocal HTTP responses. Never interact with the Unlock Admin action or authenticate.
4. Run actual **Tab-only** discovery of the uniquely identified original `Back to Website` button at desktop 1440px and mobile 390px, using a bounded key count, with no forced `.focus()`. The return probe should check one **specified exact expected pathname** supplied by the harness, rather than allowing either `/` or the prefixed path indiscriminately. Preserve the strict no-query and no-privilege requirements.
5. When and only when the independent prefixed-route no-activation scenario and all synthetic negative fixtures pass, propose a separate, explicitly reviewed Chrome Enter-activation trial. The current automated return-button **Enter remains disabled**. No owner repeat test is requested. The later activation trial would require uniquely vetted Tab focus before one normal Enter, and would check that the original public site and footer return, original Admin area hides, the **prefixed URL remains unchanged**, password remains empty, no form is submitted and no external response occurs. Any unexpected route transition must stop the test; it cannot be treated as a successful return.
6. After a proposed activation, if the browser loads another document or the original elements temporarily disappear, record the bounded document/route transition as **unresolved**, not as a successful exit or an authentication incident. Do not auto-follow a redirected page to get a passing result, and do not relax the source/route safety assertions merely to clear CI.

### Evidence and release boundaries

- The existing original published mouse and keyboard return both worked in CosmicCuddle's manual checks. Those successful reports should **not** be invalidated by the synthetic-root Chrome mismatch.
- Any new harness code should be confined to protected `editor/` QA scripts/tests and the related documentation, with focused negative tests for wrong route, missing original controls, nonempty password, unexpected admin privilege and failed/nonlocal requests. Run exact-head GitHub Actions before treating it as verified.
- This route correction is **not** approval for a real login, authenticated original Admin editing/Save, choosing resource layout 415 vs 418, GitHub API writes, a permanent recovery backup, PR merge or production deployment. Stage 6 of 9 and Stage 7 are still incomplete.


## Part 12 follow-on — protected canonical-path Tab-only implementation

**New development-only implementation, not yet an accepted Chrome result.** The separate protected Chrome scenario now visits the exact local `/Naxxramas-Resource-Hub/` path (served from the same verified private snapshot) on desktop 1440px and mobile 390px. It checks the original site is loaded, opens only the already vetted **visitor-only** Admin entry without credentials, and performs real **Tab-only** discovery of the unique original Back to Website control. The old synthetic-root `/` trial remains unchanged.

The return observer now has a **two-value, exact expected-path allowlist**: `/` for the existing older synthetic-root test, or `/Naxxramas-Resource-Hub/` for this new independent scenario. Both reject any query string and require empty password, hidden original protected editing controls, visitor privileges OFF, and an unambiguous non-form return control. Arbitrary paths are refused; the Chrome harness also checks no form submissions and no nonlocal HTTP responses. Source-only negative tests cover wrong paths, queries, unexpected privileges, nonempty passwords and accidental return Enter activation.

**Safety boundary:** The new scenario cannot claim the Back to Website Enter action works: its real-browser return key inventory remains **Tab only**, and the summary must report `activationWithheldForSafety: true`. The original published mouse and keyboard return had already passed the owner's manual checks. Automated return Enter, authenticated Save, 415-versus-418 layout, permanent backup, GitHub writer, merge and release are all still separate owner review gates.

**Verification status:** These are source changes on the protected draft PR; do **not** claim the latest exact-head Chrome/CI results passed until the completed workflows are inspected. Original website `index.html`, `site-content.html`, admin UI, assets, 414 resources, live site and server remain untouched.

## Part 12 next review gate — passive Enter preflight only

**Background:** The canonical-prefix Chrome Tab-only rehearsal at desktop 1440px and mobile 390px passed on exact protected head `179f0683b05e70036f8504e715175edf7c69ef9d`. The three workflows completed successfully; the editor suite reported **436 tests passing and zero failures**. This confirms only the existing non-activating scenario, not a return Enter test.

**New code submitted for independent CI verification:** `reviewReturnEnterPreflight()` in the original-return QA probe validates a real bounded Tab-reached original non-form `Back to Website` control with the **exact** `/Naxxramas-Resource-Hub/` pathname, no query, zero form submissions, zero nonlocal HTTP responses, no unexpected main-frame navigations, no ancestor link or competing keyboard handler, empty password, and no visitor admin privilege. The Chrome harness now retains **separate, inspectable** canonical-prefix Tab-only trail and Enter-preflight summaries for both viewport widths, including strict length assertions. Negative tests reject bad inputs and counterfeit approval states.

**Important distinctions:** `safeForSeparateOwnerReview: true` is **not** approval or activation. The preflight performs **no Enter press**, authenticated login, original admin Save, persistent data change, external write or publication. `realReturnEnterDispatched`, `ownerActivationApproved`, `originalAdminSaveTested` and `productionApprovalGranted` are all explicitly **false**. The earlier synthetic-root scenario stays Tab-only. Any future real Chrome Enter trial requires separate owner review and explicit authorization, and must fail if it causes unexpected navigation.

**Safety gates unchanged:** preserve 414 original resources, all custom fields and associations; do not settle the 415-vs-418 resource source tree, change the original protected website, merge, or deploy without CosmicCuddle's approval. The full editor acceptance milestone remains separate. Do not claim these *new* preflight changes passed until the exact latest-head CI completes.
