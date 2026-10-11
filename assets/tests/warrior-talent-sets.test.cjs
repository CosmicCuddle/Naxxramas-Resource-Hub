// Run: node assets/tests/warrior-talent-sets.test.cjs
// Protects Warrior's seven level-60 talents and the separate Fury raid variants.
"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const warriorJs = fs.readFileSync(path.join(__dirname, "..", "naxx-warrior-talent-sets.js"), "utf8");
const pendingJs = fs.readFileSync(path.join(__dirname, "..", "naxx-talent-set-conversion-notes.js"), "utf8");
const defs = warriorJs.match(/var BUILDS = (\[[\s\S]*?\]);\s*function warriorRecords/);
assert.ok(defs, "Warrior build data missing");
const builds = JSON.parse(defs[1]);
assert.equal(builds.length, 7);
builds.forEach(b => {
  assert.match(b[3], /^[0-9a-z.-]+$/);
  assert.equal(b[3].split(".").reduce((sum, x) => sum + Number(x.split("-")[1]),0),51);
});
function fixture() {
  let index = 0;
  const rows = builds.filter((b,i) => i !== 5).map(b => ({
    id:"warrior-original-"+(++index),section:"Vanilla Builds",buildType:b[0],
    classOption:b[1],role:b[2],createdAt:1000+index,classes:["Warrior"],
    title:b[1]+" · "+b[2]+" · Phase 1",talentEra:"Classic",phaseNumber:1,
    summary:"TO BE CONVERTED",downloadName:"Previous",
    downloadUrl:"https://example.com/previous/"+index
  }));
  rows.push({id:"warlock-solo-aff",section:"Vanilla Builds",classes:["Warlock"],
    buildType:"Solo Builds",summary:"TO BE CONVERTED",downloadUrl:"keep-aff"});
  rows.push({id:"warlock-solo-demo",section:"Vanilla Builds",classes:["Warlock"],
    buildType:"Solo Builds",summary:"",downloadUrl:"keep-demo"});
  rows.push({id:"warlock-raid-aff",section:"Vanilla Builds",classes:["Warlock"],
    buildType:"Raid Builds",summary:"TO BE CONVERTED",downloadUrl:"keep-aff-raid"});
  rows.push({id:"warlock-raid-demo",section:"Vanilla Builds",classes:["Warlock"],
    buildType:"Raid Builds",summary:"",downloadUrl:"keep-demo-raid"});
  rows.push({id:"mage",section:"Vanilla Builds",classes:["Mage"],
    buildType:"Solo Builds",summary:"Mage notes",downloadUrl:"keep-mage"});
  return {resources:rows};
}
function run(source,data){
  const context={DATA:data,currentSection:"Vanilla Builds",renderCount:0,
    renderPublic(){context.renderCount++},console:{warn(){context.warned=true}}};
  vm.runInNewContext(source,context);
  return context;
}
const data=fixture();
assert.equal(run(warriorJs,data).renderCount,1);
const warrior=data.resources.filter(r=>r.classes[0]==="Warrior");
assert.equal(warrior.length,7);
for(const [i,b] of builds.entries()){
  const matching=warrior.filter(r=>r.buildType===b[0]&&r.classOption===b[1]&&r.role===b[2]);
  assert.equal(matching.length,b[1]==="Fury Warrior"&&b[0]==="Raid Builds"?2:1);
  const url="https://cosmiccuddle.github.io/Naxxramas-Resource-Hub/talents/?code="+
    encodeURIComponent("NT1:vanilla:warrior:"+b[3])+"&level=60";
  const record=warrior.find(r=>r.downloadUrl===url);
  assert.ok(record,"Missing unique build "+i);
  assert.equal(record.downloadName,"Talent Calculator");
  assert.ok(!record.summary.includes("TO BE CONVERTED"));
  if(b[4])assert.ok(record.summary.includes(b[4]));
}
assert.equal(warrior.filter(r=>r.buildType==="Solo Builds").length,3);
assert.equal(warrior.filter(r=>r.buildType==="Raid Builds").length,4);
assert.equal(warrior.filter(r=>r.classOption==="Fury Warrior" && r.buildType==="Raid Builds").length,2);
assert.equal(run(warriorJs,data).renderCount,0,"Warrior sync must be idempotent");
const pending=run(pendingJs,data);
assert.equal(pending.renderCount,1);
assert.ok(data.resources.filter(r=>r.classes[0]==="Warlock").every(r=>
  (r.summary.match(/TO BE CONVERTED/g)||[]).length===1));
assert.ok(warrior.every(r=>!r.summary.includes("TO BE CONVERTED")),
  "Warrior must not be relabelled by Warlock-only script");
assert.equal(run(pendingJs,data).renderCount,0);
assert.equal(data.resources.find(r=>r.id==="mage").downloadUrl,"keep-mage");
const mismatched=fixture();
mismatched.resources=mismatched.resources.filter(r=>r.id!=="warrior-original-1");
const guarded=run(warriorJs,mismatched);
assert.equal(guarded.warned,true);
assert.equal(guarded.renderCount,0);
assert.ok(mismatched.resources.filter(r=>r.classes[0]==="Warrior")
  .every(r=>r.downloadUrl.startsWith("https://example.com/previous/")));
console.log("PASS: all seven 51-point Warrior builds, three Solo and four Raid.");
console.log("PASS: independent Rend Flurry and Anger Management Fury raid builds.");
console.log("PASS: Warrior placeholders removed, Warlock placeholders preserved.");
console.log("PASS: original IDs, unrelated classes, idempotence, and fail-closed validation.");
