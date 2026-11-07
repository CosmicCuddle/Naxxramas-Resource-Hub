'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const cp=require('node:child_process'),crypto=require('node:crypto');
const {saveBackup,safeOutput,instructions}=require('../tools/create-local-git-backup.cjs');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function git(root,...args){
  const p=cp.spawnSync('git',args,{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']});
  if(p.status!==0)throw Error('Synthetic backup fixture Git failed.');
  return p.stdout.trim();
}
function fixture(fn){
  const work=fs.mkdtempSync(path.join(os.tmpdir(),'naxx-git-offline-backup-test-'));
  fs.chmodSync(work,0o700);
  const root=path.join(work,'source'),privateFolder=path.join(work,'private');
  try{
    fs.mkdirSync(privateFolder,{mode:0o700});
    git(work,'init','--quiet','--initial-branch=main',root);
    git(root,'config','user.name','offline backup fixture');
    git(root,'config','user.email','synthetic@example.invalid');
    fs.writeFileSync(path.join(root,'index.html'),'synthetic loader');
    git(root,'add','.');git(root,'commit','--quiet','-m','first commit');
    git(root,'switch','--quiet','-c','secondary');
    fs.writeFileSync(path.join(root,'README.md'),'tracked second branch');
    git(root,'add','.');git(root,'commit','--quiet','-m','second branch');
    git(root,'tag','-a','test-tag','-m','fixture tag');
    git(root,'switch','--quiet','main');
    return fn({root,work,privateFolder});
  }finally{fs.rmSync(work,{recursive:true,force:true});}
}
test('explicit private output creates a valid Git bundle, manifest, warning and double-verified restore',()=>{
  fixture(({root,privateFolder})=>{
    const filename=path.join(privateFolder,'offline-history.bundle');
    const report=saveBackup(root,filename,{requireWebsite:false});
    assert.equal(report.bundleAndTwoSidecarsCreated,true);
    assert.equal(report.independentlyRecoveredTwice,true);
    assert.equal(report.githubWritten,false);
    assert.equal(report.serverModified,false);
    assert.equal(report.completeServerBackup,false);
    assert.equal(report.reachableCommits,2);
    assert.equal(report.localFetchedRefs,3);
    assert.equal(report.trackedFiles,1);
    assert.equal(report.sourceCommit,git(root,'rev-parse','HEAD'));
    assert.equal(report.sourceTree,git(root,'rev-parse','HEAD^{tree}'));
    const files=[filename,filename+'.receipt.json',filename+'.READ_ME_FIRST.txt'];
    assert.ok(files.every(file=>fs.existsSync(file)));
    const bundle=fs.readFileSync(filename);
    assert.equal(report.bundleSha256,sha(bundle));
    const receipt=JSON.parse(fs.readFileSync(files[1],'utf8'));
    assert.equal(receipt.bundleSha256,sha(bundle));
    assert.equal(receipt.fetchedRefs.length,3);
    assert.equal(receipt.localFetchedRefsOnly,true);
    assert.equal(receipt.publishable,false);
    assert.equal(receipt.independentRestoreVerified,true);
    assert.equal(receipt.fullServerBackup,false);
    const warning=fs.readFileSync(files[2],'utf8');
    assert.match(warning,/KEEP THIS .bundle AND BOTH SIDECARS PRIVATE/);
    assert.match(warning,/THIS IS NOT A WHOLE-SERVER OR GITHUB-SERVICE BACKUP/);
    assert.match(warning,/git clone --mirror/);
    for(const file of files){
      if(process.platform!=='win32')assert.equal(fs.statSync(file).mode&0o077,0);
    }
    assert.throws(()=>saveBackup(root,filename,{requireWebsite:false}),/already exists/);
    assert.equal(fs.readFileSync(files[1],'utf8').includes('remote.origin.url'),false);
  });
});
test('repo-internal paths, symlink aliases, relative names and pre-existing receipts are refused',()=>{
  fixture(({root,privateFolder})=>{
    assert.throws(()=>safeOutput('backup.bundle',root),/absolute private/);
    assert.throws(()=>safeOutput(path.join(root,'unwanted.bundle'),root),/outside the Git repository/);
    assert.throws(()=>safeOutput(path.join(privateFolder,'not-a-zip.zip'),root),/absolute private/);
    const file=path.join(privateFolder,'preexisting.bundle');
    fs.writeFileSync(file+'.receipt.json','placeholder');
    assert.throws(()=>safeOutput(file,root),/already exists/);
    if(process.platform!=='win32'){
      const alias=path.join(privateFolder,'inside');
      fs.symlinkSync(root,alias,'dir');
      assert.throws(()=>safeOutput(path.join(alias,'unsafe.bundle'),root),/outside the Git repository/);
    }
  });
});
test('offline bundle save refuses dirty working copy and never creates a partial receipt',()=>{
  fixture(({root,privateFolder})=>{
    const name=path.join(privateFolder,'should-not-exist.bundle');
    fs.writeFileSync(path.join(root,'index.html'),'not committed');
    assert.throws(()=>saveBackup(root,name,{requireWebsite:false}),/modified or untracked/);
    assert.equal(fs.existsSync(name),false);
    assert.equal(fs.existsSync(name+'.receipt.json'),false);
    assert.equal(fs.existsSync(name+'.READ_ME_FIRST.txt'),false);
  });
});
test('help notice never claims GitHub service state or external files are backed up',()=>{
  const warning=instructions({
    sourceCommit:'1'.repeat(40),sourceTree:'2'.repeat(40),
    bundleSha256:'3'.repeat(64),bundleBytes:123
  });
  assert.match(warning,/Excluded: unpublished\/unfetched remote refs, GitHub issues\/settings/);
  assert.match(warning,/Git LFS objects, ignored\/untracked files/);
  assert.match(warning,/CosmicCuddle approval before any replacement/);
});
