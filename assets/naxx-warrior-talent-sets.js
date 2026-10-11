/* Naxxramas Resource Hub — Warrior Classic Talent Sets (11 Oct 2026)
 *
 * The owner completed three Solo Warrior builds and four Raid Warrior builds.
 * Preserve the original six cards and add only the second Raid Fury variant.
 * This module is loaded AFTER the general six-class talent set sync and BEFORE
 * the Warlock-only TO BE CONVERTED notes overlay. No original 31MB file changes.
 */
(function () {
  "use strict";
  if (typeof DATA === "undefined" || !DATA || !Array.isArray(DATA.resources)) return;

  var BASE = "https://cosmiccuddle.github.io/Naxxramas-Resource-Hub/talents/?code=";
  var EXTRA_ID = "naxx-warrior-raid-fury-anger-management-02";
  // [mode, classOption, role, verified level-60 build fragment, note]
  var BUILDS = [
  [
    "Solo Builds",
    "Protection Warrior",
    "Tank",
    "3d-3.3g-1.3j-3.3k-2.3m-5.3u-5.3x-3.40-3.42-1.43-2.44-1.45-2.48-1.49-1.ie-2.ji-5.18h-5.19y-2.1qi-3.2bc-1",
    ""
  ],
  [
    "Solo Builds",
    "Fury Warrior",
    "DPS",
    "3d-3.3i-2.3j-3.3m-5.4a-2.4b-5.4c-5.4d-5.4f-4.4g-1.4l-1.4n-1.ie-2.17x-5.1a1-3.1qi-3.2bc-1",
    ""
  ],
  [
    "Solo Builds",
    "Arms Warrior",
    "DPS",
    "3d-3.3i-2.3j-3.3k-3.3m-3.3n-2.3o-5.3p-1.3r-1.3s-3.3t-1.4a-1.4b-2.4d-5.4h-3.4m-3.ie-2.1fn-1.1q0-3.1qi-3.2bc-1",
    ""
  ],
  [
    "Raid Builds",
    "Protection Warrior",
    "Tank",
    "3g-1.3m-5.3u-5.3w-5.3x-3.40-3.42-1.43-2.44-1.45-2.48-1.49-1.4d-5.4f-1.ji-5.18h-5.19y-2.1qi-3",
    ""
  ],
  [
    "Raid Builds",
    "Fury Warrior",
    "DPS",
    "3d-3.3g-1.3j-3.3k-3.3m-2.4a-5.4c-5.4d-5.4f-3.4l-1.4n-1.ht-1.ie-2.16t-2.16u-2.17x-5.1a1-3.1qi-3.2bc-1",
    "Rend Flurry Build 01"
  ],
  [
    "Raid Builds",
    "Fury Warrior",
    "DPS",
    "3d-3.3g-1.3j-3.3k-3.3m-2.3t-1.4a-5.4c-5.4d-5.4f-3.4l-1.4n-1.ht-1.ie-2.16t-2.16u-2.17x-5.1a1-3.1qi-3",
    "Anger Management Build 02"
  ],
  [
    "Raid Builds",
    "Arms Warrior",
    "DPS",
    "3d-3.3g-1.3j-3.3k-3.3m-1.3n-2.3o-5.3p-1.3q-1.3r-1.3s-3.3t-1.4d-5.4h-5.4m-2.ht-2.ie-2.16u-1.1fn-2.1q0-3.1qi-3.2bc-1",
    ""
  ]
];

  function warriorRecords() {
    return DATA.resources.filter(function (r) {
      return r.section === "Vanilla Builds" &&
        Array.isArray(r.classes) && r.classes.length === 1 &&
        r.classes[0] === "Warrior" &&
        (r.buildType === "Solo Builds" || r.buildType === "Raid Builds");
    });
  }
  function matches(entry, mode, spec, role) {
    return entry.buildType === mode && entry.classOption === spec && entry.role === role;
  }
  function removePendingNote(note) {
    return (typeof note === "string" ? note : "")
      .split(/\r?\n/)
      .filter(function (line) { return line.trim().toUpperCase() !== "TO BE CONVERTED"; })
      .join("\n").trim();
  }
  function warn(reason) {
    if (typeof console !== "undefined" && console.warn)
      console.warn("Naxx Talent Sets: Warrior update skipped — " + reason);
  }

  var original = warriorRecords();
  var extra = original.find(function (r) { return r.id === EXTRA_ID; });
  var old = original.filter(function (r) { return r.id !== EXTRA_ID; });
  // Every original spec must match once, with an optional known new Fury card.
  if (original.length !== (extra ? 7 : 6) || old.length !== 6) {
    warn("unexpected Warrior card count");
    return;
  }
  var keys = [
    ["Solo Builds", "Protection Warrior", "Tank"],
    ["Solo Builds", "Fury Warrior", "DPS"],
    ["Solo Builds", "Arms Warrior", "DPS"],
    ["Raid Builds", "Protection Warrior", "Tank"],
    ["Raid Builds", "Fury Warrior", "DPS"],
    ["Raid Builds", "Arms Warrior", "DPS"]
  ];
  var existing = keys.map(function (key) {
    return old.filter(function (r) { return matches(r, key[0], key[1], key[2]); });
  });
  if (existing.some(function (group) { return group.length !== 1; }) ||
      (extra && (!matches(extra, "Raid Builds", "Fury Warrior", "DPS") || extra.section !== "Vanilla Builds"))) {
    warn("one or more Warrior specs have changed");
    return;
  }
  if (BUILDS.some(function (b) {
    return b[3].split(".").reduce(function (sum, part) {
      return sum + Number(part.split("-")[1]);
    }, 0) !== 51;
  })) {
    warn("unexpected level-60 talent point count");
    return;
  }

  var changed = false;
  BUILDS.forEach(function (build, index) {
    var record = index === 5 ? extra : existing[index < 5 ? index : index - 1][0];
    if (!record && index === 5) {
      // Clone only the original Fury Raid record and give the variant a stable
      // ID. Its distinct summary is visible directly on the talent card.
      var fury = existing[4][0];
      var latest = Math.max.apply(null, original.map(function (r) {
        return Number(r.createdAt || 0);
      }));
      record = Object.assign({}, fury, {
        id: EXTRA_ID,
        createdAt: Number.isFinite(latest) ? latest + 1 : 1791700000000,
        classes: ["Warrior"],
        summary: "",
        content: "",
        embeddedFile: null,
        embeddedFiles: [],
        isNew: false,
        isOldPatch: false
      });
      DATA.resources.push(record);
      extra = record;
      changed = true;
    }
    var url = BASE + encodeURIComponent("NT1:vanilla:warrior:" + build[3]) + "&level=60";
    var cleanNote = removePendingNote(record.summary);
    if (build[4] && cleanNote.split("\n").indexOf(build[4]) === -1)
      cleanNote = cleanNote ? cleanNote + "\n" + build[4] : build[4];
    if (record.summary !== cleanNote) {
      record.summary = cleanNote;
      changed = true;
    }
    if (record.downloadUrl !== url) {
      record.downloadUrl = url;
      changed = true;
    }
    if (record.downloadName !== "Talent Calculator") {
      record.downloadName = "Talent Calculator";
      changed = true;
    }
  });

  if (changed && typeof currentSection !== "undefined" &&
      currentSection === "Vanilla Builds" && typeof renderPublic === "function")
    renderPublic();
})();
