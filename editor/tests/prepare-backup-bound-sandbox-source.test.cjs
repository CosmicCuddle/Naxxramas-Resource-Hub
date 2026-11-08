'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const cp=require('node:child_process'),crypto=require('node:crypto'),vm=require('node:vm');
const {saveBackup}=require('../tools/create-local-git-backup.cjs');
const {PAGES,NAV,runs}=require('../tools/plan-page-draft.cjs');
const {SOURCE_SHA}=require('../tools/audit-source-storage-budget.cjs');
const {prepareWithRetainedBackup,FORMAT}=
  require('../tools/prepare-backup-bound-sandbox-source.cjs');
const root=path.resolve(__dirname,'..','..'),editor=path.join(root,'editor');
const REPO='CosmicCuddle/Naxxramas-Editor-Save-Sandbox-01';
const head=cp.execFileSync('git',['rev-parse','HEAD'],{
  cwd:root,encoding:'utf8'}).trim();
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
const gitStatus=()=>cp.execFileSync('git',['status','--porcelain=v1','--untracked-files=all'],{
  cwd:root,encoding:'utf8'}).trim();
async function browserZip(){
  const first=runs(fs.readFileSync(path.join(root,PAGES[0]),'utf8'))
    .find(x=>x.kind==='text');
  assert.ok(first,'The original first page contains a protected text run.');
  const navBuf=fs.readFileSync(path.join(root,NAV));
  const nav=JSON.parse(navBuf.toString('utf8'));
  nav.pages[0].label='Retained backup source-gate test only';
  const pages={
    format:'naxx-local-draft-v3',sourceBranchHint:'feature/multi-file-editor-export-2026-11-05',
    sourceCommitVerified:false,createdAt:'2026-11-08T00:00:00Z',
    files:PAGES.map(p=>({
      path:p,sourceSha256:sha(fs.readFileSync(path.join(root,p))),
      edits:p===PAGES[0]?{[first.id]:'Original site preserved while verifying backup'}:{}
    })),
    navigation:{path:NAV,sourceSha256:sha(navBuf),document:nav}
  };
  const resources={format:'naxx-local-resource-draft-v2',
    baselineSha256:SOURCE_SHA,changes:[
      {index:0,title:'Disposable backed-up source title'},
      {index:413,content:'Disposable backed-up source description.'}
    ]
  };
  const globals={TextEncoder,Blob,Uint8Array,Uint32Array,DataView,
    crypto:crypto.webcrypto,document:{getElementById(){return null;}}};
  for(const script of ['export-zip.js','review-package.js'])
    vm.runInNewContext(fs.readFileSync(path.join(editor,script),'utf8'),
      globals,{filename:script,timeout:5000});
  const output=await globals.NaxxEditorReview.build(
    pages,resources,globals.NaxxEditorZip
  );
  return Buffer.from(await output.blob.arrayBuffer());
}
function argumentsFor(bundle,zip){return {
  checkout:root,backupFile:bundle,zip,expectedCommit:head,
  repository:REPO,testOnly:true,ownerRemoteWriteApprovalGiven:false,
  sourceLayoutApproved:false
};}
test('real 31MB original website ZIP requires retained restored history before exact 418-file source staging',async()=>{
  const statusBefore=gitStatus();
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'naxx-backup-bound-source-test-'));
  fs.chmodSync(temp,0o700);
  try{
    const backup=path.join(temp,'private-original-history.bundle');
    const report=saveBackup(root,backup);
    assert.equal(report.independentlyRecoveredTwice,true);
    const zip=await browserZip();
    const prepared=await prepareWithRetainedBackup(argumentsFor(backup,zip));
    assert.equal(prepared.format,FORMAT);
    assert.equal(prepared.originalGitHistoryReverifiedBeforeAndAfter,true);
    assert.equal(prepared.savedPrivateBundleActuallyRestoredTwiceAgain,true);
    assert.equal(prepared.completeOriginalSiteRebuiltAndRolledBack,true);
    assert.equal(prepared.originalCheckoutUnchanged,true);
    assert.equal(prepared.candidate.files.length,418);
    assert.equal(prepared.candidate.proof.newOverlayGitBlobs,415);
    assert.equal(prepared.candidate.proof.changedExistingGitBlobs,3);
    assert.equal(prepared.exactOriginalGitCommit,head);
    assert.equal(prepared.verifiedSandboxRepository,REPO);
    assert.equal(prepared.actualGitHubSandboxWriteAuthorized,false);
    assert.equal(prepared.ownerHeldOffMachineCopyVerified,false);
    assert.equal(prepared.liveGitHubSaveEnabled,false);
    assert.equal(prepared.githubWrites,0);
    assert.equal(gitStatus(),statusBefore);
    assert.equal(sha(fs.readFileSync(path.join(root,'site-content.html'))),SOURCE_SHA);
  }finally{fs.rmSync(temp,{recursive:true,force:true});}
});
test('before stage: missing and malicious approval/production target are refused',async()=>{
  const base=argumentsFor('/invalid/missing.bundle',Buffer.alloc(64));
  for(const input of [
    {...base,ownerRemoteWriteApprovalGiven:true},
    {...base,sourceLayoutApproved:true},
    {...base,testOnly:false},
    {...base,repository:'CosmicCuddle/Naxxramas-Resource-Hub'},
    {...base,expectedCommit:'bad'},
    {...base,backupFile:''}
  ])await assert.rejects(prepareWithRetainedBackup(input));
});
test('source preparation code has no production writer, GitHub token, or network client',()=>{
  const code=fs.readFileSync(path.join(editor,'tools',
    'prepare-backup-bound-sandbox-source.cjs'),'utf8');
  for(const banned of ['fetch(', 'https.request', 'node:https',
    'GITHUB_TOKEN','process.env.','updateRefs(', 'git push',
    'createGitHubSandboxApi('])
    assert.equal(code.includes(banned),false,banned);
  assert.match(code,/verifyRetainedBackup/);
  assert.match(code,/prepareSandboxSource/);
});
