// Run: node assets/tests/raid-resets.test.cjs
// Tests the actual raid reset data and functions from naxx-countdowns.js.
// No network calls, packages, or changes to the server database.
"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "..", "naxx-countdowns.js"), "utf8");
const scheduleSource = source.match(/^  var schedule = \{[\s\S]*?^  \};/m);
const resetSource = source.match(/^  function nextRaidReset\(raid, now\) \{[\s\S]*?^  \}/m);
const remainingSource = source.match(/^  function raidRemainingText\(date, now\) \{[\s\S]*?^  \}/m);
assert.ok(scheduleSource && resetSource && remainingSource,
  "Expected data/functions are missing from the published countdown source");

const moduleText = [
  scheduleSource[0], "function pad(number){return String(number).padStart(2,'0');}",
  resetSource[0], remainingSource[0],
  "({raids:schedule.raids,nextRaidReset,raidRemainingText})"
].join("\n");
const { raids, nextRaidReset, raidRemainingText } = vm.runInNewContext(moduleText, {});
assert.equal(raids.length, 7, "Exactly seven Vanilla raid rows");

const byMap = (id) => {
  const raid = raids.find(r => r.mapId === id);
  assert.ok(raid, "Missing map " + id);
  return raid;
};
const days = 86400000;
const ts = epoch => new Date(epoch * 1000);
const nextEpoch = (map, now) => nextRaidReset(byMap(map), now).getTime() / 1000;

for (const map of [409,249,469,531,533]) {
  assert.equal(byMap(map).periodDays, 7, "7-day DBC cadence map " + map);
  assert.equal(byMap(map).resetAt, 1792123200, "Friday anchor map " + map);
}
for (const map of [309,509]) {
  assert.equal(byMap(map).periodDays, 3, "3-day DBC cadence map " + map);
  assert.equal(byMap(map).resetAt, 1791864000, "Tuesday anchor map " + map);
}
assert.equal(byMap(249).mode, "10/25");
assert.equal(byMap(533).mode, "10/25");

// Timezone independent: user's SQL epochs correspond to 06:00 at UTC+02:00.
assert.equal(ts(1792123200).toISOString(), "2026-10-16T04:00:00.000Z");
assert.equal(ts(1791864000).toISOString(), "2026-10-13T04:00:00.000Z");

const beforeTuesday = new Date("2026-10-12T12:00:00.000Z");
assert.equal(nextEpoch(309,beforeTuesday),1791864000);
assert.equal(nextEpoch(509,beforeTuesday),1791864000);
assert.equal(nextEpoch(409,beforeTuesday),1792123200);

// Exact reset boundary immediately advances to the following reset.
assert.equal(nextEpoch(309,ts(1791864000)),1791864000+3*86400);
assert.equal(nextEpoch(409,ts(1792123200)),1792123200+7*86400);

// Millisecond before the reset must still point to the current reset.
assert.equal(nextEpoch(309,new Date(1791864000*1000-1)),1791864000);
assert.equal(nextEpoch(409,new Date(1792123200*1000-1)),1792123200);

// Independent 3-day and 7-day rollover across multiple later cycles.
assert.equal(nextEpoch(309,new Date(1791864000*1000+10*days)),1791864000+12*86400);
assert.equal(nextEpoch(409,new Date(1792123200*1000+15*days)),1792123200+21*86400);
assert.equal(nextEpoch(249,new Date(1792123200*1000+15*days)),1792123200+21*86400);

// Leading zeroes are hidden as reset approaches; seconds stay visible.
const now = new Date("2026-10-12T04:00:00.000Z");
assert.equal(raidRemainingText(new Date(now.getTime()+86400000),now),"1d 0h 0m 00s");
assert.equal(raidRemainingText(new Date(now.getTime()+3600000),now),"1h 0m 00s");
assert.equal(raidRemainingText(new Date(now.getTime()+60000),now),"1m 00s");
assert.equal(raidRemainingText(new Date(now.getTime()+1000),now),"1s");
assert.equal(raidRemainingText(new Date(now.getTime()+10000),now),"10s");

console.log("PASS: all seven map IDs, difficulty groupings and DBC intervals.");
console.log("PASS: SQL anchor timestamps, server timezone, independent rollover and boundaries.");
console.log("PASS: dynamically hidden leading zero units for raid countdowns.");
