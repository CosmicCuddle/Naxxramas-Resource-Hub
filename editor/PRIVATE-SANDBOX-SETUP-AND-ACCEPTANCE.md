# Private GitHub Save sandbox — setup and acceptance gate

**Status: PREPARATION ONLY — draft PR #56.** No separate sandbox repository has been created by this work. This is not permission to import site history, upload files, provide credentials, or activate real GitHub Save or Publish.

## Purpose

Prove an **authenticated** GitHub Save in an independent **private** repository without changing `CosmicCuddle/Naxxramas-Resource-Hub`, its `main` branch, GitHub Pages, or the existing public website. The current source-to-Save integration is already covered by automated local/disposable and *fictional GitHub-service* tests, including the original 30,976,969-byte runtime and 414 resources. An authenticated remote test remains a separate acceptance gate.

## 1. One-time private sandbox creation — owner action

The connected GitHub tools can inspect and edit existing repositories but currently expose **no create-repository action**. CosmicCuddle must create the repository from the GitHub website, or explicitly use another approved setup path. No access token should be pasted into chats, GitHub Issues/PR comments, editor pages, or source files.

- Open <https://github.com/new>.
- Owner: `CosmicCuddle` (not another account or organisation).
- Repository name: `Naxxramas-Editor-Save-Sandbox-01`.
- Visibility: **Private**. **Not Public**.
- Do not choose a template or fork. Leave **Add a README file**, **Add .gitignore** and **Choose a license** unselected. The repository should start **empty**, to allow an exact copy of the intended original Git history later.
- Create the repository. **Do not import, upload, push or paste anything yet.**
- Before importing Git history, check **Settings → Actions → General** and disable workflows in this *sandbox only* until the owner approves a suitable policy; copied website history contains workflow files. Leave GitHub Pages disabled and do not set up deployments.

**Verified state (9 November 2026):** The authenticated GitHub connection confirms that the separately created sandbox **exists, is Private, is not archived, has zero repository size and no branches**. The owner reports that Actions has been disabled. The connected GitHub tools **cannot independently read the repository-level Actions permission setting**, so this remains **owner-reported, not API-verified**. GitHub Pages/deployments have not been independently checked. Do not enable public visibility to make the app see it. Never infer owner approval for history import or authenticated writes from this verification.

GitHub's documentation recommends leaving README/licence/.gitignore unselected for importing an existing repository: <https://docs.github.com/en/migrations/importing-source-code/using-the-command-line-to-import-source-code/adding-locally-hosted-code-to-github>.

## 2. Read-only identity and isolation checks before any write

After setup, verify using the authenticated GitHub connection or an equivalent owner-authorised check:

1. The exact full name matches `CosmicCuddle/Naxxramas-Editor-Save-Sandbox-01`.
2. Visibility is `private`; the connected app can *read* it without making it public.
3. The repository is **not** `CosmicCuddle/Naxxramas-Resource-Hub`; the actual website's default branch commit and Pages configuration remain unchanged.
4. No arbitrary webhooks, deploy keys, workflows or GitHub Pages deployment have been enabled.
5. No test credentials, Git bundle, live connection configuration or original source data are posted in a public Issue or Pull Request.

**Do not attempt a GitHub write while any identity or privacy check fails.**

## 3. Retained source recovery and exact test branch

Before any authenticated remote upload:

- Create a **new private, owner-held, durable backup** of the original *clean, complete* source checkout using `editor/tools/create-local-git-backup.cjs`. It creates one `.bundle` and two sidecars (receipt + recovery notes). Store these **outside Git and off-machine** in the owner's selected private location. Never upload them to public GitHub/CI artifacts.
- **Windows folder-picker helper (development only):** Once the owner has an authorised local **complete, clean Git checkout** of the website and Node.js/Git installed, double-click `editor/tools/Start-Naxxramas-Private-Backup.cmd`. The PowerShell helper asks for a private destination **outside the repository**, invokes the existing backup creation tool, independently verifies the newly saved bundle with a further physical Git restore, and reports failure without ever claiming success for a partial copy. It does **not** fetch a checkout, install software, use GitHub credentials, upload, publish, or create an off-machine copy. The optional Windows picker itself is not yet owner-tested.
- **Separate recovery copy:** Keep all three files together on a separate owner-controlled private/offline drive. Verify **that retained second copy**, not merely the temporary/local file, with `verify-retained-backup.cjs`. The folder-picker success message proves only the first local saved copy was restorable; it never claims the off-machine copy was created or verified. Windows file-system permissions and external-drive safety need owner validation.
- **Windows mouse-only verification of that second copy:** Double-click `editor/tools/Verify-Naxxramas-Private-Backup.cmd` in the same clean local checkout. Choose the **existing** `.bundle` on the private backup drive. The associated `.receipt.json` and `.READ_ME_FIRST.txt` must be alongside it. This wrapper calls the read-only `verify-retained-backup.cjs` to physically restore and check the selected copy against the exact current Git commit. It does **not** create, copy, alter, upload, decrypt or publish any file. It cannot establish that the drive itself is offline/off-machine; the owner confirms where it is stored. Windows GUI interaction is still **untested on the owner's computer**.
- **Safe confirmation for coordination:** After a successful separate-copy verification, the Windows helper offers **Yes / No** to copy a plain-text status summary. Choosing **Yes** copies only the exact original Git commit and verification PASS / NOT VERIFIED claims (no backup contents, file path, passwords or receipt). The owner can paste that summary into the private chat to help record the milestone. The summary **does not prove the drive is off-machine**; independently confirm the drive's storage with the owner. Choosing **No** leaves the clipboard unchanged.
- Run `editor/tools/verify-retained-backup.cjs` against that **existing retained** bundle. It verifies the original Git commit, full fetched history and byte-identical files, then independently restores from the saved file. A CI rehearsal that creates/deletes a temporary bundle does **not** count as an owner-held backup.
- This bundle protects locally fetched Git history and tracked files only; it is **not** a complete server backup and does not include GitHub settings, secrets, untracked files or missing remote history. Record those separately where applicable.
- With separate owner authorisation, seed the private sandbox from a pinned, backup-matching original Git commit and original complete site tree. Preserve commit/tree SHA-1 identities; avoid creating an unrelated initial README commit. Do not copy deploy secrets.
- Set up a single private non-publishing test ref `refs/heads/editor-saves/<approved-test>`. No force operations, no updating `main` in either repository.
- The **proposed** 415-file resource overlay (414 fragments plus manifest), plus modified original website files, is still a *development candidate*, not approval to migrate or merge the live site.

No unreviewed full-history mirror push is authorised by this checklist.

## 4. Authenticated sandbox test gate (separate approval required)

The server-only code in `editor/tools/github-sandbox-api.cjs` is **not** connected to the normal editor or a persistent credential store. Configure it only after independent review of its API request routes and safety assumptions. Give it only a **short-lived, repository-scoped credential** for this particular sandbox; never a token with access to the real website repository. The browser must never see the token.

Verify, in order:

1. Repository node ID, privacy, exact original head and original Git tree independently.
2. All 415 proposed resource files and each changed tracked file match the locally reviewed bytes/Git blob hashes; unchanged original files must survive.
3. Each object upload returns the expected blob SHA. Tree identity matches the independent full-website tree. Commit has exactly the intended previous head as parent.
4. Update **only** the `editor-saves/*` ref using GitHub GraphQL `updateRefs` with `beforeOid` equal to the previous exact commit and `force:false`. A simple pre-read is not a lock.
5. Independently reread the remote ref, complete tree and commit. Prove a stale concurrent Save fails. On timeout or uncertain result, **never retry automatically**; preserve the editor draft and inspect the branch.
6. Test restoration from the *owner-retained* recovery copy, confirm unaffected site/Admin assets and document a rollback decision. Remote writes to the original website are still prohibited.

Do not disclose the credential or captured GitHub response bodies if they could contain private data.

## 5. Status and owner approval boundaries

| Item | Gate |
| --- | --- |
| Draft-branch local browser Save, full-source reconciliation and isolated local Git commit | CI evidence available in PR #56; verify exact latest SHA |
| Server adapter with fictional GitHub responses | Implemented and tested; **not a real authenticated GitHub Save** |
| Private test repository created and visible | **Not confirmed** |
| Original history seeded into separate test repository | **Not done** |
| Durable owner-held, restore-tested backup | **Not confirmed** |
| Authorised scoped test credential | **Not provisioned** |
| Authenticated sandbox write, conflict and rollback | **Not performed** |
| One-click Save to actual Resource Hub development branch | **Disabled** |
| `main` merge, live website or Pages publication | **Not authorised** |

Owner approval to **create an empty private sandbox** does **not** authorise importing history, remote writes, production Save, source-layout migration, or publishing. Each risk boundary needs separate verification and explicit approval.
