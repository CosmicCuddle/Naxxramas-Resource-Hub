# Website editor — milestone 6 dry-run GitHub changeset review

**Status: TEST-ONLY RESEARCH. Not approved for real saving, merge or publication.** This file records progress in [draft PR #56](https://github.com/CosmicCuddle/Naxxramas-Resource-Hub/pull/56). It does not create a source tree or deploy anything.

## Where it fits in the release plan

For communication with CosmicCuddle, the working editor-release roadmap is described as **nine estimated milestones**. This is a *planning framework*, **not** a GitHub Actions percentage or a guarantee of development time:

| Working milestone | Status | What completion means |
| --- | --- | --- |
| 1. Inventory original website | Baseline complete | Preserve original 30,976,969-byte website and 414 resources, including custom fields, data and embedded images |
| 2. Separate editable page/resource drafts | Prototype complete | Page/navigation v3 and resource v2 drafts exist without rewriting the live website |
| 3. Establish non-destructive protection checks | Baseline complete | Source hashes, no accidental root loader rewrite, custom/admin preservation gates |
| 4. Reconstruct separate resources | Private proof complete | Exact original rebuilt from 414 resource records and unchanged non-resource shell |
| 5. Verify versioned edits, conflicts and physical files | Private proof complete | Two-session revision tests, stale refusal, 414 physical-file SHA checks and private-browser examples |
| **6. Create safe GitHub-ready Save/Restore** | **IN PROGRESS** | Approve the canonical source layout, actual editor integration, real repository update package, complete source verification and repeatable durable saves |
| 7. Verify original administrator editing | Not yet accepted | Real admin work in disposable copy, all original custom features and fields protected |
| 8. Visual, keyboard, and complete-site acceptance | Partial automated checks | Owner-approved visual comparison, full browser interaction, source compatibility |
| 9. Backup, rollback, release | Owner gated | Independently retained/restored full backup, rollback plan, owner approval, controlled merge/deploy and verification |

The five completed milestones refer to **research and prototype gates**, not completed production migration. The final four may require more engineering work than the first five. This roadmap is an explanatory stage estimate, not a previously approved official schedule.

## Current milestone 6 deliverable: read-only file-change receipt

`node editor/tools/plan-private-github-source-review.cjs` runs solely against a **disposable OS-private** 415-file resource overlay and the **verified original website shell**. It is a **dry-run**, not an exporter.

Before calculating a change list, it validates the entire currently selected 414-file resource set, current manifest and complete reconstructed website, and refuses stale or malformed versioned drafts. It uses the existing safe title/content editor functions to calculate the proposed result **in memory**, with no writes.

A review receipt identifies:

- The **current and proposed revision numbers** and complete-site SHA-256 fingerprints.
- The **exact proposed relative paths** for affected resource fragments, the single resource manifest and `site-content.html`. Only the specifically edited resources are included; 413 unedited resources in a one-record example do not appear.
- **Before/after byte sizes and SHA-256 hashes** for these proposed files. The old manifest digest uses its **actual validated file bytes**, not a guessed serialization.
- The confirmed **414 physically checked resource files**, plus the count of unchanged fragments, and explicit flags indicating that the file layout, trusted Git commit, owner approval, backup, production release and real administrator workflow are **not** verified.

A draft editing one resource yields **three proposed GitHub paths**: one resource fragment, one manifest and the generated compatibility file. Two edited resources yield **four proposed paths**. The complete 31 MB runtime file is generated in memory to compute the expected checksum; **it is not exported or committed**. No original source values, changed titles/content, IDs, private images, individual collection data or generated HTML bytes appear in the receipt.

A second-session test first proposes revision 1, then writes only to the private disposable simulation, refuses the stale revision-0 draft and successfully proposes revision 2. This proves *review planning logic*, **not** real concurrency control or a working installed editor Save button.

## New milestone 6 safety proof — local Git commit and file-blob preconditions

The draft branch now contains `editor/tools/rehearse-local-git-head-preflight.cjs` and `editor/tests/local-git-head-preflight.test.cjs`. This is a **test-only, read-only local Git review guard**, not an application, migration, exporter or GitHub push tool.

It requires a **specific branch name and independently reviewed commit SHA**. With no network access and no modifications to the repository being inspected, it checks:

- The exact `refs/heads/<branch>` points to the expected commit, not just an ambiguous `HEAD` or cached `FETCH_HEAD`. A different commit is rejected **even if only unrelated files changed**.
- Every proposed resource fragment, manifest and runtime path already exists at that commit as an ordinary tracked file, never a Git symlink, missing file, or executable blob.
- The **actual committed Git blob bytes** have the expected size and SHA-256 from the previously physically verified dry-run receipt. Local uncommitted working-tree edits cannot substitute for committed data.
- The branch ref is re-read after inspecting all affected blobs; if it moves during the check, the review fails. An old manifest's formatting is already accounted for in the dry-run receipt's actual old-blob digest.
- The receipt is marked **review only**, has one manifest and one generated runtime path, contains only expected resource paths, has no duplicate paths, and explicitly prohibits `canApply`, `canPush`, `canMerge` and `canPublish`.

A synthetic standalone demonstration creates a **throwaway local Git repository**, verifies its initial commit, advances an unrelated commit, refuses the old reviewed head, then permits only a new *explicitly pinned* commit to be reviewed again. One integration test additionally stages the **actual 414-record disposable resource overlay and original runtime** into another **temporary Git repository**, and verifies the exact proposed three-path receipt against its real tracked blobs. Both repositories are deleted after testing. Neither test creates or updates a branch on GitHub.

The CI workflow also executes `node editor/tools/rehearse-local-git-head-preflight.cjs --ci-checkout`. After running the synthetic branch tests, it checks that Git's **actual checked-out `HEAD` equals the workflow's supplied `GITHUB_SHA`**, and independently reads the tracked `site-content.html` Git blob to confirm its **30,976,969-byte size and original SHA-256**. This gives a concrete read-only check of the code and protected source actually tested by Actions, even when a pull-request checkout uses a detached merge commit. It is **not** verification that the live remote branch head is still unchanged.

**Critical difference:** This is a **local snapshot/commit precondition only**. It does **not** authenticate the user's intent, query or lock the remote GitHub branch, make a compare-and-swap atomic push, approve `content/resource-overlays/`, or prove that nobody will push between checking and publishing. A real saving system needs authenticated fresh remote-head comparison and an atomic/ref-safe update strategy alongside owner review and rollback. In the current Resource Hub source repository, the experimental 415 source files have **not been adopted**, so this preflight would **reject** a purported current GitHub changeset that expects those files to already exist. It must not be used to bypass that decision.

This guard is read-only for any inspected existing Git checkout. Git writes performed by the demonstration occur **solely inside OS-private synthetic or disposable test repositories**, never in the website's tracked checkout or `main`.

## Authenticated read-only GitHub remote branch snapshot (prototype)

New `editor/tools/rehearse-remote-github-head-preflight.cjs` and `editor/tests/remote-github-head-preflight.test.cjs` implement the next **safety rehearsal**, separate from all working Save/Restore controls.

GitHub's [Get a reference REST endpoint](https://docs.github.com/en/rest/git/refs?apiVersion=2022-11-28#get-a-reference) supports a **GET** for the exact `heads/<branch>` Git ref with **Contents: read** permission. It returns a commit ID. The development CI workflow uses its built-in, short-lived **read-only** `github.token` for exact-branch **push events** and for **same-repository PR #56** only. It performs no `POST`, `PATCH`, `PUT`, `DELETE` or remote Git write. For a pull request, GitHub Actions normally checks out a **synthetic test merge commit** (the workflow's `GITHUB_SHA`), which is NOT the feature branch head. The check correctly compares GitHub's remote branch ref with the PR event's explicit `pull_request.head.sha`, while independently verifying the checked-out **test merge commit** and its original protected website blob. Those two checks are deliberately **not conflated**: the test merge commit is **not proven identical to the remote branch head**, and the remote branch's full contents are **not independently authenticated** by this two-GET observation. Forks, unexpected PR numbers or branches are refused.

For each permitted verification:

1. Check the expected repository, branch and commit against exact allowlisted identity rules (no generic URL or arbitrary remote host).
2. Read GitHub's live branch ref with one authenticated HTTPS GET to `api.github.com`. If the branch is different, the check fails immediately.
3. Independently verify the current local Git checkout's exact `GITHUB_SHA` and unchanged protected original `site-content.html` blob.
4. Read the remote branch ref **again** and refuse it if the branch moved while verifying.
5. Output only a non-secret status receipt. The workflow token, raw API bodies, resource source content and private website values are never printed.

Both remote reads must have the exact expected commit SHA and ref name. Invalid/unavailable responses, wrong object types, unexpected commits, missing permissions and network errors **fail closed**. Unit tests use injected **fictional responses** to prove matching, remote changes before/between reads, wrong ref names, missing local proof, malformed commit metadata and non-disclosure. The independent CI source/ZIP/browser/backup checks remain in place.

**This does not lock GitHub and does not make a save safe by itself.** The branch can move *after* the second GET, before any later write. GitHub write operations must use an approved, expected-head conditional update/lease and ensure the proposed commit's parent is the exact source revision. The `update_ref` connector offers an `expected_sha` precondition, but **no such action has been called or authorised**. The current editor has no remote upload, no canonical source tree and no actual publication pipeline.

An older GitHub Actions run may fail this safety gate if a newer push arrives before the older run's remote-read step. That is correct stale-run refusal, not proof of an application defect; always verify the **exact latest head** before final acceptance. CI uses `permissions: contents: read`, and never needs owner credentials or extra manual tokens.

## Conditional remote-branch update — entirely simulated (no writes)

The next milestone-6 safety rehearsal is `editor/tools/rehearse-conditional-github-lease.cjs` with `editor/tests/conditional-github-lease.test.cjs`. Its deliberately fictional, private branch stores only fake commit IDs, 414 synthetic fragment SHA-256 fingerprints, and a synthetic manifest and runtime descriptor **in memory**. It never constructs a production commit or performs a network call, GitHub write, file write or deployment.

**The problem it models:** even after two successful authenticated remote branch reads, another editor session could change the branch **between the second read and the actual update**. A "read it twice" policy alone cannot protect a Save action.

The test first validates the same strict **review-only change receipt** path constraints as the existing source planner (edited resource fragments, manifest, generated runtime, before/after file hashes, and a one-step resource revision). It creates a fictional proposed commit with the expected branch commit as its **parent**. A private in-memory `tryConditionalAdvance` then simulates the essential server-side comparison: the branch must **still point to exactly that expected commit** at the update boundary; the candidate must have the expected parent, unchanged-file protections, one-step revision, exact permitted paths and hashes.

The simulation exercises:

- One valid fictional save, preserving every unrelated resource.
- A second editor session's stale draft on a **different** resource, which is refused after the first save.
- A branch change **after both remote observations** but immediately before the conditional attempt, which must be refused.
- Two sessions attempting the same expected branch head at once: **only one can succeed** in the fictional memory store.
- Forged parent, missing/extra path, altered file hash, wrong revision, invalid candidate commit ID and a receipt that falsely grants apply permission. All are refused without altering the fake branch.

The generated report shows only aggregate outcomes: `everyWriteWasInMemory:true`, `realGitHubWrites:0`, `realCASVerified:false`, `canPush:false`, `canPublish:false`. A fictional "accepted-in-memory-only" verdict **never** authorises real Save or GitHub modification. Its pseudo commit IDs **are not Git commit objects** and its stub source descriptors do not prove the 31 MB HTML or owner approval. Independent original-source reconstruction stays in its separate previous CI tests.

**Production gate:** Do not implement or invoke GitHub `update_ref`, pushes, source commits or any upload based on this simulation. A real workflow still needs an owner-approved canonical source layout, a complete verified source package, a separately retained/restore-tested backup, authenticated up-to-the-moment remote authorization, a documented conditional GitHub update mechanism, proof of its server-enforced expected-head behavior, race and rollback tests on an approved disposable branch, and explicit CosmicCuddle consent before changing working Save buttons or any published data.

## Full-byte reviewed file package — disposable proof only

The protected branch now contains `editor/tools/rehearse-reviewed-source-package.cjs` and `editor/tests/reviewed-source-package.test.cjs`. This advances milestone 6 beyond a **checksum-only GitHub change-review receipt**: the independent private rehearsal constructs the **exact proposed file bytes** for a reviewed resource edit and verifies them before deleting them.

This prototype accepts only an existing **physically verified 414-resource source snapshot** and its version-bound experimental draft. It first reruns the whole-source checksum review, rebuilds the complete runtime HTML in memory from the known original shell and the proposed resources, and refuses any stale or malformed draft or changed review receipt.

Inside an automatically created **OS-private temporary directory**, it stages:

- Only the changed resource fragment(s): a one-resource edit contributes **one** individual file rather than 414 copies.
- A revised, complete 414-entry resource manifest that identifies the next revision and every resource checksum.
- The **complete rebuilt `site-content.html`** with the custom non-resource shell, embedded media, scripts, independent side collection and unchanged resources preserved.

For one resource change, this yields **three staged files** (fragment, manifest, complete website), and for two changes, **four staged files**. The user-facing website and GitHub repository files are not overwritten. The temporary complete HTML is intentionally transient; it is not a release bundle, public export, installed source tree or separately retained backup.

The verifier independently regenerates those files from the physical source and draft, lists all candidate paths, rejects missing/extra files, symlinks and path traversal, and compares **actual staged bytes, byte counts and SHA-256 values** with the previous reviewed file-change receipt. Corrupted source bytes and outdated draft versions fail before any release action. The test checks that an obsolete session cannot create a package after another session has edited the private source.

The returned receipt contains **aggregate counts and status only**; no actual resource text, credentials, embedded images or 31 MB generated HTML are logged or published. The temporary package is automatically deleted after each rehearsal, even when a verification fails. Only this isolated test tool writes to its own system temporary directory; it has **no GitHub API, write permission, push or merge path**. The approved live editor's Save/Load buttons, source format and administrator functions are unchanged.

**Remaining production blockers:** This package is deliberately not GitHub-ready: no approved canonical source layout, no full legacy page/admin edits, no direct browser output, no retained immutable artifact with integrity signature and trusted commit anchor, no verified remote write lease, no independent backup restored, no production release builder, and no owner approval. Do not reclassify this temporary proof as a working Save/Restore feature or make a live change on its basis.

## Owner-facing proposed Save/Restore review — protected screen prototype

The draft branch now includes `editor/save-review-preview.html`, `editor/save-review-core.js`, `editor/save-review-examples.js` and `editor/save-review.js`. The page is **independent of `editor/index.html`**, the live website and all working Save/Load controls. It is a **read-only interaction prototype**, not a real Save or Restore system.

The owner can click three clearly labelled **fictional examples**: (a) a proposal based on the current version, (b) an **outdated** proposal, and (c) a resource whose expected fingerprint no longer matches. These examples require no file uploads or editor installation and contain no original resource text.

For advanced private tests the owner may **locally select two JSON files**: an experimental 414-entry version manifest and an existing checksum-only `naxx-private-github-changeset-review-v1` receipt generated by the test-only Node.js source planner. Neither JSON document is a production source-of-truth. The page strictly checks the complete expected schema (including `approved:false`, no Git writes, no source bytes, 414 resource count, one manifest and one generated HTML path, exact valid changed-fragment paths, old/new checksums and byte lengths). It compares the receipt's **current revision, original whole-source digest, source size and each edited resource's old digest** against the selected manifest.

For a matching review, it displays a **human-readable proposed file list** (e.g. `Resource 0001`, `Resource version manifest`, `Generated complete website`), relative GitHub candidate paths, before/after byte sizes, number of edited/unchanged resources and the proposed revision. It does **not** display resource titles/content, original source values, generated HTML bytes or individual checksums. Stale receipts, changed resource fingerprints, invalid formats, unexpected paths and malformed or oversized files are clearly refused. A **Clear** button resets selected files and the screen; it does **not** delete or alter any saved draft on disk.

The interface always shows a reminder to **keep the original draft**, reopen the latest source and review conflicting edits rather than overwriting automatically. It has no buttons capable of saving, merging, uploading, restoring, publishing or deleting. Strict Content Security Policy blocks network connections, forms and framing; browser tests use fictional local File objects at desktop/mobile widths.

**Security and verification boundary:** This is **receipt metadata review only**. Both JSON documents are untrusted and could be forged together; a matching result is **not proof** that real source fragments, any GitHub branch, an approved package or a backup was checked. The independent 414-file SHA and full 31MB website reconstruction tests exist separately and remain mandatory. The original resource-v2 and page/navigation-v3 drafts do **not** automatically migrate or load in this page. No production source layout has been adopted.

This screen is an accessibility/decision-flow milestone within stage 6; it does **not** complete stage 6. A real Save/Restore action requires source-of-truth approval, full data and admin coverage, a trusted Git update boundary, retained-and-restored backup, owner acceptance and explicit permission to connect real controls.

## Existing saved drafts — non-destructive compatibility bridge (private rehearsal)

New `editor/tools/rehearse-legacy-draft-bridge.cjs` and `editor/tests/legacy-draft-bridge.test.cjs` address the **existing** drafts produced by the current local editor. They do **not** connect new Save/Load controls, replace original JSON files or adopt a canonical source layout.

The old resource formats are `naxx-local-resource-title-draft-v1` (title-only) and `naxx-local-resource-draft-v2` (titles and multiline plain-text content). They are pinned to the exact original **30,976,969-byte** `site-content.html` and SHA-256 `34455f6d901c538e2491a8c16681692e4c02d918b1984d7d0ba081aacb1049e8`. The new test-only source format is `naxx-private-versioned-resource-draft-v1`, bound instead to a specific verified resource revision and source SHA.

The bridge uses the **existing resource editor's original parser and strict draft validator**. It additionally verifies all 414 stored source fragments, their manifest and the reconstructed original website before calculating any new proposal. If and **only if** the resource source is still **original revision 0**, it creates a new versioned resource draft and before/after file-change receipt **in memory**, leaving the legacy JSON bytes and their checksum untouched. It also compares the resulting complete website output with the original independent v2 resource planner, to prove no resource content has changed in translation. Original custom resource fields and all unrelated content stay protected.

| Legacy draft condition | Protected behaviour |
| --- | --- |
| Valid resource-v2 title and content, source revision 0 | Produce a **review-only** versioned resource draft + checksum-only proposed file list |
| Valid title-only-v1, source revision 0 | Preserve title-only behaviour; do not invent content edits |
| Empty resource draft, source revision 0 | Record **no resource edits**; do not invent a commit or source package |
| Source already advanced to revision 1+ | **Refuse automatic conversion/rebase**, even if the new change was to a different resource; retain the old JSON for manual review |
| Invalid JSON, original baseline, duplicate/unsafe or unchanged edits, or damaged physical resource | Fail closed without new source or repository writes |
| `naxx-local-draft-v3` page and navigation draft | **Keep completely separate** from the 414-resource overlay; review the five original page/navigation files with their existing source-hash-pinned read-only planner |

A v3 page review returns only a list of the affected **four permitted page files and/or navigation JSON**, their fingerprints and changed-field counts. It does **not** merge page changes into a resource draft or assume administrator functionality has been migrated. This is especially important because the existing website contains independent custom scripts, media, and original administrator functionality that cannot yet be fully managed by the new editor.

**No automatic import, conversion or deletion is enabled in the browser.** The original user files remain the authoritative personal draft backups. The prototype has no GitHub APIs, file writer, ZIP export or release path. Its tests only use disposable source folders and the real page files **read-only**. A real future migration will require an owner-reviewed interface, explicit consent, original-file backup preservation, approved source-of-truth layout and full source/admin acceptance before any edits leave draft mode.

## Mixed page/navigation and resource source-layout reconciliation (research only)

The previous work contained **two separately verified but mutually incompatible candidate resource layouts**: the older **418-file** `content/legacy/` tree with a copied ~30 MB shell, and the newer version-aware **415-file** `content/resource-overlays/` layout with only 414 fragments and a manifest. The four existing page source files, `content/navigation.json` and original `site-content.html` are already tracked and must be preserved independently of either proposed overlay.

The new `editor/tools/reconcile-mixed-source-layouts.cjs` is a **read-only reconciliation gate** using the existing mixed-plan and original draft bridge. Given an exact clean Git checkout commit and the original resource-v2 plus page/navigation-v3 drafts, it verifies that: both candidate resource layouts independently reconstruct **the exact same complete HTML SHA**; every changed resource's old and new fragment SHA agrees; the existing page/navigation edits agree with their five-file hash-pinned planner; and all candidate paths are disjoint, fixed and clearly labelled **already tracked** or **unadopted**. No source text or generated output bytes are printed or staged. The fictional example proposes **two page/navigation paths, two resource paths, one manifest path and one compatibility runtime path**. The reported `canApply`, `canMerge`, `canPublish` and `sourceLayoutApproved` are always **false**.

This is **not** a new migration or second Save implementation. The final GitHub source layout remains the owner's decision; the 418-file legacy candidate remains for independent reconstruction/rollback evidence, and the smaller 415-file versioned overlay remains the research preference, **not** an adopted source tree. The checkout's *local* commit pin is not a remote atomic update. No browser Save controls, source files, GitHub refs or deployed content are changed.

## Approval and production-blocking dependencies

A checksum-only receipt is not automatically "GitHub-ready" and carries **no file bytes**. It is also not authenticated by a verified Git commit or approved as a durable source-of-truth format. The tested `content/resource-overlays/` path is a **candidate**, not an accepted repository layout.

**Before a real release**, milestone 6 still requires:

1. CosmicCuddle's explicit choice and approval of a canonical source layout and which files the editor should produce.
2. Safe version transition from existing resource v2/page v3 drafts to an approved manifest and reviewable changeset, with no silent conflicts, loss of old drafts or extra manual typing.
3. Exact branch-head commit checks, atomic staging, safe cross-process conflict refusal, retained source content and a release builder that outputs the complete compatible site under review.
4. Correct GitHub branch/PR checks with clear approval boundaries, and independent testing of generated output against custom admin behaviour, source data, media, accessibility and visual acceptance.
5. Separately retained and **restored** full repository/assets backup, simple rollback and final owner release approval.

Do not merge, deploy, modify public `site-content.html`, replace original `index.html`, or treat this proof as a finished export. All temporary test source files are deleted after rehearsal.

## Source references

- The [source-storage decision](EDITOR-SOURCE-STORAGE-DECISION.md) compares 418-file duplicate-tree, 415-file overlay and build-only publication candidates.
- The [Save/Restore preflight report](EDITOR-RESTORE-UX-PREVIEW.md) explains the difference between browser metadata checks, physical fragment checks and the separate complete-source verification.
- GitHub workflow `Naxxramas editor prototype checks` runs the private change receipt after the source integrity test; its exact-head outcome must be checked before describing this milestone as verified.

## Combined page/navigation + resource review screen — protected preview (6 November 2026)

`editor/unified-review-preview.html` adds a **standalone read-only** screen for the validated `naxx-private-unified-source-layout-review-v1` receipt produced by the independent `reviewCombined()` rehearsal. The normal browser editor **does not generate** this receipt and current resource-v2/page-navigation-v3 draft files are **not imported** here. Two source-layout candidates remain unapproved.

A fictional six-path example distinguishes two already-tracked page/navigation files, two **candidate-only** resource fragments, one **candidate-only** manifest, and the existing tracked complete `site-content.html` runtime. The browser accepts an optional local JSON receipt of at most 256 KiB; strict structure checks restrict every path/domain, source checksum shape, exact path inventory, resource counts, 418/415 candidate layout measurements, denied permissions, and read-only flags. File paths use DOM text nodes and the screen has a no-network CSP. Unsafe/duplicated paths, injected markup, mismatched full-site digest, old draft formats and claims of permission to save/merge/publish fail closed.

**Limit:** Even a format-valid receipt is untrusted metadata. The screen cannot verify a real source file, GitHub branch, independent backup, edited HTML, custom administrator functions, source revision, or owner approval. It does not render private resource values. Its **Dismiss proposal** button hides the current view without deleting selected JSON or other saved files; re-review is possible. New Node and isolated Chrome checks exercise the page at desktop/mobile widths. No actual Save/Restore integration or resource-tree adoption is implied.

Milestone 6 remains **IN PROGRESS** and draft PR #56 remains **unmerged/undeployed**. Source-layout choice, independently retained and restored backup, exact remote conditional update on an approved disposable branch, original administrator feature parity, real visual/accessibility sign-off and explicit owner permission remain blocking.
