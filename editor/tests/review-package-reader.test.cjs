'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {webcrypto}=require('node:crypto');
const root=path.resolve(__dirname,'..');
const sandbox={TextEncoder,Blob,Uint8Array,Uint32Array,DataView,Set,Array,
  crypto:webcrypto,console,document:{getElementById(){return null;}}};
vm.runInNewContext(fs.readFileSync(path.join(root,'export-zip.js'),'utf8'),sandbox);
vm.runInNewContext(fs.readFileSync(path.join(root,'review-package.js'),'utf8'),sandbox);
const writer=sandbox.NaxxEditorZip,review=sandbox.NaxxEditorReview,
  reader=require('../review-package-reader.js');
const P='REVIEW-PAGE-DRAFT.json',R='REVIEW-RESOURCE-DRAFT.json',
  M='REVIEW-MANIFEST.json',I='READ_ME_FIRST.txt';
const BASE='34455f6d901c538e2491a8c16681692e4c02d918b1984d7d0ba081aacb1049e8';
const paths=['new-players/content.html','rules/content.html','apply/content.html','game-clients/content.html'];
function pageDraft(){return {
  format:'naxx-local-draft-v3',
  sourceBranchHint:'feature/multi-file-editor-export-2026-11-05',
  sourceCommitVerified:false,createdAt:'2026-11-05T00:00:00Z',
  files:paths.map((p,i)=>({path:p,sourceSha256:BASE,
    edits:i===0?{'T:100':'Safe offline draft wording'}:{}})),
  navigation:{path:'content/navigation.json',sourceSha256:BASE,
    document:{format:'naxx-navigation-v1',pages:[{label:'Example'}]}}
};}
function resourceDraft(){return {
  format:'naxx-local-resource-draft-v2',baselineSha256:BASE,
  changes:[{index:1,title:'Sample resource title',
    content:'First paragraph.\n\nSecond paragraph.'}]
};}
async function bytes(page=pageDraft(),resource=resourceDraft()){
  const result=await review.build(page,resource,writer);
  return new Uint8Array(await result.blob.arrayBuffer());
}
function unpackLocal(bytes){
  const data=Buffer.from(bytes),out=[];
  for(let at=0;at+30<=data.length&&data.readUInt32LE(at)===0x04034b50;){
    const nlen=data.readUInt16LE(at+26),size=data.readUInt32LE(at+18),
      extra=data.readUInt16LE(at+28),start=at+30+nlen+extra;
    out.push({path:data.subarray(at+30,at+30+nlen).toString('utf8'),
      content:data.subarray(start,start+size).toString('utf8')});
    at=start+size;
  }
  return out;
}
async function fromFiles(files){
  return new Uint8Array(await writer.makeReviewZip(files).arrayBuffer());
}
test('combined private review ZIP verifies page and resource drafts without source writes',async()=>{
  const result=await reader.inspect(await bytes(),writer,review);
  assert.equal(result.format,'naxx-local-verified-review-zip-v1');
  assert.equal(result.reviewOnly,true);
  assert.equal(result.hasPageDraft,true);
  assert.equal(result.hasResourceDraft,true);
  assert.equal(result.draftCount,2);
  assert.equal(JSON.parse(result.pageDraftText).files.length,4);
  assert.equal(JSON.parse(result.resourceDraftText).changes[0].content,
    'First paragraph.\n\nSecond paragraph.');
  assert.equal(result.websiteFilesVerified,false);
  assert.equal(result.githubReady,false);
  assert.equal(result.canApply,false);
  assert.equal(result.canPublish,false);
  assert.equal(result.networkRequests,0);
  assert.equal(Object.isFrozen(result),true);
});
test('page-only and resource-only ZIPs retain only applicable recovery payloads',async()=>{
  const one=await reader.inspect(await bytes(pageDraft(),null),writer,review);
  const two=await reader.inspect(await bytes(null,resourceDraft()),writer,review);
  assert.equal(one.hasPageDraft,true);
  assert.equal(one.hasResourceDraft,false);
  assert.equal(one.resourceDraftText,null);
  assert.equal(one.draftCount,1);
  assert.equal(two.hasPageDraft,false);
  assert.equal(two.hasResourceDraft,true);
  assert.equal(two.pageDraftText,null);
  assert.equal(two.draftCount,1);
});
test('modified payload bytes and forged manifest digests are rejected',async()=>{
  const good=Buffer.from(await bytes());
  const offset=good.indexOf(Buffer.from('Safe offline draft wording'));
  assert.ok(offset>0);
  const edited=Buffer.from(good);
  edited[offset]^=1;
  await assert.rejects(reader.inspect(edited,writer,review),/unsafe or corrupted/);
  const files=unpackLocal(good);
  const manifest=JSON.parse(files.find(f=>f.path===M).content);
  manifest.payloads[0].sha256='f'.repeat(64);
  files.find(f=>f.path===M).content=JSON.stringify(manifest);
  await assert.rejects(reader.inspect(await fromFiles(files),writer,review),
    /unsafe or corrupted/);
});
test('extra trailing bytes, damaged entry name, compression and truncated ZIP are rejected',async()=>{
  const good=Buffer.from(await bytes());
  const trail=Buffer.concat([good,Buffer.from([0,1,2])]);
  await assert.rejects(reader.inspect(trail,writer,review),/unsafe or corrupted/);
  const invalid=Buffer.from(good);
  invalid[30]=0x58;
  await assert.rejects(reader.inspect(invalid,writer,review),/unsafe or corrupted/);
  const compressed=Buffer.from(good);
  compressed.writeUInt16LE(8,8); // local method, not ZIP/STORE
  await assert.rejects(reader.inspect(compressed,writer,review),/unsafe or corrupted/);
  await assert.rejects(reader.inspect(good.subarray(0,good.length-1),
    writer,review),/unsafe or corrupted/);
  await assert.rejects(reader.inspect(new Uint8Array(0),writer,review),
    /unsafe or corrupted/);
});
test('invalid supported draft content does not pass valid CRC and SHA transport',async()=>{
  const files=unpackLocal(await bytes());
  const resource=JSON.parse(files.find(f=>f.path===R).content);
  resource.baselineSha256='0'.repeat(64);
  files.find(f=>f.path===R).content=JSON.stringify(resource)+'\n';
  const manifest=JSON.parse(files.find(f=>f.path===M).content);
  const target=manifest.payloads.find(f=>f.path===R);
  target.sha256=await writer.sha256(files.find(f=>f.path===R).content);
  target.utf8Bytes=new TextEncoder().encode(files.find(f=>f.path===R).content).length;
  files.find(f=>f.path===M).content=JSON.stringify(manifest)+'\n';
  await assert.rejects(reader.inspect(await fromFiles(files),writer,review),
    /unsafe or corrupted/);
});
test('duplicate or unapproved paths cannot enter a review archive',async()=>{
  const files=unpackLocal(await bytes());
  files[0].path='index.html';
  assert.throws(()=>writer.makeReviewZip(files),/Unsafe, unapproved/);
  files[0].path=P;
  files[1].path=P;
  assert.throws(()=>writer.makeReviewZip(files),/duplicate ZIP path/);
});
test('browser editor exposes read-only ZIP recovery with no direct source imports',()=>{
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  const ui=fs.readFileSync(path.join(root,'review-package-reader-ui.js'),'utf8');
  const source=fs.readFileSync(path.join(root,'review-package-reader.js'),'utf8');
  for(const id of ['open-review-zip','open-review-status',
    'recover-page-draft','recover-resource-draft'])
    assert.match(html,new RegExp('id="'+id+'"'));
  assert.match(html,/script defer src="review-package-reader\.js"/);
  assert.match(html,/script defer src="review-package-reader-ui\.js"/);
  assert.match(ui,/The original website files have NOT been checked or changed/);
  for(const item of [source,ui]){
    for(const forbidden of ['fetch(', 'XMLHttpRequest','localStorage.setItem',
      'writeFileSync(', 'update_ref(', 'create_commit(', 'GITHUB_TOKEN'])
      assert.equal(item.includes(forbidden),false,forbidden);
  }
});

test('a forged but correctly checksummed malformed page edit is not a verified restorable draft',async()=>{
  const files=unpackLocal(await bytes());
  const pageFile=files.find(f=>f.path===P);
  const page=JSON.parse(pageFile.content);
  page.files[0].edits={'T:100':{unexpected:'non-string value'}};
  pageFile.content=JSON.stringify(page)+'\\n';
  const manifestFile=files.find(f=>f.path===M);
  const manifest=JSON.parse(manifestFile.content);
  const expected=manifest.payloads.find(x=>x.path===P);
  expected.sha256=await writer.sha256(pageFile.content);
  expected.utf8Bytes=new TextEncoder().encode(pageFile.content).byteLength;
  manifestFile.content=JSON.stringify(manifest)+'\\n';
  const forged=await fromFiles(files);
  // All ZIP CRCs and declared SHA-256 bytes now agree, but the payload
  // still violates the source-checked editor's basic type contract.
  await assert.rejects(reader.inspect(forged,writer,review),/unsafe or corrupted/);
});
