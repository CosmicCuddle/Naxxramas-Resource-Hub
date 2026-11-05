# Naxxramas local website editor — development prototype

**Status: DRAFT. Not approved for merge or publication.**

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

The editor only reads local user-selected files; it neither overwrites them nor uploads or publishes changes. Its preview is a **simplified visual approximation**, not the full website. A sandboxed iframe with a restrictive Content Security Policy excludes external images, clickable links, scripts, videos, and the application iframe. It cannot submit real applications. Do not treat the preview as proof that the public page will look or behave identically. The website's Game Clients and menu scripts separately fetch public same-origin content when a visitor loads the site.

**Do not apply an exported ZIP directly to main.** Use a disposable Git checkout, compare original file hashes from the manifest, inspect changed files, run tests, then open a PR. The exported source branch hint is not verified evidence that a selected local folder came from a particular commit.

## Saving behaviour and limits

- The four-page/navigation draft format `naxx-local-draft-v3` is a local downloaded JSON file, not autosave, publication, or a full repository backup.
- The separate resource draft format is `naxx-local-resource-draft-v2`, which stores only changed title/content fields by resource position and the pinned original source hash. Older title-only `naxx-local-resource-title-draft-v1` files can be restored. Neither contains all 414 original records, full source HTML or a GitHub-ready website export.
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

This test **does not** save an edited file to the repository or provide a user-facing resource editing screen. Changed-file export, approved edited manifests, actual browser validation and safe GitHub publication remain separate future tasks.


See docs/EDITOR-RESOURCE-FILES-DESIGN.md for the proposed eventual GitHub folder layout, stability rules and release gates.

**Part 08 data-consumer safety checks:** All 29 side records remain separate from the 414 main resources. An aggregate-only lexical scan classified 13 possible direct accesses to the side collection (two known mutator-call patterns, one shallow member assignment, ten other accesses) and 31 to the main resources. These are code-pattern candidates only, not evidence of executed write paths. In-memory synthetic title edits of the first and last resources leave the full original source outside the resources array unchanged and preserve the code-access candidate counts. [GitHub editor run 42047159391](https://github.com/CosmicCuddle/Naxxramas-Resource-Hub/actions/runs/42047159391) passed 78/78 tests.

The candidate audit tool can be run locally with \`node editor/tools/audit-side-consumers.cjs\`. It prints counts only; it does not log original resource names, IDs, URLs, script text or fields. This audit is **not** a usable original-resource editor or a substitute for manual visitor/admin browser testing.



## Multiline content milestone — 5 November 2026

The baseline audit confirmed **414 string-literal content fields**, including **121 originally empty** values and **288 containing line breaks**; maximum decoded length was **19,165 characters**. No HTML-like tags or disallowed control characters were found. The v2 resource draft editor retains line breaks, does not execute markup, and permits intentionally empty content after a clearing confirmation.

[Editor CI run 42054557700](https://github.com/CosmicCuddle/Naxxramas-Resource-Hub/actions/runs/42054557700) passed **108/108 Node component tests** and a real local Chrome smoke test of title/content draft download and restore. A protected source-rebuild rehearsal changed one content field and verified the other 413 resource fragments and every non-resource byte remained untouched.

**Limit:** This is a local draft only. No edited resource files, compatibility HTML output, full-site backup or GitHub-ready resource export have been produced for the owner. The public website is unchanged.

## Original large website audit (read-only)

Before any migration of the large original site file, run this from the repository root:

    node editor/tools/inspect-legacy.cjs

This reads only the local site-content.html file and prints its byte length, hashes and limited structural marker totals. The reported resource record count is deliberately null because counting marker text is **not** proof of a complete resource inventory. No source text, application information, passwords, addresses or image content is printed, and no files are rewritten.

The editor CI workflow runs this aggregate-only inventory on its complete GitHub checkout. Do not proceed with a data split until we have a trustworthy complete record of IDs, categories, class/dungeon associations, embedded images and overlay dependencies. Existing original resource DATA and all custom features must remain unchanged until separately reviewed.

## Remaining development

1. Test the local preview and all revert buttons in Edge/Chrome on a disposable copy, including draft restore, ZIP validation, icons and keyboard access.
2. Improve preview fidelity carefully without executing scripts or submitting external forms.
3. Migrate the original site resource DATA in verified, reversible batches without losing its IDs, images, class/dungeon associations or other custom fields.
4. Add complete repository backup/export from a verified tree, conflict checks and safer publishing guidance.
5. Choose a genuinely private authoring distribution method. Obtain owner approval before release.

The live website and pristine backup must remain unchanged.
