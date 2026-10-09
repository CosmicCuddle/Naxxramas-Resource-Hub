# Frostbound polish — main Class Handbooks and Patch/Change Notes

Date: 2026-10-09

## Exact diagnosis from original source

Original file: `site-content.html` (31 MB; unchanged).

The main-class renderer creates `.main-class-template-item > .card .rich`.
However, `applySpecProgressionView()` selects `.main-class-template-card .rich`,
which the renderer never creates. The native `filterRichProgressionSections()`
is correct, and each class' General Tips data already contains all four
`# Overview`, `# Vanilla`, `# TBC`, and `# WotLK` sections.

**Repair:** `assets/naxx-handbook-progression-fix.js` calls the native filter
for the actual main class card selector after native tab switches and rerenders.
No original content, editor code, IP era definitions, or existing spec
handbook filter is modified. When the expected DOM or active tab is absent it
does nothing. The actual display update is performed by the same native
function that is used for specialisation handbooks.

## Theme

`assets/naxx-notes-handbook-frostbound.css` is a dedicated final stylesheet,
loaded after the approved Frostbound components.

1. Main class handbook cards: the existing `--handbook-box-background`
   variable is temporarily overridden via CSS, turning the near-black
   translucent default panel into permanent Frostbound steel/navy, including
   before hover. The underlying user-set colour/transparency data is
   untouched; the font/heading contrast and selected era tabs are restyled.
2. Patch Notes and Change Notes: the original CSS forced Patches to 3 columns
   and Change Notes to 2 at high resolutions. Both routes now have **one
   readable responsive article column** and wide, consistently blue note cards.
   All original content, dates, edition headers, jump index entries and
   back-to-contents actions remain in place.
3. Notes jump index: Frostbound blue panels and chips replace the old black /
   brown UI. The compact index scroll height (168px, 188px small screens)
   implemented in the loader remains unchanged.
4. Patch download CTA: restyled as a blue panel with antique-gold accent.

## Test results

- Native filter code tested with each of Overview, Vanilla, TBC and WotLK
  using converted Markdown-style sibling headings.
- Runtime wrapper tested with mock original page controls and main-class
  resource cards; all four selected expansions display only their own content.
- Source audit confirms General Tips content has these four headings for all
  10 playable classes, including Deathknight.
- Original site, notes and talent files remain unmodified, with checks against
  their Git SHAs.
- Wrapper script syntax, CSS braces, and script ordering verified.

**Real-browser visual testing is still required**, especially main Paladin,
Warrior and Deathknight handbook tabs, and the notes jump-index buttons.

## Rollback

Backup: `backup/pre-handbook-era-and-notes-redesign-2026-10-09`

Backup commit: `956d5ebdbebb24f6c32350c59bbf583b6a1e626a`

Revert the release PR to remove the two assets and their links. Neither
`site-content.html` nor the two 31 MB notes content files were edited.
