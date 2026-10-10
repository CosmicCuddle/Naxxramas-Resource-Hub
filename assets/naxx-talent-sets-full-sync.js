/* Naxxramas Resource Hub — full Classic Talent Sets link synchronization.
 * Source: owner's 10 October 2026 Talent Sets list.
 * Scope: Druid, Mage, Shaman, Priest, Rogue and Hunter; Raid + Solo.
 * Warrior and Warlock remain unchanged by explicit request.
 * Runs after naxx-talent-set-sync.js (the two additional Rogue variants).
 * Does not replace the original 31MB site-content.html resource database.
 */
(function () {
  "use strict";
  if (typeof DATA === "undefined" || !DATA || !Array.isArray(DATA.resources)) return;
  var base = "https://cosmiccuddle.github.io/Naxxramas-Resource-Hub/talents/?code=";
  var builds = [
  [
    "Druid|Raid Builds|Feral Druid|DPS",
    0,
    "NT1:vanilla:druid:m3-3.m4-5.m6-3.m9-2.ma-2.mb-3.mc-1.md-2.mf-2.mg-5.mh-1.mu-5.mw-5.my-3.mz-1.wa-1.1du-3.1h6-2.1h7-2"
  ],
  [
    "Druid|Raid Builds|Balance Druid|DPS",
    0,
    "NT1:vanilla:druid:l6-5.l7-2.l8-2.lr-3.ls-3.lw-1.lx-3.ly-3.m0-5.m1-1.mt-2.mu-5.my-3.mz-1.1di-3.1dj-2.1em-2.1h7-2.1q7-2.1q8-1"
  ],
  [
    "Druid|Raid Builds|Balance Druid|DPS",
    1,
    "NT1:vanilla:druid:l6-5.l7-2.l8-2.lr-3.lw-1.lx-3.ly-3.m0-5.m1-1.mt-2.mu-5.my-3.mz-1.1di-3.1dj-2.1dk-3.1em-2.1h7-2.1q7-2.1q8-1"
  ],
  [
    "Druid|Raid Builds|Feral Tank Druid|Tank",
    0,
    "NT1:vanilla:druid:m2-3.m4-5.m6-3.m7-3.m9-2.mb-3.mc-1.md-2.mf-2.mg-5.mh-1.mt-2.mu-4.mw-5.mz-1.wa-1.1du-3.1h6-2.1qa-3"
  ],
  [
    "Druid|Raid Builds|Restoration Druid|Healer",
    0,
    "NT1:vanilla:druid:lr-3.mt-2.mv-3.mw-5.mx-5.mz-1.n0-5.n1-3.n2-3.n3-1.nd-2.ne-2.nf-5.ng-1.1do-2.1em-2.1q6-5.1q8-1"
  ],
  [
    "Mage|Raid Builds|Frost Mage|DPS",
    0,
    "NT1:vanilla:mage:11-5.1p-3.1q-3.1u-3.1w-3.1x-1.1y-2.1z-1.20-1.21-3.22-2.23-5.24-3.kl-2.19t-3.19u-2.1c8-3.1f9-2.1pf-1.1pq-3"
  ],
  [
    "Shaman|Raid Builds|Restoration Shaman|Healer",
    0,
    "NT1:vanilla:shaman:g5-3.g6-1.ga-5.gb-3.gc-3.ge-1.gf-1.gg-5.gh-5.gi-5.gj-3.h1-5.h2-5.19q-3.19s-3"
  ],
  [
    "Shaman|Raid Builds|Enhancement Shaman|DPS",
    0,
    "NT1:vanilla:shaman:fn-5.fo-5.fp-4.fy-1.gq-5.gy-3.gz-3.h1-5.h2-3.h4-1.h5-1.19n-3.19p-3.19r-2.1ax-3.1ay-1.1lv-3"
  ],
  [
    "Shaman|Raid Builds|Elemental Shaman|DPS",
    0,
    "NT1:vanilla:shaman:fl-1.fm-1.fn-5.fo-5.fp-5.fx-1.fy-1.gz-3.h1-5.h2-5.k1-5.19k-3.19l-2.19m-3.1aq-3.1at-3"
  ],
  [
    "Priest|Raid Builds|Shadow Priest|DPS",
    0,
    "NT1:vanilla:priest:9k-2.9m-3.9n-3.9o-1.ct-3.cu-5.cv-3.cx-3.dd-5.de-2.dg-1.dx-1.eh-1.oh-2.19i-1.1dd-3.1dh-2.1gq-5.1kb-2.1qz-3"
  ],
  [
    "Priest|Raid Builds|Holy Priest|Healer",
    0,
    "NT1:vanilla:priest:9k-2.9n-3.9o-1.9s-3.a1-3.b5-5.b6-5.b8-5.ba-3.bc-3.be-2.bh-2.ca-1.wt-5.17d-1.19f-2.1gq-5"
  ],
  [
    "Priest|Raid Builds|Discipline Priest|Healer",
    0,
    "NT1:vanilla:priest:8y-1.9h-3.9j-3.9k-2.9n-3.9o-1.9r-1.9s-3.a1-3.b5-5.ba-3.be-2.ca-1.wt-5.xd-5.1d7-2.1d8-3.1gq-5"
  ],
  [
    "Priest|Raid Builds|Discipline Priest|Healer",
    1,
    "NT1:vanilla:priest:8y-1.9h-3.9j-3.9k-2.9n-3.9o-1.9r-1.9s-3.a1-3.b5-5.bc-3.be-2.ca-1.wt-5.xd-5.1d7-2.1d8-3.1gq-5"
  ],
  [
    "Rogue|Raid Builds|Combat Rogue|DPS",
    0,
    "NT1:vanilla:rogue:51-5.56-3.5l-2.5o-1.5p-1.65-5.67-1.6q-5.7h-5.7i-5.7l-3.v6-4.1bb-2.1er-2.1lg-2.1qc-5"
  ],
  [
    "Hunter|Raid Builds|Beastmastery Hunter|DPS",
    0,
    "NT1:vanilla:hunter:11b-3.11c-5.11g-2.11h-5.12e-5.12h-1.12i-1.12j-1.12l-1.12m-2.12p-5.12s-5.12t-3.194-2.195-2.1dz-2.1e6-3.1ei-2.1ne-1"
  ],
  [
    "Hunter|Raid Builds|Beastmastery Hunter|DPS",
    1,
    "NT1:vanilla:hunter:11b-3.11c-5.11h-5.12e-5.12h-1.12i-1.12j-1.12l-1.12m-2.12p-5.12s-5.12t-3.194-2.195-2.1dz-2.1e6-3.1ei-2.1ej-2.1ne-1"
  ],
  [
    "Hunter|Raid Builds|Marksmanship Hunter|DPS",
    0,
    "NT1:vanilla:hunter:11a-1.11c-5.11d-1.11f-3.11h-5.11l-1.11t-1.11u-3.12e-5.12l-1.12s-2.193-5.194-2.195-2.1e4-2.1e6-3.1ea-1.1ei-2.1ej-2.1ne-1.1p1-3"
  ],
  [
    "Druid|Solo Builds|Feral Druid|DPS",
    0,
    "NT1:vanilla:druid:m2-2.m3-5.m4-5.m6-3.m9-2.mb-3.mc-1.md-2.mf-2.mg-5.mh-1.mt-2.mu-4.mw-5.mz-1.wa-1.1ds-2.1du-3.1h6-2"
  ],
  [
    "Druid|Solo Builds|Balance Druid|DPS",
    0,
    "NT1:vanilla:druid:l6-5.l7-2.l8-2.lr-3.ls-2.lw-1.lx-3.ly-3.m0-5.m1-1.mt-2.mu-5.my-3.mz-1.1di-3.1dj-2.1dk-3.1em-2.1h7-2.1q8-1"
  ],
  [
    "Druid|Solo Builds|Feral Tank Druid|Tank",
    0,
    "NT1:vanilla:druid:m2-3.m4-5.m6-3.m7-3.m9-2.mb-3.mc-1.md-2.mf-2.mg-5.mh-1.mt-2.mu-4.mw-5.mz-1.wa-1.1du-3.1h6-2.1qa-3"
  ],
  [
    "Druid|Solo Builds|Restoration Druid|Healer",
    0,
    "NT1:vanilla:druid:l6-5.lr-3.mt-2.mv-3.mw-5.mx-5.mz-1.n0-5.n1-3.n2-3.n3-1.nd-2.ne-2.nf-1.ng-1.1do-2.1em-2.1q6-4.1q8-1"
  ],
  [
    "Mage|Solo Builds|Frost Mage|DPS",
    0,
    "NT1:vanilla:mage:11-5.12-3.1p-3.1q-3.1s-3.1u-3.1v-3.1w-3.1x-1.1z-1.20-1.21-3.22-2.23-5.24-3.2d-1.kl-2.19t-3.1f9-3"
  ],
  [
    "Mage|Solo Builds|Frost Mage|DPS",
    1,
    "NT1:vanilla:mage:11-5.12-2.1p-3.1q-3.1r-2.1s-2.1u-3.1v-3.1w-3.1x-1.1z-1.20-1.21-3.22-2.23-5.24-3.2d-1.kl-2.19t-3.1f9-3"
  ],
  [
    "Shaman|Solo Builds|Restoration Shaman|Healer",
    0,
    "NT1:vanilla:shaman:fo-5.g5-3.g6-1.ga-5.gb-3.gc-3.ge-1.gf-1.gg-5.gh-5.gi-5.h1-5.h2-5.h5-1.19s-3"
  ],
  [
    "Shaman|Solo Builds|Restoration Shaman|Healer",
    1,
    "NT1:vanilla:shaman:fn-1.fo-2.g5-3.g6-1.ga-5.gb-3.gc-3.ge-1.gf-1.gg-5.gh-5.gi-5.gv-2.h1-5.h2-5.h5-1.19s-3"
  ],
  [
    "Shaman|Solo Builds|Enhancement Shaman|DPS",
    0,
    "NT1:vanilla:shaman:fl-3.fn-5.fp-4.fr-2.fy-1.gq-5.gy-3.gz-3.h1-5.h2-3.h4-1.h5-1.19n-3.19p-3.19r-2.1ax-3.1ay-1.1lv-3"
  ],
  [
    "Shaman|Solo Builds|Elemental Shaman|DPS",
    0,
    "NT1:vanilla:shaman:fl-2.fm-1.fn-5.fo-5.fp-5.fr-2.fx-1.fy-1.h1-5.h2-5.k1-5.19k-3.19l-2.19m-3.1aq-3.1at-3"
  ],
  [
    "Priest|Solo Builds|Shadow Priest|DPS",
    0,
    "NT1:vanilla:priest:8x-2.9m-3.9n-3.ct-3.cu-5.cv-3.cx-3.dd-5.de-2.dg-1.dx-1.eh-1.oh-2.19i-2.1dd-3.1dh-2.1gq-5.1kb-2.1qz-3"
  ],
  [
    "Priest|Solo Builds|Holy Priest|Healer",
    0,
    "NT1:vanilla:priest:8x-2.9h-1.9j-3.9k-2.9n-2.9o-1.9s-1.a1-3.b5-5.b6-5.b7-2.ba-3.be-2.ca-1.cx-3.wt-5.17d-1.19f-2.1d2-2.1gq-5"
  ],
  [
    "Priest|Solo Builds|Discipline Priest|Healer",
    0,
    "NT1:vanilla:priest:8x-2.8y-1.9h-3.9j-3.9k-2.9n-3.9o-1.9r-1.9s-1.a1-3.b5-1.b7-1.ba-3.be-2.ca-1.cx-3.wt-5.xd-5.1d7-2.1d8-3.1gq-5"
  ],
  [
    "Rogue|Solo Builds|Subtlety Rogue|DPS",
    0,
    "NT1:vanilla:rogue:51-5.52-5.65-5.6s-3.6t-3.6v-2.79-2.7b-2.7d-2.7o-2.7w-1.8f-1.al-1.ix-1.v7-3.1ba-5.1bl-3.1qc-5"
  ],
  [
    "Rogue|Solo Builds|Assassination Rogue|DPS",
    0,
    "NT1:vanilla:rogue:65-5.79-2.7g-3.7h-5.7i-5.7k-2.7l-2.7m-2.7o-3.7p-3.7s-1.7t-1.7v-5.iy-3.1bt-2.1lg-2.1qc-5"
  ],
  [
    "Rogue|Solo Builds|Combat Rogue|DPS",
    0,
    "NT1:vanilla:rogue:51-5.56-3.57-3.5l-2.65-5.67-1.6q-5.7h-4.7i-5.7k-2.7l-2.8d-1.v6-5.1bb-2.1be-2.1er-2.1lg-2"
  ],
  [
    "Rogue|Solo Builds|Combat Rogue|DPS",
    1,
    "NT1:vanilla:rogue:51-5.54-5.56-3.57-3.5l-2.65-5.67-1.7h-4.7i-5.7k-2.7l-2.8d-1.v6-5.1bb-2.1be-2.1er-2.1lg-2"
  ],
  [
    "Rogue|Solo Builds|Combat Rogue|DPS",
    2,
    "NT1:vanilla:rogue:51-5.52-5.56-3.57-3.5l-2.65-5.67-1.7h-4.7i-5.7k-2.7l-2.8d-1.v6-5.1bb-2.1be-2.1er-2.1lg-2"
  ],
  [
    "Hunter|Solo Builds|Survival Hunter|DPS",
    0,
    "NT1:vanilla:hunter:107-5.108-3.109-3.10a-3.10p-3.10t-1.11c-5.11d-1.11e-3.11h-5.193-5.1e6-3.1ea-2.1ee-1.1ei-1.1ej-2.1ek-2.1px-3"
  ],
  [
    "Hunter|Solo Builds|Beastmastery Hunter|DPS",
    0,
    "NT1:vanilla:hunter:11c-5.11h-5.12e-5.12h-2.12i-1.12j-1.12k-2.12l-1.12m-2.12p-5.12r-3.12s-5.12t-4.194-2.1dz-2.1e6-3.1ei-2.1ne-1"
  ],
  [
    "Hunter|Solo Builds|Beastmastery Hunter|DPS",
    1,
    "NT1:vanilla:hunter:11b-3.11c-5.11h-5.12e-5.12h-1.12i-1.12j-1.12k-1.12l-1.12m-2.12p-5.12r-2.12s-5.12t-4.194-2.1dz-2.1e6-3.1ei-2.1ne-1"
  ],
  [
    "Hunter|Solo Builds|Marksmanship Hunter|DPS",
    0,
    "NT1:vanilla:hunter:108-1.11a-2.11b-3.11c-5.11d-1.11f-3.11h-5.11l-1.11t-1.11u-3.12e-5.193-5.194-2.1e4-2.1e6-3.1ea-2.1ei-2.1ej-2.1ek-3"
  ],
  [
    "Hunter|Solo Builds|Marksmanship Hunter|DPS",
    1,
    "NT1:vanilla:hunter:108-1.11a-1.11b-3.11c-5.11d-1.11f-3.11g-1.11h-5.11l-1.11t-1.11u-3.12e-5.193-5.194-2.1e4-2.1e6-3.1ea-2.1ei-2.1ej-2.1ek-3"
  ]
];
  var expectedGroupSizes = {
  "Druid|Raid Builds|Feral Druid|DPS": 1,
  "Druid|Raid Builds|Balance Druid|DPS": 2,
  "Druid|Raid Builds|Feral Tank Druid|Tank": 1,
  "Druid|Raid Builds|Restoration Druid|Healer": 1,
  "Mage|Raid Builds|Frost Mage|DPS": 1,
  "Shaman|Raid Builds|Restoration Shaman|Healer": 1,
  "Shaman|Raid Builds|Enhancement Shaman|DPS": 1,
  "Shaman|Raid Builds|Elemental Shaman|DPS": 1,
  "Priest|Raid Builds|Shadow Priest|DPS": 1,
  "Priest|Raid Builds|Holy Priest|Healer": 1,
  "Priest|Raid Builds|Discipline Priest|Healer": 2,
  "Rogue|Raid Builds|Combat Rogue|DPS": 1,
  "Hunter|Raid Builds|Beastmastery Hunter|DPS": 2,
  "Hunter|Raid Builds|Marksmanship Hunter|DPS": 1,
  "Druid|Solo Builds|Feral Druid|DPS": 1,
  "Druid|Solo Builds|Balance Druid|DPS": 1,
  "Druid|Solo Builds|Feral Tank Druid|Tank": 1,
  "Druid|Solo Builds|Restoration Druid|Healer": 1,
  "Mage|Solo Builds|Frost Mage|DPS": 2,
  "Shaman|Solo Builds|Restoration Shaman|Healer": 2,
  "Shaman|Solo Builds|Enhancement Shaman|DPS": 1,
  "Shaman|Solo Builds|Elemental Shaman|DPS": 1,
  "Priest|Solo Builds|Shadow Priest|DPS": 1,
  "Priest|Solo Builds|Holy Priest|Healer": 1,
  "Priest|Solo Builds|Discipline Priest|Healer": 1,
  "Rogue|Solo Builds|Subtlety Rogue|DPS": 1,
  "Rogue|Solo Builds|Assassination Rogue|DPS": 1,
  "Rogue|Solo Builds|Combat Rogue|DPS": 3,
  "Hunter|Solo Builds|Survival Hunter|DPS": 1,
  "Hunter|Solo Builds|Beastmastery Hunter|DPS": 2,
  "Hunter|Solo Builds|Marksmanship Hunter|DPS": 2
};
  var grouped = Object.create(null);
  function keyOf(record) {
    return [record.classes[0], record.buildType, record.classOption, record.role].join("|");
  }

  DATA.resources.forEach(function (record) {
    if (record.section !== "Vanilla Builds" ||
        !Array.isArray(record.classes) || record.classes.length !== 1 ||
        record.classes[0] === "Warlock" || record.classes[0] === "Warrior") return;
    var key = keyOf(record);
    if (!Object.prototype.hasOwnProperty.call(expectedGroupSizes, key)) return;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(record);
  });
  // The entries have stable original IDs; use creation order to identify the
  // distinct same-spec talent variants, not their sometimes-identical titles.
  Object.keys(grouped).forEach(function (key) {
    grouped[key].sort(function (a, b) {
      return Number(a.createdAt || 0) - Number(b.createdAt || 0) ||
        String(a.id || "").localeCompare(String(b.id || ""));
    });
  });
  var valid = true;
  Object.keys(expectedGroupSizes).forEach(function (key) {
    if (!grouped[key] || grouped[key].length !== expectedGroupSizes[key]) {
      valid = false;
      if (typeof console !== "undefined" && console.warn)
        console.warn("Naxx Talent Sets: skipped sync due to unexpected group", key);
    }
  });
  if (!valid) return; // Avoid silently assigning a link to the wrong build.

  var changed = 0;
  builds.forEach(function (row) {
    var record = grouped[row[0]][row[1]];
    var url = base + encodeURIComponent(row[2]) + "&level=60";
    if (record.downloadUrl !== url) {
      record.downloadUrl = url;
      changed++;
    }
    if (record.downloadName !== "Talent Calculator") {
      record.downloadName = "Talent Calculator";
      changed++;
    }
  });
  if (changed && typeof currentSection !== "undefined" &&
      currentSection === "Vanilla Builds" && typeof renderPublic === "function") {
    renderPublic();
  }
})();
