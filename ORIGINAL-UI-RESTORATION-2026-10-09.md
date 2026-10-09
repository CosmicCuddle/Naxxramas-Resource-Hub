# Return to original Resource Hub interface — 9 October 2026

## Scope

The user approved restoring the original Naxxramas Resource Hub look after
Frostbound's layered styles caused inconsistent blue / black / gold surfaces.

This change **restores the three lightweight original page loaders** from
`backup/pre-frostbound-live-launch-2026-10-08`, then adds only the small
integration scripts needed to retain approved new functionality.

### Original visual appearance restored
- Home (and the original app's Home, Classes, Dungeon guides, Filters, etc)
- Patch Notes
- Change Notes

The main pages again load their original HTML and original v2/v3 style sheets.
They do NOT add `naxx-frostbound-ui`, Frostbound CSS, component observers,
new blue backgrounds or new styled headers.

### Features deliberately kept
- Permanent `/talents/` calculator, its DBC data, spell icons, genuine talent
  backdrop art, point limits and `NT1` share links; standalone calculator
  retains its own design, independent of the Resource Hub base theme.
- `assets/naxx-resource-navigation.js` clones the site's native **Talent Sets**
  sidebar item to add a **Talent Calculator** entry under Resources. Also retains
  the Home-brand link behaviour without assigning a Frostbound style class.
  No floating button is created.
- `assets/naxx-handbook-progression-fix.js`: the existing 4-era main class
  handbook repair is retained. Its sole Frostbound CSS-class prerequisite
  is removed because it is a functional fix, not a theme feature.
- Home events and countdown scripts, original v2/v3 enhancements.
- Original Patch/Change Notes source content and the v35 compact jump-index.

### Data and files NOT changed
`site-content.html`, `patches/content.html`,
`change-notes/content.html`, user server/DBC files, calculator JS/CSS/data,
countdown scripts, notes content, trial site/pages, existing Frostbound
assets or theme history. Frostbound remains available in GitHub for a
future independently designed website project; it simply is no longer
injected into the main site.

### Testing and release
- Three HTML loaders executed in a simulated document: source content,
  original styling, no Frostbound scope, native calculator menu script,
  handbook repair and countdown/compact-index controls passed.
- Main handbook's four native filters tested for Overview, Vanilla, TBC,
  WotLK after removing the theme guard (4/4).
- Browser QA required: Home, Resources sidebar calculator link,
  Class Handbook TBC/WotLK tabs, Dungeon filters, Patch Notes and Change
  Notes, and the standalone Talent Calculator.

### Backup / rollback
Full repository state immediately before this restoration:
`backup/pre-original-ui-restoration-2026-10-09`
at `e2e861d05c4f3d13f850886c973cb66bc60cc849`.

To revert this specific restoration, revert its GitHub pull request; do not
reset `main` or overwrite unrelated user changes. The older original
website reference is `backup/pre-frostbound-live-launch-2026-10-08`.
