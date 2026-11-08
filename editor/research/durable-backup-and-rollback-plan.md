# Resource Hub — Durable Backup and Rollback Acceptance Plan

**Status:** proposed research acceptance plan only. No existing temporary rehearsal is a durable release backup. The original website, Admin, resources, and production files must remain unchanged until CosmicCuddle explicitly approves an implementation and deployment plan.

**Date:** 8 November 2026  
**Owner/approval authority:** CosmicCuddle  
**Current source-layout choice:** open; **415-file overlay** and **418-file full-source** remain unapproved.

## Added research re-checker (not release evidence)

An experimental **read-only existing-bundle inspector** now lives at `editor/tools/inspect-saved-git-bundle.cjs`, with an isolated synthetic Git suite at `editor/tests/inspect-saved-git-bundle.test.cjs`.

- It requires independently supplied **source commit, source tree, tracked-file fingerprint and saved bundle SHA-256**. These values must come from a trusted, separately reviewed record; the saved receipt alone cannot establish their authenticity.
- It reads the existing `.bundle`, `.receipt.json` and `.READ_ME_FIRST.txt` files without modifying them, verifies strict fields and permissions, and checks every recovered Git ref namespace (including `refs/notes`), rejecting **unexpected extra refs**; requires the backup creator's canonical JSON encoding to reject duplicate or ambiguous receipt fields.
- It restores the saved bundle inside a disposable local folder using the existing Git recovery verifier, compares exact tracked source bytes/history, rechecks source and saved artifacts for changes during inspection, then removes only the disposable restore folder.
- **It does not create a backup or independently establish owner retention.** Its result explicitly says `durableOwnerRetentionIndependentlyProven:false`, `externallyAuthenticatedGitHubSource:false`, `canSave:false`, `canPublish:false`. An authenticated remote origin, retained owner-accessible copy, external-service configuration, final storage layout and owner release approval are still separate gates.
- The new **ten positive/negative test cases** are written and syntactically checked. The updated verifier passed **9/9 focused simulated checks**, and a separate real Git CLI trial confirmed extra `refs/notes` entries can be hidden from a branches/tags-only inventory. These are not the full Node/Git recovery suite, which has **not passed CI** on this research branch. They use synthetic Git repositories, not the 31 MB original website; final source-backed acceptance remains blocked.

## 1. Why this is separate from the existing rehearsals

The repository already has meaningful protective experiments:

| Existing code | What it verifies | What it DOES NOT prove |
| --- | --- | --- |
| `editor/tools/audit-full-checkout.cjs` | Clean tracked checkout inventory and protected original `site-content.html` checksum | Saved backup, ignored/untracked files, Git history, external services |
| `editor/tools/rehearse-complete-site-snapshot.cjs` | Exact temporary copy of all tracked website files and changes confined to allowed files | Durable retained copy or production backup |
| `editor/tools/rehearse-browser-zip-full-site-rollback.cjs` | Temporary full tracked-site candidate/rollback simulation | Full history/account backup, permanent recovery point |
| `editor/tools/rehearse-versioned-resource-sessions.cjs` | Temporary 414-resource version/rollback rehearsal | Crash-safe writes, GitHub conditional save or production rollback |
| `editor/tools/review-backup-bound-save-outcome.cjs` | Read-only interpretation of temporary backup evidence and uncertain hypothetical Save responses | Real remote GitHub authentication, approval, durable backup or permission to retry |
| `editor/tools/plan-exact-head-save-guard.cjs` | Hypothetical exact-old-head conditional write contract | Actual server-side conditional GitHub ref update |
| `editor/tools/verify-pinned-local-revision-chain.cjs` (research) | Proposed exact local Git tree/whole-runtime revision integrity | Remote origin authenticity, approved 415-file layout, production Save |

**Protected original baseline:** `site-content.html`, **30,976,969 bytes**, SHA-256
`34455f6d901c538e2491a8c16681692e4c02d918b1984d7d0ba081aacb1049e8`.

Preserve 414 resource records; all other original data and scripts, original Admin behavior, media/assets, the 27 DATA members and separately tracked 29-item collection. A resource-only rollback is **not** an adequate whole-site recovery.

## 2. Minimum durable backup package — proposed, NOT created

Before any approved real Save, an independently verified *retained* owner-controlled recovery point would need:

1. **Exact pinned Git commit and complete reachable history:** a securely stored Git bundle or similarly independently verifiable full-history archive, including required refs and objects. An ordinary ZIP of website files does not include history. Record the repository, reviewed commit, expected refs, bundle checksum and verification procedure; do not copy credentials.
2. **Complete tracked website source:** every file in the protected Git tree, with its exact bytes, paths and modes, `index.html`, `site-content.html`, page/navigation files, scripts, media and selected resource layout. Confirm against a separately recorded, independently computed inventory/fingerprint.
3. **Uncommitted owner work addressed separately:** untracked/ignored work and local drafts are **not** contained in the tracked snapshot. If any exists, stop and require separate owner-directed preservation. Never clean, reset, overwrite or discard it automatically.
4. **External dependencies listed separately:** GitHub settings, branch protections, secrets, DNS/domain/service configuration, third-party integrations and any connected hosting state are not captured by a website Git bundle. Define owner-approved, private recovery procedures for each applicable dependency. Do not publish secrets or inventories of private account settings.
5. **Private retention and access control:** a durable location accessible to the owner after a service outage, an independently retained second copy where feasible, encryption/access restrictions appropriate to the backup, checksums, an explicit retention policy and an owner-approved restore operator.
6. **Independent restore rehearsal:** in a disposable, isolated location, verify archive/bundle integrity, recover the exact reviewed Git tree/history and compare the whole tracked-file fingerprint, original protected site SHA, 414 records, scripts, page assets and Admin source. Record a *pass/fail receipt* without exposing source content.

The backup must **survive the test and release**. A temporary copy deleted after CI proves recovery logic only, not owner backup availability.

## 3. Proposed checkpoint sequence for a future approved Save

| Checkpoint | Must happen | If missing or inconsistent |
| --- | --- | --- |
| **B0 — Freeze source** | Independently identify exact reviewed Git commit and source version; retain local drafts | Stop; do not save |
| **B1 — Make durable backup** | Owner-approved retention, verified full Git history, all tracked files and separate notes for excluded state | Stop; temporary tests are insufficient |
| **B2 — Independent restore** | Recover into an isolated checkout; confirm complete tree and exact original compatibility source; retain proof | Stop; do not use backup as a release gate |
| **B3 — Approve layout** | Owner selects/approves canonical source tree (415 vs 418 or revised alternative) with complete rollback design | Stop; research candidate cannot be deployed |
| **B4 — Review changes** | Verify all 414 resources, protected fields, page/navigation edits, original Admin and media; record conflicts | Stop and keep drafts |
| **B5 — Conditional remote update** | Only after explicit owner approval: independently authenticate GitHub head, require true server-side *exact old ref* condition and forbid force updates | Stop on any mismatch; never fall back to force-push |
| **B6 — Confirm result** | Observe exact authenticated new remote commit, its blobs and reviewed source identity after the request | If uncertain, freeze and investigate; no automatic retry |
| **B7 — Release validation** | Owner reviews browser/Admin behavior, resources, navigation, scripts, and rollback readiness | Do not claim deployment or recovery success from code tests alone |

No current test or research report passes B1–B7 for production.

## 4. What to do when a Save outcome is uncertain

**Default response for any timeout, connection loss, missing remote evidence or failed verification:** stop automatic work, preserve the local draft and backup, and obtain a fresh independent remote observation. A request acknowledgement does not establish that a Save completed.

| Observed state | Safe next decision | Not allowed |
| --- | --- | --- |
| No authenticated remote head available | **HOLD**; manually check remote and preserve everything | Retry, republish, discard draft |
| Remote head still equals reviewed old head | **HOLD**; recheck and investigate whether a request remained in flight | Assume it failed and retry |
| Remote head equals proposed new commit | **VERIFY** exact remote commit, source bytes and all paths; obtain owner acceptance | Assume acknowledgement is complete verification |
| Remote head has moved to another commit | **CONFLICT**; stop and review competing changes and preservation requirements | Force push, auto-merge, reset remote branch |
| Remote head matches but changed source/paths fail verification | **INTEGRITY FAILURE**; quarantine candidate and inspect source/backup | Proceed to publish |
| Verified restored copy differs from recorded backup fingerprint | **BACKUP FAILURE**; stop and preserve all evidence | Claim that rollback is possible |

These are **planning classifications**, not executable steps. Existing `plan-uncertain-save-outcome.cjs` and `review-backup-bound-save-outcome.cjs` already enforce no automatic retries in their fictional tests. Do not duplicate their logic in an independently named writer.

## 5. How rollback would be considered — never automatic

A recovery request must identify the exact failure mode, last independently verified good commit, affected files/services and original owner-approved recovery package.

- **Local draft only:** no remote change; reopen the original local draft without overwriting other work.
- **GitHub source updated but not deployed:** evaluate reverting the specific reviewed change via a *new, reviewed commit*, preserving intervening legitimate commits. Never blind-reset or force-push a shared ref.
- **Deployed website wrong or broken:** separately plan an owner-approved website rollback of the exact complete source and assets; separately check whether new independent page content or player/user data arose after backup. Restore only what is within the approved scope.
- **GitHub/service outage or lost access:** use independently retained history and complete tracked website recovery point in a new isolated repository/checkout, with account/service recovery handled through provider procedures.
- **Partial restore, conflict, stale backup or unknown post-backup data:** stop and require manual resolution. Never claim success based on restored resource fragments alone.

**Never alter the live repository or service state from a test runner.** No automation should perform Git ref mutation, deploy, delete a backup, roll back the original Admin or purge later user changes without explicit approval.

## 6. Acceptance trials to write and execute before approval

| Trial | Expected result |
| --- | --- |
| Exact reviewed whole tracked tree and history restored twice from separately retained backup | Every tracked byte, mode, and required commit/ref matches a verified receipt |
| Broken bundle or incomplete history | Failed recovery; no release authorization |
| Single modified resource, protected field, page, inline media or loader after recovery | Full-site fingerprint mismatch blocks acceptance |
| Missing file / extra unapproved file / symlink / nonportable path | Fail closed |
| Missing ignored/untracked work or external setting with unclear recovery ownership | Incomplete backup; release blocked |
| Backup proof has wrong reviewed commit | Refuse, even when the website SHA seems correct |
| Remote timeout, acknowledged response, and no independent head | Hold; never automatic retry |
| Remote branch advanced by another editor | Conflict; no force update |
| New candidate observed but source bytes differ | Quarantine; no publication |
| Candidate source verified, but original Admin/keyboard behavior untested | Acceptance blocked pending owner |
| Recovery rehearsal ends | Temporary test copies deleted; durable owner-held backup retained separately |

## 7. Evidence ledger (no secrets)

A future approved recovery receipt should record **only** commit IDs, expected/recovered SHA-256 digests, tracked file counts, secure backup identifier (not access URL or credentials), test status, scope exclusions, owner approval reference and timestamps. Avoid printing file contents, passwords, tokens or private account configuration.

Mark each claim **confirmed**, **proposed**, **unverified** or **blocked**. Treat any receipt from a fictional/temporary rehearsal as **unverified production evidence**.

## 8. Owner decision points (not requested yet)

1. Approve the canonical source layout after the two candidates and preservation differences are fully compared.
2. Choose an appropriate durable backup destination, retention policy and separate copy strategy; review protected access and external-service scope.
3. Approve the final genuine Save, release, rollback and recovery workflow **only after** independently witnessed full tests.

**No release or backup-creation authorization is implied by this plan.**
