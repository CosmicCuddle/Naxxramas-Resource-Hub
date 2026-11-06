# Website editor — milestone 6 dry-run GitHub changeset review

**Status: TEST-ONLY RESEARCH. Not approved for real saving, merge or publication.** This file records progress in [draft PR #56](https://github.com/CosmicCuddle/Naxxramas-Resource-Hub/pull/56). It does not create a source tree or deploy anything.

## Where it fits in the release plan

For communication with CosmicCuddle, the working editor-release roadmap is described as **nine estimated milestones**. This is a *planning framework*, **not** a GitHub Actions percentage or a guarantee of development time:

| Working milestone | Status | What completion means |
| --- | --- | --- |
| 1. Inventory original website | Baseline complete | Preserve original 30,976,969-byte website and 414 resources, including custom fields, data and embedded images |
| 2. Separate editable page/resource drafts | Prototype complete | Page/navigation v3 and resource v2 drafts exist without rewriting the live website |
| 3. Establish non-destructive protection checks | Baseline complete | Source hashes, no accidental root loader rewrite, custom/admin preservation gates |
| 4. Reconstruct separate resources | Private proof complete | Exact original rebuilt from 414 resource records and unchanged non-resource shell |
| 5. Verify versioned edits, conflicts and physical files | Private proof complete | Two-session revision tests, stale refusal, 414 physical-file SHA checks and private-browser examples |
| **6. Create safe GitHub-ready Save/Restore** | **IN PROGRESS** | Approve the canonical source layout, actual editor integration, real repository update package, complete source verification and repeatable durable saves |
| 7. Verify original administrator editing | Not yet accepted | Real admin work in disposable copy, all original custom features and fields protected |
| 8. Visual, keyboard, and complete-site acceptance | Partial automated checks | Owner-approved visual comparison, full browser interaction, source compatibility |
| 9. Backup, rollback, release | Owner gated | Independently retained/restored full backup, rollback plan, owner approval, controlled merge/deploy and verification |

The five completed milestones refer to **research and prototype gates**, not completed production migration. The final four may require more engineering work than the first five. This roadmap is an explanatory stage estimate, not a previously approved official schedule.

## Current milestone 6 deliverable: read-only file-change receipt

`node editor/tools/plan-private-github-source-review.cjs` runs solely against a **disposable OS-private** 415-file resource overlay and the **verified original website shell**. It is a **dry-run**, not an exporter.

Before calculating a change list, it validates the entire currently selected 414-file resource set, current manifest and complete reconstructed website, and refuses stale or malformed versioned drafts. It uses the existing safe title/content editor functions to calculate the proposed result **in memory**, with no writes.

A review receipt identifies:

- The **current and proposed revision numbers** and complete-site SHA-256 fingerprints.
- The **exact proposed relative paths** for affected resource fragments, the single resource manifest and `site-content.html`. Only the specifically edited resources are included; 413 unedited resources in a one-record example do not appear.
- **Before/after byte sizes and SHA-256 hashes** for these proposed files. The old manifest digest uses its **actual validated file bytes**, not a guessed serialization.
- The confirmed **414 physically checked resource files**, plus the count of unchanged fragments, and explicit flags indicating that the file layout, trusted Git commit, owner approval, backup, production release and real administrator workflow are **not** verified.

A draft editing one resource yields **three proposed GitHub paths**: one resource fragment, one manifest and the generated compatibility file. Two edited resources yield **four proposed paths**. The complete 31 MB runtime file is generated in memory to compute the expected checksum; **it is not exported or committed**. No original source values, changed titles/content, IDs, private images, individual collection data or generated HTML bytes appear in the receipt.

A second-session test first proposes revision 1, then writes only to the private disposable simulation, refuses the stale revision-0 draft and successfully proposes revision 2. This proves *review planning logic*, **not** real concurrency control or a working installed editor Save button.

## Approval and production-blocking dependencies

A checksum-only receipt is not automatically "GitHub-ready" and carries **no file bytes**. It is also not authenticated by a verified Git commit or approved as a durable source-of-truth format. The tested `content/resource-overlays/` path is a **candidate**, not an accepted repository layout.

**Before a real release**, milestone 6 still requires:

1. CosmicCuddle's explicit choice and approval of a canonical source layout and which files the editor should produce.
2. Safe version transition from existing resource v2/page v3 drafts to an approved manifest and reviewable changeset, with no silent conflicts, loss of old drafts or extra manual typing.
3. Exact branch-head commit checks, atomic staging, safe cross-process conflict refusal, retained source content and a release builder that outputs the complete compatible site under review.
4. Correct GitHub branch/PR checks with clear approval boundaries, and independent testing of generated output against custom admin behaviour, source data, media, accessibility and visual acceptance.
5. Separately retained and **restored** full repository/assets backup, simple rollback and final owner release approval.

Do not merge, deploy, modify public `site-content.html`, replace original `index.html`, or treat this proof as a finished export. All temporary test source files are deleted after rehearsal.

## Source references

- The [source-storage decision](EDITOR-SOURCE-STORAGE-DECISION.md) compares 418-file duplicate-tree, 415-file overlay and build-only publication candidates.
- The [Save/Restore preflight report](EDITOR-RESTORE-UX-PREVIEW.md) explains the difference between browser metadata checks, physical fragment checks and the separate complete-source verification.
- GitHub workflow `Naxxramas editor prototype checks` runs the private change receipt after the source integrity test; its exact-head outcome must be checked before describing this milestone as verified.
