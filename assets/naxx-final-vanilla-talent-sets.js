/* Naxxramas Resource Hub — completed Classic Talent Sets (11 Oct 2026).
 * Source: the owner's revised Replace Website Talents.txt (54 x 51-point builds).
 * Previous 47 published build codes match this document exactly.
 * Complete four existing Warlock cards, add Warlock Destruction Solo,
 * add Mage Arcane/Fire Solo and label second Frost Solo as More Focus AOE.
 * Do not rewrite site-content.html, touch Warrior or other class records.
 * The retired TO BE CONVERTED script must NOT be loaded after this module.
 */
(function () {
  "use strict";
  if (typeof DATA === "undefined" || !DATA || !Array.isArray(DATA.resources)) return;

  var BASE = "https://cosmiccuddle.github.io/Naxxramas-Resource-Hub/talents/?code=";
  var BUILDS = [
  [
    "Warlock",
    "Raid Builds",
    "Affliction Warlock",
    "DPS",
    "ru-2.rv-5.rw-2.rx-3.rz-2.sd-2.sx-1.sy-5.th-1.ul-2.xy-3.xz-3.y2-1.yi-3.zm-1.zo-2.1ad-5.1af-3.1d0-3.1gb-2"
  ],
  [
    "Warlock",
    "Raid Builds",
    "Demonology Warlock",
    "DPS",
    "q7-5.q8-5.qs-1.qv-5.rb-2.xx-2.xz-3.y0-2.y2-1.y3-2.yi-3.yk-5.z1-2.z2-5.zl-1.zm-1.1af-3.1g8-1.1gb-2"
  ],
  [
    "Warlock",
    "Solo Builds",
    "Affliction Warlock",
    "DPS",
    "rt-3.ru-2.rv-5.rw-2.rx-3.rz-2.sx-1.sy-5.ul-2.xz-3.y0-2.y1-3.y2-1.y3-2.yi-3.zm-1.zo-2.1ad-1.1af-3.1d0-3.1gb-2"
  ],
  [
    "Warlock",
    "Solo Builds",
    "Demonology Warlock",
    "DPS",
    "rt-1.rv-5.rw-2.rx-3.rz-2.ul-2.xz-3.y0-1.y1-3.y2-1.y3-2.yi-3.yk-5.z1-2.z2-5.zl-1.zm-1.1af-3.1d0-3.1g8-1.1gb-2"
  ],
  [
    "Warlock",
    "Solo Builds",
    "Destruction Warlock",
    "DPS",
    "q5-2.q7-5.qp-3.qr-1.qs-2.qu-5.qv-5.qw-1.r9-1.rd-2.xz-3.y1-3.y2-1.yi-2.z2-5.zm-1.1af-3.1eh-1.1gb-2.1gf-3"
  ],
  [
    "Mage",
    "Solo Builds",
    "Arcane Mage",
    "DPS",
    "11-2.1p-1.1q-3.1r-3.1t-2.1u-3.1x-1.23-5.25-5.28-5.29-3.2a-2.2e-1.2f-1.bp-3.kl-2.vq-3.19t-3.1pq-3"
  ],
  [
    "Mage",
    "Solo Builds",
    "Fire Mage",
    "DPS",
    "n-2.p-3.q-5.s-2.t-1.w-1.x-3.y-5.z-5.10-1.11-2.1p-1.1q-3.1r-3.1t-2.1u-3.1v-2.1x-1.19j-3.19t-3"
  ]
];
  var IDS = {
    "Destruction Warlock": "naxx-warlock-solo-destruction-20261011",
    "Arcane Mage": "naxx-mage-solo-arcane-20261011",
    "Fire Mage": "naxx-mage-solo-fire-20261011"
  };
  function records(cls) {
    return DATA.resources.filter(function (r) {
      return r.section === "Vanilla Builds" &&
        Array.isArray(r.classes) && r.classes.length === 1 &&
        r.classes[0] === cls &&
        (r.buildType === "Solo Builds" || r.buildType === "Raid Builds");
    });
  }
  function matching(records, mode, spec, role) {
    return records.filter(function (r) {
      return r.buildType === mode && r.classOption === spec && r.role === role;
    });
  }
  function cleanPending(str) {
    return (typeof str === "string" ? str : "")
      .split(/\r?\n/)
      .filter(function (line) { return line.trim().toUpperCase() !== "TO BE CONVERTED"; })
      .join("\n").trim();
  }
  function warn(reason) {
    if (typeof console !== "undefined" && console.warn)
      console.warn("Naxx Talent Sets: final Warlock/Mage sync skipped: " + reason);
  }

  var wl = records("Warlock");
  var mage = records("Mage");
  var wlExtra = wl.filter(function (r) { return r.id === IDS["Destruction Warlock"]; });
  var mageExtra = mage.filter(function (r) {
    return r.id === IDS["Arcane Mage"] || r.id === IDS["Fire Mage"];
  });
  // Guard all records, including the three new stable IDs, before any update.
  if (wl.length !== 4 + wlExtra.length || wlExtra.length > 1 ||
      mage.length !== 3 + mageExtra.length || mageExtra.length > 2 ||
      matching(wl, "Raid Builds", "Affliction Warlock", "DPS").length !== 1 ||
      matching(wl, "Raid Builds", "Demonology Warlock", "DPS").length !== 1 ||
      matching(wl, "Solo Builds", "Affliction Warlock", "DPS").length !== 1 ||
      matching(wl, "Solo Builds", "Demonology Warlock", "DPS").length !== 1 ||
      matching(mage, "Raid Builds", "Frost Mage", "DPS").length !== 1 ||
      matching(mage, "Solo Builds", "Frost Mage", "DPS").length !== 2 ||
      (wlExtra.length && matching(wl, "Solo Builds", "Destruction Warlock", "DPS").length !== 1) ||
      mageExtra.some(function (r) {
        return r.buildType !== "Solo Builds" || r.role !== "DPS" ||
          (r.id === IDS["Arcane Mage"] && r.classOption !== "Arcane Mage") ||
          (r.id === IDS["Fire Mage"] && r.classOption !== "Fire Mage");
      })) {
    warn("original class/spec/mode/card count changed");
    return;
  }
  if (BUILDS.length !== 7 || BUILDS.some(function (b) {
    return b[4].split(".").reduce(function (total, item) {
      return total + Number(item.split("-")[1]);
    }, 0) !== 51;
  })) {
    warn("unexpected talent point allocation");
    return;
  }

  var changed = false;
  var sequence = Math.max.apply(null, wl.concat(mage).map(function (r) {
    return Number(r.createdAt || 0);
  }));
  if (!Number.isFinite(sequence)) sequence = 1791700000000;

  BUILDS.forEach(function (b) {
    var cls = b[0], mode = b[1], spec = b[2], role = b[3],fragment = b[4];
    var group = cls === "Warlock" ? wl : mage;
    var match = matching(group, mode, spec, role);
    var record = match[0];
    if (!record) {
      var template = cls === "Warlock"
        ? matching(wl, "Solo Builds", "Affliction Warlock", "DPS")[0]
        : matching(mage, "Solo Builds", "Frost Mage", "DPS")[0];
      record = Object.assign({}, template, {
        id: IDS[spec],
        createdAt: ++sequence,
        title: spec + " · " + role + " · Solo · Phase 1",
        section: "Vanilla Builds",
        talentEra: "Classic",
        classOption: spec,
        classes: [cls],
        buildType: "Solo Builds",
        role: role,
        phaseNumber: 1,
        summary: "",
        content: "",
        embeddedFile: null,
        embeddedFiles: [],
        isNew: false,
        isOldPatch: false
      });
      DATA.resources.push(record);
      group.push(record);
      changed = true;
    }
    var url = BASE + encodeURIComponent("NT1:vanilla:" + cls.toLowerCase() + ":" + fragment) + "&level=60";
    if (record.downloadUrl !== url) {
      record.downloadUrl = url;
      changed = true;
    }
    if (record.downloadName !== "Talent Calculator") {
      record.downloadName = "Talent Calculator";
      changed = true;
    }
    var note = cleanPending(record.summary);
    if (record.summary !== note) {
      record.summary = note;
      changed = true;
    }
  });

  // Do not leave a placeholder on any of the five finished Warlock builds.
  wl.forEach(function (r) {
    var cleaned = cleanPending(r.summary);
    if (r.summary !== cleaned) {
      r.summary = cleaned;
      changed = true;
    }
  });

  // The second of two existing Frost Solo variants is the new AOE-focused one.
  var frost = matching(mage, "Solo Builds", "Frost Mage", "DPS").sort(function (a, b) {
    return Number(a.createdAt || 0) - Number(b.createdAt || 0) ||
      String(a.id || "").localeCompare(String(b.id || ""));
  });
  var secondFrost = frost[1];
  var aoeNote = "More Focus AOE";
  var oldNote = (typeof secondFrost.summary === "string" ? secondFrost.summary : "").trim();
  if (!oldNote.split(/\r?\n/).some(function (line) { return line.trim() === aoeNote; })) {
    secondFrost.summary = oldNote ? oldNote + "\n" + aoeNote : aoeNote;
    changed = true;
  }
  if (changed && typeof currentSection !== "undefined" &&
      currentSection === "Vanilla Builds" && typeof renderPublic === "function")
    renderPublic();
})();
