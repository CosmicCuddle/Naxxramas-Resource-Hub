'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const crypto=require('node:crypto'),cp=require('node:child_process'),vm=require('node:vm');
const root=path.resolve(__dirname,'..','..'),editor=path.join(root,'editor');
const {PAGES,NAV,runs}=require('../tools/plan-page-draft.cjs');
const {FORMAT,parseArgs,privateZip,planFromReviewZip,reviewSavedZip}=
  require('../tools/review-private-combined-zip.cjs');
const {SOURCE_SHA}=require('../tools/audit-source-storage-budget.cjs');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const head=cp.execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
const status=()=>cp.execFileSync('git',['status','--porcelain=v1',
  '--untracked-files=all'],{cwd:root,encoding:'utf8'}).trim();
function editorWriter(){
  const sandbox={TextEncoder,Blob,Uint8Array,Uint32Array,DataView,
    crypto:crypto.webcrypto,document:{getElementById(){return null;}}};
  for(const filename of ['export-zip.js','review-package.js'])
    vm.runInNewContext(fs.readFileSync(path.join(editor,filename),'utf8'),
      sandbox,{filename,timeout:5000});
  return sandbox;
}
function drafts(){
  const sourceFile=path.join(root,PAGES[0]);
  const source=fs.readFileSync(sourceFile);
  const first=runs(source.toString('utf8')).find(x=>x.kind==='text');
  assert.ok(first);
  return {
    pages:{
      format:'naxx-local-draft-v3',
      sourceBranchHint:'feature/multi-file-editor-export-2026-11-05',
      sourceCommitVerified:false,createdAt:'2026-11-05T00:00:00.000Z',
      files:PAGES.map(p=>({path:p,
        sourceSha256:sha(fs.readFileSync(path.join(root,p))),
        edits:p===PAGES[0]?{[first.id]:'Private review ZIP verified page edit'}:{}
      })),
      navigation:{path:NAV,
        sourceSha256:sha(fs.readFileSync(path.join(root,NAV))),
        document:JSON.parse(fs.readFileSync(path.join(root,NAV),'utf8'))}
    },
    resources:{format:'naxx-local-resource-draft-v2',
      baselineSha256:SOURCE_SHA,
      changes:[{index:0,title:'Private ZIP source-bound resource test'}]}
  };
}
async function browserArchive(pageDraft,resourceDraft){
  const writer=editorWriter();
  const pkg=await writer.NaxxEditorReview.build(pageDraft,resourceDraft,writer.NaxxEditorZip);
  return Buffer.from(await pkg.blob.arrayBuffer());
}
test('actual browser-generated private ZIP becomes one real checkout-bound NON-PUBLISHABLE change plan',async()=>{
  const originalStatus=status(),d=drafts();
  const zip=await browserArchive(d.pages,d.resources);
  const plan=await planFromReviewZip(root,zip,head);
  assert.equal(plan.format,FORMAT);
  assert.equal(plan.reviewOnly,true);
  assert.equal(plan.gitHubReady,false);
  assert.equal(plan.inputPrivateZipSha256,sha(zip));
  assert.equal(plan.expectedGitCommit,head);
  assert.equal(plan.existingPageAndNavigationChanges,1);
  assert.equal(plan.proposedResourceChanges,1);
  assert.equal(plan.changedPathsTotal,2);
  assert.equal(plan.checkedResourceCount,414);
  assert.equal(plan.originalResourceRuntimeSha256,SOURCE_SHA);
  assert.notEqual(plan.proposedCompatibilitySha256,SOURCE_SHA);
  assert.equal(plan.compatibilityReconstructionVerified,true);
  assert.equal(plan.resourceCandidateRollbackVerified,true);
  assert.equal(plan.cleanGitCheckoutBeforeAndAfter,true);
  assert.equal(plan.sourceLayoutSelected,false);
  assert.equal(plan.proposedResourceLayoutUnapproved,true);
  assert.equal(plan.completeRepositoryBackup,false);
  assert.equal(plan.gitDraftAuthorshipVerified,false);
  assert.equal(plan.realGitHubAtomicWriteVerified,false);
  assert.equal(plan.canApply,false);
  assert.equal(plan.canPush,false);
  assert.equal(plan.canPublish,false);
  assert.equal(plan.repositoryFilesWritten,0);
  assert.equal(plan.gitHubWrites,0);
  assert.equal(plan.textOrResourceValuesPrinted,false);
  assert.equal(plan.proposedPaths.length,2);
  assert.ok(plan.proposedPaths.some(x=>x.path===PAGES[0]&&x.trackedInGit===true));
  assert.ok(plan.proposedPaths.some(x=>x.path===
    'content/legacy/resources/0001.fragment'&&x.trackedInGit===false));
  const shown=JSON.stringify(plan);
  assert.ok(!shown.includes('Private ZIP source-bound resource test'));
  assert.ok(!shown.includes('Private review ZIP verified page edit'));
  assert.equal(status(),originalStatus);
});
test('damaged browser ZIP, mismatched source and stale checkout commit fail closed',async()=>{
  const d=drafts(),good=await browserArchive(d.pages,d.resources);
  const broken=Buffer.from(good);
  const idx=broken.indexOf(Buffer.from('Private review ZIP verified page edit'));
  assert.ok(idx>0);broken[idx]^=4;
  await assert.rejects(planFromReviewZip(root,broken,head),
    /unsafe or corrupted|incomplete/i);
  await assert.rejects(planFromReviewZip(root,good,'f'.repeat(40)),
    /Checkout commit changed/);
  const wrong=drafts();
  wrong.pages.files[0].sourceSha256='f'.repeat(64);
  const forged=await browserArchive(wrong.pages,wrong.resources);
  await assert.rejects(planFromReviewZip(root,forged,head),
    /Page source hash mismatch/);
});
test('combined archive cannot be supplied from within the live checkout or through unsafe paths',async()=>{
  assert.throws(()=>privateZip(root,path.join(root,'README.md')),
    /outside the Git checkout/);
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'naxx-private-combined-input-'));
  try{
    const archive=path.join(dir,'review.zip');
    const d=drafts(),zip=await browserArchive(d.pages,null);
    fs.writeFileSync(archive,zip,{flag:'wx',mode:0o600});
    const descriptor=privateZip(root,archive);
    assert.equal(sha(descriptor.bytes),sha(zip));
    const review=await reviewSavedZip(root,archive,head);
    assert.equal(review.reviewedBrowserPageDraft,true);
    assert.equal(review.reviewedBrowserResourceDraft,false);
    assert.equal(review.proposedResourceChanges,0);
    assert.equal(review.existingPageAndNavigationChanges,1);
    assert.equal(review.compatibilityReconstructionVerified,true);
    const link=path.join(dir,'symlink.zip');
    fs.symlinkSync(archive,link);
    assert.throws(()=>privateZip(root,link),/unsafe|too large/);
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('CLI requires three distinct named parameters with an explicit reviewed Git commit',()=>{
  assert.deepEqual(parseArgs(['--checkout','/repo','--zip','/tmp/one.zip',
    '--commit','a'.repeat(40)]),
    {checkout:'/repo',archive:'/tmp/one.zip',expectedCommit:'a'.repeat(40)});
  assert.throws(()=>parseArgs(['--checkout','/repo','--zip','/tmp/one.zip']),
    /three named arguments/);
  assert.throws(()=>parseArgs(['--zip','/tmp/one.zip','--zip','/tmp/two.zip',
    '--commit','a'.repeat(40)]),/duplicated review option/);
  assert.throws(()=>parseArgs(['--checkout','/repo','--zip','/tmp/one.zip',
    '--unknown','unused']),/Unknown or duplicated/);
});
test('review helper never calls GitHub, deploys content or writes to the checkout',()=>{
  const code=fs.readFileSync(path.resolve(__dirname,'..','tools',
    'review-private-combined-zip.cjs'),'utf8');
  for(const needle of ['https.request(', 'fetch(', 'update_ref(',
    'create_commit(', 'GITHUB_TOKEN', 'git push','git commit',
    'fs.writeFileSync(', 'fs.rmSync(', 'fs.renameSync('])
    assert.equal(code.includes(needle),false,needle);
  assert.match(code,/realGitHubAtomicWriteVerified:false/);
  assert.match(code,/sourceLayoutSelected:false/);
});
