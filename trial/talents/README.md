# Naxxramas Talent Calculator — Frostbound Citadel prototype

URL after publication: `/Naxxramas-Resource-Hub/trial/talents/`

## Data provenance

The included `data/server-talents-v1.gz.b64` was generated from the user's supplied **active** 3.3.5a `Talent.dbc`, `TalentTab.dbc`, and `Spell.dbc` dated 8 October 2026. It contains 830 talents across all 30 player talent trees (plus no hunter-pet trees), including modified Rend Flurry (talent 3000).

The file is a gzip-compressed, base64-encoded UTF-8 JSON snapshot. The Javascript downloads and decompresses it locally in the browser. The file can be regenerated with the separately supplied export script when the DBC changes.

## Rules

- Vanilla: max level 60, rows 1–7, up to 51 points.
- TBC: max level 70, rows 1–9, up to 61 points.
- Wrath: max level 80, rows 1–11, up to 71 points.
- Five points must be spent in earlier tiers per new row.
- Talent prerequisites, required ranks, spell IDs and spell descriptions come from the uploaded DBC.
- The two unresolved prerequisite IDs 1409 (Sanctified Retribution) and 1994 (Merciless Combat) are **not guessed**. These nodes remain unassignable until verified.
- Death Knight appears in Wrath only for this calculator (default IP restriction, actual server config still to be confirmed).
- The calculator does **not** modify or query character data. Every build is advisory until compared against actual realm behaviour.

## Sharing

A short versioned talent-code format `NT1:era:class:talentId36-rank.[...]` stores talent IDs rather than positional indexes. Share links include this code and the selected level. Builds can also be saved in browser localStorage. All imported codes are validated against the selected era, point budget and dependencies.

## Missing assets / planned improvements

`SpellIcon.dbc` is not yet supplied, so this prototype uses letter emblems. Add icons only when mapped to the actual server spell icon records. We should also investigate missing prerequisite IDs against DBC and in-game testing.

## Safety and rollback

All files live under `/trial/talents/` and the existing `trial/view.html` is amended only to add a link to the calculator. The regular website and its `site-content.html` are untouched. To revert, restore the preview files and remove the `trial/talents` directory. The backup branch `backup/pre-server-talent-calculator-2026-10-08` preserves the pre-feature state.
## Automatically hide later-expansion talent rows

The calculator displays only talent rows available in the chosen era: Vanilla 1–7,
TBC 1–9, and WotLK 1–11. The grid height adjusts to avoid empty rows and hidden
focusable elements. The existing validator still rejects out-of-era allocations,
including when a build is imported from a link or code. These are progression-era
row limits on the custom 3.3.5 trees, not historically reconstructed Vanilla/TBC trees.

## Talent introduction by expansion (including talents in earlier rows)

`data/era-availability-v1.json` identifies the earliest expansion in which each
of the 830 talents existed (Vanilla/TBC/Wrath). The identification uses 1.12 and
2.4.3 historical tree reference skeletons with the supplied custom server 3.3.5 DBC
IDs, names, and TBC spell IDs. The server-custom Rend Flurry (3000) is explicitly
available in all eras. These filters do not recreate pre-Wrath spell effects.

Vanilla completely omits later TBC/Wrath talents (including lower rows). TBC omits
later Wrath talents. Dependencies are closed transitively: if an earlier-era
node depends on a removed talent in the current 3.3.5 DBC, the dependent node is
also removed rather than leaving an unlearnable button. Valid 3.3.5 prerequisite
and point-budget checks still apply. Share-code syntax remains `NT1`, but codes
containing now-ineligible talent selections cannot be imported for an earlier era.

Example: Fury Improved Whirlwind appears in TBC and Wrath, while Intensify Rage
appears only in Wrath. 

Historical references: https://github.com/lathcf/azerothcore-mod-era-talents/tree/main/era-data/_skeletons
