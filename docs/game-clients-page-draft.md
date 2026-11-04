# Game Clients — page content draft

**Draft only.** This is preparation for the existing Game Clients section, not a published page. No private Naxxramas realm address, realmlist contents or login details belong here.

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

**Main download option — ChromieCraft:** https://chromiecraft.com/en/downloads/ . Look for the **Wrath of the Lich King (WotLK), patch 3.3.5a / build 12340** client. The download provider's own connection settings are not for Naxxramas; accepted applicants follow their private Naxxramas onboarding instructions. The actual archive has not been independently verified by this draft's tests.

**Alternative — Warmane:** https://web.archive.org/web/20260228080116/https://www.warmane.com/download . This is a **saved 28 February 2026 copy** of Warmane's downloads page. On 4 November 2026, the owner successfully downloaded a file using this exact archived page on their PC. The former **“Currently out of order”** label has therefore been removed from the public Game Clients card. A successful download does **not yet** verify the file's actual WotLK 3.3.5a build 12340 version, contents or compatibility with Naxxramas. Keep the provider description neutral and identify the link as an archived page.

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
- Verify all download URLs, patch release details and actual client build before publishing.
- Never include a server IP, a prefilled realmlist or any real credentials in public HTML, scripts, data, README files or this guide.
- Do not package or upload third-party proprietary base game files.

### Draft implementation and review — 4 November 2026

- **Integrated into the existing Game Clients section in PR #52 only.** It uses scoped JS/CSS while leaving the original `site-content.html`, native navigation and editable resource card unchanged. The site has **not** been merged or published from this PR.
- **Earlier review (superseded by the owner's 4 November 2026 test):** the live [Warmane downloads page](https://www.warmane.com/download) displayed a form but was not verified for a working older-client download. The owner subsequently succeeded in downloading a file using the [28 February 2026 Wayback snapshot](https://web.archive.org/web/20260228080116/https://www.warmane.com/download). The resulting game's build and files remain unverified, so do not describe the client itself as approved or tested.
- The [Naxxramas patch README](https://github.com/CosmicCuddle/Naxxramas-Server-Patches/blob/main/README.md) confirms that fresh players need **both** `patch-V.mpq` and `patch-Z.mpq`, potentially from different releases.
- [Draft-only Actions run #41890147802](https://github.com/CosmicCuddle/Naxxramas-Resource-Hub/actions/runs/41890147802) **passed** source integrity, original Home/Game Clients A/B checks, desktop/mobile Chrome layout and keyboard navigation, and privacy-boundary tests.
- The Game Clients layout passed **1440px desktop** and **390px mobile** browser checks. The run captured extended 3500px/5500px-high screenshots, reviewed for full-guide presentation. It also simulated the actual CSS `visual-admin-active` mode: the old card and native grid remain visible there, while the visitor guide returns after the simulation. **This is not a real administrator sign-in or editing test.**
- New Players links to this guide for download/install instructions rather than repeating the whole walkthrough.

### Remaining release conditions

1. **ChromieCraft is the main listed download option.** Confirm the actual 3.3.5a build 12340 archive and Naxxramas patch compatibility before labelling any downloaded client tested. **Eternion is deferred by the owner and must not appear as a public choice.**
2. **Warmane archive page download succeeded in the owner's hands.** The outdated outage badge is removed. Before marking the downloaded client as confirmed for Naxxramas, check the actual client build is **WotLK 3.3.5a (12340)**, its contents, and patch compatibility. The Wayback copy may become unavailable independently of Warmane.
3. Obtain owner's review of the desktop/mobile guide, and confirm real visual-admin editing behaviour before publishing.
4. Obtain explicit approval before merging or publishing PR #52. Do not release a realmlist, realm address, passwords or third-party client binaries.

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


