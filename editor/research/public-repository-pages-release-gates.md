# Resource Hub public exposure and deployment boundary

**Evidence:** real read-only GitHub API check, 8 November 2026, [PR #57 research workflow #42490916014](https://github.com/CosmicCuddle/Naxxramas-Resource-Hub/actions/runs/42490916014). This is a source/settings inventory, not a release, security certification or owner permission.

## Confirmed current configuration

| Item | Result |
| --- | --- |
| Repository | `CosmicCuddle/Naxxramas-Resource-Hub` — **public** GitHub repository |
| GitHub Pages | **Enabled** |
| Pages build mode | `legacy` |
| Pages publication source | **`main`** |
| `main` | API returned `protected:false`, `protection.enabled:false` |
| `feature/multi-file-editor-export-2026-11-05` | API returned `protected:false`, `protection.enabled:false` |
| `research/read-only-revision-chain-2026-11-08` | API returned `protected:false`, `protection.enabled:false` |
| Repository ruleset listing | **0** rulesets returned |
| Existing committed Actions files | Three workflows in the feature branch and four in the research branch, all reviewed workflows requesting `contents:read`. No deployment/publish step identified in these four reviewed tracked workflow files |

The real release-surface inspector (`editor/tools/inspect-release-surface.cjs`) checked these settings using narrowly allowed read-only GitHub endpoints, performed a second research branch HEAD read, and refused to infer any Save permission. Its **9/9** automated test cases passed. The private website source checksum was also checked and the tracked checkout remained unchanged.

## What this does — and does not — mean

1. **Pages source is `main`:** saving to a research or feature branch does not itself update the configured Pages source branch. A reviewed merge or direct commit to `main` **can trigger Pages rebuilding and publishing** under the current Pages configuration. Do not assume the Pages build waits for a separate approval.
2. **Protection is currently absent:** all three examined branches reported unprotected. Passing CI does not itself prevent someone with sufficient repository access from updating those refs. Existing test permissions, no-force requirements and reviewer discipline therefore cannot be replaced by assumptions about GitHub-enforced protection.
3. **Public source is publicly accessible:** do not place any historical backup bundle, secrets, private media, player information, external-service configuration or unreviewed website source in a public repository, PR comment or public Actions artifact. An owner-held recovery copy must be secured separately.
4. **Pages settings were directly checked, but not every deployment provider:** DNS, third-party hosting, Actions administrators, environment settings and repository secrets were **not fully inspected**. Absence of explicit deployment commands in the reviewed workflows does not prove there are no external automatic deployment routes.
5. **Snapshot, not an ongoing lock:** settings and branch heads can change after the observation. Future approval requires fresh verification.

## Required stop signs for any future Save or merge

| Proposed action | Until further verification |
| --- | --- |
| Move or rewrite a research/feature ref | **No real Save implementation**. Require owner approval, independently pinned remote commit+tree, exact server-enforced previous OID, reviewed changed paths, retained backup and conflict/timeout safety |
| Merge to `main` | **Block** until CosmicCuddle approves the full Pages publication effect, source/layout choice, original Admin compatibility, backup, rollback and browser/keyboard acceptance |
| Edit Pages source or GitHub branch protections | **Do not change** without an approved implementation plan and owner decision. Evaluate required checks/reviews and no-force controls separately |
| Upload a Git bundle/backups to GitHub | **Never use this public repository as a confidential backup destination**. Confirm a private, owner-controlled retention location and independent restore |
| Assume outside hosting is isolated | **Do not assume**; inventory any connected external publishers separately |
| Infer permission from green Actions | **Never**. CI success is evidence of tests, not authorization to publish or deploy |

## Next owner-directed decision, not requested yet

Once the read-only research and durable retained-backup gates are complete, bring CosmicCuddle a concise proposal to approve (a) backup location/retention, (b) whether `main` must acquire branch protection/required CI reviews, (c) how Pages publication is deliberately gated or staged, and (d) an exact rollback plan. Do **not** change branch settings, enable Save, merge or deploy automatically.

**Scope of this record:** the 414 resources, original non-resource content, original Admin, custom scripts, media, and the selected storage strategy remain untouched. Neither the 415-file nor 418-file source layout has been selected.
