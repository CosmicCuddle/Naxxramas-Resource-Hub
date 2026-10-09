# Naxxramas Resource Hub

The Naxxramas Resource Hub provides guides, event countdowns, Patch Notes,
Change Notes, and the server-specific Talent Calculator.

## Live site

- [Resource Hub home](https://cosmiccuddle.github.io/Naxxramas-Resource-Hub/)
- [Patch Notes](https://cosmiccuddle.github.io/Naxxramas-Resource-Hub/patches/)
- [Change Notes](https://cosmiccuddle.github.io/Naxxramas-Resource-Hub/change-notes/)
- [Talent Calculator](https://cosmiccuddle.github.io/Naxxramas-Resource-Hub/talents/)

## Active files

- `index.html` loads the original `site-content.html` resource website.
- `patches/` and `change-notes/` host the corresponding notes and navigational wrappers.
- `talents/` contains the published, server-specific Talent Calculator and data.
- `assets/naxx-countdowns.*` provides realm event countdowns.
- `assets/naxx-theme-v2.css`, `assets/naxx-theme-v3.css`,
  `assets/naxx-resource-navigation.js`, and
  `assets/naxx-handbook-progression-fix.js` maintain existing website functionality.

The three approximately 31 MB original source pages are intentionally kept
unchanged. Do not casually rewrite them when modifying lightweight wrappers.

## Legacy design history and recovery

The retired `trial/` prototypes (including the trial-only Talent Calculator),
unused Frostbound styles/scripts, and an exact duplicate of `site-content.html`
previously stored in `backups/index-2026-10-08.html` were removed from the
active branch to make the repository easier to maintain. The production
`talents/` calculator remains intact.

Original development and restoration notes are retained under `docs/archive/`.

The entire pre-cleanup repository, including all retired files, is preserved in:

`backup/pre-resource-hub-cleanup-2026-10-09`

To undo the cleanup, create a new revert commit of the cleanup PR. Do **not**
reset `main` or overwrite later work.
