/* Naxxramas Resource Hub — Classic Talent Sets sync, 10 October 2026.
 * Source: the owner's exported index.html; only two newly saved Combat Rogue
 * solo builds are imported. The original source HTML and other 48 builds
 * stay untouched. The saved links use the server-specific Talent Calculator.
 */
(function () {
  "use strict";
  if (typeof DATA === "undefined" || !DATA || !Array.isArray(DATA.resources)) return;

  var additions = [
    {
      id: "talent_mv2qq23u_jbj25p",
      title: "Combat Rogue · DPS · Solo · Phase 1",
      createdAt: 1791657680682,
      talentEra: "Classic",
      buildType: "Solo Builds",
      role: "DPS",
      phaseNumber: 1,
      classes: ["Rogue"],
      classOption: "Combat Rogue",
      summary: "Maces",
      downloadName: "Talent Calculator",
      downloadUrl: "https://cosmiccuddle.github.io/Naxxramas-Resource-Hub/talents/?code=NT1%3Avanilla%3Arogue%3A51-5.54-5.56-3.57-3.5l-2.65-5.67-1.7h-4.7i-5.7k-2.7l-2.8d-1.v6-5.1bb-2.1be-2.1er-2.1lg-2&level=60"
    },
    {
      id: "talent_mv2qqfg5_dxluyr",
      title: "Combat Rogue · DPS · Solo · Phase 1",
      createdAt: 1791657697973,
      talentEra: "Classic",
      buildType: "Solo Builds",
      role: "DPS",
      phaseNumber: 1,
      classes: ["Rogue"],
      classOption: "Combat Rogue",
      summary: "Daggers",
      downloadName: "Talent Calculator",
      downloadUrl: "https://cosmiccuddle.github.io/Naxxramas-Resource-Hub/talents/?code=NT1%3Avanilla%3Arogue%3A51-5.52-5.56-3.57-3.5l-2.65-5.67-1.7h-4.7i-5.7k-2.7l-2.8d-1.v6-5.1bb-2.1be-2.1er-2.1lg-2&level=60"
    }
  ];

  // Match existing Classic Combat Rogue records so all established styling,
  // per-resource defaults and admin fields remain identical to normal sets.
  var model = DATA.resources.find(function (entry) {
    return entry.section === "Vanilla Builds" &&
      entry.talentEra === "Classic" &&
      entry.buildType === "Solo Builds" &&
      Array.isArray(entry.classes) && entry.classes.indexOf("Rogue") !== -1;
  }) || DATA.resources.find(function (entry) { return entry.section === "Vanilla Builds"; });
  if (!model) return;

  var changed = false;
  additions.forEach(function (entry) {
    var existing = DATA.resources.find(function (item) { return item.id === entry.id; });
    if (existing) return; // Idempotent across navigation and future source updates.
    var record = Object.assign({}, model, entry, {
      section: "Vanilla Builds",
      isNew: false,
      isOldPatch: false,
      classes: entry.classes.slice(),
      content: "",
      embeddedFile: null,
      embeddedFiles: []
    });
    DATA.resources.push(record);
    changed = true;
  });

  if (changed && typeof currentSection !== "undefined" &&
      currentSection === "Vanilla Builds" && typeof renderPublic === "function") {
    renderPublic();
  }
})();
