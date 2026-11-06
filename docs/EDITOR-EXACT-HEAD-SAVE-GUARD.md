# Website editor — exact-old-commit Save guard

**Status: DESIGN / OFFLINE REHEARSAL ONLY (6 November 2026). NOT A WORKING SAVE BUTTON.**

This document explains one necessary protection for CosmicCuddle's future GitHub-backed website Save/Restore system. It does not approve a storage format, authorize administrator login, create source commits, replace files, merge PR #56 or deploy the live site.

## Why a second GitHub head check is not enough

Two checks of the same remote Git commit only show that it had not changed **at those two moments**. It may change immediately before a proposed update. Even GitHub REST's `force:false` flag does not, by itself, express a required old commit: [REST Update a reference](https://docs.github.com/en/rest/git/refs) documents `sha` and `force` and describes **fast-forward** enforcement. A candidate might still be fast-forward of a newer commit but contain a stale edit.

A future approved writer requires a server-enforced **compare-and-swap**: *change this branch from exactly commit A to B only if it still points to A at the update boundary*. GitHub's [GraphQL `updateRefs` reference](https://docs.github.com/en/graphql/reference/git) documents the `RefUpdate.beforeOid` expected-old value and `afterOid` destination. It also states that updates in one `updateRefs` mutation are atomic. **No GraphQL mutation is called by our prototype.**

## Protected test-only contract

`editor/tools/plan-exact-head-save-guard.cjs` models this requirement using **fictional SHA values only**, with no GitHub API requests or filesystem writes.

- Exactly one designated **development** repository/branch is allowed in the rehearsal; `main` is refused.
- The independently verified local source commit must match the receipt's expected old commit. A receipt alone cannot authenticate a real checkout.
- The proposed new commit must be distinct, and `force` must remain `false`.
- The model states that future server-side GitHub updates must use an exact old commit check such as `RefUpdate.beforeOid`; a REST fast-forward check and repeat GETs are not substitutes.
- A fictional race **A → B → C** demonstrates why an editor reviewing A must refuse a proposed update based on A after another session has advanced the branch to B—even if C is a descendant of B.
- All code outputs remain marked `canExecute:false`, `canPush:false`, `canMerge:false`, `canPublish:false` and `githubWrites:0`.

Unit tests cover wrong repo/branch, incorrect commits, altered review permissions, altered old head, an independently pinned source mismatch, and the after-read racing update. **The tests are not proof of a real GitHub compare-and-swap transaction.**

## Future production acceptance gates (not yet met)

1. **Owner chooses and approves source format.** The 415-file resource overlay and 418-file duplicated source-tree designs remain unadopted. Existing page/navigation files, custom admin behavior and the complete `site-content.html` compatibility build must be preserved.
2. **Independent complete backup and restore.** Retain a full, verified Git/source/asset backup *outside* the temporary rehearsal; separately restore it and confirm rollback. A deleted test bundle is not a recoverable owner backup.
3. **Authenticate exact source and review edits.** Revalidate 414 fragments, original custom fields and media, page/navigation hashes, the 29-item side collection, every expected destination path and the rebuilt complete HTML. Refuse changed or unsupported versions. Keep existing browser drafts intact.
4. **Create verified candidate Git objects without moving a branch.** Match changed paths, proposed bytes and hashes, page data and source revision against the approved bundle. Never silently include unrelated paths.
5. **Update only through an exact old-head condition, on an explicitly approved non-production test branch first.** Validate before-and-after identities and `force:false` on a real atomic update operation such as documented GraphQL `updateRefs` with `beforeOid`. A connector's `expected_sha` parameter or two REST reads must not be *assumed* atomic without verifying how it is implemented.
6. **Fail safely on conflict or uncertain network result.** Preserve the draft, report that the site changed, and require a new deliberate review. Do not auto-rebase, force-update, repeat unknown outcomes blindly, or claim that a remote update succeeded merely because a request was sent.
7. **Separate deployment control.** Even a safe Git ref update can trigger repository webhooks and Actions. Publishing workflows must be gated and tested independently so an experimental Save cannot unintentionally publish a site.
8. **End-to-end acceptance.** Owner-approved administrator editing, two successive saves, conflict refusal, complete rebuilt website, mobile/keyboard behavior, media, recovery, and explicit CosmicCuddle approval before merging or deployment.

## What is confirmed versus unverified

**Confirmed in private tests:** verified original website baseline; 414-resource reconstruction; checksum-bound temporary resource files; stale-draft rejection and fictional branch race refusal; original Admin password entry on desktop/mobile; no live writes.

**Unverified / not approved:** canonical GitHub resource source, real remote CAS semantics in the chosen writer, retained independent production-grade backup, real administrator edit/Save/Restore, actual branch-writing transaction, deployment gating and owner acceptance.

**Do not publish or connect real Save controls based on a matching metadata receipt or this test-only contract.**
