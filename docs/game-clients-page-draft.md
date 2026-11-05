# Game Clients — implementation and review record

**Repository status (4 November 2026):** The Game Clients guide was merged into `main` through [PR #52](https://github.com/CosmicCuddle/Naxxramas-Resource-Hub/pull/52). That confirms repository integration, **not** independent verification of live GitHub Pages deployment or administrator editing. No private Naxxramas realm address, realmlist contents or login details belong here.

## Download and Set Up Your Game Client

Naxxramas uses **World of Warcraft: Wrath of the Lich King 3.3.5a, build 12340** for every progression era. You continue using the same game client as your character moves from Vanilla through The Burning Crusade to Wrath of the Lich King.

### First banner — why download a client from another website?

> **Why download WoW from another website?** The **game client** is the World of Warcraft program on your computer. The **game server** is the online world it connects to. Naxxramas uses the **World of Warcraft: Wrath of the Lich King (WotLK)** client, **patch 3.3.5a (build 12340)**. We **do not currently host the base game files ourselves**, so for now we link to compatible downloads from other WoW communities.
>
> **Downloading their client does not mean you will play on their server.** You do not need to create a game account with them. After your application is accepted, use the private connection instructions from your Naxxramas acceptance email and install our required patches. Your client will then connect to **Naxxramas**, not the download provider's realm.
>
> **Important:** Download the base game client only. Do not install another server's launcher, custom patch pack or connection settings.

This banner is rendered as the **first element** of the Game Clients guide, before the main page title and download links. The old repeated connection note underneath the download cards is removed.

### Step 1 — Choose a download source

If a download website asks which **expansion** or **patch** you want, choose **Wrath of the Lich King (WotLK)**, **patch 3.3.5a (build 12340)**. Do not choose Vanilla, The Burning Crusade, Classic, or another patch. This is the client Naxxramas uses even during earlier progression stages.

**Main download option — ChromieCraft:** https://chromiecraft.com/en/downloads/ . Look for the **Wrath of the Lich King (WotLK), patch 3.3.5a / build 12340** client. The download provider's own connection settings are not for Naxxramas; accepted applicants follow their private Naxxramas onboarding instructions. The actual archive has not been independently verified by the website's automated tests.

**Alternative — Warmane:** https://web.archive.org/web/20260228080116/https://www.warmane.com/download . This is a **saved 28 February 2026 copy** of Warmane's downloads page. On 4 November 2026, the owner successfully downloaded a file using this exact archived page on their PC. The former **“Currently out of order”** label has therefore been removed from the public Game Clients card. After downloading, the owner visually checked the login version and reported it looked correct for **Version 3.3.5 (12340)**. This is an owner check, **not** independent archive hash/content verification or a Naxxramas connection test. Keep the provider description neutral and identify the link as an archived page.

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
2. Open the [official patch download instructions](https://github.com/CosmicCuddle/Naxxramas-Server-Patches/blob/main/README.md), which link the currently approved files; the [Releases page](https://github.com/CosmicCuddle/Naxxramas-Server-Patches/releases) holds the published versions.
3. Install **both required files**: **patch-V.mpq** and **patch-Z.mpq**. A newer patch-V release may still rely on an unchanged patch-Z file from a previous release; read the repository guidance rather than expecting both files in one release.
4. Place both MPQ files inside the game's **Data** folder. Keep the specified names exactly.
5. Optional visual patches: `patch-J.mpq` (Vanilla login), `patch-U.mpq` (Vanilla loading screens) and `patch-C.mpq` (Burning Crusade login). **Do not install J and C together** because both modify the login screen. Follow [the official optional patch instructions](https://github.com/CosmicCuddle/Naxxramas-Server-Patches/blob/main/OPTIONAL-PATCHES.md). None of these replaces either required file.
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
- Make download choices easy to distinguish. No source may be labelled independently tested until its actual client archive has been checked.
- Keep the numbered setup instructions on this page instead of duplicating them across Server Rules and Apply to Join.
- Cross-link the New Player Guide, Apply to Join and Patch Notes briefly rather than reproducing their full content.
- Before describing a client source as independently verified, check its download link, archive contents, game build and required Naxxramas patch compatibility.
- Never include a server IP, a prefilled realmlist or any real credentials in public HTML, scripts, data, README files or this guide.
- Do not package or upload third-party proprietary base game files.

### Implementation, tests and merge — 4 November 2026

- **Merged into `main` via [PR #52](https://github.com/CosmicCuddle/Naxxramas-Resource-Hub/pull/52)** at commit [`5064a9d3`](https://github.com/CosmicCuddle/Naxxramas-Resource-Hub/commit/5064a9d3cadb7071caa1d0f67e43f87d4b591043) on 4 November 2026 at 22:20 UTC. It uses scoped JS/CSS while retaining the original `site-content.html`, native navigation and editable resource card. The public GitHub Pages Game Clients route later passed a read-only headless-browser deployment check on 5 November 2026 ([Actions #41940661224](https://github.com/CosmicCuddle/Naxxramas-Resource-Hub/actions/runs/41940661224)); this does not prove that actual admin sign-in/editing works.
- **Administrator editing boundary:** the original native ChromieCraft resource remains available in visual-admin mode, but the visitor-facing ChromieCraft and Warmane download cards are generated from `assets/naxx-game-clients-guide.js`. Editing the original native ChromieCraft card does **not** automatically change the new visitor-facing cards. Future public guide copy/link changes require a reviewed source update unless a dedicated editor integration is separately approved. This limitation is source-confirmed; actual admin sign-in has not been tested.
- **Earlier review (superseded by the owner's 4 November 2026 test):** the live [Warmane downloads page](https://www.warmane.com/download) displayed a form but was not verified for a working older-client download. The owner subsequently succeeded in downloading a file using the [28 February 2026 Wayback snapshot](https://web.archive.org/web/20260228080116/https://www.warmane.com/download). The owner subsequently visually checked the login screen and agreed the displayed build looked correct. The archive hash, full file contents and Naxxramas compatibility remain independently unverified, so do not call the downloaded package independently certified.
- The [Naxxramas patch README](https://github.com/CosmicCuddle/Naxxramas-Server-Patches/blob/main/README.md) confirms that fresh players need **both** `patch-V.mpq` and `patch-Z.mpq`, potentially from different releases.
- [Final PR-head Actions run #41912423437](https://github.com/CosmicCuddle/Naxxramas-Resource-Hub/actions/runs/41912423437) **completed successfully** for commit `f443f454`, checking source integrity, Home/Game Clients A/B navigation, desktop/mobile Chrome layout, keyboard navigation and privacy boundaries. The checks ran on the PR before merge, not against the public GitHub Pages site.
- The Game Clients layout passed **1440px desktop** and **390px mobile** browser checks. The run captured extended 3500px/5500px-high screenshots, reviewed for full-guide presentation. It also simulated the CSS `visual-admin-active` mode: the old card and native grid remain visible there, while the visitor guide returns after the simulation. CosmicCuddle approved the reviewed Game Clients desktop/mobile presentation on 4 November 2026. **This is not a real administrator sign-in or editing test.**
- New Players links to this guide for download/install instructions rather than repeating the whole walkthrough.

### Post-merge verification and future-source conditions

1. **ChromieCraft is the main listed download option.** Confirm the actual 3.3.5a build 12340 archive and Naxxramas patch compatibility before labelling any downloaded client tested. **Eternion is deferred by the owner and must not appear as a public choice.**
2. **Warmane archive page download succeeded in the owner's hands.** The owner visually confirmed the login version appeared correct for **WotLK 3.3.5a (12340)**; this is not an independent hash/content or Naxxramas compatibility check. The outdated outage badge is removed. The Wayback copy may become unavailable independently of Warmane.
3. **Visual review approved by the owner.** Still verify that the public GitHub Pages site loads the merged Game Clients guide, including desktop/mobile navigation and direct links, and confirm actual administrator editing without changing live content during the check.
4. **Recovery point verified:** [`backup/pre-game-clients-pr52-2026-11-04-main-7739adb`](https://github.com/CosmicCuddle/Naxxramas-Resource-Hub/tree/backup/pre-game-clients-pr52-2026-11-04-main-7739adb) matches pre-merge commit `7739adb`. Any further merge/publication requires a separate owner decision. Never release a realmlist, realm address, passwords or third-party client binaries.

### Deferred research only — not a public download option

**Decision (4 November 2026):** CosmicCuddle decided **not to use or recommend Eternion for now**. It is removed from the Game Clients page. Do not re-add or continue its verification without a new owner decision. The following record is historical research only; it is not an endorsement, working download recommendation, or confirmation that the archive is safe.

**Previously considered source — Eternion (deferred):** https://eternion-wow.net/download . Its own download page advertises a **separate plain "Full client — 3.3.5a (build 12340)"** with no Eternion realm patches in that archive. Only this plain full-client download is under consideration; **do not install Eternion's launcher, `Eternion-WotLK-Complete.zip` pack, other realm-specific MPQs or connection file**, which would prepare the game for Eternion rather than Naxxramas. No Eternion card or link is included in the public-facing guide. No Naxxramas-compatible installation has yet been verified.

**Earlier provider-page observation (unverified):** Their page starts with a launcher promotion. Instead, scroll to the **Wrath of the Lich King 3.3.5a** section and choose **Full client — 3.3.5a (build 12340)**, about **16.5 GB**. Do not follow the provider's subsequent realm installation instructions. On the actual WoW login screen, a correct 3.3.5a installation can display **`Version 3.3.5 (12340)`** without the letter "a". This is expected.

**Independent-download verification record — pending, not a website endorsement:**

- Provider information: https://eternion-wow.net/download
- Archive URL linked by the provider's *Full client* control: `https://eternion-wow.net/downloads/wotlk.zip`
- Published archive size: approximately **16.5 GB**; this is the provider's figure, not a measured value.
- Published SHA-256: `54ed5737cf9954e77c3e70050f35a045b17b882e6adc957e34fb5d417d132819`
- **Not verified:** actual bytes downloaded, hash matching, actual extracted content, absence of realm customisations or altered executables, Naxxramas patch and account compatibility, or security of this external download.
- **Before enabling direct download:** obtain the whole archive and compare its SHA-256 to the *currently published* value, inspect the extracted game files without running foreign executables, verify build 12340, check for provider-specific MPQs and executables, and test Naxxramas's two required patches and private connection process. Do not upload game files or publish private connection details.


