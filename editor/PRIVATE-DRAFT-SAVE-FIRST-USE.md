# Private GitHub draft Save — first use (PROPOSED)

**Purpose:** Click **Save My Edits Privately** in your Naxxramas website editor, then **Load My Saved Edits** later. This is a separate, *unpublished draft* workflow. It does **not** update the live website, overwrite original GitHub source, deploy, or change WoW server files.

This is the simpler option for ordinary editing. It saves **one combined review ZIP** containing your page and resource edits, rather than migrating 414 resources into new source files. Each Save creates a new Git commit in the separately owned **private** sandbox, so an older draft can be recovered if needed.

## Current approval/status

- The exact sandbox repository `CosmicCuddle/Naxxramas-Editor-Save-Sandbox-01` exists and is verified **Private**.
- It is still **empty**. The new draft storage needs a one-time initial `main` commit, containing **only a small README**, before its first Save. **Do not create this until CosmicCuddle explicitly approves changing the sandbox's purpose to private draft storage.** This is an alternative to importing the original public website Git history, not an unapproved import.
- The owner reports that Actions is disabled in that sandbox. This administrative setting cannot currently be independently inspected by our connected GitHub tool. Do not enable Pages or public visibility.
- The Save/Load implementation is development code on draft PR #56. GitHub Actions test results are separate from an actual authenticated private Save.
- A real GitHub Save has **not** been made. No private draft ZIP, credentials or website source has been uploaded.
- The original website/source backup and restore requirements still apply to any **future production source update or publication**. A private ZIP of unpublished edits is **not** a full website or server backup.

## After sandbox initialisation is separately approved

1. On the Windows editing computer, install Node.js 22+ and GitHub CLI if not already present. Sign in to GitHub CLI using **`gh auth login`**. Never paste authentication tokens into chats, the website editor, or GitHub Issues.
2. Use your existing local website editor folder. Double-click `editor\tools\Start-Naxxramas-Private-Draft-Editor.cmd`. It runs only when explicitly opened, verifies the sandbox is still **Private**, then opens a local `127.0.0.1` editor in your web browser. Close its console to stop it.
3. Load your original website page folder and `site-content.html` as usual, edit text or resources, and apply the edits inside the editor.
4. Click **Check Save Connection** once if needed, then **Save My Edits Privately**. The server sends your checksummed combined edit ZIP to **only** `editor-drafts/latest-review.zip` in the private sandbox. It re-reads the saved bytes and Git commit before saying Saved.
5. On another day, start the private editor, click **Load My Saved Edits**, then use the existing **Restore Page Draft** and **Restore Resource Draft** buttons. The existing checksum/source checks still apply. You do not need to download or re-upload the draft ZIP manually.

## What Save means

| Operation | Effect |
| --- | --- |
| **Save My Edits Privately** | Retains unpublished edit drafts in a private GitHub repository |
| **Load My Saved Edits** | Retrieves and validates those edits so you can continue |
| **Publish website** | **Not connected or authorised**; separate reviewed action |
| **Original Resource Hub main branch** | **Never touched by this draft Save feature** |
| **Naxxramas WoW server** | **Never touched** |

A failed or uncertain Save **must not automatically retry**. Keep unsaved edits in the editor and inspect the private draft history first. The local service always refuses a missing/uninitialised branch, public repository, unapproved connection, wrong source, unexpected file path or invalid response.

**One-time owner decision required:** Approve using the existing empty private sandbox for *unpublished editor draft storage*, with one initial README commit on its own `main` branch. This would replace the earlier proposal to seed the sandbox with the entire original website history for the **first draft-only Save test**. It does not approve a live website write, source migration or publication.
