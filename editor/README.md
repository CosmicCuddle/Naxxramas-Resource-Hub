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

The original 31 MB site-content.html, original resource records, older menu entries, class/dungeon handbook data, overlays and page layout are **not** editable through this prototype yet.

Game Clients now lives in a separate HTML fragment instead of a JavaScript string. Its display script fetches that fragment from the same repository, and leaves the legacy client card visible with a warning if the new file cannot be read.

The newer-menu script reads metadata from content/navigation.json. It retains original labels and icons as a fallback and rejects unexpected routes, groups, and icon filenames. The application privacy and form-loading code has not been changed.

## How to open this local prototype

1. Download the feature/multi-file-editor-export-2026-11-05 branch ZIP from GitHub.
2. Extract the whole repository into a disposable folder outside your working Git checkout.
3. Open editor/index.html with Microsoft Edge or Google Chrome on your computer.
4. In the editor, choose the extracted Resource Hub folder.
5. Use the page search/edit controls or the separate navigation editor.
6. Press Preview Current Page to inspect a simplified offline rendering of your edits. Press Revert Page Edits or Revert Navigation Edits to discard only that area; Revert All Unexported Edits discards all local edits after confirmation.
7. Save Draft downloads a JSON file. Export Changed Files downloads only changed content paths, a SHA-256 manifest and review instructions.

The editor only reads local user-selected files; it neither overwrites them nor uploads or publishes changes. Its preview is a **simplified visual approximation**, not the full website. A sandboxed iframe with a restrictive Content Security Policy excludes external images, clickable links, scripts, videos, and the application iframe. It cannot submit real applications. Do not treat the preview as proof that the public page will look or behave identically. The website's Game Clients and menu scripts separately fetch public same-origin content when a visitor loads the site.

**Do not apply an exported ZIP directly to main.** Use a disposable Git checkout, compare original file hashes from the manifest, inspect changed files, run tests, then open a PR. The exported source branch hint is not verified evidence that a selected local folder came from a particular commit.

## Saving behaviour and limits

- Draft format naxx-local-draft-v3 is a local downloaded JSON file, not autosave, publication, or a full repository backup.
- Draft restore demands exact source SHA-256 fingerprints for all four page files and the navigation file; mismatches are rejected.
- Changed-files ZIP paths are restricted to the four page HTML files and content/navigation.json plus the manifest and instructions. It cannot contain a replacement root index.html.
- HTML edits change only existing text fragments and href values, not whole document structure or application embed attributes. Unsafe links are rejected.
- Navigation changes are limited to approved text/icon fields; existing slugs, links and grouping are fixed. Icon names must be existing WoW JPG filenames, not URLs.
- Browser folder selection uses webkitdirectory. Edge and Chrome are the intended browsers; all browser versions have not been tested.
- No authentication, private online publishing, rich-text formatting, new download cards, image uploading, full site backups, layout editing, or editing of the original 31 MB resource DATA yet.
- Revert buttons discard local unsaved edits after explicit confirmation; they do not change files on disk. Preview does not auto-refresh while typing—press Preview Current Page again after editing.
- The local editor should remain privately distributed. A public GitHub Pages UI lock cannot protect confidential admin operations.
- To preserve a full copy, separately use the untouched GitHub backup branch and download the complete repository ZIP.
- Do not put applications, passwords, account information, private realm addresses or proprietary WoW game binaries into public content.

## Tests

A scoped read-only GitHub Actions workflow executes all editor regression tests.

To run locally from the repository root:

    node --test editor/tests/*.test.cjs

These tests cover ZIP paths, hashes and CRC; edits against the actual content fragments; the Game Clients loader and fallback; navigation JSON loading and fallback; and protection of the small root loader.

**Browser-level visual testing, form behaviour, complete ZIP extraction and real publishing are not confirmed by Node tests.** Manual testing is required before any merge.

## Remaining development

1. Test the local preview and all revert buttons in Edge/Chrome on a disposable copy, including draft restore, ZIP validation, icons and keyboard access.
2. Improve preview fidelity carefully without executing scripts or submitting external forms.
3. Migrate the original site resource DATA in verified, reversible batches without losing its IDs, images, class/dungeon associations or other custom fields.
4. Add complete repository backup/export from a verified tree, conflict checks and safer publishing guidance.
5. Choose a genuinely private authoring distribution method. Obtain owner approval before release.

The live website and pristine backup must remain unchanged.
