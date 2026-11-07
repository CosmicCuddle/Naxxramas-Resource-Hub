# Stage 6 — bind a reviewed browser ZIP to a restore-tested backup of the SAME commit

**Status: 7 November 2026. Private test-only proof. No owner backup retained, no GitHub Save enabled.**

The existing website editor review ZIP and physical staging/rollback checks are separate from the existing `create-local-git-backup.cjs` Git-history backup tool. This check closes an important safety gap: **a backup may be valid yet belong to the wrong checkout**. A future Save must reject that situation.

The new `editor/tools/rehearse-backup-bound-browser-review.cjs` links three existing, independently checked activities into one test-only, read-only gate:

1. Verify a clean local Git checkout and pin its **exact commit**, Git source tree and tracked-file fingerprint.
2. Parse the actual browser-generated private review ZIP and require both page/navigation and resource drafts.
3. Use the existing backup tool to create a private Git bundle outside the repository. It verifies recovery **twice** before returning, preserving locally fetched reachable Git refs, commits and tracked content.
4. Re-check the **saved** bundle, its receipt and its recovery instructions. Demand the **same exact original Git commit, tree, tracked-file fingerprint and tracked-file count** as the proposed review. Check bundle size and SHA-256, sidecar warnings, private file permissions and backed-up fetched ref inventory.
5. Refuse a changed, corrupted, incomplete or wrong-commit bundle/receipt **before** staging any website edits.
6. Run the existing complete browser-ZIP-to-site staging and full tracked-file rollback rehearsal under OS-private folders. Verify all 415 resource source files, rebuilt compatibility HTML, original images/scripts/loader and complete original tracked-file restoration.
7. Verify the saved backup and original checkout **again** after the rehearsal. Delete the temporary Git bundle, sidecars and all preview directories. Fail closed on any altered files.

The new focused regression tests deliberately alter the saved bundle bytes, receipt's reviewed Git commit, tracked-file SHA-256 and recovery instructions. They also reject a stale checkout commit and page-only ZIP, verify complete rollback and ensure no generated private backup remains afterwards.

## GitHub check arrangement

The backup-binding test is deliberately **not** part of the existing `editor/tests/*.test.cjs` glob. It lives in `editor/qa/backup-bound-browser-review.test.cjs` and runs as a **separate read-only GitHub Actions job** with a *full fetched Git history checkout* (`fetch-depth: 0`). An ordinary shallow checkout is correctly refused by the backup tool, so the test cannot pass by treating incomplete history as a real backup. The existing editor job timeout is increased from 10 to 25 minutes because its combined suite had begun timing out despite its focused and complete Node tests succeeding.

### Strict limits

- This test creates a real **temporary** Git bundle and restores it twice, but **deletes it**. It **does not** create or retain the independent owner backup required before an approved release.
- Only locally fetched reachable Git objects/refs and tracked files are included in the bundle. GitHub settings/secrets, Pages configuration, external services, LFS data, never-fetched history and ignored/untracked files are not backed up.
- SHA-256 checks ensure integrity against the receipt; they do not prove who authored the editor ZIP.
- It does not write original website files, create a real GitHub commit, update a remote branch, approve the proposed 415-file overlay, merge, deploy, or complete original administrator acceptance.
- The alternative 418-file full source layout remains under consideration, with **CosmicCuddle's approval required** for the final choice.

This is another Stage 6 safety proof. Stage 6 is not complete and the website remains unchanged.
