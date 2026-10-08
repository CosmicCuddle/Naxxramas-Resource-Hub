# Naxxramas Talent Calculator — Frostbound Citadel trial

Website preview: `/Naxxramas-Resource-Hub/trial/talents/`

## Data source

`data/server-talents-v1.gz.b64` is from the user's modified live 3.3.5a
`Talent.dbc`, `TalentTab.dbc` and `Spell.dbc` snapshot supplied on 8 October 2026.
It contains 830 player talents, 30 player talent trees and custom Rend Flurry (ID 3000).
The original server files are not edited and the static website makes no server requests.

## Visibility — ONLY by row and position

- **Vanilla:** level cap 60, 51 points. Show every single 3.3.5 talent in rows
  **1–6**. Row **7** shows the single central talent/capstone only. Hide all
  side talents on row 7 and all talents below row 7.
- **TBC:** level cap 70, 61 points. Show every 3.3.5 talent in rows **1–8**.
  Row **9** shows only the main talent/capstone. Hide other row-9 talents and
  all lower rows.
- **WotLK:** level cap 80, 71 points. Show all 11 rows, all positions, no hiding.

All available-row talents stay visible regardless of when introduced: e.g.,
**Armored to the Teeth** appears in Vanilla, while TBC includes **Intensify Rage**
and **Improved Whirlwind** (both are row 7). Both of those are side talents on
Vanilla's *final* row and are therefore excluded in Vanilla.

### Off-centre final-row capstones in the user's current DBC

We preserve the real end-of-tree abilities even when they are not in column 2:
- Vanilla Shaman Enhancement (TalentTab 263): **Stormstrike** (Talent 901).
- Vanilla Warlock Affliction (TalentTab 302): **Dark Pact** (Talent 1022).
- TBC Paladin Holy (TalentTab 382): **Divine Illumination** (Talent 1747).

All other final rows retain their middle-column talent (zero-based column 1).
No history/earliest-expansion data is fetched or used. Older
`era-availability-v1.json` and `era-availability-v2.json` were an abandoned
prototype and should not be included in deployment; prior backup branches preserve
their history.

## Calculation rules

- One talent point per level, from level 10; spending max 51/61/71 for each era.
- Five points in earlier rows of the same tree per new row.
- Maximum talent ranks and DBC talent prerequisites remain enforced. No silent
  waiver of the server's actual DBC dependencies.
- Existing unresolved Talent.dbc prerequisite IDs 1409 (Paladin) and 1994
  (Death Knight) remain flagged; do not invent fixes without checking the source.
- Death Knights are only selectable in the Wrath view, matching the IP default.
- Existing `NT1` share-code and URL formats remain unchanged. Imports validate
  against the row/position filter, point budget and prerequisites; valid earlier
  share links continue to work.

## User interface and future work

Excluded talents are **not created in the DOM**—no faded buttons and no
hidden keyboard tab stops. The height of each grid shrinks to 7/9/11 rows.

Talent icons currently use temporary letters; real icons need `SpellIcon.dbc`.
Tooltip substitutions and remaining unresolved DBC prerequisites also need work.

## Backup and rollback

All feature files are in `/trial/talents/`; original website and the live
server have not been modified. The backup branch
`backup/pre-row-only-talent-filter-2026-10-08` preserves the prior implementation.
