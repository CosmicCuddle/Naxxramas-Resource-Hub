'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const cp=require('node:child_process'),crypto=require('node:crypto');
const {
  FORMAT,verifyBackupBinding,withBackupBoundBrowserReview
}=require('../tools/rehearse-backup-bound-browser-review.cjs');
const {PAGES,NAV,runs}=require('../tools/plan-page-draft.cjs');
const {decide:decideSaveOutcome}=
  require('../tools/review-backup-bound-save-outcome.cjs');
const {SOURCE_SHA}=require('../tools/audit-source-storage-budget.cjs');
const root=path.resolve(__dirname,'..','..');
const head=cp.execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
const tree=cp.execFileSync('git',['rev-parse','HEAD^{tree}'],{
  cwd:root,encoding:'utf8'}).trim();
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const gitStatus=()=>cp.execFileSync('git',['status','--porcelain=v1',
  '--untracked-files=all'],{cwd:root,encoding:'utf8'}).trim();
const at=(root,rel)=>path.join(root,...rel.split('/'));
function draft(){
  const original=fs.readFileSync(at(root,PAGES[0]),'utf8');
  const token=runs(original).find(x=>x.kind==='text');
  assert.ok(token);
  const navBytes=fs.readFileSync(at(root,NAV));
  return {
    pages:{
      format:'naxx-local-draft-v3',
      sourceBranchHint:'feature/multi-file-editor-export-2026-11-05',
      sourceCommitVerified:false,createdAt:'2026-11-07T00:00:00.000Z',
      files:PAGES.map(p=>({path:p,
        sourceSha256:sha(fs.readFileSync(at(root,p))),
        edits:p===PAGES[0]?{[token.id]:'Backup bound private page review'}:{}
      })),
      navigation:{path:NAV,sourceSha256:sha(navBytes),
        document:JSON.parse(navBytes.toString('utf8'))}
    },
    resources:{
      format:'naxx-local-resource-draft-v2',
      baselineSha256:SOURCE_SHA,
      changes:[{index:0,title:'Backup bound private resource title'}]
    }
  };
}
async function browserZip(pages,resources){
  const browser={TextEncoder,Blob,Uint8Array,Uint32Array,DataView,
    crypto:crypto.webcrypto,document:{getElementById(){return null;}}};
  for(const file of ['export-zip.js','review-package.js'])
    vm.runInNewContext(fs.readFileSync(at(root,'editor/'+file),'utf8'),
      browser,{filename:file,timeout:5000});
  const result=await browser.NaxxEditorReview.build(pages,resources,
    browser.NaxxEditorZip);
  return Buffer.from(await result.blob.arrayBuffer());
}
test('actual browser ZIP + same-commit saved Git bundle + full tracked-site restore pass as one private gate',async()=>{
  const initial=gitStatus(),input=draft();
  const zip=await browserZip(input.pages,input.resources);
  let observed;
  const result=await withBackupBoundBrowserReview(root,zip,head,info=>{
    observed=info.file;
    assert.equal(info.expectedCommit,head);
    const receipt=JSON.parse(fs.readFileSync(info.receiptFile,'utf8'));
    assert.equal(receipt.sourceCommit,head);
    assert.equal(receipt.sourceTree,tree);
    assert.equal(receipt.localFetchedRefsOnly,true);
    const count=receipt.trackedFiles;
    const fingerprint=info.originalCheckoutFingerprint;
    assert.equal(verifyBackupBinding(info.file,head,fingerprint,tree,count)
      .historyBundleChecksumMatched,true);
    function corrupt(filename,transform,error){
      const before=fs.readFileSync(filename);
      try{
        fs.writeFileSync(filename,transform(before));
        assert.throws(()=>verifyBackupBinding(info.file,head,fingerprint,tree,count),
          error);
      }finally{fs.writeFileSync(filename,before);}
    }
    corrupt(info.file,bytes=>{
      const tampered=Buffer.from(bytes);tampered[0]^=1;return tampered;
    },/bundle\/receipt does not match/);
    corrupt(info.receiptFile,bytes=>{
      const changed=JSON.parse(bytes.toString('utf8'));
      changed.sourceCommit='f'.repeat(40);
      return Buffer.from(JSON.stringify(changed)+'\n');
    },/bundle\/receipt does not match/);
    corrupt(info.instructionFile,()=>Buffer.from('Unsafe altered instructions'),
      /recovery instructions do not match/);
    assert.throws(()=>verifyBackupBinding(info.file,'f'.repeat(40),
      fingerprint,tree,count),/bundle\/receipt does not match/);
    assert.equal(verifyBackupBinding(info.file,head,fingerprint,tree,count)
      .backupCommitMatched,true);
  });
  assert.equal(result.format,FORMAT);
  assert.equal(result.reviewedOriginalGitCommit,head);
  assert.equal(result.actualGitHistoryBundleSavedAndRestoredTwice,true);
  assert.equal(result.backupReceiptAndBundleMatchedReviewedCommit,true);
  assert.equal(result.actualBrowserZIPValidated,true);
  assert.equal(result.fullTrackedSitePreservedAndRolledBack,true);
  assert.equal(result.allOriginalCustomScriptsAndAssetsPreserved,true);
  assert.equal(result.completeProposedResourceOverlayFiles,415);
  assert.equal(result.realGitCheckoutUnchanged,true);
  assert.equal(result.backupOnlyTemporary,true);
  assert.equal(result.durableOwnerBackupRetained,false);
  assert.equal(result.backupOfGitHubAccountSettingsOrServices,false);
  assert.equal(result.finalSourceLayoutApproved,false);
  assert.equal(result.realAuthenticatedSaveOrRemoteAtomicUpdate,false);
  assert.equal(result.ownerApproved,false);
  assert.equal(result.canApply,false);
  assert.equal(result.canPush,false);
  assert.equal(result.canMerge,false);
  assert.equal(result.canPublish,false);
  assert.equal(result.originalRepositoryFilesWritten,0);
  assert.equal(result.gitHubWrites,0);
  assert.equal(result.sourceValuesPrinted,false);
  // Use a REAL successfully-restored private backup and browser ZIP report,
  // while all possible ref updates and observations remain fictional.
  const fictionalNext='b'.repeat(40);
  const checksum='c'.repeat(64);
  const shared={
    backupEvidence:result,reviewedCommit:head,
    proposedCommit:fictionalNext,expectedWebsiteSha256:checksum
  };
  const notKnown=decideSaveOutcome({...shared,responseKind:'timeout'});
  assert.equal(notKnown.status,'unresolved-no-head');
  assert.equal(notKnown.neverAutomaticallyRetry,true);
  assert.equal(notKnown.originalDraftMustBeRetained,true);
  assert.equal(notKnown.canApply,false);
  const moved=decideSaveOutcome({
    ...shared,observedHead:'a'.repeat(40),responseKind:'acknowledged'
  });
  assert.equal(moved.status,'stale-branch-refused');
  const candidate=decideSaveOutcome({
    ...shared,observedHead:fictionalNext,responseKind:'timeout',
    candidateMetadata:{
      commit:fictionalNext,sourceSha256:checksum,
      allProposedPathsVerified:true,unchangedPathsVerified:true,
      resourceInventoryVerified:true
    }
  });
  assert.equal(candidate.status,
    'candidate-head-and-metadata-match-needs-authentication');
  assert.equal(candidate.reportCanProveRealSave,false);
  assert.equal(candidate.canPublish,false);
  assert.equal(candidate.githubWrites,0);
  assert.equal(fs.existsSync(observed),false);
  assert.equal(gitStatus(),initial);
});
test('backup gate refuses modified saved receipts BEFORE a staged site can be accepted',async()=>{
  const input=draft(),zip=await browserZip(input.pages,input.resources);
  let observed;
  await assert.rejects(withBackupBoundBrowserReview(root,zip,head,info=>{
    observed=info.file;
    const changed=JSON.parse(fs.readFileSync(info.receiptFile,'utf8'));
    changed.trackedSha256='f'.repeat(64);
    fs.writeFileSync(info.receiptFile,JSON.stringify(changed)+'\n');
  }),/bundle\/receipt does not match/);
  assert.equal(fs.existsSync(observed),false);
});
test('wrong exact reviewed Git commit and one-sided ZIP are refused before backup',async()=>{
  const input=draft(),both=await browserZip(input.pages,input.resources);
  await assert.rejects(withBackupBoundBrowserReview(root,both,'f'.repeat(40)),
    /Checkout commit changed/);
  const one=await browserZip(input.pages,null);
  await assert.rejects(withBackupBoundBrowserReview(root,one,head),
    /Both original page and resource review drafts are required/);
});
test('backup gate cannot make an owner-held backup or connect to GitHub',()=>{
  const source=fs.readFileSync(at(root,
    'editor/tools/rehearse-backup-bound-browser-review.cjs'),'utf8');
  for(const forbidden of ['fetch(', 'https.request(', 'update_ref(',
    'create_commit(', 'git push', 'git commit', 'GITHUB_TOKEN'])
    assert.equal(source.includes(forbidden),false,forbidden);
  assert.match(source,/durableOwnerBackupRetained:false/);
  assert.match(source,/ownerApproved:false,canApply:false,canPush:false/);
});
