# Resource Hub — Two Source Layouts, Measured Evidence and Owner Decision

**Status:** CONFIRMED comparison of **research candidates**. No storage layout, migration, real Save or deployment is approved. Owner and final decision-maker: **CosmicCuddle**.

**Evidence date:** 8 November 2026. All measurements are **uncompressed source-file bytes**, **not** Git storage, GitHub quota, real network download sizes, or deployment disk estimates.

## Quick comparison

| Question | 415-file resource overlay | 418-file self-contained source tree |
| --- | --- | --- |
| Files | 414 resource fragments + 1 manifest | 414 resource fragments + 1 manifest + 3 non-resource layout files |
| Research path | `content/resource-overlays/` | `content/legacy/` |
| Non-resource website content | **Does not duplicate it**; rebuild requires the **exact pinned original** `site-content.html` baseline (or another independently proven equivalent) | **Explicitly stores it** as prefix, suffix and separators; rebuild from those independently checked files |
| Original compatibility runtime | Preserve exact 30,976,969-byte `site-content.html`; any later regenerated version needs strict source/commit checking | Same preservation/compatibility requirement; generated runtime must match independently checked source files |
| Advantage | Much smaller uncompressed duplicate; direct individually reviewable resource fragment changes | Can reconstruct from committed source-tree files without looking up the original shell externally |
| Main risk | **Baseline dependency** and an explicit plan needed for authorized changes to non-resource site shell/custom code | **Extra full-size shell copy** could diverge from generated runtime; must enforce byte-identical reconciliation, source ownership and cleanup |
| Multi-session local Git verification | **CONFIRMED as a disposable experiment:** 11/11 original-source Git-chain tests passed on PR #57 | **PARTIAL:** original reconstruction/rollback tests exist, but a separately pinned Revision 1+ Git-chain test for the 418-file structure has **not** been proved here |
| Ready for real Save/publish? | **No** | **No** |

## Exact storage budget from protected original source

Protected original:
- `site-content.html` = **30,976,969 bytes**, SHA-256 `34455f6d901c538e2491a8c16681692e4c02d918b1984d7d0ba081aacb1049e8`.
- Exactly **414** source resource objects = **995,188 bytes**.
- Everything other than resource objects (including original shell, scripts, embedded images, punctuation/separators) = **29,981,781 bytes**, ~**96.79%** of the original.
- Original prefix = **1,390,417 bytes**; suffix = **28,590,949 bytes**; original 415 separators = **415 bytes**.
- 418-file source candidate, original unchanged baseline: **31,102,068 additional bytes**. Includes 414 fragments, the 3 layout files (prefix, suffix, serialized separators) and the **123,853-byte** candidate manifest.
- 415-file overlay, original baseline: **995,188 resource bytes + 77,339 manifest bytes = 1,072,527 additional bytes**. The **two-edit staged trial** increases this to **1,072,597 bytes**, not the unchanged baseline. Its manifest is a different format/size from the 418-file candidate.
- Difference between additional baseline files: **30,029,541 bytes**; the 415 overlay has about **96.55% less** added uncompressed source data than the 418 tree.
- Original runtime + original candidate source files: **32,049,496 bytes** for the 415 baseline vs **62,079,037 bytes** for the 418 baseline. These totals deliberately exclude other site files and real Git compression.

**Source:** exact baseline `editor/tools/audit-source-storage-budget.cjs`, and `editor/tools/rehearse-resource-only-overlay.cjs` results from [all-green PR #56 editor workflow #42469677741](https://github.com/CosmicCuddle/Naxxramas-Resource-Hub/actions/runs/42469677741). The audit independently checks the original SHA, all 414 records, exact reconstruction and that the byte partition sums to the original. These outputs are read-only and do not publish website contents.

## What has actually been verified

**Confirmed at their exact PR heads:**
1. [Draft PR #56](https://github.com/CosmicCuddle/Naxxramas-Resource-Hub/pull/56), head `c26102e604478f8624d27a148f7eae4a23e8e5ce`: **three CI workflows passed**, including private Chrome, editor, complete website read-only checks and original/local source analysis.
2. [Draft PR #57](https://github.com/CosmicCuddle/Naxxramas-Resource-Hub/pull/57), head `1ce92e652fdc81f62e00ddad9ff7a1483af6fb9e`: **two CI workflows passed**. The dedicated research workflow passed all **10/10 saved-bundle tests** and **11/11 original-backed Revision 1+ local Git-chain tests**; complete editor/Chrome workflow also passed.
3. The 418-file candidate has its own temporary `rehearse-proposed-resource-tree.cjs` and `rehearse-unified-source-layout.cjs` rebuild/rollback checks. The source layout is *not* adopted by Git, and the sparse **425-file** combined preview is a separate temporary site projection (418 + 4 pages + navigation + index + generated compatibility file), not a third canonical source layout.
4. The 415-file local revision-chain research uses a pinned original source and exact Git blobs; it refuses stale history, forged fragments and protected-field edits. This remains **LOCAL** provenance, not authentication of GitHub remote HEAD.

**Not verified or approved:** either choice as actual source of truth, complete independent remote GitHub provenance, a server-enforced exact-old-commit write, a durable owner-held offline backup, 418-specific multi-session Git-chain validation, updates to custom code outside resources, future Admin integration, or real website release.

## Important design questions to resolve before approving either layout

1. **Where is the non-resource code's single source of truth?** In the 415 option it must remain the pinned original/runtime plus an independently authenticated way to make approved shell changes. In the 418 option, prefix/suffix/separators must be the protected source and generated runtime must be validated, with no silent dual-edit paths.
2. **What is a revision?** A resource title/content-only commit must be associated with the exact parent Git revision and complete runtime hash. Decide separately how approved page/navigation and later shell edits can coexist; do not arbitrarily reject legitimate maintenance changes or allow the editor to overwrite them.
3. **How will the editor load the verified source?** The current repeat-edit preview is intentionally fictional and does not authenticate GitHub. Real Save needs independent commit provenance, entire original website preservation, path allowlists and conflict handling.
4. **What is retained for recovery?** Require an independently restorable, securely kept owner copy of full fetched Git history and tracked website files, plus separate owner handling for anything untracked, unfetched or external-service state.
5. **How is release proved safe?** Both variants need byte-for-byte website rebuild and custom script/media preservation, Chrome/Admin accessibility verification, an exact-old-commit conditional remote update, uncertain-response refusal and an owner-approved deployment/rollback process.

## Neutral decision guidance (no owner choice presumed)

- **415-file overlay:** worth investigating when avoiding duplication and small, reviewable resource changes is the priority. It is NOT independent of the protected original shell. The tested research verifier currently has the strongest version-history evidence for this specific variant.
- **418-file self-contained tree:** worth investigating when independent source-file reconstruction and explicit non-resource ownership are the priority. Its large duplicated source cost is measured, but future version-history checks and source-of-truth rules would need separate validation.
- **Alternative:** retain the current complete compatibility file as canonical and generate edit-specific outputs only after approved review. This may reduce migration risk but does not yet provide the desired independent per-resource persistence; it also needs a new formally validated design.

**No recommendation to merge or migrate yet.** Present this comparison to CosmicCuddle when a real choice is necessary; do not reinterpret continued planning as approval of any option.

## Safeguards that never change with the choice

Protect all **414 resource objects**, original Admin, original custom scripts/layout, all other embedded data, the original 27 DATA members and separately tracked 29-item collection, media, loader, existing workflows and historical Git changes. Never make a production file write, update GitHub refs, delete backups, or deploy based solely on this research evidence.
