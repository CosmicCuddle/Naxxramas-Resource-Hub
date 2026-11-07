'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const preflight=require('../restore-preflight-core.js');
const checker=require('../restore-folder-check-core.js');
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const rootName='synthetic-private-copy';
function fakeFile(relative,value){
  const bytes=Buffer.isBuffer(value)?Buffer.from(value):Buffer.from(value,'utf8');
  return {
    webkitRelativePath:rootName+'/'+relative,
    size:bytes.length,
    async arrayBuffer(){
      return Uint8Array.from(bytes).buffer;
    }
  };
}
function fixtures(){
  const files=[],resources=[];
  for(let i=0;i<checker.COUNT;i++){
    const path=checker.expectedPath(i),content=Buffer.from('Private test fragment '+i);
    resources.push({index:i,path,sha256:hash(content)});
    files.push(fakeFile(path,content));
  }
  const manifest={
    format:preflight.MANIFEST,privateOnly:true,publishable:false,deployable:false,
    originalSha256:preflight.BASE,revision:0,parentSha256:null,
    sourceSha256:preflight.BASE,sourceBytes:30976969,resources
  };
  function draft(){
    return {format:preflight.DRAFT,sourceBaselineSha256:preflight.BASE,
      revision:0,sourceSha256:preflight.BASE,
      changes:[{index:0,expectedSha256:resources[0].sha256,
        title:'Private test title that must not be shown'}]};
  }
  files.unshift(fakeFile(checker.MANIFEST_PATH,JSON.stringify(manifest)));
  return {files,manifest,draft:draft()};
}
function withManifest(x){
  x.files[0]=fakeFile(checker.MANIFEST_PATH,JSON.stringify(x.manifest));
  return x;
}
function draftFile(draft){
  return {size:Buffer.byteLength(JSON.stringify(draft)),arrayBuffer:async()=>{
    return Uint8Array.from(Buffer.from(JSON.stringify(draft))).buffer;
  }};
}
test('all 414 physical fragment SHA-256 values are verified before a draft can be considered',async()=>{
  const {files,manifest,draft}=fixtures();
  const got=await checker.verifySelectedFolder(files,draft);
  assert.equal(got.code,'fragments-checked');
  assert.equal(got.filesVerified,415);
  assert.equal(got.resourceFilesVerified,414);
  assert.equal(got.folderSha256Checked,true);
  assert.equal(got.fullHtmlReconstructed,false);
  assert.equal(got.authenticatedManifest,false);
  assert.equal(got.readyForPublication,false);
  assert.equal(got.canApply,false);
  assert.equal(got.canPublish,false);
  assert.equal(got.canAutoMerge,false);
  assert.equal(got.readOnly,true);
  assert.equal(got.latestRevision,manifest.revision);
  assert.equal(Object.isFrozen(got),true);
  assert.ok(!JSON.stringify(got).includes(draft.changes[0].title));
});
test('real browser File-shaped data and matching experimental draft work together',async()=>{
  const {files,draft}=fixtures();
  const got=await checker.verifyWithDraftFile(files,draftFile(draft));
  assert.equal(got.code,'fragments-checked');
  assert.equal(got.resourceFilesVerified,414);
});
test('outdated draft is blocked after all selected physical source checks pass',async()=>{
  const x=fixtures();
  x.manifest.revision=1;
  x.manifest.parentSha256=preflight.BASE;
  x.manifest.sourceSha256='a'.repeat(64);
  withManifest(x);
  const got=await checker.verifySelectedFolder(x.files,x.draft);
  assert.equal(got.code,'stale');
  assert.equal(got.resourceFilesVerified,414);
  assert.equal(got.canApply,false);
});
test('a version-matching draft with mismatched expected resource SHA is refused',async()=>{
  const x=fixtures();
  x.draft.changes[0].expectedSha256='b'.repeat(64);
  const got=await checker.verifySelectedFolder(x.files,x.draft);
  assert.equal(got.code,'record-conflict');
  assert.equal(got.canApply,false);
  assert.equal(got.resourceFilesVerified,414);
});
test('changed physical resource bytes and swapped fragments fail closed even if JSON looks fine',async()=>{
  const x=fixtures();
  x.files[10]=fakeFile(checker.expectedPath(9),'a rewritten physical record');
  assert.equal((await checker.verifySelectedFolder(x.files,x.draft)).code,'fragment-mismatch');
  const y=fixtures();
  const a=y.files[1],b=y.files[2];
  y.files[1]={...b,webkitRelativePath:a.webkitRelativePath};
  y.files[2]={...a,webkitRelativePath:b.webkitRelativePath};
  assert.equal((await checker.verifySelectedFolder(y.files,y.draft)).code,'fragment-mismatch');
});
test('all 415 paths are required, duplicates extras and traversal are rejected before reading file bodies',async()=>{
  const x=fixtures();
  assert.equal((await checker.verifySelectedFolder(x.files.slice(1),x.draft)).code,'invalid-folder');
  const extra=x.files.concat(fakeFile('unexpected.txt','extra'));
  assert.equal((await checker.verifySelectedFolder(extra,x.draft)).code,'invalid-folder');
  const bad=x.files.slice();
  bad[5]={...bad[5],webkitRelativePath:bad[6].webkitRelativePath};
  assert.equal((await checker.verifySelectedFolder(bad,x.draft)).code,'invalid-folder');
  const traversal=x.files.slice();
  traversal[5]={...traversal[5],webkitRelativePath:rootName+'/../'+checker.expectedPath(4)};
  assert.equal((await checker.verifySelectedFolder(traversal,x.draft)).code,'invalid-folder');
  const wrongRoot=x.files.slice();
  wrongRoot[7]={...wrongRoot[7],webkitRelativePath:'different-root/'+checker.expectedPath(6)};
  assert.equal((await checker.verifySelectedFolder(wrongRoot,x.draft)).code,'invalid-folder');
  const noPaths=x.files.map(f=>({...f,webkitRelativePath:''}));
  assert.equal((await checker.verifySelectedFolder(noPaths,x.draft)).code,'invalid-folder');
});
test('empty, oversized and lying file-size entries fail closed',async()=>{
  const x=fixtures();
  x.files[7]={...x.files[7],size:0};
  assert.equal((await checker.verifySelectedFolder(x.files,x.draft)).code,'oversize');
  const y=fixtures();
  y.files[8]={...y.files[8],size:1000001};
  assert.equal((await checker.verifySelectedFolder(y.files,y.draft)).code,'oversize');
  const z=fixtures();
  z.files[9]={...z.files[9],size:3,arrayBuffer:async()=>new Uint8Array(1000001).buffer};
  assert.equal((await checker.verifySelectedFolder(z.files,z.draft)).code,'oversize');
});
test('the manifest must be complete, revision-safe and valid even when fragment files are intact',async()=>{
  const x=fixtures();
  x.manifest.resources[41].path='../unsafe';
  withManifest(x);
  assert.equal((await checker.verifySelectedFolder(x.files,x.draft)).code,'invalid-source');
  const y=fixtures();
  y.files[0]=fakeFile(checker.MANIFEST_PATH,'{');
  assert.equal((await checker.verifySelectedFolder(y.files,y.draft)).code,'read-failed');
});
test('invalid draft and unsupported previous resource v2 do not bypass file verification',async()=>{
  const x=fixtures();
  const old={format:'naxx-local-resource-draft-v2',baselineSha256:preflight.BASE,
    changes:[{index:0,title:'Should remain unmodified'}]};
  assert.equal((await checker.verifySelectedFolder(x.files,old)).code,'invalid-draft');
  assert.equal((await checker.verifyWithDraftFile(x.files,draftFile(old))).code,'invalid-draft');
  assert.equal((await checker.verifyWithDraftFile(x.files,{size:0})).code,'invalid-draft');
});
test('unreadable selected content fails closed with no source text in result',async()=>{
  const x=fixtures();
  x.files[100]={...x.files[100],arrayBuffer:async()=>{throw Error('PRIVATE DATA SHOULD NOT APPEAR');}};
  const got=await checker.verifySelectedFolder(x.files,x.draft);
  assert.equal(got.code,'read-failed');
  assert.ok(!JSON.stringify(got).includes('PRIVATE DATA'));
});
test('standalone folder UI remains inert, accessible, offline and source-editor independent',()=>{
  const base=path.resolve(__dirname,'..');
  const html=fs.readFileSync(path.join(base,'restore-folder-check.html'),'utf8');
  const js=fs.readFileSync(path.join(base,'restore-folder-check.js'),'utf8');
  assert.match(html,/webkitdirectory directory multiple/);
  assert.match(html,/id="source-folder"/);
  assert.match(html,/id="versioned-draft"/);
  assert.match(html,/connect-src 'none'/);
  assert.match(html,/form-action 'none'/);
  assert.match(html,/aria-live="polite"/);
  assert.match(html,/does <strong>not<\/strong> reconstruct/);
  for(const x of ['<form','<iframe','type="submit"'])assert.ok(!html.includes(x));
  for(const x of ['fetch(', 'sendBeacon(', 'localStorage.', 'sessionStorage.',
    '.innerHTML=', '.submit(', '.download=', 'XMLHttpRequest', 'indexedDB']){
    assert.ok(!js.includes(x),'Unexpected persistence or network side effect: '+x);
  }
  assert.doesNotThrow(()=>new Function(js));
});
