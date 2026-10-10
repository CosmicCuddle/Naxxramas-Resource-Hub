/* Naxxramas Resource Hub — unconverted Classic Talent Sets.
 * Show the owner's requested note on Warrior and Warlock Solo/Raid cards.
 * The compact-card renderer already displays the resource.summary field.
 * Do not alter talent codes, calculator URLs, classes or existing notes.
 * Remove this overlay when the ten builds have been converted.
 */
(function () {
  "use strict";
  if (typeof DATA === "undefined" || !DATA || !Array.isArray(DATA.resources)) return;

  var records = DATA.resources.filter(function (entry) {
    return entry.section === "Vanilla Builds" &&
      (entry.buildType === "Solo Builds" || entry.buildType === "Raid Builds") &&
      Array.isArray(entry.classes) && entry.classes.length === 1 &&
      (entry.classes[0] === "Warrior" || entry.classes[0] === "Warlock");
  });

  // Based on the owner's current export: 3 Warrior + 2 Warlock per mode.
  // Do not label unrelated builds if the structure changes unexpectedly.
  function count(cls, type) {
    return records.filter(function (r) {
      return r.classes[0] === cls && r.buildType === type;
    }).length;
  }
  if (records.length !== 10 ||
      count("Warrior", "Solo Builds") !== 3 ||
      count("Warrior", "Raid Builds") !== 3 ||
      count("Warlock", "Solo Builds") !== 2 ||
      count("Warlock", "Raid Builds") !== 2) {
    if (typeof console !== "undefined" && console.warn)
      console.warn("Naxx Talent Sets: conversion note sync skipped; build counts have changed.");
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
