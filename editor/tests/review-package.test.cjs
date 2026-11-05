'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {webcrypto}=require('node:crypto');
const root=path.resolve(__dirname,'..');
const sandbox={TextEncoder,Blob,Uint8Array,Uint32Array,DataView,Set,Array,crypto:webcrypto,console,
  document:{getElementById(){return null;}}};
vm.runInNewContext(fs.readFileSync(path.join(root,'export-zip.js'),'utf8'),sandbox);
vm.runInNewContext(fs.readFileSync(path.join(root,'review-package.js'),'utf8'),sandbox);
const zip=sandbox.NaxxEditorZip,review=sandbox.NaxxEditorReview;
function entries(blob){
  return blob.arrayBuffer().then(data=>{
    const b=Buffer.from(data),found=[];
    for(let i=0;i+30<=b.length&&b.readUInt32LE(i)===0x04034b50;){
      const nameLength=b.readUInt16LE(i+26),extra=b.readUInt16LE(i+28);
      const size=b.readUInt32LE(i+18),begin=i+30+nameLength+extra;
      found.push({path:b.subarray(i+30,i+30+nameLength).toString('utf8'),
        content:b.subarray(begin,begin+size).toString('utf8')});
      i=begin+size;
    }
    return found;
  });
}
const paths=['new-players/content.html','rules/content.html','apply/content.html','game-clients/content.html'];
const SHA='34455f6d901c538e2491a8c16681692e4c02d918b1984d7d0ba081aacb1049e8';
function pageDraft(){
  return {format:'naxx-local-draft-v3',sourceBranchHint:'feature/multi-file-editor-export-2026-11-05',
    sourceCommitVerified:false,createdAt:'2026-11-05T00:00:00Z',
    files:paths.map((path,i)=>({path,sourceSha256:SHA,edits:i===0?{'T:100':'Example safe edit'}:{}})),
    navigation:{path:'content/navigation.json',sourceSha256:SHA,
      document:{format:'naxx-navigation-v1',pages:[{label:'Example'}]}}};
}
function resourceDraft(){
  return {format:'naxx-local-resource-draft-v2',baselineSha256:SHA,
    changes:[{index:1,title:'Edited Title',content:'Text\n\nMore text'}]};
}
test('combined review package has separate page/resource drafts and integrity hashes, never production paths',async()=>{
  const r=await review.build(pageDraft(),resourceDraft(),zip);
  assert.equal(r.entryCount,4);
  const items=await entries(r.blob);
  assert.deepEqual(items.map(e=>e.path),[
    'REVIEW-PAGE-DRAFT.json','REVIEW-RESOURCE-DRAFT.json','REVIEW-MANIFEST.json','READ_ME_FIRST.txt'
  ]);
  const manifest=JSON.parse(items[2].content);
  assert.equal(manifest.format,'naxx-private-review-package-v1');
  assert.equal(manifest.publishable,false);
  assert.equal(manifest.githubReady,false);
  assert.equal(manifest.fullRepositoryBackup,false);
  assert.equal(manifest.originalsVerifiedByGitCommit,false);
  assert.equal(manifest.originalResourceSha256,SHA);
  assert.equal(manifest.pageFilePaths.length,4);
  assert.equal(manifest.resourceEdits,1);
  for(const f of items.slice(0,2)){
    const listed=manifest.payloads.find(x=>x.path===f.path);
    assert.ok(listed);
    assert.equal(listed.sha256,await zip.sha256(f.content));
    assert.equal(listed.utf8Bytes,new TextEncoder().encode(f.content).length);
  }
  assert.equal(JSON.parse(items[0].content).files.length,4);
  assert.equal(JSON.parse(items[1].content).changes[0].content,'Text\n\nMore text');
  assert.match(items[3].content,/DO NOT copy/);
  assert.match(items[3].content,/PRIVATE/);
  assert.ok(!items.some(i=>i.path==='site-content.html'||i.path==='index.html'));
});
test('page-only and resource-only review packages remain separate and labelled',async()=>{
  const page=await review.build(pageDraft(),null,zip);
  const resource=await review.build(null,resourceDraft(),zip);
  assert.deepEqual((await entries(page.blob)).map(f=>f.path),[
    'REVIEW-PAGE-DRAFT.json','REVIEW-MANIFEST.json','READ_ME_FIRST.txt'
  ]);
  assert.deepEqual((await entries(resource.blob)).map(f=>f.path),[
    'REVIEW-RESOURCE-DRAFT.json','REVIEW-MANIFEST.json','READ_ME_FIRST.txt'
  ]);
  assert.equal(resource.manifest.pageFilePaths.length,0);
  assert.equal(page.manifest.originalResourceSha256,null);
});
test('review package rejects missing drafts, changed resource baselines and unexpected page paths',async()=>{
  await assert.rejects(review.build(null,null,zip),/No applied/);
  await assert.rejects(review.build(pageDraft(),{...resourceDraft(),baselineSha256:'0'.repeat(64)},zip),/Unrecognised/);
  const invalid=pageDraft();invalid.files[0].path='index.html';
  await assert.rejects(review.build(invalid,null,zip),/path/);
  const dup=resourceDraft();dup.changes.push({...dup.changes[0]});
  await assert.rejects(review.build(null,dup,zip),/duplicated/);
});
test('review ZIP cannot sneak production files into review archives',async()=>{
  assert.throws(()=>zip.makeReviewZip([{path:'index.html',content:'<html>'},
    {path:'REVIEW-MANIFEST.json',content:'x'},{path:'READ_ME_FIRST.txt',content:'x'}]));
  assert.throws(()=>zip.makeReviewZip([{path:'new-players/content.html',content:'x'},
    {path:'REVIEW-MANIFEST.json',content:'x'},{path:'READ_ME_FIRST.txt',content:'x'}]));
  assert.throws(()=>zip.makeZip([{path:'REVIEW-RESOURCE-DRAFT.json',content:'x'}]));
  assert.throws(()=>zip.makeReviewZip([
    {path:'REVIEW-PAGE-DRAFT.json',content:'x'},
    {path:'REVIEW-PAGE-DRAFT.json',content:'x'},
    {path:'REVIEW-MANIFEST.json',content:'x'},
    {path:'READ_ME_FIRST.txt',content:'x'}
  ]));
});
test('combined review saver has no fetch or local repository writes',()=>{
  const code=fs.readFileSync(path.join(root,'review-package.js'),'utf8');
  assert.doesNotMatch(code,/\bfetch\s*\(|\bXMLHttpRequest\b|\blocalStorage\b|\beval\s*\(|\bFunction\s*\(/);
  assert.doesNotMatch(code,/writeFileSync|git\s+push|api\.github\.com|site-content\.html.*content\}/);
});
