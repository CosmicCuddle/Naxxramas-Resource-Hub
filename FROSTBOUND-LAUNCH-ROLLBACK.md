# Frostbound Citadel — production launch and rollback

Launch approved on 2026-10-08 for `CosmicCuddle/Naxxramas-Resource-Hub`.

## What changed

- The small production `index.html` loader applies the user-approved Frostbound theme after the existing v2/v3 styles. It still loads the **unchanged** `site-content.html` and the same countdown stylesheet/script.
- `assets/naxx-frostbound.css` is a scoped copy of the approved Frostbound trial CSS. `assets/naxx-frostbound-live.js` adds a normal Talent Calculator link alongside existing Home navigation and wires the logo to Home. If the original navigation structure cannot be found, a small floating link is used instead.
- `patches/index.html` and `change-notes/index.html` apply the same theme without modifying either enormous `content.html` file. The existing patch/change jump-index compact-scroll enhancement remains in place.
- `/talents/` is a complete copy of the approved custom 3.3.5 talent calculator: CSS, JavaScript, DBC snapshots and icon mappings are identical to the working trial version. The root calculator links return to Home, Patch Notes, and Change Notes.
- **No deletion** of `/trial/` until the user confirms live browser checks. Legacy `/trial/talents/` build links remain usable.

## Protected data and routes

Unchanged files include:

- `site-content.html` (the 31 MB resource site)
- `patches/content.html`, `change-notes/content.html`
- `assets/naxx-countdowns.css`, `assets/naxx-countdowns.js`
- Existing v2/v3 theme CSS and all archived backup files
- Original user-supplied DBCs; there are no AzerothCore changes.

Current live paths after deployment:

- Home: `/Naxxramas-Resource-Hub/`
- Calculator: `/Naxxramas-Resource-Hub/talents/`
- Patch Notes: `/Naxxramas-Resource-Hub/patches/`
- Change Notes: `/Naxxramas-Resource-Hub/change-notes/`

## Backup and rollback

GitHub safety snapshot branch:
`backup/pre-frostbound-live-launch-2026-10-08`

Snapshot commit:
`665112f87f358983e1d76fa5937800a59adcb2a2`

The backup contains the entire prior repository tree, including the live homepage, notes and talent trial. If the launch is not satisfactory, use GitHub's **Revert** action on the release pull request to restore the previous live wrappers while retaining repository history. Or restore the five changed live wrappers/assets and remove `/talents/` in a new commit. Do **not** delete the backup branch.

## Post-publication smoke test

1. Open the normal site home URL and verify Frostbound colors and all previous resource content, including the countdowns.
2. Check the Talent Calculator entry in site navigation. Open it and select Warrior: Armored to the Teeth must appear in Vanilla, and only the final-row capstone appears at row seven. Check TBC and WotLK too.
3. On the calculator confirm correct original specialization art, current/next rank tooltip, save/import, and share-link opening at `/talents/?code=NT1...`.
4. Click Home / Patch Notes / Change Notes from the calculator.
5. On both notes pages verify correct scrolling chapter-index boxes and all original notes.
6. Check a narrow/mobile screen. Only after all checks pass, request explicit confirmation before removing or archiving the trial pages.

**Do not overwrite the 31MB content or delete trial assets during rollout.**
