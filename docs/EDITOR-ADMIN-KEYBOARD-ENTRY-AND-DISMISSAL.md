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
