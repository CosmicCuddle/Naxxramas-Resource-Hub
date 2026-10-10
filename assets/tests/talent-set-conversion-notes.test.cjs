// Run: node assets/tests/talent-set-conversion-notes.test.cjs
// Verifies only Warrior and Warlock Solo/Raid notes are updated.
"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const script = fs.readFileSync(path.join(__dirname, "..", "naxx-talent-set-conversion-notes.js"), "utf8");
function makeData() {
  const records = [];
  [["Warrior",3],["Warlock",2]].forEach(([cls,number]) => {
    ["Solo Builds","Raid Builds"].forEach(type => {
      for (let i=0;i<number;i++) {
        records.push({
          id: cls + ":" + type + ":" + i,
          section: "Vanilla Builds",classes:[cls],buildType:type,
          summary:type==="Solo Builds"?"TO BE CONVERTED":"",
          downloadUrl:"https://example.org/keep-" + cls + "-" + i,
          downloadName:"Talent Calculator"
        });
      }
    });
  });
  records.push({
    id:"druid",section:"Vanilla Builds",classes:["Druid"],
    buildType:"Raid Builds",summary:"OTHER NOTE",downloadUrl:"unchanged"
  });
  records.push({
    id:"warrior-guide",section:"Class Handbooks",classes:["Warrior"],
    buildType:"Raid Builds",summary:"Handbook note",downloadUrl:"keep"
  });
  return {resources:records};
}
function run(data) {
  const context={DATA:data,currentSection:"Vanilla Builds",calls:0,
    renderPublic(){context.calls++;},console:{warn(){context.warned=true;}}};
  vm.runInNewContext(script,context,{filename:"naxx-talent-set-conversion-notes.js"});
  return context;
}
const data=makeData();
data.resources.find(x=>x.id==="Warrior:Raid Builds:0").summary="Existing build note";
const result=run(data);
assert.equal(result.calls,1,"Should repaint current Talent Sets page");
const matched=data.resources.filter(x=>x.section==="Vanilla Builds" &&
  ["Warrior","Warlock"].includes(x.classes[0]));
assert.equal(matched.length,10);
matched.forEach(record => {
  assert.equal((record.summary.match(/TO BE CONVERTED/g)||[]).length,1,
    "Exactly one note for "+record.id);
  assert.ok(record.downloadUrl.startsWith("https://example.org/keep-"),
    "Links must not change");
});
assert.equal(data.resources.find(x=>x.id==="Warrior:Raid Builds:0").summary,
  "Existing build note\nTO BE CONVERTED");
assert.equal(data.resources.find(x=>x.id==="druid").summary,"OTHER NOTE");
assert.equal(data.resources.find(x=>x.id==="warrior-guide").summary,"Handbook note");
assert.equal(run(data).calls,0,"Running again must be idempotent");
const mismatch=makeData();
mismatch.resources=mismatch.resources.filter(x=>x.id!=="Warlock:Raid Builds:0");
const failed=run(mismatch);
assert.equal(failed.warned,true,"Unexpected count must be logged");
assert.equal(failed.calls,0);
assert.ok(mismatch.resources.every(x=>x.summary!=="TO BE CONVERTED" ||
  x.buildType==="Solo Builds"),"Fail closed without partially labelling");
console.log("PASS: Warrior and Warlock Solo/Raid entries each show TO BE CONVERTED once.");
console.log("PASS: Existing descriptions, Talent Calculator links and other sections preserved.");
console.log("PASS: Idempotence and count-mismatch safeguard.");
