// Run: node assets/tests/combat-rogue-solo-links.test.cjs
// Verifies the owner's three updated Combat Rogue Solo share links and site loader.
"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const asset = path.resolve(__dirname, "..");
const full = fs.readFileSync(path.join(asset,"naxx-talent-sets-full-sync.js"),"utf8");
const seed = fs.readFileSync(path.join(asset,"naxx-talent-set-sync.js"),"utf8");
const loader = fs.readFileSync(path.join(asset,"..","index.html"),"utf8");

const match = full.match(/var builds = (\[[\s\S]*?\]);\s*var expectedGroupSizes/);
assert.ok(match,"Talent Sets full sync data missing");
const data = JSON.parse(match[1]);
const rogue = data.filter(row => row[0] === "Rogue|Solo Builds|Combat Rogue|DPS");
assert.equal(rogue.length,3,"Three Rogue Combat Solo weapon variants must remain");

const codes = [
  "51-5.56-3.57-3.5l-2.5p-1.65-3.67-1.6q-5.7h-4.7i-5.7k-2.7l-2.8d-1.v6-5.1bb-2.1be-2.1er-2.1lg-2.1qc-1",
  "51-5.54-5.56-3.57-3.5l-2.5p-1.65-3.67-1.7h-4.7i-5.7k-2.7l-2.8d-1.v6-5.1bb-2.1be-2.1er-2.1lg-2.1qc-1",
  "51-5.52-3.56-3.57-3.5l-2.5p-1.65-5.67-1.7h-4.7i-5.7k-2.7l-2.8d-1.v6-5.1bb-2.1be-2.1er-2.1lg-2.1qc-1"
];
for(let i=0;i<3;i++){
  const code = "NT1:vanilla:rogue:" + codes[i];
  assert.equal(rogue[i][1],i,"Weapon variant ordering changed");
  assert.equal(rogue[i][2],code,["Swords","Maces","Daggers"][i]+" changed");
  assert.equal(codes[i].split(".").reduce((n,p) => n + Number(p.split("-")[1]),0),51,
    "Rogue build must spend 51 level-60 talent points");
  if(i>0){
    const url = "https://cosmiccuddle.github.io/Naxxramas-Resource-Hub/talents/?code=" +
      encodeURIComponent(code) + "&level=60";
    assert.ok(seed.includes('downloadUrl: "' + url + '"'),"Seed for variant "+i+" is stale");
  }
}

// Exercise the real full-sync script, including its new Swords note logic.
// All expected groups must be represented so fail-closed validation can pass.
const vm = require("node:vm");
const expectedMatch = full.match(/var expectedGroupSizes = (\\{[\\s\\S]*?\\});\\s*var grouped/);
assert.ok(expectedMatch,"Expected build group sizes missing");
const sizes = JSON.parse(expectedMatch[1]);
function makeRecords() {
  let serial = 0;
  const resources = [];
  Object.entries(sizes).forEach(([key,count]) => {
    const [cls,mode,spec,role] = key.split("|");
    for(let index=0;index<count;index++) {
      resources.push({
        id:"source-"+(++serial),createdAt:1000+index,section:"Vanilla Builds",
        classes:[cls],buildType:mode,classOption:spec,role,
        summary:cls==="Rogue"&&mode==="Solo Builds"&&spec==="Combat Rogue"
          ? ["","Maces","Daggers"][index] : "Keep note",
        downloadUrl:"old",downloadName:"Old"
      });
    }
  });
  return resources;
}
const fixture = { resources: makeRecords() };
const context = {
  DATA:fixture,currentSection:"Vanilla Builds",renders:0,
  renderPublic(){context.renders++},
  console:{warn(){throw new Error("Unexpected group mismatch")}}
};
vm.runInNewContext(full,context,{filename:"naxx-talent-sets-full-sync.js"});
const combat = fixture.resources.filter(r => r.classes[0]==="Rogue" &&
  r.buildType==="Solo Builds" && r.classOption==="Combat Rogue")
  .sort((a,b)=>a.createdAt-b.createdAt);
assert.deepEqual(combat.map(r=>r.summary),["Swords","Maces","Daggers"]);
assert.equal(fixture.resources.filter(r=>r.summary==="Swords").length,1);
assert.ok(fixture.resources.filter(r=>r.classOption!=="Combat Rogue").every(r=>r.summary==="Keep note"));
assert.equal(context.renders,1,"Visible Talent Sets should refresh after new label");
vm.runInNewContext(full,context,{filename:"naxx-talent-sets-full-sync.js"});
assert.equal(context.renders,1,"Second run must not duplicate the update");

// Replacing the loader with a full admin-export HTML file breaks addon scripts,
// website countdowns, handbooks and the isolated talent-data patches.
assert.ok(loader.length < 10000, "index.html must remain a small wrapper");
assert.ok(loader.includes('fetch(source, { cache: "default" })'));
assert.ok(loader.includes('"site-content.html"'));
assert.ok(loader.includes("assets/naxx-talent-set-sync.js?v=2"));
assert.ok(loader.includes("assets/naxx-talent-sets-full-sync.js?v=3"));
assert.ok(loader.includes("assets/naxx-warrior-talent-sets.js?v=1"));
assert.ok(loader.includes("assets/naxx-final-vanilla-talent-sets.js?v=1"));
assert.ok(loader.includes("assets/naxx-countdowns.js?v=7"));
assert.ok(!loader.includes("window.NAXX_DATA"));

console.log("PASS: Swords, Maces and Daggers have exact updated 51-point links.");
console.log("PASS: seeded Rogue variant links are consistent with the full sync.");
console.log("PASS: Swords summary is visible; Maces/Daggers and other notes stay intact.");
console.log("PASS: lightweight index.html loader and website scripts are preserved.");
