# Naxxramas website — first Windows private backup test

**For CosmicCuddle.** This is a manual, private test of the website's Git-history backup. The **live Resource Hub**, its GitHub `main`, your server and the empty private Save sandbox must remain unchanged.

## Before opening the helper

- Work from a **complete, clean local Git checkout** of `CosmicCuddle/Naxxramas-Resource-Hub` on the development branch `feature/multi-file-editor-export-2026-11-05`. A GitHub **Download ZIP is not enough**, because it contains no Git history.
- Git for Windows and Node.js must already be installed. This helper installs nothing and never asks for credentials.
- The checkout must contain the unchanged original `site-content.html` with its exact protected checksum, and the `editor/tools/` folder.
- If a full checkout is not already available, stop here. A safe, separate **read-only clone setup** can be arranged first; do not guess at commands or copy a downloaded ZIP into a Git directory.

## First test — one small action at a time

1. In that Git checkout, open `editor\tools\Start-Naxxramas-Private-Backup.cmd`. The helper checks your original source **before** opening the backup folder picker. If it refuses, **stop**; do not disable the check.
2. Pick a **private folder outside the website checkout**. Do not choose a public/shared/synchronised folder. The helper creates three files with the **same base name**: `.bundle`, `.bundle.receipt.json`, and `.bundle.READ_ME_FIRST.txt`.
3. The helper should say **“Local Git-history backup verified and restore-tested!”**. This confirms only the first locally stored copy. If you see a warning, **do not rely on the copy**.
4. Using Windows File Explorer, copy **all three files together** to a *separate, owner-controlled private/offline drive*. Keep them outside GitHub, the public website, cloud-shared folders and chat attachments.
5. Still in the clean Git checkout, open `editor\tools\Verify-Naxxramas-Private-Backup.cmd`. Select the **copied `.bundle` on the separate drive**, not the original source copy.
6. Look for **“The selected backup was VERIFIED and restore-tested!”**. Then the helper may offer **Yes** to copy a short safe status message. You can paste **only that status**, without sending any recovery file or revealing its path. If the optional clipboard is unavailable, backup verification remains successful.

## What this does and does not prove

- **Proves, after a successful second-copy check:** the selected existing three-file Git-history backup matches the original clean local checkout and can be restored independently.
- **Does not prove:** that the selected drive is physically off-machine; only you can confirm its storage location. Nor does it back up MySQL, WoW server files, LFS payloads, GitHub settings, credentials, issues or any remote history that was never fetched.
- **No remote writes:** these backup helpers never import to the private sandbox, enable Save, edit `main`, change GitHub Actions, or publish the site.
- **Do not share:** `.bundle`, `.receipt.json`, `.READ_ME_FIRST.txt`, private paths, account tokens or raw verification logs.
- **Stop if:** a file is missing, source is dirty/shallow, the checksum check fails, a dialog errors, or the private drive cannot be checked. Preserve any partial files privately but mark the backup as **unverified**.

## Milestone recording

**Not completed automatically by CI.** Mark “owner backup verified” only after the owner confirms that the *second copy on the separate private drive* passed the independent restore test and remains retained. Owner approval is still separately required before importing Git history to the empty private sandbox, and no test import is authorised by this guide.
