'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const core=require('../restore-preflight-core.js');
function fixture(revision=0){
  return {
    format:core.MANIFEST,privateOnly:true,publishable:false,deployable:false,
    originalSha256:core.BASE,revision,
    parentSha256:revision===0?null:'a'.repeat(64),
    sourceSha256:revision===0?core.BASE:'b'.repeat(64),
    sourceBytes:30976969,resources:Array.from({length:core.COUNT},(_,i)=>({
      index:i,path:core.pathFor(i),sha256:String(i+1).padStart(64,'0')
    }))
  };
}
function draft(manifest,index=0,fields={title:'Test-only review wording'}){
  return {format:core.DRAFT,sourceBaselineSha256:core.BASE,
    revision:manifest.revision,sourceSha256:manifest.sourceSha256,
    changes:[{index,expectedSha256:manifest.resources[index].sha256,...fields}]};
}
test('matching resource draft only permits a review, never applying or publishing',()=>{
  const m=fixture(),d=draft(m);
  assert.equal(core.validManifest(m),true);
  assert.equal(core.validDraft(d),true);
  const result=core.assess(m,d);
  assert.equal(result.code,'review-only');
  assert.equal(result.isBlocked,false);
  assert.equal(result.canApply,false);
  assert.equal(result.canPublish,false);
  assert.equal(result.canAutoMerge,false);
  assert.equal(result.readOnly,true);
  assert.equal(result.requestedResourceCount,1);
  assert.equal(result.changedTargetCount,0);
  assert.equal(Object.isFrozen(result),true);
});
test('old drafts are blocked even when another resource changed',()=>{
  const m=fixture(),old=draft(m,0);
  const updated=fixture(1);
  updated.resources[413].sha256='d'.repeat(64);
  const status=core.assess(updated,old);
  assert.equal(status.code,'stale');
  assert.equal(status.isBlocked,true);
  assert.equal(status.changedTargetCount,0);
  assert.equal(status.latestRevision,1);
});
test('stale drafts report only counts when a target has changed',()=>{
  const m=fixture(),old=draft(m,0,{content:'Safe\nplain text'});
  const updated=fixture(1);
  updated.resources[0].sha256='c'.repeat(64);
  const status=core.assess(updated,old);
  assert.equal(status.code,'stale');
  assert.equal(status.changedTargetCount,1);
  assert.equal(status.message.includes('Safe'),false);
});
test('matching source version with mismatched fragment SHA fails closed',()=>{
  const m=fixture(),d=draft(m);
  m.resources[0].sha256='a'.repeat(64);
  const status=core.assess(m,d);
  assert.equal(status.code,'record-conflict');
  assert.equal(status.canApply,false);
});
test('same numeric revision but changed complete source checksum is also stale',()=>{
  const m=fixture(),d=draft(m);
  m.sourceSha256='b'.repeat(64);
  assert.equal(core.assess(m,d).code,'stale');
});
test('invalid source metadata blocks before looking at private draft text',()=>{
  const m=fixture(),d=draft(m);
  m.resources[0].path='../unsafe';
  assert.equal(core.validManifest(m),false);
  assert.equal(core.assess(m,d).code,'invalid-source');
});
test('invalid or unexpected draft fields, indices and text never qualify for review',()=>{
  const m=fixture(),d=draft(m);
  const mutations=[
    {...d,extra:true},
    {...d,sourceBaselineSha256:'a'.repeat(64)},
    {...d,revision:-1},
    {...d,sourceSha256:'not-hash'},
    {...d,changes:[]},
    {...d,changes:[{...d.changes[0],unexpected:true}]},
    {...d,changes:[{...d.changes[0],expectedSha256:'bad'}]},
    {...d,changes:[{...d.changes[0],index:414}]},
    {...d,changes:[d.changes[0],d.changes[0]]},
    {...d,changes:[{...d.changes[0],title:'<script>'}]},
    {...d,changes:[{...d.changes[0],title:'Line\nbreak'}]},
    {...d,changes:[{...d.changes[0],title:''}]},
    {...d,changes:[{...d.changes[0],content:'<img>'}]},
    {...d,changes:[{...d.changes[0],content:'\u0000'}]}
  ];
  mutations.forEach(x=>{
    assert.equal(core.validDraft(x),false);
    assert.equal(core.assess(m,x).code,'invalid-draft');
  });
});
test('plain-text title/content with line breaks and empty content are allowed as metadata',()=>{
  const m=fixture();
  const d=draft(m,413,{title:'Plain title',content:'First line\n\nSecond line'});
  assert.equal(core.validDraft(d),true);
  assert.equal(core.assess(m,d).code,'review-only');
  assert.equal(core.validDraft(draft(m,413,{content:''})),true);
});
test('manifest path and index order are strictly preserved for all 414 records',()=>{
  const m=fixture(),d=draft(m);
  assert.equal(core.validManifest(m),true);
  const tmp=m.resources[0];m.resources[0]=m.resources[1];m.resources[1]=tmp;
  assert.equal(core.assess(m,d).code,'invalid-source');
  m.resources[1]={index:1,path:core.pathFor(1),sha256:'wrong'};
  assert.equal(core.validManifest(m),false);
});
test('standalone preview uses fictional examples, inert button controls and restrictive CSP',()=>{
  const dir=path.resolve(__dirname,'..');
  const html=fs.readFileSync(path.join(dir,'restore-preflight-preview.html'),'utf8');
  const js=fs.readFileSync(path.join(dir,'restore-preflight-preview.js'),'utf8');
  assert.match(html,/TEST ONLY/);
  assert.match(html,/fictional resource information/);
  assert.match(html,/connect-src 'none'/);
  assert.match(html,/form-action 'none'/);
  assert.match(html,/aria-live="polite"/);
  assert.match(html,/type="button"/);
  for(const name of ['current','stale','conflict','invalid'])
    assert.match(html,new RegExp('id="case-'+name+'"'));
  for(const term of ['<form','<iframe','type="file"','http-equiv="refresh"'])
    assert.equal(html.includes(term),false);
  for(const forbidden of ['fetch(','.submit(','.open(','.sendBeacon(','.innerHTML=', 'localStorage.','sessionStorage.'])
    assert.equal(js.includes(forbidden),false);
  assert.doesNotThrow(()=>new vm.Script(js));
});
