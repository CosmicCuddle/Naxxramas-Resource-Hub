# Stage 6 — Source-check the editor's saved review ZIP

**Status: read-only local development integration, 6 November 2026. NOT a Save/Restore publisher.**

The website editor already exports a private combined ZIP containing a page/navigation v3 draft and/or a resource title/content v2 draft. Until now, the source-change planners received these two drafts separately. The new bridge **`editor/tools/review-private-combined-zip.cjs`** accepts the **actual ZIP produced by the browser editor**, verifies it, then hands the contents to the existing source planners.

It is the first direct connection from the editor's own combined review ZIP to the physical-source and Git-checkout validation that precedes a possible Save workflow.

## What the integration checks

- Reads an archive from a **separate private location outside the Git checkout**, from regular files only; does not extract it or overwrite existing work. The reader caps the entire ZIP at 20 MiB.
- Reuses `editor/review-package-reader.js` and the browser editor's `review-package.js` draft validators. Checks allowlisted ZIP/STORE members, CRCs, exact layout, draft formats, package manifest and SHA-256 values.
- Requires a caller-specified **exact 40-character Git commit** and a clean matching repository checkout. Runs checkout integrity checks **before and after** the potentially lengthy source inspection.
- Feeds the verified draft objects directly into the existing `plan-mixed-editor-update.cjs` checker, which verifies the real four HTML pages and navigation, original 414 resource values, rebuilt compatibility HTML and a private resource-tree rollback.
- Returns only a source-bound **read-only report**: changed tracked page paths, unapproved candidate resource paths, hashes, counts, the reviewed Git commit and explicit denial of GitHub writes. Neither actual edited wording nor private resource content appears in output.
- Refuses a missing, modified, malformed, stale or mismatched ZIP or source commit, instead of treating a ZIP's own hashes as proof of authorship.
- Allows page-only, resource-only or combined review packages; a package with no actual edits is refused.

**The resource source-layout decision is still open.** Internally the existing mixed planner rehearses the **418-file proposed full resource source tree**. Those paths are deliberately labelled unapproved candidate paths, **not tracked Git files**. The alternative 415-file versioned resource overlay remains a live proposal; neither layout was selected or installed.

## How the private review tool is invoked

For a developer working from a **clean, disposable Git checkout**, the interface is:

```text
node editor/tools/review-private-combined-zip.cjs --checkout "/absolute/path/to/disposable/repository" --zip "/absolute/path/outside/repository/Naxxramas-Private-Editing-Review.zip" --commit "40-character-reviewed-Git-commit"
```

The final commit argument must be a real exact 40-character hexadecimal Git SHA. This command is **for development review**, not an instruction for the website owner to run it now. It never writes to GitHub, exports source files, creates a backup or updates any branch. A saved draft's source fingerprint is verified against actual files, but the draft author remains unauthenticated.

## End-to-end automated regression

`editor/tests/browser-zip-to-source-plan.test.cjs` uses the **browser editor's real ZIP writer** to create disposable combined and page-only review ZIPs from synthetic edits. It then passes their bytes through the new bridge and verifies the real repository checkout, page/navigation sources, all 414 original resources and the reconstructed compatibility source. It also confirms that corrupt ZIP bytes, forged original page hashes, wrong Git commits, unsafe input locations and symlinks are refused.

**This is not a final GitHub update package.** The source layout, independent complete backup, authenticated administrator editing, server-enforced exact-old-ref Save, owner-approved release gates, and a verified production restore remain unfinished. Original site-content.html, root index.html, navigation files, original Admin code, media and all website resources stay unchanged in the draft branch.
