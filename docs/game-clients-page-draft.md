# Game Clients — page content draft

**Draft only.** This is preparation for the existing Game Clients section, not a published page. No private Naxxramas realm address, realmlist contents or login details belong here.

## Download and Set Up Your Game Client

Naxxramas uses **World of Warcraft: Wrath of the Lich King 3.3.5a, build 12340** for every progression era. You continue using the same game client as your character moves from Vanilla through The Burning Crusade to Wrath of the Lich King.

### Step 1 — Choose a download source

**Preferred client:** awaiting the owner's tested URL. Do not publish a working-looking button until the download and version are checked.

**Alternative — Warmane:** https://www.warmane.com/download . This is its current download page, but the required older download variant has **not** been confirmed to work. The previously attempted archived link should not be promoted as functional.

Naxxramas does not host or distribute the base game client through this page.

### Step 2 — Prepare the game folder (Windows)

1. Finish downloading your client.
2. If it is packaged as a ZIP, RAR or 7z archive, extract the complete archive into a dedicated writable folder, such as C:\Games\World of Warcraft 3.3.5a.
3. Open that folder and find Wow.exe and the Data folder.
4. Keep the downloaded client separate from any other private-server installation.
5. Do not use a third-party launcher to update the game to another version; run Wow.exe when ready.

### Step 3 — Verify the version

Check that the client is **3.3.5a, build 12340**. Another build, a modern retail client or an older 1.12 client is not suitable.

### Step 4 — Install required Naxxramas patches

1. Close WoW.
2. Find the approved patch releases: https://github.com/CosmicCuddle/Naxxramas-Server-Patches/releases .
3. Install both required files: **patch-V.mpq** and **patch-Z.mpq**. Check the latest release instructions before choosing downloads.
4. Place both MPQ files inside the game's **Data** folder. Keep the specified names exactly.
5. Optional visual packages such as Patch-J.mpq and Patch-U.mpq do not replace the two required files.
6. Only clear Cache when instructed by the relevant release or troubleshooting. Keep Interface and WTF, which hold addons and game settings.

### Step 5 — Configure the connection after acceptance

The server owner sends the approved **private connection configuration file** and next steps with an acceptance email. The server address is **not publicly listed**.

Follow those private instructions and place the supplied file in the appropriate client language folder (usually Data\enUS or Data\enGB). The filename is realmlist.wtf. Keep any existing configuration as a backup, and make sure Windows has not accidentally added a .txt extension.

Do not use someone else's unofficial connection file. Never share account passwords or the private connection information publicly.

### Step 6 — Start the game

Launch **Wow.exe**, not an automatic updater, and follow the privately supplied account instructions. The same client works for all three expansion eras; content access depends on your character's Individual Progression.

### Common problems

| Symptom | What to check |
| --- | --- |
| Broken client download | Use only a source whose file and game version have been checked; report the broken link. |
| Wow.exe missing | Ensure the archive was extracted completely and you opened the main client folder. |
| Wrong client version | The required version is 3.3.5a, build 12340. |
| Missing Naxxramas custom content | Confirm patch-V.mpq and patch-Z.mpq are both inside Data, matching the approved release. |
| Game connects to a different realm | If accepted, follow the owner's private connection instructions and verify the correct language folder. |
| Authentication failure | Check that onboarding has been completed. Do not guess server settings or share passwords. |
| Addons malfunction | Check addons are designed for the 3.3.5a client. They live under Interface\AddOns, separately from MPQ patches. |
| Still stuck | Record the exact error and ask the owner for help without posting passwords or private realm details. |

### Presentation and review requirements

- Integrate with the existing Game Clients tab; retain the Resource Hub's current navigation and dark/gold visual theme.
- Make download choices easy to distinguish. The preferred source needs to be confirmed before being labelled as tested.
- Keep the numbered setup instructions on this page instead of duplicating them across Server Rules and Apply to Join.
- Cross-link the New Player Guide, Apply to Join and Patch Notes briefly rather than reproducing their full content.
- Verify all download URLs, patch release details and actual client build before publishing.
- Never include a server IP, a prefilled realmlist or any real credentials in public HTML, scripts, data, README files or this guide.
- Do not package or upload third-party proprietary base game files.

### Outstanding before website integration

1. Owner's preferred client download URL and actual tested result.
2. A working, tested source for the alternative older Warmane client, if still wanted.
3. Review the current Game Clients tab markup before applying HTML changes.
4. Confirm the current approved Naxxramas patch releases and perform browser checks after integration.
