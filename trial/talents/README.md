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

## Visuals and tooltip improvements

- Talent icons are read from the user-supplied `SpellIcon.dbc` and served through the public WoW icon CDN. The icon map contains 648 distinct icon IDs, covering all 830 player talents. Text initials are retained as automatic fallback when an image is not available.
- Every talent spec displays a subtle, individually themed background using the original pre-Cataclysm art file link (Warcraft Wiki) and an independent large signature-talent icon watermark fallback. Tree names, placements and original talent IDs remain untouched.
- A separate compressed `data/talent-visuals-v1.gz.b64` (~74KB) stores icons and 2,243 **rank-specific** processed tooltips exported from this server's custom `Spell.dbc`.
- The current and next rank are displayed separately. At zero talent points, only the next rank is shown so an unlearned effect isn't misrepresented.
- Numeric values `$s1`, `$s2`, `$h` and supported deterministic spell formulas are filled in from DBC. A handful of unresolvable duration/stat-dependent tokens are marked explicitly rather than inventing values; `SpellDuration.dbc` and other client data would be necessary for full resolution.
- Original row-only visibility (Vanilla 7, TBC 9, WotLK 11, final capstone), point requirements, prerequisites, and `NT1` share links unchanged.

Image art and icon file names belong to the WoW asset ecosystem; assets are referenced externally rather than copied into the project's repository. If a CDN or Wiki image fails, the page retains its baseline Frostbound texture and uses the first letter for talent icons.

## More compact layout (2026-10-08)

The trial now defaults to a denser layout without relying on CSS `zoom` or `transform:scale`, so text and talent icons stay sharp. Desktop panels and headings are smaller, the top-of-page introduction and controls take less space, and row heights shrink from 71px to 57px on large screens, 61px on medium screens, and 65px on small screens. Talent icon buttons stay 51px desktop, 55px tablet and 58px mobile for practical interaction. No HTML/JavaScript talent allocation logic changed.

Keep the full website and Frostbound trials separate until the user confirms the new size and explicitly approves migration and removal of any trial pages. Existing backups remain available.

## 2026-10-08 — original WoW specialization art

The prior generator used a wiki filename redirect behind a very dark/blurred background. The trial now displays actual original classic/WotLK talent-art images, one for **each of 30 TalentTab.dbc IDs**, directly underneath the talent buttons. The assets are from the public WotLK Talent Tree Calculator project at https://github.com/Maytch/WotlkTalentTreeCalculator/tree/263965c87c2858bd83e93918198f1fd60cb0ec50/Images/Backgrounds (pinned commit). Those .jpg filenames are the numeric TalentTab IDs, so no modern-spec aliases or guessed Wiki filenames are needed. The art is externally hosted through raw.githubusercontent.com; if an image fails to load the calculator displays a simple dark fallback instead of the incorrect old fake spec art.

Image placement uses `object-fit: cover` to avoid stretching the artwork; some horizontal cropping on very tall Wrath trees is expected. The backdrop receives only a light readability gradient, not the former blurred logo texture. This is a presentation-only change; the existing exact row-only Vanilla/TBC/Wrath rules, custom DBC talents, icon mappings, tooltips, saved builds, and share codes are untouched. The live homepage and trial navigation remain unchanged pending explicit user approval to migrate.
