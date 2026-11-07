# Original administrator feature preservation — owner acceptance matrix

**Prepared 7 November 2026 | Stage 7 preparation running in parallel with Stage 6.**

**No administrator login, credential entry, live editing, saving, publishing or deployment has been authorised or performed.** This document is a testing plan, not a declaration that original administrator behaviour has passed. Keep both candidate source layouts unapproved until CosmicCuddle selects one.

## What is already verified without an administrator login

| Protected aspect | Current evidence | Status |
| --- | --- | --- |
| Original visitor-facing Admin entry | Existing no-login private browser probes detect/open the visible Admin password panel at 1440px and 390px while leaving privileges off | **Private browser check passed** |
| Existing hidden editing control | Structure present; no force-click permitted | **Structure verified only** |
| Password panel label/focus/modal metadata | Read-only browser probe reports booleans for accessible label, focusability, focus on open, dialog and ARIA modal membership | **Diagnostics available; acceptance not granted** |
| All original resource objects | 414 records with unique decoded identifiers and a lexical audit of every property | **Baseline verified** |
| Original class and section associations | 7 original sections, 41 distinct decoded class tokens and 393 class-token occurrences; associations are not flattened | **Baseline verified** |
| Additional custom resource properties | 13,821 property occurrences outside the predefined common resource keys | **Baseline verified** |
| Every unedited resource property during a proposed title/content edit | New `rehearse-admin-metadata-parity.cjs` and `editor/qa/admin-metadata-parity.test.cjs` compare **all 414 original and temporary candidate resource records** at the source-text level; only exact requested title/content string literals may differ, and every other byte is protected | **New private test; requires successful exact-head CI** |
| Other original source data | Original DATA object's 27 direct members and separate 29-item collection are protected by preservation of the SHA-pinned non-resource source shell | **Lexical/byte preservation, not authenticated UI acceptance** |
| Embedded media and original scripts | Existing baseline audit reports 95 image references outside the resources; generated runtime must preserve the complete non-resource shell exactly | **Source preservation; browser interaction still required** |
| Root loader, pages, navigation and external assets | Complete-site snapshot and Git identity checks preserve every unchanged tracked file and protected route | **Private source tests passed** |

The new private metadata test does **not** evaluate original JavaScript or print values, IDs, links, images, administrator data or edited text. It rejects deleted/reordered keys, duplicate or unparseable fields, changed IDs/class associations, changes to unknown custom metadata, extra content modifications and changes to untouched records. Its candidate source tree is deleted after review.

## What still needs genuine administrator acceptance

| Required owner-approved scenario | Exact expected result | Current status |
| --- | --- | --- |
| Open and close login by mouse and keyboard | Entry, focus order, Escape/close, visible focus and accessible labels work on desktop and mobile without granting privileges | **Partly diagnosed; full keyboard acceptance pending** |
| Legitimate login and logout | Correct temporary credentials work in a controlled copy and leave no credential data in reports | **Blocked — owner permission and secure test setup required** |
| Edit an existing resource title | Only the intended title changes; all other fields and 413 other resources are identical | **Offline simulated; original Admin UI unverified** |
| Edit multiline resource content | Line breaks and formatting survive a save/reload, with no unexpected changes | **Offline simulated; original Admin UI unverified** |
| Add, remove and reorder where supported by original UI | All original custom relationships remain valid and rollback recreates exact state | **Blocked — needs scope/behaviour review and owner approval** |
| Edit metadata, categories/classes and custom fields where supported | No original unknown fields, associations or images are removed or flattened | **Baseline protected; original Admin UI unverified** |
| Preserve all original DATA members and side collection | 27 direct members and the separate 29-item collection remain semantically intact after an authenticated edit | **Bytes protected; runtime semantics unverified** |
| Edit navigation or other administrator-managed pages | Routes, custom settings, original scripts and links remain compatible | **Private page-draft tests only** |
| Save/reload, duplicate request and interrupted Save | Existing drafts survive, stale branch updates fail, unclear outcomes never auto-retry | **Private rehearsal only; real Save blocked** |
| Independent backup and rollback | Owner-held backup can be restored twice; full website and locally fetched Git history match originals | **Temporary tests only; durable release backup pending** |
| Full browser/mobile acceptance | Original search, Game Clients, images, admin states and keyboard use work at several viewports | **Partial browser coverage; owner acceptance pending** |
| Final publish/rollback decision | Approved source layout, verified exact-old remote Git ref update, tested restore and explicit CosmicCuddle approval | **Not authorised** |

## Safe sequence for Stage 7

1. Continue collecting **non-login diagnostics** from the isolated, outbound-blocked browser. Findings may identify a label or focus problem, but must not automatically rewrite the original administrator interface.
2. Complete the new full-resource property preservation check and retain only aggregate test results. Any mismatch blocks further source migration.
3. Prepare a **separate disposable website and credential handling plan** for approval. Never request a real password in GitHub issues or commit test credentials.
4. Once CosmicCuddle explicitly approves the isolated acceptance test, exercise authentic original Admin actions with fictional data and save/reload/rollback verification. Do not touch production.
5. Reconcile the results with the 415 versus 418 source-layout decision and the authenticated Save design before considering any controlled merge/release.

## Sources of evidence

Existing: `docs/EDITOR-ADMIN-ACCEPTANCE-GATES.md`, `editor/tools/private-admin-gate-browser-probe.cjs`, `editor/tools/private-admin-surface-browser-probe.cjs`, `editor/tools/audit-resource-schema.cjs`, `editor/tools/check-legacy-roundtrip.cjs`, and `editor/tools/browser-smoke-complete-site.cjs`.

New: `editor/tools/rehearse-admin-metadata-parity.cjs` and `editor/qa/admin-metadata-parity.test.cjs`.

**Do not mark Stage 7 complete because the structural or source-preservation tests pass.** Full, legitimately authenticated Admin acceptance is separate and remains gated by CosmicCuddle.
