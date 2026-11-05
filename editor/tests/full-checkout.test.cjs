'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {inventory,inspectCheckout,safeRel}=require('../tools/audit-full-checkout.cjs');
const checkout=path.resolve(__dirname,'..','..');
function withMiniTree(fn){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'naxx-inventory-test-'));
  fs.chmodSync(root,0o700);
  try{
    fs.copyFileSync(path.join(checkout,'site-content.html'),path.join(root,'site-content.html'));
    fs.writeFileSync(path.join(root,'index.html'),'loader');
    fs.mkdirSync(path.join(root,'rules'));
    fs.writeFileSync(path.join(root,'rules/content.html'),'private rule test');
    return fn(root);
  }finally{fs.rmSync(root,{recursive:true,force:true});}
}
test('tracked-path safety refuses traversal, absolute paths, backslashes and .git',()=>{
  for(const bad of ['','../index.html','x/../y','/etc/shadow','x//y',
    'x\\y','./index.html','.git/config','.git','x/\0y'])
    assert.equal(safeRel(bad),false);
  for(const good of ['index.html','site-content.html','rules/content.html',
    '.github/workflows/ci.yml','content/legacy/resources/0001.fragment'])
    assert.equal(safeRel(good),true);
});
test('whole tree inventory records all tracked files without printing contents or filenames',()=>{
  withMiniTree(root=>{
    const report=inventory(root,['rules/content.html','index.html','site-content.html']);
    assert.equal(report.completeTrackedListInspected,true);
    assert.equal(report.originalSiteSourceVerified,true);
    assert.equal(report.trackedFiles,3);
    assert.equal(report.backedUp,false);
    assert.equal(report.trackedNamesOrContentPrinted,false);
    assert.ok(report.trackedBytes>30976969);
    assert.match(report.fingerprintSha256,/^[a-f0-9]{64}$/);
    assert.equal(JSON.stringify(report).includes('private rule test'),false);
    assert.equal(JSON.stringify(report).includes('rules/content.html'),false);
    assert.deepEqual(inventory(root,['index.html','rules/content.html','site-content.html']),report);
  });
});
test('full inventory rejects missing, duplicate and stale source paths',()=>{
  withMiniTree(root=>{
    assert.throws(()=>inventory(root,['site-content.html','site-content.html','index.html']),/duplicate/);
    assert.throws(()=>inventory(root,['site-content.html','index.html','missing.txt']),/ENOENT/);
    assert.throws(()=>inventory(root,['site-content.html']),/loader/);
    assert.throws(()=>inventory(root,['index.html']),/original website source/);
    fs.appendFileSync(path.join(root,'site-content.html'),'!');
    assert.throws(()=>inventory(root,['site-content.html','index.html']),/protected source baseline/);
  });
});
test('symlinked tracked files are rejected rather than followed',()=>{
  withMiniTree(root=>{
    fs.symlinkSync(path.join(root,'index.html'),path.join(root,'other.html'));
    assert.throws(()=>inventory(root,['site-content.html','index.html','other.html']),/regular file/);
  });
});
test('complete connected Git checkout is clean, has its original source and reports no backup created',()=>{
  const data=inspectCheckout(checkout);
  assert.ok(data.trackedFiles>3);
  assert.ok(data.trackedBytes>30976969);
  assert.equal(data.checkoutMatchesCommittedTrackedFiles,true);
  assert.equal(data.originalSiteSourceVerified,true);
  assert.equal(data.gitHistoryBackedUp,false);
  assert.equal(data.archiveGenerated,false);
  assert.equal(data.releaseAuthorised,false);
  assert.match(data.verifiedCommit,/^[a-f0-9]{40,64}$/);
});
