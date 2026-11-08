# Remote GitHub source trust and safe Save boundary

**Status:** research-only acceptance specification, **not** an implementation, authorization, selected storage layout or production release plan. Owner/final approver: CosmicCuddle.

**Evidence reviewed:** 8 November 2026. Private Naxxramas Resource Hub, draft PRs #56 and #57. Existing source, original Admin, all 414 resources, 27 original DATA members and the separately tracked 29-item collection remain protected. Never expose tokens or confidential historical Git objects in logs/issues.

## Verified technical basis

1. The repository already has the **read-only, double remote-head observation** tool \`editor/tools/rehearse-remote-github-head-preflight.cjs\`. It compares a configured GitHub ref's commit twice against a separately verified local checkout. The reads are **not a lock**, and a pull-request *synthetic merge commit* is not the branch's reviewed head. Its evidence does not authorize writes or authenticate all remote source blobs.
2. \`editor/tools/plan-exact-head-save-guard.cjs\` simulates the required expected-old-head condition. GitHub's **REST Update a reference** endpoint documents \`sha\` and \`force\`, not a separately supplied expected old SHA. \`force:false\` checks ancestry/fast-forward suitability, not equality with a reviewed head. **Do not use a REST fast-forward PATCH as an exact-commit Save lock.**
3. GitHub's documented **GraphQL \`updateRefs\` mutation** accepts \`repositoryId\` and \`refUpdates\`; each \`RefUpdate\` may specify \`name\`, \`beforeOid\`, \`afterOid\`, \`force\`. \`beforeOid\` means a reference must currently equal the reviewed old OID, otherwise the update is rejected. Multi-ref updates are atomic within that mutation. This is the proposed *future* server-enforced compare-and-swap (CAS), **not an operation implemented or performed by our code**. Verify actual availability, branch protections, access permissions and error handling in a separately approved disposable test repository before implementation.
4. \`editor/tools/plan-uncertain-save-outcome.cjs\` and \`review-backup-bound-save-outcome.cjs\` intentionally refuse automatic retry when the result is unknown. A matching read response, a self-asserted manifest, temporary CI backup or a token in a browser does **not** meet the source/safety requirements.

**Public reference documents (read-only):**
- GitHub REST Git references: https://docs.github.com/en/rest/git/refs
- GitHub GraphQL Git types and mutations: https://docs.github.com/en/graphql/reference/git

## Future release boundary: independent evidence required

| Gate | Independently verifiable condition | Status |
| --- | --- | --- |
| R0: Owner decision | Explicit approval of canonical source layout, permitted editor scope and backup/recovery responsibilities | **Blocked; no approval** |
| R1: Recoverable source | Owner-retained private full fetched Git-history bundle and exact tracked website; independently recovered from the *retained* files; excluded services handled separately | **Blocked; CI copies are deleted** |
| R2: Remote identity | Authenticated API ref observation of the **exact approved repository and branch**, expected commit and source tree, with least-privilege server-controlled credentials; no redirects or secret logging | **Read-only preflight exists; not complete release attestation** |
| R3: Source content | Independent exact Git commit/tree/blob verification, full 414-resource reconstruction and unchanged original custom/other website content. Pin **every** reviewed changed Git path and its old/new blob identities | **Research proofs, not production candidate approval** |
| R4: Conflict and permissions | Reject if remote ref changes after review, paths change, branch protections disallow update, permission is missing, or an owner-managed process modifies content | **No live Save implementation** |
| R5: True remote CAS | A separately approved update using exactly one intended branch and **required** old \`beforeOid\`, new \`afterOid\`, \`force:false\`. The new object must exist and be a reviewed descendant of old. Never allow force update, ref deletion, wildcard repository or unapproved path | **Not implemented or authorized** |
| R6: Post-update evidence | Following an authenticated response, independently re-read remote ref and every reviewed file/tree from GitHub; confirm complete intended source, and separately validate browser/Admin/deployment outcome | **Not implemented** |
| R7: Owner release | Explicitly approve deployment after backup, rollback proof and accessibility/source tests; deployment/hosting/service changes are a separate release action | **Not approved** |

### What a safe review-only screen may say

- **Local Draft**: only local work, not stored in GitHub.
- **Preview Verified**: locally checked exact Git blobs and reconstructed website at a pinned commit; **no remote Save or publish**.
- **Remote Ref Observed**: authenticated ref read, but **not reserved or locked**. The branch may change immediately.
- **Save Conflict**: ref/source changed; preserve the draft and request human review.
- **Save Uncertain**: outcome unknown; preserve all evidence, no automatic retry.
- **Saved and Independently Verified**: reserved for a future approved write *only after* independent source/ref verification and owner approval. This research branch must never display it as an achieved status.

## Failure matrix: fail closed

| Scenario | Required behaviour |
| --- | --- |
| Expected branch matches twice, then another editor advances it before update | A **server-side \`beforeOid\` mismatch** must refuse the update. Two reads do not prevent this race |
| New intended Git commit is descendant of reviewed old, but another commit appears first | Refuse despite fast-forward compatibility; never fall back to REST \`force:false\` alone |
| API request times out, process crashes or reply is lost | **Do not retry automatically.** Independently read remote state, preserve local draft, alert owner; previous action may or may not have committed |
| Remote head remains old after timeout | Hold; an in-flight action may exist and the state can change. Never replay blindly |
| Remote head equals candidate after timeout | Independently verify commit, complete tree, changed/unchanged file bytes and any external release effect; do not treat HEAD equality alone as proof of who made the change |
| Remote head is third-party commit | Conflict; preserve both sides, no reset, force push, merge or delete |
| New ref/commit tree has unexpected file changes or non-resource scripts altered | Quarantine candidate, stop publication |
| Owner's retained backup is missing, changed, private-file permissions unsafe or cannot restore | Block Save, even when temporary CI recovery was green |
| GitHub branch rules, Pages or external deployment can publish automatically | Pause release design; separately inventory and isolate deployment effects **before** enabling any real branch update. Git ref CAS does not suppress third-party workflows |
| Mixed page/navigation and resources | Require complete approved file-path set and all exact old/new blob identities; a resource-only review may not claim page/editor changes are approved |

## Non-negotiable implementation constraints

- **No real write client** belongs in the read-only preflight or proof modules. No GitHub token embedded in website HTML or browser JavaScript; choose a separately reviewed server-controlled credential mechanism, with least privilege and auditable owner approval.
- Never place a bearer token, private bundle, historical secrets, full source, remote account settings or private files in public logs, PR comments, Actions artifacts or screenshots.
- \`beforeOid\` must be server enforced at the mutation, not emulated by two reads. Do not assume GitHub API offers a cross-provider deployment lock or idempotent Save retry.
- An atomic Git ref update is not an atomic website deployment or backup transaction. Define deployment isolation and rollback separately. A ref update may trigger other systems; avoid live trials on production.
- A GitHub API observation authenticates the **response from the intended provider under its TLS/credential trust boundary**, not who personally authored every commit nor completeness of untracked/external service data.
- A valid release must protect all old/custom website source outside deliberately approved resource and page edits and have a tested restore of **every required tracked byte and fetched history object** from retained owner files.

## Evidence status at creation

- **PR #56:** all three workflows passed at \`c26102e604478f8624d27a148f7eae4a23e8e5ce\`; remains draft.
- **PR #57:** both workflows passed at \`3ce3266db3eeb6f7759106c9998afe6003bc3cae\` before this document-only change; remains draft.
- **No durable retained owner backup, no 415/418 approval, no genuine write or live deployment.** Research results prove local Git integrity and temporary recovery only.

## Owner decisions later, once the technical evidence is ready

1. Choose the canonical source layout (or request a third option).
2. Confirm where an independently retained private backup will live, how it is access-controlled and how excluded service settings should be handled.
3. Approve the exact permitted Save, accessibility test and release workflow after a safe independent **test-repository-only** CAS proof.

Nothing in this specification grants developer permission to use a real ref-mutation API, change branch protections, merge, publish, deploy or alter original Admin.
