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

## Active next task: Vanilla raid reset countdowns

**User requirement:** Replace the **Next Raid Unlock** placeholder card with a Wowhead-style set of live ticking countdowns, **one for each Vanilla raid**, showing when its next lockout reset occurs. Do **not** confuse progression unlocks, Honor resets or lockout reset times.

Expected Classic reference cadence:
- 7-day: Molten Core, Blackwing Lair, Temple of Ahn'Qiraj (AQ40), Naxxramas.
- 5-day: Onyxia's Lair.
- 3-day: Zul'Gurub, Ruins of Ahn'Qiraj (AQ20).

**Important:** These are historical Classic conventions, NOT confirmed schedules for this custom 3.3.5a realm.

**Confirmed 10 October 2026 database snapshot** (not a recurring schedule): epoch 1791864000 / Tuesday 13 October at 06:00 server time for ZG 309 difficulty 0, AQ20 509 difficulty 0, Onyxia 249 difficulty 2 and Naxxramas 533 difficulty 2; epoch 1792123200 / Friday 16 October at 06:00 for MC 409, BWL 469, AQ40 531, Onyxia 249 difficulties 0/1 and Naxx 533 difficulties 0/1. Never collapse different difficulty rows silently. These timestamps are valid for the next reset only; cadence afterward is unverified. A static GitHub Pages site cannot interrogate SQL autonomously. AzerothCore stores actual global raid reset timestamps in the characters DB table `instance_reset` (`mapid`, `difficulty`, `resettime`, epoch seconds). The user needs to supply the relevant read-only SELECT output and, if necessary, Worldserver reset settings. Do not make up dates or label estimates as verified. Server time zone/DST must be confirmed: existing countdown code currently uses fixed `Etc/GMT-2` (UTC+02:00).

Expected map IDs to verify against the custom server: MC 409, Onyxia 249, BWL 469, ZG 309, AQ20 509, AQ40 531, Naxx 533. In AzerothCore 3.3.5, map 533 can represent WotLK Naxxramas; verify the server's Vanilla Naxx implementation before publication.

**Planned implementation after confirming data:**
1. Save a pre-change Git branch and note exact affected files.
2. Replace only the raid placeholder section with a compact expandable/reset list within the existing main event card or a compact dedicated raid panel. All seven raids must be visible without crowding the other five event timers.
3. Render correct remaining time for each raid, using server-confirmed reset timestamps and durations/periods. Recalculate in the browser; never misrepresent a historic Classic default as a current realm timestamp.
4. Preserve Home-only board mounting, all other countdowns, leading-zero handling, responsive layout and Warcraft colour styling.
5. Add automated boundary tests for reset rollover, 3/5/7-day periods, independent individual raids and timezone boundaries.
6. Bump static asset cache versions; verify the mobile and desktop presentation. Explain that GitHub Pages cannot directly query the private characters database.
7. Update this roadmap and give the user the merged PR, result and rollback instructions.

### Read-only SQL for next-reset discovery

```sql
SELECT
  CASE mapid
    WHEN 409 THEN 'Molten Core'
    WHEN 249 THEN 'Onyxia''s Lair'
    WHEN 469 THEN 'Blackwing Lair'
    WHEN 309 THEN 'Zul''Gurub'
    WHEN 509 THEN 'Ruins of Ahn''Qiraj'
    WHEN 531 THEN 'Temple of Ahn''Qiraj'
    WHEN 533 THEN 'Naxxramas (check custom map)'
  END AS raid,
  mapid, difficulty, resettime,
  FROM_UNIXTIME(resettime) AS next_reset_database_time
FROM acore_characters.instance_reset
WHERE mapid IN (409,249,469,309,509,531,533)
ORDER BY FIELD(mapid,409,249,469,309,509,531,533),difficulty;
```

This SQL changes nothing. Its formatted time is influenced by the SQL session time zone. Keep the numeric `resettime` for reliable calculations.

## Other known work

- Verify and align server timezone/DST with the website's `ZONE` value.
- Review the uploaded new Patch Notes and Change Notes against live website versions; commit content-specific changes separately.
- Full 30-tree Talent Calculator audit against the user's actual DBC snapshot.
- Future global search, progression journey and download hub improvements should be planned after existing functionality is verified.

## Maintenance discipline

After each change, add a concise completed-result entry, update the current next task and attach the PR/commit/rollback instructions here. Do not claim an in-game feature is verified solely because its code was merged. Keep frontend, server module, database and DBC changes separate.
