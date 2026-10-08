# Naxxramas Resource Hub — Design Trial

Open `/Naxxramas-Resource-Hub/trial/` to view the website redesign.

The trial loads the original `site-content.html` in a same-origin frame and applies
`trial/theme.css` only within that frame. It leaves the production `index.html`,
original content, patch notes and change notes untouched.

This is the first **whole-site styling prototype**, not a finished structural rebuild.
It gives a working comparison URL for the next design passes.

Rollback: delete the `trial/` directory; the live homepage never uses these files.
