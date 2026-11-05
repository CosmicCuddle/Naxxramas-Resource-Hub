'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const core=require('../resource-title-core.js');
const source=fs.readFileSync(path.resolve(__dirname,'..','..','site-content.html'),'utf8');

test('local title engine verifies exact 31 MB baseline before showing 414 records',async()=>{
  const model=await core.open(source,crypto.webcrypto);
  assert.equal(model.baselineSha256,core.BASE_SHA);
  assert.equal(model.resources.length,414);
  assert.equal(new Set(model.resources.map(r=>r.id)).size,414);
  assert.ok(model.resources.every(r=>typeof r.title==='string'&&r.title.length>0));
  assert.ok(model.resources.every(r=>typeof r.section==='string'));
  assert.equal(core.BASE_LENGTH,30976969);
});
test('editing titles creates only changed-index JSON draft with an exact baseline fingerprint',async()=>{
  const model=await core.open(source,crypto.webcrypto);
  const titles=new Map([[0,'Development Title A'],[413,'Development Title B']]);
  const data=core.draft(titles,model);
  assert.equal(data.format,'naxx-local-resource-title-draft-v1');
  assert.equal(data.baselineSha256,core.BASE_SHA);
  assert.deepEqual(data.changes,[{index:0,title:'Development Title A'},{index:413,title:'Development Title B'}]);
  const restored=core.restore(JSON.parse(JSON.stringify(data)),model);
  assert.equal(restored.get(0),'Development Title A');
  assert.equal(restored.get(413),'Development Title B');
});
test('draft restores refuse altered keys, repeated positions, stale hashes and unsafe titles',async()=>{
  const model=await core.open(source,crypto.webcrypto);
  const base=core.draft(new Map([[0,'Edited Title']]),model);
  function withChanges(changes){return {...base,changes};}
  assert.throws(()=>core.restore({...base,evil:'secret'},model));
  assert.throws(()=>core.restore({...base,baselineSha256:'0'.repeat(64)},model));
  assert.throws(()=>core.restore(withChanges([{index:0,title:'A'},{index:0,title:'B'}]),model));
  assert.throws(()=>core.restore(withChanges([{index:414,title:'A'}]),model));
  assert.throws(()=>core.restore(withChanges([{index:0,title:'<script>x</script>'}]),model));
  assert.throws(()=>core.restore(withChanges([{index:0,title:model.resources[0].title}]),model));
  assert.throws(()=>core.restore(withChanges([{index:0,title:'A',privateUrl:'no'}]),model));
  assert.throws(()=>core.draft(new Map([[0,'Line\nbreak']]),model));
});
test('version mismatch, incomplete file and unsupported hashing fail closed',async()=>{
  await assert.rejects(core.open(source+'!',crypto.webcrypto),/version|incomplete/i);
  await assert.rejects(core.open(source,null),/SHA-256/i);
  const sameSizeDifferent=source.slice(0,100)+'!'+source.slice(101);
  await assert.rejects(core.open(sameSizeDifferent,crypto.webcrypto),/protected original/i);
});
test('resource parser does not execute source code or export original HTML',()=>{
  const engine=fs.readFileSync(path.resolve(__dirname,'..','resource-title-core.js'),'utf8');
  assert.doesNotMatch(engine,/\beval\s*\(|\bFunction\s*\(|\bfetch\s*\(|\bXMLHttpRequest\b/);
  assert.equal(core.titleValid('Safe title'),true);
  assert.equal(core.titleValid('a'.repeat(161)),false);
  assert.equal(core.titleValid('no\nnewline'),false);
  assert.equal(core.titleValid('<b>'),false);
  assert.equal(core.titleValid('   '),false);
  assert.ok(!Object.hasOwn(core,'parseVerified'));
  assert.ok(!Object.hasOwn(core,'writeFile'));

  assert.ok(!Object.hasOwn(core,'exportWebsite'));
  assert.ok(!Object.hasOwn(core,'publish'));
});
