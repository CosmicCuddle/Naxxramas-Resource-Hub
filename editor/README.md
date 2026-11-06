# Naxxramas local website editor — development prototype

**Status: DRAFT. Not approved for merge or publication.**

**Compare both unapproved source layouts using the SAME saved browser ZIP (read-only):** `editor/tools/review-browser-zip-layout-choices.cjs` feeds the browser ZIP and exact clean checkout into the independent 418-file and 415-file candidate checks. It verifies matching page/navigation SHA-256, edited resource indices/bytes, and full compatibility HTML SHA-256 before reporting a metadata-only owner decision brief. Requires *both* page and resource drafts to compare the two-domain change; no migration, actual GitHub writes, selected canonical layout or deployment. See [layout decision evidence](../docs/EDITOR-BROWSER-ZIP-LAYOUT-DECISION-EVIDENCE.md).

**Review an actual saved combined editor ZIP against a clean Git checkout (read-only development command):** `editor/tools/review-private-combined-zip.cjs` now takes the browser editor's existing private review ZIP, checks ZIP structure and draft hashes with the same validators used by the editor, and feeds the page/resource drafts to the existing mixed source planner. It requires an independently supplied exact Git commit and checks clean repository content before and after. The result only contains paths and SHA-256 metadata; it does **not** create GitHub-ready files, approve either 415/418 resource layout, authenticate draft authorship, overwrite source, save or publish anything. See [the saved-ZIP source-review bridge](../docs/EDITOR-BROWSER-ZIP-TO-SOURCE-PLAN.md).

**Directly restore local drafts from a reviewed ZIP (development editor):** After a combined ZIP passes strict path, ZIP/STORE header, CRC and SHA-256 checks, the development editor offers **Restore Page Draft in Editor** and **Restore Resource Draft in Editor**. Each action calls the matching existing source-checked editor loader; **loading matching source files first is mandatory**. Both loaders validate incoming edits completely before replacing in-memory data, ask before discarding existing unfinished edits, and keep those edits if cancelled or if the source check fails. Individual **Download Page Draft / Download Resource Draft** remain as fallbacks. No action opens the original administrator session, writes a website source file, contacts GitHub, commits, deploys or creates a complete backup. See [private combined review ZIP recovery](../docs/EDITOR-REVIEW-ZIP-RECOVERY.md).

**Unknown Save result recovery (private, no real GitHub writes):** `editor/tools/plan-uncertain-save-outcome.cjs` now classifies what a future editor should do if a hypothetical GitHub Save returns a timeout, loses its connection or receives an untrusted acknowledgement. An old, conflicting, unseen, or apparently matching branch head **never permits automatic retry**; the original draft is retained for independent review. Even a matching fictional file/hash receipt does not authenticate the remote result or approve publication. The tests run before heavier browser checks. See [exact-head Save safety](../docs/EDITOR-EXACT-HEAD-SAVE-GUARD.md).

**Exact old GitHub head requirement (private rehearsal):** `editor/tools/plan-exact-head-save-guard.cjs` and its tests now distinguish two read-only branch observations from a server-enforced expected-old-head update. The model binds the reviewed Git commit separately, refuses stale fictional changes even if a future proposed commit could be fast-forward, and records the need for GitHub's documented GraphQL `updateRefs` with `beforeOid`. The module has no network or source writes; it does not make the current Save button work and grants no publish permission. See the [exact-head safety and release requirements](../docs/EDITOR-EXACT-HEAD-SAVE-GUARD.md).

**JSON size safety (protected review previews):** Both standalone change-review screens enforce their 256 KiB limits using **actual UTF-8 bytes**, not JavaScript character counts. The browser tests reject oversized multibyte filenames/receipts while keeping review-only status. This does not validate the real source, authorise a GitHub update, or replace the current browser editor's draft formats.

**Restricted password-gate interaction (disposable Chrome only):** The no-login QA probe now permits one click on a **single visible, short Admin-labelled button** with a built-in click handler, only if it is outside every form, has **no associated external form**, is **not explicitly** declared as a submit button and contains no destructive-action terms. An untyped HTML button can default to `type=submit`; the probe accepts it only when neither a surrounding nor externally associated form exists. It never force-clicks hidden editing controls. After the click it checks whether the original password field becomes visible and whether admin privileges remain off, no credentials were entered, and the site did not navigate. This does not test authentication or editing, alter live files, or authorise publication.

**Visible candidate classification (private diagnostic):** The administrator inventory now reports only yes/no metadata about the single visible admin-related button (whether the label contains a generic category such as admin, login, or manage, its placement, and whether it is a form-submit control). It never publishes the actual button label, password, selectors, or website source. These observations do not authorise clicking or grant admin acceptance.

**Read-only administrator surface inventory:** `editor/tools/private-admin-surface-browser-probe.cjs` now records only counts and booleans on the discarded complete-site browser copy: whether the original password field sits in a visible container/form/dialog; whether the legacy editing control is hidden; and how many visible/hidden controls have generic admin/login/editor labels. It also counts inline scripts referring to the original DOM markers without logging source code or individual labels. This is *diagnostic evidence only*, not a discovered login mechanism, authenticated administrator test or permission to edit the live website.

**Original Admin password entry — confirmed, not authenticated editing:** At protected commit `9f86f775`, the isolated local Chrome check proved that the original visitor Admin entry opens its empty password panel on both 1440px desktop and 390px mobile, without submitting anything or granting privileges. The private browser regression now explicitly **requires** both password gates to open. The original editor-only button stays hidden from visitors. Password accessibility (programmatic label, keyboard focus, dialog semantics) is checked separately as boolean-only diagnostic evidence. None of this verifies an actual administrator login, edit, Save/Restore or release. See [administrator acceptance gates](../docs/EDITOR-ADMIN-ACCEPTANCE-GATES.md).

**Combined page/resource review screen (private, read only):** Open `editor/unified-review-preview.html` in a disposable draft checkout. It explains separate existing page/navigation paths and unapproved candidate resource paths, with fictional examples or a manually selected `naxx-private-unified-source-layout-review-v1` JSON receipt from the private reconciliation tool. It rejects unsafe/duplicate paths, invalid receipt schemas and forged release permissions; a matching metadata receipt is **not source authentication or permission to save**. This screen cannot overwrite, upload, convert existing v2/v3 drafts, merge or publish. A dismissed preview keeps selected files intact. The current editor's Save/Load controls are unchanged.

**Multi-domain read-only review:** `editor/tools/reconcile-mixed-source-layouts.cjs` checks that a legacy resource-v2 draft and separate page/navigation-v3 draft agree across the old **418-file** and newer **415-file** candidate resource layouts, while preserving the existing tracked page files and runtime. Both resource layouts remain unapproved; this tool cannot Save, upload, commit or publish. See the [source-layout decision record](../docs/EDITOR-SOURCE-STORAGE-DECISION.md).

**Existing draft compatibility (private rehearsal):** `editor/tools/rehearse-legacy-draft-bridge.cjs` proves a safe *review-only* conversion for original resource title-v1 and resource-v2 JSON drafts **only while the verified resource source is revision 0**. Any newer revision refuses silent rebasing; the old JSON remains unchanged. Page/navigation-v3 drafts stay separate and use their original five-file read-only planner. The current editor's real Load/Save controls are **not** connected to this bridge. See the [compatibility decision notes](../docs/EDITOR-RELEASE-MILESTONES-AND-CHANGESET-REVIEW.md).

**Proposed Save review (private, read only):** Open `editor/save-review-preview.html` in the disposable development copy to see three fictional examples (current version, outdated draft and changed resource), or select two experimental JSON documents to review the proposed changed file paths and byte sizes. This cannot verify original HTML, authenticate the manifest, restore old drafts or perform any Save/Upload/Merge/Publish action. The working editor and existing draft formats remain untouched. See the [review-flow and production gates](../docs/EDITOR-RELEASE-MILESTONES-AND-CHANGESET-REVIEW.md).

**Milestone 6 (GitHub-ready saving) — in progress, not released:** The separate Node.js dry-run `editor/tools/plan-private-github-source-review.cjs` now calculates a verified, source-bound list of proposed GitHub file changes (edited resource fragments, manifest and regenerated complete HTML) with old/new hashes and **no file writes or output source bytes**. It neither integrates with the working Save buttons nor creates a PR or commits. Read the [nine-milestone release roadmap and exact remaining gates](../docs/EDITOR-RELEASE-MILESTONES-AND-CHANGESET-REVIEW.md). Existing v2/v3 editor drafts are not silently migrated.

**Read-only source folder checker (private trial):** `editor/restore-folder-check.html` checks the actual SHA-256 bytes of a selected experimental folder containing 414 resource fragments and a manifest, plus a separate versioned draft. It does **not** authenticate the manifest, rebuild the complete original website HTML, accept current v2 editor drafts, save files, or publish. See [Save/Restore development limits](../docs/EDITOR-RESTORE-UX-PREVIEW.md). No approved folder export exists yet.

**Local JSON version check (private prototype):** Open `editor/restore-file-check.html` inside a disposable development-branch copy. Choose the **experimental versioned resource manifest** and matching **experimental versioned draft** JSON to receive a read-only version/conflict decision. It never imports edits into your working editor, saves, uploads, merges or publishes. It **does not accept the current v2 resource drafts or v3 page drafts**, and a metadata match does **not** prove the source content is safe. Details: [private file-check and formats](../docs/EDITOR-RESTORE-UX-PREVIEW.md).

**Separate Save / Restore conflict demonstration (TEST ONLY):** Open `editor/restore-preflight-preview.html` in a disposable development-branch copy to view four fictional version/conflict scenarios. The screen is accessible, offline, and cannot load real files, import drafts, save or publish. This does **not** change `editor/index.html` or connect the current Save/Load buttons. See [conflict-preview design and limitations](../docs/EDITOR-RESTORE-UX-PREVIEW.md).

**Saving architecture, 6 November 2026:** A read-only, exact-source audit measured the full 418-file source tree at **31,102,068 bytes** versus a temporary 414-fragment-plus-manifest overlay at **1,072,527 bytes**, both in addition to the existing 30,976,969-byte compatibility website. The smaller alternative passed exact reconstruction and rollback tests but is **NOT a repeatable or approved production save format**; the source-version transition, custom admin editing and release builder remain unresolved. See [source storage decision (proposed)](../docs/EDITOR-SOURCE-STORAGE-DECISION.md) and [editor CI #42194013982](https://github.com/CosmicCuddle/Naxxramas-Resource-Hub/actions/runs/42194013982).

Related work: [editor design PR #55](https://github.com/CosmicCuddle/Naxxramas-Resource-Hub/pull/55) and [prototype PR #56](https://github.com/CosmicCuddle/Naxxramas-Resource-Hub/pull/56).

This prototype exists only on the feature/multi-file-editor-export-2026-11-05 branch. The initial main snapshot is preserved at backup/pristine-pre-editor-redesign-2026-11-05. **Never replace root index.html with an old single-file website export.**

## What can be edited

- New Players: new-players/content.html
- Server Rules: rules/content.html
- Apply to Join: apply/content.html
- Game Clients: game-clients/content.html
- Three newer sidebar entries: content/navigation.json (labels, titles, introductions, Warcraft icon filenames).
- Original 414 resources: **title and multiline plain-text content draft trial** in section 4 of editor/index.html; the exact original source is fingerprint-verified locally and changes download as JSON only.

The original 31 MB site-content.html is **never overwritten**. Titles and existing plain-text content can be edited in a local draft. Original IDs, class associations, custom fields, older menu entries, class/dungeon handbook layouts, images, overlays and page layout remain protected.

Game Clients now lives in a separate HTML fragment instead of a JavaScript string. Its display script fetches that fragment from the same repository, and leaves the legacy client card visible with a warning if the new file cannot be read.

The newer-menu script reads metadata from content/navigation.json. It retains original labels and icons as a fallback and rejects unexpected routes, groups, and icon filenames. The application privacy and form-loading code has not been changed.

## How to open this local prototype

1. Download the feature/multi-file-editor-export-2026-11-05 branch ZIP from GitHub.
2. Extract the whole repository into a disposable folder outside your working Git checkout.
3. Open editor/index.html with Microsoft Edge or Google Chrome on your computer.
4. In the editor, choose the extracted Resource Hub folder.
5. Use the page search/edit controls or the separate navigation editor.
6. Use Show only fields I have changed for a shorter review. Press Preview Current Page to inspect a simplified offline rendering of your edits. Press Revert Page Edits or Revert Navigation Edits to discard only that area; Revert All Unexported Edits discards all local edits after confirmation.
7. Save Draft downloads a JSON file. Export Changed Files downloads only changed page/navigation paths, a SHA-256 manifest and review instructions.

### Using the separate resource title and content draft trial

1. Open local `editor/index.html` and scroll to **4. Resource titles and content — private draft trial**.
2. Select the exact original `site-content.html` file from the extracted development website. Its full 30,976,969 bytes are checked using SHA-256; a different version will be rejected.
3. Search by title, section or number. Select a resource. Edit its title and/or multiline **plain-text** content. Original line breaks are shown in the textarea and can be preserved. Use **Apply Resource Edits** to stage changes in memory. When changing selection, unapplied edits require confirmation to discard.
4. Use **Save Resource Draft (.json)** to download only modified titles and content plus the original baseline fingerprint. **Load Resource Draft** checks it against the same verified original. Older title-only `naxx-local-resource-title-draft-v1` JSON files remain importable.
5. To undo edits, use **Revert Selected Resource** or **Discard All Resource Edits**. Clearing an originally nonempty content field requires a separate confirmation. All these buttons affect only browser memory.

The new draft format is `naxx-local-resource-draft-v2`. Empty content and line breaks are allowed. New content is limited to 30,000 characters and rejects HTML brackets and unsafe control characters. This editor does not display or execute content as HTML. Original content was confirmed to contain no HTML-like tags, but the original runtime's formatting and admin behaviour are not yet fully verified.

The resource draft is **separate from** the page/navigation draft in section 5. It is not a GitHub-ready resource archive, cannot replace `site-content.html`, and cannot be published. No original website code is executed or uploaded. Manual owner acceptance and later reviewed export/recovery controls remain required.

### Save page/navigation and resource drafts together — private review ZIP

The **Save Combined Review Package (.zip)** button in section 5 downloads a single ZIP containing **separate local draft files**, without copying the live website or creating an update for GitHub. You may save changes from either editor area or both.

- `REVIEW-PAGE-DRAFT.json` — only when page or navigation edits have been staged; contains the existing `naxx-local-draft-v3` format.
- `REVIEW-RESOURCE-DRAFT.json` — only when resource title/content edits have been **applied**; contains `naxx-local-resource-draft-v2`.
- `REVIEW-MANIFEST.json` — identifies included drafts and records their SHA-256 checksums and known original-source fingerprints.
- `READ_ME_FIRST.txt` — explains how to restore drafts locally and the warning **not to copy** the ZIP to GitHub or the public website.

This ZIP is named `Naxxramas-Private-Editing-Review.zip`. To restore, extract it privately and use the existing **Load Saved Draft** (pages/navigation) and **Load Resource Draft** (resources) buttons. The hash checks still apply. Resource text must be applied or reverted before saving this package; unapplied typing is not silently included.

**Do not confuse it with Export Changed Files (.zip).** That older command still exports only changed page/navigation files under their actual relative repository paths. The combined review package contains **drafts rather than edited website files**; it cannot be deployed and is **not** a complete GitHub backup. Do not upload the ZIP or review JSON files into a public branch. A later independently reviewed exporter will be needed to create update-ready resource fragments with appropriate paths.

The editor only reads local user-selected files; it neither overwrites them nor uploads or publishes changes. Its preview is a **simplified visual approximation**, not the full website. A sandboxed iframe with a restrictive Content Security Policy excludes external images, clickable links, scripts, videos, and the application iframe. It cannot submit real applications. Do not treat the preview as proof that the public page will look or behave identically. The website's Game Clients and menu scripts separately fetch public same-origin content when a visitor loads the site.

**Do not apply an exported ZIP directly to main.** Use a disposable Git checkout, compare original file hashes from the manifest, inspect changed files, run tests, then open a PR. The exported source branch hint is not verified evidence that a selected local folder came from a particular commit.

## Saving behaviour and limits

- The four-page/navigation draft format `naxx-local-draft-v3` is a local downloaded JSON file, not autosave, publication, or a full repository backup.
- The separate resource draft format is `naxx-local-resource-draft-v2`, which stores only changed title/content fields by resource position and the pinned original source hash. Older title-only `naxx-local-resource-title-draft-v1` files can be restored. Neither contains all 414 original records, full source HTML or a GitHub-ready website export.
- The combined private review ZIP uses a **separate path allowlist**; it never places the root `index.html` loader, complete original `site-content.html`, or arbitrary paths into a review bundle. Neither this review ZIP nor its manifest authorises a GitHub deployment.
- Draft restore demands exact source SHA-256 fingerprints for all four page files and the navigation file; mismatches are rejected.
- Changed-files ZIP paths are restricted to the four page HTML files and content/navigation.json plus the manifest and instructions. It cannot contain a replacement root index.html.
- HTML edits change only existing text fragments and href values, not whole document structure or application embed attributes. Unsafe links are rejected.
- Navigation changes are limited to approved text/icon fields; existing slugs, links and grouping are fixed. Icon names must be existing WoW JPG filenames, not URLs.
- Browser folder selection uses webkitdirectory. Edge and Chrome are the intended browsers; all browser versions have not been tested.
- No authentication, private online publishing, rich-text formatting, new download cards, image uploading, full site backups, layout editing, editing of IDs/classes/custom fields, or resource-data migration. Only titles and multiline content can be saved in the separate local resource JSON draft.
- Revert buttons discard local edits after explicit confirmation; they do not change files on disk. An invalid folder import preserves your existing work; selecting a different valid folder first asks whether you wish to discard current edits. Preview does not auto-refresh while typing—press Preview Current Page again after editing.
- The local editor should remain privately distributed. A public GitHub Pages UI lock cannot protect confidential admin operations.
- To preserve a full copy, separately use the untouched GitHub backup branch and download the complete repository ZIP.
- Do not put applications, passwords, account information, private realm addresses or proprietary WoW game binaries into public content.

## Tests

A scoped read-only GitHub Actions workflow executes all editor regression tests.

To run locally from the repository root:

    node --test editor/tests/*.test.cjs

These tests cover ZIP paths, hashes and CRC; edits against the actual content fragments; the Game Clients loader and fallback; navigation JSON loading and fallback; protection of the small root loader; exact-SHA-verified original resource parsing; resource-title/content draft validation; and simulated title/content-panel button interactions.

**Real-browser smoke:** The protected editor workflow also runs `node editor/tools/browser-smoke-title-draft.cjs` in a fresh headless Chrome profile against a localhost-only server. [Run 42051908181](https://github.com/CosmicCuddle/Naxxramas-Resource-Hub/actions/runs/42051908181) passed: it loaded all 414 verified resources, applied title and multiline content edits, downloaded and restored a JSON draft, and refused an incorrect source file while retaining both edits. The original source, public website, external application form and GitHub repository were not modified. The temporary download/profile was deleted.

**Still outstanding:** owner's manual visual/keyboard review of this new resource panel in Edge/Chrome, full resource-content editing, a combined safe draft format, reviewed GitHub-ready changed-fragment exports, complete restore verification and all normal visitor/admin website compatibility gates.

**The new resource-title flow has one automated Chrome smoke pass.** This is not a full visual/accessibility review, normal website admin acceptance, application submission test, or evidence that publishing works. Manual acceptance and additional export/recovery tests remain required before any merge.

**Legacy source-preservation milestones (read-only):** The original 414 resource fragments were separated and reassembled entirely in memory, reproducing the exact 30,976,969-byte original source and its SHA-256 hash. A separate aggregate audit checked all 414 decoded IDs (no duplicates in the original literals), seven distinct section values, 41 distinct class-association labels and 13,821 occurrences of additional fields outside the audit's limited allowlist. A media audit found 95 embedded image references representing 71 distinct payloads. All original image headers passed; none of their markers are inside the resource array.

These are **not** production migration, full browser equivalence, or permission to delete repeated images. All original structures and values remain untouched. Detailed results and remaining gates: docs/EDITOR-LEGACY-DATA-INVENTORY.md.

**Separate-file rehearsal:** The CI now writes 414 independent resource fragments, the exact prefix and suffix, a separator layout file and a checksum manifest into a **private temporary directory**. It reads the files back, rebuilds the original website byte-for-byte, rejects missing/altered/swapped fragments, verifies the output hash and removes the temporary directory. Nothing is committed or uploaded.

**Single-resource editing experiment:** A controlled change to one synthetic resource title in memory preserved the other 413 records exactly and left source content outside the resource array unchanged. This is not a working resource editor and is not an approved production edit.

**Single edited fragment on disk (temporary test only):** A second rehearsal now changes a controlled title in one of the 414 individual resource fragment files, then validates the assembled full site against the expected in-memory source. The other 413 fragments, the original scripts, images, the separate 29-record collection and all other content outside the main resources are unchanged. The immutable original manifest properly rejects the altered fragment, and the temporary files are deleted. [Editor checks run 42047956345](https://github.com/CosmicCuddle/Naxxramas-Resource-Hub/actions/runs/42047956345) passed **83/83 tests**. Run from an original complete checkout with \`node editor/tools/rehearse-edited-resource-files.cjs\`.

That earlier fragment-only rehearsal did not provide a browser editor. A separate private title/content draft screen now exists and has passed a Chrome functional smoke test. It **still does not** produce an edited resource file or write to the repository. Changed-file export, approved edited manifests, complete website recovery, owner visual acceptance and safe GitHub publishing remain future work.


See docs/EDITOR-RESOURCE-FILES-DESIGN.md for the proposed eventual GitHub folder layout, stability rules and release gates.

**Part 08 data-consumer safety checks:** All 29 side records remain separate from the 414 main resources. An aggregate-only lexical scan classified 13 possible direct accesses to the side collection (two known mutator-call patterns, one shallow member assignment, ten other accesses) and 31 to the main resources. These are code-pattern candidates only, not evidence of executed write paths. In-memory synthetic title edits of the first and last resources leave the full original source outside the resources array unchanged and preserve the code-access candidate counts. [GitHub editor run 42047159391](https://github.com/CosmicCuddle/Naxxramas-Resource-Hub/actions/runs/42047159391) passed 78/78 tests.

The candidate audit tool can be run locally with \`node editor/tools/audit-side-consumers.cjs\`. It prints counts only; it does not log original resource names, IDs, URLs, script text or fields. This audit is **not** a usable original-resource editor or a substitute for manual visitor/admin browser testing.



## Multiline content milestone — 5 November 2026

The baseline audit confirmed **414 string-literal content fields**, including **121 originally empty** values and **288 containing line breaks**; maximum decoded length was **19,165 characters**. No HTML-like tags or disallowed control characters were found. The v2 resource draft editor retains line breaks, does not execute markup, and permits intentionally empty content after a clearing confirmation.

[Editor CI run 42054557700](https://github.com/CosmicCuddle/Naxxramas-Resource-Hub/actions/runs/42054557700) passed **108/108 Node component tests** and a real local Chrome smoke test of title/content draft download and restore. A protected source-rebuild rehearsal changed one content field and verified the other 413 resource fragments and every non-resource byte remained untouched.

**Limit:** This is a local draft only. No edited resource files, compatibility HTML output, full-site backup or GitHub-ready resource export have been produced for the owner. The public website is unchanged.

## Combined review package milestone — 5 November 2026

A local **multi-file review ZIP** now saves both editor areas in one download while retaining independent page and resource draft JSON files. The package includes a SHA-256 manifest and recovery instructions. Its writer uses a separate strict allowlist from the existing page/navigation GitHub-path ZIP writer.

[Editor run 42058261964](https://github.com/CosmicCuddle/Naxxramas-Resource-Hub/actions/runs/42058261964) passed **113/113 component tests**: both-draft packages, page-only or resource-only packages, integrity hashes, duplicate/unsafe paths, baseline mismatch and protection against adding production HTML. A later Chrome browser smoke also downloaded a resource-only review ZIP with no deployable website file. This proves draft packaging only; it is not the final separate-resource source-file migration or update mechanism.

## Deterministic resource change-set staging (development tests only)

The new `node editor/tools/rehearse-resource-change-set.cjs` test rehearses **multiple resource-title/content edits at once**, using a pinned original `site-content.html` and a validated `naxx-local-resource-draft-v2`. It does not read or change the published site.

It computes a deterministic in-memory manifest of 414 original/staged resource fragment SHA-256 hashes, a list of only changed `resources/NNNN.fragment` paths, and checksums for the untouched original prefix, suffix and separators. It stages edits inside a private, temporary folder, validates the **exact reconstructed complete source**, detects tampered or omitted files, and deletes the folder afterward.

Original content IDs, title values, embedded images and confidential source strings are **not printed** in reports. The manifest explicitly says it is **not publishable**, **not GitHub-ready**, and **not deployable**. No final source fragment paths have been added to this repository; existing live `site-content.html` and small root `index.html` remain untouched.

This is an internal proof for the future reviewed multi-file resource exporter. Do not copy temporary paths into GitHub or confuse the in-memory change-set with the downloadable private review ZIP.

## Proposed 418-file source tree and rollback rehearsal

`node editor/tools/rehearse-proposed-resource-tree.cjs` creates the **proposed** `content/legacy/` source tree in a private OS temporary folder. The rehearsal checks 414 numeric resource files, a manifest and three original layout files, rebuilding the original website exactly. It then checks an intentionally edited candidate, rolls back the changes, verifies the original SHA-256 again, and deletes the temporary folder.

No source fragments are committed or made downloadable by this rehearsal. A candidate-only manifest explicitly forbids interpreting the output as a deployable GitHub export. The baseline source tree occupies approximately **31.1 MB**, so keeping it *alongside* the 31 MB generated compatibility file would duplicate a substantial part of the website. That decision is **not approved** yet.

`node editor/tools/audit-full-checkout.cjs` separately audits the entire clean, tracked Git checkout with a cumulative fingerprint. This makes it harder to mistake the resource-only folder for a complete repository backup. It is **an inventory test, not a backup**, and does not capture Git history, untracked files or external service data.

Both commands are covered by the protected editor workflow. Do not run these against the live website or treat their output as instructions to replace the current `site-content.html` or root `index.html`.

[Editor CI 42063283544](https://github.com/CosmicCuddle/Naxxramas-Resource-Hub/actions/runs/42063283544) passed **135/135 tests**, including source-tree rollback, malicious/extra path checks and the clean whole-checkout inventory. The tracked checkout at that revision contained **127 files / 94,404,901 bytes**. **These figures describe a tested checkout, not a saved full-repository archive.**

## Original large website audit (read-only)

Before any migration of the large original site file, run this from the repository root:

    node editor/tools/inspect-legacy.cjs

This reads only the local site-content.html file and prints its byte length, hashes and limited structural marker totals. The reported resource record count is deliberately null because counting marker text is **not** proof of a complete resource inventory. No source text, application information, passwords, addresses or image content is printed, and no files are rewritten.

The editor CI workflow runs this aggregate-only inventory on its complete GitHub checkout. Do not proceed with a data split until we have a trustworthy complete record of IDs, categories, class/dungeon associations, embedded images and overlay dependencies. Existing original resource DATA and all custom features must remain unchanged until separately reviewed.

## Private source-tree ZIP (offline-only candidate, not a website patch)

The new `editor/tools/package-private-resource-tree.cjs` can build a **private ZIP containing 419 files**: all 418 proposed `content/legacy/` source-tree files and a `PRIVATE-REVIEW-ONLY-READ-ME-FIRST.txt` notice. It accepts the pinned original `site-content.html`, and optionally a verified `naxx-local-resource-draft-v2` JSON file. It never imports arbitrary resource IDs into paths.

The ZIP is **uncompressed** so the complete original source can be verified byte-for-byte. The writer checks a strict path allowlist, ZIP local/central directories and CRC32. It then **independently extracts the package into a different private temporary folder**, verifies all 414 resource hashes, reconstructs the intended full website, and rolls back to the original SHA-256 before approving the bytes. No ZIP from this tool is uploaded to CI artifacts or GitHub releases.

For later **explicit local use**, from a full reviewed repository checkout:

```bash
node editor/tools/package-private-resource-tree.cjs --output "/absolute/private/path/Naxxramas-Resource-Review.zip"
```

To stage a v2 resource draft locally, add `--draft "/absolute/private/path/naxxramas-resource-draft.json"` to that command. The output folder must already exist and must be **outside the repository**, including outside symlinked aliases. The tool creates a new file with restrictive permissions, refuses overwrites and rejects invalid source/draft input. **Do not run it on a public/shared computer or publish the resulting ZIP.** It contains real source data.

This is **not** a complete repository backup, GitHub-ready changed-files archive, deployable website, replacement `site-content.html` or permission to migrate to the 418-file layout. A later implementation must independently validate a whole-repository recovery package and decide how to maintain a generated compatibility website.

**Verified milestone:** [Editor test run 42066172796](https://github.com/CosmicCuddle/Naxxramas-Resource-Hub/actions/runs/42066172796) passed **142/142 tests**, including creating baseline and edited source archives, independent extraction, exact reconstruction and rollback, canonical ZIP validation, corrupt path/content rejection, privacy-warning protection, and an explicitly requested local output with overwrite and repository-path refusal. Only temporary test files were produced; no source archive was uploaded as a CI artifact.

## Full Git-history backup and verified recovery — development-only gate

The resource source-tree ZIP is only one part of the site. A **separate private Git bundle backup tool** now addresses the entire fetched Git repository history:

- `editor/tools/rehearse-full-git-recovery.cjs` verifies the checkout is **not shallow**, not partial/promisor, has **no modified, untracked or ignored files**, no symlink/submodule entries and no Git LFS pointer files. It inventories all tracked files, preserves all locally fetched branch/tag/remote refs and detached `HEAD`, creates a Git bundle in a disposable OS temp directory, and independently clones/restores it to verify commit, tree, full tracked bytes, ref targets and reachable history. The temporary bundle is deleted after verification.
- `editor/tools/create-local-git-backup.cjs` provides an **optional explicit local save**. It requires a new absolute `.bundle` filename outside the repository, including symlink aliases, and creates exactly three private files: `<filename>.bundle`, `<filename>.bundle.receipt.json` and `<filename>.bundle.READ_ME_FIRST.txt` (the suffixes are added to the chosen bundle filename). It refuses existing files and uses restrictive permissions. It restores the **saved** bundle again before creating its receipt; failed output attempts clean up files they created. It does **not** upload, push, merge, publish or replace the site.
- `editor/tools/rehearse-saved-git-backup.cjs` runs the optional save tool against the **complete fetched GitHub runner checkout** in a disposable private folder, independently verifies the bundle and sidecars, then deletes them. CI intentionally has **no artifact upload**.

**Only for later explicit owner-approved local use** on a complete, clean checkout:

```bash
node editor/tools/create-local-git-backup.cjs --output "/absolute/private/folder/Naxxramas-Full-History.bundle"
```

The command will stop if source history is shallow or incomplete, unsaved/ignored local files are present, or an output already exists. Keep all three generated files together and private. A Git bundle may contain **sensitive material from earlier commits**, even if current public pages do not.

**Scope is narrower than an entire GitHub account or deployed server.** The backup covers only Git history and refs already fetched to the checked-out repository plus the committed tracked files. It does **not** include unknown remote refs never fetched, reflog-only objects, GitHub Issues, pull-request comments, project/settings/secret configuration, GitHub Pages deployment settings, server databases, the game server, external forms, Git LFS data, untracked/ignored files or connected service data. These require separately planned backup procedures.

**Release remains blocked:** Even a validated full Git bundle does not approve migration of `content/legacy/`, publication of the 31 MB source tree, a combined GitHub-ready website update or changes to the live site. CosmicCuddle must approve any production move after a review of backup/recovery coverage and website/browser behaviour.

## Unified page/resource Git preflight — no deployment

The new `editor/tools/plan-page-draft.cjs` validates the **actual existing page/navigation source hashes** and the browser editor's text/hyperlink positions before generating any in-memory page changes. It checks all four HTML fragment paths and `content/navigation.json` and rejects unexpected filenames, source mismatches, unsafe link targets and protected navigation routes. It can work with the already-supported `naxx-local-draft-v3` format.

`editor/tools/plan-mixed-editor-update.cjs` combines that validation with the existing `naxx-local-resource-draft-v2` resource preflight. It checks a clean, committed Git checkout and, when resource edits exist, rehearses an exact candidate source-tree reconstruction and rollback. It reports **separate changed Git-tracked page paths and uncommitted candidate resource-fragment paths** with SHA-256 checksums, without publishing, writing to Git or creating a deployable archive.

**Release gate:** Page drafts do not yet record an authenticated/verified source commit, and the proposed numeric resource paths are **not committed** to Git. The mixed planner therefore sets `draftBoundToExactCommit:false`, `githubReady:false` and `deployable:false` even when all file hashes and the current checkout match. This must not be mistaken for a ready-to-install GitHub update. Owner approval, safe commit binding, resource source-tree adoption and visitor/admin regression remain required.

## Verified Git-commit review receipts (private, not deployable)

The combined editor now has a **source-commit binding gate** for later Git exports. The tooling **does not** change older browser draft files; `naxx-local-draft-v3` (pages/navigation) and `naxx-local-resource-draft-v2` (resources) remain readable and separate.

`editor/tools/bind-editor-drafts.cjs` requires an explicitly chosen **full Git commit hash**, and checks that the current checkout is clean and at exactly that commit. It reruns all page/navigation draft source-position and SHA-256 checks and, if resource edits are included, the 414-resource reconstruction and exact rollback checks. It creates a deterministic **hash-only receipt** containing the reviewed Git commit and tree, whole tracked checkout fingerprint, six protected source-file hashes, both draft-content hashes and the separate approved existing-page versus candidate-resource changed paths. Its SHA-256 allows later comparison to identify changed receipts or draft files.

`editor/tools/create-draft-review-receipt.cjs` provides an optional **private local file** for this receipt. Its output must have a new absolute `.review.json` path **outside the Git repository** and it refuses overwrites or directory aliases back into the checkout. It requires `--commit`, `--output` and `--pages` and/or `--resources` pointing to private JSON drafts. The saved receipt is readable by the verification library, and includes no original resource text or IDs. The command does not upload anything or create a Git patch.

Example format for **later** use on a clean, verified checkout, after deliberately selecting the exact full commit hash (replace placeholders):

```bash
node editor/tools/create-draft-review-receipt.cjs --commit FULL_REVIEWED_GIT_COMMIT --pages "/private/path/page-draft.json" --resources "/private/path/resource-draft.json" --output "/private/path/Naxxramas-Editor.review.json"
```

**Critical distinction:** This proves that the **selected drafts and source files matched a specific Git commit at review time**. It does not establish when the browser drafts were authored, authenticate who wrote them, sign the receipt, prove the presence of a complete external backup, approve the proposed `content/legacy/` resource paths or authorise publishing. Every receipt explicitly says `authoredAtThisCommitProven:false`, `cryptographicallySigned:false`, `githubReady:false` and `approvedByOwner:false`. It must be regenerated/reverified after changes. This is not a final GitHub-ready combined website export.

## Reviewed export of EXISTING page/navigation Git paths — offline only

The new `editor/tools/package-reviewed-page-update.cjs` turns a **verified review receipt** and its matching local `naxx-local-draft-v3` page/navigation draft into a private ZIP. It includes **only actually changed files that already exist in Git**: `new-players/content.html`, `rules/content.html`, `apply/content.html`, `game-clients/content.html` and/or `content/navigation.json`. Each file keeps its **exact original Git relative path**.

The ZIP also contains `REVIEWED-PAGE-UPDATE-MANIFEST.json` with the selected Git commit/tree, review receipt SHA-256, original/updated SHA-256 per changed path and an explicit list of **excluded proposed resource edits**, plus `READ_ME_BEFORE_GIT_REVIEW.txt` with safety and review instructions.

**Safety gates:** The tool independently revalidates the receipt against the clean checkout and exact draft payloads before packaging, compares every file to its originally reviewed checksum, and decodes the final ZIP to confirm all expected entries and bytes. It refuses stale commits, changed drafts, forged paths, altered archive instructions and unexpected files. The root `index.html` loader, `site-content.html`, all proposed resource fragments and any other repository files are forbidden.

For **later explicit private local use**, create the review receipt first (see the section above), then run a command like:

```bash
node editor/tools/package-reviewed-page-update.cjs --pages "/private/path/page-draft.json" --receipt "/private/path/approved-commit.review.json" --output "/private/path/Reviewed-Pages.zip"
```

If the receipt was created for **both** page and resource drafts, you must also supply the same `--resources "/private/path/resource-draft.json"` when packaging. This verifies that the receipt truly matches both drafts; **resource changes are never packaged** by this command. The output path must be a new absolute `.zip` **outside the repository**, and an existing file is never overwritten. The archive contains only changed page/navigation files, so it is **not** a full website backup.

**This is a reviewed existing-path candidate, not a deployment.** Although the packaged filenames match tracked Git paths, the archive's manifest says `ownerApproved:false`, `githubReadyForDeployment:false` and `deployable:false`. Do not apply it to the live website. Resource updates still require a separately approved `content/legacy/` source-tree migration, correct compatibility source generation, a retained verified backup and owner acceptance testing.

## Receipt-verified resource compatibility preview ZIP — PRIVATE ONLY

The resource half of the separate-file export now has a corresponding **offline preview package** in `editor/tools/package-reviewed-resource-preview.cjs`. This does **not** add or adopt the proposed `content/legacy/` directory in Git.

For a verified `naxx-local-resource-draft-v2` and its exact Git-commit review receipt, it:

- Revalidates the original commit, page/resource draft fingerprints and 414-resource SHA-256 baseline. When page edits were reviewed together with resource edits, the exact page draft must also be supplied for receipt verification.
- Stages the candidate resource changes in a disposable **418-file private source tree**, verifies the reconstructed compatibility source **byte-for-byte**, then verifies exact rollback to the original complete website before deleting the tree.
- Creates a deterministic, uncompressed private ZIP containing **only changed** resource object fragments named `CANDIDATE-RESOURCE-FRAGMENTS/0001.fragment` etc., `PREVIEW-ONLY-generated-site-content.html` (the complete ~31 MB *offline preview*, NOT the live path), `RESOURCE-PREVIEW-REVIEW-MANIFEST.json` and `READ_ME_PRIVATE_RESOURCE_PREVIEW.txt`.
- Re-opens the ZIP and verifies all fragment data, original and changed hashes, reconstructed complete HTML, checksum manifest and private-use warning. Page/navigation changes are **explicitly excluded and counted** so the package is not represented as a complete website update.
- Never includes root `index.html`, live-path `site-content.html`, public GitHub source-tree paths, resource IDs in manifest output, or a deployment script. It makes no repository write.

For **later explicit local review** from a clean matching checkout, after saving a commit-bound review receipt:

```bash
node editor/tools/package-reviewed-resource-preview.cjs --resources "/private/path/resource-draft.json" --receipt "/private/path/review.review.json" --output "/private/path/Private-Resource-Preview.zip"
```

If the original receipt covered **both** editing areas, add `--pages "/private/path/page-draft.json"` to verify the page half too. The output must be a **new absolute private path outside Git**. No existing ZIP may be overwritten.

**Protect this ZIP.** Unlike the small changed-pages ZIP, it contains the complete generated website resource source and may include confidential custom content. **Do not upload or publish it, attach it to a public Issue, place it in GitHub Pages, or copy the preview file over the live website.** It is not a complete repository backup or a permitted production update. The owner-approved resource source-tree migration, preview/rollback review and final integrated export are still separate decisions.

## Verify that both private review ZIPs belong together

`editor/tools/verify-paired-editor-archives.cjs` now checks that the **existing-path page/navigation ZIP** and **private resource compatibility-preview ZIP** correspond to exactly **one verified Git commit, review receipt and both original drafts**.

The private command takes **five already saved files**:

```bash
node editor/tools/verify-paired-editor-archives.cjs --pages "/private/page-draft.json" --resources "/private/resource-draft.json" --receipt "/private/commit.review.json" --page-zip "/private/changed-pages.zip" --resource-zip "/private/resource-preview.zip"
```

It requires these files to exist **outside Git**, as non-symlink regular files, with absolute paths. The two draft formats and receipt are revalidated against the clean current checkout. The verifier **independently regenerates both deterministic ZIPs**, checks their exact ZIP bytes and hashes, compares the two manifests' reviewed commit/tree/receipt/draft fingerprints and confirms each archive's omitted-edit count matches the other archive's changed-file count. It also verifies the full generated compatibility preview and original resource rollback through the existing builder.

A forged ZIP with valid ZIP CRCs, a ZIP from a different review of the **same Git commit**, a changed draft, changed review receipt, missing editing area, unexpected file or changed source checkout all cause refusal.

The command prints **only hashes, counts and review status**. It creates **no new package or backup**, writes no Git files, and makes no online call. Two matching archives are a **complete offline review pair only**, **not a merged GitHub-ready file tree or deployable website**. The resource directory is still a proposal, and a separately retained backup, preview tests and CosmicCuddle's explicit approval remain required.

## Unified sparse 425-file source-layout rehearsal — no installation

The next protected milestone is `editor/tools/rehearse-unified-source-layout.cjs`. It does **not** change the current browser editor, download a full client, or create a deployable source ZIP.

Given two **already reviewed private ZIPs**, their exact v3 page draft, v2 resource draft and one verified Git-commit receipt, it:

1. Revalidates the ZIP pair against the same clean Git commit, including exact ZIP bytes and source hashes.
2. Creates a **private OS temporary directory** and stages **actual ZIP entries**, not only re-created test values, into a proposed sparse source tree: **418** resource-source files under `content/legacy/`, **four** page `content.html` files, `content/navigation.json`, the original root `index.html`, and a **generated** `site-content.html` for this test only (**425 total files**).
3. Checks the resource manifest, all 414 resource fragments, the unchanged prefix/suffix/separators, four page HTML files, navigation JSON and original root loader. It reconstructs the complete compatibility website **from the staged fragments** and compares it byte-for-byte with the full preview contained in the verified resource ZIP.
4. Restores all **seven original tracked files** exactly, removes the candidate resource directory, checks that the workspace contains no extra files, deletes the entire temporary directory, and rechecks the actual Git checkout commit and tracked-file fingerprint.

The staging folder is intentionally **sparse**: it is **not a complete website checkout** and does not include every image, script, asset or browser dependency. Passing this check proves file layout, reconstruction and rollback consistency, **not** website runtime behaviour or production readiness.

There is no CLI that permanently writes this layout, and no GitHub Actions artifact contains the 31 MB generated source. Approval to commit `content/legacy/`, retain a final Git backup, choose a storage strategy, verify a real browser preview and deploy must come separately from CosmicCuddle. All current outputs remain `candidateOnly:true`, `githubReady:false`, `publishable:false` and `deployable:false`.

## Remaining development

1. Test the local preview and all revert buttons in Edge/Chrome on a disposable copy, including draft restore, ZIP validation, icons and keyboard access.
2. Improve preview fidelity carefully without executing scripts or submitting external forms.
3. Migrate the original site resource DATA in verified, reversible batches without losing its IDs, images, class/dungeon associations or other custom fields.
4. Add complete repository backup/export from a verified tree, conflict checks and safer publishing guidance.
5. Choose a genuinely private authoring distribution method. Obtain owner approval before release.

The live website and pristine backup must remain unchanged.
