# Stage 6 — whole tracked website preservation and exact rollback

**Status: PRIVATE TEST-ONLY INTEGRATION (6 November 2026). No owner-approved Save, release or source migration.**

The existing website project already has a full fetched-Git-history backup tool: `editor/tools/create-local-git-backup.cjs`. Its retained `.bundle` output is deliberately created only when the operator explicitly supplies a private path, and the existing tests verify that it restores. It is **not** a backup of GitHub account settings, GitHub Pages settings, secrets, external services or files that have never been fetched.

The newer private browser-ZIP-to-source tool builds a complete **415-file** proposed resource overlay, the full rebuilt compatibility `site-content.html`, and any changed page/navigation files, but it does not include every other tracked website asset.

This new rehearsal connects that staging proof with a **whole tracked-website preservation and rollback** check, entirely inside disposable OS-private directories.

## What the new test actually does

`editor/tools/rehearse-browser-zip-full-site-rollback.cjs`:

1. Receives the actual editor-generated combined review ZIP, an exact clean local Git checkout and a reviewed commit SHA.
2. Uses the existing source staging verifier to check the full 415-file resource candidate, new runtime and edited page/navigation bytes.
3. Independently copies **every tracked file** from the Git checkout into two separate temporary directories: an original working copy and a website candidate copy. The copied original is compared with both the physical checkout and the Git source fingerprint.
4. Adds **only** the 415 proposed resource source files, and replaces only the reviewed existing page/navigation files and generated compatibility `site-content.html` in the private candidate copy. An existing Git-tracked overlay path is refused as a collision.
5. Checks the **entire private website file inventory**, including all original images, scripts, custom files, pages, navigation and the original root loader; rejects extra, missing or unapproved files. Every untouched tracked file must be **byte-for-byte identical** to the verified original. Every changed tracked file must match the reviewed staging bytes.
6. Validates the independent original copy again before recovery. Deliberately modified original copies are refused.
7. Restores **every tracked file** from that verified copy, deletes the candidate resource overlay directory, and verifies the original tracked-file count and source fingerprint exactly. Deletes all the working directories afterwards.

The automated tests use a real browser-generated review ZIP containing page text, navigation and two resource edits. Other tests deliberately damage the copied root loader, an unrelated original tracked asset, a changed page, unchanged resource fragment, candidate manifest, generated HTML and original backup copy; they also add an extra unexpected file. All must fail verification before a release could be considered.

### Important boundaries

- This proves **temporary tracked-file copy, candidate assembly and rollback**, not a production rollback on a running website.
- The two working copies are **deleted**; no durable owner-retained backup is created by this tool. The full Git-history backup tool remains separate and must be used and independently reviewed before any approved deployment.
- The resource overlay design is still **proposed**, not selected. Its non-resource HTML shell is rebuilt from the SHA-pinned original `site-content.html`, not an independently adopted future authoring source.
- Original administrator password/login/edit/save behaviour, browser-level publishing, remote Git compare-and-swap, GitHub Pages settings and deployment remain **outside this test**.
- The full directory copy contains only **tracked Git files**; ignored/untracked content, remote-only history, Git LFS objects and private third-party services are not covered.
- The live repository, public site and root loader are never modified by this rehearsal.

Stage 6 of 9 remains open pending an approved source layout, verified actual Save transaction, owner-retained backup, original Admin acceptance and explicit merge/deploy permission.
