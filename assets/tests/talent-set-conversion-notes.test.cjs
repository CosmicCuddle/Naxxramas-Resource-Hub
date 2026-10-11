// Run: node assets/tests/talent-set-conversion-notes.test.cjs
// Only unfinished Warlock Talent Sets remain marked TO BE CONVERTED.
"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const script = fs.readFileSync(path.join(__dirname, "..", "naxx-talent-set-conversion-notes.js"),"utf8");
function fixture() {
  const resources=[];
  ["Solo Builds","Raid Builds"].forEach(mode => {
    for(let i=0;i<2;i++)resources.push({
      id:"warlock-"+mode+"-"+i,section:"Vanilla Builds",classes:["Warlock"],
      buildType:mode,summary:i?"Existing description":"TO BE CONVERTED",
      downloadUrl:"keep-warlock-"+i
    });
    for(let i=0;i<3;i++)resources.push({
      id:"warrior-"+mode+"-"+i,section:"Vanilla Builds",classes:["Warrior"],
      buildType:mode,summary:"",downloadUrl:"keep-warrior-"+i
    });
  });
  resources.push({id:"mage",section:"Vanilla Builds",classes:["Mage"],
    buildType:"Solo Builds",summary:"Mage note",downloadUrl:"keep-mage"});
  return {resources};
}
function run(data) {
  const context={DATA:data,currentSection:"Vanilla Builds",renders:0,
    renderPublic(){context.renders++},console:{warn(){context.warned=true}}};
  vm.runInNewContext(script,context);
  return context;
}
const data=fixture();
assert.equal(run(data).renders,1);
const warlocks=data.resources.filter(r=>r.classes[0]==="Warlock");
assert.equal(warlocks.length,4);
warlocks.forEach(r => {
  assert.equal((r.summary.match(/TO BE CONVERTED/g)||[]).length,1);
  assert.ok(r.downloadUrl.startsWith("keep-warlock-"));
});
assert.ok(warlocks.filter(r=>r.summary.includes("Existing description")).length===2);
assert.ok(data.resources.filter(r=>r.classes[0]==="Warrior").every(r=>
  r.summary==="" && r.downloadUrl.startsWith("keep-warrior-")));
assert.equal(data.resources.find(r=>r.id==="mage").summary,"Mage note");
assert.equal(run(data).renders,0,"No duplicates on re-run");
const mismatch=fixture();
mismatch.resources=mismatch.resources.filter(r=>r.id!=="warlock-Raid Builds-0");
const result=run(mismatch);
assert.equal(result.warned,true);
assert.equal(result.renders,0);
assert.ok(mismatch.resources.every(r=>!r.summary.includes("Existing description\nTO BE CONVERTED")));
console.log("PASS: exactly four Warlock builds remain TO BE CONVERTED.");
console.log("PASS: Warrior builds, unrelated classes, original notes and URLs unchanged.");
console.log("PASS: idempotence and unexpected-count safety.");
