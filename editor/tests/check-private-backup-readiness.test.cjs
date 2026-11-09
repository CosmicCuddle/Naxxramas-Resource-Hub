'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const cp=require('node:child_process');
const {FORMAT,checkBackupReadiness}=
  require('../tools/check-private-backup-readiness.cjs');
function git(cwd,...args) {
  const p=cp.spawnSync('git',args,{cwd,encoding:'utf8',
    timeout:30000,stdio:['ignore','pipe','pipe']});
  if(p.error||p.status!==0)throw Error('Disposable source fixture Git setup failed.');
  return p.stdout.trim();
}
function fixture(fn){
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'naxx-readiness-fictional-'));
  fs.chmodSync(temp,0o700);
  const root=path.join(temp,'site');
  try{
    git(temp,'init','--quiet','--initial-branch=main',root);
    git(root,'config','user.name','Read-only backup readiness test');
    git(root,'config','user.email','readiness@example.invalid');
    fs.writeFileSync(path.join(root,'index.html'),'fictional original page');
    git(root,'add','.');git(root,'commit','-qm','original');
    git(root,'switch','-qc','secondary');
    fs.writeFileSync(path.join(root,'notes.txt'),'a non-source history ref');
    git(root,'add','.');git(root,'commit','-qm','secondary');
    git(root,'switch','-q','main');
    return fn(root,temp);
  }finally{fs.rmSync(temp,{recursive:true,force:true});}
}
test('safe readiness report proves exact clean fetched source without creating a backup',()=>{
  fixture((root,temp)=>{
    const before=git(root,'status','--porcelain');
    const checked=checkBackupReadiness(root,{requireWebsite:false});
    assert.equal(checked.format,FORMAT);
    assert.equal(checked.sourceCommit,git(root,'rev-parse','HEAD'));
    assert.equal(checked.sourceTreeVerified,true);
    assert.equal(checked.cleanCompleteGitCheckout,true);
    assert.equal(checked.fullFetchedHistoryPresent,true);
    assert.equal(checked.originalWebsiteChecksumVerified,false);
    assert.equal(checked.trackedFileCount,1);
    assert.equal(checked.privateBackupWritten,false);
    assert.equal(checked.ownerHeldOffMachineCopyVerified,false);
    assert.equal(checked.githubWrites,0);
    assert.equal(checked.realSaveEnabled,false);
    assert.equal(checked.publishEnabled,false);
    assert.equal(git(root,'status','--porcelain'),before);
    assert.equal(fs.readdirSync(temp).filter(x=>x.endsWith('.bundle')).length,0);
    const printed=JSON.stringify(checked);
    assert.equal(printed.includes(temp),false);
    assert.equal(printed.includes('notes.txt'),false);
  });
});
test('refuses a dirty or ignored source rather than allowing an unprotected backup',()=>{
  fixture(root=>{
    fs.writeFileSync(path.join(root,'index.html'),'unsaved edits');
    assert.throws(()=>checkBackupReadiness(root,{requireWebsite:false}),
      /modified or untracked/);
    git(root,'restore','index.html');
    fs.writeFileSync(path.join(root,'untracked.private'),'untracked material');
    assert.throws(()=>checkBackupReadiness(root,{requireWebsite:false}),
      /modified or untracked/);
  });
});
test('refuses a shallow checkout even when it is clean',()=>{
  fixture(root=>{
    const dotGit=path.join(root,'.git');
    fs.writeFileSync(path.join(dotGit,'shallow'),git(root,'rev-parse','HEAD')+'\n');
    assert.equal(git(root,'rev-parse','--is-shallow-repository'),'true');
    assert.throws(()=>checkBackupReadiness(root,{requireWebsite:false}),/shallow/);
  });
});
test('refuses non-absolute or incomplete roots and has no network credentials',()=>{
  assert.throws(()=>checkBackupReadiness('relative/source',{requireWebsite:false}),/absolute/);
  assert.throws(()=>checkBackupReadiness(path.join(os.tmpdir(),'definitely-no-git-here'),
    {requireWebsite:false}));
  const s=fs.readFileSync(path.join(__dirname,'..','tools',
    'check-private-backup-readiness.cjs'),'utf8');
  for(const banned of [
    'fetch(', 'node:https', 'https.request', 'GITHUB_TOKEN',
    'Authorization:', 'git push', 'updateRefs(', 'process.env.'
  ])assert.equal(s.includes(banned),false,banned);
  assert.match(s,/baseline/);
  assert.match(s,/privateBackupWritten:false/);
});

test('real original website source is ready only if complete Git checkout is clean and checksum matches',()=>{
  const website=path.resolve(__dirname,'..','..');
  const report=checkBackupReadiness(website);
  assert.equal(report.format,FORMAT);
  assert.equal(report.cleanCompleteGitCheckout,true);
  assert.equal(report.originalWebsiteChecksumVerified,true);
  assert.equal(report.sourceCommit,git(website,'rev-parse','HEAD'));
  assert.ok(report.trackedFileCount>=10);
  assert.equal(report.privateBackupWritten,false);
  assert.equal(report.ownerHeldOffMachineCopyVerified,false);
  assert.equal(report.githubWrites,0);
  assert.equal(report.publishEnabled,false);
});

test('Git explicitly preserves the original resource payload LF bytes on Windows checkout',()=>{
  const website=path.resolve(__dirname,'..','..');
  const attributes=fs.readFileSync(path.join(website,'.gitattributes'),'utf8');
  assert.match(attributes,/^site-content\.html text eol=lf\s*$/m);
  const configured=git(website,'check-attr','eol','--','site-content.html');
  assert.match(configured,/site-content\.html: eol: lf/);
  const actual=fs.readFileSync(path.join(website,'site-content.html'));
  const crypto=require('node:crypto');
  assert.equal(crypto.createHash('sha256').update(actual).digest('hex'),
    '34455f6d901c538e2491a8c16681692e4c02d918b1984d7d0ba081aacb1049e8');
});
