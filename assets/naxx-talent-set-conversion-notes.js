/* Naxxramas Resource Hub — unconverted Classic Talent Sets.
 * Only Warlock Solo/Raid builds remain pending conversion (11 Oct 2026).
 * Warrior Solo/Raid builds have been supplied and are updated in the preceding
 * naxx-warrior-talent-sets.js script. Do not re-add Warrior placeholder notes.
 * Preserve any Warlock notes and existing Talent Calculator URLs.
 */
(function () {
  "use strict";
  if (typeof DATA === "undefined" || !DATA || !Array.isArray(DATA.resources)) return;

  var records = DATA.resources.filter(function (entry) {
    return entry.section === "Vanilla Builds" &&
      (entry.buildType === "Solo Builds" || entry.buildType === "Raid Builds") &&
      Array.isArray(entry.classes) && entry.classes.length === 1 &&
      entry.classes[0] === "Warlock";
  });

  function count(type) {
    return records.filter(function (r) { return r.buildType === type; }).length;
  }
  // Current Warlock placeholder sets: 2 Solo and 2 Raid.
  if (records.length !== 4 ||
      count("Solo Builds") !== 2 || count("Raid Builds") !== 2) {
    if (typeof console !== "undefined" && console.warn)
      console.warn("Naxx Talent Sets: Warlock conversion notes skipped; build counts changed.");
    return;
  }

  var modified = 0;
  records.forEach(function (record) {
    var existing = typeof record.summary === "string" ? record.summary.trim() : "";
    if (/(^|\n)\s*TO BE CONVERTED\s*(\n|$)/i.test(existing)) return;
    record.summary = existing ? existing + "\nTO BE CONVERTED" : "TO BE CONVERTED";
    modified++;
  });
  if (modified && typeof currentSection !== "undefined" &&
      currentSection === "Vanilla Builds" &&
      typeof renderPublic === "function") {
    renderPublic();
  }
})();
