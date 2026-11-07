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

This is a real keyboard interaction test in an isolated browser, not a claim of full keyboard accessibility. A button outside the first 80 Tab presses is a **bounded negative observation**, not proof of complete keyboard inaccessibility.

## Release and accessibility questions still open

- Is the original login panel deliberately an **inline panel** or intended as a dialog? Its semantics must be established before suggesting Escape dismissal.
- Does the intended experience require an explicit close button, another press of the Admin entry, clicking outside the panel, or another safe dismissal method? The current trial does not guess or trigger unknown controls.
- Does the full keyboard focus order work from all visitor positions, including Shift+Tab after entry and error or validation messages? A bounded entry test is not a complete keyboard audit.
- Should focus return to the entry button when the panel is closed by its **intended** method? This has not been tested.
- Would any visual or semantic change preserve the original custom Admin features, mobile layout and security? **CosmicCuddle must approve any change.**
- Authenticated editing, form validation, Save/reload, owner-held recovery backup and the 415-versus-418 source layout are **not decided or tested here**.

The test forbids passwords, Enter on any non-vetted control, live requests, login submissions, screenshot capture, GitHub writes, merges and deployment. The source content and original administrator implementation are unchanged.
