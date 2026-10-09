# Frostbound Citadel — site-wide component pass (2026-10-09)

## Goal

Make the *entire* original Resource Hub application look like Frostbound Citadel.
The user supplied screenshots of Home, Class Handbooks, the complete Dungeon
Handbooks directory, and a Dire Maul North guide showing that many inner
components still had the old near-black and bronze styling.

## Technical approach

The approved Frostbound header, sidebar, and event art stay in place. New scoped
assets are loaded LAST by the Home, Patch Notes, and Change Notes page wrappers:

- `assets/naxx-frostbound-components.css` provides the same navy/steel/ice/gold
  palette to content cards, handbook grids, dungeon directory tiles, guide
  contents, guide sections, role and level filters, buttons, chips, table
  cells, and download/info panels.
- `assets/naxx-frostbound-components.js` is a **presentation adapter** that
  tags otherwise anonymous controls after a client-side route change. It
  identifies handbook cards, dungeon View Guide cards, chapter TOC, guide
  panels and filter controls. It does not add/remove data, replace markup,
  change links or touch application event handlers. It avoids scanning the
  countdown widget on its frequent updates.
- Existing `naxx-frostbound-context.css` retains precedence over the old
  shared V4 illustration header; this update must not recolour or duplicate it.
- Existing `naxx-frostbound-live.js` retains Talent Calculator sidebar and
  Home navigation behavior.

The site generates its content from a monolithic ~31MB `site-content.html`.
That file is deliberately unchanged to protect every guide, server note and
download. The theme is separated into reversible assets rather than
editing the minified/full site application.

## Protected behavior

- Vanilla / TBC / WotLK talent row rules and icon / tooltip snapshots
- Naxxramas content and guild/server documentation
- all 29 dungeon handbooks, their guide descriptions and anchors
- the dungeon role/level filters and navigation
- the home Honor Reset / Raid Unlock / event countdowns
- class handbook and generic handbook navigation
- all Patch Notes and Change Notes content and jump indexes
- Frostbound page banners, fixed sidebar and admin link
- mobile sizes, keyboard focus/contrast, no unintended new page borders

## QA status

The build verifies that the production wrappers load the new stylesheet after
the approved theme and the adapter after the other scripts. The adapter uses
bounded DOM queries, only uses `classList.add` and a non-content data marker,
and does not change original event handlers.

**Visual and interactive QA must still be completed in a real browser.**
Especially test all 10 class handbook groups, the dungeon filters, three
columns of dungeon cards, the guide contents and Back to Guide Contents
anchors, modules, addons, Game Clients, Optional Patches, the countdowns,
Talent Calculator, and both notes pages. Screenshots are the acceptance test
for styling, not evidence that the code has rendered perfectly.

## Backup and rollback

- Backup branch: `backup/pre-sitewide-frostbound-components-2026-10-09`
- Backup commit: `8a96b0c0523baee68e7f9a2825d8be2e0a1529f0`.
- Undo by reverting the site-wide component PR: it only adds two assets and
  inserts references into three small HTML loader files. All original site
  content and existing Frostbound files remain present.

Do not remove trial pages or overwrite the 31MB content during this rollout.
