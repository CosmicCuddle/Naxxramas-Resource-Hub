'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const crypto=require('node:crypto'),vm=require('node:vm');
const {rehearse,FORMAT}=require('../tools/rehearse-conditional-local-git-save.cjs');
const {PAGES,NAV,runs}=require('../tools/plan-page-draft.cjs');
const {SOURCE_SHA}=require('../tools/audit-source-storage-budget.cjs');
const root=path.resolve(__dirname,'..','..');
const editor=path.join(root,'editor');
const head=cp.execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
const gitStatus=()=>cp.execFileSync('git',['status','--porcelain=v1','--untracked-files=all'],{
  cwd:root,encoding:'utf8'}).trim();
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
function sampleDrafts(){
  const first=runs(fs.readFileSync(path.join(root,PAGES[0]),'utf8'))
    .find(entry=>entry.kind==='text');
  assert.ok(first,'original page has a safe editable text token');
  const navBuffer=fs.readFileSync(path.join(root,NAV));
  const nav=JSON.parse(navBuffer.toString('utf8'));
  nav.pages[0].label='Disposable Git revision example';
  return {
    page:{
      format:'naxx-local-draft-v3',
      sourceBranchHint:'feature/multi-file-editor-export-2026-11-05',
      sourceCommitVerified:false,
      createdAt:'2026-11-08T00:00:00.000Z',
      files:PAGES.map(name=>({
        path:name,sourceSha256:sha(fs.readFileSync(path.join(root,name))),
        edits:name===PAGES[0]?{[first.id]:'Disposable Git test page wording'}:{}
      })),
      navigation:{path:NAV,sourceSha256:sha(navBuffer),document:nav}
    },
    resources:{
      format:'naxx-local-resource-draft-v2',
      baselineSha256:SOURCE_SHA,
      changes:[
        {index:0,title:'Temporary local Git title proof'},
        {index:413,content:'Temporary local Git content paragraph.\n\nMore text.'}
      ]
    }
  };
}
async function archive(page,resources){
  const sandbox={
    TextEncoder,Blob,Uint8Array,Uint32Array,DataView,
    crypto:crypto.webcrypto,document:{getElementById(){return null;}}
  };
  for(const name of ['export-zip.js','review-package.js'])
    vm.runInNewContext(fs.readFileSync(path.join(editor,name),'utf8'),
      sandbox,{filename:name,timeout:5000});
  const result=await sandbox.NaxxEditorReview.build(page,resources,sandbox.NaxxEditorZip);
  return Buffer.from(await result.blob.arrayBuffer());
}
test('REAL first 415-source Save: full original browser ZIP, exact Git tree, local commit, stale refusal, rollback and deletion',async()=>{
  const originalSource=fs.readFileSync(path.join(root,'site-content.html'));
  assert.equal(originalSource.length,30976969);
  assert.equal(sha(originalSource),SOURCE_SHA);
  const initialStatus=gitStatus();
  const d=sampleDrafts(),zip=await archive(d.page,d.resources);
  const proof=await rehearse(root,zip,head);
  assert.equal(proof.format,FORMAT);
  assert.equal(proof.onlyDisposableGitClone,true);
  assert.equal(proof.candidateGitCommitCreatedAndVerified,true);
  assert.equal(proof.independentTreeShaMatched,true);
  assert.equal(proof.changedOriginalGitBlobs,3);
  assert.equal(proof.resourceSourceBlobs,415);
  assert.equal(proof.stagedPathsVerified,418);
  assert.equal(proof.exactOldLocalRefAdvanceVerified,true);
  assert.equal(proof.staleSecondLocalSaveRejected,true);
  assert.equal(proof.originalLocalRefRecovered,true);
  assert.equal(proof.privateGitCloneDeleted,true);
  assert.equal(proof.originalSiteRollbackVerified,true);
  assert.equal(proof.originalSourceCommitUnchanged,true);
  assert.equal(proof.temporaryCandidateDeleted,true);
  assert.equal(proof.originalRepositoryWritten,false);
  assert.equal(proof.githubWrites,0);
  assert.equal(proof.githubRemoteCASProven,false);
  assert.equal(proof.githubSaveEnabled,false);
  assert.equal(proof.ownerHeldBackupRetained,false);
  assert.equal(proof.sourceLayoutApproved,false);
  assert.equal(proof.canPush,false);
  assert.equal(proof.canPublish,false);
  assert.equal(gitStatus(),initialStatus);
  assert.equal(sha(fs.readFileSync(path.join(root,'site-content.html'))),SOURCE_SHA);
});
test('wrong pinned Git version refuses the Save rehearsal before any edit',async()=>{
  const d=sampleDrafts(),zip=await archive(d.page,d.resources);
  await assert.rejects(rehearse(root,zip,'f'.repeat(40)),
    /Checkout commit changed|checkout|source|Git/i);
});
test('no remote writer, repository ref updater or publish code is present',()=>{
  const source=fs.readFileSync(path.join(editor,'tools',
    'rehearse-conditional-local-git-save.cjs'),'utf8');
  for(const forbidden of [
    'https.request(', 'fetch(', 'https://api.github.com',
    'git push','GITHUB_TOKEN','GITHUB_PAT','process.env.GITHUB_TOKEN',
    "['push'", "['remote'", 'updateRefs('
  ])assert.equal(source.includes(forbidden),false,forbidden);
  assert.match(source,/--no-hardlinks/);
  assert.match(source,/update-ref/);
  assert.match(source,/privateGitCloneDeleted:true/);
});

test('all 415 source overlay paths are a Set and local Git staging uses Set membership and size',()=>{
  const {filePaths,COUNT}=require('../tools/rehearse-resource-only-overlay.cjs');
  const values=filePaths();
  assert.equal(values instanceof Set,true);
  assert.equal(values.size,COUNT+1);
  assert.equal(values.has('content/resource-overlays/manifest.json'),true);
  const code=fs.readFileSync(path.join(editor,'tools',
    'rehearse-conditional-local-git-save.cjs'),'utf8');
  assert.match(code,/resourcePaths\.size\s*\+\s*view\.changeSet\.size/);
  assert.match(code,/resourcePaths\.has\(relative\)/);
  assert.doesNotMatch(code,/resourcePaths\.length\b|resourcePaths\.includes\(/);
});
