# Naxxramas Game Clients — local draft preview (Windows)

**Read-only preview.** This runs the draft website from your own extracted folder on http://127.0.0.1:18765/. It does not publish, upload, or modify the real website.

1. **Extract the entire ZIP** to a normal folder on your Windows computer.
2. Double-click tools/local-preview/Start-Preview.cmd.
3. A browser opens the local website. Navigate to **Game Clients**.
4. Use the website's existing Admin Mode to check that the original editor is accessible. Do **not** submit application forms, change the live website, or share credentials with anyone.
5. Stop the preview by closing its black console window.

The small built-in PowerShell server handles **GET and HEAD only**, binds strictly to **127.0.0.1**, and does not write to any file. Any website editor changes that rely on browser storage are local to the localhost origin. **Do not assume saved admin changes will appear on the public site.** If the editor uses an external service, stop before making a save and ask for a review.

No extra software is required on a normal Windows installation with Windows PowerShell.

**Safety:** No administrator privileges, new account or external launcher should be needed. Run this helper only from your own official GitHub PR preview package. This is still an unmerged draft.