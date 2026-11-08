'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const cp=require('node:child_process'),crypto=require('node:crypto');
const {saveBackup}=require('../tools/create-local-git-backup.cjs');
const {FORMAT,SEED,rehearsePrivateSandboxSeed}=
  require('../tools/rehearse-private-sandbox-branch-seed.cjs');
const SOURCE=path.resolve(__dirname,'..','..');
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
function git(cwd,...args){
  const p=cp.spawnSync('git',args,{
    cwd,encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:45000
  });
  if(p.status!==0||p.error)throw Error('Local Git test fixture failed.');
  return p.stdout.trim();
}
function fixture(callback){
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'naxx-private-seed-fixture-'));
  fs.chmodSync(tmp,0o700);
  const original=path.join(tmp,'original'),saved=path.join(tmp,'offline');
  try{
    fs.mkdirSync(saved,{mode:0o700});
    git(tmp,'init','--quiet','--initial-branch=main',original);
    git(original,'config','user.name','Offline sandbox seed test');
    git(original,'config','user.email','seed@example.invalid');
    fs.writeFileSync(path.join(original,'index.html'),'Private original loader');
    git(original,'add','.');git(original,'commit','-qm','first');
    const first=git(original,'rev-parse','HEAD');
    fs.writeFileSync(path.join(original,'site-content.html'),'Original fictional resources');
    git(original,'add','.');git(original,'commit','-qm','second');
    const second=git(original,'rev-parse','HEAD');
    git(original,'switch','-qc','old-private-history');
    fs.writeFileSync(path.join(original,'unrelated.txt'),'Do not copy unrelated branch');
    git(original,'add','.');git(original,'commit','-qm','unrelated branch');
    git(original,'tag','-a','private-history-tag','-m','non-seed tag');
    git(original,'switch','-q','main');
    const bundle=path.join(saved,'owner-private-history.bundle');
    saveBackup(original,bundle,{requireWebsite:false});
    return callback({original,bundle,first,second,saved});
  }finally{fs.rmSync(tmp,{force:true,recursive:true});}
}
const settings={testOnly:true,sourceLayoutApproved:false,
  githubWritesApproved:false,productionRepoWriteAllowed:false,
  requireWebsite:false};
test('retained original history seeds exactly one isolated editor-saves ref; never main/tag or production',()=>{
  fixture(({original,bundle,first,second})=>{
    const before=git(original,'status','--porcelain');
    const bytes=fs.readFileSync(bundle);
    const receipt=rehearsePrivateSandboxSeed(original,bundle,settings);
    assert.equal(receipt.format,FORMAT);
    assert.equal(receipt.originalCommitVerified,second);
    assert.equal(receipt.importedAncestorCommits,2);
    assert.equal(receipt.originalTrackedFilesVerified,2);
    assert.equal(receipt.originalTrackedSourceFingerprintMatched,true);
    assert.equal(receipt.onlyEditorSavesTestRefCreated,true);
    assert.equal(receipt.noMainOrTagRefCreated,true);
    assert.equal(receipt.originalWebsiteUnmodified,true);
    assert.equal(receipt.backupLeftIntact,true);
    assert.equal(receipt.fullFetchedRefsStayedInPrivateBundle,true);
    assert.equal(receipt.realGitHubWrites,0);
    assert.equal(receipt.realSandboxGitHubImportAuthorized,false);
    assert.equal(receipt.ownerOffMachineBackupConfirmed,false);
    assert.equal(receipt.publishEnabled,false);
    assert.equal(git(original,'rev-parse','main'),second);
    assert.equal(git(original,'rev-parse','HEAD~1'),first);
    assert.equal(git(original,'status','--porcelain'),before);
    assert.ok(fs.readFileSync(bundle).equals(bytes));
    assert.equal(SEED,'refs/heads/editor-saves/original-seed');
  });
});
test('stale source cannot reuse a retained bundle from a prior commit',()=>{
  fixture(({original,bundle})=>{
    fs.writeFileSync(path.join(original,'index.html'),'Different original');
    git(original,'add','.');git(original,'commit','-qm','new source');
    assert.throws(()=>rehearsePrivateSandboxSeed(original,bundle,settings),
      /backup|bundle|exact reviewed checkout/);
  });
});
test('damaged backup or a missing original sidecar refuses import without touching source',()=>{
  fixture(({original,bundle})=>{
    fs.appendFileSync(bundle,'unsafe');
    assert.throws(()=>rehearsePrivateSandboxSeed(original,bundle,settings));
    assert.equal(git(original,'status','--porcelain'),'');
  });
});
test('only an explicitly disabled production write and unapproved source layout permit rehearsal',()=>{
  fixture(({original,bundle})=>{
    for(const changed of [
      {testOnly:false},{sourceLayoutApproved:true},
      {githubWritesApproved:true},{productionRepoWriteAllowed:true},
      {testOnly:null}
    ])assert.throws(()=>rehearsePrivateSandboxSeed(
      original,bundle,{...settings,...changed}
    ),/test-only/);
  });
});
test('actual original website can be reconstructed from its retained Git-history backup in a disposable branch',()=>{
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'naxx-original-site-private-seed-'));
  fs.chmodSync(temp,0o700);
  try{
    const bundle=path.join(temp,'private-original-site.bundle');
    const original=fs.readFileSync(path.join(SOURCE,'site-content.html'));
    assert.equal(original.length,30976969);
    assert.equal(sha(original),
      '34455f6d901c538e2491a8c16681692e4c02d918b1984d7d0ba081aacb1049e8');
    const saved=saveBackup(SOURCE,bundle);
    assert.equal(saved.independentlyRecoveredTwice,true);
    const before=git(SOURCE,'status','--porcelain');
    const result=rehearsePrivateSandboxSeed(SOURCE,bundle,{
      ...settings,requireWebsite:true
    });
    assert.equal(result.originalCommitVerified,saved.sourceCommit);
    assert.equal(result.originalTreeVerified,saved.sourceTree);
    assert.ok(result.originalTrackedFilesVerified>6);
    assert.equal(result.realGitHubWrites,0);
    assert.equal(result.noMainOrTagRefCreated,true);
    assert.equal(git(SOURCE,'status','--porcelain'),before);
    assert.equal(sha(fs.readFileSync(path.join(SOURCE,'site-content.html'))),
      '34455f6d901c538e2491a8c16681692e4c02d918b1984d7d0ba081aacb1049e8');
  }finally{fs.rmSync(temp,{force:true,recursive:true});}
});
test('private seed rehearsal has no credential access, external API or remote push',()=>{
  const source=fs.readFileSync(path.join(__dirname,'..','tools',
    'rehearse-private-sandbox-branch-seed.cjs'),'utf8');
  for(const forbidden of [
    'fetch(', 'https.request(', 'GITHUB_TOKEN','Authorization:',
    'process.env.','push --mirror','git push','createGitHubSandboxApi('
  ])assert.equal(source.includes(forbidden),false,forbidden);
  assert.match(source,/--no-tags/);
  assert.match(source,/verifyNoMainRef/);
});
