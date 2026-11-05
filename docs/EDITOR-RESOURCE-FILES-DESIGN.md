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

## Private title-only draft screen — first working prototype

The protected development branch now includes a separate **offline resource-title panel** in \`editor/index.html\`. It opens a user-selected original \`site-content.html\` file, verifies all 30,976,969 bytes against the fixed SHA-256 baseline, then lists the 414 original resource titles and section labels. It does **not** execute the HTML, upload it, overwrite it, or load arbitrary newer versions. Only the title field can be changed, with an explicit Apply Title Edit control.

The panel has search, selected-title revert, all-title revert, and **Save/Load Resource Draft** actions. The draft format \`naxx-local-resource-title-draft-v1\` saves only changed positional titles plus the pinned baseline hash. Import rejects mismatched baselines, altered keys, duplicate indices, unsafe titles and unchanged entries. Failed imports keep existing in-memory edits. The title draft is **not** included in the four-page/navigation ZIP exporter, cannot generate a modified \`site-content.html\` and is not publishable to GitHub.

Automated Node tests cover baseline hashing, 414-record extraction, malformed inputs, draft round trips, and simulated local UI clicks. [Editor CI run 42050830392](https://github.com/CosmicCuddle/Naxxramas-Resource-Hub/actions/runs/42050830392) passed **94/94 tests**.

An independent [headless Chrome workflow run 42051908181](https://github.com/CosmicCuddle/Naxxramas-Resource-Hub/actions/runs/42051908181) also passed the complete first-stage local draft flow: the original source fingerprint loaded 414 items, one title edit was staged, a JSON draft downloaded and restored, and a wrong replacement source was rejected without losing existing edits. It used a loopback-only test server and disposable browser/download directories. **This is a browser functional smoke test, not final owner visual/accessibility approval or permission to merge.**

**Boundary:** Automated component tests and a first real Chrome functional smoke have passed, but full desktop/mobile visual/accessibility acceptance and owner review have **not**. Full original resource-content editing, verified changed-fragment manifests, GitHub-ready export and publishing controls remain unimplemented. The pristine backup and public website have not been changed. A future original-source revision requires an intentional rebaseline and owner review, never a silent bypass of the hash.

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

**Still required:** production-safe edited manifests with source/version conflict detection, expansion of the private title-only screen into a verified *full-content* resource editor, changed-path GitHub export, whole-repository recovery validation, complete side-collection consumer coverage, visitor/admin browser testing and explicit CosmicCuddle approval before any merge. The title-only draft cannot be imported into the live website.
