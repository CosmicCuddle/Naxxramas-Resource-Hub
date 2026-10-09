/* Naxxramas Resource Hub — additive addon and Naxx Core information refresh.
 * Keeps the original 31 MB resource data and restored UI unmodified.
 * All content is public information, not a download/install operation.
 */
(function () {
  "use strict";
  if (typeof DATA === "undefined" || !DATA || !Array.isArray(DATA.resources) ||
      typeof renderPublic !== "function") return;

  const suite = "https://github.com/CosmicCuddle/N-Addon-Collection";
  const addons = [
    {
      title: "N Addon Collection — Official N Addon Suite",
      summary: "Start here: the official Naxxramas addon suite for WoW 3.3.5a. NCore includes the expansion-aware Classic Battlegrounds interface; four companion addons can be enabled individually.",
      content: "Current collection: N Addon Suite v2.0.0.\n\nThe ready-to-install package contains five addon folders: required NCore, plus optional Individual Progression Companion, Dungeon Journal, MultiBot Chatless, and N Loot Ledger.\n\nUse /nsettings or /nsuite in game to manage optional components. Download the release ZIP, close WoW, back up AddOns and SavedVariables, and extract the folders directly into Interface/AddOns.\n\nDo not install an older standalone NClassicBattlegrounds alongside NCore. The standalone N Talent Calculator is not included in this suite.\n\nN Loot Ledger is still under development: its real Master Loot awarding has not been fully verified.",
      url: "https://github.com/CosmicCuddle/N-Addon-Collection/releases/tag/v2.0.0",
      download: "Download N Addon Suite v2.0.0"
    },
    {
      title: "Dungeon Journal — Naxxramas Edition",
      summary: "In-game Vanilla dungeon, raid and world-boss reference, designed for Naxxramas Individual Progression.",
      content: "Includes Vanilla dungeon and raid guides, encounter details, preparation guidance, loot and maps. The TBC and WotLK tabs are still being developed.\n\nIncluded as an optional component of the official N Addon Suite. Use /dj or /dungeonjournal to open it.",
      url: "https://github.com/CosmicCuddle/N-Dungeon-Journal",
      download: "Dungeon Journal Repository"
    },
    {
      title: "MultiBot Chatless — Naxxramas Fork",
      summary: "A visual Playerbot management interface with Naxxramas-specific bot consumables controls.",
      content: "Built on MultiBot Chatless and intended for the matching AzerothCore Playerbots / MultiBot Bridge setup. The Naxxramas fork adds consumables controls supported by Mod-Naxxramas-Core.\n\nIncluded as an optional component of N Addon Suite. Some controls require the corresponding server module and configuration.",
      url: "https://github.com/CosmicCuddle/N-MultiBot-Chatless",
      download: "MultiBot Fork Repository"
    },
    {
      title: "N Loot Ledger — Raid Loot Planning",
      summary: "Raid loot wishlists, Playerbot gear plans, ticket lotteries and visual winner tracking.",
      content: "Plan loot priorities, keep character and Playerbot wishlists, review candidate rolls and track awards. Includes a forty-character simulation for testing.\n\nStatus: work in progress. Real Master Loot item transfer is not yet fully server-verified. Do not treat this addon as a guaranteed automatic loot-awarding solution.\n\nIncluded as an optional component of the N Addon Suite.",
      url: "https://github.com/CosmicCuddle/N-Loot-Ledger",
      download: "N Loot Ledger Repository"
    },
    {
      title: "N Classic Battlegrounds — Integrated in NCore",
      summary: "Adjusts the PvP interface to the character's Vanilla, TBC or Wrath Individual Progression era.",
      content: "Vanilla hides remote Battleground queueing and Arena interface elements, TBC restores Arena presentation, and Wrath restores the appropriate later-era interface.\n\nN Classic Battlegrounds is now bundled INSIDE the required NCore addon in N Addon Suite v2.0.0. Do not also install its older standalone addon folder. Interface hiding is client-side only; actual Battlemaster-only enforcement needs the separate Naxxramas Core server feature.",
      url: "https://github.com/CosmicCuddle/N-ClassicBattlegrounds",
      download: "Classic Battlegrounds Information"
    }
  ];

  const originalAddonNames = new Set([
    "Bot Addon (Multibot)",
    "DungeonClear Addon"
  ]);
  // These two old listings describe upstream/older addon packages;
  // replace them with current fork entries and the official collection.
  DATA.resources = DATA.resources.filter(function (r) {
    return r.section !== "Addon Information" || !originalAddonNames.has(r.title);
  });
  const exemplar = DATA.resources.find(function (r) { return r.section === "Addon Information"; });
  if (exemplar) addons.forEach(function (entry, index) {
    if (DATA.resources.some(function (r) { return r.title === entry.title; })) return;
    const item = Object.assign({}, exemplar, {
      id: "naxx-addon-refresh-" + (index + 1),
      title: entry.title,
      section: "Addon Information",
      createdAt: 1791580000000 + index,
      summary: entry.summary,
      content: entry.content,
      downloadUrl: entry.url,
      downloadName: entry.download,
      embeddedFile: null,
      embeddedFiles: [],
      classes: [],
      classOption: "",
      handbookTemplateLocked: false,
      handbookTemplateType: "",
      handbookLayout: ""
    });
    DATA.resources.push(item);
  });

  function prioritizeAddonSuite() {
    if (typeof currentSection === "undefined" || currentSection !== "Addon Information") return;
    const grid = document.getElementById("resourceGrid");
    if (!grid) return;
    const cards = Array.from(grid.querySelectorAll(":scope > article.card"));
    const first = cards.find(function (card) {
      return card.querySelector("h2")?.textContent.trim() === "N Addon Collection — Official N Addon Suite";
    });
    if (first && cards[0] !== first) grid.insertBefore(first, cards[0]);
    if (first) first.classList.add("naxx-addon-suite-featured");
  }

  function updateCoreDetails() {
    const detail = document.getElementById("module-naxxramas-core");
    if (!detail) return;
    const summary = detail.querySelector(".module-info-detail-summary");
    if (summary) summary.textContent =
      "Naxxramas Core is our custom AzerothCore 3.3.5a gameplay module, covering class and racial changes, event scheduling, Honor systems, PvP rules, progression-aware interactions and Playerbot support.";
    const facts = detail.querySelectorAll(".module-info-fact p");
    if (facts[0]) facts[0].textContent =
      "Coordinates Naxxramas-specific spell, talent, racial, world-event and server quality-of-life rules in one module while retaining AzerothCore and Individual Progression compatibility.";
    if (facts[1]) facts[1].textContent =
      "Players may notice custom or restored class spells, optional directional Blink, progression-limited meeting stones and Battleground queues, recurring Elemental Invasions, adjusted seasonal encounters and Playerbot raid preparation.";
    if (facts[2]) facts[2].textContent =
      "Some abilities require a matching client patch. Optional features depend on server configuration or Individual Progression. Features awaiting live validation should not be assumed enabled for every player.";

    const features = [
      "Classes — Warrior Rend Flurry, Improved Rend and Heroic Strike adjustments; Warlock Wrack, Shaman Rockbiter restoration and optional Mage Arcane Momentum.",
      "Racials — Blood Fury, Berserking, Mana Tap / Arcane Torrent and custom Forsaken abilities, with matching DBC data when needed.",
      "Individual Progression — meeting stones are decorative in Vanilla and become usable from TBC; optional Battlemaster-only Battleground queues unlock remotely at Wrath progression.",
      "Monthly events — Elemental Invasions are scheduled for the 1st through 5th of each month, with automatic activation and restart recovery when configured.",
      "Seasonal events — Brewfest Dark Iron Attack timing, an optional sobering interaction, and Hallow's End Shade of the Horseman tuning.",
      "PvP — fortnightly Honor resets, optional overflow-to-gold conversion, and forced PvP in Silithus and Eastern Plaguelands.",
      "Playerbots — role-appropriate raid/dungeon consumables, manual talent expansion limits and optional safe talent completion.",
      "Server utilities — same-account alt mail timing and related quality-of-life systems."
    ];
    const section = detail.querySelector(".module-info-detail-body .module-info-section");
    if (section) {
      const list = section.querySelector("ul");
      if (list) {
        list.replaceChildren();
        features.forEach(function (f) {
          const li = document.createElement("li");
          li.textContent = f;
          list.appendChild(li);
        });
      }
    }
    const indexEntry = document.querySelector('#module-information-index [data-module-jump="naxxramas-core"] small');
    if (indexEntry) indexEntry.textContent =
      "Class, racial, progression, event, PvP and Playerbot systems.";
  }

  const originalPublic = renderPublic;
  renderPublic = function () {
    const out = originalPublic.apply(this, arguments);
    prioritizeAddonSuite();
    updateCoreDetails();
    return out;
  };

  // The original module guide wraps this function. Preserve it and augment
  // only its Naxxramas Core section after the original DOM is built.
  if (typeof renderPlayerbotInformationPage === "function") {
    const previousModules = renderPlayerbotInformationPage;
    renderPlayerbotInformationPage = function () {
      const result = previousModules.apply(this, arguments);
      updateCoreDetails();
      return result;
    };
  }

  if (typeof currentSection !== "undefined") {
    if (currentSection === "Addon Information") renderPublic();
    if (currentSection === "Playerbot Information") updateCoreDetails();
  }
})();
