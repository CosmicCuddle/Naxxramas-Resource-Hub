// Run: node assets/tests/final-vanilla-talent-sets.test.cjs
// Test exact Warlock/Mage update data against unchanged previously published sets.
// The original HTML and live player database are not modified.
"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const assets = path.resolve(__dirname, "..");
const script = fs.readFileSync(path.join(assets,"naxx-final-vanilla-talent-sets.js"),"utf8");
const previous = fs.readFileSync(path.join(assets,"naxx-talent-sets-full-sync.js"),"utf8");
const warrior = fs.readFileSync(path.join(assets,"naxx-warrior-talent-sets.js"),"utf8");
const loader = fs.readFileSync(path.join(assets,"..","index.html"),"utf8");
const extract = (text, regex, label) => {
  const match = text.match(regex);
  assert.ok(match, "Missing "+label);
  return JSON.parse(match[1]);
};
const additions = extract(script,/var BUILDS = (\[[\s\S]*?\]);\s*var IDS/, "final builds");
const forty = extract(previous,/var builds = (\[[\s\S]*?\]);\s*var expectedGroupSizes/, "previous 40");
const seven = extract(warrior,/var BUILDS = (\[[\s\S]*?\]);\s*function warriorRecords/, "Warrior 7");
assert.equal(additions.length,7);
assert.equal(forty.length,40);
assert.equal(seven.length,7);
assert.equal(additions.length+forty.length+seven.length,54);
additions.forEach(b => {
  assert.ok(["Warlock","Mage"].includes(b[0]));
  assert.equal(b[4].split(".").reduce((n,z)=>n+Number(z.split("-")[1]),0),51);
});
assert.ok(!loader.includes("conversionNotesURL"),"Obsolete pending notes must not be loaded");
assert.ok(loader.includes("naxx-final-vanilla-talent-sets.js?v=1"));
assert.ok(loader.indexOf("warriorSetsURL +") < loader.indexOf("finalTalentsURL +"));

function fixture() {
  const records=[];
  let ordinal=0;
  const add=(cls,mode,spec,summary="")=>{
    records.push({
      id:"source-"+(++ordinal),section:"Vanilla Builds",
      classes:[cls],buildType:mode,classOption:spec+" "+cls,role:"DPS",
      createdAt:1000+ordinal,phaseNumber:1,talentEra:"Classic",
      title:spec+" "+cls+" · DPS · Phase 1",summary,
      downloadUrl:"https://example.com/original/"+ordinal,
      downloadName:"Talent Calculator"
    });
  };
  add("Warlock","Raid Builds","Affliction","TO BE CONVERTED");
  add("Warlock","Raid Builds","Demonology","TO BE CONVERTED");
  add("Warlock","Solo Builds","Affliction","TO BE CONVERTED");
  add("Warlock","Solo Builds","Demonology","Some existing note\nTO BE CONVERTED");
  add("Mage","Raid Builds","Frost");
  add("Mage","Solo Builds","Frost","Other frost guidance");
  add("Mage","Solo Builds","Frost","Second frost guidance");
  add("Warrior","Solo Builds","Arms","Warrior note");
  add("Druid","Raid Builds","Balance","Druid note");
  return {resources:records};
}
function run(data) {
  const env={DATA:data,currentSection:"Vanilla Builds",renders:0,
    renderPublic(){env.renders++},console:{warn(){env.warned=true;}}};
  vm.runInNewContext(script,env,{filename:"naxx-final-vanilla-talent-sets.js"});
  return env;
}
const data=fixture();
const originalMage=data.resources.filter(r=>r.classes[0]==="Mage").map(r=>r.downloadUrl);
assert.equal(run(data).renders,1);
const all=data.resources;
const wl=all.filter(r=>r.classes[0]==="Warlock");
const mage=all.filter(r=>r.classes[0]==="Mage");
assert.equal(wl.length,5);
assert.equal(mage.length,5);
assert.equal(wl.filter(r=>r.buildType==="Raid Builds").length,2);
assert.equal(wl.filter(r=>r.buildType==="Solo Builds").length,3);
assert.equal(mage.filter(r=>r.buildType==="Raid Builds").length,1);
assert.equal(mage.filter(r=>r.buildType==="Solo Builds").length,4);
assert.ok(wl.every(r=>!r.summary.includes("TO BE CONVERTED")));
assert.equal(wl.find(r=>r.classOption==="Demonology Warlock"&&r.buildType==="Solo Builds").summary,"Some existing note");
additions.forEach(b => {
  const [cls,mode,spec,role,code] = b;
  const expected = "https://cosmiccuddle.github.io/Naxxramas-Resource-Hub/talents/?code=" +
    encodeURIComponent("NT1:vanilla:"+cls.toLowerCase()+":"+code)+"&level=60";
  assert.equal(all.filter(r=>r.classes[0]===cls&&r.buildType===mode &&
    r.classOption===spec&&r.role===role&&r.downloadUrl===expected).length,1,
    "Build must be present exactly once: "+spec+"/"+mode);
});
const frost = mage.filter(r=>r.classOption==="Frost Mage"&&r.buildType==="Solo Builds")
  .sort((a,b)=>a.createdAt-b.createdAt);
assert.equal(frost[0].summary,"Other frost guidance");
assert.equal(frost[1].summary,"Second frost guidance\nMore Focus AOE");
assert.deepEqual(data.resources.filter(r=>r.classes[0]==="Mage"&&r.classOption==="Frost Mage")
  .map(r=>r.downloadUrl),originalMage);
assert.equal(all.find(r=>r.classes[0]==="Warrior").summary,"Warrior note");
assert.equal(all.find(r=>r.classes[0]==="Druid").downloadUrl,"https://example.com/original/9");
const originalCount=all.length;
assert.equal(run(data).renders,0,"Second run must be idempotent");
assert.equal(all.length,originalCount,"No duplicate Mage/Warlock cards on repeat");
const mismatch=fixture();
mismatch.resources=mismatch.resources.filter(r=>r.classOption!=="Demonology Warlock"||r.buildType!=="Solo Builds");
const bad=run(mismatch);
assert.equal(bad.warned,true);
assert.equal(bad.renders,0);
assert.equal(mismatch.resources.length,8);
assert.ok(mismatch.resources.every(r=>r.downloadUrl.startsWith("https://example.com/original/")),
  "Fail closed without touching partial sets");
console.log("PASS: 54 total planned builds, 7 new/updated 51-point Warlock/Mage links.");
console.log("PASS: 5 Warlock cards, 5 Mage cards and new Destruction/Arcane/Fire Solo.");
console.log("PASS: TO BE CONVERTED removed, More Focus AOE note preserved.");
console.log("PASS: original records and other classes unchanged; idempotent and fail-closed.");
