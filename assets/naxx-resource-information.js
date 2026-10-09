/* Naxxramas Resource Hub — player-facing addon and module information.
 * Safe companion script: does not rewrite the 31 MB original site data file
 * or replace the native Resource Hub design. No server actions are performed.
 */
(function () {
  "use strict";

  var COLLECTION_TITLE = "N Addon Collection — N Addon Suite";

  var addonUpdates = [
    {
      id: "naxx-addon-collection-v2",
      title: COLLECTION_TITLE,
      summary: "Recommended starting point: the N Addon Suite v2.0.0 for WoW 3.3.5a. Download the curated collection and manage supported addon features in one place.",
      content: [
        "# Recommended Naxxramas Addon Download",
        "The N Addon Collection is the main home for approved Naxxramas addons. Start here instead of separately downloading several older copies of the same addons.",
        "The current v2.0.0 bundle installs NCore (required) and four optional addons: Individual Progression Companion, Dungeon Journal, MultiBot Chatless and N Loot Ledger.",
        "N Classic Battlegrounds is built into NCore. Do not install an older standalone NClassicBattlegrounds folder alongside NCore.",
        "Use /nsettings or /nsuite in-game to open the addon manager. The included addons can be enabled or disabled in the suite settings.",
        "N Loot Ledger remains a work in progress; automatic Master Loot awarding has not been fully verified.",
        "N Talent Calculator is developed separately and is not included in the v2.0.0 bundle.",
        "Installation: close the game, back up Interface/AddOns and WTF/SavedVariables, remove outdated duplicate Naxxramas addon folders, and extract the release ZIP into Interface/AddOns."
      ].join("\n\n"),
      downloadName: "Download N Addon Suite v2.0.0",
      downloadUrl: "https://github.com/CosmicCuddle/N-Addon-Collection/releases/tag/v2.0.0"
    },
    {
      id: "naxx-addon-dungeon-journal",
      title: "N Dungeon Journal",
      summary: "A WoW 3.3.5a dungeon and raid reference addon, also included as an optional part of N Addon Suite.",
      content: "Browse dungeon and raid information in-game. The N Dungeon Journal is available within N Addon Suite v2.0.0. For most players, installing the collection is the easiest route.\n\nThis link opens the original development repository for further information and standalone updates.",
      downloadName: "Open N Dungeon Journal",
      downloadUrl: "https://github.com/CosmicCuddle/N-Dungeon-Journal"
    },
    {
      id: "naxx-addon-loot-ledger",
      title: "N Loot Ledger",
      summary: "Raid loot planning, reservations and lottery-based allocation tools for Naxxramas raids. Still under active development and testing.",
      content: "N Loot Ledger (addon folder NaxxLootLottery) helps raid leaders track loot interests, manage reservations and visualise lottery results. It can also be useful when preparing loot preferences for Playerbot companions.\n\nImportant: this addon is work in progress. Real Master Loot awarding is not yet fully verified; do not treat simulated or planned results as confirmed in-game awards.\n\nN Loot Ledger is offered as an optional component of the N Addon Suite; its source repository remains available separately.",
      downloadName: "Open N Loot Ledger",
      downloadUrl: "https://github.com/CosmicCuddle/N-Loot-Ledger"
    },
    {
      id: "naxx-addon-talent-calculator",
      title: "N Talent Calculator — Standalone Addon",
      summary: "An independently developed WoW 3.3.5a in-game talent planning addon, separate from N Addon Suite v2.0.0.",
      content: "Use this standalone project to follow development of the N Talent Calculator addon. It is not included in N Addon Suite v2.0.0.\n\nFor a browser-based planner using the server's own talent data and Vanilla/TBC/Wrath restrictions, visit the Resource Hub's separate Talent Calculator page.",
      downloadName: "Open Standalone Talent Calculator",
      downloadUrl: "https://github.com/CosmicCuddle/N-Talent-Calculator-"
    }
  ];

  // Preserve native Addon Information card styling by using DATA.resources.
  // Change only addon entries; never interfere with handbooks, patch notes or
  // the administration system.
  function ensureAddonCatalog() {
    if (typeof DATA === "undefined" || !Array.isArray(DATA.resources)) return false;

    var base = DATA.resources.find(function (item) {
      return item.section === "Addon Information";
    });
    if (!base) return false;

    addonUpdates.forEach(function (entry, index) {
      var existing = DATA.resources.find(function (item) { return item.id === entry.id; });
      if (!existing) {
        existing = Object.assign({}, base);
        existing.id = entry.id;
        existing.section = "Addon Information";
        existing.createdAt = Date.UTC(2026, 9, 9, 12, 0, index);
        existing.handbookOrder = existing.createdAt;
        existing.isNew = false;
        existing.embeddedFile = null;
        existing.embeddedFiles = [];
        existing.classes = [];
        DATA.resources.push(existing);
      }
      Object.assign(existing, entry);
    });

    var multibot = DATA.resources.find(function (item) { return item.id === "rmtjznzxsc7x4"; });
    if (multibot) {
      multibot.title = "N MultiBot Chatless";
      multibot.summary = "Playerbot management through in-game windows and controls. The Naxxramas version is included as an optional addon in N Addon Suite.";
      multibot.content = "Use MultiBot Chatless to access supported Playerbot tools without having to memorise every chat command.\n\nFor the recommended installation, download N Addon Suite v2.0.0. The standalone development repository is linked below; advanced features may depend on the matching server-side MultiBot Bridge.";
      multibot.downloadName = "Open N MultiBot Chatless";
      multibot.downloadUrl = "https://github.com/CosmicCuddle/N-MultiBot-Chatless";
    }
    var companion = DATA.resources.find(function (item) { return item.id === "rmtshin1d44z5"; });
    if (companion) {
      companion.summary = "In-game guidance for Vanilla, TBC and Wrath Individual Progression, also included in the N Addon Suite.";
      companion.content = "Provides a progression handbook with server-specific guidance, including current stage, attunements, reputations and preparation for upcoming content.\n\nThe recommended install is through N Addon Suite. Visit the standalone development repository below for details and updates.";
      companion.downloadName = "Open Individual Progression Companion";
    }
    var clear = DATA.resources.find(function (item) { return item.id === "addon_dungeonclear_ui_v19"; });
    if (clear) {
      clear.summary = "Standalone controller for the Dungeon Clear Playerbot module, with On, Off, Skip and Pause/Resume controls. Not part of N Addon Suite v2.0.0.";
    }
    return true;
  }

  function pinCollectionFirst() {
    if (typeof currentSection === "undefined" || currentSection !== "Addon Information") return;
    var grid = document.getElementById("resourceGrid");
    if (!grid) return;
    var cards = grid.querySelectorAll("article.card");
    for (var i = 0; i < cards.length; i++) {
      var heading = cards[i].querySelector("h2");
      if (heading && heading.textContent.trim() === COLLECTION_TITLE) {
        var element = cards[i].closest(".visual-admin-card-wrap") || cards[i];
        if (element.parentNode === grid && grid.firstElementChild !== element)
          grid.insertBefore(element, grid.firstElementChild);
        break;
      }
    }
  }

  var coreFeatures = [
    "Class and racial gameplay: custom Warrior talents and Rend Flurry, Mage Arcane Momentum, shaman and warlock spell work, and selected Orc, Troll, Blood Elf and Forsaken racial changes.",
    "Monthly Elemental Invasions: scheduled for the 1st through 5th of each month, with automatic activation and recovery after a Worldserver restart (when enabled).",
    "Fortnightly Honor resets: scheduled Honor resets for online and offline characters, with stored reset history and restart recovery.",
    "Honor overflow: optional conversion of Honor above the normal cap into gold under configured limits.",
    "Classic-style progression: Vanilla meeting stones remain decorative until the character reaches TBC Individual Progression; TBC/Wrath retain normal summoning.",
    "Battleground queues: optional progression-aware Battlemaster-only queue restrictions before the configured WotLK unlock stage. Server enforcement requires the setting to be enabled.",
    "World PvP and convenience: configurable forced PvP in Silithus and Eastern Plaguelands, plus same-account mail delivery delay rules.",
    "Playerbot support: talent-row limits, optional talent completion, and instance consumable profiles for supported Vanilla dungeons and Molten Core.",
    "Seasonal events: selected Brewfest Dark Iron attack timing and Hallow's End Shade of the Horseman adjustments.",
    "Some custom spell and racial changes also require the matching Naxxramas client patches; optional features depend on server configuration."
  ];

  function patchModuleInformation() {
    var section = document.getElementById("module-naxxramas-core");
    if (!section) return;

    var summary = section.querySelector(".module-info-detail-summary");
    if (summary) summary.textContent =
      "The Naxxramas server's central custom gameplay module. It brings together class and racial changes, monthly world events, Honor and PvP systems, Individual Progression rules, and Playerbot support.";

    var facts = section.querySelectorAll(".module-info-fact p");
    if (facts.length >= 3) {
      facts[0].textContent = "Extends AzerothCore 3.3.5a with carefully scoped, configurable Naxxramas gameplay systems. It integrates with Individual Progression and Playerbots without requiring changes to every separate module.";
      facts[1].textContent = "Players may notice modified talents or racials, Vanilla-era meeting stone restrictions, scheduled Honor resets and Elemental Invasions, zone PvP rules, and new Playerbot raid/dungeon preparation tools.";
      facts[2].textContent = "Some features are optional or need matching client patches. Event and PvP behaviour depends on server configuration. The core's technical README is the source for current requirements and testing status.";
    }

    var sections = section.querySelectorAll(".module-info-section");
    for (var i = 0; i < sections.length; i++) {
      var heading = sections[i].querySelector("h3");
      if (heading && heading.textContent.trim() === "What You Should Know") {
        var list = sections[i].querySelector(".module-info-list");
        if (list) {
          list.replaceChildren();
          coreFeatures.forEach(function (feature) {
            var li = document.createElement("li");
            li.textContent = feature;
            list.appendChild(li);
          });
        }
        break;
      }
    }

    var commands = section.querySelector(".module-info-callout");
    if (commands) commands.textContent =
      "Player commands: most Naxxramas Core features run automatically. Supported Playerbot instance consumable profiles use .bot consumables <profile>, .bot consumables status and .bot consumables clear. Availability depends on server configuration.";

    var indexButton = document.querySelector('[data-module-jump="naxxramas-core"]');
    if (indexButton) {
      var label = indexButton.querySelector("small");
      if (label) label.textContent = "Class and racial changes, monthly events, Honor, PvP, progression and Playerbots.";
    }
  }

  function start() {
    if (!ensureAddonCatalog()) return;
    if (typeof window.renderPublic !== "function") return;

    var previousRender = window.renderPublic;
    if (previousRender.__naxxResourceInfoV1) return;
    var enhancedRender = function () {
      ensureAddonCatalog();
      var result = previousRender.apply(this, arguments);
      pinCollectionFirst();
      patchModuleInformation();
      return result;
    };
    enhancedRender.__naxxResourceInfoV1 = true;
    window.renderPublic = enhancedRender;

    if (typeof currentSection !== "undefined" &&
        (currentSection === "Addon Information" || currentSection === "Playerbot Information"))
      window.renderPublic();

    pinCollectionFirst();
    patchModuleInformation();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();