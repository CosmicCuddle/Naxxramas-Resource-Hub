'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const cp=require('node:child_process');
const {saveBackup}=require('../tools/create-local-git-backup.cjs');
const {FORMAT,resolvedBackupPath,verifyRetainedBackup}=
  require('../tools/verify-retained-backup.cjs');
function git(cwd,...args){
  const p=cp.spawnSync('git',args,{
    cwd,encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:30000
  });
  if(p.status!==0||p.error)throw Error('Private synthetic Git setup failed.');
  return p.stdout.trim();
}
function fixture(callback){
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'naxx-existing-backup-test-'));
  fs.chmodSync(tmp,0o700);
  const checkout=path.join(tmp,'source'),privateDir=path.join(tmp,'private');
  try{
    fs.mkdirSync(privateDir,{mode:0o700});
    git(tmp,'init','--quiet','--initial-branch=main',checkout);
    git(checkout,'config','user.name','Private offline test');
    git(checkout,'config','user.email','private-test@example.invalid');
    fs.writeFileSync(path.join(checkout,'index.html'),'fictional root loader');
    git(checkout,'add','.');git(checkout,'commit','-q','-m','initial');
    git(checkout,'switch','-q','-c','secondary');
    fs.writeFileSync(path.join(checkout,'secondary.txt'),'another branch');
    git(checkout,'add','.');git(checkout,'commit','-q','-m','secondary');
    git(checkout,'tag','-a','test-tag','-m','private synthetic');
    git(checkout,'switch','-q','main');
    const backup=path.join(privateDir,'owner-created-private-history.bundle');
    saveBackup(checkout,backup,{requireWebsite:false});
    return callback({checkout,backup,privateDir,head:git(checkout,'rev-parse','HEAD')});
  }finally{fs.rmSync(tmp,{force:true,recursive:true});}
}
test('existing bundle and receipt are matched to original Git commit, freshly restored, never overwritten or sent',()=>{
  fixture(({checkout,backup,head})=>{
    const before=fs.readFileSync(backup);
    const record=verifyRetainedBackup(checkout,backup,{requireWebsite:false});
    assert.equal(record.format,FORMAT);
    assert.equal(record.verifiedOriginalCommit,head);
    assert.equal(record.verifiedFetchedRefs,3);
    assert.equal(record.verifiedReachableCommits,2);
    assert.equal(record.existingBundleAndSidecarsIntact,true);
    assert.equal(record.restoredAgainFromExistingBundle,true);
    assert.equal(record.exactGitCheckoutBound,true);
    assert.equal(record.localBundleReadOnly,true);
    assert.equal(record.originalCheckoutUnchanged,true);
    assert.equal(record.ownerOffMachineCopyConfirmed,false);
    assert.equal(record.wholeServerOrGitHubSettingsBackup,false);
    assert.equal(record.realSaveEnabled,false);
    assert.equal(record.githubWrites,0);
    assert.ok(fs.readFileSync(backup).equals(before));
    assert.equal(git(checkout,'status','--porcelain'),'');
  });
});
test('damaged receipt, changed bundle and missing companion files always refuse later verification',()=>{
  fixture(({checkout,backup})=>{
    const receipt=backup+'.receipt.json';
    const previous=fs.readFileSync(receipt);
    fs.writeFileSync(receipt,Buffer.from('{"format":"forged"}'),{mode:0o600});
    assert.throws(()=>verifyRetainedBackup(checkout,backup,{requireWebsite:false}),/receipt|bundle/);
    fs.writeFileSync(receipt,previous,{mode:0o600});
    fs.appendFileSync(backup,'damage');
    assert.throws(()=>verifyRetainedBackup(checkout,backup,{requireWebsite:false}),/receipt|bundle/);
    fs.rmSync(receipt);
    assert.throws(()=>verifyRetainedBackup(checkout,backup,{requireWebsite:false}));
  });
});
test('a retained backup from an older commit fails after source repository advances',()=>{
  fixture(({checkout,backup})=>{
    fs.writeFileSync(path.join(checkout,'index.html'),'new and unbacked source');
    git(checkout,'add','.');git(checkout,'commit','-q','-m','new');
    assert.throws(()=>verifyRetainedBackup(checkout,backup,{requireWebsite:false}),/exact reviewed checkout|source|commit|checkout|bundle/);
  });
});
test('backup must be an absolute regular file outside source checkout, never a symlink into source',()=>{
  fixture(({checkout,backup})=>{
    assert.equal(resolvedBackupPath(checkout,backup),backup);
    assert.throws(()=>resolvedBackupPath(checkout,'relative.bundle'),/absolute/);
    const local=path.join(checkout,'backup.bundle');
    fs.writeFileSync(local,'not a backup');
    assert.throws(()=>resolvedBackupPath(checkout,local),/inside the website repository/);
  });
});
test('verification module does not contain GitHub write APIs or saved credential use',()=>{
  const text=fs.readFileSync(path.join(__dirname,'..','tools',
    'verify-retained-backup.cjs'),'utf8');
  for(const prohibited of [
    'fetch(', 'node:https', 'Authorization:',
    'GITHUB_TOKEN','git push','updateRefs(', 'process.env.'
  ])assert.equal(text.includes(prohibited),false,prohibited);
  assert.match(text,/verifyRecovery/);
  assert.match(text,/verifyBackupBinding/);
});

test('symlinked backup file and redirected backup folder are refused before restore',()=>{
  if(process.platform==='win32')return;
  fixture(({checkout,backup,privateDir})=>{
    const link=path.join(privateDir,'symlink.bundle');
    fs.symlinkSync(backup,link);
    assert.throws(()=>resolvedBackupPath(checkout,link),/symlink/);
    assert.throws(()=>verifyRetainedBackup(checkout,link,{requireWebsite:false}),/symlink/);
    const alias=path.join(path.dirname(privateDir),'folder-alias');
    fs.symlinkSync(privateDir,alias,'dir');
    const moved=path.join(alias,path.basename(backup));
    assert.throws(()=>resolvedBackupPath(checkout,moved),/symlink/);
    assert.throws(()=>verifyRetainedBackup(checkout,moved,{requireWebsite:false}),/symlink/);
  });
});
