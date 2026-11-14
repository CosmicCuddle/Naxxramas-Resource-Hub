# Naxxramas original website editor

This launcher keeps the existing visual **Admin Mode** editor. It changes only the Save process.

## Windows

Double-click:

`Start-Naxxramas-Website-Editor.cmd`

Requirements:

- Node.js
- GitHub CLI (`gh`) logged into CosmicCuddle's GitHub account

The browser opens the original Resource Hub at a localhost address using the same `/Naxxramas-Resource-Hub/` path as GitHub Pages.

Inside the existing Admin Mode, the old **Export Updated HTML** button becomes **Save Website Changes**.

Save writes only:

- repository: `CosmicCuddle/Naxxramas-Resource-Hub`
- draft branch: `editor-saves/original-admin`
- file: `site-content.html`

It does **not** update `main`, replace root `index.html`, or publish GitHub Pages. Publishing remains a separate owner-approved step.
