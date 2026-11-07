# Proposed GitHub layout for independently editable legacy resources

**Status: DESIGN ONLY — no live migration, no new resource files in the repository, no merge approval.**

This document extends the approved phased editor direction in PR #55 and the protected development work in PR #56. The website remains on the current original source until CosmicCuddle approves a tested replacement.

## Goal

The owner should eventually edit a single resource in a private/local editor, save a draft, export **only its changed files**, and apply those paths in a GitHub branch without accidentally replacing the site's lightweight root index.html loader or damaging unrelated content.

The current live website loads its original generated site-content.html file. Replacing that loader or silently dropping custom fields is **not** part of this proposal.

## Tested, temporary file structure

The current dry-run tool creates an isolated operating-system temporary directory with this exact structure, deletes it after checking, and commits none of the extracted files:

    manifest.json
    resources/
      0001.fragment
      0002.fragment
      ...
      0414.fragment
    layout/
      prefix.utf8
      suffix.utf8
      separators.json

The numeric filenames are stable *positions in the original collection*, **not** WoW IDs or automatically generated replacements for the original resource IDs.

- The 414 fragment files retain the exact bytes of each existing object literal and all its custom fields.
- The separator document retains all 415 intervening strings, including formatting, commas, and array brackets.
- The prefix/suffix retain **all other source content**, including the 29-item separate collection, unrelated pages, scripts, images, styles, and the later window assignment.
- The manifest contains fixed paths, a checksum for every fragment and supporting part, the baseline file hash, and the expected 414 records.

The temporary tool refuses to accept missing, altered, or swapped fragments. It reconstructs exactly 30,976,969 bytes with SHA-256:

    34455f6d901c538e2491a8c16681692e4c02d918b1984d7d0ba081aacb1049e8

GitHub Actions has verified the byte-exact reconstruction from **414 separately written temporary files** and deletes the temporary folder afterward. This proves reversible packaging of the original, unchanged source. It is **not yet a user-facing export or GitHub-ready collection**.

## Multi-resource changed-fragment staging — protected development milestone

A new read-only-to-production test tool, `editor/tools/rehearse-resource-change-set.cjs`, now accepts the exact pinned original `site-content.html` and a **v2 resource draft**. It validates the complete original SHA-256 fingerprint and all 414 records, checks the draft against the verified original titles/content, and generates a **deterministic in-memory changed-fragment manifest**.

The manifest records:

- Each of the 414 **original and staged** fragment SHA-256 hashes, with stable position indexes rather than identifiers drawn from resource content.
- Only genuinely changed paths under the **temporary** `resources/0001.fragment` through `resources/0414.fragment` layout; which approved fields changed (`title`, `content`, or both).
- The unchanged prefix, suffix and all 415 separator checksums, the original source SHA-256, and the expected fully reconstructed source hash and byte length.
- Explicit flags `publishable:false`, `githubReady:false`, `deployable:false`. The manifest contains **no source text, private resource IDs, titles or content**.

The tool first reconstructs the original package to prove the baseline matches. It then edits **only the selected files** in a private OS temporary directory, verifies every staged file against its checksum and intended title/content update, checks 414 index positions and the untouched layout, and rebuilds the expected complete HTML bytes. The original immutable manifest must reject the changed fragments; the development-only changed manifest validates only the intended edits. Test directories are removed even on failure.

Regression tests cover simultaneous first/middle/last resource changes, title and content in the same object, deterministic results, altered fragments, unrelated file changes, duplicate/forged paths, changed drafts after staging, unsafe values, and wrong baseline fingerprints. No editor source file, output archive or GitHub repository file is written by this test.

**Still not authorised:** These temporary paths are **not yet the final GitHub paths**. A real migration to `content/legacy/resources/` requires complete repository-tree backup and recovery verification, changed source/version conflict handling, review of duplication/size, a publishable deterministic compatibility builder, visitor/admin acceptance, and CosmicCuddle's explicit approval. The existing review ZIP remains a *draft-only* package and should not be installed.

## Candidate source-tree and rollback proof — 5 November 2026

The **proposed** final folder structure has now been instantiated and verified in a **private disposable test directory**. Nothing was committed under `content/legacy/` in this repository and no published website files were changed.

    content/
      legacy/
        manifest.json
        resources/
          0001.fragment
          ...
          0414.fragment
        layout/
          prefix.utf8
          suffix.utf8
          separators.json

The tested tree contains **418 files**: 414 independently named original resource object literals, one versioned hash manifest and three layout files. The root `index.html` loader and the existing generated `site-content.html` are **not** paths in the candidate source tree.

The private `editor/tools/rehearse-proposed-resource-tree.cjs` verifies all of the following before accepting a candidate:

- The fixed original SHA-256 and exactly 414 resources; expected 418 **files only**, no unexpected paths or symlinks.
- Each numeric resource path, fixed index, original and staged checksum, and every layout checksum.
- The baseline resource tree reconstructs the **original complete website byte-for-byte**.
- A tree with approved v2 title/content edits reconstructs the **exact planned modified compatibility source**, preserving all unchanged records and the full original prefix, suffix and separators.
- Rollback restores the changed fragments and manifest, after which the reconstruction matches the original SHA-256 again.
- Missing, extra, corrupted, unapproved, or symlinked files prevent verification; test folders are deleted, including after errors.

The observed two-edit candidate tree size was **31,102,209 bytes**, and the restored original tree **31,102,068 bytes**, including the manifest. The original generated `site-content.html` is **30,976,969 bytes**. Keeping *both* long-term would duplicate approximately 31 MB of source content, before counting the rest of the repository. **This size and maintenance trade-off requires CosmicCuddle's approval**; no choice to duplicate or replace the original has been made.

The candidate manifest deliberately includes `candidateOnly:true`, `publishable:false`, `deployable:false` and `githubReady:false`. The output is an **internal structural proof**, not yet a signed or reviewed release, a GitHub import, a downloadable resource ZIP or permission to publish.

### Backup prerequisite: whole tracked checkout

The read-only `editor/tools/audit-full-checkout.cjs` enumerates the **complete Git-tracked checkout** at its current commit—not merely the resource tree—and checks that it is clean, that the root loader is present, the baseline original source matches SHA-256, paths are safe, files are readable and regular, and no duplicates exist. It calculates an aggregate checksum and reports counts/bytes without emitting file contents or individual names.

**Crucial distinction:** This is **not a backup**. No archive is written. A future real recovery package must separately preserve the intended repository commit/history and other necessary configuration; Git-ignored/untracked content and external services are outside this preflight. The existing pristine branch is preserved but is not, by itself, verification of a complete recoverable new deployment.

**Automated evidence (5 November 2026):** [Editor CI run 42063283544](https://github.com/CosmicCuddle/Naxxramas-Resource-Hub/actions/runs/42063283544) passed **135/135 tests** and the dedicated checkout inventory. At the tested commit it verified **127 tracked files**, **94,404,901 tracked bytes**, a clean checkout and the original `site-content.html` SHA-256. The candidate source-tree tests also passed: **418 files**, zero-edit byte-exact rebuild, safe modified rebuild and full rollback to the original hash. These are snapshot measurements of that test commit and may change with later commits; they are **not** an independently stored backup.

**Required approval before migration:** Keep the current generated `site-content.html` serving visitors while the candidate source tree is tested. Review repository size and total duplication, ensure the full tracked checkout plus any relevant private configuration can be restored from a separate backup, and test the generated output in a disposable environment. Only then decide whether to commit `content/legacy/` or combine it with the page/navigation changed-files exporter. Do not silently overwrite the published compatibility file.


## Private review ZIP — local-only packaging and independent verification

The candidate 418-file source tree can now be packaged by a **local-only** Node command in `editor/tools/package-private-resource-tree.cjs`. The archive contains **419 files**: the 414 resource fragments, three original layout fragments, the candidate checksum manifest and a prominent `PRIVATE-REVIEW-ONLY-READ-ME-FIRST.txt` warning.

The exporter is deliberately **not part of the webpage's GitHub-ready changed-files ZIP**. It has its own allowlist and a deterministic, uncompressed ZIP/STORE encoder. Verification checks ZIP entry names, duplicates, CRC32, uncompressed sizes, central/local-directory agreement and canonical bytes; it refuses unexpected paths and outright forbids the root `index.html` loader and generated `site-content.html`.

Before any local output is accepted, an **independent extraction into a second private OS temporary folder** rechecks all candidate resource/layout checksums, rebuilds the complete original or deliberately edited website source byte-for-byte and performs a rollback to the pinned original SHA-256. Temporary verification directories are deleted after success or failure.

The optional manual command requires an explicit **absolute output path outside the repository**, with an existing private parent folder; it exclusively creates the file with restrictive permissions and refuses to overwrite an existing archive. A pinned `naxx-local-resource-draft-v2` may be supplied separately to inspect approved title/content changes. It does not upload anything or publish GitHub files.

**Security boundary:** This ZIP includes the full original website resource data, not merely the changed resource fields. It must remain private. **Do not commit it, upload it to a public GitHub branch, attach it to CI artifacts, or serve it from GitHub Pages.** It is not a complete backup of the entire repository, has no Git history or external app state, and does not replace the current website's compatibility file. The final decision on committing separately managed resource files and the duplicated ~31 MB remains with CosmicCuddle.

[Editor CI run 42066172796](https://github.com/CosmicCuddle/Naxxramas-Resource-Hub/actions/runs/42066172796) passed **142/142 automated tests**, including 419-entry private source ZIP creation, archive path/CRC checks, two-stage extraction/reconstruction, byte-exact rollback, invalid source/draft refusal, replacement of the confidentiality notice, external-path-only output, no overwrites and cleanup of disposable working files. These tests verify packaging and recoverability of **candidate resource data**, not GitHub deployment or complete repository recovery.

## Git-history restore prerequisite — separate from the resource archive

The earlier **127-file tracked checkout inventory** was a source-snapshot preflight, **not** a Git backup. The editor branch now has a dedicated Git history/recovery layer, separated from the 419-entry resource review ZIP.

`editor/tools/rehearse-full-git-recovery.cjs` refuses shallow or partial clones, dirty/untracked/ignored files, symlinks/submodules and Git LFS pointers. It generates a private temporary `git bundle` with all **locally fetched refs** plus `HEAD`, then independently restores a bare mirror and detached working checkout. It proves the restored HEAD commit, root tree, tracked-file hashes/bytes, local refs and reachable Git commit count match the input. The bundle and restore folders are deleted after testing.

The optional `editor/tools/create-local-git-backup.cjs` creates a durable **local** Git bundle only when a person explicitly passes an absolute private `--output` path outside the repository. It refuses overwrite or symlink-alias paths, verifies the saved archive by **another independent restore**, and writes a private receipt and recoverability instructions using restrictive permissions. A dedicated full-depth CI job runs the saved-bundle procedure only within an OS temporary directory, immediately deletes all outputs, and publishes no artifact.

**Important exclusions:** A locally fetched Git bundle is a backup of Git objects and refs represented in that checkout—not a backup of GitHub-hosted Issues or PR discussions, settings, secrets, Pages deployment state, external forms/services, server databases, unknown remote refs never fetched or reflog-only objects. Untracked/ignored files, Git LFS pointers, submodules and partial/shallow clones are refused rather than silently assumed covered. Git history may itself contain confidential content; keep any locally saved bundle private.

**Decision gate before adopting independently editable resources:** Make and independently retain an owner-approved, verified backup for the Git repository plus any other relevant private systems, review the ~31 MB additional resource-data duplication, then test a *non-production* rebuild and rollback. This implementation does not merge, publish, commit a source-tree migration or authorise deployment.

## Unified page, navigation and resource change preflight — protected development

The next development milestone introduces two **offline, read-only planners**:

- `editor/tools/plan-page-draft.cjs`: validates the existing four-page `naxx-local-draft-v3` JSON format and all five source SHA-256 hashes (four HTML pages and `content/navigation.json`); independently reproduces the browser editor's approved text/link positions, protects script/style/form content, validates link URLs and navigation routes, and computes **in-memory** changed HTML/JSON bytes only for genuinely edited files.
- `editor/tools/plan-mixed-editor-update.cjs`: checks a clean, committed Git checkout, verifies page/navigation and/or `naxx-local-resource-draft-v2` resource changes, rehearses the proposed 418-file source tree and its exact rollback, then produces a **hash-only, non-deployable combined plan** identifying existing page paths separately from uncommitted candidate resource-fragment paths.

The plan deliberately distinguishes two facts: the five page/navigation paths are **already tracked** by Git, while `content/legacy/resources/NNNN.fragment` remains **a proposal** and cannot yet be copied to GitHub as a working website update. The existing generated `site-content.html` is never overwritten and its proposed rebuild hash is recorded for later verification. A plan refuses a mismatched expected Git commit or original file hash; it does not read or write any public server settings.

A second private tool, `editor/tools/rehearse-mixed-update.cjs`, now tests **staging and rolling back the existing page/navigation bytes** in a disposable folder. It checks that each staged file matches the independently planned SHA-256, that any untouched pages remain exactly as before, and that the entire five-file page collection is restored. It then repeats the checkout inventory to confirm Git's tracked source fingerprint and commit never changed. Resource data is separately verified using the candidate source tree and exact compatibility rollback. The tool reports changed file paths and hashes, never private text values.

**Still blocked:** The existing page draft format intentionally declares `sourceCommitVerified:false`. Although the planner verifies the exact current checkout, it **cannot retrospectively prove which Git commit a previously downloaded browser draft originated from**. It marks `draftBoundToExactCommit:false` until a future editor-draft version explicitly binds a reviewed commit, with checks for conflicts before any GitHub-ready export. Resource migration also needs owner approval, a retained full-Git-backup and compatibility/browser tests. None of the combined plan data is publishable or deployable.

## Commit-bound draft review receipts — implemented safety gate

The combined planner previously checked the **current** source commit but could not retain a durable association between an exported draft and a reviewed Git checkout. The new `editor/tools/bind-editor-drafts.cjs` supplies that *review-time* association.

A reviewer explicitly selects the **full Git commit SHA**. After independently confirming a clean Git checkout and the exact selected commit, the tool validates all existing page/navigation edits against their original file hashes and scanner positions, verifies v2 resource edits via the lossless candidate source-tree build and rollback, and computes an immutable-content **review receipt**. It includes SHA-256 fingerprints for the exact draft JSON values, the checked Git commit/tree, whole tracked repository snapshot, five original page/navigation sources plus the complete pinned original resource source, and changed-path hashes. It never embeds original text, resource IDs or entire HTML.

Later receipt validation **recomputes the whole plan** at the originally specified Git commit. It refuses altered draft values, stale commits and modified receipts. The separate local `editor/tools/create-draft-review-receipt.cjs` command can save a new `.review.json` outside the repository with restrictive permissions; it refuses overwrite and unapproved paths and does not generate a site package.

**Provenance boundary:** The browser's v3/v2 drafts are still *untrusted authoring inputs*. They do not record a verified Git HEAD. A SHA-256 receipt is **not** a digital signature, so it does **not** prove who authored an edit or when. `boundAtReview:true` means “these exact draft contents match this exact reviewed checkout now,” **not** “these edits were written at this commit.” Its flags remain `authoredAtThisCommitProven:false`, `cryptographicallySigned:false`, `githubReady:false`, `publishable:false`, `deployable:false` and `approvedByOwner:false`.

This clears a **review-time conflict-detection prerequisite**, not the resource migration or production release. Original files and draft-only combined ZIP handling remain unchanged. A final update package still requires the owner-approved resource tree, verified generated compatibility file, retained recovery package, explicit diff and owner sign-off.

## Existing-path page/navigation ZIP — commit-review gate implemented

`editor/tools/package-reviewed-page-update.cjs` provides the first **receipt-gated, review-only ZIP of genuine tracked source paths**. It requires the existing v3 page/navigation draft and the exact Git-commit review receipt, reruns all source/draft hash and checkout checks, computes changed page/navigation bytes via the independently tested static editor parser, and writes a deterministic ZIP containing only changed tracked paths plus `REVIEWED-PAGE-UPDATE-MANIFEST.json` and `READ_ME_BEFORE_GIT_REVIEW.txt`.

A draft reviewed together with v2 resource edits can also be verified, **but the resource edits are explicitly excluded from this ZIP**. The manifest says how many resource-fragment changes are absent and marks the package as a **partial website update**. This avoids a misleading single-file export or adding speculative `content/legacy/resources/` paths to the deployable file list.

Verification rejects modified draft payloads, stale commits, unexpected relative paths, forged review receipts, incorrect original/updated hashes, tampered ZIP contents and altered safety instructions. Only original tracked page/navigation paths are allowed; neither root `index.html` nor the 31 MB `site-content.html` may appear. An optional private CLI saves a new ZIP only **outside** the repository, with no overwrite, Git push, publication or server access.

**Status:** This crosses the **reviewed existing Git path** milestone, not a production release gate. The reviewed receipt is not an authentication signature and the ZIP's manifest explicitly records `ownerApproved:false`, `githubReadyForDeployment:false`, `publishable:false`, `deployable:false` and `completeRepositoryBackup:false`. The complete mixed page/resource update is still blocked on the owner-approved separate resource source tree, generated compatibility build, independently retained recovery data and owner inspection.

## Private changed-resource ZIP with complete generated compatibility preview

The new `editor/tools/package-reviewed-resource-preview.cjs` complements the existing **reviewed, changed tracked-path page/navigation ZIP**. This is the *resource review* half, not a combined production migration.

A clean checkout, verified full Git-commit review receipt and matching v2 resource draft are required. If the receipt binds any v3 page/navigation edits, the exact matching page draft is also required—but those page files are **not** included in this ZIP. The receipt and original 414-resource SHA-256 are checked independently before packaging.

The archive contains:

- Only the **edited** resource object fragments under review-only paths `CANDIDATE-RESOURCE-FRAGMENTS/NNNN.fragment`, never the unapproved live `content/legacy/resources/` directory.
- `PREVIEW-ONLY-generated-site-content.html`: the **entire reconstructed ~31 MB website compatibility source** to inspect offline, **not** a replacement for the live `site-content.html` path.
- A per-changed-fragment manifest recording both the *proposed eventual Git path* and *actual review-only ZIP path*, original/updated SHA-256, reviewed Git commit/receipt hashes, generated-source size/hash and excluded page/navigation change count.
- Private-use guidance explicitly warning that the ZIP includes full generated source, is **not deployable**, **not a complete backup**, **not** approved for upload or publication, and **cannot** be copied over the live root loader or generated site content.

Verification independently reconstructs the complete intended website bytes from the unchanged original 414 records plus the ZIP's changed fragments, compares that reconstruction with the included preview HTML, checks the manifest and warning byte-for-byte, verifies the approved 418-file temporary source-tree rehearsal and performs a byte-exact rollback to the pinned original. ZIP path allowlists, central-directory checks and CRC32 protection are also applied.

**Security and release boundary:** A private archive containing the whole generated site may contain confidential custom data. It must stay private and must not be attached to GitHub PRs, CI artifacts or a public website. The final resource source-tree migration and live compatibility builder still need owner approval, retained full-Git recovery data, repository storage review and visitor/admin validation. A resource preview archive does **not** mean the resource paths were adopted into Git.

## Paired page/resource review verification — private non-deployable integration gate

The first **cross-area integration gate** is `editor/tools/verify-paired-editor-archives.cjs`. The page/navigation changed-path ZIP and full resource-preview ZIP remain distinct and private. A reviewer supplies the **same v3 page draft, v2 resource draft, exact Git-commit review receipt and both ZIP files**.

The verifier checks that the checkout and exact draft/receipt hashes still match the reviewed Git commit, independently re-creates and validates each deterministic archive, and requires each saved ZIP to match its **entire regenerated byte stream**. Thus matching the commit name alone is never enough: a changed page, resource, safety notice, ZIP header or receipt is rejected, even when a modified ZIP has valid CRCs. It cross-checks both archive manifests' commit, tree, receipt and draft fingerprints, along with the page ZIP's excluded-resource count and resource ZIP's excluded-page count. The complete resource compatibility preview must reconstruct exactly and roll back to the pinned original.

It requires all five private files to be **outside the Git checkout**, rejects symlinks/duplicate paths and prints only a hash-and-count verification report. It creates no combined ZIP, writes no Git source and makes no online upload.

**Scope:** A matched pair represents the complete reviewed **page and resource edit intent**, not a complete set of GitHub-ready website files. The page ZIP already uses existing tracked paths, while the resource ZIP deliberately uses **review-only** fragment paths and contains an unpublishable preview HTML. Separately approved `content/legacy/` migration, generated compatibility integration, live-site simulation, retained Git recovery data and CosmicCuddle's review/approval are still required before publishing.

## Sparse integrated proposed-GitHub layout and exact rollback rehearsal

`editor/tools/rehearse-unified-source-layout.cjs` now supplies the first **combined source-path simulation**. It consumes both existing reviewed ZIPs and the same source-bound page/resource drafts and receipt, verifies their complete byte-for-byte identity, and uses **the actual ZIP entry bytes** to build an **isolated, disposable sparse workspace**. Nothing is committed to Git or merged.

The candidate contains **425 files**: the proposed 418-file `content/legacy/` resource source tree; four already-tracked page fragments; the already-tracked navigation JSON; the protected, unchanged root `index.html`; and a new generated `site-content.html` **inside the temporary test folder only**. The 418 source files retain all 414 resource objects plus original prefix, suffix, separators and a hash manifest.

After applying actual changed resource-fragment entries and page-navigation entries from the reviewed ZIPs, the tool validates all file paths, resource hashes, original non-resource source layout, reviewed page edits and unchanged loader. It independently rebuilds the compatibility website from the **staged** source fragments and requires the result to equal both the reviewed resource-preview ZIP and its expected SHA-256 **byte-for-byte**. It then restores all seven existing original tracked files, removes the candidate resource directory, checks the exact original sparse-workspace inventory, deletes the temporary folder and checks the **real** Git checkout fingerprint again.

**Important limitations:** This sparse workspace does not copy all website assets or Git history, is not a complete browser test environment, and is **not a full backup**. It only proves that the proposed independent resource-source paths and existing page paths could be combined and reversed without losing original bytes. It does **not** authorise a 31 MB source-tree migration, create a publishable repository patch, deploy a new site, change GitHub Pages, or eliminate the required owner-verified backup.

**Next gate:** An explicit owner decision about adopting `content/legacy/` and handling the duplicated source storage. Only after that decision should we plan a real complete checkout preview, demonstrate compatibility runtime equivalence and construct a separate owner-reviewed GitHub change set with rollback instructions.

## Proposed long-term source layout

A possible future repository layout, only after tests and owner approval:

    content/
      legacy/
        manifest.json
        resources/
          0001.fragment
          ...
          0414.fragment
        layout/
          prefix.utf8
          suffix.utf8
          separators.json

    site-content.html                (reproducibly generated compatibility output)
    index.html                       (existing small loader — preserved)

The exact paths are **proposed**, not yet in the repository. Before adopting them, confirm repo size, GitHub Pages limitations, and whether a more compact lossless layout is better. Keeping both the original content and the generated compatibility output could temporarily duplicate substantial data; do not commit that duplication without review.

## Private resource title and content drafts — working development prototype

The protected branch has a separate, **offline** resource editor panel in `editor/index.html`. It reads a selected exact original `site-content.html`, checks its complete **30,976,969-byte SHA-256 fingerprint**, then displays the 414 original titles, sections and content values. It does **not** evaluate the old website's JavaScript, publish or overwrite any source, or silently accept a different baseline.

The read-only source audit established **414 static string-literal content fields**, **121 intentionally empty** and **288 multiline**, up to **19,165 decoded characters**. No HTML-like tags or unsafe control characters were detected in those original fields. The panel permits edits only to original titles and multiline **plain-text content**, up to 30,000 characters for changed content. It keeps all IDs, class associations, unknown custom fields, the separate 29-record collection and scripts unchanged. It does not render user-entered content as HTML or allow markup injection. Clearing existing nonempty content needs explicit confirmation.

**Local draft format:** `naxx-local-resource-draft-v2` stores only edited resource positions and their changed title/content fields with the pinned source hash. Old `naxx-local-resource-title-draft-v1` files are still importable as title-only changes. Imports reject wrong source hashes, unexpected fields, duplicated/out-of-range positions, invalid content and unchanged values. Failed loads preserve current work.

**What this is not:** The local JSON draft is **not** an edited resource archive, reviewed site-output builder, original HTML replacement, full website backup, GitHub-ready changed-files ZIP or authorised deployment. It remains separate from the four-page/navigation save system until a unified audited export is designed.

**Test evidence:** [Editor CI run 42054557700](https://github.com/CosmicCuddle/Naxxramas-Resource-Hub/actions/runs/42054557700) passed **108/108 component tests** plus a real Chrome functional test of title/content editing, draft download/restore and safe source rejection. Another exact-baseline rehearsal changed one multiline content field in memory and preserved the other **413 resource fragments** and *all non-resource website bytes*. No edited website, source archive or public page was written.

**Remaining browser and release gate:** Owner visual/keyboard review, full original resource-data relationships and the legacy admin workflow, GitHub-ready multi-file export with changed-fragment checksums, a complete independently validated repository backup/recovery plan, and owner approval before any merge. An intentional rebaseline is required for any future original source version.

## Two-area local review package — implemented, not yet a deployable export

The private development editor now offers **Save Combined Review Package (.zip)**. It keeps the two editor areas in **separate files within one ZIP**, rather than combining source HTML or flattening the 414 resource objects.

Expected filenames are fixed by a dedicated review-only allowlist:

    REVIEW-PAGE-DRAFT.json          (only when page/navigation changes exist)
    REVIEW-RESOURCE-DRAFT.json      (only when applied resource edits exist)
    REVIEW-MANIFEST.json
    READ_ME_FIRST.txt

The page draft retains the existing `naxx-local-draft-v3` source hashes and four original page path records. The resource draft retains `naxx-local-resource-draft-v2` with the SHA-256-pinned 414-resource baseline and changed text fields. The manifest contains SHA-256 and UTF-8 byte sizes for included drafts, declares itself **not publishable**, **not GitHub-ready** and **not a full repository backup**. Recovery is by extracting privately and importing each draft through the existing matching UI. Unapplied resource text is not silently bundled.

**Important boundary:** These review filenames are **not** final website paths. The existing page-only *Export Changed Files* ZIP remains restricted to real paths such as `rules/content.html` and `content/navigation.json`. The new review ZIP is restricted to the four review filenames. Neither writer can emit `index.html` or the 31 MB `site-content.html` from its normal API. The planned numeric `resources/0001.fragment` source paths are still **not committed to this repository**, so claiming a GitHub-ready unified export would be premature.

[Editor run 42058261964](https://github.com/CosmicCuddle/Naxxramas-Resource-Hub/actions/runs/42058261964) passed **113/113 tests**, including review archive paths and SHA-256 integrity checks. A subsequent real Chrome smoke downloaded the resource-only review ZIP and confirmed it contained no deployable website file. No live source, visitor page, admin form or backup branch was modified.

**Next release gate:** Design and verify a deterministic, reviewable builder that turns source-fingerprint-verified v2 edits into separately stored source fragments, produces an exact compatibility output, includes changed-path manifests for both page and resource files, and validates a complete repository backup and rollback. Do not extend the current GitHub-path export whitelist to hypothetical fragment paths before these conditions are satisfied.

## Planned editing contract

1. A resource's original stable id is **immutable** in the initial editor. The 414 initial IDs are distinct after decoding; changing names/titles never changes these IDs.
2. The editor can expose safe individual fields such as a title or carefully controlled HTML content only after its schema is verified. The first experimental title edit changed **one** resource in memory while preserving the other **413** exactly.
3. Unknown/custom fields must remain untouched, byte-for-byte, unless a separately reviewed migration handles them. No general-purpose object reserialization that removes unrecognized fields.
4. Resource order, class-association arrays, section values, the separate 29-item collection, and all image/script/style content must remain intact.
5. Every export includes original and updated source hashes, per-file checksums, a changed-path list, the current output builder version and plain-language review instructions.
6. A stale source hash or conflicting GitHub branch must **stop** the process; never silently overwrite a newer file.
7. A generated compatibility site-content.html, when still needed for the current visitor website, must be compared against a checked, disposable rebuild before a reviewed PR is merged.

## Required future validation

The release gate must eventually verify three separate layers:

**A. Byte preservation:** when nothing is edited, the generated source must equal the original file byte-for-byte; when one field is edited, only the expected span and generated checksums can change.

**B. Data compatibility:** all 414 original IDs, seven section values, class associations, resource order, 29-item collection, custom properties, and all 95 embedded image references must survive the output generation. A future different source baseline requires an explicitly reviewed inventory update.

**C. Visitor/admin behaviour:** browser tests must check desktop and mobile layouts, original navigation, class/dungeon/raid resource pages, search, media, old admin edit functions, application privacy and Game Clients. A byte-level test alone does not prove runtime compatibility.

**D. Side-collection usage:** the separate 29 records contain 174 nested objects, 696 nested object properties and 87 literal Boolean settings in the verified original. A read-only script scan found 13 candidate direct dot-style accesses to the side collection, versus 31 candidate direct accesses to the main resources. This is not a verified call graph. All 29 records and their nested structure must remain intact in the original source prefix/suffix; tests must also prove that existing consumers continue to work. Do not split the side collection independently, deduplicate fields, or treat the absence of literal ID matches as absence of dependencies.

**E. New editor conflict and recovery checks:** when the future user-facing resource editor is introduced, verify that stale original hashes, altered fragments, removed custom properties and inconsistent output manifests all stop export. A ZIP with only changed resources cannot be described as a whole-site backup; separate validated full-repository snapshots remain a release requirement.

**F. Original mutation compatibility:** the fixed original source contains 13 candidate direct accesses to the separate 29 records (including two recognized array-mutator calls and one shallow member-assignment pattern), and 31 to the 414 main resources (including seven direct-reassignment patterns). These are *lexical patterns*, not a runtime call graph. An editor cannot assume one source collection is read-only or safely disposable. CI now verifies that synthetic first/last resource title edits preserve the original prefix/suffix and the original script-access candidate counts. Browser tests must still exercise genuine admin editing, saving, resource display and rollback without reaching public forms or changing published data.



## Publishing and recovery

The owner will continue to use a separate GitHub branch and pull request for changes. The pristine backup branch remains untouched. The changed-files ZIP will be separate from an optional **complete, validated repository backup ZIP**. Neither a draft nor a temporary dry-run should be described as a full backup.

The site-wide backup must come from an actual, complete repository tree, not from a handful of selected editor files. The static GitHub Pages admin password is only a visible UI gate, not secure authentication. The long-term editing interface should therefore be distributed locally or privately.

**Current result:** The original 414 separate files can be reassembled byte-for-byte. A new disposable **edited-fragment** rehearsal successfully changes a title in just one temporary resource fragment and rebuilds the full 30,976,973-byte compatibility source, preserving the other 413 records and every byte outside the original resources array. The unmodified manifest rejects the changed fragment as intended. Tests reject unrelated fragment corruption, unexpected target changes, invalid titles, and a modified source baseline. [Editor CI run 42047956345](https://github.com/CosmicCuddle/Naxxramas-Resource-Hub/actions/runs/42047956345) passed **83/83 tests**; its temporary test folders were deleted. This is only a private test, not a resource editor, a versioned editable archive, a production output builder, a validated repository backup, an export ZIP or browser acceptance proof.

**Still required:** production-safe edited manifests with source/version conflict detection, extending the verified title/content draft interface to other custom resource fields only when safe, a unified page/resource change review and GitHub export, whole-repository recovery validation, complete side-collection consumer coverage, visitor/admin browser testing and explicit CosmicCuddle approval before any merge. No resource JSON draft can be imported directly into the live website.
