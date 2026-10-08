# Naxxramas Resource Hub — Four website design trials

Selection page: `/Naxxramas-Resource-Hub/trial/`

Open the full site preview using `/Naxxramas-Resource-Hub/trial/view.html?style=DESIGN`:
- frostbound — Frostbound Citadel (existing first prototype)
- obsidian — Obsidian Forge
- emerald — Emerald Sanctuary
- arcane — Arcane Observatory

The trial iframe reads the unchanged production `site-content.html` on the same origin.
The original `trial/theme.css` is the common foundation. Optional extra files
in `trial/styles/` override visual decisions to create independent design directions.
The theme selector changes stylesheets without re-downloading the 31 MB source.

All changes are isolated under `trial/`. The live `index.html`, patch/change
notes and original 31 MB content files remain unchanged. To roll back simply
remove the trial folder in a new commit. Backup branches also exist.
