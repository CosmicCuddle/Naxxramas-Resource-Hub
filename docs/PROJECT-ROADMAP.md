# Naxxramas Resource Hub — Development and Handover Roadmap

## Purpose and boundaries

This repository is the main public website for the custom Naxxramas AzerothCore 3.3.5a server. Its homepage, navigation, class and dungeon resources, addon/module information, event countdowns, Patch Notes, Change Notes and server-specific Talent Calculator are player-facing.

**Preserve the original Warcraft-inspired website.** The approximately 31 MB `site-content.html` contains the original resource site; avoid rewriting it for small corrections. `index.html` is a lightweight loader that appends additive scripts and styles.

### Recovery

- Prior full cleanup snapshot: `backup/pre-resource-hub-cleanup-2026-10-09`.
- Prior Talent Sets icon change snapshot: `backup/pre-talent-sets-icon-2026-10-10`.
- Every focused update should have its own branch, descriptive commits, PR, validation notes and a clear revert path.
- Revert merged PRs to undo a change without discarding later work. Back up original site files and important data before larger changes.

## Current website structure

- `site-content.html` — original source site and player resource records.
- `index.html` — loads the site and additive scripts/styles.
- `assets/naxx-countdowns.js` — Honor reset, world event, seasonal holiday, Darkmoon Faire, Battleground Call to Arms and placeholder raid information logic.
- `assets/naxx-countdowns-compact.css` — compact centred timer styling, leading-zero unit visibility.
- `assets/naxx-theme-v2.css`, `assets/naxx-theme-v3.css` — historic overlay styling still loaded; compact CSS loads after these.
- `assets/naxx-resource-navigation.js` — Talent Calculator navigation link cloned from the original Talent Sets sidebar control, plus clickable homepage brand.
- `assets/naxx-resource-information.js` — addon/module information updates, including N Addon Suite v2.0.0.
- `assets/naxx-home-class-selector.*` — hides the redundant Home class picker without affecting class resource navigation.
- `talents/` — public custom DBC-derived Talent Calculator; `talents/tests/era-capstones.test.cjs` protects Vanilla/TBC capstones.
- `patches/`, `change-notes/` — published site update sections.
- `docs/archive/` — earlier design/history documentation.

## Completed and checked work

- Restored the original Resource Hub UI after the experimental Frostbound redesign.
- Updated README to present the official server resource website and player tools.
- Archived retired trials, duplicate source copies and unused Frostbound assets.
- Countdown board is centred, wider, compact and hides leading zero day/hour/minute units as events approach.
- Monthly Elemental Invasions countdown automatically changes from next-start to event-end during its five-day monthly window. Server-side C++ controller lives in `CosmicCuddle/Mod-Naxxramas-Core`.
- Addon Information promotes `CosmicCuddle/N-Addon-Collection` v2.0.0 and Module Information describes newer Naxxramas Core features.
- Talent Calculator: Vanilla Enhancement capstone is Dual Wield (1690), not Stormstrike (901); Vanilla Affliction capstone is Contagion (1669), not Dark Pact (1022). Later eras preserve both abilities.
- Removed the duplicate class-picker panel from Home while preserving left navigation.
- Sidebar Talent Sets receives a distinct WoW scroll icon; Talent Calculator keeps its existing original icon. Validation of this last change in a live browser is pending.
- Classic Combat Rogue Talent Sets imported from the owner's 10 October exported website file: separate **Maces** and **Daggers** solo level-60 Phase-1 builds, each pointing to its respective Talent Calculator share code. The existing 48 builds and original site source are not rewritten. Snapshot: `backup/pre-talent-sets-sync-2026-10-10`.
- Full Classic Talent Sets sync (this update): owner's exported `index.html` and `Pasted text.txt` confirm **40 linked level-60 Vanilla builds** for Druid (9), Mage (3), Shaman (7), Priest (7), Rogue (6) and Hunter (8), covering both Raid and Solo sets. **Warrior and Warlock remain untouched** by request. Script: `assets/naxx-talent-sets-full-sync.js`, loaded after the two Rogue additions in `naxx-talent-set-sync.js`. This fixes the accidentally malformed Shaman Restoration URL in the exported HTML using the clean link from the text list. The list is matched by class/spec/role/raid-or-solo and creation-order variant, and is applied only when all 31 group sizes agree; mismatches produce no partial changes. No replacement of the original resource data or unrelated sections. Backup branch: `backup/pre-complete-talent-sets-sync-2026-10-10`. Test: `assets/tests/talent-sets-full-sync.test.cjs`. The live browser's Talent Sets view still needs a visual check.

## Completed: Warrior and Warlock Talent Set conversion notes — 10 October 2026

- Player request: add **TO BE CONVERTED** to the visible notes in the **Solo Builds** and **Raid Builds** cards for Warrior and Warlock only.
- Target group confirmed against the owner's current full HTML export: Warrior **3 Solo + 3 Raid**, Warlock **2 Solo + 2 Raid** = **10** cards.
- The user's exported Solo records already have the label, while Raid summaries are blank. Lightweight script `assets/naxx-talent-set-conversion-notes.js` ensures that all ten card `summary` fields display the exact phrase, without adding duplicate phrases.
- Notes that already contain other text are preserved; `TO BE CONVERTED` is appended on a new line.
- The existing compact Talent Sets card renderer displays `summary` as `.talent-set-short-description`. Script runs after the full link sync, and re-renders the active page when changed.
- Only the relevant Vanilla Builds records are targeted. Warrior and Warlock Talent Calculator URLs, class/spec roles, all other classes, page categories and server settings remain unchanged.
- The overlay is designed to be removed when the 10 builds are converted. It skips changes if the expected 3/3 Warrior and 2/2 Warlock structure no longer matches.
- Backup: `backup/pre-talent-sets-conversion-notes-2026-10-10`. Regression: `assets/tests/talent-set-conversion-notes.test.cjs`. Live browser verification remains pending.

## Completed: Vanilla raid reset countdowns — 10 October 2026

**Player request:** Replace the inaccurate **Next Raid Unlock** placeholder in Events Across Azeroth with live, independently calculated countdowns for the seven Vanilla raid names.

### Verified inputs
- SQL: `acore_characters.instance_reset` results supplied by the server owner on 10 October 2026, numeric Unix epoch timestamps retained.
- Uploaded `MapDifficulty.dbc`: valid WDBC header, **187 rows, 23 fields/row, resetTime at zero-based field 20**, confirmed against AzerothCore's `DBCStructure.h`. Periods verified at **604800 seconds (7 days)** for MC (409), Onyxia (249) difficulties 0/1, BWL (469), AQ40 (531), Naxx (533) difficulties 0/1; **259200 seconds (3 days)** for ZG (309) and AQ20 (509).
- `Rate.InstanceResetTime = 1` from the server owner's active Worldserver configuration.
- Confirmed next global reset timestamps: **1792123200** = Friday 16 October 2026, 04:00 UTC / 06:00 configured site time (UTC+02:00); **1791864000** = Tuesday 13 October 2026 at the same UTC/offset clock hours.
- **Not supported in uploaded DBC:** SQL `difficulty=2` rows for Onyxia and Naxxramas. Do not publish a 3-day reset for these unsupported modes or silently combine them with the defined 10/25-player modes.
- **Naxxramas caution:** AzerothCore map 533's DBC entries are 10/25-player Wrath format, not proof of a distinct Vanilla 40-player version. Site lists the map's supplied reset schedule without claiming custom progression mechanics are verified.

### Implementation
- `assets/naxx-countdowns.js`: `schedule.raids` uses the exact seven map IDs, confirmed initial Unix reset times, and DBC reset periods (7 or 3 days). Rollover advances each independent timer by the relevant period; the script never invents a real-time server connection.
- New `makeRaidCard` / `updateRaidCard` replace **Next Raid Unlock** with **Vanilla Raid Resets** and seven scrollable rows. Each row shows the name, a compact time remaining (leading zero units disappear), and a mouse tooltip giving the reset date, format and period. The rest of the original countdown grid remains unchanged.
- `assets/naxx-countdowns-compact.css`: bounded scroll area, small Warcraft blue/gold labels and mobile adjustments, preserving the compact centred board.
- `index.html`: refresh cache for JS `v=7` and compact CSS `v=4`.
- `assets/tests/raid-resets.test.cjs`: regression suite for all seven map IDs, DBC cadences, confirmed timestamps, 3/7-day rollover and time-unit formatting.
- **No SQL edits, DBC edits, AzerothCore module changes or worldserver restart required** for the website-only update.

### Limitations and follow-up checks
- The static website cannot query private `acore_characters.instance_reset`; it projects future resets from the confirmed 10 October snapshot. A reset reschedule or updated DBC/rate needs an explicit website data update.
- Website `ZONE = "Etc/GMT-2"` is fixed UTC+02:00. It matches the October 10 SQL example but **server OS daylight-saving rules are not yet confirmed**. Reset countdown instants use absolute Unix time and thus avoid visitor timezone ambiguity; the visible formatted reset date should be checked if the server adjusts its local clock seasonally.
- Visually verify Home on desktop and mobile, hover the rows, test scrolling, and check the other five event cards remain unchanged.
- Pre-change backup branch: `backup/pre-raid-reset-countdowns-2026-10-10`. Revert the focused PR to roll back safely, not the entire main branch.

## Next recommended work
1. Verify in the live browser that all seven raid rows show and scroll, and that timing agrees with server on October 13/16.
2. Confirm worldserver OS timezone (e.g. `timedatectl`) and whether the existing event labels need DST support.
3. Continue latest Patch Notes and Change Notes publication, with content-specific Git commits.
4. Audit the remaining 30 Talent Calculator trees and add a resource search only after existing navigation is stable.

## Other known work

- Verify and align server timezone/DST with the website's `ZONE` value.
- Review the uploaded new Patch Notes and Change Notes against live website versions; commit content-specific changes separately.
- Full 30-tree Talent Calculator audit against the user's actual DBC snapshot.
- Future global search, progression journey and download hub improvements should be planned after existing functionality is verified.

## Maintenance discipline

After each change, add a concise completed-result entry, update the current next task and attach the PR/commit/rollback instructions here. Do not claim an in-game feature is verified solely because its code was merged. Keep frontend, server module, database and DBC changes separate.
