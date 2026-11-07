# Stage 6 — exact original Git tree and hypothetical replacement tree verification

**Status: private development proof, 7 November 2026. NO real Git commit, push, merge or deployment.**

The editor now has a source-verified combined review ZIP, fully assembled 415-file candidate resource-overlay source, complete tracked-website preservation and exact rollback, and an independently restored temporary fetched-history Git backup. All of these operate only in disposable storage.

An additional check is necessary **before** a future authenticated GitHub Save: every original tracked file must match the **actual Git blob** at the reviewed commit, and every proposed replacement must have a deterministic Git blob identity. A file's SHA-256 checksum in a private draft does not by itself verify its identity in the original Git tree.

## New private Git object preflight

`editor/tools/rehearse-browser-zip-git-tree-intent.cjs` performs the following:

1. Starts from an exact clean local Git checkout and the actual browser-generated private combined review ZIP.
2. Runs the existing complete 415-file candidate source and full-site **temporary rollback** proof. This preserves all original tracked website assets, scripts, pages and the root loader.
3. Reads the reviewed commit's **real original Git tree metadata**, including every tracked path, Git file mode and Git blob ID, using read-only `git ls-tree` and `git rev-parse`.
4. Independently reconstructs the original Git **SHA-1 tree object** entirely in memory, and requires an exact match to the actual reviewed commit's tree ID. No Git object is written.
5. Recalculates the original **Git SHA-1 blob identifier** from each tracked file's actual bytes, refusing any mismatch with the original commit.
6. Recalculates proposed blob IDs from the staged website bytes. Changed page, navigation and rebuilt runtime files must match the previously verified staged candidate; unchanged tracked files must retain their **exact original Git blob IDs and modes**.
7. Includes all **414 resource fragments and one manifest** as separately hashed, new candidate files, using normal Git mode `100644`. An existing tracked overlay path, file/directory collision, symlink or unexpected pathname is rejected.
8. Computes a complete **hypothetical next Git tree ID** and a SHA-256 path-inventory digest **without adding files to Git, making a commit, changing any ref or contacting GitHub**. This is metadata-only review evidence.
9. Verifies the temporary full-site rollback and unchanged original checkout, then deletes all disposable files.

This yields a stronger correspondence between a user-reviewed editor ZIP and the *precise files Git would need to contain*, while preserving every untouched original website file.

## Important technical boundaries

- The tool currently supports **Git repositories using SHA-1 object IDs**. It detects and refuses another Git object format. The 40-character Git commit must be independently supplied.
- The hypothetical tree hash is a **calculation**, not a Git object stored in any repository and **not** an authorised commit.
- An exact tree hash is not a substitute for authenticated administrator access, a server-enforced **beforeOid** condition during a real ref update, or a verified release/restore.
- The new 415-file resource-overlay tree is **still only a candidate**. The 418-file full resource source tree remains available for owner comparison; neither choice is automatically made.
- The OS-private copy and temporary backup are deleted after testing. No **durable, independently retained owner backup** is produced.
- The original 30,976,969-byte website source, index, page files, images, scripts, custom features and all 414 resources are unchanged.

## Tests

`editor/qa/browser-zip-git-tree-intent.test.cjs` checks in-memory Git blob IDs against Git's own read-only `hash-object --stdin --no-filters` calculation; requires the independently reconstructed original tree to equal the real reviewed `HEAD^{tree}`; rejects unsafe paths, duplicate case-insensitive paths and file/directory collisions. It uses a **real browser-writer ZIP** to build a temporary complete website, checks all tracked original blobs and the hypothetical new tree, and deliberately damages the root loader, changed page, rebuilt HTML, an unchanged resource fragment and the manifest. The original website must be restored and temporary copies deleted.

The isolated `private-git-tree-intent` GitHub Actions job is read-only and may report this proof without running any GitHub Save. The existing full editor, backup, browser and website checks remain separate.

**Stage 6 of 9 remains IN PROGRESS**. Actual Save, final source-layout approval, durable backup, administrator acceptance, remote atomic ref proof, merge and deployment remain blocked until CosmicCuddle explicitly approves them.
