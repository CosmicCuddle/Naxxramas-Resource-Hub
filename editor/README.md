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

## Remaining development

1. Test the local preview and all revert buttons in Edge/Chrome on a disposable copy, including draft restore, ZIP validation, icons and keyboard access.
2. Improve preview fidelity carefully without executing scripts or submitting external forms.
3. Migrate the original site resource DATA in verified, reversible batches without losing its IDs, images, class/dungeon associations or other custom fields.
4. Add complete repository backup/export from a verified tree, conflict checks and safer publishing guidance.
5. Choose a genuinely private authoring distribution method. Obtain owner approval before release.

The live website and pristine backup must remain unchanged.
