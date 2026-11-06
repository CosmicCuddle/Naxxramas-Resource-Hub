# Website editor source-storage decision — protected design only

**Status: PROPOSED, NOT APPROVED.** Created for [draft PR #56](https://github.com/CosmicCuddle/Naxxramas-Resource-Hub/pull/56). This is a decision record, **not a migration or an executable publication plan**. Do not merge, deploy, remove the current compatibility file, modify the root loader, or adopt a resource tree without CosmicCuddle's explicit approval.

## Confirmed source constraints

- The existing `site-content.html` is **30,976,969 bytes**, SHA-256 `34455f6d901c538e2491a8c16681692e4c02d918b1984d7d0ba081aacb1049e8`. All currently supported restoration experiments require that **exact baseline**.
- The original site contains **414 resource objects** with substantial additional/custom fields, a **separate 29-object collection**, source layout, scripts, administrator behavior, and embedded media. None may be silently dropped, renamed, flattened or reordered.
- The previously verified image audit found **95 embedded image references (71 distinct decoded payloads)** outside the resource array. The original source has a sizeable non-resource portion. The resource-only edit UI is restricted to existing titles and plain-text content, not arbitrary custom fields or images.
- Existing public `index.html` loads `site-content.html` at runtime. Therefore the published site still needs a valid complete compatibility HTML file until a different publication strategy has been explicitly approved.
- New Players, Rules, Apply to Join, Game Clients and navigation metadata are **already separate page/JSON files** in the protected development branch; this investigation concerns the **414 legacy resources** and the compatible runtime output.

## Exact accounting tools — read-only and temporary

`node editor/tools/audit-source-storage-budget.cjs` checks the SHA-pinned original; measures **every byte** of the 414 resource fragments, original prefix/suffix and separators; accounts for the exact 418-file source-tree manifest; and prints aggregate counts and sizes **without printing private content or individual resource hashes**.

`node editor/tools/rehearse-resource-only-overlay.cjs` uses 414 separate, checksum-bound resource fragment files plus one overlay manifest **inside a disposable OS-private folder**. It rebuilds the exact intended compatibility HTML using the verified original non-resource shell; checks edited first/last resources; tests rollback to original bytes; and deletes the folder. No overlay files have been committed for real content.

These are *feasibility checks*. They do not constitute an approved release builder, GitHub package, source conversion, or browser-side save mechanism.

## Verified uncompressed baseline measurements — 6 November 2026

The original/source-bound audit and independent temporary-file size check passed on [editor CI #42194013982](https://github.com/CosmicCuddle/Naxxramas-Resource-Hub/actions/runs/42194013982), alongside **212/212 Node tests** and the isolated Chrome browser job. Recovery and website regression checks also passed on that same commit.

| Verified source quantity | Exact bytes |
| --- | ---: |
| Existing runtime `site-content.html` | **30,976,969** |
| All original **414 resource fragments combined** | **995,188** |
| Original non-resource source (including the script/media shell and separators) | **29,981,781** |
| Proposed **418-file full source tree** (manifest and layout included) | **31,102,068** |
| Proposed **415-file resource-only overlay** (414 fragments + manifest, no duplicated shell) | **1,072,527** |
| Existing runtime **plus** proposed full source tree | **62,079,037** |
| Existing runtime **plus** resource-only overlay | **32,049,496** |

The complete alternative would add **30,029,541 more bytes** than the resource-only source tree to the current working file set. The small overlay is approximately **96.6% smaller as an extra uncompressed source tree**. This does **not** include unrelated website files, Git object storage/compression, published site traffic or backup copies.

The extra resource-only manifest is **77,339 bytes**, and a simulated two-record edit produced a temporary **1,072,597-byte** overlay before an exact rollback to the original **1,072,527-byte** baseline tree. Neither candidate tree was retained after testing.

**Technical conclusion (not an owner decision):** avoid adopting a duplicate full 31 MB shell merely to make resources editable. Continue investigating a checksum-bound, version-aware source-of-truth workflow around the 414 separate records, then compare that against build-only generated publication after the original admin workflow is verified. **Do not release the current baseline-bound overlay unchanged:** it cannot yet support repeated real edits after the runtime source hash changes.

## Storage alternatives and trade-offs

| Candidate | What is kept in the authoring repository | Source-of-truth concern | Runtime consequence | Status |
| --- | --- | --- | --- | --- |
| **A. Full 418-file copy beside existing HTML** | `content/legacy/` with 414 resources, prefix, suffix, separators and manifest **plus** existing complete `site-content.html` | Duplicates the large non-resource shell, including embedded images. Two parallel complete source representations can drift. | Existing Pages loader remains usable; build/review still required. | Feasibility proved, **not preferred by default**, unapproved |
| **B. Resource-only overlay beside existing HTML** | 414 individual fragment files and checksum manifest **plus** existing complete `site-content.html`; no second prefix/suffix | Original site remains needed as non-resource shell, so this is a **transitional** rather than a fully independent canonical source tree. Future edits must not rely forever on the initial SHA. | Rebuild must regenerate and verify the compatibility HTML before publication. | Disposable feasibility in development, **no adoption** |
| **C. Authored sources, generated runtime only at publish time** | Separately authored resources and a verified non-resource shell; generated `site-content.html` exists **only** in the publication artifact, not also in the authoring Git tree | One canonical source can reduce working-tree duplication, but requires an independently reproducible build and different publishing process. | GitHub Pages publication configuration and recovery procedures would change; existing public URLs and admin behavior must be proven unchanged. | Long-term possibility only, **not implemented or approved** |
| **D. Changed-only resource drafts** | Only source-bound JSON deltas for selected titles/content beside unchanged runtime HTML | Not a complete independent editable resource set; long-term drift and conflict handling unresolved. | No public changes until separately rebuilt. | Current safe draft/review transport; **not a final publishing format** |

**Decision not yet made.** The least disruptive immediate *research* is B, because it keeps the existing visitor loader and avoids a duplicate copy of the heavy non-resource shell. C may provide a cleaner long-term single-source structure, but is a larger operational change requiring approval. Storage byte counts are **uncompressed source totals**, not forecasts for Git's object database, GitHub transfer size, or Pages deployment usage.

## Saving UX we are protecting

The owner's desired outcome is a comprehensible website folder, not a giant export that destroys GitHub's layout. The design must keep separate page files, the three newer navigation settings, and independently editable resource records, **while retaining** all original IDs, relationships, custom fields, media and administrator functions.

The current local Save Draft and reviewed ZIP stages may remain as a *private preparation step*. A future approved publishing step would validate the reviewed Git commit, source hashes, all requested paths and the entire regenerated runtime before allowing GitHub changes. It should offer a clearly labeled review of changed files and keep unrelated files untouched. A future builder must never silently use a stale resource draft against a newer site revision.

## Release-blocking requirements

1. **Version-aware base transition.** Currently, parsing and all v2 resource drafts are SHA-bound to the original source. Once any generated `site-content.html` changes, a second edit would need a new verified baseline and collision/merge rules. Do not present the temporary overlay as supporting repeated production saves.
2. **Exact reconstruction.** Build from fully verified source files, preserve record ordering and every non-edited byte, independently verify new compatibility output, and reject changed manifests, missing/extra files, unexpected source versions or malicious paths.
3. **Original admin and custom data.** Verify real administrator edits on a private/disposable copy and ensure 29-item side collection, 27 original direct data members, custom resource fields, source scripts and image data are unaffected. CSS-only admin-state tests are insufficient for approval.
4. **Backup and restore.** Record a independently retained *complete* Git repository/asset backup, verify restore to a separate location, and document a simple rollback. A temporary browser preview is not a backup.
5. **Visual and interaction acceptance.** Compare desktop/mobile screenshots and real keyboard interactions; test the published artifact in a safe non-production environment with external forms disabled. Existing automated DOM/geometry checks alone cannot prove visual equivalence.
6. **Owner release gate.** CosmicCuddle chooses the final layout and authorizes any merge, publication workflow change or deployment. PR #56 stays DRAFT until then.

## What remains unverified

The final storage strategy, GitHub Pages deployment source configuration, repeated-version saves, true admin write behavior, third-party asset rendering, and production rollback have not been approved or proven. Do not claim any of these based solely on the read-only budget or disposable overlay test.
