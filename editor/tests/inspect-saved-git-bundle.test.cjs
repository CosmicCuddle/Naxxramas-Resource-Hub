'use strict';
/*
 * Disposable Git-only saved-bundle inspection. The synthetic repo is NOT
 * CosmicCuddle's real website; no backup is created for the owner or GitHub.
 */
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const cp=require('node:child_process'),crypto=require('node:crypto');
const {baseline}=require('../tools/rehearse-full-git-recovery.cjs');
const {saveBackup}=require('../tools/create-local-git-backup.cjs');
const {FORMAT,inspectSavedBackup}=require('../tools/inspect-saved-git-bundle.cjs');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
function git(repo,...args){
  const r=cp.spawnSync('git',args,{cwd:repo,encoding:'utf8',
    stdio:['ignore','pipe','pipe'],maxBuffer:1024*1024,timeout:60000});
  if(r.status!==0||r.error)throw Error('Synthetic fixture Git command failed.');
  return r.stdout.trim();
}
function fixture(callback){
  const work=fs.mkdtempSync(path.join(os.tmpdir(),'naxx-backup-recheck-fixture-'));
  fs.chmodSync(work,0o700);
  const source=path.join(work,'source');
  const output=path.join(work,'saved-review-history.bundle');
  try{
    git(work,'init','--quiet','--initial-branch=main',source);
    git(source,'config','user.name','Synthetic backup test');
    git(source,'config','user.email','test@invalid.example');
    fs.writeFileSync(path.join(source,'index.html'),'Fixture site loader\n');
    fs.writeFileSync(path.join(source,'example.txt'),'Original synthetic source\n');
    git(source,'add','.');
    git(source,'commit','--quiet','-m','synthetic original source');
    git(source,'switch','--quiet','-c','test-page');
    fs.writeFileSync(path.join(source,'example.txt'),'Changed synthetic content\n');
    git(source,'add','.');
    git(source,'commit','--quiet','-m','synthetic changed branch');
    git(source,'tag','-a','test-v2','-m','Synthetic annotated tag');
    git(source,'switch','--quiet','main');
    const baselineResult=baseline(source,{requireWebsite:false});
    const saved=saveBackup(source,output,{requireWebsite:false});
    const pins={
      expectedCommit:baselineResult.head,
      expectedTree:baselineResult.tree,
      expectedTrackedSha256:baselineResult.snapshot.fingerprintSha256,
      expectedBundleSha256:saved.bundleSha256
    };
    return callback({source,output,pins,saved,work,original:baselineResult});
  }finally{fs.rmSync(work,{recursive:true,force:true});}
}
test('separately pinned saved bundle is independently recovered without modifying package',()=>{
  fixture(({source,output,pins,original})=>{
    const before=fs.readFileSync(output),receipt=fs.readFileSync(output+'.receipt.json');
    const notice=fs.readFileSync(output+'.READ_ME_FIRST.txt');
    const result=inspectSavedBackup(source,output,pins,{requireWebsite:false});
    assert.equal(result.format,FORMAT);
    assert.equal(result.sourceCommit,original.head);
    assert.equal(result.sourceTree,original.tree);
    assert.equal(result.sourceTrackedSha256,original.snapshot.fingerprintSha256);
    assert.equal(result.savedBundleSha256,hash(before));
    assert.equal(result.trackedFilesVerified,2);
    assert.equal(result.existingBundleRestoredInDisposableCheckout,true);
    assert.equal(result.locallyFetchedGitHistoryAndTrackedFilesMatched,true);
    assert.equal(result.temporaryRestorationDeleted,true);
    assert.equal(result.savedBundleFilesPresentAtCheck,true);
    assert.equal(result.durableOwnerRetentionIndependentlyProven,false);
    assert.equal(result.externallyAuthenticatedGitHubSource,false);
    assert.equal(result.sourceLayoutApproved,false);
    assert.equal(result.canSave,false);
    assert.equal(result.canApply,false);
    assert.equal(result.canPush,false);
    assert.equal(result.canPublish,false);
    assert.equal(result.gitHubWrites,0);
    assert.equal(result.sourceFilesWritten,0);
    assert.equal(Object.isFrozen(result),true);
    assert.equal(fs.readFileSync(output).equals(before),true);
    assert.equal(fs.readFileSync(output+'.receipt.json').equals(receipt),true);
    assert.equal(fs.readFileSync(output+'.READ_ME_FIRST.txt').equals(notice),true);
  });
});
test('bad independently pinned identities or SHA refuse even a valid recovery bundle',()=>{
  fixture(({source,output,pins})=>{
    for(const altered of [
      {expectedCommit:'0'.repeat(40)},
      {expectedTree:'1'.repeat(40)},
      {expectedTrackedSha256:'2'.repeat(64)},
      {expectedBundleSha256:'3'.repeat(64)}
    ]){
      assert.throws(()=>inspectSavedBackup(source,output,{...pins,...altered},
        {requireWebsite:false}));
    }
    assert.throws(()=>inspectSavedBackup(source,output,{},{
      requireWebsite:false}),/Independently supplied/);
    assert.throws(()=>inspectSavedBackup(source,output,{...pins,ownerApproved:true},
      {requireWebsite:false}),/Independently supplied/);
  });
});
test('altered saved bundle is refused, without restoring or deleting the retained file',()=>{
  fixture(({source,output,pins})=>{
    const bytes=fs.readFileSync(output);
    fs.writeFileSync(output,Buffer.concat([bytes,Buffer.from('tampered')]));
    assert.throws(()=>inspectSavedBackup(source,output,pins,
      {requireWebsite:false}),/receipt disagrees|bundle bytes/i);
    assert.equal(fs.existsSync(output),true);
  });
});
test('missing receipt, modified private notice and extra untrusted fields refuse inspection',()=>{
  fixture(({source,output,pins})=>{
    const receiptFile=output+'.receipt.json',noticeFile=output+'.READ_ME_FIRST.txt';
    const receipt=fs.readFileSync(receiptFile),notice=fs.readFileSync(noticeFile);
    try{
      fs.unlinkSync(receiptFile);
      assert.throws(()=>inspectSavedBackup(source,output,pins,
        {requireWebsite:false}));
      fs.writeFileSync(receiptFile,receipt,{mode:0o600});
      fs.writeFileSync(noticeFile,Buffer.concat([notice,Buffer.from('MISSING WARNING')]));
      assert.throws(()=>inspectSavedBackup(source,output,pins,
        {requireWebsite:false}),/instructions differ/);
      fs.writeFileSync(noticeFile,notice,{mode:0o600});
      const modified=JSON.parse(receipt.toString('utf8'));
      modified.falseOwnerApproval=true;
      fs.writeFileSync(receiptFile,JSON.stringify(modified,null,2)+'\n');
      assert.throws(()=>inspectSavedBackup(source,output,pins,
        {requireWebsite:false}),/receipt disagrees/);
    }finally{
      fs.writeFileSync(receiptFile,receipt);
      fs.writeFileSync(noticeFile,notice);
    }
  });
});
test('false fetched-ref claim, wrong commit and incomplete restore evidence are blocked',()=>{
  fixture(({source,output,pins})=>{
    const receiptFile=output+'.receipt.json',original=fs.readFileSync(receiptFile);
    const record=JSON.parse(original.toString('utf8'));
    try{
      record.fetchedRefs[0].id='f'.repeat(40);
      fs.writeFileSync(receiptFile,JSON.stringify(record,null,2)+'\n');
      assert.throws(()=>inspectSavedBackup(source,output,pins,
        {requireWebsite:false}),/ref receipt differs/);
      record.fetchedRefs[0].id=JSON.parse(original.toString('utf8')).fetchedRefs[0].id;
      record.independentRestoreVerified=false;
      fs.writeFileSync(receiptFile,JSON.stringify(record,null,2)+'\n');
      assert.throws(()=>inspectSavedBackup(source,output,pins,
        {requireWebsite:false}),/receipt disagrees/);
    }finally{fs.writeFileSync(receiptFile,original);}
  });
});
test('dirty source and unsafe sidecar symlinks are refused',()=>{
  fixture(({source,output,pins})=>{
    fs.writeFileSync(path.join(source,'example.txt'),'Dirty uncommitted change\n');
    assert.throws(()=>inspectSavedBackup(source,output,pins,
      {requireWebsite:false}),/modified or untracked/);
    git(source,'restore','example.txt');
    if(process.platform!=='win32'){
      const noticeFile=output+'.READ_ME_FIRST.txt';
      fs.unlinkSync(noticeFile);
      fs.symlinkSync(path.basename(output),noticeFile);
      assert.throws(()=>inspectSavedBackup(source,output,pins,
        {requireWebsite:false}),/unsafe|private saved recovery file/i);
    }
  });
});
test('read-only inspection path has no mutating Git refs, network or external publisher',()=>{
  const src=fs.readFileSync(path.resolve(__dirname,'..','tools',
    'inspect-saved-git-bundle.cjs'),'utf8');
  for(const forbidden of [
    'fetch(', 'https.request(', 'XMLHttpRequest','GITHUB_TOKEN',
    'git push','git commit','update-ref','writeFileSync(',
    'createExclusive(', 'saveBackup(', 'gitHubWrites:1',
    'canPublish:true', 'canSave:true'
  ])assert.equal(src.includes(forbidden),false,forbidden);
  assert.match(src,/rmSync\(temporary/);
  assert.match(src,/durableOwnerRetentionIndependentlyProven:false/);
  assert.match(src,/externallyAuthenticatedGitHubSource:false/);
});

test('extra Git ref hidden in otherwise checksum-consistent saved bundle is refused',()=>{
  fixture(({source,output,pins})=>{
    // Work only in this throwaway synthetic Git repository.
    git(source,'branch','unexpected-extra-ref','test-page');
    const made=cp.spawnSync('git',['-C',source,'bundle','create',
      output,'--all','HEAD'],{encoding:'utf8',stdio:['ignore','pipe','pipe']});
    assert.equal(made.status,0,'Synthetic bundle with extra ref must be created');
    git(source,'branch','-D','unexpected-extra-ref');
    const receiptName=output+'.receipt.json';
    const noticeName=output+'.READ_ME_FIRST.txt';
    const saved=JSON.parse(fs.readFileSync(receiptName,'utf8'));
    saved.bundleBytes=fs.statSync(output).size;
    saved.bundleSha256=hash(fs.readFileSync(output));
    fs.writeFileSync(receiptName,JSON.stringify(saved,null,2)+'\n');
    const {instructions}=require('../tools/create-local-git-backup.cjs');
    fs.writeFileSync(noticeName,instructions(saved));
    assert.throws(()=>inspectSavedBackup(source,output,{
      ...pins,expectedBundleSha256:saved.bundleSha256
    },{requireWebsite:false}),/unexpected or changed refs/);
  });
});

test('canonical receipt validation rejects duplicate JSON keys and ambiguous encodings',()=>{
  fixture(({source,output,pins})=>{
    const file=output+'.receipt.json';
    const original=fs.readFileSync(file);
    try{
      const canonical=original.toString('utf8');
      const duplicate=canonical.trimEnd().slice(0,-1)+
        ',"sourceCommit":'+JSON.stringify(pins.expectedCommit)+'}\n';
      fs.writeFileSync(file,duplicate);
      assert.throws(()=>inspectSavedBackup(source,output,pins,
        {requireWebsite:false}),/not canonical JSON/);
      fs.writeFileSync(file,JSON.stringify(JSON.parse(canonical))+'\n');
      assert.throws(()=>inspectSavedBackup(source,output,pins,
        {requireWebsite:false}),/not canonical JSON/);
      fs.writeFileSync(file,canonical.slice(0,-1));
      assert.throws(()=>inspectSavedBackup(source,output,pins,
        {requireWebsite:false}),/not canonical JSON/);
    }finally{fs.writeFileSync(file,original);}
  });
});
test('extra Git notes ref is refused even when branches and tags all match',()=>{
  fixture(({source,output,pins})=>{
    // All state is synthetic and disposable, never the original website.
    git(source,'update-ref','refs/notes/injected-test','refs/heads/main');
    const made=cp.spawnSync('git',['-C',source,'bundle','create',
      output,'--all','HEAD'],{encoding:'utf8',stdio:['ignore','pipe','pipe']});
    assert.equal(made.status,0);
    git(source,'update-ref','-d','refs/notes/injected-test');
    const receiptName=output+'.receipt.json';
    const saved=JSON.parse(fs.readFileSync(receiptName,'utf8'));
    saved.bundleBytes=fs.statSync(output).size;
    saved.bundleSha256=hash(fs.readFileSync(output));
    fs.writeFileSync(receiptName,JSON.stringify(saved,null,2)+'\n');
    const {instructions}=require('../tools/create-local-git-backup.cjs');
    fs.writeFileSync(output+'.READ_ME_FIRST.txt',instructions(saved));
    assert.throws(()=>inspectSavedBackup(source,output,{
      ...pins,expectedBundleSha256:saved.bundleSha256
    },{requireWebsite:false}),/unexpected or changed refs/);
  });
});
