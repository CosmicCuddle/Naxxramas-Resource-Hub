# Naxxramas local website editor — early prototype

**Status: Development branch only. Not approved for merge or use on the public website.**
This prototype belongs to the staged editor/save redesign proposed in PR #55.

## What works in this first stage

- Choose an **extracted copy** of the Naxxramas-Resource-Hub repository using Microsoft Edge or Google Chrome on a desktop.
- Edit existing **text runs** and **link addresses** from the New Players, Server Rules and Apply to Join HTML page fragments.
- Search for the wording to edit, switch between the three pages, and see which fields are changed.
- Download a **Save Draft** JSON file and load it later **only against the exact same starting HTML files**. A mismatch is rejected.
- Download a **Changed Files ZIP** containing the changed page files in their exact GitHub paths, a SHA-256 manifest for review, and manual publishing instructions.
- Save without modifying the selected folder, the GitHub repository or the published site.

Only text and link attribute byte ranges are replaced. Unedited text, HTML structure, CSS classes, IDs, embedded application markup and scripts are left in the original source. Link protocols are validated before export. Edits that unexpectedly alter the number of editable text runs fail closed.

## How to open the prototype (not a live-site test)

1. Download the feature/multi-file-editor-export-2026-11-05 branch as a ZIP from GitHub.
2. Extract it into a separate location outside your working Git repository.
3. Open editor/index.html directly in **Edge** or **Chrome**.
4. Select that extracted folder using the file picker at the top of the editor.
5. Edit a text field. Use **Save Draft** for an unpublished JSON copy, or **Export Changed Files** for a review-only ZIP.

If you change the website files between sessions, load a fresh starting folder. A draft made from an older copy is rejected rather than silently applying changes to different content.

## Important limitations

- **Do not merge this editor into main without a separate decision about private distribution.** A folder committed to a public GitHub Pages repository may become publicly viewable even if the editor cannot publish changes. The long-term authoring tool should live privately or locally.
- This is **not** the original 31 MB website editor. It cannot yet edit the original resources, class/dungeon records, image assets, Game Clients, navigation icons or page layout. The complete site still needs a carefully validated migration.
- Folder selection uses the Chromium webkitdirectory browser capability. Other browsers may not support it.
- This early prototype has no full preview, undo history, automatic GitHub upload, authentication, or reliable automatic browser autosave. Save Draft explicitly downloads a JSON file.
- Exported ZIP files **are not ready to copy onto main**: a reviewer must compare SHA-256 hashes against the source checkout, inspect the diff, test all pages and use a separate PR. The manifest includes a historical reference commit as an **unverified hint**, not as evidence of the selected folder's actual Git commit.
- A changed-files ZIP is **not a full backup**. Use the untouched GitHub branch backup/pristine-pre-editor-redesign-2026-11-05 or download the full repository separately.
- The browser editor does not read or upload applications, private realm information, saved passwords, or the original site loader. **Never enter private connection data or credentials into public page text.**
- **Do not use the old website exporter** to replace root index.html; the current loader must remain intact.

## Test command for developers

Run from the repository root:

    node --test editor/tests/export.test.cjs

Automated tests cover ZIP container structure, stored-file CRC, UTF-8, folder paths, blocked traversal/duplicates, SHA-256, and basic script compilation. **Browser-level edit/draft/export tests have not yet been run**, and no end-to-end deployment test has been performed.

## Next planned stages

1. Browser-level tests with disposable copies of all three HTML pages; improve accessibility, exact text preservation and controlled preview.
2. Build single-source editable Game Clients content and editable navigation labels/icons without breaking the existing theme.
3. Build a safe compatibility exporter for original site-content.html and its resource DATA; migrate in verified batches.
4. Add full-site backup from a complete verified local source tree, conflict detection, automated route checks and safe GitHub Desktop PR instructions.
5. Owner reviews and approves a distribution location and a disposable manual test; only then consider release.

The live website and pristine backup must not be changed by this prototype.
