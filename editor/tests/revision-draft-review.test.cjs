'use strict';
/* Actual SHA-256 full-source review -> version-bound draft -> disposable
 * in-memory plan, without a GitHub write, source file mutation or UI launch.
 */
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const crypto=require('node:crypto');
const {webcrypto}=crypto;
const {splitInMemory,restoreInMemory}=
  require('../tools/check-legacy-roundtrip.cjs');
const {makeManifest,plan}=require('../tools/rehearse-versioned-resource-sessions.cjs');
const {recordPath}=require('../tools/rehearse-resource-only-overlay.cjs');
const moduleUnderTest=require('../revision-draft-review.js');
const original=fs.readFileSync(path.resolve(__dirname,'..','..','site-content.html'));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const split=splitInMemory(original);
const baseline=moduleUnderTest.FORMAT;
const paths=Array.from({length:414},(_,i)=>recordPath(i));
const shell={
  prefix:split.source.slice(0,split.arrayBegin),
  suffix:split.source.slice(split.arrayEnd),
  separators:split.separators.slice()
};
const shellSha=sha(Buffer.from(JSON.stringify([
  shell.prefix,shell.suffix,shell.separators
])));
function state(records,rev,parent){
  const manifest=makeManifest(split,records,rev,parent);
  return {
    source:{manifest,shell:{...shell,separators:shell.separators.slice()},
      fragments:records.slice()},
    trust:{expectedRevision:rev,expectedSourceSha256:manifest.sourceSha256,
      expectedParentSha256:parent,expectedShellSha256:shellSha,
      expectedRecordPaths:paths.slice()},
    planner:{split,records:records.slice(),manifest}
  };
}
const anchor=sha(original);
test('verified original source creates review-only revision-zero title/content draft',async()=>{
  assert.equal(anchor,moduleUnderTest.prepare?require('../revision-source-reader.js').ANCHOR:'');
  const first=state(split.records,0,null);
  const before=JSON.stringify(first.source.manifest);
  const draft=await moduleUnderTest.prepare(first.source,first.trust,webcrypto,
    [{index:413,content:'Fictional last content\n\nSecond paragraph.'},
     {index:0,title:'Fictional first title'}]);
  assert.equal(draft.format,baseline);
  assert.equal(draft.revision,0);
  assert.equal(draft.sourceSha256,anchor);
  assert.equal(draft.sourceBaselineSha256,anchor);
  assert.deepEqual(draft.changes.map(x=>x.index),[0,413]);
  assert.equal(draft.changes[0].expectedSha256,first.source.manifest.resources[0].sha256);
  assert.equal(draft.changes[1].expectedSha256,first.source.manifest.resources[413].sha256);
  assert.equal(Object.isFrozen(draft),true);
  assert.equal(Object.isFrozen(draft.changes),true);
  assert.equal(JSON.stringify(first.source.manifest),before);
  assert.equal(draft.canPublish,undefined);
});
test('real original → revision 1 → revision 2 drafts preserve first edit, 412 other resources and exact original',async()=>{
  const zero=state(split.records,0,null);
  const firstDraft=await moduleUnderTest.prepare(zero.source,zero.trust,webcrypto,
    [{index:0,title:'First local revision, fictional'}]);
  const first=plan(zero.planner,firstDraft);
  assert.equal(first.manifest.revision,1);
  const one=state(first.newRecords,1,anchor);
  assert.equal(one.source.manifest.sourceSha256,first.manifest.sourceSha256);
  const secondDraft=await moduleUnderTest.prepare(one.source,one.trust,webcrypto,
    [{index:413,content:'Second fictional revision.\n\nLine two.'}]);
  assert.equal(secondDraft.revision,1);
  assert.equal(secondDraft.sourceSha256,one.source.manifest.sourceSha256);
  assert.equal(secondDraft.changes[0].expectedSha256,
    one.source.manifest.resources[413].sha256);
  const second=plan(one.planner,secondDraft);
  assert.equal(second.manifest.revision,2);
  assert.equal(second.manifest.parentSha256,one.source.manifest.sourceSha256);
  assert.equal(second.newRecords[0],first.newRecords[0]);
  assert.notEqual(second.newRecords[0],split.records[0]);
  assert.notEqual(second.newRecords[413],split.records[413]);
  for(let i=1;i<413;i++)
    assert.equal(second.newRecords[i],split.records[i]);
  assert.equal(sha(restoreInMemory(split,second.newRecords)),
    second.manifest.sourceSha256);
  assert.equal(sha(original),anchor);
  assert.equal(restoreInMemory(split).equals(original),true);
  assert.throws(()=>plan(one.planner,firstDraft),/Stale save/);
  assert.throws(()=>plan({split,records:second.newRecords,
    manifest:second.manifest},secondDraft),/Stale save/);
});
test('invalid draft content and duplicate resource targets are blocked before source changes',async()=>{
  const zero=state(split.records,0,null);
  for(const changes of [
    [],
    [{index:414,title:'out of bounds'}],
    [{index:-1,title:'negative'}],
    [{index:1,title:'A'},{index:1,title:'B'}],
    [{index:0,title:'<script>unsafe</script>'}],
    [{index:0,content:'<iframe>unsafe</iframe>'}],
    [{index:0,title:'Too long '+ 'x'.repeat(200)}],
    [{index:0,content:'x'.repeat(30001)}],
    [{index:0,title:'valid',adminRole:'unsafe'}]
  ]){
    await assert.rejects(
      moduleUnderTest.prepare(zero.source,zero.trust,webcrypto,changes),
      /resource changes|index|draft field|invalid/i);
  }
  assert.equal(zero.source.manifest.revision,0);
  assert.equal(sha(original),anchor);
});
test('wrong expected revision, tampered resource and forged shell refuse a private draft',async()=>{
  const zero=state(split.records,0,null);
  await assert.rejects(moduleUnderTest.prepare(zero.source,{
    ...zero.trust,expectedRevision:1,expectedParentSha256:'b'.repeat(64)
  },webcrypto,[{index:0,title:'Safe title'}]),/stale|trusted/i);
  const bad=state(split.records,0,null);
  bad.source.fragments[0]+=' ';
  await assert.rejects(moduleUnderTest.prepare(bad.source,bad.trust,webcrypto,
    [{index:0,title:'Safe title'}]),/Resource checksum/i);
  const shellBad=state(split.records,0,null);
  shellBad.source.shell.prefix+=' ';
  await assert.rejects(moduleUnderTest.prepare(shellBad.source,shellBad.trust,
    webcrypto,[{index:0,title:'Safe title'}]),/shell/i);
});
test('source and draft inputs are copied before awaited verification, so mid-read mutation cannot alter the review',async()=>{
  const zero=state(split.records,0,null),chosen=[{index:0,title:'Original planned title'}];
  let release;
  let suspended=false;
  const delayed={subtle:{digest:async function(alg,data){
    if(!suspended){
      suspended=true;
      await new Promise(resolve=>{release=resolve;});
    }
    return webcrypto.subtle.digest(alg,data);
  }}};
  const pending=moduleUnderTest.prepare(zero.source,zero.trust,delayed,chosen);
  assert.equal(suspended,true);
  zero.source.fragments[0]+=' bad';
  zero.source.manifest.resources[0].sha256='b'.repeat(64);
  zero.trust.expectedRevision=27;
  chosen[0].title='Tampered after start';
  release();
  const verified=await pending;
  assert.equal(verified.revision,0);
  assert.equal(verified.changes[0].title,'Original planned title');
  assert.equal(verified.changes[0].expectedSha256,
    sha(Buffer.from(split.records[0])));
});
test('revision-only draft helper does not offer a GitHub writer or modify legacy UI',()=>{
  const source=fs.readFileSync(path.join(__dirname,'..',
    'revision-draft-review.js'),'utf8');
  for(const marker of ['fetch(', 'XMLHttpRequest', 'writeFileSync(',
    'localStorage', 'sendBeacon(', 'git push','github.com/'])
    assert.equal(source.includes(marker),false);
  assert.deepEqual(Object.keys(moduleUnderTest).sort(),['FORMAT','prepare']);
  assert.equal(typeof moduleUnderTest.save, 'undefined');
  assert.equal(typeof moduleUnderTest.publish,'undefined');
});
