// Run: node assets/tests/talent-sets-full-sync.test.cjs
// Regression: all 40 Classic builds, exact grouping, variant ordering,
// untouched Warlock/Warrior records and safe failure on mismatch.
"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const source = fs.readFileSync(path.join(__dirname,"..","naxx-talent-sets-full-sync.js"),"utf8");
const dataMatch=source.match(/var builds = (\[[\s\S]*?\]);\s*var expectedGroupSizes/);
const sizesMatch=source.match(/var expectedGroupSizes = (\{[\s\S]*?\});\s*var grouped/);
assert.ok(dataMatch && sizesMatch,"Expected asset declarations are missing");
const builds=JSON.parse(dataMatch[1]);
const sizes=JSON.parse(sizesMatch[1]);
assert.equal(builds.length,40);
assert.equal(Object.keys(sizes).length,31);
assert.deepEqual(
  [...new Set(builds.map(row=>row[0].split("|")[0]))].sort(),
  ["Druid","Hunter","Mage","Priest","Rogue","Shaman"]
);
assert.equal(Object.values(sizes).reduce((n,v)=>n+v,0),40);
const sitePrefix="https://cosmiccuddle.github.io/Naxxramas-Resource-Hub/talents/?code=";
function fixtures(){
  const recs=[];
  Object.keys(sizes).forEach(key=>{
    const [cls,buildType,classOption,role]=key.split("|");
    for(let i=0;i<sizes[key];i++){
      recs.push({
        id:key+":"+i,section:"Vanilla Builds",classes:[cls],
        buildType,classOption,role,createdAt:1000+i,
        downloadUrl:"https://www.wowhead.com/old",downloadName:"Old"
      });
    }
  });
  ["Warrior","Warlock"].forEach(cls=>recs.push({
    id:cls,section:"Vanilla Builds",classes:[cls],
    buildType:"Solo Builds",classOption:cls==="Warrior"?"Arms Warrior":"Affliction Warlock",
    role:"DPS",createdAt:1000,downloadUrl:"https://www.wowhead.com/preserved",downloadName:"Old"
  }));
  return recs.reverse(); // Deliberately unlike source order; creation order defines variants.
}
function run(data){
  const ctx={DATA:data,currentSection:"Vanilla Builds",calls:0,renderPublic(){ctx.calls++},
    console:{warn(){ctx.warned=true}}};
  vm.runInNewContext(source,ctx,{filename:"naxx-talent-sets-full-sync.js"});
  return ctx;
}
const store={resources:fixtures()};
let result=run(store);
assert.equal(result.calls,1,"Current Vanilla Builds page should refresh on update");
for(const [key,index,code] of builds){
  const item=store.resources.find(r=>r.id===key+":"+index);
  assert.ok(item,"Missing record "+key+" / "+index);
  assert.equal(item.downloadUrl,sitePrefix+encodeURIComponent(code)+"&level=60");
  assert.equal(item.downloadName,"Talent Calculator");
}
for(const cls of ["Warlock","Warrior"]){
  const entry=store.resources.find(r=>r.id===cls);
  assert.equal(entry.downloadUrl,"https://www.wowhead.com/preserved");
  assert.equal(entry.downloadName,"Old");
}
assert.equal(run(store).calls,0,"Re-running should be idempotent");
const mismatch={resources:fixtures()};
mismatch.resources=mismatch.resources.filter(r=>r.id!=="Druid|Raid Builds|Feral Druid|DPS:0");
const failed=run(mismatch);
assert.equal(failed.warned,true,"Missing build must be diagnosed");
assert.equal(failed.calls,0,"Mismatch must not trigger a repaint");
assert.ok(mismatch.resources.every(r=>r.downloadUrl.startsWith("https://www.wowhead.com/")),
 "Mismatch must make no partial updates");
console.log("PASS: 40 validated Vanilla Raid/Solo talent builds across six classes.");
console.log("PASS: Warlock/Warrior unchanged, distinct variant order and idempotence.");
console.log("PASS: unexpected group counts prevent partial or incorrect updates.");
