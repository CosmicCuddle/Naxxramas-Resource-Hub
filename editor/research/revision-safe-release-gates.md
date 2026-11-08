# Private Resource Editor — Revision-Safe Release Gates

**Status:** research planning only; **not** a deployment plan, approved layout, or permission to alter the working website.

**Owner:** CosmicCuddle. The owner decides which source layout and whether any live change is permitted.

## Scope and preservation requirements

- Keep the existing original `site-content.html` and its SHA-256 `34455f6d901c538e2491a8c16681692e4c02d918b1984d7d0ba081aacb1049e8` (30,976,969 bytes) as an immutable, independently checked reference.
- Preserve all **414 resources**, all other embedded records (including the original **27 DATA members** and separately tracked **29-item collection**), protected fields, IDs, layout, scripts, media, and existing Admin behavior.
- No data migration or simplification is allowed to silently delete custom structures.
- Do not confuse a local Git object check with remote authentication or permission to publish.

## Verification state — 8 November 2026

| Gate | State | Required evidence before advancing |
| --- | --- | --- |
| Existing fictional repeated-edit browser screen | **Confirmed in previous exact-head CI** | Private Chrome at 1440px and 390px passed visual/control and Tab/Enter checks; **not** a real Save |
| Previous editor regression suite | **Confirmed in previous exact-head CI** | 499/499 Node editor tests passed at `748b949e322f14e3af6e4b090ad0b6d0a02f3a0c` |
| Pinned original Git blob → Revision 0 trust | **Awaiting exact-head CI** | `editor/tests/pinned-original-revision-trust.test.cjs` must run on `c26102e604478f8624d27a148f7eae4a23e8e5ce` with a checked-out Git tree and the real 31 MB website |
| Revision 1+ local Git chain verifier | **Research / unverified** | Eleven disposable original-backed Git test cases in `editor/tests/pinned-local-revision-chain.test.cjs` must pass on its exact research branch; its small stubbed tests are not sufficient |
| Real source layout | **Owner decision required** | Compare the **415-file overlay candidate**, which depends on the protected original compatibility shell, against the **418-file full-source candidate**. Neither is canonical |
| Real browser source acquisition | **Unverified** | Independently pin the exact Git revision and contents; reject uploaded ZIP/manifest-supplied trust values and never execute untrusted website JavaScript |
| Repeated Save operation | **Not implemented or approved** | A verified revision-bound editor, collision checks, strict path allowlist, exact Git blob preconditions and atomic conditional remote update are required |
| Whole-site backup and rollback | **Unverified** | Recover the full tracked website, page/navigation drafts, original Admin, all resources, media and approved history after a failed Save |
| Original Admin and accessibility acceptance | **Owner testing still required** | Confirm keyboard/Enter/Back behaviors and that real Admin features are unchanged before a release |
| Production release | **Blocked pending owner approval** | Explicit owner decision, reviewed source layout, backups, rollback, independent tests and a separate deployment plan |

## Revision 1+ integrity checklist

1. **Pinned exact Git history:** caller supplies the complete trusted chain of local commit IDs independently. Every next commit has the preceding exact commit as its only parent. Reject missing commits, merges, skipped versions and stale local HEAD. This is not proof of remote GitHub origin.
2. **Physical Git blobs, not working-tree files:** read `site-content.html`, `content/resource-overlays/manifest.json` and 414 `resources/####.fragment` files from each pinned commit. Require ordinary tracked files; reject symlinks, submodules, missing/extra paths and malformed UTF-8.
3. **Independent SHA and parent binding:** compute each resource SHA and complete website SHA from actual Git blob bytes. Bind manifest revision and `parentSha256` to the preceding independently verified revision, not its own claims.
4. **Exact reconstruction:** rebuild all 414 resources using the immutable original website's prefix, separators and suffix. The reconstructed bytes must equal the exact candidate `site-content.html` Git blob.
5. **Protected-field preservation:** a changed resource may alter only supported literal `title` and/or `content` values. Reject modified IDs, custom properties, scripts, layout, record punctuation and unrelated tracked files.
6. **No-op and duplicate protection:** reject a new revision with no real editable-field change, duplicate or unordered changes, stale draft SHA, or an unexpected path.
7. **Read-only evidence:** output source identity and checked counters, but do not output actual resource content or secrets. Must explicitly report `remoteGitHubHeadAuthenticated:false`, `sourceLayoutApproved:false`, and `canApply:false`.

## Required test coverage before considering integration

- Positive: original → Revision 1 title edit → Revision 2 multiline-content edit, with exact 414-resource and full website reconstruction at each step.
- Negative: incorrect chain parent, stale/local moved tip, skipped commit, forged/duplicate JSON manifest fields, wrong generated HTML, changed protected member, missing/extra Git files, symlink, invalid encoding, unrelated tracked page, duplicate/no-op edits.
- Security: source reading must never execute website JavaScript, call external endpoints, accept unapproved paths or mutate original tracked sources.
- Recovery: restore known-good whole-site source from an owner-approved backup after interrupted or uncertain Save; test denial, conflict and rollback paths.
- Usability: clearly distinguish **Preview**, **Local Draft**, **GitHub Save** and **Publish**. Avoid implying a reviewed fictional draft is stored persistently or that a local Git fingerprint authenticates the remote branch.

## Owner decisions to request only when evidence is ready

1. Select or reject the proposed canonical source layout; preserve a rollback copy of the original website regardless of choice.
2. Approve the exact intended real Save flow and whether users can modify page/navigation drafts along with resource edits.
3. Approve the final recovery and deployment plan after independent test evidence is reviewed.

**Current restriction:** do not merge, change the live website, alter original Admin, adopt the 415/418 layout or initiate any live GitHub Save on the basis of this research document.
