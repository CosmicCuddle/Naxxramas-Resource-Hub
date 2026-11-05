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
