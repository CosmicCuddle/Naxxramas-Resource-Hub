# Website editor and GitHub-ready saving — design proposal

**Status:** PROPOSED, owner decision required. This document is a planning record only. No changes to the public website, admin UI, existing resource data, client downloads or publication process are authorised by this draft.

## Problem confirmed from current `main`

1. The legacy admin action `exportUpdatedHtml()` serialises the current `DATA` into a cloned complete document and produces a ZIP containing exactly `index.html` and `HOW_TO_UPDATE_GITHUB.txt`. The included instructions explicitly tell the owner to overwrite root `index.html` and commit to `main`. This is **incompatible with our current small loader** (root `index.html`), which dynamically loads `site-content.html` plus scoped website assets. An earlier wrong-root replacement incident is documented in `docs/PROJECT-ROADMAP.md`. **Do not follow the old export instructions on current main.**
2. Three new pages (`new-players/`, `rules/`, `apply/`) have their own `content.html` files loaded by `assets/naxx-three-pages.js`; their navigation labels and icons are created by script and deliberately have no original native edit controls. Their text and menu choices cannot be updated by the old `DATA` export.
3. Game Clients is rendered from `assets/naxx-game-clients-guide.js`; the legacy native ChromieCraft card remains in admin mode but does not control the visitor-facing cards. Thus edits to the legacy card will not update the new downloads.
4. Original content is substantial: `DATA.resources` currently has **414 entries**, class and dungeon details/background data are embedded, and the original `site-content.html` is about **31 MB**. The existing embedded data includes large image data URLs. A one-shot rewrite risks losing data and disrupting scripts.
5. The existing public static site includes a client-side admin password setting. A static GitHub Pages UI lock is **not secure authentication**. Do not copy passwords/secrets to new exported public content or treat the public UI lock as protection of private information. The long-term authoring tool should be local/private; GitHub sign-in remains the publication boundary.

## Proposed user workflow

- **Edit Page:** original native editor plus added editing controls for the three newer pages, Game Clients, menu labels/icons, and future content sections. Preserve the existing visual theme.
- **Save Draft:** store an explicitly labelled *local, unpublished* draft for recovery (prefer IndexedDB for larger content/media); clearly warn that browser data can be cleared. It is not a GitHub commit, deployment or reliable sole backup.
- **Export Changed Files:** download one ZIP with **only changed, validated content files**, located at their exact repository paths, plus a manifest and instructions. Include a preflight comparison against the known starting Git commit, to detect stale edits before overwriting current work.
- **Export Full Website Backup:** optional separate ZIP preserving the **whole compatible repository tree** (pages, code, styling, assets, data, downloads and required dependencies), not a combined `index.html`. Build from a verified local repository checkout or validated complete fetch; never silently substitute a partial snapshot.
- **Publish:** extract into a **new Git branch** using GitHub Desktop; review changed files, run CI, create a PR and merge only after owner approval. Never have the browser silently upload credentials or write to `main`.

Each button must communicate accurately whether it saved locally, downloaded a ZIP or published remotely. None should report a successful GitHub update merely because a file downloaded.

## Target file structure (illustrative, subject to implementation review)

```text
Naxxramas-Resource-Hub/
  index.html                  # tiny loader, preserved; never replace with a site export
  site-content.html           # legacy shell until separately migrated
  content/
    site.json                 # public site text and display settings, no credentials
    navigation.json           # editable menu labels, icons and target routes
    resources/
      general.json
      class-handbooks.json
      dungeon-handbooks.json
      playerbots.json
      other-sections.json     # migration mapping verified against current IDs
    handbooks/
      class-details.json
      dungeon-details.json
    media-map.json            # references checked-in files, not embedded credentials
  new-players/content.html
  rules/content.html
  apply/content.html
  apply/naxxramas-application.docx  # approved blank template only
  game-clients/content.html   # future move from JS hardcoding
  assets/
    ...existing shared JS/CSS/images...
    media/                    # extracted assets after a separately tested migration
  patches/                    # existing standalone routes preserved
  change-notes/               # existing standalone routes preserved
  talents/                    # existing talent-calculator app preserved
```

The exact `content/resources/` group split must follow the existing `DATA` model and UI semantics, not guessed categories. Preserve all resource IDs, sort order, classes, expansion stages, custom fields and existing module overlays. Leave standalone tools/applications and their code intact until individually migrated. The complete repository snapshot must include all required files even when a page has no new edits.

Example ZIP for a small change:

```text
Naxxramas-Website-Update.zip
  UPDATE-MANIFEST.json        # origin main SHA, schema version, changed paths and hashes
  HOW_TO_APPLY.txt            # copies into existing GitHub checkout on a new branch
  rules/content.html
  new-players/content.html
  content/navigation.json
```

The ZIP must never contain a replacement root `index.html` for routine content updates. Do not include applicant submissions, realmlist/realm address, admin passwords or third-party WoW client binaries.

## Incremental implementation order

### A. Preservation and exporter safety
- Record pre-change baseline commit; create a dedicated backup ref and verify it equals current main.
- Snapshot original file list and content hashes. Record expected counts for `DATA.resources`, class/dungeon records, media and all standalone routes.
- Add read-only tests documenting the *old* export defect. Prepare an isolated replacement exporter: no changes to production while under review.
- Remove the obsolete instruction to replace `index.html` **only when** the replacement can preserve and update legacy `DATA` safely.
- On first release, the replacement may update **`site-content.html` as a compatibility file** while new pages remain separate. A complete per-section data split follows only after equivalence proof.

### B. Editable newer pages
- Add an editor adapter for `new-players/content.html`, `rules/content.html`, `apply/content.html`, and the new Game Clients content file.
- Let the owner edit approved text, headings, links and menu labels; keep form embed mechanics, script tags, private onboarding restrictions and account/application processing outside generic rich-text editing.
- Use a single source of truth for public download cards. Do not rely on legacy ChromieCraft editor data that the visitor guide ignores.
- Provide visible unsaved-change status, cancel/revert and preview. Do not silently mutate the live published site.

### C. Split original legacy `DATA` safely
- Convert sections in small batches, starting with simple site text/navigation, then resource groups, then class/dungeon details.
- Preserve embedded images until a verified asset-extraction path is available; then move them to stable binary files and use references. Do not drop or recompress images silently.
- Generate/validate the compatibility output against the old renderer while migrating. Only remove the monolithic source after a full round-trip comparison and owner approval.
- Never commit public credentials to the new JSON files. Design a private/local editor login model separately rather than copying the existing client-side password.

### D. Automated release validation
- Export -> extract -> import -> compare all editable records without loss, including empty fields, Unicode, images, class/dungeon associations, links, menu order, progression restrictions and Tally presentation.
- Assert **all** existing routes load in browser; Game Clients shows only ChromieCraft + owner-approved archived Warmane; no Eternion; no public realm details; admin mode visual state does not break visitor view.
- Verify files are in the exact GitHub directory paths, expected manifest hashes match and root loader remains unchanged. Reject unexpected paths, duplicate entries and missing dependency files.
- Test Windows folder extraction and GitHub Desktop review on a disposable checkout first. No direct `main` changes or automatic GitHub writes.
- Owner performs one no-save admin inspection and later a separately approved disposable **edit -> save draft -> export -> GitHub PR preview** test; confirm rollback works before release.

## Approval decisions still needed

1. Preferred authoring location: **local/private editor** (recommended) versus keeping a public editor with the understanding that its password is only a UI gate.
2. Should the default export be **changed files ZIP** (recommended) with a second **full backup ZIP** button?
3. New-page editor scope: text, links, menus and downloadable-resource metadata first; richer page-layout editing after a proven safe release.
4. Confirm the incremental migration approach rather than replacing the 31 MB legacy site in one operation.

**No decision is implied by the creation of this document.** CosmicCuddle is the final decision-maker. Do not merge, migrate, replace root files, publish or change administrator authentication without explicit approval.
